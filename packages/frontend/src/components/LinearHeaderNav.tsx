import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Terminal, LogOut, Sun, Moon, Menu, X, Code2, Trophy, User, LogIn, Rocket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/** Unified top navigation: routes, live latency indicator, user/guest status. */
export const LinearHeaderNav: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [latency, setLatency] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith('/campus') || location.pathname.startsWith('/portal')) {
      return;
    }
    let cancelled = false;
    const ping = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/v1/health', { cache: 'no-store' });
        if (res.ok && !cancelled) {
          setLatency(Math.round(performance.now() - t0));
        } else if (!cancelled) {
          setLatency(null);
        }
      } catch {
        if (!cancelled) setLatency(null);
      }
    };
    ping();
    const id = window.setInterval(ping, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [location.pathname]);

  // Standalone Institutional Campus Platform uses dedicated CampusSidebarLayout, hide consumer header
  if (location.pathname.startsWith('/campus') || location.pathname.startsWith('/portal')) {
    return null;
  }

  const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <nav className="linear-nav" aria-label="Primary">
        <div className="linear-nav-left">
          <Link to="/" className="linear-brand" id="nav-brand">
            <Terminal size={16} />
            <span>Cloud-Judge</span>
          </Link>
          <NavLink to="/problems" className={linkClass} id="nav-problems">Problems</NavLink>
          <NavLink to="/contests" className={linkClass} id="nav-contests">Contests</NavLink>
          <NavLink to="/hackathons" className={linkClass} id="nav-hackathons">Hackathons</NavLink>
        </div>
        <div className="linear-nav-right">
          <span className="latency-pill" id="nav-latency" title="Gateway round-trip latency">
            <span className={`latency-dot ${latency === null ? 'offline' : 'online'}`} />
            {latency === null ? 'offline' : `${latency}ms`}
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            className="nav-theme-toggle theme-toggle-btn"
            id="nav-theme-toggle"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {user && !user.isGuest ? (
            <div className="nav-user-cluster">
              <Link to={`/u/${user.username}`} className="nav-user" id="nav-user">
                <span className="nav-avatar">{user.username.charAt(0).toUpperCase()}</span>
                <span>{user.username}</span>
              </Link>
              {user.tier === 'pro' && <span className="pro-badge-mini">PRO</span>}
              <button
                onClick={handleSignOut}
                className="nav-logout-btn"
                title="Sign out"
                id="nav-logout"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <div className="nav-guest-cluster">
              <span className="guest-pill">Guest</span>
              <Link to="/auth/login" className="nav-signin" id="nav-signin">Sign in</Link>
            </div>
          )}

          {/* Mobile Navigation Drawer Trigger (< 768px) */}
          <button
            type="button"
            className="mobile-nav-toggle"
            id="mobile-nav-toggle"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Sheet */}
      {isMobileMenuOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside
            className="mobile-nav-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            <div className="mobile-nav-sheet-header">
              <div className="linear-brand">
                <Terminal size={16} />
                <span>Cloud-Judge</span>
              </div>
              <button
                type="button"
                className="mobile-nav-close"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close navigation"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="mobile-nav-sheet-body">
              <NavLink
                to="/problems"
                className={linkClass}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Code2 size={16} />
                <span>Problems</span>
              </NavLink>
              <NavLink
                to="/contests"
                className={linkClass}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Trophy size={16} />
                <span>Contests</span>
              </NavLink>
              <NavLink
                to="/hackathons"
                className={linkClass}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Rocket size={16} />
                <span>Hackathons</span>
              </NavLink>
              {user && !user.isGuest ? (
                <>
                  <NavLink
                    to={`/u/${user.username}`}
                    className={linkClass}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <User size={16} />
                    <span>Profile ({user.username})</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="mobile-nav-sheet-logout"
                  >
                    <LogOut size={14} />
                    <span>Sign out</span>
                  </button>
                </>
              ) : (
                <NavLink
                  to="/auth/login"
                  className={linkClass}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <LogIn size={16} />
                  <span>Sign In / Register</span>
                </NavLink>
              )}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
};

export default LinearHeaderNav;
