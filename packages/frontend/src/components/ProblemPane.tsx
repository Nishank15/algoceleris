import React, { useState } from 'react';
import { Copy, Check, Clock, Cpu, Tag } from 'lucide-react';
import { Problem } from '../types';

interface ProblemPaneProps {
  problem: Problem;
}

export const ProblemPane: React.FC<ProblemPaneProps> = ({ problem }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const getDifficultyBadgeClass = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return 'diff-easy';
      case 'Medium':
        return 'diff-medium';
      case 'Hard':
        return 'diff-hard';
      default:
        return 'diff-easy';
    }
  };

  return (
    <div className="problem-pane-container">
      {/* Problem Header */}
      <div className="problem-header">
        <h1 className="problem-title">{problem.title}</h1>
        <div className="problem-meta-row">
          <span className={`difficulty-badge ${getDifficultyBadgeClass(problem.difficulty)}`}>
            {problem.difficulty}
          </span>
          <span className="meta-item">
            <Clock size={13} />
            {problem.timeLimitMs}ms
          </span>
          <span className="meta-item">
            <Cpu size={13} />
            {Math.round(problem.memoryLimitBytes / (1024 * 1024))}MB
          </span>
        </div>
      </div>

      {/* Problem Description */}
      <div className="problem-content">
        <div className="problem-description">
          {problem.description.split('\n\n').map((paragraph, i) => (
            <p key={i}>
              {paragraph.split('`').map((part, j) =>
                j % 2 === 1 ? (
                  <code key={j} className="inline-code">
                    {part}
                  </code>
                ) : (
                  part
                )
              )}
            </p>
          ))}
        </div>

        {/* Constraints */}
        <div className="section-block">
          <h3 className="section-title">
            <Tag size={14} /> Constraints
          </h3>
          <ul className="constraints-list">
            {problem.constraints.map((c, i) => (
              <li key={i}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>

        {/* Sample Test Cases */}
        <div className="section-block">
          <h3 className="section-title">Sample Cases</h3>
          <div className="samples-container">
            {problem.sampleCases.map((sample, idx) => (
              <div key={sample.id} className="sample-card">
                <div className="sample-card-header">
                  <span className="sample-case-label">Example {idx + 1}</span>
                  <button
                    className="btn-copy"
                    onClick={() =>
                      handleCopy(`Input:\n${sample.input_data}\n\nOutput:\n${sample.expected_output}`, idx)
                    }
                    title="Copy Example"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check size={12} color="#27a644" />
                        <span style={{ color: '#27a644' }}>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="sample-block">
                  <div className="sample-sublabel">Input</div>
                  <pre className="code-block">{sample.input_data}</pre>
                </div>

                <div className="sample-block">
                  <div className="sample-sublabel">Expected Output</div>
                  <pre className="code-block">{sample.expected_output}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
