# NightHive — Public Site

Public, static site for the NightHive app: marketing landing page, waitlist,
About, FAQ & Support, Feedback & Suggestions, Terms of Use, and Privacy
Policy. No build step — plain HTML/CSS/JS, meant to be served as-is (e.g.
GitHub Pages).

This repo is intentionally separate from the app's private repo. It's the
only NightHive repo the public and app-store reviewers see, so it stays
scoped to landing/legal/support content — no app source lives here.

## Structure

```
index.html      # marketing landing page (was a plain link hub before)
waitlist.html   # email capture, used as the campaign redirect target
about.html
faq.html
feedback.html
terms.html
privacy.html
assets/
  style.css     # the legal/support pages (narrow document layout)
  landing.css   # index.html + waitlist.html (full-bleed, standalone)
  lang.js       # language detection/switching, every page (see below)
  site.js       # landing chrome: scroll-reveal + nav state
  hive.js       # hero canvas animation
  waitlist.js   # waitlist form -> Supabase
  fonts/        # self-hosted Unbounded (SIL OFL 1.1, see OFL.txt)
  img/
```

## Do not move these two files

Both are referenced from outside this repo and will break silently if
renamed:

- `privacy.html` — set as the Privacy Policy URL in App Store Connect
- `faq.html` — set as the app's Support URL in App Store Connect

The App Store **Marketing URL** points at `/`, i.e. `index.html`, which is
why the landing page lives there. The mobile app deep-links to `about.html`,
`faq.html`, `feedback.html`, `terms.html` and `privacy.html` directly (see
`mobile/src/lib/links.ts` in the app repo) — never to `/`.

## Landing page

`index.html` explains the product and the business: the problem, the
three-step mechanic (pick a party → check in → match with people who are
going), how it differs from a generic dating app, what's in the app, the
free vs NightHive+ split, and a block for promoters/venues.

The hero canvas (`hive.js`) draws the product's own rule rather than generic
particles: glowing nodes are parties, drifting points are people, and a
magenta line flares only when two people at the **same** party meet. It
pauses when scrolled out of view or the tab is hidden, and renders a single
static frame under `prefers-reduced-motion`.

No stock photography is used anywhere, which is deliberate — it keeps the
page honest about a product that hasn't launched, and avoids the
objectifying imagery that nightlife marketing tends to default to.

## Waitlist

`waitlist.html` posts straight to a `waitlist` table in the app's Supabase
project using the public **anon** key. That key is designed to be public (it
already ships inside the mobile app binary); safety comes from Row Level
Security, not secrecy. The table grants anon `INSERT` only and has **no**
select policy, so the key cannot read the list back — verified against
production, where an anon `SELECT` returns 401. Schema lives in the app repo
at `supabase/migrations/0052_waitlist.sql`.

`?src=` is captured into the row for campaign attribution, e.g.
`waitlist.html?src=instagram`.

**Planned:** a confirmation email before an address counts as subscribed, so
the flow becomes waitlist → confirm → subscribed. The table already carries
a `confirmed_at` column for exactly that, so today's rows simply start out
unconfirmed and no migration is needed later. Adding a CAPTCHA in front of
the form is the other outstanding item — until then the unique index stops
duplicates, but nothing stops a script inserting junk addresses.

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
