import React from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  GraduationCap,
  FlaskConical,
  LayoutDashboard,
  BarChart3,
  Brain,
  Shield,
  FileCode2,
  Award,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface CampusPlaceholderWorkspaceProps {
  title?: string;
  category?: string;
  description?: string;
  actionText?: string;
  actionRoute?: string;
}

export const CampusPlaceholderWorkspace: React.FC<CampusPlaceholderWorkspaceProps> = ({
  title,
  category = 'Institutional Workspace',
  description,
  actionText,
  actionRoute,
}) => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();

  // Infer title from path if not provided
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] || 'workspace';
  const displayTitle =
    title ||
    lastSegment
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');

  return (
    <div className="campus-placeholder-page" style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-carbon)',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
          >
            {category}
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Institution: <strong>{(orgSlug || 'vit-chennai').toUpperCase()}</strong>
          </span>
        </div>

        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            {displayTitle}
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {description ||
              `Interactive module for ${displayTitle}. Ready for evaluation and student progress tracking within the ${orgSlug || 'vit-chennai'} campus network.`}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginTop: '8px',
          }}
        >
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <FlaskConical size={16} color="#60a5fa" />
              <strong style={{ fontSize: '0.82rem' }}>Lab Practice Sandbox</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Section-locked Monaco code editor with GCC C++20, Python 3.12, and Java 21 support.
            </p>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Brain size={16} color="#34d399" />
              <strong style={{ fontSize: '0.82rem' }}>AI Co-Pilot Enabled</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Real-time Socratic hints and intelligent compiler diagnosis without giving direct solutions.
            </p>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Shield size={16} color="#fbbf24" />
              <strong style={{ fontSize: '0.82rem' }}>Audit & Integrity</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Tree-sitter AST Winnowing similarity matrix and live proctoring event mesh.
            </p>
          </div>
        </div>

        {actionRoute && (
          <div style={{ marginTop: '12px' }}>
            <Link
              to={actionRoute}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{actionText || 'Proceed to Workspace'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampusPlaceholderWorkspace;
