# NightHive — Public Site

Public, static info site for the NightHive app: About, FAQ & Support,
Feedback & Suggestions, Terms of Use, and Privacy Policy. No build step —
plain HTML/CSS/JS, meant to be served as-is (e.g. GitHub Pages).

This repo is intentionally separate from the app's private repo. It's the
only NightHive repo the public and app-store reviewers see, so it stays
scoped to landing/legal/support content — no app source lives here.

## Structure

```
index.html      # hub linking to the pages below
about.html
faq.html
feedback.html
terms.html
privacy.html
assets/
  style.css
  lang.js       # language detection/switching (see below)
  img/
```

## Language handling

Every page renders content for multiple languages inline (`[data-lang="pt"]`,
`[data-lang="en"]`, ...) and `assets/lang.js` shows the right one based on,
in order: a `?lang=` query param, a remembered choice (localStorage), then
the browser's language, falling back to Portuguese.

The app deep-links here with `?lang=<locale>` set to whatever the user
picked in Settings > Idioma, so opening a legal page from the app lands in
the same language automatically. Only Portuguese and English are written
today; Spanish, German, and Italian fall back to English (with a small
on-page note), matching the app's own i18n fallback behavior.

## Deploying

Enable GitHub Pages for this repo (Settings > Pages > deploy from `main`,
root). Once live, update `PUBLIC_SITE` in the app's `mobile/src/lib/links.ts`
to point at the Pages URL.
