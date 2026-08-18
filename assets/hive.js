/* ==========================================================================
   NightHive — hero canvas ("the hive")
   --------------------------------------------------------------------------
   One large structure at the centre, behind the headline: a rotating lattice
   of points on a sphere, wired together where they come close, with a glowing
   core. That's the hive — a single robust digital object rather than a field
   of scattered dots. Behind it, small nodes drift in and out of view: the
   other parties happening elsewhere.

   It reacts to the pointer. Moving the mouse tilts the whole lattice (the
   rotation offset is eased toward the cursor, never snapped), so it feels
   like a solid object being turned rather than a reactive gimmick. Touch
   devices simply get the idle rotation.

   Occasionally two points on the lattice flare with a bright magenta link.
   That's the product's rule made visible: a match only ever happens between
   two people inside the same party.

   Performance, since this sits behind the fold on phones:
     - point count scales with viewport and is hard-capped
     - the O(n²) link pass runs over a deliberately small n (≤ 92)
     - device pixel ratio capped at 2; 3x phones gain nothing here
     - glow comes from additive compositing, never shadowBlur
     - rAF stops entirely when the hero scrolls away or the tab is hidden
   ========================================================================== */
(function () {
  var canvas = document.getElementById('hive-canvas');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The waitlist page runs the same structure a little smaller and dimmer,
  // because its form sits directly on top of the centre.
  var compact = canvas.getAttribute('data-variant') === 'compact';

  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  var w = 0;
  var h = 0;
  var cx = 0;
  var cy = 0;
  var radius = 0;
  var points = [];
  var ambient = [];
  var flares = [];

  // Pointer-driven tilt. `cur` eases toward `target` every frame so the
  // lattice turns with weight instead of snapping to the cursor.
  var target = { x: 0, y: 0 };
  var cur = { x: 0, y: 0 };

  var rafId = null;
  var running = false;
  var onScreen = true;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function build() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    w = Math.max(rect.width, 1);
    h = Math.max(rect.height, 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cx = w / 2;
    cy = h / 2;
    radius = Math.min(w, h) * (compact ? 0.28 : 0.37);
    radius = Math.max(130, Math.min(radius, compact ? 280 : 430));

    // Fibonacci sphere: even coverage with no clustering at the poles, which
    // a naive random distribution always produces.
    var count = w < 700 ? 52 : w < 1100 ? 74 : 92;
    points = [];
    for (var i = 0; i < count; i++) {
      var y = 1 - (i / Math.max(count - 1, 1)) * 2;
      var ring = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = i * GOLDEN_ANGLE;
      points.push({
        x: Math.cos(theta) * ring,
        y: y,
        z: Math.sin(theta) * ring,
        px: 0,
        py: 0,
        depth: 0,
        twinkle: rand(0, Math.PI * 2)
      });
    }

    // Distant parties drifting behind the structure.
    var ambientCount = w < 700 ? 10 : 18;
    ambient = [];
    for (var j = 0; j < ambientCount; j++) {
      ambient.push({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.08, 0.08),
        vy: rand(-0.05, 0.05),
        r: rand(28, 78),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.12, 0.32)
      });
    }

    flares = [];
  }

  function step(now) {
    var t = now * 0.001;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // ---------- distant parties ----------
    for (var a = 0; a < ambient.length; a++) {
      var n = ambient[a];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -n.r) n.x = w + n.r;
      if (n.x > w + n.r) n.x = -n.r;
      if (n.y < -n.r) n.y = h + n.r;
      if (n.y > h + n.r) n.y = -n.r;

      // Slow fade in and out so the background keeps changing without
      // anything ever popping.
      var fade = 0.5 + 0.5 * Math.sin(t * n.speed + n.phase);
      var alpha = 0.05 + fade * 0.11;
      var g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, 'rgba(206,3,95,' + alpha.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(206,3,95,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,140,190,' + (alpha * 1.7).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---------- ease the tilt toward the pointer ----------
    cur.x += (target.x - cur.x) * 0.045;
    cur.y += (target.y - cur.y) * 0.045;

    var rotY = t * 0.16 + cur.x * 0.55;
    var rotX = Math.sin(t * 0.11) * 0.16 + cur.y * 0.42;
    var cosY = Math.cos(rotY);
    var sinY = Math.sin(rotY);
    var cosX = Math.cos(rotX);
    var sinX = Math.sin(rotX);
    var FOV = 2.6;

    // ---------- project the lattice ----------
    for (var p = 0; p < points.length; p++) {
      var pt = points[p];
      var x1 = pt.x * cosY - pt.z * sinY;
      var z1 = pt.x * sinY + pt.z * cosY;
      var y2 = pt.y * cosX - z1 * sinX;
      var z2 = pt.y * sinX + z1 * cosX;
      var persp = FOV / (FOV + z2);
      pt.px = cx + x1 * radius * persp;
      pt.py = cy + y2 * radius * persp;
      pt.depth = (z2 + 1) / 2; // 0 = far side, 1 = near side
    }

    // ---------- wire it together ----------
    var link = radius * 0.46;
    var linkSq = link * link;
    ctx.lineWidth = 1;
    for (var i = 0; i < points.length; i++) {
      var A = points[i];
      for (var k = i + 1; k < points.length; k++) {
        var B = points[k];
        var dx = A.px - B.px;
        var dy = A.py - B.py;
        var d2 = dx * dx + dy * dy;
        if (d2 > linkSq) continue;
        var closeness = 1 - Math.sqrt(d2) / link;
        var depth = (A.depth + B.depth) / 2;
        var la = closeness * (0.09 + depth * 0.44) * (compact ? 0.62 : 1);
        ctx.strokeStyle = 'rgba(236,72,153,' + la.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(A.px, A.py);
        ctx.lineTo(B.px, B.py);
        ctx.stroke();
      }
    }

    // ---------- the points themselves ----------
    for (var q = 0; q < points.length; q++) {
      var s = points[q];
      var tw = 0.75 + 0.25 * Math.sin(t * 1.6 + s.twinkle);
      var size = (0.7 + s.depth * 1.9) * (compact ? 0.85 : 1);
      var pa = (0.16 + s.depth * 0.72) * tw * (compact ? 0.75 : 1);
      ctx.fillStyle = 'rgba(255,225,240,' + pa.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.px, s.py, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---------- the core ----------
    var pulse = 0.62 + 0.38 * Math.sin(t * 0.8);
    var coreR = radius * (0.5 + pulse * 0.16);
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    var peak = (compact ? 0.16 : 0.24) * pulse;
    core.addColorStop(0, 'rgba(255,45,135,' + peak.toFixed(3) + ')');
    core.addColorStop(0.42, 'rgba(206,3,95,' + (peak * 0.34).toFixed(3) + ')');
    core.addColorStop(1, 'rgba(206,3,95,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,190,220,' + (0.5 * pulse).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, 2 + pulse * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // ---------- matches: a bright link between two near-side points ----------
    if (points.length > 6 && flares.length < 3 && Math.random() < 0.022) {
      var m = points[Math.floor(Math.random() * points.length)];
      var o = points[Math.floor(Math.random() * points.length)];
      if (m !== o && m.depth > 0.55 && o.depth > 0.55) {
        flares.push({ a: m, b: o, born: now });
      }
    }
    for (var f = flares.length - 1; f >= 0; f--) {
      var fl = flares[f];
      var age = (now - fl.born) / 1400;
      if (age >= 1) {
        flares.splice(f, 1);
        continue;
      }
      var alphaF = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85;
      ctx.strokeStyle = 'rgba(255,45,135,' + (alphaF * 0.8).toFixed(3) + ')';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(fl.a.px, fl.a.py);
      ctx.lineTo(fl.b.px, fl.b.py);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,165,' + (alphaF * 0.95).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(fl.a.px, fl.a.py, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fl.b.px, fl.b.py, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 1;

    ctx.globalCompositeOperation = 'source-over';
    rafId = window.requestAnimationFrame(step);
  }

  function start() {
    if (running || reduceMotion || !onScreen) return;
    running = true;
    rafId = window.requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Pointer tilt. Bound to the window rather than the canvas so the lattice
  // keeps responding while the cursor is over the headline sitting on top of
  // it -- the canvas itself never receives those events.
  window.addEventListener(
    'mousemove',
    function (e) {
      var rect = canvas.getBoundingClientRect();
      if (rect.height <= 0) return;
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    },
    { passive: true }
  );
  window.addEventListener('mouseleave', function () {
    target.x = 0;
    target.y = 0;
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var was = running;
      stop();
      build();
      if (reduceMotion) step(0);
      else if (was) start();
    }, 180);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  if (window.IntersectionObserver) {
    new window.IntersectionObserver(
      function (entries) {
        onScreen = entries[0].isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 }
    ).observe(canvas);
  }

  build();
  if (reduceMotion) step(0); // one static frame; still reads as the hive
  else start();
})();
