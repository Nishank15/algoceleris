---
phase: 08
plan: "01"
requirements-completed: [DS-01, DS-02]
---
# 08-01 Summary — Refero Linear Midnight tokens

- `index.css` `:root` rewritten: Void #08090a, Carbon #0f1011, Obsidian #161718, Graphite #23252a, Smoke #383b3f, Acid Lime #e4f222, Pulse Green/Amber/Coral verdicts.
- Acid Lime now only drives `.btn-primary` (Header Submit); modal CTAs moved to `btn-secondary`.
- All font weights capped at 590; global `-0.022em` tracking; glows/gradients/indigo tints removed.
- Monaco theme (`constants/theme.ts`) de-purpled; new `src/theme.ts` mirrors tokens + difficulty colours.
- Verified: zero purple/indigo matches; `npm run build` passes.
