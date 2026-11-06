# Lead on Level · System & Soul

An interactive version of the Lead on Level leadership assessment, with System & Soul branding and an instant results report.

- **Main assessment:** `index.html`. It finds the person's level (1–4), then they rate the competencies and breakdowns for that level.
- **CEO edition:** `ceo.html`. Goes straight to Level 7.
- **Results:** shown on screen as soon as someone finishes, with a *Save as PDF* button. If they come back on the same device, they see their results again.

No build step. It's plain HTML, CSS and JavaScript, hosted on GitHub Pages.

## Linking from the Leader Accelerator

- Assessment: `https://mreevesdecker.github.io/lead-on-level/`
- CEO edition: `https://mreevesdecker.github.io/lead-on-level/ceo.html`

Pages are marked `noindex`, so search engines won't list them.

## Saving responses to a Google Sheet (optional)

Without this step people still get their results, but you won't have a copy.

1. Create a Google Sheet (for example, "Lead on Level – Responses").
2. Go to **Extensions → Apps Script**, delete the starter code, and paste in everything from `apps-script/Code.gs`. Save.
3. Click **Deploy → New deployment**, choose **Web app**, and set *Execute as: Me* and *Who has access: Anyone*. Click **Deploy** and approve the permissions.
4. Copy the **Web app URL** and paste it into `assets/config.js` as `ENDPOINT`. Commit and push.

The Sheet fills two tabs: **Responses** has one row per person, updated as they go. **Items** has one row per statement they rated.

## Editing the content

The assessment text is in `assets/content.js`. Levels 5 and 6 aren't included yet. To add them, add `"5"` and `"6"` entries in the same shape as the others. Then update `GENERAL_LEVELS`, the `scope` question and `CEO_BELOW_LEVEL` in `assets/app.js`.

© Exceptional Leaders, LLC, John Ott, System & Soul, LLC
