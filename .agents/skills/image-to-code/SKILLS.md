---
name: image-to-code
description: "Deconstructs UI screenshots, wireframes, or mockup images and converts them into production-ready frontend components matching exact design tokens."
---

# Image-to-Code Engineering Protocol

## Objective
Convert visual image assets, UI screenshots, or design mockups into high-fidelity code components without visual drift, generic defaults, or hallucinated spacing.

## Execution Workflow

### Step 1: Visual Deconstruction (Do Not Write Code Yet)
Before writing any component code, analyze the input image and output a structured visual breakdown:
1. **Layout & Grid Structure**: Identify flexbox/grid alignments, column counts, whitespace distribution, and page hierarchy.
2. **Color Palette & Theme Tokens**: Identify surface/background colors, borders, text contrasts, badge accents, and active shadows.
3. **Typography**: Identify font weights (e.g., medium vs. semibold), letter-spacing (tracking), line heights, and heading-to-body scale.
4. **Component Primitives**: Enumerate cards, inputs, buttons, icons, avatars, and badge states.

### Step 2: Design Token & Library Mapping
- Map extracted colors, radii, and spacing directly to existing design tokens in `theme.css` / `tokens.json` (or standard Tailwind utility classes).
- If Lucide / Radix / Heroicons are present, identify the nearest matching icon names.
- Ensure nested border radii follow optical rules (inner element radius $\le$ outer container radius).

### Step 3: High-Fidelity Implementation
- Implement the component in clean TypeScript / React with modular sub-components.
- Add responsive layout classes (mobile, tablet, desktop).
- Add micro-interactions (hover states, focus rings, transition timing) consistent with modern web design standards.

### Step 4: Visual Self-Audit Checklist
Before declaring completion, verify:
- [ ] Are paddings and margins faithful to the original image?
- [ ] Did you avoid generic boilerplate (e.g., harsh drop shadows, default purple gradients)?
- [ ] Are numbers and metrics rendered with tabular numbers (`tabular-nums`)?