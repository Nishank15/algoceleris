import React, { useCallback } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { Language } from '../types';
import { LINEAR_MIDNIGHT_THEME, LINEAR_MIDNIGHT_THEME_NAME } from '../constants/theme';

interface CodeEditorProps {
  language: Language;
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  contestMode?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  value,
  onChange,
  readOnly = false,
  contestMode = false,
}) => {
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    monaco.editor.defineTheme(LINEAR_MIDNIGHT_THEME_NAME, LINEAR_MIDNIGHT_THEME);
    monaco.editor.defineTheme('vscode-dark-modern', LINEAR_MIDNIGHT_THEME);
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.defineTheme(LINEAR_MIDNIGHT_THEME_NAME, LINEAR_MIDNIGHT_THEME);
    monaco.editor.defineTheme('vscode-dark-modern', LINEAR_MIDNIGHT_THEME);
    monaco.editor.setTheme(LINEAR_MIDNIGHT_THEME_NAME);
    editor.focus();

    if (contestMode) {
      const domNode = editor.getDomNode();
      if (domNode) {
        domNode.addEventListener('paste', (e) => e.preventDefault(), true);
        domNode.addEventListener('copy', (e) => e.preventDefault(), true);
        domNode.addEventListener('cut', (e) => e.preventDefault(), true);
        domNode.addEventListener('contextmenu', (e) => e.preventDefault(), true);
      }
    }
  }, [contestMode]);

  // Map internal language identifiers to Monaco language IDs
  const monacoLanguage = language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : 'java';

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <Editor
        height="100%"
        width="100%"
        language={monacoLanguage}
        theme={LINEAR_MIDNIGHT_THEME_NAME}
        value={value}
        onChange={(val) => onChange(val || '')}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          readOnly,
          contextmenu: !contestMode,
          fontFamily:
            "'JetBrains Mono', 'SF Mono', Menlo, Monaco, 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontSize: 13.5,
          lineHeight: 22,
          fontLigatures: true,
          letterSpacing: 0.2,
          renderLineHighlight: 'line',
          renderLineHighlightOnlyWhenFocus: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          cursorWidth: 2,
          cursorStyle: 'line',
          roundedSelection: true,
          selectOnLineNumbers: true,
          matchBrackets: 'always',
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          smoothScrolling: true,
          tabSize: 4,
          insertSpaces: true,
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          bracketPairColorization: { enabled: true },
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
          },
          padding: {
            top: 12,
            bottom: 12,
          },
        }}
      />
    </div>
  );
};
