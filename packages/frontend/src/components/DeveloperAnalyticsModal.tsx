import React, { useEffect, useMemo } from 'react';
import {
  X,
  BarChart3,
  CheckCircle2,
  Flame,
  Trophy,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { IsometricHeatmap } from './IsometricHeatmap';
import { UserAnalytics } from '../types';

interface DeveloperAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analytics?: UserAnalytics;
}

export const DeveloperAnalyticsModal: React.FC<DeveloperAnalyticsModalProps> = ({
  isOpen,
  onClose,
  analytics,
}) => {
  const heatmapData = useMemo(() => {
    if (!analytics?.history || analytics.history.length === 0) return undefined;
    return analytics.history.map((d) => ({
      date: d.date,
      count: d.count,
    }));
  }, [analytics?.history]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Default values if not supplied
  const totalSubmissions = analytics?.total_submissions ?? 248;
  const acceptedCount = analytics?.accepted_count ?? 186;
  const acceptanceRate = analytics?.acceptance_rate ?? 75.0;
  const streakDays = analytics?.streak_days ?? 14;

  const solvedEasy = analytics?.solved_easy ?? 92;
  const totalEasy = analytics?.total_easy ?? 100;
  const solvedMedium = analytics?.solved_medium ?? 74;
  const totalMedium = analytics?.total_medium ?? 120;
  const solvedHard = analytics?.solved_hard ?? 20;
  const totalHard = analytics?.total_hard ?? 40;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container analytics-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '980px', width: '95%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="analytics-icon-badge">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="modal-title">Developer Analytics & Telemetry</h2>
              <p className="modal-subtitle">
                3D isometric submission heatmap, performance metrics, and contest journey
              </p>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close analytics modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="modal-body analytics-body">
          {/* Top KPI Metric Cards */}
          <div className="analytics-kpi-grid">
            <div className="analytics-card">
              <div className="card-top">
                <span className="card-label">Total Submissions</span>
                <CheckCircle2 size={16} className="card-icon text-indigo" />
              </div>
              <div className="card-value">{totalSubmissions}</div>
              <div className="card-footer">
                <span className="trend-positive">
                  <ArrowUpRight size={13} /> +18.4%
                </span>
                <span className="card-subtext">vs last month</span>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-top">
                <span className="card-label">Acceptance Rate</span>
                <TrendingUp size={16} className="card-icon text-emerald" />
              </div>
              <div className="card-value">{acceptanceRate.toFixed(1)}%</div>
              <div className="card-footer">
                <span className="card-subtext">
                  {acceptedCount} of {totalSubmissions} accepted
                </span>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-top">
                <span className="card-label">Daily Streak</span>
                <Flame size={16} className="card-icon text-amber" />
              </div>
              <div className="card-value">{streakDays} Days</div>
              <div className="card-footer">
                <span className="trend-positive">Personal Best: 21d</span>
              </div>
            </div>

            <div className="analytics-card">
              <div className="card-top">
                <span className="card-label">Global Standing</span>
                <Trophy size={16} className="card-icon text-purple" />
              </div>
              <div className="card-value">1,842</div>
              <div className="card-footer">
                <span className="badge-purple">Top 4.2%</span>
              </div>
            </div>
          </div>

          {/* Difficulty Progress Breakdown */}
          <div className="difficulty-breakdown-card">
            <h3 className="section-title">Solved Problems by Difficulty</h3>
            <div className="difficulty-grid">
              {/* Easy */}
              <div className="diff-item">
                <div className="diff-header">
                  <span className="diff-name diff-easy">Easy</span>
                  <span className="diff-fraction">
                    {solvedEasy} / {totalEasy}
                  </span>
                </div>
                <div className="diff-progress-bar">
                  <div
                    className="diff-fill fill-easy"
                    style={{ width: `${(solvedEasy / totalEasy) * 100}%` }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div className="diff-item">
                <div className="diff-header">
                  <span className="diff-name diff-medium">Medium</span>
                  <span className="diff-fraction">
                    {solvedMedium} / {totalMedium}
                  </span>
                </div>
                <div className="diff-progress-bar">
                  <div
                    className="diff-fill fill-medium"
                    style={{ width: `${(solvedMedium / totalMedium) * 100}%` }}
                  />
                </div>
              </div>

              {/* Hard */}
              <div className="diff-item">
                <div className="diff-header">
                  <span className="diff-name diff-hard">Hard</span>
                  <span className="diff-fraction">
                    {solvedHard} / {totalHard}
                  </span>
                </div>
                <div className="diff-progress-bar">
                  <div
                    className="diff-fill fill-hard"
                    style={{ width: `${(solvedHard / totalHard) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3D Isometric Heatmap Section */}
          <div className="heatmap-section-container">
            <IsometricHeatmap
              data={heatmapData}
              palette="grape"
              defaultView="3d"
              unit="submission"
            />
          </div>

          {/* Contest History Table */}
          <div className="contest-history-card">
            <div className="contest-history-header">
              <Trophy size={16} className="accent-icon" />
              <h3>Recent Contest Performance</h3>
            </div>
            <div className="contest-table-wrapper">
              <table className="contest-history-table">
                <thead>
                  <tr>
                    <th>Contest</th>
                    <th>Rank</th>
                    <th>Problems Solved</th>
                    <th>Penalty</th>
                    <th>Rating Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="contest-name">Weekly Contest 1: Core Algorithms</td>
                    <td>
                      <span className="rank-badge rank-gold">#1</span>
                    </td>
                    <td>3 / 3 (100%)</td>
                    <td>18 min</td>
                    <td className="rating-plus">+48</td>
                  </tr>
                  <tr>
                    <td className="contest-name">Bi-Weekly Round 14: Trees & Graphs</td>
                    <td>
                      <span className="rank-badge rank-silver">#12</span>
                    </td>
                    <td>2 / 3 (66%)</td>
                    <td>42 min</td>
                    <td className="rating-plus">+19</td>
                  </tr>
                  <tr>
                    <td className="contest-name">Weekly Contest 0: System Warmup</td>
                    <td>
                      <span className="rank-badge">#4</span>
                    </td>
                    <td>3 / 3 (100%)</td>
                    <td>31 min</td>
                    <td className="rating-plus">+35</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <span className="footer-notice">
            Telemetry metrics refresh automatically after each sandboxed evaluation
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
