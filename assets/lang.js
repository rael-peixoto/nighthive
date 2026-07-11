// Language detection/switching shared by every page on this site.
//
// Mirrors the mobile app's i18n fallback chain: current language -> English
// -> (nothing further needed, English content always exists). The app deep
// links here with ?lang=<locale> set to whatever the user picked in
// Settings > Idioma, so a Portuguese-set user lands on the Portuguese
// version automatically; direct visits (search engines, App Store links,
// shared URLs) fall back to the browser's language, then Portuguese.
(function () {
  var SUPPORTED = ['pt', 'en', 'es', 'de', 'it'];
  var STORAGE_KEY = 'nighthive:lang';

  // Only pt/en are actually written today -- es/de/it show the English
  // content with a small notice, same as the app does for those locales.
  var CONTENT_LANG = { pt: 'pt', en: 'en', es: 'en', de: 'en', it: 'en' };

  var FALLBACK_NOTE = {
    en: 'This page isn’t translated into your language yet, so we’re showing it in English.',
    pt: 'Esta página ainda não foi traduzida para o seu idioma, então estamos mostrando em inglês.',
  };

  function detectLang() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = params.get('lang');
    if (fromUrl && SUPPORTED.indexOf(fromUrl) !== -1) return fromUrl;

    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) {
      /* localStorage unavailable (private browsing etc.) -- fine, just skip */
    }

    var nav = ((navigator.language || navigator.userLanguage || 'pt') + '').slice(0, 2).toLowerCase();
    if (SUPPORTED.indexOf(nav) !== -1) return nav;

    return 'pt';
  }

  function applyLang(lang) {
    var contentLang = CONTENT_LANG[lang] || 'en';

    document.querySelectorAll('[data-lang]').forEach(function (el) {
      el.hidden = el.getAttribute('data-lang') !== contentLang;
    });

    document.querySelectorAll('[data-lang-switch]').forEach(function (el) {
      var isActive = el.getAttribute('data-lang-switch') === lang;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    var note = document.getElementById('lang-fallback-note');
    if (note) {
      var showNote = contentLang !== lang;
      note.hidden = !showNote;
      if (showNote) note.textContent = FALLBACK_NOTE[contentLang] || FALLBACK_NOTE.en;
    }

    document.documentElement.lang = contentLang;

    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* ignore */
    }
  }

  function setLang(lang) {
    applyLang(lang);
    var url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url);
  }

  window.nighthiveSetLang = setLang;

  document.addEventListener('DOMContentLoaded', function () {
    applyLang(detectLang());
    document.querySelectorAll('[data-lang-switch]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        setLang(el.getAttribute('data-lang-switch'));
      });
    });
  });
})();
