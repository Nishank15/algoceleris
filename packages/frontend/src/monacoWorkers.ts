// Monaco Editor WebWorker registration for Rsbuild / Rspack
// Enables language service background workers as separate compiled chunks

import type { Environment } from 'monaco-editor';

declare global {
  interface Window {
    MonacoEnvironment?: Environment;
  }
}

if (typeof window !== 'undefined') {
  window.MonacoEnvironment = {
    getWorker(_moduleId: unknown, label: string): Worker {
      if (label === 'json') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url),
          { type: 'module' }
        );
      }
      return new Worker(
        new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url),
        { type: 'module' }
      );
    },
  };
}

export {};
