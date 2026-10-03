import React, { useState } from 'react';
import { AlertCircle, Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  expected: string;
  actual: string;
}

/**
 * Splits a line into word / whitespace tokens and marks the tokens that differ
 * from the same position in the counterpart line.
 */
function diffTokens(line: string, other: string): { text: string; diff: boolean }[] {
  const tokens = line.match(/\s+|\S+/g) ?? [];
  const otherTokens = other.match(/\s+|\S+/g) ?? [];
  return tokens.map((text, i) => ({ text, diff: text !== otherTokens[i] }));
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ expected, actual }) => {
  const [copied, setCopied] = useState<'expected' | 'actual' | null>(null);

  const expectedLines = expected.replace(/\r\n/g, '\n').split('\n');
  const actualLines = actual.replace(/\r\n/g, '\n').split('\n');
  const maxLines = Math.max(expectedLines.length, actualLines.length);

  let differingLines = 0;
  for (let i = 0; i < maxLines; i++) {
    if ((expectedLines[i] ?? '') !== (actualLines[i] ?? '')) differingLines++;
  }

  const handleCopy = async (kind: 'expected' | 'actual') => {
    try {
      await navigator.clipboard.writeText(kind === 'expected' ? expected : actual);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const renderColumn = (
    lines: string[],
    counterpart: string[],
    kind: 'expected' | 'actual'
  ) =>
    Array.from({ length: maxLines }).map((_, i) => {
      const line = lines[i];
      const other = counterpart[i] ?? '';
      const present = i < lines.length;
      const isDiff = (line ?? '') !== other;
      return (
        <div
          key={i}
          className={`diff-line ${isDiff ? `diff-line-${kind}` : ''}`}
        >
          <span className="diff-line-num">{present ? i + 1 : ''}</span>
          <span className="diff-line-text">
            {present && line !== ''
              ? diffTokens(line, other).map((tok, j) =>
                  tok.diff && tok.text.trim() !== '' ? (
                    <span key={j} className="diff-token-mismatch">
                      {tok.text}
                    </span>
                  ) : (
                    <span key={j}>{tok.text}</span>
                  )
                )
              : ' '}
          </span>
        </div>
      );
    });

  return (
    <div className="diff-viewer-container">
      <div className="diff-header">
        <AlertCircle size={14} className="diff-icon" />
        <span>Output Diff Analysis</span>
        <span className="diff-summary-badge">
          {differingLines === 0
            ? 'Whitespace-only difference'
            : `Diff detected (${differingLines} ${differingLines === 1 ? 'line differs' : 'lines differ'})`}
        </span>
      </div>

      <div className="diff-grid">
        <div className="diff-column">
          <div className="diff-column-header">
            <span>Expected Output</span>
            <button
              type="button"
              className="diff-copy-btn"
              onClick={() => handleCopy('expected')}
              aria-label="Copy expected output"
            >
              {copied === 'expected' ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div className="diff-content">
            {renderColumn(expectedLines, actualLines, 'expected')}
          </div>
        </div>

        <div className="diff-column">
          <div className="diff-column-header">
            <span>Your Output (stdout)</span>
            <button
              type="button"
              className="diff-copy-btn"
              onClick={() => handleCopy('actual')}
              aria-label="Copy your output"
            >
              {copied === 'actual' ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div className="diff-content">
            {renderColumn(actualLines, expectedLines, 'actual')}
          </div>
        </div>
      </div>
    </div>
  );
};
