import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Filter,
  Users,
  Shield,
  BookOpen,
  Video,
  ChevronRight,
  ExternalLink,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import {
  AssessmentResponse,
  AssessmentMode,
  AssessmentStatus,
  listAssessments,
  MOCK_COHORTS,
} from '../../services/campusApi';

export const CampusCalendarPage: React.FC = () => {
  const { org_slug } = useParams<{ org_slug?: string }>();
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [selectedCohort, setSelectedCohort] = useState<string>('ALL');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Update current time every second for live countdown precision
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchItems = async () => {
      try {
        const data = await listAssessments();
        if (!cancelled) {
          setAssessments(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) setLoading(false);
      }
    };
    fetchItems();
    return () => {
      cancelled = true;
    };
  }, []);

  // Format countdown string with tabular-nums
  const getCountdown = (targetIso: string, label: string) => {
    const diffMs = new Date(targetIso).getTime() - currentTime;
    if (diffMs <= 0) return { text: 'COMPLETED', isExpired: true };

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    if (days > 0) {
      return {
        text: `${days}d ${pad(hours)}h ${pad(minutes)}m`,
        isExpired: false,
        label,
      };
    }
    return {
      text: `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
      isExpired: false,
      label,
    };
  };

  // Filter assessments
  const filtered = useMemo(() => {
    return assessments.filter((item) => {
      if (selectedMode !== 'ALL' && item.mode !== selectedMode) return false;
      if (selectedCohort !== 'ALL' && item.cohort_id !== selectedCohort) return false;
      return true;
    });
  }, [assessments, selectedMode, selectedCohort]);

  const activeCount = useMemo(
    () => assessments.filter((a) => a.status === 'ACTIVE').length,
    [assessments]
  );
  const scheduledCount = useMemo(
    () => assessments.filter((a) => a.status === 'SCHEDULED').length,
    [assessments]
  );

  const getModeIcon = (mode: AssessmentMode) => {
    switch (mode) {
      case 'EXAM':
        return <Shield size={14} className="icon-exam" />;
      case 'HOMEWORK':
        return <BookOpen size={14} className="icon-homework" />;
      case 'VIVA':
        return <Video size={14} className="icon-viva" />;
    }
  };

  const getStatusBadge = (status: AssessmentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="campus-status-pill status-active">
            <span className="live-dot" />
            <span>ACTIVE NOW</span>
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="campus-status-pill status-scheduled">
            <Clock size={11} />
            <span>UPCOMING</span>
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="campus-status-pill status-grace">
            <Flame size={11} />
            <span>GRACE PERIOD</span>
          </span>
        );
      case 'CLOSED':
        return (
          <span className="campus-status-pill status-closed">
            <CheckCircle2 size={11} />
            <span>CONCLUDED</span>
          </span>
        );
      case 'DRAFT':
        return (
          <span className="campus-status-pill status-draft">
            <span>DRAFT</span>
          </span>
        );
    }
  };

  const newAssessmentLink = org_slug
    ? `/portal/${org_slug}/assessments/new`
    : '/campus/assessments/new';

  return (
    <div className="campus-calendar-root">
      <div className="campus-calendar-container">
        {/* Header */}
        <div className="campus-calendar-header">
          <div>
            <div className="campus-calendar-eyebrow">
              <span className="campus-eyebrow-badge">INSTITUTIONAL PORTAL</span>
              <span>/</span>
              <span>SCHEDULE &amp; TIMELINES</span>
            </div>
            <h1 className="campus-calendar-title">Campus Assessment Calendar</h1>
            <p className="campus-calendar-subtitle">
              Monitor active proctored exams, assignment submission windows, and viva interview slots.
            </p>
          </div>

          <div className="campus-calendar-actions">
            <Link to={newAssessmentLink} className="btn-submit-primary">
              <Plus size={16} />
              <span>New Assessment</span>
            </Link>
          </div>
        </div>

        {/* Overview Stats Bar */}
        <div className="campus-stat-bar">
          <div className="stat-card">
            <span className="stat-label">ACTIVE ASSESSMENTS</span>
            <div className="stat-val-cluster">
              <span className="stat-number tabular-nums">{activeCount}</span>
              {activeCount > 0 && <span className="stat-pill-live">LIVE</span>}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">UPCOMING SCHEDULED</span>
            <span className="stat-number tabular-nums">{scheduledCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">MANAGED COHORTS</span>
            <span className="stat-number tabular-nums">{MOCK_COHORTS.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">PORTAL CLOCK (UTC)</span>
            <span className="stat-mono-clock tabular-nums font-mono">
              {new Date(currentTime).toISOString().substring(11, 19)}
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="calendar-filter-bar">
          <div className="filter-group">
            <Filter size={14} className="filter-icon" />
            <span className="filter-heading">FILTER:</span>
            <div className="filter-pills">
              {['ALL', 'EXAM', 'HOMEWORK', 'VIVA'].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`filter-btn ${selectedMode === m ? 'active' : ''}`}
                  onClick={() => setSelectedMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="cohort-filter-wrap">
            <Users size={14} />
            <select
              className="linear-select cohort-select-compact"
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
            >
              <option value="ALL">All Enrolled Cohorts</option>
              {MOCK_COHORTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} ({c.name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assessment Grid */}
        {loading ? (
          <div className="calendar-loading-grid">
            <div className="loading-card skeleton" />
            <div className="loading-card skeleton" />
            <div className="loading-card skeleton" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="calendar-empty-state">
            <CalendarIcon size={36} className="empty-icon" />
            <h3 className="empty-title">No Assessments Found</h3>
            <p className="empty-sub">
              No active or scheduled assessments match the selected filter criteria.
            </p>
            <Link to={newAssessmentLink} className="btn-add-criterion">
              <Plus size={14} />
              <span>Create an Assessment</span>
            </Link>
          </div>
        ) : (
          <div className="campus-calendar-grid">
            {filtered.map((item) => {
              const cohort = MOCK_COHORTS.find((c) => c.id === item.cohort_id);
              const startsCountdown = getCountdown(item.starts_at, 'Starts in');
              const dueCountdown = getCountdown(item.due_at, 'Due in');

              const isOngoing = item.status === 'ACTIVE' || item.status === 'GRACE_PERIOD';

              return (
                <article key={item.id} className={`assessment-card mode-${item.mode.toLowerCase()}`}>
                  <div className="card-top-row">
                    <div className="card-cohort-badge">
                      <span className="cohort-tag font-mono">{cohort ? cohort.code : 'CAMPUS'}</span>
                      <span className="mode-tag">
                        {getModeIcon(item.mode)}
                        <span>{item.mode}</span>
                      </span>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="card-main-content">
                    <h3 className="card-assessment-title">{item.title}</h3>
                    <p className="card-assessment-desc">{item.description}</p>
                  </div>

                  {/* Countdown Timer */}
                  <div className="card-countdown-box">
                    <div className="countdown-header">
                      <Clock size={13} />
                      <span className="countdown-label">
                        {isOngoing ? 'SUBMISSION DEADLINE' : 'COMMENCEMENT'}
                      </span>
                    </div>
                    <div className="campus-countdown font-mono tabular-nums">
                      {isOngoing ? dueCountdown.text : startsCountdown.text}
                    </div>
                    <div className="countdown-dates tabular-nums">
                      <span>Window: </span>
                      <span>
                        {new Date(item.starts_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(item.starts_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span> &rarr; </span>
                      <span>
                        {new Date(item.due_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {new Date(item.due_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="card-meta-chips">
                    <div className="meta-chip">
                      <span className="chip-key">Problems:</span>
                      <span className="chip-val tabular-nums">{item.problem_slugs.length}</span>
                    </div>
                    {item.duration_minutes && (
                      <div className="meta-chip">
                        <span className="chip-key">Duration:</span>
                        <span className="chip-val tabular-nums">{item.duration_minutes}m</span>
                      </div>
                    )}
                    {item.mode === 'HOMEWORK' && item.late_penalty_percent_per_hour > 0 && (
                      <div className="meta-chip">
                        <span className="chip-key">Late Penalty:</span>
                        <span className="chip-val tabular-nums">
                          {item.late_penalty_percent_per_hour}%/hr
                        </span>
                      </div>
                    )}
                    <div className="meta-chip">
                      <span className="chip-key">Rubric:</span>
                      <span className="chip-val tabular-nums">
                        {item.scoring_rubric?.criteria?.length || 0} criteria
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="card-actions-bar">
                    {item.mode === 'EXAM' && item.status === 'ACTIVE' ? (
                      <Link
                        to={`/campus/assessments/${item.id}/arena`}
                        className="btn-card-action primary"
                      >
                        <span>Enter Arena</span>
                        <ChevronRight size={14} />
                      </Link>
                    ) : item.mode === 'VIVA' ? (
                      <Link
                        to={`/campus/viva/${item.id}`}
                        className="btn-card-action primary"
                      >
                        <Video size={14} />
                        <span>Join Viva Room</span>
                        <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <Link
                        to={newAssessmentLink}
                        className="btn-card-action"
                      >
                        <span>View Details</span>
                        <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampusCalendarPage;
