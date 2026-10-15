import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  Sparkles,
  Cpu,
  Brain,
  BarChart3,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  User,
  Shield,
  ArrowRight,
  School,
  Building2,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  CampusRole,
  DEMO_CAMPUS_ACCOUNTS,
  saveCampusSession,
  CampusUserSession,
} from '../../services/campusSession';

interface OrgBranding {
  name: string;
  fullName: string;
  acronym: string;
  location: string;
  accent: string;
}

const ORG_PRESETS: Record<string, OrgBranding> = {
  'vit-chennai': {
    name: 'VIT CHENNAI',
    fullName: 'Vellore Institute of Technology, Chennai',
    acronym: 'VIT',
    location: 'Vandalur-Kelambakkam Road, Chennai',
    accent: '#3b82f6',
  },
  iitm: {
    name: 'IIT MADRAS',
    fullName: 'Indian Institute of Technology Madras',
    acronym: 'IITM',
    location: 'Sardar Patel Road, Chennai',
    accent: '#f59e0b',
  },
  nitt: {
    name: 'NIT TRICHY',
    fullName: 'National Institute of Technology, Tiruchirappalli',
    acronym: 'NITT',
    location: 'Thuvakudi, Tiruchirappalli',
    accent: '#10b981',
  },
};

export const CampusLoginPage: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const navigate = useNavigate();

  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const branding: OrgBranding = ORG_PRESETS[orgSlug] || {
    name: orgSlug.toUpperCase(),
    fullName: `${orgSlug.toUpperCase()} Engineering Institute`,
    acronym: orgSlug.slice(0, 4).toUpperCase(),
    location: 'University Campus',
    accent: '#3b82f6',
  };

  const [selectedRole, setSelectedRole] = useState<CampusRole>('student');
  const [loginId, setLoginId] = useState<string>('nishank.chhipa2025@vitstudent.ac.in');
  const [password, setPassword] = useState<string>('••••••••••••');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // 1-Click Demo autofill handler
  const handleAutofillDemo = (role: CampusRole) => {
    const preset = DEMO_CAMPUS_ACCOUNTS[role];
    setSelectedRole(role);
    setLoginId(preset.loginId);
    setPassword('demopassword123');
    setNotification(`Autofilled credentials for ${preset.name} (${preset.role.toUpperCase()})`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Perform login submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const preset = DEMO_CAMPUS_ACCOUNTS[selectedRole];
    const session: CampusUserSession = {
      role: selectedRole,
      orgSlug,
      orgName: branding.fullName,
      name: loginId.toLowerCase().includes('saravanan')
        ? 'Dr. SARAVANAN P'
        : loginId.toLowerCase().includes('dean')
        ? 'Dean CSE Office'
        : preset.name,
      loginId: loginId.trim(),
      regNumber: selectedRole === 'student' ? '25BCE1642' : selectedRole === 'faculty' ? 'FAC-7819' : 'ADMIN-01',
      department: preset.department,
      initials: selectedRole === 'student' ? 'NC' : selectedRole === 'faculty' ? 'SP' : 'DC',
    };

    saveCampusSession(session);

    setTimeout(() => {
      setIsLoading(false);
      if (selectedRole === 'student') {
        navigate(`/campus/${orgSlug}/student/dashboard`);
      } else if (selectedRole === 'faculty') {
        navigate(`/campus/${orgSlug}/faculty/dashboard`);
      } else {
        navigate(`/campus/${orgSlug}/admin/dashboard`);
      }
    }, 400);
  };

  const roleLabel =
    selectedRole === 'student'
      ? 'Student'
      : selectedRole === 'faculty'
      ? 'Faculty'
      : 'Institution Admin';

  return (
    <div className="campus-login-container">
      {/* LEFT 50% PANEL: Royal Blue Architectural Showcase */}
      <section className="campus-login-left">
        <div className="campus-blueprint-overlay" />

        <div className="campus-login-left-content">
          {/* Co-Branded Header */}
          <div className="campus-cobrand-header">
            <Link to="/campus" className="campus-cobrand-brand">
              <div className="campus-brand-symbol">
                <GraduationCap size={20} />
              </div>
              <span className="brand-name">AlgoCeleris</span>
            </Link>
            <div className="campus-cobrand-divider">/</div>
            <div className="campus-cobrand-institution">
              <div className="inst-badge-chip">
                <Building2 size={13} />
                <span>{branding.name}</span>
              </div>
              <span className="inst-full-name">{branding.fullName}</span>
            </div>
          </div>

          {/* Hero Section */}
          <div className="campus-login-hero">
            <div className="campus-copilot-pill">
              <Sparkles size={14} className="accent-sparkle" />
              <span>Your AI Co-Pilot for Programming Labs</span>
            </div>

            <h1 className="campus-login-title">
              Master Programming With Your <span className="highlight-text">AI Learning Companion</span>
            </h1>

            <p className="campus-login-description">
              Practice lab exercises, get instant feedback on your code, and grow from understanding
              concepts to mastering programming skills with LPilot pedagogy.
            </p>
          </div>

          {/* 2x2 Feature Grid */}
          <div className="campus-feature-grid">
            <div className="campus-feature-item">
              <div className="feature-icon-box blue">
                <Brain size={18} />
              </div>
              <div>
                <h4 className="feature-title">AI Mentor</h4>
                <p className="feature-sub">Personalized guidance, Socratic hints & debugging cues</p>
              </div>
            </div>

            <div className="campus-feature-item">
              <div className="feature-icon-box green">
                <Cpu size={18} />
              </div>
              <div>
                <h4 className="feature-title">Smart Evaluation</h4>
                <p className="feature-sub">Kernel-isolated cgroups sandboxes with instant verdicts</p>
              </div>
            </div>

            <div className="campus-feature-item">
              <div className="feature-icon-box purple">
                <Code2Icon />
              </div>
              <div>
                <h4 className="feature-title">Adaptive Practice</h4>
                <p className="feature-sub">Section-locked workspaces & algorithmic challenges</p>
              </div>
            </div>

            <div className="campus-feature-item">
              <div className="feature-icon-box amber">
                <BarChart3 size={18} />
              </div>
              <div>
                <h4 className="feature-title">Learning Analytics</h4>
                <p className="feature-sub">Track CLO attainment, programming velocity & time</p>
              </div>
            </div>
          </div>

          {/* Bottom Security Assurance */}
          <div className="campus-security-footer">
            <Shield size={14} />
            <span>Dedicated Multi-Tenant Institutional Sandbox · FERPA & SOC-2 Invariant</span>
          </div>
        </div>
      </section>

      {/* RIGHT 50% PANEL: Obsidian Portal Login */}
      <section className="campus-login-right">
        <div className="campus-login-form-wrapper">
          {/* Top Portal Mode Pill */}
          <div className="campus-mode-pill-container">
            <span className="mode-pill-dot" />
            <span className="mode-pill-text">{roleLabel} Portal Active</span>
            <span className="mode-pill-org">({branding.acronym})</span>
          </div>

          <div className="campus-form-header">
            <h2 className="campus-form-title">Welcome back</h2>
            <p className="campus-form-subtitle">
              Access your courses, lab sessions, and programming assessments
            </p>
          </div>

          {/* Role Segmented Switcher */}
          <div className="campus-role-switcher" role="tablist">
            <button
              type="button"
              className={`campus-role-btn ${selectedRole === 'student' ? 'active' : ''}`}
              onClick={() => handleAutofillDemo('student')}
              role="tab"
              aria-selected={selectedRole === 'student'}
            >
              <User size={14} />
              <span>Student</span>
            </button>
            <button
              type="button"
              className={`campus-role-btn ${selectedRole === 'faculty' ? 'active' : ''}`}
              onClick={() => handleAutofillDemo('faculty')}
              role="tab"
              aria-selected={selectedRole === 'faculty'}
            >
              <GraduationCap size={14} />
              <span>Faculty</span>
            </button>
            <button
              type="button"
              className={`campus-role-btn ${selectedRole === 'org_admin' ? 'active' : ''}`}
              onClick={() => handleAutofillDemo('org_admin')}
              role="tab"
              aria-selected={selectedRole === 'org_admin'}
            >
              <Shield size={14} />
              <span>Admin</span>
            </button>
          </div>

          {/* Notification Banner */}
          {notification && (
            <div className="campus-notification-banner" role="status">
              <CheckCircle2 size={14} />
              <span>{notification}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="campus-login-form">
            <div className="form-group">
              <label htmlFor="campus-login-id" className="form-label">
                Login ID / Registration Number
              </label>
              <div className="input-with-icon">
                <input
                  id="campus-login-id"
                  type="text"
                  className="form-input"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. 25BCE1642 or email address"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="campus-password" className="form-label">
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Please contact your university IT department or campus administrator.');
                  }}
                  className="form-forgot-link"
                >
                  Forgot password?
                </a>
              </div>
              <div className="input-with-icon">
                <input
                  id="campus-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-options-row">
              <label className="remember-me-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember this workstation</span>
              </label>
            </div>

            <div className="form-actions-stack">
              <button
                type="submit"
                className="btn btn-primary campus-submit-btn"
                disabled={isLoading}
              >
                <span>{isLoading ? 'Authenticating...' : `Sign in as ${roleLabel}`}</span>
                <ArrowRight size={15} />
              </button>

              <button
                type="button"
                className="btn btn-secondary campus-first-time-btn"
                onClick={() => {
                  alert(
                    'First Time Login: Please use your university registration number and the temporary password sent to your official campus email.'
                  );
                }}
              >
                First Time Login
              </button>
            </div>
          </form>

          {/* Quick Demo Credentials Bar */}
          <div className="campus-demo-bar">
            <div className="demo-bar-title">
              <Info size={12} />
              <span>1-Click Evaluator Demo Credentials</span>
            </div>
            <div className="demo-pills-row">
              <button
                type="button"
                className={`demo-pill ${selectedRole === 'student' ? 'active' : ''}`}
                onClick={() => handleAutofillDemo('student')}
                title="Log in as Student Nishank Chhipa (25BCE1642)"
              >
                🎓 Demo Student: Nishank
              </button>
              <button
                type="button"
                className={`demo-pill ${selectedRole === 'faculty' ? 'active' : ''}`}
                onClick={() => handleAutofillDemo('faculty')}
                title="Log in as Faculty Dr. Saravanan P"
              >
                👨‍🏫 Demo Faculty: Dr. Saravanan
              </button>
              <button
                type="button"
                className={`demo-pill ${selectedRole === 'org_admin' ? 'active' : ''}`}
                onClick={() => handleAutofillDemo('org_admin')}
                title="Log in as Dean CSE / Institution Administrator"
              >
                👑 Demo Admin: Dean CSE
              </button>
            </div>
          </div>

          {/* Footer Backlink */}
          <div className="campus-login-foot">
            <Link to="/campus" className="campus-back-link">
              &larr; Switch Institution or View Public Portal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

// Compact icon helper
function Code2Icon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
export default CampusLoginPage;
