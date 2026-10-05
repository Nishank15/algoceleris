import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Terminal, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authCheckAvailability, migrateGuestSubmissions } from '../services/api';
import { getGuestSubmissions, clearGuestSubmissions } from '../services/problemService';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode: initialMode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, loginAsGuest } = useAuth();

  const isLogin = initialMode === 'login';
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{ available?: boolean; message?: string; checking?: boolean } | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ available?: boolean; message?: string; checking?: boolean } | null>(null);

  // Debounced username availability check (150ms)
  useEffect(() => {
    if (isLogin || username.trim().length < 3) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await authCheckAvailability({ username: username.trim() });
        setUsernameStatus({
          available: res.available,
          message: res.available ? 'Username available' : 'Username already taken',
        });
      } catch {
        setUsernameStatus(null);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [username, isLogin]);

  // Debounced email availability check (150ms)
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (isLogin || !emailRegex.test(email.trim())) {
      setEmailStatus(null);
      return;
    }
    setEmailStatus({ checking: true });
    const timer = setTimeout(async () => {
      try {
        const res = await authCheckAvailability({ email: email.trim() });
        setEmailStatus({
          available: res.available,
          message: res.available ? 'Email available' : 'Email already registered',
        });
      } catch {
        setEmailStatus(null);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [email, isLogin]);

  // Query parameter redirect support e.g. /auth/login?redirect=/problems
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get('redirect') || '/problems';

  const validate = (): boolean => {
    setError(null);
    if (!isLogin && username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await signup(username.trim(), email.trim(), password);
        // UX-02: Automatic guest submission migration
        const guestSubs = getGuestSubmissions();
        if (guestSubs.length > 0) {
          try {
            await migrateGuestSubmissions(guestSubs);
            clearGuestSubmissions();
          } catch (migrateErr) {
            console.warn('Guest history migration failed:', migrateErr);
          }
        }
      }
      navigate(redirectTarget);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestSignIn = () => {
    loginAsGuest();
    navigate(redirectTarget);
  };

  return (
    <main className="page page-center">
      <section className="carbon-card auth-carbon-card" aria-labelledby="auth-title">
        <div className="auth-card-header">
          <div className="auth-brand-glyph">
            <Terminal size={18} />
          </div>
          <h1 id="auth-title" className="card-title">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="card-sub">
            {isLogin
              ? 'Enter your credentials to access your judge workspace.'
              : 'Join Cloud-Judge to track submissions and contest ratings.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tab-switch">
          <Link
            to="/auth/login"
            className={`auth-tab-btn ${isLogin ? 'active' : ''}`}
            id="tab-signin"
          >
            Sign in
          </Link>
          <Link
            to="/auth/signup"
            className={`auth-tab-btn ${!isLogin ? 'active' : ''}`}
            id="tab-signup"
          >
            Sign up
          </Link>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form className="card-form" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="form-field-group">
              <label htmlFor="auth-username" className="field-label">Username</label>
              <input
                className="field"
                id="auth-username"
                type="text"
                placeholder="developer_handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
              {!isLogin && usernameStatus && (
                <div
                  className={`auth-field-badge ${
                    usernameStatus.checking
                      ? 'auth-badge-checking'
                      : usernameStatus.available
                      ? 'auth-badge-available'
                      : 'auth-badge-taken'
                  }`}
                  id="username-availability-badge"
                >
                  {usernameStatus.checking ? (
                    <span>Checking availability...</span>
                  ) : usernameStatus.available ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>{usernameStatus.message || 'Available'}</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} />
                      <span>{usernameStatus.message || 'Already taken'}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="form-field-group">
            <label htmlFor="auth-email" className="field-label">Email address</label>
            <input
              className="field"
              id="auth-email"
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {!isLogin && emailStatus && (
              <div
                className={`auth-field-badge ${
                  emailStatus.checking
                    ? 'auth-badge-checking'
                    : emailStatus.available
                    ? 'auth-badge-available'
                    : 'auth-badge-taken'
                }`}
                id="email-availability-badge"
              >
                {emailStatus.checking ? (
                  <span>Checking availability...</span>
                ) : emailStatus.available ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>{emailStatus.message || 'Available'}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} />
                    <span>{emailStatus.message || 'Already registered'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="form-field-group">
            <label htmlFor="auth-password" className="field-label">Password</label>
            <input
              className="field"
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </div>

          <button
            className="btn btn-primary auth-submit-btn"
            id="auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Authenticating...' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span className="auth-divider-text">or</span>
          <span className="auth-divider-line" />
        </div>

        <button
          type="button"
          className="btn btn-secondary auth-guest-btn"
          id="auth-guest"
          onClick={handleGuestSignIn}
        >
          Continue as guest
        </button>

        <p className="card-foot">
          {isLogin ? (
            <>
              Don't have an account? <Link to="/auth/signup">Sign up</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/auth/login">Sign in</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
};

export default AuthPage;
