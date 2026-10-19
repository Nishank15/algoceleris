import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  campusLogin,
  listCampusOrgs,
  CampusOrgSummary,
  setAccessToken,
} from '../../services/api';
import { saveCampusSession, CampusRole } from '../../services/campusSession';
import {
  Building2,
  Lock,
  User,
  ShieldAlert,
  ArrowRight,
  GraduationCap,
  Users,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

export const CampusLoginPage: React.FC = () => {
  const { orgSlug = 'vit-chennai' } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<CampusOrgSummary | null>(null);
  const [role, setRole] = useState<CampusRole>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadOrgInfo() {
      try {
        setLoadingOrg(true);
        const orgs = await listCampusOrgs();
        if (isMounted) {
          const match = orgs.find(
            (o) => o.slug.toLowerCase() === orgSlug.toLowerCase()
          );
          if (match) {
            setOrg(match);
          } else {
            // Synthesize fallback org info if slug matches format
            setOrg({
              id: '00000000-0000-0000-0000-000000000000',
              name: orgSlug.toUpperCase().replace('-', ' '),
              slug: orgSlug,
              domain_whitelist: ['ac.in', 'edu'],
              tier: 'Enterprise Campus',
              student_count: 500,
              faculty_count: 20,
              created_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.debug('Could not fetch org list:', err);
      } finally {
        if (isMounted) {
          setLoadingOrg(false);
        }
      }
    }
    loadOrgInfo();
    return () => {
      isMounted = false;
    };
  }, [orgSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('Please enter your institutional email or ID.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const resp = await campusLogin({
        org_slug: orgSlug,
        identifier: identifier.trim(),
        password: password.trim(),
        role,
      });

      // Save session and token
      setAccessToken(resp.access_token);
      saveCampusSession({
        role: (resp.user.role as CampusRole) || role,
        orgSlug: resp.user.org_slug || orgSlug,
        orgName: resp.user.org_name || org?.name || 'Institutional Campus',
        userId: resp.user.user_id,
        name: resp.user.username,
        loginId: resp.user.email,
        regNumber: resp.user.reg_number || 'DEMO-001',
        department: resp.user.cohort_name || 'Computer Science & Engineering',
        initials: (resp.user.username || 'US').slice(0, 2).toUpperCase(),
        token: resp.access_token,
        cohortId: resp.user.cohort_id,
        cohortName: resp.user.cohort_name,
      });

      // Navigate to destination role dashboard
      const targetRole = (resp.user.role as CampusRole) || role;
      if (targetRole === 'student') {
        navigate(`/campus/${orgSlug}/student/dashboard`);
      } else if (targetRole === 'faculty') {
        navigate(`/campus/${orgSlug}/faculty/dashboard`);
      } else {
        navigate(`/campus/${orgSlug}/admin/dashboard`);
      }
    } catch (err: any) {
      console.error('Campus login failed:', err);
      setErrorMessage(
        err.message || 'Authentication failed. Please verify credentials.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%' }}>
        {/* University Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'JetBrains Mono, monospace',
              marginBottom: '16px',
            }}
          >
            <Building2 size={12} style={{ color: '#e4f222' }} />
            <span>tenant /{orgSlug}</span>
          </div>

          <h1
            style={{
              fontSize: '28px',
              fontWeight: 590,
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            {loadingOrg ? 'Loading Campus...' : org?.name || 'Institutional Portal'}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: 1.4 }}>
            Multi-Tenant Sandboxed Lab & Proctoring Authentication Gateway
          </p>
        </div>

        {/* Login Card */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Segmented 3-Way Role Switcher */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: 'var(--bg-elevated)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '24px',
            }}
          >
            {(
              [
                { id: 'student', label: 'Student', icon: GraduationCap },
                { id: 'faculty', label: 'Faculty', icon: Users },
                { id: 'org_admin', label: 'Admin', icon: ShieldCheck },
              ] as const
            ).map((item) => {
              const active = role === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRole(item.id);
                    setErrorMessage(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 0',
                    border: 'none',
                    borderRadius: '6px',
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: active ? 590 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={13} style={{ color: active ? '#e4f222' : 'inherit' }} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(235, 87, 87, 0.1)',
                border: '1px solid rgba(235, 87, 87, 0.3)',
                borderRadius: '6px',
                padding: '10px 12px',
                color: '#eb5757',
                fontSize: '12px',
                marginBottom: '20px',
              }}
            >
              <ShieldAlert size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 510,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                {role === 'student'
                  ? 'Registration Number or Student Email'
                  : role === 'faculty'
                  ? 'Faculty ID or Academic Email'
                  : 'Institutional Admin Email'}
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={14}
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
                  placeholder={
                    role === 'student'
                      ? 'e.g. DEMO-001 or student1@vitstudent.ac.in'
                      : role === 'faculty'
                      ? 'e.g. FAC-VIT-01 or demofaculty@vit.ac.in'
                      : 'admin@vit.ac.in'
                  }
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 12px 10px 34px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {org?.domain_whitelist && org.domain_whitelist.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Whitelisted:</span>
                  {org.domain_whitelist.map((d) => (
                    <span
                      key={d}
                      style={{
                        fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--text-secondary)',
                        background: 'rgba(35, 37, 42, 0.4)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                      }}
                    >
                      @{d}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 510,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 36px 10px 34px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: '10px',
                width: '100%',
                background: 'var(--accent-primary)',
                color: 'var(--accent-primary-fg)',
                border: 'none',
                padding: '11px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 590,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? (
                'Authenticating with Tenant...'
              ) : (
                <>
                  Sign In to Institutional Portal <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Institution Switcher Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          Not from this university?{' '}
          <Link
            to="/campus"
            style={{
              color: '#e4f222',
              textDecoration: 'none',
              fontWeight: 510,
            }}
          >
            Switch Institution Directory →
          </Link>
        </div>
      </div>
    </div>
  );
};
export default CampusLoginPage;
