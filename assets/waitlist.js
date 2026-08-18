/* ==========================================================================
   Waitlist form -> Supabase
   --------------------------------------------------------------------------
   The key below is Supabase's ANON (publishable) key. It is designed to be
   public — the same key already ships inside the mobile app binary, where
   anyone can extract it. Security comes from Row Level Security, not from
   hiding it: the `waitlist` table grants anon INSERT and nothing else, and
   has no SELECT policy at all, so this key cannot read the list back.
   Verified against production: an anon SELECT returns 401 permission denied.
   See supabase/migrations/0052_waitlist.sql in the app repo.

   Planned next step (needs a domain + email tooling first): route through a
   confirmation email so the flow becomes waitlist -> confirm -> subscribed.
   The table already carries a `confirmed_at` column for exactly that, so
   rows written today just start out unconfirmed.
   ========================================================================== */
(function () {
  var SUPABASE_URL = 'https://kdjtktmhleopuzaapdon.supabase.co';
  var SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkanRrdG1obGVvcHV6YWFwZG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NzgzNDUsImV4cCI6MjA5OTA1NDM0NX0.PM95OcR7MZHPDIcbPDhrIsCmM7PpqfbcmD-ktF5uoT4';

  var form = document.getElementById('wl-form');
  if (!form) return;

  var input = document.getElementById('wl-email');
  var button = document.getElementById('wl-submit');
  var msg = document.getElementById('wl-msg');

  var COPY = {
    pt: {
      invalid: 'Digite um e-mail válido.',
      sending: 'Enviando...',
      ok: 'Pronto! Você está na lista. A gente avisa quando o NightHive chegar na sua cidade.',
      dupe: 'Esse e-mail já está na lista. Até logo na pista!',
      error: 'Não rolou dessa vez. Tenta de novo em instantes.'
    },
    en: {
      invalid: 'Enter a valid email address.',
      sending: 'Sending...',
      ok: "You're on the list! We'll let you know the moment NightHive lands in your city.",
      dupe: "This email is already on the list. See you on the dance floor!",
      error: "That didn't go through. Please try again in a moment."
    }
  };

  function lang() {
    // documentElement.lang is set by lang.js and already resolves the
    // es/de/it -> en content fallback, so this always reads pt or en.
    return document.documentElement.lang === 'pt' ? 'pt' : 'en';
  }

  function say(kind, text) {
    msg.textContent = text;
    msg.className = 'wl-msg' + (kind ? ' ' + kind : '');
  }

  function setBusy(busy) {
    button.disabled = busy;
    input.disabled = busy;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = COPY[lang()];
    var email = (input.value || '').trim();

    // Mirrors the DB's own CHECK constraint so an obvious typo is caught
    // before a round trip; the database remains the real gate.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      say('err', t.invalid);
      input.focus();
      return;
    }

    // Campaign attribution: /waitlist.html?src=instagram lands in the row,
    // so paid and organic traffic can be told apart later.
    var src = new URLSearchParams(window.location.search).get('src');

    setBusy(true);
    say('', t.sending);

    fetch(SUPABASE_URL + '/rest/v1/waitlist', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
        // No `Prefer: return=representation` -- anon has INSERT but not
        // SELECT, so asking for the row back would fail the request.
      },
      body: JSON.stringify({
        email: email,
        locale: lang(),
        source: src ? src.slice(0, 60) : null
      })
    })
      .then(function (res) {
        if (res.status === 201 || res.status === 204) {
          form.reset();
          say('ok', t.ok);
          return;
        }
        // 409 = the unique index on lower(email) rejected a repeat. That's
        // a success from the visitor's point of view, not an error.
        if (res.status === 409) {
          form.reset();
          say('ok', t.dupe);
          return;
        }
        say('err', t.error);
      })
      .catch(function () {
        say('err', t.error);
      })
      .then(function () {
        setBusy(false);
      });
  });
})();
