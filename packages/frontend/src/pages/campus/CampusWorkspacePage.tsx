import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCampusSession, CampusUserSession } from '../../services/campusSession';
import {
  Building2,
  ShieldCheck,
  FileCode2,
  Terminal,
  BarChart3,
  Users,
  ArrowRight,
} from 'lucide-react';

export const CampusWorkspacePage: React.FC = () => {
  const { orgSlug = 'vit-chennai' } = useParams<{ orgSlug: string }>();
  const [session, setSession] = useState<CampusUserSession | null>(() => getCampusSession(orgSlug));

  useEffect(() => {
    const s = getCampusSession(orgSlug);
    setSession(s);
  }, [orgSlug]);

  const role = session?.role || 'student';
  const regNumber = session?.regNumber || 'DEMO-001';
  const orgName = session?.orgName || orgSlug.toUpperCase().replace('-', ' ');

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
                background: 'rgba(228, 242, 34, 0.1)',
                color: '#e4f222',
                border: '1px solid rgba(228, 242, 34, 0.25)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {role.toUpperCase()} WORKSPACE
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Active Cohort: {session?.cohortName || 'CSE Core 2026'}
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
            Welcome, {session?.name || 'Academic Scholar'}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            {orgName} · Registration No:{' '}
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {regNumber}
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '12px',
              textAlign: 'right',
            }}
          >
            <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>
              Evaluation Engine
            </div>
            <div style={{ color: 'var(--accent-success)', fontWeight: 510, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-success)' }} />
              Dedicated Compute Allocation
            </div>
          </div>
        </div>
      </div>

      {/* 3 Overview Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Assigned Lab Modules
            </span>
            <FileCode2 size={16} style={{ color: '#e4f222' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {role === 'student' ? '4 Active' : '6 Published'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Next due: Oct 24, 2026 · Lab 04 (Graph Algorithms)
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CLO Attainment Index
            </span>
            <BarChart3 size={16} style={{ color: 'var(--accent-success)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-success)', marginBottom: '4px' }}>
            91.4%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            CLO-1: 96% · CLO-2: 88% · CLO-3: 90% (Target Met)
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Academic Integrity
            </span>
            <ShieldCheck size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', marginBottom: '4px' }}>
            0 Anomalies
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Originality & Proctoring verified clean
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Next Steps */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 590, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              Academic Quick Launchpad
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
              Access sandboxed coding environments, progressive lab assessments, and practice catalogs.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <Link
            to="/problems"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '18px',
              textDecoration: 'none',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e4f222', marginBottom: '8px' }}>
                <Terminal size={16} />
                <span style={{ fontSize: '14px', fontWeight: 590 }}>Competitive Practice Catalog</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Evaluate algorithmic code across dual-pane Monaco editor with instant evaluation feedback.
              </p>
            </div>
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#e4f222', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Open Problems Catalog <ArrowRight size={13} />
            </div>
          </Link>

          <Link
            to={`/campus/${orgSlug}/login`}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '18px',
              textDecoration: 'none',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                <Users size={16} />
                <span style={{ fontSize: '14px', fontWeight: 590 }}>Role & Identity Portal</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Access verified Student, Faculty, and Administrator accounts with authentic institutional credentials.
              </p>
            </div>
            <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Sign In / Switch Account <ArrowRight size={13} />
            </div>
          </Link>

          <Link
            to="/campus"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '18px',
              textDecoration: 'none',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-success)', marginBottom: '8px' }}>
                <Building2 size={16} />
                <span style={{ fontSize: '14px', fontWeight: 590 }}>University Directory</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Explore active campus portals across IIT Madras, VIT Chennai, BITS Pilani, or provision a new institution.
              </p>
            </div>
            <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All Universities <ArrowRight size={13} />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
export default CampusWorkspacePage;
