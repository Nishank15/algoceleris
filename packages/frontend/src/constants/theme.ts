import type { editor } from 'monaco-editor';

export const LINEAR_MIDNIGHT_THEME_NAME = 'linear-midnight';

export const LINEAR_MIDNIGHT_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'e2e4e9', background: '0b0c0e' },
    { token: 'keyword', foreground: '7c87f8' },
    { token: 'keyword.control', foreground: '7c87f8' },
    { token: 'type', foreground: '56b6c2' },
    { token: 'type.identifier', foreground: '56b6c2' },
    { token: 'class', foreground: '56b6c2' },
    { token: 'string', foreground: '85e89d' },
    { token: 'string.escape', foreground: '85e89d' },
    { token: 'number', foreground: 'ffab70' },
    { token: 'comment', foreground: '54575f', fontStyle: 'italic' },
    { token: 'operator', foreground: '9499a6' },
    { token: 'delimiter', foreground: '9499a6' },
  ],
  colors: {
    'editor.background': '#0b0c0e',
    'editor.foreground': '#e2e4e9',
    'editorLineNumber.foreground': '#383b3f',
    'editorLineNumber.activeForeground': '#858992',
    'scrollbarSlider.background': '#23252a80',
    'scrollbarSlider.hoverBackground': '#383b3f',
    'scrollbarSlider.activeBackground': '#4a4d55',
    'editorGutter.background': '#0b0c0e',
    'editor.lineHighlightBackground': '#16171850',
    'editor.selectionBackground': '#23252a',
    'editorCursor.foreground': '#e4f222',
  },
};
