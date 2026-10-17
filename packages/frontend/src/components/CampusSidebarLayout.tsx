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

  const [session, setSession] = useState<CampusUserSession | null>(null);
  const [orgs, setOrgs] = useState<CampusOrgSummary[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherSearch, setSwitcherSearch] = useState('');

  // Detect role from URL path (e.g. /campus/vit-chennai/faculty/...) or fallback to session
  const pathParts = location.pathname.split('/');
  const urlRole: CampusRole = pathParts.includes('faculty')
    ? 'faculty'
    : pathParts.includes('admin')
    ? 'org_admin'
    : 'student';

  useEffect(() => {
    // 1. Fetch current institutional session
    const currentSession = getCampusSession(orgSlug);
    if (currentSession) {
      setSession(currentSession);
    } else {
      // If not logged in, synthesize a temporary institutional guest session
      const tempSession: CampusUserSession = {
        role: urlRole,
        orgSlug,
        orgName: orgSlug.toUpperCase().replace('-', ' '),
        userId: 'temp-session',
        name: urlRole === 'student' ? 'Student Member' : urlRole === 'faculty' ? 'Faculty Member' : 'Admin Lead',
        loginId: `${urlRole}@${orgSlug}.ac.in`,
        regNumber: urlRole === 'student' ? '25BAI1234' : urlRole === 'faculty' ? 'FAC-9842' : 'ADM-001',
        department: 'Computer Science & Engineering',
        initials: urlRole === 'student' ? 'ST' : urlRole === 'faculty' ? 'FC' : 'AD',
      };
      setSession(tempSession);
      saveCampusSession(tempSession);
    }

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
  }, [orgSlug, urlRole]);

  const activeRole: CampusRole = session?.role || urlRole;
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

  const handleSwitchRole = (newRole: CampusRole) => {
    if (session) {
      const updated = {
        ...session,
        role: newRole,
        regNumber: newRole === 'student' ? '25BAI1234' : newRole === 'faculty' ? 'FAC-9842' : 'ADM-001',
      };
      saveCampusSession(updated);
      setSession(updated);
    }
    const rolePath = newRole === 'org_admin' ? 'admin' : newRole;
    navigate(`/campus/${orgSlug}/${rolePath}/dashboard`);
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
          label: 'Kernel Sandbox Audit',
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
        background: '#08090a',
        color: '#ffffff',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* 240px Fixed Left Sidebar */}
      <aside
        style={{
          width: '240px',
          minWidth: '240px',
          background: '#0f1011',
          borderRight: '1px solid #23252a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 40,
        }}
      >
        <div>
          {/* Top Institution Switcher Bar */}
          <div style={{ position: 'relative', borderBottom: '1px solid #23252a', padding: '14px 16px' }}>
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
                color: '#ffffff',
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
                    background: '#161718',
                    border: '1px solid #23252a',
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
                      color: '#ffffff',
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
                      color: '#8a8f98',
                    }}
                  >
                    /{orgSlug}
                  </div>
                </div>
              </div>

              <ChevronDown
                size={14}
                style={{
                  color: '#8a8f98',
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
                  background: '#141517',
                  border: '1px solid #23252a',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
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
                      color: '#62666d',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Filter campus..."
                    value={switcherSearch}
                    onChange={(e) => setSwitcherSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      borderRadius: '4px',
                      padding: '6px 8px 6px 26px',
                      color: '#ffffff',
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
                        key={o.id}
                        type="button"
                        onClick={() => handleSwitchOrg(o.slug)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px',
                          borderRadius: '4px',
                          background: o.slug === orgSlug ? '#23252a' : 'transparent',
                          border: 'none',
                          color: o.slug === orgSlug ? '#e4f222' : '#d0d6e0',
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

                <div style={{ borderTop: '1px solid #23252a', marginTop: '6px', paddingTop: '6px' }}>
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

          {/* Active Role Selector Strip */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #23252a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#62666d', fontWeight: 510 }}>
                Active Persona
              </span>
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: 'rgba(228, 242, 34, 0.1)',
                  color: '#e4f222',
                  border: '1px solid rgba(228, 242, 34, 0.2)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {activeRole.toUpperCase()}
              </span>
            </div>

            {/* Quick 3-way Role Switcher for paired testing */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                background: '#161718',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid #23252a',
              }}
            >
              {(['student', 'faculty', 'org_admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSwitchRole(r)}
                  style={{
                    padding: '4px 0',
                    border: 'none',
                    borderRadius: '4px',
                    background: activeRole === r ? '#23252a' : 'transparent',
                    color: activeRole === r ? '#ffffff' : '#8a8f98',
                    fontSize: '10px',
                    fontWeight: activeRole === r ? 590 : 400,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {r === 'org_admin' ? 'Admin' : r}
                </button>
              ))}
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
                    color: isActive ? '#e4f222' : '#8a8f98',
                    borderLeft: isActive ? '2px solid #e4f222' : '2px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={15} style={{ color: isActive ? '#e4f222' : '#62666d' }} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Section */}
        <div style={{ borderTop: '1px solid #23252a', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: '#161718',
                  border: '1px solid #23252a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#ffffff',
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
                    color: '#ffffff',
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
                    color: '#8a8f98',
                  }}
                >
                  {session?.regNumber || '25BAI1234'}
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
                color: '#62666d',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#eb5757')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#62666d')}
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
              color: '#62666d',
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
              cgroup isolation
            </span>
            <Link to="/campus" style={{ color: '#8a8f98', textDecoration: 'none' }}>
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
            borderBottom: '1px solid #23252a',
            background: 'rgba(15, 16, 17, 0.75)',
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
            <Link to="/campus" style={{ color: '#8a8f98', textDecoration: 'none' }}>
              Campus
            </Link>
            <span style={{ color: '#383b3f' }}>/</span>
            <span style={{ color: '#d0d6e0', fontWeight: 510 }}>{orgName}</span>
            <span style={{ color: '#383b3f' }}>/</span>
            <span
              style={{
                color: '#8a8f98',
                textTransform: 'capitalize',
              }}
            >
              {activeRole.replace('_', ' ')}
            </span>
            <span style={{ color: '#383b3f' }}>/</span>
            <span style={{ color: '#ffffff', fontWeight: 590 }}>{getCurrentPageTitle()}</span>
          </div>

          {/* Right Header Badges & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Live Role Switcher */}
            <select
              value={activeRole}
              onChange={(e) => handleSwitchRole(e.target.value as CampusRole)}
              style={{
                background: '#141517',
                border: '1px solid #23252a',
                borderRadius: '6px',
                color: '#d0d6e0',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
              }}
              aria-label="Campus Role Switcher"
            >
              <option value="student">Role: Student ▾</option>
              <option value="faculty">Role: Faculty ▾</option>
              <option value="org_admin">Role: Admin ▾</option>
            </select>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#8a8f98',
                background: '#141517',
                border: '1px solid #23252a',
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
                Sandbox Online
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{
                background: 'transparent',
                border: '1px solid #23252a',
                borderRadius: '6px',
                color: '#8a8f98',
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
