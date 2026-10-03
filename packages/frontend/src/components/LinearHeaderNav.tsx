import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Terminal } from 'lucide-react';

interface LinearHeaderNavProps {
  username?: string | null;
}

/** Unified top navigation: routes, live latency indicator, user/guest status. */
export const LinearHeaderNav: React.FC<LinearHeaderNavProps> = ({ username }) => {
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
        {username ? (
          <Link to={`/u/${username}`} className="nav-user" id="nav-user">
            <span className="nav-avatar">{username.charAt(0).toUpperCase()}</span>
            {username}
          </Link>
        ) : (
          <>
            <span className="guest-pill">Guest</span>
            <Link to="/auth/login" className="nav-signin" id="nav-signin">Sign in</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default LinearHeaderNav;
