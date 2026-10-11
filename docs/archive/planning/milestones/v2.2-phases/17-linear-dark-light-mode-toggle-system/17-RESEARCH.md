# Phase 17 Research: Linear Dark / Light Mode Toggle System

## Executive Summary

Phase 17 delivers the complete theme switching system for Cloud-Judge V2, fulfilling requirements `THEME-01` through `THEME-04`:
1. **Full CSS Token Inversion System (`THEME-01`)**: Seamless token mapping between Linear Midnight Dark (`#08090a` Void, `#0f1011` Carbon, `#161718` Obsidian, `#e4f222` Lime) and Linear Light (`#f7f8f9` Canvas, `#ffffff` Surface, `#f0f2f5` Elevated, `#5e6ad2` Electric Indigo / `#111827` Graphite).
2. **Sleek Navigation Theme Toggle (`THEME-02`)**: Integrated interactive theme toggle button in `LinearHeaderNav` with instant transitions, smooth icon rotation (`Sun` / `Moon`), and accessibility support.
3. **Monaco Editor Theme Synchronization (`THEME-03`)**: Dynamic editor theme switching synchronizing between `linear-midnight` in dark mode and `vs` (VS Code Light Modern) in light mode, preserving typography and layout.
4. **Persistent Preference with System Fallback (`THEME-04`)**: Reactive state persisted in `localStorage.cloud_judge_theme` with instant fallback to OS `prefers-color-scheme`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **THEME-01** | Full CSS token inversion system (Void/Carbon/Obsidian dark mode vs. Linear Light/subtle card/dark graphite light mode). | Invert surfaces, borders, typography, status badges, and custom scrollbars under `:root[data-theme='light']`. Eliminate hardcoded dark hex values in component stylesheets. |
| **THEME-02** | Sleek theme toggle button integrated in main `LinearHeaderNav`. | Add toggle button in `LinearHeaderNav.tsx` displaying `Sun` / `Moon` icons, styled with hover states, tooltips, and micro-interactions. |
| **THEME-03** | Monaco editor theme synchronization toggling between `linear-midnight` and `vs` (VS Code Light Modern). | In `CodeEditor.tsx`, read theme from `ThemeContext` and update Monaco theme definition dynamically without re-mounting the editor or losing code state. |
| **THEME-04** | Theme preference persisted in `localStorage` with fallback to system `prefers-color-scheme`. | Create `ThemeContext.tsx` and `useTheme()` hook reading from `localStorage.getItem('cloud_judge_theme')` with `matchMedia('(prefers-color-scheme: light)')` fallback. |
</phase_requirements>

---

## Architecture & Technical Design

### 1. Token Inversion System (`THEME-01`)

In `packages/frontend/src/index.css`:
The baseline `:root` contains dark mode tokens. Under `:root[data-theme='light']` (or `html[data-theme='light']`), we provide comprehensive inverted tokens:

```css
:root[data-theme='light'] {
  /* Surfaces — Linear Light */
  --bg-canvas: #f7f8f9;            /* Crisp off-white */
  --bg-surface: #ffffff;           /* Clean white card */
  --bg-surface-elevated: #f0f2f5;  /* Subtle elevated panel */
  --bg-surface-overlay: #ffffff;

  /* Borders & Dividers */
  --border-subtle: #e2e4e8;        /* Hairline border */
  --border-active: #c5c9d1;
  --border-divider: #e5e7eb;

  /* Accents */
  --accent-primary: #5e6ad2;       /* Linear electric indigo */
  --accent-primary-fg: #ffffff;
  --accent-hover: #4e5ac0;
  --accent-secondary: #edf0f7;
  --accent-gradient: #111827;

  /* Verdict & Status */
  --color-accepted: #15803d;       /* Forest green */
  --color-accepted-bg: rgba(21, 128, 61, 0.10);
  --color-wrong-answer: #dc2626;   /* Crimson */
  --color-wrong-answer-bg: rgba(220, 38, 38, 0.10);
  --color-timeout: #d97706;        /* Warm amber */
  --color-timeout-bg: rgba(217, 119, 6, 0.10);
  --color-running: #4b5563;
  --color-running-bg: rgba(75, 85, 99, 0.10);

  /* Typography */
  --text-primary: #111827;         /* Deep graphite */
  --text-secondary: #4b5563;       /* Slate neutral */
  --text-muted: #8b929e;           /* Hairline caption */
}
```

#### Component Hex Sanitization:
Several components currently use hardcoded dark hex codes (`#0f1011`, `#08090a`, `#161718`, `#23252a`, `#f7f8f8`). These will be normalized to CSS custom variables:
- `.profile-hero-card`, `.profile-card`, `.contest-card`, `.fp-board-wrap`: `background: var(--bg-surface); border: 1px solid var(--border-subtle);`
- `.rating-dot`: `fill: var(--bg-surface);`
- `.contest-btn`: `background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); color: var(--text-primary);`
- `IsometricHeatmap`: already detects `document.documentElement`'s `data-theme` and rethemes canvas dynamically.

### 2. Theme Context & Storage (`THEME-04`)

Create `packages/frontend/src/context/ThemeContext.tsx`:
```typescript
export type Theme = 'dark' | 'light';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}
```

Resolution logic:
1. `localStorage.getItem('cloud_judge_theme')`:
   - If `'dark'` or `'light'`, apply directly.
2. If absent:
   - Query `window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'`.
3. Side effects on theme state change:
   - `document.documentElement.setAttribute('data-theme', theme);`
   - `localStorage.setItem('cloud_judge_theme', theme);`
4. Media query listener:
   - Listen for OS dark/light mode changes when no manual override exists in `localStorage`.

### 3. Theme Toggle Button (`THEME-02`)

In `packages/frontend/src/components/LinearHeaderNav.tsx`:
- Render button with id `nav-theme-toggle`:
  - When `theme === 'dark'`, render `<Sun size={14} />` with tooltip "Switch to light mode".
  - When `theme === 'light'`, render `<Moon size={14} />` with tooltip "Switch to dark mode".
  - Sleek icon transition with CSS micro-animation.

### 4. Monaco Editor Synchronization (`THEME-03`)

In `packages/frontend/src/components/CodeEditor.tsx`:
- Access `const { theme } = useTheme();`
- When `theme === 'light'`, pass `theme="vs"` to `<Editor />` and call `monaco.editor.setTheme('vs')`.
- When `theme === 'dark'`, pass `theme={LINEAR_MIDNIGHT_THEME_NAME}` and call `monaco.editor.setTheme(LINEAR_MIDNIGHT_THEME_NAME)`.
- Updates occur instantly without reloading Monaco or resetting cursor position or editor undo/redo history.

---

## Verification Strategy

1. **Unit & Build Validation**:
   - `npm --prefix packages/frontend run build` must compile with 0 TypeScript/Vite errors.
2. **Persistence & Fallback Testing**:
   - Toggling theme updates `document.documentElement.getAttribute('data-theme')` and `localStorage.getItem('cloud_judge_theme')`.
   - Reloading preserves selected theme.
3. **Editor Theme Synchronization**:
   - Verify code editor transitions between dark and light themes smoothly on all problem pages.
4. **Visual & Contrast Regression**:
   - Verify all main views: LandingPage, ProblemsPage, ProblemWorkspacePage, ProfilePage, ContestsPage, and Modals in both light and dark modes.
