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
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.defineTheme(LINEAR_MIDNIGHT_THEME_NAME, LINEAR_MIDNIGHT_THEME);
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
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          lineHeight: 22,
          tabSize: 4,
          insertSpaces: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
          },
          padding: {
            top: 14,
            bottom: 14,
          },
        }}
      />
    </div>
  );
};
