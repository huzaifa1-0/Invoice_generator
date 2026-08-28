# Invoice Generator

A standalone invoice generator restyled to match your practice management system's
design language (Inter/Manrope type, the same blue accent, card layout, spacing and
radii used in the PMS billing screens).

## Run it

No build step, no server required.

1. Unzip this folder.
2. Double-click `index.html` to open it in your browser.

   (Optional, if your browser blocks local file uploads for the logo: run a tiny local
   server instead — `npx serve .` or `python3 -m http.server` — then open the printed
   `http://localhost:...` URL.)

## What's included

- **Live preview** — the invoice on the right updates as you type, so you see exactly
  what the PDF will look like before you export it.
- **Auto-saving draft** — your in-progress invoice is saved to the browser's local
  storage as you work, so a refresh won't lose your data. Use the reset icon (top right)
  to start a clean invoice.
- **Logo upload, multi-currency, discounts (% or flat), VAT/tax, notes & terms,
  itemized line items** — all carried over from the original generator.
- **Export** — Download as PDF, open a print preview PDF, or use your browser's native
  Print (styled for print via `@media print`).

## Files

- `index.html` — page structure
- `styles.css` — design system (colors, spacing, and radii mirror the PMS's
  `constants/colors.js` and `constants/styles.js` tokens)
- `scripts.js` — all form logic, live preview rendering, autosave, and PDF export
  (via pdfmake, loaded from a CDN)

## Notes

- Everything runs client-side. No data is sent anywhere — the "autosave" is your
  own browser's local storage only.
- Uses Font Awesome, Google Fonts (Inter/Manrope), and pdfmake from public CDNs, so
  an internet connection is needed the first time you open it.
