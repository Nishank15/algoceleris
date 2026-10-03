import React, { useState, useEffect } from 'react';
import { X, Trophy, Radio, RefreshCw, Medal, CheckCircle2, Clock } from 'lucide-react';
import { LeaderboardEntry, ContestDetails } from '../types';
import { getContest, getContestLeaderboard, subscribeContestLeaderboard } from '../services/api';

interface ContestLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId?: string;
}

export const ContestLeaderboardModal: React.FC<ContestLeaderboardModalProps> = ({
  isOpen,
  onClose,
  contestId = 'weekly-contest-1',
}) => {
  const [contest, setContest] = useState<ContestDetails | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load contest details and initial leaderboard
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [contestData, leaderboardData] = await Promise.all([
        getContest(contestId).catch(() => null),
        getContestLeaderboard(contestId).catch(() => []),
      ]);
      if (contestData) setContest(contestData);
      setLeaderboard(leaderboardData);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Failed to load contest or leaderboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();

      // Subscribe to WebSocket live updates
      const unsubscribe = subscribeContestLeaderboard(
        contestId,
        (snapshot) => {
          setLeaderboard(snapshot);
          setIsLiveConnected(true);
          setLastUpdated(new Date());
        },
        () => {
          // On live delta update, refresh leaderboard
          getContestLeaderboard(contestId)
            .then((fresh) => {
              setLeaderboard(fresh);
              setIsLiveConnected(true);
              setLastUpdated(new Date());
            })
            .catch(() => {});
        },
        () => {
          setIsLiveConnected(false);
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, contestId]);

  if (!isOpen) return null;

  const problems = contest?.problems || [
    { id: 'two-sum', letter_code: 'A', title: 'Two Sum', points: 100 },
    { id: 'valid-parentheses', letter_code: 'B', title: 'Valid Parentheses', points: 100 },
    { id: 'lru-cache', letter_code: 'C', title: 'LRU Cache', points: 200 },
  ];

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="rank-badge rank-gold" title="1st Place - Gold">
          <Medal size={14} className="medal-icon gold-medal" /> #1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="rank-badge rank-silver" title="2nd Place - Silver">
          <Medal size={14} className="medal-icon silver-medal" /> #2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="rank-badge rank-bronze" title="3rd Place - Bronze">
          <Medal size={14} className="medal-icon bronze-medal" /> #3
        </span>
      );
    }
    return <span className="rank-badge rank-standard">#{rank}</span>;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="leaderboard-header">
          <div className="leaderboard-title-group">
            <div className="leaderboard-badge">
              <Trophy size={14} className="trophy-glow-icon" />
              <span>LIVE CONTEST LEADERBOARD</span>
            </div>
            <h2 className="leaderboard-contest-title">
              {contest?.title || 'Weekly Contest 1: Core Algorithms'}
            </h2>
            <p className="leaderboard-subtitle">
              ICPC penalty scoring rule: 20 min per rejected attempt before Accepted solution.
            </p>
          </div>

          {/* Right Header Status Bar & Close */}
          <div className="leaderboard-header-actions">
            <div className={`live-pulse-badge ${isLiveConnected ? 'connected' : 'offline'}`}>
              <Radio size={13} className={isLiveConnected ? 'pulse-anim' : ''} />
              <span>{isLiveConnected ? 'Live O(log N) Stream' : 'Live Connected'}</span>
            </div>

            <button
              className="refresh-board-btn"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh standings"
            >
              <RefreshCw size={13} className={isLoading ? 'spin-anim' : ''} />
              <span>Refresh</span>
            </button>

            <button
              className="leaderboard-close-btn"
              onClick={onClose}
              aria-label="Close modal"
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="leaderboard-table-container">
          {isLoading && leaderboard.length === 0 ? (
            <div className="leaderboard-loading">
              <RefreshCw size={24} className="spin-anim" />
              <span>Loading real-time rankings...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="leaderboard-empty">
              <Trophy size={36} className="empty-trophy" />
              <h3>No Submissions Yet</h3>
              <p>Be the first to submit a solution in this contest to claim Rank #1!</p>
            </div>
          ) : (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="th-rank">Rank</th>
                  <th className="th-user">Participant</th>
                  <th className="th-score">Solved</th>
                  <th className="th-penalty">Penalty</th>
                  {problems.map((p) => (
                    <th key={p.id} className="th-problem" title={p.title}>
                      <span className="prob-code">{p.letter_code}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.user_id} className={`tr-entry ${entry.rank <= 3 ? 'top-tier' : ''}`}>
                    <td className="td-rank">{getRankBadge(entry.rank)}</td>
                    <td className="td-user">
                      <div className="user-handle-cell">
                        <span className="user-avatar-dot" />
                        <span className="user-handle">{entry.user_id}</span>
                      </div>
                    </td>
                    <td className="td-score">
                      <span className="solved-pill">
                        <CheckCircle2 size={13} className="check-icon" />
                        {entry.solved_count} / {problems.length}
                      </span>
                    </td>
                    <td className="td-penalty">
                      <span className="penalty-text">
                        <Clock size={12} className="penalty-clock" />
                        {entry.total_penalty_minutes}m
                      </span>
                    </td>
                    {problems.map((p) => {
                      const probScore = entry.problem_scores[p.id];
                      if (!probScore) {
                        return (
                          <td key={p.id} className="td-prob-cell prob-none">
                            <span className="matrix-dash">-</span>
                          </td>
                        );
                      }
                      if (probScore.solved) {
                        const attempts = probScore.rejected_attempts > 0 ? `+${probScore.rejected_attempts + 1}` : '+1';
                        return (
                          <td key={p.id} className="td-prob-cell prob-solved">
                            <div className="matrix-solved-cell">
                              <span className="matrix-attempts">{attempts}</span>
                              <span className="matrix-time">{probScore.penalty_minutes}m</span>
                            </div>
                          </td>
                        );
                      }
                      if (probScore.rejected_attempts > 0) {
                        return (
                          <td key={p.id} className="td-prob-cell prob-rejected">
                            <div className="matrix-rejected-cell">
                              <span className="matrix-attempts-fail">-{probScore.rejected_attempts}</span>
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={p.id} className="td-prob-cell prob-none">
                          <span className="matrix-dash">-</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="leaderboard-footer">
          <span className="footer-timestamp">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <span className="footer-algo-tag">
            Powered by Redis Sorted Sets (O(log N))
          </span>
        </div>
      </div>
    </div>
  );
};
