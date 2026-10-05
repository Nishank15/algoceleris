import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PROBLEMS } from '../constants/problems';
import { getAttemptedProblemIds, getSolvedProblemIds } from '../services/problemService';
import { IsometricHeatmap } from '../components/IsometricHeatmap';
import { getUserProfile, UserProfileResponse } from '../services/api';
import type { Difficulty } from '../types';

const DIFF_COLORS: Record<Difficulty, string> = {
  Easy: '#27a644',
  Medium: '#f59e0b',
  Hard: '#eb5757',
};

const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const rankTitle = (rating: number): string =>
  rating >= 2400 ? 'Grandmaster' : rating >= 2000 ? 'Guardian' : rating >= 1600 ? 'Knight' : 'Challenger';

const relativeTime = (hoursAgo: number): string =>
  hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;

const LANGS = ['Python', 'C++', 'Java', 'TypeScript'];

export const ProfilePage: React.FC = () => {
  const { username = 'developer' } = useParams<{ username: string }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [solved, setSolved] = useState<Set<string>>(() => getSolvedProblemIds());
  const [attempted, setAttempted] = useState<Set<string>>(() => getAttemptedProblemIds());

  useEffect(() => {
    const sync = () => {
      setSolved(getSolvedProblemIds());
      setAttempted(getAttemptedProblemIds());
    };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    getUserProfile(username)
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || `User '${username}' not found`);
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [username]);

  const recent = useMemo(() => {
    const h = hashString(username);
    const ids = [...Array.from(solved), ...Array.from(attempted).filter((id) => !solved.has(id))];
    return ids
      .map((id, i) => {
        const p = PROBLEMS.find((x) => x.id === id);
        if (!p) return null;
        return {
          p,
          accepted: solved.has(id),
          lang: LANGS[(h + i) % LANGS.length],
          hoursAgo: 2 + ((h >> (i % 8)) % 6) * 9 + i * 7,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 8);
  }, [solved, attempted, username]);

  if (isLoading) {
    return (
      <main className="profile-page-root">
        <div className="profile-loading-state">
          <p style={{ color: '#8a8f98', margin: 0 }}>Loading developer profile...</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="profile-page-root">
        <div className="profile-error-state">
          <h2>User not found</h2>
          <p>{error || `The user @${username} does not exist.`}</p>
          <Link to="/problems" className="contest-btn primary">
            Back to Problems
          </Link>
        </div>
      </main>
    );
  }

  const isSelf = user.username.toLowerCase() === profile.username.toLowerCase();
  const isPro = profile.account_type === 'pro' || profile.account_type === 'admin';
  const h = hashString(profile.username);

  const breakdown = profile.stats.difficulty_breakdown || {
    Easy: { total: 0, solved: 0 },
    Medium: { total: 0, solved: 0 },
    Hard: { total: 0, solved: 0 },
  };

  const totalSolved = profile.stats.total_solved;
  const totalProblems = profile.stats.total_problems;

  const history = profile.stats.rating_history || [];
  const hasHistory = history.length > 0;
  const currentRating = profile.stats.current_rating || 1500;
  const percentile = (profile.stats.percentile ?? 50).toFixed(1);

  const contributions = profile.stats.daily_contributions || [];

  // Rating chart geometry
  const CW = 560;
  const CH = 160;
  const pad = 14;
  const ratings = hasHistory ? history.map((x) => x.rating) : [currentRating];
  const min = Math.min(...ratings) - 40;
  const max = Math.max(...ratings) + 40;
  const pts = hasHistory
    ? history.map((x, i) => {
        const px = history.length > 1 ? pad + (i / (history.length - 1)) * (CW - pad * 2) : CW / 2;
        const py = CH - pad - ((x.rating - min) / Math.max(1, max - min)) * (CH - pad * 2);
        return [px, py] as const;
      })
    : [];
  const line = pts.length > 1
    ? pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    : '';
  const area = pts.length > 1
    ? `${line} L${pts[pts.length - 1][0]},${CH} L${pts[0][0]},${CH} Z`
    : '';

  // Solved ring geometry
  const R = 52;
  const C = 2 * Math.PI * R;
  const frac = totalProblems ? totalSolved / totalProblems : 0;

  const joined = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <main className="profile-page-root">
      <section className="profile-hero-card">
        <div className="profile-avatar" aria-hidden="true" style={{ ['--hue' as string]: String(h % 360) }}>
          {initials}
        </div>
        <div className="profile-hero-main">
          <div className="profile-name-row">
            <h1 className="profile-username">{profile.username}</h1>
            {isSelf && (
              <span style={{ fontSize: '0.72rem', color: '#8a8f98', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
                You
              </span>
            )}
            <span className={`profile-tier-badge ${isPro ? 'pro' : 'free'}`}>
              {profile.account_type.toUpperCase()}
            </span>
            {profile.college_name && (
              <span style={{ fontSize: '0.8rem', color: '#8a8f98' }}>· {profile.college_name}</span>
            )}
          </div>
          <p className="profile-bio">
            Competitive programmer. Sharpening algorithms one accepted submission at a time.
          </p>
          <p className="profile-joined">Joined {joined}</p>
        </div>
        <dl className="profile-hero-stats">
          <div>
            <dt>Global rank</dt>
            <dd>#{(1000 + (h % 9000)).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Problems Solved</dt>
            <dd>{totalSolved}</dd>
          </div>
          <div>
            <dt>Contest Rating</dt>
            <dd>{currentRating.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <div className="profile-grid">
        <section className="profile-card" aria-labelledby="solved-title">
          <h2 id="solved-title" className="profile-card-title">Solved problems</h2>
          <div className="solved-ring-container">
            <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={`${totalSolved} of ${totalProblems} solved`}>
              <circle cx="70" cy="70" r={R} className="ring-track" />
              <circle
                cx="70"
                cy="70"
                r={R}
                className="ring-progress"
                strokeDasharray={`${C * frac} ${C}`}
                transform="rotate(-90 70 70)"
              />
              <text x="70" y="68" textAnchor="middle" className="ring-count">{totalSolved}</text>
              <text x="70" y="86" textAnchor="middle" className="ring-total">/ {totalProblems}</text>
            </svg>
            <ul className="solved-breakdown">
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => {
                const b = breakdown[d] || { total: 0, solved: 0 };
                const pct = b.total ? (b.solved / b.total) * 100 : 0;
                return (
                  <li key={d}>
                    <div className="solved-breakdown-row">
                      <span style={{ color: DIFF_COLORS[d] }}>{d}</span>
                      <span>{b.solved} / {b.total}</span>
                    </div>
                    <div className="solved-bar">
                      <span style={{ width: `${pct}%`, background: DIFF_COLORS[d] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="profile-card" aria-labelledby="rating-title">
          <h2 id="rating-title" className="profile-card-title">Contest rating</h2>
          <div className="rating-summary">
            <span className="rating-value">{currentRating.toLocaleString()}</span>
            <span className="rating-meta">
              {hasHistory ? `Top ${percentile}% · ${rankTitle(currentRating)}` : rankTitle(currentRating)}
            </span>
          </div>
          <div className="rating-chart-container">
            {history.length > 1 ? (
              <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label="Contest rating history">
                <defs>
                  <linearGradient id="rating-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#27a644" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#27a644" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#rating-area)" />
                <path d={line} className="rating-line" />
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="3" className="rating-dot">
                    <title>{`${history[i].contest_name}: ${history[i].rating}`}</title>
                  </circle>
                ))}
              </svg>
            ) : (
              <div className="rating-empty-state">No contest rating history yet</div>
            )}
          </div>
        </section>
      </div>

      <section className="profile-card" aria-labelledby="activity-title">
        <h2 id="activity-title" className="profile-card-title">Contribution Activity &amp; 3D Skyline</h2>
        <div className="skyline-shell">
          <IsometricHeatmap
            data={contributions}
            palette="github"
            defaultView="3d"
            unit="submission"
            title={<span className="skyline-title">Submissions in the last year</span>}
          />
        </div>
      </section>

      <section className="profile-card" aria-labelledby="recent-title">
        <h2 id="recent-title" className="profile-card-title">Recent submissions</h2>
        <ul className="recent-list">
          {recent.map(({ p, accepted, lang, hoursAgo }) => (
            <li key={p.id} className="recent-row">
              <Link to={`/problems/${p.id}`} className="recent-title">{p.title}</Link>
              <span className="recent-pill" style={{ color: DIFF_COLORS[p.difficulty], borderColor: DIFF_COLORS[p.difficulty] }}>
                {p.difficulty}
              </span>
              <span className={`recent-status ${accepted ? 'ok' : 'wip'}`}>{accepted ? 'Accepted' : 'Attempted'}</span>
              <span className="recent-lang">{lang}</span>
              <span className="recent-time">{relativeTime(hoursAgo)}</span>
            </li>
          ))}
          {recent.length === 0 && <li className="recent-empty">No submissions yet.</li>}
        </ul>
      </section>
    </main>
  );
};

export default ProfilePage;
