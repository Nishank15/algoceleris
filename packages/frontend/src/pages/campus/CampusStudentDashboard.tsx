import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  FlaskConical,
  CheckCircle2,
  TrendingUp,
  Award,
  ArrowRight,
  Clock,
  Calendar,
  AlertCircle,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import {
  getStudentCampusAnalytics,
  getCampusLabs,
  StudentAnalyticsResponse,
  LabSummaryResponse,
} from '../../services/api';
import { getCampusSession } from '../../services/campusSession';

export const CampusStudentDashboard: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const location = useLocation();
  const session = getCampusSession(orgSlug);
  const accessDeniedMessage = (location.state as any)?.message;

  const [analytics, setAnalytics] = useState<StudentAnalyticsResponse | null>(null);
  const [labs, setLabs] = useState<LabSummaryResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [analyticsData, labsData] = await Promise.all([
          getStudentCampusAnalytics(orgSlug, session?.loginId),
          getCampusLabs(orgSlug, session?.loginId),
        ]);
        if (isMounted) {
          setAnalytics(analyticsData);
          setLabs(labsData);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load student dashboard data:', err);
          setError(err.message || 'Failed to load institutional dashboard data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [orgSlug, session?.loginId]);

  const activeLab = labs.find((l) => l.status === 'active' && l.student_status !== 'Evaluated') || labs[0];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-canvas) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Institutional Student Terminal · {orgSlug.toUpperCase()}
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 510,
              color: 'var(--text-primary)',
              letterSpacing: '-0.022em',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Welcome back,{' '}
            <span style={{ color: '#e4f222' }}>
              {session?.name ? session.name.split(' ')[0] : analytics?.student_name || 'Student'}
            </span>
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Registration Number:{' '}
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {session?.regNumber || analytics?.reg_number || 'DEMO-001'}
            </strong>{' '}
            · Cohort Course:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {analytics?.course_code || 'BACS101'} ({analytics?.course_name || 'Problem Solving Using Java'})
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link
            to={`/campus/${orgSlug}/student/labs`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '6px',
              background: 'var(--accent-primary)',
              color: 'var(--accent-primary-fg)',
              fontWeight: 510,
              fontSize: '13px',
              textDecoration: 'none',
              letterSpacing: '-0.011em',
              transition: 'opacity 150ms ease',
            }}
          >
            <FlaskConical size={15} />
            <span>Open Active Labs</span>
            <ArrowRight size={15} />
          </Link>
          <Link
            to={`/campus/${orgSlug}/student/analytics`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '6px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontWeight: 510,
              fontSize: '13px',
              textDecoration: 'none',
              letterSpacing: '-0.011em',
            }}
          >
            <Activity size={15} color="var(--text-secondary)" />
            <span>View Attainment</span>
          </Link>
        </div>
      </div>

      {accessDeniedMessage && (
        <div
          role="alert"
          style={{
            background: 'rgba(235, 87, 87, 0.12)',
            border: '1px solid #eb5757',
            borderRadius: '8px',
            padding: '16px 20px',
            color: '#eb5757',
            fontSize: '13px',
            fontWeight: 510,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(235, 87, 87, 0.1)',
          }}
        >
          <ShieldAlert size={18} />
          <span>{accessDeniedMessage}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'rgba(235, 87, 87, 0.1)',
            border: '1px solid #eb5757',
            borderRadius: '8px',
            padding: '16px',
            color: '#eb5757',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Real Telemetry KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* KPI 1 */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Active Labs</span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <FlaskConical size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              data-testid="active-labs-count"
              style={{
                fontSize: '32px',
                fontWeight: 590,
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.03em',
              }}
            >
              {loading ? '—' : analytics?.active_labs_count ?? 0}
            </span>
            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 500 }}>
              Assigned & Open
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Completed Labs</span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e',
              }}
            >
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              data-testid="completed-labs-count"
              style={{
                fontSize: '32px',
                fontWeight: 590,
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.03em',
              }}
            >
              {loading ? '—' : analytics?.completed_labs_count ?? 0}
            </span>
            <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 500 }}>
              Submitted & Evaluated
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Average Score</span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
              }}
            >
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              style={{
                fontSize: '32px',
                fontWeight: 590,
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.03em',
              }}
            >
              {loading ? '—' : analytics && analytics.completed_labs_count > 0 ? `${analytics.average_marks} / 20` : '—'}
            </span>
            <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 500 }}>
              {analytics && analytics.completed_labs_count > 0 ? 'Rubric Attainment' : 'Pending Evaluation'}
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>CLO Attainment</span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(228, 242, 34, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e4f222',
              }}
            >
              <Award size={16} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span
              style={{
                fontSize: '32px',
                fontWeight: 590,
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '-0.03em',
              }}
            >
              {loading ? '—' : analytics && analytics.completed_labs_count > 0 ? `${analytics.clo_attainment_percent}%` : '—'}
            </span>
            <span style={{ fontSize: '12px', color: '#e4f222', fontWeight: 500 }}>
              {analytics && analytics.completed_labs_count > 0 ? 'ABET Target Met' : 'Target Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Active Lab In-Progress Spotlight */}
      {activeLab && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  background: 'rgba(228, 242, 34, 0.12)',
                  color: '#e4f222',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {activeLab.code}
              </span>
              <span
                style={{
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: '#818cf8',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 600,
                }}
              >
                {activeLab.clo}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#22c55e',
                  fontWeight: 500,
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                Active Session
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} />
                {activeLab.duration_minutes} mins window
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} />
                Due {activeLab.deadline}
              </span>
            </div>
          </div>

          <div>
            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '20px',
                fontWeight: 510,
                color: 'var(--text-primary)',
                letterSpacing: '-0.015em',
              }}
            >
              {activeLab.title}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: '1.6',
              }}
            >
              {activeLab.description}
            </p>
          </div>

          <div
            style={{
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <span>6-Stage Pedagogy: Notes · Demo · LED MCQs · Locked Practice · Project Task</span>
            </div>

            <Link
              to={`/campus/${orgSlug}/student/labs/${activeLab.id}/room`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '6px',
                background: 'var(--accent-primary)',
                color: 'var(--accent-primary-fg)',
                fontWeight: 510,
                fontSize: '13px',
                textDecoration: 'none',
                letterSpacing: '-0.011em',
              }}
            >
              <span>Enter 6-Stage Lab Room</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Evaluated Labs & Progression Table */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 510, color: 'var(--text-primary)' }}>
              Curriculum Submissions & Rubric Records
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Real-time evaluated scores and outcomes verified by the evaluation sandbox
            </p>
          </div>
          <Link
            to={`/campus/${orgSlug}/student/analytics`}
            style={{
              fontSize: '13px',
              color: '#e4f222',
              textDecoration: 'none',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Full Analytics Breakdown →
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>LAB CODE</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>ASSESSMENT TITLE</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>CLO</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>SCORE</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {labs.map((lab) => {
                const isEvaluated = lab.student_status === 'Evaluated';
                return (
                  <tr
                    key={lab.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {lab.code}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>
                      {lab.title}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: '#818cf8',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {lab.clo}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono, monospace', color: isEvaluated ? '#22c55e' : 'var(--text-secondary)' }}>
                      {isEvaluated && lab.student_marks != null ? `${lab.student_marks} / ${lab.max_marks}` : `— / ${lab.max_marks}`}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: isEvaluated
                            ? 'rgba(34, 197, 94, 0.1)'
                            : lab.student_status === 'In Progress'
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(228, 242, 34, 0.1)',
                          color: isEvaluated
                            ? '#22c55e'
                            : lab.student_status === 'In Progress'
                            ? '#f59e0b'
                            : '#e4f222',
                        }}
                      >
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: isEvaluated
                              ? '#22c55e'
                              : lab.student_status === 'In Progress'
                              ? '#f59e0b'
                              : '#e4f222',
                          }}
                        />
                        {isEvaluated
                          ? 'Evaluated'
                          : lab.student_status === 'In Progress'
                          ? 'In Progress'
                          : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {isEvaluated ? (
                        <Link
                          to={`/campus/${orgSlug}/student/labs/${lab.id}/review`}
                          style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Review Feedback →
                        </Link>
                      ) : (
                        <Link
                          to={`/campus/${orgSlug}/student/labs/${lab.id}/room`}
                          style={{
                            color: '#e4f222',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Resume Lab →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CampusStudentDashboard;
