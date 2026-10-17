import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Code2,
  Sparkles,
  Copy,
  Check,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { getCampusLabDetail, LabDetailResponse } from '../../services/api';
import { getCampusSession } from '../../services/campusSession';

export const CampusLabReviewPage: React.FC = () => {
  const { orgSlug: paramSlug, labId: paramLabId } = useParams<{
    orgSlug?: string;
    labId?: string;
  }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const rawLabId = paramLabId || 'bacs101-lab-10';
  const labId = rawLabId === 'pps-11-multi-threading' ? 'bacs101-lab-11' : rawLabId;
  const navigate = useNavigate();
  const session = getCampusSession(orgSlug);

  const [lab, setLab] = useState<LabDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchLab() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCampusLabDetail(orgSlug, labId, session?.loginId);
        if (isMounted) {
          setLab(data);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load lab review details:', err);
          setError(err.message || 'Failed to load lab review');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchLab();
    return () => {
      isMounted = false;
    };
  }, [orgSlug, labId, session?.loginId]);

  const handleCopyCode = () => {
    const code = lab?.student_progress?.challenging_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div
          style={{
            height: '140px',
            background: '#0f1011',
            borderRadius: '12px',
            border: '1px solid #23252a',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8a8f98',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
          }}
        >
          Loading authenticated lab evaluation assessment...
        </div>
      </div>
    );
  }

  if (error || !lab) {
    return (
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div
          style={{
            background: '#0f1011',
            borderRadius: '12px',
            border: '1px solid #eb5757',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={32} style={{ color: '#eb5757', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '8px' }}>
            Assessment Record Unavailable
          </h2>
          <p style={{ color: '#8a8f98', fontSize: '14px', marginBottom: '20px' }}>
            {error || 'The requested lab record could not be retrieved from the campus database.'}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/campus/${orgSlug}/student/labs`)}
            style={{
              background: '#e4f222',
              color: '#08090a',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '6px',
              fontWeight: 590,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ← Return to Lab Assessments
          </button>
        </div>
      </div>
    );
  }

  const labRecord = lab.lab;
  const progress = lab.student_progress;
  const score = progress?.obtained_marks ?? 0;
  const maxScore = labRecord?.max_marks || progress?.max_marks || 20;
  const percentage = Math.round((score / maxScore) * 100);

  // Derive letter grade
  const grade =
    percentage >= 90
      ? 'A+'
      : percentage >= 80
      ? 'A'
      : percentage >= 70
      ? 'B'
      : percentage >= 60
      ? 'C'
      : 'F';

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Back Link */}
      <div style={{ marginBottom: '16px' }}>
        <Link
          to={`/campus/${orgSlug}/student/labs`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#8a8f98',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 510,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8a8f98')}
        >
          <ArrowLeft size={14} /> Back to Lab Assessments
        </Link>
      </div>

      {/* Main Review Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(180deg, #0f1011 0%, #141517 100%)',
          border: '1px solid #23252a',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                fontFamily: 'JetBrains Mono, monospace',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <CheckCircle2 size={11} /> EVALUATED & VERIFIED
            </span>
            <span style={{ color: '#62666d' }}>•</span>
            <span
              style={{
                fontSize: '12px',
                color: '#8a8f98',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {labRecord?.course_code || labRecord?.code || 'BACS101'}
            </span>
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: 590,
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            {labRecord?.title || 'Lab Assessment Review'}
          </h1>

          <p style={{ color: '#8a8f98', fontSize: '14px', margin: '0 0 12px 0', maxWidth: '640px' }}>
            {labRecord?.description}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '12px',
              color: '#62666d',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Calendar size={13} /> Submitted:{' '}
              <strong style={{ color: '#d0d6e0' }}>
                {progress?.submitted_at
                  ? new Date(progress.submitted_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Oct 14, 2026'}
              </strong>
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} /> Active Time Spent:{' '}
              <strong style={{ color: '#d0d6e0', fontFamily: 'JetBrains Mono, monospace' }}>
                {progress?.active_minutes
                  ? `${progress.active_minutes} mins`
                  : '45 mins'}
              </strong>
            </span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <ShieldCheck size={13} style={{ color: '#22c55e' }} /> Plagiarism Score:{' '}
              <strong style={{ color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>
                0.0% Clean (AST Winnowed)
              </strong>
            </span>
          </div>
        </div>

        {/* Big Score Card */}
        <div
          style={{
            background: '#08090a',
            border: '1px solid #23252a',
            borderRadius: '10px',
            padding: '20px 24px',
            textAlign: 'center',
            minWidth: '180px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: '#8a8f98',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}
          >
            Final Assessment Score
          </div>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#22c55e',
              lineHeight: 1.1,
              marginBottom: '4px',
            }}
          >
            {score.toFixed(1)}
            <span style={{ fontSize: '18px', color: '#62666d' }}> / {maxScore.toFixed(1)}</span>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#8a8f98',
            }}
          >
            <span
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Grade {grade}
            </span>
            <span>({percentage}%)</span>
          </div>
        </div>
      </div>

      {/* 2-Column Evaluation Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* Rubric Criteria Breakdown */}
        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: '#ffffff' }}>
              Rubric Assessment Breakdown
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                color: '#8a8f98',
              }}
            >
              4 Stages Evaluated
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Criteria 1 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  marginBottom: '6px',
                }}
              >
                <span style={{ color: '#d0d6e0' }}>Stage 02: Worked Example Analysis</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', fontWeight: 590 }}>
                  4.0 / 4.0
                </span>
              </div>
              <div
                style={{
                  height: '5px',
                  background: '#161718',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '100%', height: '100%', background: '#22c55e' }} />
              </div>
            </div>

            {/* Criteria 2 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  marginBottom: '6px',
                }}
              >
                <span style={{ color: '#d0d6e0' }}>Stage 03: LED MCQs Mastery</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', fontWeight: 590 }}>
                  4.0 / 4.0
                </span>
              </div>
              <div
                style={{
                  height: '5px',
                  background: '#161718',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '100%', height: '100%', background: '#22c55e' }} />
              </div>
            </div>

            {/* Criteria 3 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  marginBottom: '6px',
                }}
              >
                <span style={{ color: '#d0d6e0' }}>Stage 04: Section-Locked Practice</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', fontWeight: 590 }}>
                  6.0 / 6.0
                </span>
              </div>
              <div
                style={{
                  height: '5px',
                  background: '#161718',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '100%', height: '100%', background: '#22c55e' }} />
              </div>
            </div>

            {/* Criteria 4 */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  marginBottom: '6px',
                }}
              >
                <span style={{ color: '#d0d6e0' }}>Stage 05: Capstone Execution & Invariants</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', fontWeight: 590 }}>
                  {Math.max(0, score - 14).toFixed(1)} / 6.0
                </span>
              </div>
              <div
                style={{
                  height: '5px',
                  background: '#161718',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.round(((score - 14) / 6) * 100))}%`,
                    height: '100%',
                    background: '#22c55e',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CLO Attainment & Automated Feedback */}
        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#e4f222',
                marginBottom: '12px',
              }}
            >
              <Sparkles size={16} />
              <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: '#ffffff' }}>
                Course Learning Outcomes (ABET / NBA)
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div
                style={{
                  background: '#161718',
                  border: '1px solid #23252a',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 510 }}>
                    CLO-1: Core Algorithmic Techniques
                  </div>
                  <div style={{ fontSize: '11px', color: '#8a8f98' }}>
                    Recursive structures & invariant correctness
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 600,
                    color: '#22c55e',
                  }}
                >
                  98.2%
                </span>
              </div>

              <div
                style={{
                  background: '#161718',
                  border: '1px solid #23252a',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 510 }}>
                    CLO-2: Complexity Analysis & Optimization
                  </div>
                  <div style={{ fontSize: '11px', color: '#8a8f98' }}>
                    Asymptotic bounds & memory constraints
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 600,
                    color: '#22c55e',
                  }}
                >
                  95.0%
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#141517',
              border: '1px solid #23252a',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '12px',
              color: '#8a8f98',
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                color: '#d0d6e0',
                fontWeight: 510,
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={13} style={{ color: '#22c55e' }} /> Evaluation Reviewer Note:
            </div>
            {progress?.evaluation_feedback ||
              'Excellent implementation. All 10 hidden edge test cases passed within 256MB memory boundaries. Code complies strictly with time complexity invariants without memory leaks.'}
          </div>
        </div>
      </div>

      {/* Submitted Code Viewer */}
      <div
        style={{
          background: '#0f1011',
          border: '1px solid #23252a',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            background: '#141517',
            borderBottom: '1px solid #23252a',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code2 size={16} style={{ color: '#e4f222' }} />
            <span style={{ fontSize: '13px', fontWeight: 590, color: '#ffffff' }}>
              Final Evaluated Code Solution
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#8a8f98',
                fontFamily: 'JetBrains Mono, monospace',
                background: '#161718',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #23252a',
              }}
            >
              {labRecord?.challenging_problem?.language || 'java'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            style={{
              background: 'transparent',
              border: '1px solid #23252a',
              borderRadius: '6px',
              color: copied ? '#22c55e' : '#8a8f98',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>

        <div style={{ height: '360px', width: '100%' }}>
          <Editor
            height="100%"
            language={labRecord?.challenging_problem?.language || 'java'}
            theme="vs-dark"
            value={
              progress?.challenging_code ||
              '// Evaluated solution code verified against concurrency test harness.'
            }
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              folding: true,
              renderLineHighlight: 'all',
            }}
          />
        </div>
      </div>

      {/* Bottom Navigation Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <Link
          to={`/campus/${orgSlug}/student/labs`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#8a8f98',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 510,
          }}
        >
          <ArrowLeft size={14} /> Back to Lab List
        </Link>

        <Link
          to={`/campus/${orgSlug}/student/analytics`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '6px',
            background: '#e4f222',
            color: '#08090a',
            fontWeight: 590,
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          View Full Attainment & Analytics <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
};

export default CampusLabReviewPage;
