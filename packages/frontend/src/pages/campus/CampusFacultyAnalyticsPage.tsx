import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart3,
  CalendarClock,
  FileCode2,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { getCampusSession } from '../../services/campusSession';

/** A class-analytics view the platform advertises but has not shipped yet. */
interface PlannedAnalysis {
  title: string;
  detail: string;
}

const PLANNED_ANALYSES: PlannedAnalysis[] = [
  {
    title: 'Cohort attainment distribution',
    detail:
      'Per-criterion score spread across module, cohort and term so grade curves can be reviewed before marks are released.',
  },
  {
    title: 'Difficulty calibration',
    detail:
      'Expected versus observed pass rate per problem, flagging tasks that are mis-graded or mis-weightened against the rubric.',
  },
  {
    title: 'Progression and stall points',
    detail:
      'Where candidates stop advancing through the 6-stage lab pipeline, aggregated over the cohort.',
  },
  {
    title: 'Submission volume and latency',
    detail:
      'Attempts per candidate per module, with the time between first attempt and accepted verdict.',
  },
];

/**
 * Placeholder for `faculty/analytics`.
 *
 * The campus sidebar advertises a "Class Analytics" surface. The route is live so that navigation
 * entry resolves inside the faculty workspace, but no aggregation is wired up behind it yet.
 * Rendering the cohort dashboard under this URL instead read as an accidental duplicate of
 * `faculty/dashboard`, so the page states its status and points at the surfaces that already
 * answer part of the intent today.
 */
export const CampusFacultyAnalyticsPage: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const session = getCampusSession(orgSlug);

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(228, 242, 34, 0.1)',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(228, 242, 34, 0.25)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            CLASS ANALYTICS
          </span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Cohort: {session?.cohortName || 'CSE Core 2026'}
          </span>
        </div>

        <h1
          style={{
            fontSize: '26px',
            fontWeight: 590,
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}
        >
          Class Attainment &amp; Analytics
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
          Cross-module attainment reporting for the cohort is scheduled for a future release.
        </p>
      </div>

      {/* Status Panel */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '6px',
          }}
        >
          <CalendarClock size={18} style={{ color: 'var(--accent-primary)' }} />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--accent-primary)',
            }}
          >
            In preview — not yet available
          </span>
        </div>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
            lineHeight: 1.6,
            margin: '0 0 20px 0',
            maxWidth: '760px',
          }}
        >
          Nothing is aggregated for this org yet, so the view below lists what the surface will
          report rather than showing placeholder figures. The figures that are available today live
          on the cohort dashboard and the proctoring cockpit.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
          }}
        >
          {PLANNED_ANALYSES.map((analysis) => (
            <div
              key={analysis.title}
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 590,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                <BarChart3 size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>{analysis.title}</span>
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                {analysis.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Today */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginBottom: '16px',
          }}
        >
          <TrendingUp size={14} />
          <span>Available today</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Link to={`/campus/${orgSlug}/faculty/dashboard`} className="faculty-view-link">
            <LayoutDashboard size={15} />
            <span>Cohort curriculum &amp; roster</span>
          </Link>
          <Link to={`/campus/${orgSlug}/faculty/labs`} className="faculty-view-link">
            <FileCode2 size={15} />
            <span>Lab modules &amp; submission counts</span>
          </Link>
          <Link to={`/campus/${orgSlug}/faculty/plagiarism`} className="faculty-view-link">
            <ShieldCheck size={15} />
            <span>AST plagiarism reports</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
