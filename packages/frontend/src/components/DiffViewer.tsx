import React from 'react';
import { AlertCircle } from 'lucide-react';

interface DiffViewerProps {
  expected: string;
  actual: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ expected, actual }) => {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const maxLines = Math.max(expectedLines.length, actualLines.length);

  return (
    <div className="diff-viewer-container">
      <div className="diff-header">
        <AlertCircle size={14} className="diff-icon" />
        <span>Output Diff Analysis</span>
      </div>

      <div className="diff-grid">
        {/* Expected Column */}
        <div className="diff-column">
          <div className="diff-column-header">Expected Output</div>
          <div className="diff-content">
            {Array.from({ length: maxLines }).map((_, i) => {
              const exp = expectedLines[i] ?? '';
              const act = actualLines[i] ?? '';
              const isDiff = exp !== act;
              return (
                <div
                  key={i}
                  className={`diff-line ${isDiff ? 'diff-line-expected' : ''}`}
                >
                  <span className="diff-line-num">{i + 1}</span>
                  <span className="diff-line-text">{exp || (i < expectedLines.length ? ' ' : '')}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actual Output Column */}
        <div className="diff-column">
          <div className="diff-column-header">Your Output (stdout)</div>
          <div className="diff-content">
            {Array.from({ length: maxLines }).map((_, i) => {
              const exp = expectedLines[i] ?? '';
              const act = actualLines[i] ?? '';
              const isDiff = exp !== act;
              return (
                <div
                  key={i}
                  className={`diff-line ${isDiff ? 'diff-line-actual' : ''}`}
                >
                  <span className="diff-line-num">{i + 1}</span>
                  <span className="diff-line-text">{act || (i < actualLines.length ? ' ' : '')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
