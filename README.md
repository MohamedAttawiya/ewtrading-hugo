# E&W Trading Group — Hugo site

This repo now uses Hugo for all pages except `contact.html`, which is kept verbatim for the Zoho CRM integration and is served as `/contact.html`.

## Local development

```bash
hugo serve
```

Then visit:
- `/` home
- `/about/`
- `/alkyds/`
- `/partners/`
- `/contact.html` (static passthrough)

## Production build

```bash
hugo
```

Artifacts render to `public/` with:
- `public/contact.html` identical to the original
- `public/style.css`, `public/assets/`, `public/.well-known/`
- Section pages in their clean URLs (`/about/`, `/alkyds/`, `/partners/`)

## Netlify

- `netlify.toml` sets `command = "hugo"` and `publish = "public"`.
- `HUGO_VERSION` pinned to `0.121.2`.
- Functions remain at `netlify/functions/` (e.g., `send-contact.js`).
- Redirects in `static/_redirects` map legacy `.html` URLs to clean routes (except `/contact.html`, which is untouched).

## Notes

- Do **not** edit `static/contact.html`; it must remain byte-for-byte identical.
- All static assets live under `static/` to preserve public URLs.
