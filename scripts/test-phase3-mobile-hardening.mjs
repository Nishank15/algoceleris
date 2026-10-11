import fs from 'fs';
import path from 'path';
import assert from 'assert';

const rootDir = process.cwd();
const workspacePagePath = path.join(rootDir, 'packages/frontend/src/pages/ProblemWorkspacePage.tsx');
const resizableLayoutPath = path.join(rootDir, 'packages/frontend/src/components/ResizableLayout.tsx');
const navPath = path.join(rootDir, 'packages/frontend/src/components/LinearHeaderNav.tsx');
const editorPath = path.join(rootDir, 'packages/frontend/src/components/CodeEditor.tsx');
const cssPath = path.join(rootDir, 'packages/frontend/src/index.css');

console.log('--- Running Phase 3 Mobile Hardening & Polish Test Suite ---');

const workspaceContent = fs.readFileSync(workspacePagePath, 'utf8');
const layoutContent = fs.readFileSync(resizableLayoutPath, 'utf8');
const navContent = fs.readFileSync(navPath, 'utf8');
const editorContent = fs.readFileSync(editorPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// 1. Responsive Workspace Tab Switcher
const hasTabControl =
  (workspaceContent.includes('mobile-workspace-tabs') || layoutContent.includes('mobile-workspace-tabs')) &&
  (workspaceContent.includes('Problem') || layoutContent.includes('Problem')) &&
  (workspaceContent.includes('Code Editor') || layoutContent.includes('Code Editor'));

assert(
  hasTabControl,
  'FAIL: Workspace must include mobile-workspace-tabs with Problem and Code Editor segmented controls'
);

const hasMobileToolbar =
  workspaceContent.includes('mobile-workspace-toolbar') || layoutContent.includes('mobile-workspace-toolbar');

assert(
  hasMobileToolbar,
  'FAIL: Workspace must include pinned mobile-workspace-toolbar for Run/Submit actions'
);

// 2. Mobile Navigation Drawer / Sheet
const hasMobileNav =
  navContent.includes('mobile-nav-toggle') &&
  (navContent.includes('mobile-nav-sheet') || navContent.includes('mobile-nav-drawer'));

assert(
  hasMobileNav,
  'FAIL: LinearHeaderNav.tsx must declare mobile-nav-toggle and mobile-nav-sheet drawer'
);

assert(
  cssContent.includes('overflow-x: hidden') && cssContent.includes('.mobile-nav-sheet'),
  'FAIL: index.css must prevent horizontal overflow and define .mobile-nav-sheet styles'
);

// 3. Monaco Mobile Touch Configuration
assert(
  editorContent.includes('minimap') && editorContent.includes('enabled: false') && editorContent.includes('automaticLayout: true'),
  'FAIL: CodeEditor.tsx must configure minimap enabled: false and automaticLayout: true'
);

// 4. Theme Transition Smoothing
assert(
  cssContent.includes('transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease'),
  'FAIL: index.css must declare transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease on surfaces/panes'
);

console.log('--- ALL PHASE 3 MOBILE HARDENING TESTS PASSED ---');
