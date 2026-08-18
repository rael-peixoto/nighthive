/* ==========================================================================
   NightHive — hero canvas ("the hive")
   --------------------------------------------------------------------------
   Ambient background for the landing hero. It draws the product's actual
   mechanic rather than generic decoration: glowing nodes are parties,
   drifting points are people, and a point is pulled toward whichever party
   it's heading to. When two people at the SAME party drift close together,
   a magenta line flares between them — a match. Nothing connects across
   different parties, which is precisely the rule the app enforces.

   Deliberately NOT the usual "constellation" effect (every nearby pair
   linked): connections here are sparse, brief, and only ever within one
   party, so the visual says something true about the product.

   Performance notes, since this runs behind the fold on phones:
     - particle count scales with viewport area and is hard-capped
     - device pixel ratio capped at 2 (3x phones gain nothing visible here
       and pay 2.25x the fill cost)
     - no shadowBlur in the draw loop; glow comes from additive compositing
       ('lighter'), which is dramatically cheaper
     - match detection samples a few candidate pairs per party per frame
       instead of testing every pair, so cost stays linear
     - rAF is stopped entirely when the hero scrolls out of view or the tab
       is hidden, so it costs nothing while reading the rest of the page
   ========================================================================== */
(function () {
  var canvas = document.getElementById('hive-canvas');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var MAGENTA = [255, 45, 135];
  var VIOLET = [150, 90, 255];

  var w = 0;
  var h = 0;
  var nodes = [];
  var people = [];
  var flashes = [];
  var rafId = null;
  var running = false;
  var visible = true;

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

    // Parties. Kept to the right/centre so they sit behind the artwork side
    // of the hero rather than fighting the headline, which is left-aligned.
    var nodeCount = w < 700 ? 3 : w < 1100 ? 4 : 5;
    nodes = [];
    for (var i = 0; i < nodeCount; i++) {
      var t = (i + 0.5) / nodeCount;
      nodes.push({
        x: w * (w < 860 ? rand(0.2, 0.8) : rand(0.45, 0.95)),
        y: h * (0.16 + t * 0.62 + rand(-0.07, 0.07)),
        r: rand(46, 88),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.35, 0.7),
        hue: i % 3 === 1 ? VIOLET : MAGENTA
      });
    }

    // People. Scaled by area so a phone doesn't render a desktop's worth of
    // points, and capped so an ultrawide monitor doesn't melt either.
    var target = Math.round((w * h) / 13000);
    var count = Math.max(26, Math.min(target, w < 700 ? 46 : 110));
    people = [];
    for (var j = 0; j < count; j++) {
      var node = nodes[Math.floor(Math.random() * nodes.length)];
      people.push({
        x: rand(0, w),
        y: rand(0, h),
        vx: 0,
        vy: 0,
        node: node,
        size: rand(0.9, 2.2),
        wander: rand(0, Math.PI * 2),
        // Staggered so people don't all migrate between parties in lockstep.
        switchAt: performance.now() + rand(4000, 16000)
      });
    }
    flashes = [];
  }

  function step(now) {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // ---- parties: soft pulsing glow ----
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var pulse = 0.62 + 0.38 * Math.sin(now * 0.001 * n.speed + n.phase);
      var g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * (0.85 + pulse * 0.35));
      var c = n.hue;
      g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.2 * pulse).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.06 * pulse).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * (0.85 + pulse * 0.35), 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.5 * pulse).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.8 + pulse * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- people: spring toward their party, with a little wander ----
    for (var p = 0; p < people.length; p++) {
      var a = people[p];

      if (now > a.switchAt) {
        a.node = nodes[Math.floor(Math.random() * nodes.length)];
        a.switchAt = now + rand(6000, 20000);
      }

      a.wander += 0.012;
      var dx = a.node.x - a.x;
      var dy = a.node.y - a.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Attraction eases off inside the party's radius so people mill about
      // in a loose cluster instead of collapsing onto a single point.
      var pull = dist > a.node.r ? 0.00055 : -0.00035;
      a.vx += dx * pull + Math.cos(a.wander) * 0.008;
      a.vy += dy * pull + Math.sin(a.wander * 1.3) * 0.008;
      a.vx *= 0.975;
      a.vy *= 0.975;
      a.x += a.vx;
      a.y += a.vy;

      // Wrap softly at the edges
      if (a.x < -20) a.x = w + 20;
      if (a.x > w + 20) a.x = -20;
      if (a.y < -20) a.y = h + 20;
      if (a.y > h + 20) a.y = -20;

      var near = 1 - Math.min(dist / (a.node.r * 2.2), 1);
      ctx.fillStyle = 'rgba(232,238,245,' + (0.2 + near * 0.62).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- matches: sample a few same-party pairs per frame ----
    if (people.length > 3 && flashes.length < 7) {
      for (var s = 0; s < 5; s++) {
        var m = people[Math.floor(Math.random() * people.length)];
        var o = people[Math.floor(Math.random() * people.length)];
        if (m === o || m.node !== o.node) continue;
        var mdx = m.x - o.x;
        var mdy = m.y - o.y;
        if (mdx * mdx + mdy * mdy < 5200) {
          flashes.push({ ax: m.x, ay: m.y, bx: o.x, by: o.y, born: now });
          break;
        }
      }
    }

    for (var f = flashes.length - 1; f >= 0; f--) {
      var fl = flashes[f];
      var age = (now - fl.born) / 1100;
      if (age >= 1) {
        flashes.splice(f, 1);
        continue;
      }
      // Quick flare, slow fade
      var alpha = age < 0.18 ? age / 0.18 : 1 - (age - 0.18) / 0.82;
      ctx.strokeStyle = 'rgba(255,45,135,' + (alpha * 0.85).toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(fl.ax, fl.ay);
      ctx.lineTo(fl.bx, fl.by);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,45,135,' + (alpha * 0.95).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(fl.ax, fl.ay, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fl.bx, fl.by, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    rafId = window.requestAnimationFrame(step);
  }

  function start() {
    if (running || reduceMotion || !visible) return;
    running = true;
    rafId = window.requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  // A single static frame for reduced-motion users: the composition still
  // reads as a hive, it simply doesn't move.
  function drawStatic() {
    build();
    step(0);
    stop();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var wasRunning = running;
      stop();
      build();
      if (reduceMotion) step(0);
      else if (wasRunning) start();
    }, 180);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  // Stop burning frames once the hero is scrolled past.
  if (window.IntersectionObserver) {
    new window.IntersectionObserver(
      function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0 }
    ).observe(canvas);
  }

  if (reduceMotion) drawStatic();
  else {
    build();
    start();
  }
})();
