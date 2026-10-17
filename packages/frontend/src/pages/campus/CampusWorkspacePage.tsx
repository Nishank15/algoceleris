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
  const [session, setSession] = useState<CampusUserSession | null>(null);

  useEffect(() => {
    const s = getCampusSession(orgSlug);
    setSession(s);
  }, [orgSlug]);

  const role = session?.role || 'student';
  const regNumber = session?.regNumber || '25BAI1234';
  const orgName = session?.orgName || orgSlug.toUpperCase().replace('-', ' ');

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner */}
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
                background: 'rgba(228, 242, 34, 0.1)',
                color: '#e4f222',
                border: '1px solid rgba(228, 242, 34, 0.25)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {role.toUpperCase()} WORKSPACE
            </span>
            <span style={{ color: '#62666d' }}>•</span>
            <span style={{ color: '#8a8f98', fontSize: '13px' }}>
              Active Cohort: {session?.cohortName || 'CSE Core 2026'}
            </span>
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: 590,
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            Welcome, {session?.name || 'Academic Scholar'}
          </h1>

          <p style={{ color: '#8a8f98', fontSize: '14px', margin: 0 }}>
            {orgName} · Registration No:{' '}
            <strong style={{ color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
              {regNumber}
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              background: '#08090a',
              border: '1px solid #23252a',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '12px',
              textAlign: 'right',
            }}
          >
            <div style={{ color: '#62666d', fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>
              Sandbox Isolation
            </div>
            <div style={{ color: '#22c55e', fontWeight: 510, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
              256MB / 1 vCPU cgroups v2
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
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Assigned Lab Modules
            </span>
            <FileCode2 size={16} style={{ color: '#e4f222' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#ffffff', marginBottom: '4px' }}>
            {role === 'student' ? '4 Active' : '6 Published'}
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            Next due: Oct 24, 2026 · Lab 04 (Graph Algorithms)
          </div>
        </div>

        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CLO Attainment Index
            </span>
            <BarChart3 size={16} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', marginBottom: '4px' }}>
            91.4%
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            CLO-1: 96% · CLO-2: 88% · CLO-3: 90% (ABET Targets Met)
          </div>
        </div>

        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Academic Integrity
            </span>
            <ShieldCheck size={16} style={{ color: '#02b8cc' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#02b8cc', marginBottom: '4px' }}>
            0 Anomalies
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            AST Winnowing & Proctoring verified clean
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Next Steps */}
      <div
        style={{
          background: '#0f1011',
          border: '1px solid #23252a',
          borderRadius: '12px',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 590, margin: '0 0 4px 0', color: '#ffffff' }}>
              Academic Quick Launchpad
            </h3>
            <p style={{ color: '#8a8f98', fontSize: '13px', margin: 0 }}>
              Access sandboxed coding environments, progressive lab assessments, and practice catalogs.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <Link
            to="/problems"
            style={{
              background: '#161718',
              border: '1px solid #23252a',
              borderRadius: '8px',
              padding: '18px',
              textDecoration: 'none',
              color: '#ffffff',
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
              <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Evaluate algorithmic code across dual-pane Monaco editor with sub-millisecond local sandbox runs.
              </p>
            </div>
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#e4f222', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Open Problems Catalog <ArrowRight size={13} />
            </div>
          </Link>

          <Link
            to={`/campus/${orgSlug}/login`}
            style={{
              background: '#161718',
              border: '1px solid #23252a',
              borderRadius: '8px',
              padding: '18px',
              textDecoration: 'none',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#02b8cc', marginBottom: '8px' }}>
                <Users size={16} />
                <span style={{ fontSize: '14px', fontWeight: 590 }}>Role & Identity Switcher</span>
              </div>
              <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Switch between Student, Faculty, and Admin personas with authentic JWT tokens and domain whitelisting.
              </p>
            </div>
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#02b8cc', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Switch Persona <ArrowRight size={13} />
            </div>
          </Link>

          <Link
            to="/campus"
            style={{
              background: '#161718',
              border: '1px solid #23252a',
              borderRadius: '8px',
              padding: '18px',
              textDecoration: 'none',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22c55e', marginBottom: '8px' }}>
                <Building2 size={16} />
                <span style={{ fontSize: '14px', fontWeight: 590 }}>University Directory</span>
              </div>
              <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Explore active campus portals across IIT Madras, VIT Chennai, BITS Pilani, or provision a new institution.
              </p>
            </div>
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All Universities <ArrowRight size={13} />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
export default CampusWorkspacePage;
