# Local Cookie Sync

Chrome extension that copies your sign-in cookies from a deployed site (production, staging, QA)
onto your local dev server, so you can run an app locally against real backends without logging in
again. It replaces the "`copy(document.cookie)` in DevTools, then paste `document.cookie = ...` into
the local tab" routine.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Pin **Local Cookie Sync** to the toolbar.

## Use

1. Sign in on the deployed site and open the extension from that tab. The source is filled in from
   the current tab.
2. Set the target, e.g. `http://localhost:5173`. Each source remembers the target you last used.
3. Click **Copy to target**. The first time for a site, Chrome asks you to allow access. Cookies are
   then written to the target and an open target tab is reloaded.

**Copy as script** puts `document.cookie = "..."` lines on your clipboard instead, to paste into a
DevTools console.

## How it works

- Uses `chrome.cookies`, so HttpOnly cookies are copied too. They're written to the target as
  JS-readable cookies on `/`, so apps that read auth cookies with `document.cookie` see them.
- Only `localhost` and `127.0.0.1` are allowed at install. Any other site is requested at runtime
  (optional host permissions) the first time you use it. Access covers the whole site (e.g.
  `*.example.com`) because auth cookies are often set on the parent domain. You can revoke access per
  site from the extension's details page in `chrome://extensions`.