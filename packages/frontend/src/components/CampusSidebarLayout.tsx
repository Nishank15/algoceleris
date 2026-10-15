import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useParams, Outlet, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  LayoutDashboard,
  FlaskConical,
  CheckCircle2,
  FileCode2,
  Award,
  BarChart3,
  Brain,
  Compass,
  Cpu,
  PlusCircle,
  Shield,
  Eye,
  Video,
  FileCheck2,
  Users,
  CreditCard,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Moon,
  Sun,
  Menu,
  X,
  Building2,
  ExternalLink,
  HelpCircle,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  CampusRole,
  CampusUserSession,
  getCampusSession,
  saveCampusSession,
  clearCampusSession,
  DEMO_CAMPUS_ACCOUNTS,
} from '../services/campusSession';

interface CampusSidebarLayoutProps {
  children?: React.ReactNode;
}

export const CampusSidebarLayout: React.FC<CampusSidebarLayoutProps> = ({ children }) => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [session, setSession] = useState<CampusUserSession>(() => getCampusSession(orgSlug));
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [showUserPopover, setShowUserPopover] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync session if orgSlug changes
  useEffect(() => {
    const curr = getCampusSession(orgSlug);
    if (curr.orgSlug !== orgSlug) {
      curr.orgSlug = orgSlug;
      saveCampusSession(curr);
    }
    setSession(curr);
  }, [orgSlug]);

  // Close popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowUserPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Role Switcher without logging out
  const handleSwitchRole = (newRole: CampusRole) => {
    const preset = DEMO_CAMPUS_ACCOUNTS[newRole];
    const updated: CampusUserSession = {
      ...preset,
      orgSlug,
      orgName: session.orgName || preset.orgName,
    };
    saveCampusSession(updated);
    setSession(updated);
    setShowUserPopover(false);

    if (newRole === 'student') {
      navigate(`/campus/${orgSlug}/student/dashboard`);
    } else if (newRole === 'faculty') {
      navigate(`/campus/${orgSlug}/faculty/dashboard`);
    } else {
      navigate(`/campus/${orgSlug}/admin/dashboard`);
    }
  };

  const handleLogout = () => {
    clearCampusSession();
    navigate(`/campus/${orgSlug}/login`);
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `campus-nav-item${isActive ? ' active' : ''}`;

  return (
    <div className={`campus-shell ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="campus-mobile-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* LEFT 248px COLLAPSIBLE SIDEBAR */}
      <aside
        className={`campus-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Institutional Navigation"
      >
        {/* Sidebar Brand Header */}
        <div className="campus-sidebar-brand">
          <Link to={`/campus/${orgSlug}/student/dashboard`} className="brand-logo-link">
            <div className="brand-logo-icon">
              <GraduationCap size={18} />
            </div>
            {!isCollapsed && (
              <div className="brand-text-block">
                <span className="brand-title">AlgoCeleris</span>
                <span className="brand-org-tag">{orgSlug.toUpperCase()}</span>
              </div>
            )}
          </Link>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Institution Badge Pill */}
        {!isCollapsed && (
          <div className="sidebar-inst-pill">
            <Building2 size={12} />
            <span className="inst-name-text">
              {orgSlug === 'vit-chennai' ? 'VIT Chennai' : orgSlug.toUpperCase()}
            </span>
            <span className="inst-status-dot" title="Campus Active" />
          </div>
        )}

        {/* Navigation Section Trees */}
        <nav className="campus-sidebar-nav">
          {/* STUDENT ROLE NAVIGATION */}
          {session.role === 'student' && (
            <>
              <div className="sidebar-group-title">
                {!isCollapsed && <span>Navigation</span>}
              </div>
              <NavLink to={`/campus/${orgSlug}/student/dashboard`} className={linkClass}>
                <LayoutDashboard size={16} />
                {!isCollapsed && <span>Dashboard</span>}
              </NavLink>

              <div className="sidebar-group-title">
                {!isCollapsed && <span>Lab Exercises</span>}
              </div>
              <NavLink to={`/campus/${orgSlug}/student/labs`} end className={linkClass}>
                <FlaskConical size={16} />
                {!isCollapsed && <span>Active Lab Exercises</span>}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/student/labs/completed`} className={linkClass}>
                <CheckCircle2 size={16} />
                {!isCollapsed && <span>Completed Lab Exercises</span>}
              </NavLink>

              <div className="sidebar-group-title">
                {!isCollapsed && <span>Lab Test (PAT)</span>}
              </div>
              <NavLink to={`/campus/${orgSlug}/student/tests`} end className={linkClass}>
                <FileCode2 size={16} />
                {!isCollapsed && <span>Lab Tests</span>}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/student/tests/completed`} className={linkClass}>
                <Award size={16} />
                {!isCollapsed && <span>Completed Lab Tests</span>}
              </NavLink>

              <div className="sidebar-group-title">
                {!isCollapsed && <span>Learning Analytics</span>}
              </div>
              <NavLink to={`/campus/${orgSlug}/student/analytics/learning-journey`} className={linkClass}>
                <Compass size={16} />
                {!isCollapsed && <span>Learning Journey</span>}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/student/analytics/programming`} className={linkClass}>
                <Cpu size={16} />
                {!isCollapsed && <span>Programming Analytics</span>}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/student/analytics/ai-mentor`} className={linkClass}>
                <Brain size={16} />
                {!isCollapsed && <span>AI Mentor Analytics</span>}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/student/analytics/clo`} className={linkClass}>
                <BarChart3 size={16} />
                {!isCollapsed && <span>CLO Analytics</span>}
              </NavLink>
            </>
          )}

          {/* FACULTY ROLE NAVIGATION */}
          {session.role === 'faculty' && (
            <>
              <div className="sidebar-group-title">
                {!isCollapsed && <span>Faculty Control</span>}
              </div>
              <NavLink to={`/campus/${orgSlug}/faculty/dashboard`} className={linkClass}>
                <LayoutDashboard size={16} />
                {!isCollapsed && <span>Faculty Dashboard</span>}
              </NavLink>

              <div className="sidebar-group-title">
                {!isCollapsed && <span>Course Authoring</span>}
              </div>
              <NavLink to="/campus/assessments/new" className={linkClass}>
                <PlusCircle size={16} />
                {!isCollapsed && (
                  <span className="create-action-label">
                    <span>Create Lab / PAT</span>
                    <span className="new-badge">+ New</span>
                  </span>
                )}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/student/labs`} className={linkClass}>
                <FlaskConical size={16} />
                {!isCollapsed && <span>Manage Lab Exercises</span>}
              </NavLink>

              <div className="sidebar-group-title">
                {!isCollapsed && <span>Live Supervision</span>}
              </div>
              <NavLink to="/campus/assessments/midterm-1/proctor" className={linkClass}>
                <Eye size={16} />
                {!isCollapsed && <span>Proctor Cockpit</span>}
              </NavLink>
              <NavLink to="/campus/assessments/viva/VIVA-CS201-9871" className={linkClass}>
                <Video size={16} />
                {!isCollapsed && <span>Viva Grading Rooms</span>}
              </NavLink>

              <div className="sidebar-group-title">
                {!isCollapsed && <span>Academic Outcomes</span>}
              </div>
              <NavLink to={`/campus/${orgSlug}/faculty/plagiarism`} className={linkClass}>
                <FileCheck2 size={16} />
                {!isCollapsed && <span>AST Plagiarism & CLOs</span>}
              </NavLink>
            </>
          )}

          {/* ORG ADMIN ROLE NAVIGATION */}
          {session.role === 'org_admin' && (
            <>
              <div className="sidebar-group-title">
                {!isCollapsed && <span>Administration</span>}
              </div>
              <NavLink to={`/campus/${orgSlug}/admin/dashboard`} className={linkClass}>
                <LayoutDashboard size={16} />
                {!isCollapsed && <span>Institution Overview</span>}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/admin/roster`} className={linkClass}>
                <Users size={16} />
                {!isCollapsed && <span>Faculty & Student Roster</span>}
              </NavLink>

              <div className="sidebar-group-title">
                {!isCollapsed && <span>License & Security</span>}
              </div>
              <NavLink to="/campus/register" className={linkClass}>
                <CreditCard size={16} />
                {!isCollapsed && <span>License & Seats</span>}
              </NavLink>
              <NavLink to={`/campus/${orgSlug}/admin/audit`} className={linkClass}>
                <Shield size={16} />
                {!isCollapsed && <span>Security & Sandbox Audit</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* BOTTOM USER PROFILE CARD & ROLE POPOVER */}
        <div className="campus-sidebar-footer" ref={popoverRef}>
          {/* User Popover Menu */}
          {showUserPopover && (
            <div className="campus-user-popover" role="menu">
              <div className="popover-header">
                <span className="popover-user-name">{session.name}</span>
                <span className="popover-user-id">{session.regNumber} · {session.role.toUpperCase()}</span>
              </div>

              <div className="popover-section-label">
                <RotateCcw size={12} />
                <span>Switch Portal Role (Demo)</span>
              </div>

              <button
                type="button"
                className={`popover-item ${session.role === 'student' ? 'active' : ''}`}
                onClick={() => handleSwitchRole('student')}
              >
                <div className="role-chip student">Student</div>
                <div className="role-meta">
                  <span>Nishank Chhipa</span>
                  <span className="sub">25BCE1642</span>
                </div>
              </button>

              <button
                type="button"
                className={`popover-item ${session.role === 'faculty' ? 'active' : ''}`}
                onClick={() => handleSwitchRole('faculty')}
              >
                <div className="role-chip faculty">Faculty</div>
                <div className="role-meta">
                  <span>Dr. Saravanan P</span>
                  <span className="sub">FAC-7819</span>
                </div>
              </button>

              <button
                type="button"
                className={`popover-item ${session.role === 'org_admin' ? 'active' : ''}`}
                onClick={() => handleSwitchRole('org_admin')}
              >
                <div className="role-chip admin">Admin</div>
                <div className="role-meta">
                  <span>Dean CSE Office</span>
                  <span className="sub">ADMIN-01</span>
                </div>
              </button>

              <div className="popover-divider" />

              <button
                type="button"
                className="popover-item-link"
                onClick={() => {
                  setShowUserPopover(false);
                  alert('Password change dialog requested.');
                }}
              >
                <KeyRound size={13} />
                <span>Change Password</span>
              </button>

              <button
                type="button"
                className="popover-item-link danger"
                onClick={handleLogout}
              >
                <LogOut size={13} />
                <span>Sign out from {session.orgName || 'Institution'}</span>
              </button>
            </div>
          )}

          {/* User Profile Summary Card */}
          <button
            type="button"
            className="sidebar-user-card"
            onClick={() => setShowUserPopover((prev) => !prev)}
            aria-expanded={showUserPopover}
            aria-haspopup="true"
            title="Account & Role Switcher"
          >
            <div className="user-avatar-badge">{session.initials}</div>
            {!isCollapsed && (
              <div className="user-details-column">
                <span className="user-name-line">{session.name}</span>
                <span className="user-id-line">{session.regNumber}</span>
              </div>
            )}
            {!isCollapsed && <ChevronDown size={14} className="user-expand-icon" />}
          </button>
        </div>
      </aside>

      {/* RIGHT WORKSPACE AREA WITH TOP STATUS BAR */}
      <div className="campus-main-viewport">
        {/* Institutional Top Bar */}
        <header className="campus-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-sidebar-toggle"
              onClick={() => setIsMobileOpen((prev) => !prev)}
              aria-label="Toggle Navigation Drawer"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb / Page Status */}
            <div className="campus-breadcrumbs">
              <span className="breadcrumb-org">{orgSlug.toUpperCase()}</span>
              <ChevronRight size={12} className="breadcrumb-sep" />
              <span className="breadcrumb-role">
                {session.role === 'student' ? 'Student Portal' : session.role === 'faculty' ? 'Faculty Portal' : 'Admin Portal'}
              </span>
              <ChevronRight size={12} className="breadcrumb-sep" />
              <span className="breadcrumb-current">Workspace</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Student ID Pill */}
            <div className="topbar-id-pill" title="Institutional Registration Identifier">
              <span className="id-label">ID:</span>
              <span className="id-val">{session.regNumber}</span>
            </div>

            {/* Role Badge */}
            <div className={`topbar-role-badge ${session.role}`}>
              {session.role === 'student' && '🎓 Student'}
              {session.role === 'faculty' && '👨‍🏫 Faculty'}
              {session.role === 'org_admin' && '👑 Institutional Admin'}
            </div>

            {/* Fast Role Switcher */}
            <button
              type="button"
              className="topbar-role-switch-btn"
              onClick={() => setShowUserPopover((prev) => !prev)}
              title="Switch Role"
            >
              <RotateCcw size={13} />
              <span>Role: {session.role}</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="topbar-theme-btn"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle Color Theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="campus-page-content">
          {children ? children : <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default CampusSidebarLayout;
