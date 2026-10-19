import React, { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  listCampusOrgs,
  CampusOrgSummary,
} from '../services/api';
import {
  getCampusSession,
  clearCampusSession,
  saveCampusSession,
  CampusUserSession,
  CampusRole,
} from '../services/campusSession';
import { useTheme } from '../context/ThemeContext';
import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  FileCode2,
  BarChart3,
  Terminal,
  ShieldCheck,
  Users,
  LogOut,
  Sun,
  Moon,
  Search,
  CheckCircle2,
} from 'lucide-react';

export const CampusSidebarLayout: React.FC = () => {
  const { orgSlug = 'vit-chennai' } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [session, setSession] = useState<CampusUserSession | null>(() => getCampusSession(orgSlug));
  const [orgs, setOrgs] = useState<CampusOrgSummary[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherSearch, setSwitcherSearch] = useState('');

  useEffect(() => {
    // 1. Fetch current institutional session
    const currentSession = getCampusSession(orgSlug);
    setSession(currentSession);

    // 2. Load all available organizations for the switcher dropdown
    let isMounted = true;
    async function loadOrgs() {
      try {
        const data = await listCampusOrgs();
        if (isMounted) setOrgs(data);
      } catch (err) {
        console.debug('Could not load organizations for switcher:', err);
      }
    }
    loadOrgs();
    return () => {
      isMounted = false;
    };
  }, [orgSlug]);

  // Role strictly derived from active verified session claims
  const activeRole: CampusRole = session?.role || 'student';
  const currentOrg = orgs.find((o) => o.slug.toLowerCase() === orgSlug.toLowerCase());
  const orgName = currentOrg?.name || session?.orgName || orgSlug.toUpperCase().replace('-', ' ');

  const handleSignOut = () => {
    clearCampusSession();
    navigate(`/campus/${orgSlug}/login`);
  };

  const handleSwitchOrg = (targetSlug: string) => {
    setSwitcherOpen(false);
    if (session) {
      const updated = { ...session, orgSlug: targetSlug };
      saveCampusSession(updated);
      setSession(updated);
    }
    const rolePath = activeRole === 'org_admin' ? 'admin' : activeRole;
    navigate(`/campus/${targetSlug}/${rolePath}/dashboard`);
  };

  // Nav items based on active role
  const getNavItems = () => {
    if (activeRole === 'student') {
      return [
        {
          label: 'Overview',
          path: `/campus/${orgSlug}/student/dashboard`,
          icon: LayoutDashboard,
        },
        {
          label: 'Lab Assessments',
          path: `/campus/${orgSlug}/student/labs`,
          icon: FileCode2,
        },
        {
          label: 'Attainment & Analytics',
          path: `/campus/${orgSlug}/student/analytics`,
          icon: BarChart3,
        },
        {
          label: 'Practice Problems',
          path: '/problems',
          icon: Terminal,
        },
      ];
    } else if (activeRole === 'faculty') {
      return [
        {
          label: 'Cohorts Overview',
          path: `/campus/${orgSlug}/faculty/dashboard`,
          icon: LayoutDashboard,
        },
        {
          label: 'Lab Authoring',
          path: `/campus/${orgSlug}/faculty/labs`,
          icon: FileCode2,
        },
        {
          label: 'Class Analytics',
          path: `/campus/${orgSlug}/faculty/analytics`,
          icon: BarChart3,
        },
        {
          label: 'Proctoring Cockpit',
          path: `/campus/${orgSlug}/faculty/cockpit`,
          icon: ShieldCheck,
        },
      ];
    } else {
      return [
        {
          label: 'Tenant Overview',
          path: `/campus/${orgSlug}/admin/dashboard`,
          icon: LayoutDashboard,
        },
        {
          label: 'Member Roster',
          path: `/campus/${orgSlug}/admin/roster`,
          icon: Users,
        },
        {
          label: 'Evaluation Safety Audit',
          path: `/campus/${orgSlug}/admin/audit`,
          icon: ShieldCheck,
        },
      ];
    }
  };

  const navItems = getNavItems();

  // Breadcrumbs title helper
  const getCurrentPageTitle = () => {
    const matched = navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path));
    if (matched) return matched.label;
    if (location.pathname.includes('/labs/')) return '6-Stage Progressive Lab';
    return 'Workspace Dashboard';
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* 240px Fixed Left Sidebar */}
      <aside
        style={{
          width: '240px',
          minWidth: '240px',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 40,
        }}
      >
        <div>
          {/* Top Institution Switcher Bar */}
          <div style={{ position: 'relative', borderBottom: '1px solid var(--border-subtle)', padding: '14px 16px' }}>
            <button
              type="button"
              onClick={() => setSwitcherOpen(!switcherOpen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e4f222',
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={15} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 590,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {orgName}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    /{orgSlug}
                  </div>
                </div>
              </div>

              <ChevronDown
                size={14}
                style={{
                  color: 'var(--text-secondary)',
                  transform: switcherOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            {/* Institution Dropdown Popover */}
            {switcherOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '12px',
                  right: '12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  padding: '8px',
                  zIndex: 50,
                  marginTop: '6px',
                }}
              >
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Search
                    size={13}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Filter campus..."
                    value={switcherSearch}
                    onChange={(e) => setSwitcherSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      padding: '6px 8px 6px 26px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {orgs
                    .filter(
                      (o) =>
                        !switcherSearch ||
                        o.name.toLowerCase().includes(switcherSearch.toLowerCase()) ||
                        o.slug.toLowerCase().includes(switcherSearch.toLowerCase())
                    )
                    .map((o) => (
                      <button
                        key={o.id ?? o.slug}
                        type="button"
                        onClick={() => handleSwitchOrg(o.slug)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px',
                          borderRadius: '4px',
                          background: o.slug === orgSlug ? 'var(--border-subtle)' : 'transparent',
                          border: 'none',
                          color: o.slug === orgSlug ? '#e4f222' : 'var(--text-secondary)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.name}
                        </span>
                        {o.slug === orgSlug && <CheckCircle2 size={12} />}
                      </button>
                    ))}
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '6px', paddingTop: '6px' }}>
                  <Link
                    to="/campus/register"
                    onClick={() => setSwitcherOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#e4f222',
                      textDecoration: 'none',
                      padding: '4px 8px',
                    }}
                  >
                    + Provision New University
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Read-Only Verified Identity Badge */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 510 }}>
                Verified Identity
              </span>
              <span
                className="campus-verified-role-badge"
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  fontFamily: 'JetBrains Mono, monospace',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    display: 'inline-block',
                  }}
                />
                {activeRole === 'org_admin' ? 'ORG ADMIN' : activeRole.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Role-gated Navigation List */}
          <nav style={{ padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== `/campus/${orgSlug}` && location.pathname.startsWith(item.path));
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: isActive ? 590 : 400,
                    background: isActive ? 'rgba(228, 242, 34, 0.08)' : 'transparent',
                    color: isActive ? '#e4f222' : 'var(--text-secondary)',
                    borderLeft: isActive ? '2px solid #e4f222' : '2px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={15} style={{ color: isActive ? '#e4f222' : 'var(--text-muted)' }} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Section */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  flexShrink: 0,
                }}
              >
                {session?.initials || 'US'}
              </div>

              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 510,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {session?.name || 'Academic User'}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {session?.regNumber || 'DEMO-001'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              title="Sign Out of Campus"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#eb5757')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <LogOut size={15} />
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                }}
              />
              Evaluation Engine Online
            </span>
            <Link to="/campus" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Directory
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top 48px Command Header */}
        <header
          style={{
            height: '48px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            fontSize: '13px',
            zIndex: 30,
          }}
        >
          {/* Breadcrumb Path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/campus" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Campus
            </Link>
            <span style={{ color: 'var(--border-divider)' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 510 }}>{orgName}</span>
            <span style={{ color: 'var(--border-divider)' }}>/</span>
            <span
              style={{
                color: 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}
            >
              {activeRole.replace('_', ' ')}
            </span>
            <span style={{ color: 'var(--border-divider)' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 590 }}>{getCurrentPageTitle()}</span>
          </div>

          {/* Right Header Badges & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Verified Read-Only Role Badge */}
            <div
              className="campus-verified-role-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-secondary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                padding: '4px 10px',
                borderRadius: '6px',
              }}
            >
              <span
                className="role-dot"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                }}
              />
              <span className="role-name">{activeRole.toUpperCase()}</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                padding: '4px 10px',
                borderRadius: '9999px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
                }}
              />
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
                Service Online
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
              }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* Content Body Area */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default CampusSidebarLayout;
