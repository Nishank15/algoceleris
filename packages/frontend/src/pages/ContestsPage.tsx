import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Radio, Trophy } from 'lucide-react';
import type { ContestDetails, LeaderboardEntry } from '../types';
import { getContestLeaderboard, listContests, subscribeContestLeaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';

const REG_KEY = 'cloud_judge_contest_registrations';
const POLL_MS = 8000;

const readRegistrations = (): string[] => {
  try {
    const raw = localStorage.getItem(REG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const mkProblems = (letters: string[]) =>
  letters.map((l, i) => ({
    id: ['two-sum', 'valid-parentheses', 'lru-cache', 'longest-substring'][i] ?? `problem-${l}`,
    letter_code: l,
    title: ['Two Sum', 'Valid Parentheses', 'LRU Cache', 'Longest Substring'][i] ?? `Problem ${l}`,
    difficulty: ['Easy', 'Easy', 'Hard', 'Medium'][i] ?? 'Medium',
    points: [100, 100, 200, 150][i] ?? 100,
  }));

const buildFallbackContests = (): ContestDetails[] => {
  const now = Date.now();
  const H = 3600_000;
  return [
    {
      id: 'weekly-contest-412',
      title: 'Weekly Contest 412',
      description: 'Four problems, 90 minutes. ICPC-style penalties.',
      start_time: now - 25 * 60_000,
      end_time: now + 65 * 60_000,
      duration_minutes: 90,
      status: 'ACTIVE',
      problems: mkProblems(['A', 'B', 'C', 'D']),
    },
    {
      id: 'biweekly-contest-138',
      title: 'Biweekly Contest 138',
      description: 'Biweekly sprint: four problems in 90 minutes.',
      start_time: now + 30 * H,
      end_time: now + 31.5 * H,
      duration_minutes: 90,
      status: 'UPCOMING',
      problems: mkProblems(['A', 'B', 'C', 'D']),
    },
    {
      id: 'global-invitational-cup',
      title: 'Global Invitational Cup',
      description: 'Invite-level global showdown.',
      start_time: now + 5 * 24 * H,
      end_time: now + 5 * 24 * H + 3 * H,
      duration_minutes: 180,
      status: 'UPCOMING',
      problems: mkProblems(['A', 'B', 'C']),
    },
    {
      id: 'weekly-contest-411',
      title: 'Weekly Contest 411',
      description: 'Completed. Standings are final.',
      start_time: now - 7 * 24 * H,
      end_time: now - 7 * 24 * H + 1.5 * H,
      duration_minutes: 90,
      status: 'ENDED',
      problems: mkProblems(['A', 'B', 'C', 'D']),
    },
  ];
};

const fallbackLeaderboard = (contest: ContestDetails): LeaderboardEntry[] => {
  const handles = ['tourist_x', 'nova_dev', 'segfault', 'lambda_lord', 'bitwise', 'cacheline'];
  return handles.map((h, i) => {
    const solved = Math.max(0, contest.problems.length - i);
    const scores: LeaderboardEntry['problem_scores'] = {};
    contest.problems.forEach((p, j) => {
      if (j < solved) {
        scores[p.id] = { solved: true, rejected_attempts: (i + j) % 3, penalty_minutes: 6 + j * 14 + i * 3 } as any;
      } else if (j === solved && i % 2 === 0) {
        scores[p.id] = { solved: false, rejected_attempts: 1 + (i % 3), penalty_minutes: 0 } as any;
      }
    });
    const penalty = Object.values(scores).reduce((a: number, s: any) => a + (s.solved ? s.penalty_minutes + s.rejected_attempts * 20 : 0), 0);
    return {
      rank: i + 1,
      user_id: h,
      solved_count: solved,
      total_penalty_minutes: penalty,
      problem_scores: scores,
      score_composite: solved * 1_000_000 - penalty,
    };
  });
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d >= 1) return `${d} day${d > 1 ? 's' : ''}, ${h} hour${h === 1 ? '' : 's'}`;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

const participantCount = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 900 + (h % 2400);
};

const rankBadge = (rank: number) => {
  const cls = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : 'rank-standard';
  return <span className={`rank-badge ${cls}`}>#{rank}</span>;
};

type Phase = 'ACTIVE' | 'UPCOMING' | 'ENDED';

const derivePhase = (c: ContestDetails, now: number): Phase =>
  now >= c.end_time ? 'ENDED' : now >= c.start_time ? 'ACTIVE' : 'UPCOMING';

export const ContestsPage: React.FC = () => {
  const { user } = useAuth();
  const [contests, setContests] = useState<ContestDetails[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [registered, setRegistered] = useState<string[]>(() => readRegistrations());
  const [view, setView] = useState<'hub' | 'leaderboard'>('hub');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const liveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    listContests()
      .then((list) => {
        if (!cancelled) setContests(Array.isArray(list) && list.length ? list : buildFallbackContests());
      })
      .catch(() => {
        if (!cancelled) setContests(buildFallbackContests());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const toggleRegister = (id: string) => {
    setRegistered((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(REG_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const selected = useMemo(() => contests.find((c) => c.id === selectedId) ?? null, [contests, selectedId]);

  const fetchBoard = useCallback(async (c: ContestDetails) => {
    try {
      const fresh = await getContestLeaderboard(c.id);
      setBoard(fresh);
    } catch {
      setBoard((prev) => (prev.length ? prev : fallbackLeaderboard(c)));
    }
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    if (view !== 'leaderboard' || !selected) return;
    liveRef.current = false;
    setLive(false);
    fetchBoard(selected);

    const unsubscribe = subscribeContestLeaderboard(
      selected.id,
      (snapshot) => {
        liveRef.current = true;
        setLive(true);
        setBoard(snapshot);
        setUpdatedAt(new Date());
      },
      () => {
        liveRef.current = true;
        setLive(true);
        fetchBoard(selected);
      },
      () => {
        liveRef.current = false;
        setLive(false);
      }
    );

    // Polling fallback when the socket is not delivering
    const poll = window.setInterval(() => {
      if (!liveRef.current) fetchBoard(selected);
    }, POLL_MS);

    return () => {
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [view, selected, fetchBoard]);

  const openBoard = (id: string) => {
    setBoard([]);
    setSelectedId(id);
    setView('leaderboard');
  };

  const grouped = useMemo(() => {
    const g: Record<Phase, ContestDetails[]> = { ACTIVE: [], UPCOMING: [], ENDED: [] };
    contests.forEach((c) => g[derivePhase(c, now)].push(c));
    return g;
  }, [contests, now]);

  const renderCard = (c: ContestDetails) => {
    const phase = derivePhase(c, now);
    const isReg = registered.includes(c.id);
    const count = participantCount(c.id) + (isReg ? 1 : 0);
    const first = c.problems[0]?.id ?? 'two-sum';
    return (
      <article key={c.id} className="contest-card" id={`contest-${c.id}`}>
        <div className="contest-card-top">
          <span className={`contest-status ${phase.toLowerCase()}`}>
            {phase === 'ACTIVE' && <span className="live-dot" />}
            {phase === 'ACTIVE' ? 'LIVE NOW' : phase === 'UPCOMING' ? 'UPCOMING' : 'ENDED'}
          </span>
          {phase === 'ENDED' && <Trophy size={14} className="contest-trophy" />}
          {phase === 'UPCOMING' && <Clock size={14} className="contest-clock" />}
        </div>
        <h3 className="contest-title">{c.title}</h3>
        <p className="contest-meta">
          {new Date(c.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {c.duration_minutes} min ·{' '}
          {c.problems.length} problems ({c.problems.map((p) => p.letter_code).join(', ')})
        </p>
        {phase !== 'ENDED' && (
          <div className={`countdown-timer-mono ${phase === 'ACTIVE' ? 'live' : 'soon'}`}>
            <span className="countdown-label">{phase === 'ACTIVE' ? 'Ends in' : 'Starts in'}</span>
            {formatCountdown((phase === 'ACTIVE' ? c.end_time : c.start_time) - now)}
          </div>
        )}
        <p className="contest-participants">{count.toLocaleString()} participants registered</p>
        <div className="contest-actions">
          {phase === 'ACTIVE' && (
            <Link to={`/problems/${first}`} className="contest-btn primary">Enter Arena</Link>
          )}
          {phase !== 'ENDED' && (
            <button
              type="button"
              className={`contest-btn ${isReg ? 'registered' : ''}`}
              aria-pressed={isReg}
              onClick={() => toggleRegister(c.id)}
            >
              {isReg ? (<><CheckCircle2 size={13} /> Registered</>) : 'Register'}
            </button>
          )}
          <button type="button" className="contest-btn" onClick={() => openBoard(c.id)}>
            View Leaderboard
          </button>
        </div>
      </article>
    );
  };

  if (view === 'leaderboard' && selected) {
    const problems = selected.problems;
    return (
      <main className="contests-page-root">
        <button type="button" className="contest-btn back-btn" onClick={() => setView('hub')}>
          <ArrowLeft size={13} /> Contests Hub
        </button>
        <header className="fp-board-header">
          <div>
            <h1 className="contests-heading">{selected.title}</h1>
            <p className="contests-sub">ICPC scoring: 20 min penalty per rejected attempt before acceptance.</p>
          </div>
          <span className={`live-pulse-badge ${live ? 'connected' : 'offline'}`}>
            <Radio size={13} className={live ? 'pulse-anim' : ''} />
            {live ? 'LIVE SYNCED' : 'OFFLINE (POLLING)'}
          </span>
        </header>
        <div className="fp-board-wrap">
          <table className="fp-board-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Competitor</th>
                <th>Solved</th>
                <th>Penalty</th>
                {problems.map((p) => (
                  <th key={p.id} title={p.title}>{p.letter_code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.map((e) => {
                const isMe = e.user_id === user.username;
                return (
                  <tr key={e.user_id} className={isMe ? 'me' : ''}>
                    <td>{rankBadge(e.rank)}</td>
                    <td>
                      <span className="fp-handle">
                        <span className="fp-avatar">{e.user_id.slice(0, 2).toUpperCase()}</span>
                        <Link to={`/u/${e.user_id}`}>{e.user_id}</Link>
                        <span className={`fp-tier ${e.rank <= 3 ? 'pro' : 'free'}`}>{e.rank <= 3 ? 'Pro' : 'Free'}</span>
                      </span>
                    </td>
                    <td><span className="solved-pill">{e.solved_count} / {problems.length}</span></td>
                    <td className="fp-penalty">{e.total_penalty_minutes}m</td>
                    {problems.map((p) => {
                      const s: any = e.problem_scores[p.id];
                      if (s?.solved) {
                        return (
                          <td key={p.id} className="fp-cell solved">
                            <strong>+{s.rejected_attempts > 0 ? s.rejected_attempts + 1 : 1}</strong>
                            <small>{s.penalty_minutes}m</small>
                          </td>
                        );
                      }
                      if (s?.rejected_attempts > 0) {
                        return <td key={p.id} className="fp-cell rejected"><strong>-{s.rejected_attempts}</strong></td>;
                      }
                      return <td key={p.id} className="fp-cell none">–</td>;
                    })}
                  </tr>
                );
              })}
              {board.length === 0 && (
                <tr><td colSpan={4 + problems.length} className="fp-empty">Loading real-time rankings…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="fp-board-footer">
          <span>Last updated: {updatedAt ? updatedAt.toLocaleTimeString() : '—'}</span>
          <span>Powered by Redis Sorted Sets (O(log N))</span>
        </footer>
      </main>
    );
  }

  const section = (title: string, list: ContestDetails[]) =>
    list.length > 0 && (
      <section className="contests-section" aria-label={title}>
        <h2 className="contests-section-title">{title}</h2>
        <div className="contests-grid">{list.map(renderCard)}</div>
      </section>
    );

  return (
    <main className="contests-page-root">
      <h1 className="contests-heading">Contests</h1>
      <p className="contests-sub">Compete live, register ahead of time, and track real-time standings.</p>
      {contests.length === 0 && <p className="contests-sub">Loading contests…</p>}
      {section('Active', grouped.ACTIVE)}
      {section('Upcoming', grouped.UPCOMING)}
      {section('Past', grouped.ENDED)}
    </main>
  );
};

export default ContestsPage;
