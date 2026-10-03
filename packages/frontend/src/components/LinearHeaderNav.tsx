import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Terminal, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/** Unified top navigation: routes, live latency indicator, user/guest status. */
export const LinearHeaderNav: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const t0 = performance.now();
      try {
        await fetch('http://localhost:8080/health', { mode: 'no-cors', cache: 'no-store' });
        if (!cancelled) setLatency(Math.round(performance.now() - t0));
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
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="linear-nav" aria-label="Primary">
      <div className="linear-nav-left">
        <Link to="/" className="linear-brand" id="nav-brand">
          <Terminal size={16} />
          <span>Cloud-Judge</span>
        </Link>
        <NavLink to="/problems" className={linkClass} id="nav-problems">Problems</NavLink>
        <NavLink to="/contests" className={linkClass} id="nav-contests">Contests</NavLink>
      </div>
      <div className="linear-nav-right">
        <span className="latency-pill" id="nav-latency" title="Gateway round-trip latency">
          <span className={`latency-dot ${latency === null ? 'offline' : 'online'}`} />
          {latency === null ? 'offline' : `${latency}ms`}
        </span>

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
      </div>
    </nav>
  );
};

export default LinearHeaderNav;
