import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  listCampusOrgs,
  CampusOrgSummary,
} from '../../services/api';
import {
  Building2,
  GraduationCap,
  Users,
  Search,
  ArrowRight,
  BookOpen,
  Terminal,
  CheckCircle2,
  Lock,
  Sparkles,
  Flame,
  Award,
} from 'lucide-react';

export const CampusLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<CampusOrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const DEFAULT_ORGS: CampusOrgSummary[] = [
      {
        id: '10000000-0000-0000-0000-000000000001',
        name: 'VIT Chennai',
        slug: 'vit-chennai',
        domain_whitelist: ['vitstudent.ac.in', 'vit.ac.in'],
        tier: 'Enterprise Campus',
        student_count: 1200,
        faculty_count: 45,
        created_at: new Date().toISOString(),
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        name: 'IIT Madras',
        slug: 'iitm',
        domain_whitelist: ['smail.iitm.ac.in', 'iitm.ac.in'],
        tier: 'Enterprise Campus',
        student_count: 850,
        faculty_count: 32,
        created_at: new Date().toISOString(),
      },
      {
        id: '10000000-0000-0000-0000-000000000003',
        name: 'BITS Pilani',
        slug: 'bits-pilani',
        domain_whitelist: ['pilani.bits-pilani.ac.in'],
        tier: 'Enterprise Campus',
        student_count: 940,
        faculty_count: 28,
        created_at: new Date().toISOString(),
      },
    ];

    async function fetchOrgs() {
      try {
        setLoading(true);
        setError(null);
        const data = await listCampusOrgs();
        if (isMounted) {
          if (Array.isArray(data) && data.length > 0) {
            const hasVit = data.some((o) => o.slug === 'vit-chennai');
            // The directory cards are keyed by `slug`, so only append a showcase entry when the
            // tenant is genuinely absent — otherwise a known slug would render twice.
            const missing = DEFAULT_ORGS.filter(
              (fallback) => !data.some((o) => o.slug === fallback.slug)
            );
            setOrgs(hasVit ? data : [...data, ...missing]);
          } else {
            setOrgs(DEFAULT_ORGS);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load campus organizations:', err);
          setError(err.message || 'Unable to connect to campus gateway');
          setOrgs(DEFAULT_ORGS);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchOrgs();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredOrgs = orgs.filter((org) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      org.name.toLowerCase().includes(q) ||
      org.slug.toLowerCase().includes(q) ||
      org.domain_whitelist.some((d) => d.toLowerCase().includes(q))
    );
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top Breadcrumb & Status Ribbon */}
      <div
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(15, 16, 17, 0.75)',
          backdropFilter: 'blur(12px)',
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              background: 'rgba(228, 242, 34, 0.12)',
              color: '#e4f222',
              fontWeight: 510,
              fontSize: '11px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              border: '1px solid rgba(228, 242, 34, 0.25)',
            }}
          >
            Multi-Tenant Enterprise Mesh
          </span>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>University Lab Operating System & Proctoring Engine</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.7)',
              }}
            />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
              AUTOMATED EVALUATION ENGINE ONLINE
            </span>
          </div>
          <Link
            to="/campus/register"
            style={{
              color: '#e4f222',
              textDecoration: 'none',
              fontWeight: 510,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Provision Institution <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '72px 24px 48px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '28px',
          }}
        >
          <Building2 size={13} style={{ color: '#e4f222' }} />
          <span>AlgoCeleris Campus Enterprise Platform</span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--text-secondary)' }}>High-Performance Multi-Tenant Virtual Labs</span>
        </div>

        <h1
          style={{
            fontSize: '56px',
            fontWeight: 590,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            margin: '0 0 20px 0',
            color: 'var(--text-primary)',
          }}
        >
          The modern operating platform for <br />
          <span
            style={{
              background: 'linear-gradient(180deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            computer science education.
          </span>
        </h1>

        <p
          style={{
            fontSize: '18px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: '780px',
            margin: '0 auto 36px auto',
            fontWeight: 400,
          }}
        >
          Dedicated sandbox isolation, real-time automated test suite streaming,
          section-locked progressive lab environments, and automated ABET/NBA CLO curriculum
          attainment tracking built for modern engineering campuses.
        </p>

        {/* Hero CTAs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            flexWrap: 'wrap',
            marginBottom: '64px',
          }}
        >
          <Link
            to="/campus/register"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--accent-primary)',
              color: 'var(--accent-primary-fg)',
              padding: '13px 26px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 590,
              textDecoration: 'none',
              letterSpacing: '-0.01em',
              transition: 'transform 0.15s ease',
            }}
          >
            Provision University Tenant <ArrowRight size={16} />
          </Link>

          <a
            href="#institutions"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              padding: '13px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 510,
              textDecoration: 'none',
            }}
          >
            Browse Active Institutions ↓
          </a>
        </div>

        {/* Core Architectural Telemetry Metric Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            textAlign: 'left',
            marginBottom: '80px',
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
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Execution Overhead
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 600, color: '#e4f222', marginBottom: '4px' }}>
              &lt; 15 ms
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Evaluations begin immediately, with no environment startup delay</div>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Dedicated Compute
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Dedicated Compute Allocation
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Guaranteed compute resources and safe evaluation boundaries</div>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Plagiarism Engine
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 600, color: '#22c55e', marginBottom: '4px' }}>
              Code Similarity
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Structural similarity analysis invariant to variable renaming & comments</div>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Academic Integrity
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 600, color: '#02b8cc', marginBottom: '4px' }}>
              ABET / NBA
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Automated CLO-1 through CLO-4 attainment matrices</div>
          </div>
        </div>
      </div>

      {/* Institution Directory Section */}
      <div
        id="institutions"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          background: '#0a0b0c',
          padding: '64px 24px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
              marginBottom: '32px',
            }}
          >
            <div>
              <div
                style={{
                  color: '#e4f222',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '6px',
                }}
              >
                Institutional Portal Directory
              </div>
              <h2
                style={{
                  fontSize: '28px',
                  fontWeight: 590,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Select Your Campus Tenant
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '6px 0 0 0' }}>
                All student, faculty, and administrative sessions are strictly authenticated against their university domain.
              </p>
            </div>

            {/* Search Input */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '360px',
              }}
            >
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search university name, slug, or domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '10px 14px 10px 36px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                background: 'rgba(235, 87, 87, 0.1)',
                border: '1px solid rgba(235, 87, 87, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#eb5757',
                fontSize: '13px',
                marginBottom: '24px',
              }}
            >
              Gateway connection warning: {error}. Falling back to cached university directory.
            </div>
          )}

          {/* Organization Grid */}
          {loading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '24px',
                    height: '180px',
                    animation: 'pulse 1.5s infinite ease-in-out',
                  }}
                />
              ))}
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-subtle)',
                borderRadius: '12px',
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <Building2 size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <div style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>No universities matching "{searchQuery}"</div>
              <div style={{ fontSize: '13px', marginBottom: '20px' }}>Would you like to provision a new institution tenant with this name?</div>
              <Link
                to="/campus/register"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--accent-primary)',
                  color: 'var(--accent-primary-fg)',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 510,
                  textDecoration: 'none',
                }}
              >
                Provision Institution Tenant →
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredOrgs.map((org) => (
                <div
                  key={org.slug}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s ease, transform 0.15s ease',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '12px',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            fontSize: '18px',
                            fontWeight: 590,
                            margin: '0 0 4px 0',
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {org.name}
                        </h3>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          /{org.slug}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {org.tier}
                      </span>
                    </div>

                    {/* Whitelist Domains */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
                      {org.domain_whitelist.map((domain) => (
                        <span
                          key={domain}
                          style={{
                            fontSize: '11px',
                            fontFamily: 'JetBrains Mono, monospace',
                            background: 'rgba(35, 37, 42, 0.6)',
                            color: '#a0a6b2',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          @{domain}
                        </span>
                      ))}
                    </div>

                    {/* Stats Strip */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '12px',
                        marginBottom: '20px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <GraduationCap size={14} style={{ color: '#e4f222' }} />
                        <span>
                          <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                            {org.student_count.toLocaleString()}
                          </strong>{' '}
                          Students
                        </span>
                      </div>

                      <div style={{ color: 'var(--border-divider)' }}>|</div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Users size={14} style={{ color: '#02b8cc' }} />
                        <span>
                          <strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                            {org.faculty_count.toLocaleString()}
                          </strong>{' '}
                          Faculty
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Enter Button */}
                  <button
                    type="button"
                    onClick={() => navigate(`/campus/${org.slug}/login`)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '11px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 510,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background 0.15s ease, border-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#e4f222';
                      e.currentTarget.style.color = '#e4f222';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    Enter Institutional Portal <ArrowRight size={14} />
                  </button>
                </div>
              ))}

              {/* Provisioning Teaser Card */}
              <div
                style={{
                  background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)',
                  border: '1px dashed var(--border-divider)',
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
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(228, 242, 34, 0.12)',
                      border: '1px solid rgba(228, 242, 34, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e4f222',
                      marginBottom: '16px',
                    }}
                  >
                    <Sparkles size={18} />
                  </div>

                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 590,
                      margin: '0 0 6px 0',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Provision Your Institution
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                    Deploy a dedicated single-tenant domain space with custom single sign-on, tailored course cohorts, and dedicated grading workers.
                  </p>
                </div>

                <Link
                  to="/campus/register"
                  style={{
                    width: '100%',
                    background: 'var(--accent-primary)',
                    color: 'var(--accent-primary-fg)',
                    border: 'none',
                    padding: '11px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 590,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxSizing: 'border-box',
                  }}
                >
                  Start Provisioning Wizard →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6-Stage Lab Workflow Breakdown */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div
            style={{
              color: '#e4f222',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '6px',
            }}
          >
            Academic Rigor & Pedagogy
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 590, margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
            The 6-Stage Progressive Lab Room
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', maxWidth: '640px', margin: '0 auto' }}>
            Transforming standard programming assignments into structured, verifiable learning progressions with real-time feedback.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {[
            {
              stage: '01',
              title: 'Theory & Lecture Notes',
              desc: 'Interactive lecture materials with code snippets, diagrams, and explicit CLO alignment markers.',
              icon: BookOpen,
              color: 'var(--text-primary)',
            },
            {
              stage: '02',
              title: 'Worked Demonstration',
              desc: 'Annotated reference implementations demonstrating algorithmic principles with live step-by-step memory traces.',
              icon: Terminal,
              color: '#02b8cc',
            },
            {
              stage: '03',
              title: 'Conceptual Pre-Lab MCQs',
              desc: 'Formative checkpoint questions that verify algorithmic edge-case comprehension before touching the keyboard.',
              icon: CheckCircle2,
              color: '#22c55e',
            },
            {
              stage: '04',
              title: 'Scaffolded Coding Lab',
              desc: 'Section-locked editor layout with read-only invariant headers, driver blocks, and student editable slots.',
              icon: Lock,
              color: '#e4f222',
            },
            {
              stage: '05',
              title: 'Challenge Problem',
              desc: 'Unscaffolded competitive programming problems evaluating execution runtime, asymptotic memory, and stress tests.',
              icon: Flame,
              color: '#eb5757',
            },
            {
              stage: '06',
              title: 'Formative Lab Review',
              desc: 'Comprehensive post-submission telemetry report comparing execution performance, AI mentor hints, and rubric scoring.',
              icon: Award,
              color: '#a855f7',
            },
          ].map((item) => (
            <div
              key={item.stage}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                gap: '16px',
              }}
            >
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: item.color,
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  height: 'fit-content',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {item.stage}
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 590, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  {item.title}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '32px 24px',
          background: 'var(--bg-canvas)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            AlgoCeleris Campus Platform · Refero Linear Midnight Edition · Production Milestone v4.3
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link to="/problems" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Problems</Link>
            <Link to="/contests" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Contests</Link>
            <Link to="/hackathons" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Hackathons</Link>
            <Link to="/campus/register" style={{ color: '#e4f222', textDecoration: 'none' }}>Provision</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CampusLandingPage;
