import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FlaskConical,
  CheckCircle2,
  TrendingUp,
  Award,
  ArrowRight,
  Clock,
  Calendar,
  AlertCircle,
  FileCheck2,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { getCampusSession } from '../../services/campusSession';

export const CampusStudentDashboard: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const navigate = useNavigate();
  const session = getCampusSession(orgSlug);

  return (
    <div className="campus-dashboard-container">
      {/* Welcome Bar */}
      <div className="campus-welcome-bar">
        <div>
          <h1 className="campus-welcome-title">
            Welcome back, <span className="highlight-name">{session.name.split(' ')[0]}</span>
          </h1>
          <p className="campus-welcome-sub">
            Registration: <strong className="font-mono">{session.regNumber}</strong> · Course: <strong>BACS101 (Problem Solving Using Java)</strong>
          </p>
        </div>
        <div className="welcome-quick-actions">
          <Link to={`/campus/${orgSlug}/student/labs`} className="btn btn-primary welcome-lab-btn">
            <FlaskConical size={14} />
            <span>Open Active Labs</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 4 TOP KPI CARDS */}
      <section className="campus-kpi-grid">
        <div className="campus-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Active labs</span>
            <div className="kpi-icon blue">
              <FlaskConical size={16} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value font-mono">1</span>
            <span className="kpi-subtext blue">Open right now</span>
          </div>
        </div>

        <div className="campus-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Completed labs</span>
            <div className="kpi-icon green">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value font-mono">23</span>
            <span className="kpi-subtext green">Submitted & evaluated</span>
          </div>
        </div>

        <div className="campus-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Average marks</span>
            <div className="kpi-icon amber">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value font-mono">8.82</span>
            <span className="kpi-subtext amber">Across submissions</span>
          </div>
        </div>

        <div className="campus-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">CLO attainment</span>
            <div className="kpi-icon purple">
              <Award size={16} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value font-mono">84%</span>
            <span className="kpi-subtext purple">Average outcome</span>
          </div>
        </div>
      </section>

      {/* OPEN LABS SECTION */}
      <section className="campus-open-labs-section">
        <div className="section-title-row">
          <div className="section-title-cluster">
            <h2 className="section-title">Open Lab Exercises</h2>
            <span className="section-count-badge">1 Open</span>
          </div>
          <Link to={`/campus/${orgSlug}/student/labs`} className="section-action-link">
            <span>View All Labs</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        <div className="open-lab-card" id="card-open-lab-active">
          <div className="open-lab-header">
            <div className="open-lab-title-cluster">
              <div className="status-dot-active" />
              <h3 className="open-lab-title">PPS_11_Multi_Threading</h3>
              <span className="course-code-pill">BACS101</span>
              <span className="urgency-pill amber">In 4 days</span>
            </div>
            <div className="open-lab-faculty">
              <span>Faculty: <strong>Dr. SARAVANAN P</strong></span>
            </div>
          </div>

          <p className="open-lab-desc">
            Explore concurrency in Java, Thread lifecycle, synchronization locks, race conditions,
            and deadlock-free resource management with 6-stage progressive exercises.
          </p>

          <div className="open-lab-meta-row">
            <div className="meta-item">
              <Clock size={13} />
              <span>Due: <strong>Oct 19, 2026 · 11:59 PM</strong></span>
            </div>
            <div className="meta-item">
              <BookOpen size={13} />
              <span>6 Progressive Stages (Content, Demo, LED, Practice, Challenge, Submit)</span>
            </div>
            <div className="meta-item">
              <Sparkles size={13} />
              <span>AI Mentor Enabled</span>
            </div>
          </div>

          <div className="open-lab-footer">
            <button
              type="button"
              className="btn btn-primary open-lab-cta-btn"
              onClick={() => navigate(`/campus/${orgSlug}/student/labs/pps-11-multi-threading/room`)}
              id="btn-open-active-lab"
            >
              <span>Open Lab Exercise</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* BOTTOM 2-COLUMN SPLIT: Recent Results vs Needs Attention */}
      <div className="campus-bottom-split">
        {/* Left: Recent Results */}
        <section className="campus-recent-results">
          <div className="section-title-row">
            <h2 className="section-title">Recent results</h2>
            <Link to={`/campus/${orgSlug}/student/labs/completed`} className="section-action-link">
              <span>View all</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="results-list">
            <div
              className="result-row-item"
              onClick={() => navigate(`/campus/${orgSlug}/student/labs/week-12-generics/review`)}
              role="button"
              tabIndex={0}
            >
              <div className="result-main">
                <span className="result-title">Week 12_Generics</span>
                <span className="result-course">BACS101 · Problem Solving Using Java</span>
              </div>
              <div className="result-scores">
                <span className="result-score-val font-mono">20/20</span>
                <span className="result-percent font-mono">(100%)</span>
                <span className="result-status-badge blue">Evaluated</span>
                <ChevronRight size={14} className="result-arrow" />
              </div>
            </div>

            <div
              className="result-row-item"
              onClick={() => navigate(`/campus/${orgSlug}/student/labs/week-11-multithreading/review`)}
              role="button"
              tabIndex={0}
            >
              <div className="result-main">
                <span className="result-title">Week 11_Multithreading</span>
                <span className="result-course">BACS101 · Problem Solving Using Java</span>
              </div>
              <div className="result-scores">
                <span className="result-score-val font-mono">20/20</span>
                <span className="result-percent font-mono">(100%)</span>
                <span className="result-status-badge blue">Evaluated</span>
                <ChevronRight size={14} className="result-arrow" />
              </div>
            </div>

            <div
              className="result-row-item"
              onClick={() => navigate(`/campus/${orgSlug}/student/labs/week-10-pps/review`)}
              role="button"
              tabIndex={0}
            >
              <div className="result-main">
                <span className="result-title">Week 10_PPS</span>
                <span className="result-course">BACS101 · Problem Solving Using Java</span>
              </div>
              <div className="result-scores">
                <span className="result-score-val font-mono">18.5/18.5</span>
                <span className="result-percent font-mono">(100%)</span>
                <span className="result-status-badge blue">Evaluated</span>
                <ChevronRight size={14} className="result-arrow" />
              </div>
            </div>
          </div>
        </section>

        {/* Right: Needs Your Attention */}
        <section className="campus-attention-box">
          <div className="section-title-row">
            <div>
              <h2 className="section-title">Needs your attention</h2>
              <span className="section-subtitle">Deadlines and areas to focus on</span>
            </div>
          </div>

          <div className="attention-empty-state">
            <div className="attention-check-icon">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="attention-headline">Nothing urgent right now</h4>
            <p className="attention-desc">
              You're all caught up with your evaluations and submissions. Your upcoming deadline for{' '}
              <strong>PPS_11_Multi_Threading</strong> is in 4 days.
            </p>
            <div className="attention-tip">
              <Sparkles size={13} />
              <span>Tip: Review section-locked practice exercises to prepare early.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CampusStudentDashboard;
