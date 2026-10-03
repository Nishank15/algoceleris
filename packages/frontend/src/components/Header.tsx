import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Send, Maximize2, Minimize2, Sparkles, Trophy, Shield, BarChart2, ChevronRight } from 'lucide-react';
import { Language, Problem, SubscriptionTier } from '../types';

interface HeaderProps {
  problems: Problem[];
  activeProblemId: string;
  onSelectProblem: (id: string) => void;
  activeLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
  onRunSamples: () => void;
  onSubmit: () => void;
  isRunning: boolean;
  currentTier: SubscriptionTier;
  onOpenPricingModal: () => void;
  onOpenLeaderboard?: () => void;
  onOpenAnalytics?: () => void;
  isContestMode?: boolean;
  strikeCount?: number;
  onToggleContestMode?: () => void;
  submitLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  problems,
  activeProblemId,
  onSelectProblem,
  activeLanguage,
  onLanguageChange,
  isZenMode,
  onToggleZenMode,
  onRunSamples,
  onSubmit,
  isRunning,
  currentTier,
  onOpenPricingModal,
  onOpenLeaderboard,
  onOpenAnalytics,
  isContestMode = false,
  strikeCount = 0,
  onToggleContestMode,
  submitLabel,
}) => {
  return (
    <header className="header-nav">
      <div className="header-left">
        <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
          <Link to="/problems" className="workspace-breadcrumb-link">Problems</Link>
          <ChevronRight size={12} className="workspace-breadcrumb-sep" />
        </nav>

        <div className="problem-breadcrumb">
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              value={activeProblemId}
              onChange={(e) => onSelectProblem(e.target.value)}
              disabled={isRunning}
            >
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.difficulty})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Contest Leaderboard Button */}
        {onOpenLeaderboard && (
          <button
            className="btn btn-secondary"
            onClick={onOpenLeaderboard}
            title="View Live Contest Leaderboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Trophy size={14} className="trophy-glow-icon" />
            <span>Leaderboard</span>
          </button>
        )}

        {/* Analytics Action Button */}
        {onOpenAnalytics && (
          <button
            className="btn btn-secondary"
            onClick={onOpenAnalytics}
            title="View 3D Isometric Developer Analytics & Journey"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <BarChart2 size={14} className="accent-icon" />
            <span>Analytics</span>
          </button>
        )}

        {/* Contest Mode Toggle / Indicator */}
        {onToggleContestMode && (
          isContestMode ? (
            <div className="contest-mode-badge" title="Contest Mode Active with Fullscreen and Proctoring Enforced">
              <span className="contest-dot-active" />
              <span>CONTEST MODE</span>
              {strikeCount > 0 && (
                <span style={{ opacity: 0.9, fontSize: '0.72rem', color: strikeCount >= 3 ? '#eb5757' : '#f59e0b' }}>
                  ({strikeCount}/3 Strikes)
                </span>
              )}
              <button
                className="btn btn-contest-exit"
                onClick={onToggleContestMode}
                title="Exit Contest Mode"
              >
                Exit
              </button>
            </div>
          ) : (
            <button
              className="btn btn-contest-enter"
              onClick={onToggleContestMode}
              title="Enter Proctored Contest Mode (Enforces Fullscreen & Anti-Cheat)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Shield size={14} />
              <span>Contest Mode</span>
            </button>
          )
        )}
        {/* Pro Badge or Upgrade to Pro Action */}
        {currentTier === 'pro' ? (
          <div
            className="pro-badge-header"
            onClick={onOpenPricingModal}
            title="Active Pro Member — Click to view plan details"
          >
            <Sparkles size={12} />
            <span>PRO</span>
          </div>
        ) : (
          <button
            className="btn btn-upgrade"
            onClick={onOpenPricingModal}
            title="Upgrade to Cloud-Judge Pro"
          >
            <Sparkles size={13} />
            <span>Upgrade to Pro</span>
          </button>
        )}

        {/* Language Selector */}
        <select
          className="lang-select"
          value={activeLanguage}
          onChange={(e) => onLanguageChange(e.target.value as Language)}
          disabled={isRunning}
          aria-label="Programming Language"
        >
          <option value="cpp">C++20 (GCC)</option>
          <option value="python">Python 3.12</option>
          <option value="java">Java 21 (OpenJDK)</option>
        </select>

        {/* Zen Mode Toggle */}
        <button
          className={`btn btn-icon ${isZenMode ? 'active' : ''}`}
          onClick={onToggleZenMode}
          title={isZenMode ? 'Exit Zen Mode (Esc)' : 'Enter Zen Mode (Distraction-Free)'}
          aria-label="Toggle Zen Mode"
        >
          {isZenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {/* Run Samples Action */}
        <button
          className="btn btn-secondary"
          onClick={onRunSamples}
          disabled={isRunning}
          title="Run sample test cases"
        >
          <Play size={14} fill="currentColor" />
          <span>{isRunning ? 'Running...' : 'Run Samples'}</span>
        </button>

        {/* Submit Solution Action */}
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={isRunning}
          title="Submit solution to online judge"
        >
          <Send size={14} />
          <span>{submitLabel ?? (isRunning ? 'Judging...' : 'Submit Solution')}</span>
        </button>
      </div>
    </header>
  );
};
