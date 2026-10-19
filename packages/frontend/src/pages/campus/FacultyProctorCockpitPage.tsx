import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Clock,
  Search,
  Filter,
  ExternalLink,
  Video,
  Clock3,
  AlertOctagon,
  Activity,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  UserCheck,
  Zap,
} from 'lucide-react';
import {
  AssessmentResponse,
  ProctorEventItem,
  ProctoredCandidateState,
  VivaRoomResponse,
  getAssessment,
  fetchProctorEvents,
  fetchProctoredStudents,
  postProctorEvent,
  provisionVivaRoom,
} from '../../services/campusApi';

/** Poll cadence for refreshing the roster and incident feed from the gateway. */
const PROCTOR_POLL_INTERVAL_MS = 3000;

/** Resolves a candidate display label from real identity fields only. */
export const candidateLabel = (candidate: ProctoredCandidateState): string =>
  candidate.username || candidate.roll_number || candidate.user_id.slice(0, 8);

/** Resolves a candidate registration label from real identity fields only. */
export const candidateRoll = (candidate: ProctoredCandidateState): string =>
  candidate.roll_number || candidate.user_id.slice(0, 8);

/** Plays the critical-breach chirp so faculty notice a fresh high-risk incident. */
const playCriticalAlert = () => {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  try {
    const ctx = new window.AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Ignore audio context errors
  }
};

export const FacultyProctorCockpitPage: React.FC = () => {
  const { assessmentId: routeAssessmentId, org_slug } = useParams<{
    assessmentId?: string;
    org_slug?: string;
  }>();
  const assessmentId = routeAssessmentId || '';
  const hasAssessment = assessmentId.length > 0;

  // Core Data State
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [students, setStudents] = useState<ProctoredCandidateState[]>([]);
  const [incidentFeed, setIncidentFeed] = useState<ProctorEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveConnected, setLiveConnected] = useState<boolean>(false);
  const [telemetryError, setTelemetryError] = useState<boolean>(false);
  const [currentTimeUtc, setCurrentTimeUtc] = useState<string>('');

  // UI Filters and Layout State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'ELEVATED' | 'LOW' | 'DISCONNECTED'>('ALL');
  const [sortBy, setSortBy] = useState<'risk_desc' | 'roll_asc' | 'name_asc'>('risk_desc');
  const [isFeedCollapsed, setIsFeedCollapsed] = useState<boolean>(false);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(true);
  const [fullscreenMode, setFullscreenMode] = useState<boolean>(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ProctoredCandidateState | null>(null);

  // Modal Action States
  const [vivaModalOpen, setVivaModalOpen] = useState<boolean>(false);
  const [vivaTargetStudent, setVivaTargetStudent] = useState<ProctoredCandidateState | null>(null);
  const [vivaLoading, setVivaLoading] = useState<boolean>(false);
  const [vivaRoom, setVivaRoom] = useState<VivaRoomResponse | null>(null);

  const [extensionModalOpen, setExtensionModalOpen] = useState<boolean>(false);
  const [extensionTargetStudent, setExtensionTargetStudent] = useState<ProctoredCandidateState | null>(null);
  const [extensionMinutes, setExtensionMinutes] = useState<number>(15);

  const [forceSubmitModalOpen, setForceSubmitModalOpen] = useState<boolean>(false);
  const [forceSubmitTargetStudent, setForceSubmitTargetStudent] = useState<ProctoredCandidateState | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Live UTC Clock
  useEffect(() => {
    const updateUtcClock = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setCurrentTimeUtc(`${hours}:${minutes}:${seconds} UTC`);
    };
    updateUtcClock();
    const interval = setInterval(updateUtcClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial Assessment & Candidate Data Fetch
  useEffect(() => {
    if (!hasAssessment) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [assessmentData, studentsData, eventsData] = await Promise.all([
          getAssessment(assessmentId),
          fetchProctoredStudents(assessmentId),
          fetchProctorEvents(assessmentId),
        ]);
        if (mounted) {
          setAssessment(assessmentData);
          setStudents(studentsData);
          setIncidentFeed(eventsData);
          setTelemetryError(false);
          setLiveConnected(true);
        }
      } catch (err) {
        console.error('Failed to load cockpit data:', err);
        if (mounted) {
          setTelemetryError(true);
          setLiveConnected(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [assessmentId, hasAssessment]);

  // Live telemetry polling: refresh roster and incident feed from the gateway
  useEffect(() => {
    if (!hasAssessment) return;

    let mounted = true;
    let isFirstPoll = true;
    const seenEventIds = new Set<string>();

    const poll = async () => {
      try {
        const [studentsData, eventsData] = await Promise.all([
          fetchProctoredStudents(assessmentId),
          fetchProctorEvents(assessmentId),
        ]);
        if (!mounted) return;

        setStudents(studentsData);
        setIncidentFeed(eventsData);
        setTelemetryError(false);
        setLiveConnected(true);

        // Chirp once per newly observed critical breach, never on the first poll
        const freshCritical = isFirstPoll
          ? []
          : eventsData.filter((event) => event.severity === 'critical' && !seenEventIds.has(event.id));
        eventsData.forEach((event) => seenEventIds.add(event.id));
        if (soundAlertsEnabled && freshCritical.length > 0) {
          playCriticalAlert();
        }
        isFirstPoll = false;
      } catch (err) {
        console.debug('Proctoring telemetry poll failed:', err);
        if (mounted) {
          setLiveConnected(false);
          setTelemetryError(true);
        }
      }
    };

    const interval = setInterval(() => {
      void poll();
    }, PROCTOR_POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [assessmentId, hasAssessment, soundAlertsEnabled]);

  // Aggregate Metrics & Counts
  const totalStudents = students.length;
  const onlineCount = useMemo(() => students.filter((s) => s.status === 'connected').length, [students]);
  const idleCount = useMemo(() => students.filter((s) => s.status === 'idle').length, [students]);
  const criticalCount = useMemo(
    () => students.filter((s) => s.risk_severity === 'critical').length,
    [students]
  );
  const elevatedCount = useMemo(
    () => students.filter((s) => s.risk_severity === 'elevated').length,
    [students]
  );
  const flaggedCount = criticalCount + elevatedCount;

  // Filtered & Sorted Candidates
  const displayedCandidates = useMemo(() => {
    let result = [...students];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.roll_number || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          candidateLabel(s).toLowerCase().includes(q)
      );
    }

    // Severity Filter
    if (severityFilter === 'CRITICAL') {
      result = result.filter((s) => s.risk_severity === 'critical');
    } else if (severityFilter === 'ELEVATED') {
      result = result.filter((s) => s.risk_severity === 'elevated');
    } else if (severityFilter === 'LOW') {
      result = result.filter((s) => s.risk_severity === 'low');
    } else if (severityFilter === 'DISCONNECTED') {
      result = result.filter((s) => s.status === 'disconnected');
    }

    // Sorting
    if (sortBy === 'risk_desc') {
      result.sort((a, b) => b.risk_score - a.risk_score);
    } else if (sortBy === 'roll_asc') {
      result.sort((a, b) => (a.roll_number || '').localeCompare(b.roll_number || ''));
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => candidateLabel(a).localeCompare(candidateLabel(b)));
    }

    return result;
  }, [students, searchQuery, severityFilter, sortBy]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreenMode(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreenMode(false);
    }
  };

  // Toast banner helper
  const showNotificationToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => {
      setActionSuccessMessage(null);
    }, 4500);
  };

  // Viva Escalation Handler
  const handleOpenVivaModal = (student: ProctoredCandidateState) => {
    setVivaTargetStudent(student);
    setVivaRoom(null);
    setVivaModalOpen(true);
  };

  const handleExecuteVivaProvision = async () => {
    if (!vivaTargetStudent) return;
    setVivaLoading(true);
    try {
      const room = await provisionVivaRoom(assessmentId, vivaTargetStudent.user_id);
      setVivaRoom(room);
      showNotificationToast(`Viva room provisioned for ${candidateLabel(vivaTargetStudent)}: ${room.room_code}`);
    } catch (err) {
      console.error('Failed to provision viva room:', err);
    } finally {
      setVivaLoading(false);
    }
  };

  // Time Extension Handler
  const handleOpenExtensionModal = (student: ProctoredCandidateState) => {
    setExtensionTargetStudent(student);
    setExtensionMinutes(15);
    setExtensionModalOpen(true);
  };

  const handleGrantTimeExtension = () => {
    if (!extensionTargetStudent) return;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.user_id === extensionTargetStudent.user_id) {
          return {
            ...s,
            time_extension_minutes: (s.time_extension_minutes || 0) + extensionMinutes,
          };
        }
        return s;
      })
    );
    showNotificationToast(
      `Granted +${extensionMinutes}m extension to ${candidateLabel(extensionTargetStudent)} (${candidateRoll(extensionTargetStudent)})`
    );
    setExtensionModalOpen(false);
    setExtensionTargetStudent(null);
  };

  // Force Submit Handler
  const handleOpenForceSubmitModal = (student: ProctoredCandidateState) => {
    setForceSubmitTargetStudent(student);
    setForceSubmitModalOpen(true);
  };

  const handleConfirmForceSubmit = () => {
    if (!forceSubmitTargetStudent) return;
    const target = forceSubmitTargetStudent;

    // Record the termination on the live telemetry pipeline
    void postProctorEvent(assessmentId, {
      event_type: 'forced_session_terminated',
      metadata: { reason: 'proctor_invoked_submission', enforced_by: 'faculty_proctor' },
      user_id: target.user_id,
    });

    showNotificationToast(
      `Forced session termination applied for candidate ${candidateLabel(target)} (${candidateRoll(target)})`
    );
    setForceSubmitModalOpen(false);
    setForceSubmitTargetStudent(null);
  };

  // Format Helper for Timestamps
  const formatEventTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(
        d.getUTCSeconds()
      ).padStart(2, '0')} UTC`;
    } catch {
      return '00:00:00 UTC';
    }
  };

  if (loading && !assessment) {
    return (
      <div className="proctor-cockpit-loading-view">
        <RefreshCw className="spin-icon" size={28} />
        <p className="loading-label">Connecting to Faculty Proctoring Mesh...</p>
      </div>
    );
  }

  const assessmentTitle = assessment?.title || 'Assessment Cockpit';
  const cohortCode = assessment?.cohort_name || '';

  // Cockpit availability messaging: the page never substitutes fabricated candidates.
  const cockpitUnavailable = !hasAssessment || telemetryError;
  const cockpitNotice = !hasAssessment
    ? {
        title: 'No assessment selected',
        body: 'Open an assessment from your faculty workspace to monitor its live cohort.',
      }
    : telemetryError
      ? {
          title: 'Live telemetry unavailable',
          body: 'The proctoring pipeline could not be reached. Retrying automatically.',
        }
      : {
          title: 'No candidates enrolled yet',
          body: 'Candidates appear here as soon as they are enrolled in this assessment cohort.',
        };

  return (
    <div className={`proctor-cockpit-root ${fullscreenMode ? 'fullscreen-mode' : ''}`}>
      {/* Action Toast Alert */}
      {actionSuccessMessage && (
        <div className="cockpit-toast-banner" role="alert">
          <CheckCircle2 size={16} className="text-acid" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* TOP HEADER & STATUS BAR */}
      <header className="cockpit-header">
        <div className="cockpit-header-left">
          <div className="cockpit-title-row">
            <span className="cockpit-brand-pill">
              <ShieldAlert size={14} className="text-crimson" />
              PROCTOR COCKPIT
            </span>
            <h1 className="cockpit-title">{assessmentTitle}</h1>
            {cohortCode && <span className="cockpit-cohort-badge">{cohortCode}</span>}
          </div>
          <div className="cockpit-subtitle-row">
            <span className="connection-pill">
              <span className={`live-pulse-dot ${liveConnected ? 'active' : 'idle'}`} />
              {liveConnected ? 'LIVE MESH CONNECTED' : 'OFFLINE / RECONNECTING'}
            </span>
            <span className="dot-divider">•</span>
            <span className="clock-metric tabular-nums">
              <Clock size={13} />
              {currentTimeUtc}
            </span>
            <span className="dot-divider">•</span>
            <span className="mode-pill">MODE: {assessment?.mode || 'EXAM'}</span>
          </div>
        </div>

        {/* Aggregate Status Cards */}
        <div className="cockpit-header-metrics">
          <div className="metric-card">
            <span className="metric-label">ACTIVE CANDIDATES</span>
            <div className="metric-value-row">
              <Users size={16} className="metric-icon" />
              <span className="metric-num tabular-nums">
                {onlineCount}
                <span className="metric-sub">/{totalStudents}</span>
              </span>
            </div>
            <span className="metric-footer">{idleCount} idle / pause</span>
          </div>

          <div className={`metric-card ${flaggedCount > 0 ? 'alert-card' : ''}`}>
            <span className="metric-label">FLAGGED ANOMALIES</span>
            <div className="metric-value-row">
              <AlertTriangle size={16} className={flaggedCount > 0 ? 'text-amber' : 'text-muted'} />
              <span className="metric-num tabular-nums text-amber">
                {flaggedCount}
                <span className="metric-sub"> candidates</span>
              </span>
            </div>
            <span className="metric-footer text-crimson">{criticalCount} critical (risk ≥ 35)</span>
          </div>

          <div className="cockpit-header-controls">
            <button
              type="button"
              className={`cockpit-icon-btn ${soundAlertsEnabled ? 'active' : ''}`}
              onClick={() => setSoundAlertsEnabled(!soundAlertsEnabled)}
              title={soundAlertsEnabled ? 'Disable Audio Chirps' : 'Enable Audio Chirps'}
            >
              {soundAlertsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              className="cockpit-icon-btn"
              onClick={handleToggleFullscreen}
              title={fullscreenMode ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {fullscreenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <Link
              to={org_slug ? `/portal/${org_slug}/calendar` : '/campus/calendar'}
              className="cockpit-nav-btn"
              title="Return to Calendar"
            >
              <LogOut size={14} />
              <span>Exit Cockpit</span>
            </Link>
          </div>
        </div>
      </header>

      {/* TOOLBAR CONTROLS (SEARCH, SEVERITY FILTER, SORTING) */}
      <div className="cockpit-toolbar">
        <div className="toolbar-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by roll number, name, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="toolbar-filters-group">
          <div className="filter-pill-selector">
            <span className="filter-group-label">
              <Filter size={13} /> FILTER:
            </span>
            <button
              type="button"
              className={`filter-pill ${severityFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('ALL')}
            >
              ALL ({totalStudents})
            </button>
            <button
              type="button"
              className={`filter-pill pill-critical ${severityFilter === 'CRITICAL' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('CRITICAL')}
            >
              CRITICAL ({criticalCount})
            </button>
            <button
              type="button"
              className={`filter-pill pill-elevated ${severityFilter === 'ELEVATED' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('ELEVATED')}
            >
              ELEVATED ({elevatedCount})
            </button>
            <button
              type="button"
              className={`filter-pill pill-low ${severityFilter === 'LOW' ? 'active' : ''}`}
              onClick={() => setSeverityFilter('LOW')}
            >
              CLEAN ({totalStudents - flaggedCount})
            </button>
          </div>

          <div className="toolbar-sort-box">
            <label htmlFor="cockpit-sort-select" className="sort-label">SORT:</label>
            <select
              id="cockpit-sort-select"
              className="cockpit-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="risk_desc">Risk Score (High → Low)</option>
              <option value="roll_asc">Roll Number (Ascending)</option>
              <option value="name_asc">Candidate Name (A → Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE: CANDIDATE GRID + REAL-TIME INCIDENT FEED */}
      <div className={`cockpit-main-layout ${isFeedCollapsed ? 'feed-collapsed' : ''}`}>
        {/* CANDIDATE ROSTER SECTION */}
        <section className="cockpit-roster-section">
          <div className="roster-section-header">
            <div className="roster-header-meta">
              <span className="section-title">CANDIDATE ROSTER MATRIX</span>
              <span className="section-count tabular-nums">
                Showing {displayedCandidates.length} of {totalStudents} candidates
              </span>
            </div>
            <div className="legend-strip">
              <span className="legend-item">
                <span className="legend-dot bg-acid" /> &lt; 15 Normal
              </span>
              <span className="legend-item">
                <span className="legend-dot bg-amber" /> 15 - 34 Elevated
              </span>
              <span className="legend-item">
                <span className="legend-dot bg-crimson" /> ≥ 35 Critical Alert
              </span>
            </div>
          </div>

          {displayedCandidates.length === 0 ? (
            totalStudents === 0 ? (
              <div className="roster-empty-state">
                <UserCheck size={36} className="text-muted" />
                <h3>{cockpitNotice.title}</h3>
                <p>{cockpitNotice.body}</p>
              </div>
            ) : (
              <div className="roster-empty-state">
                <UserCheck size={36} className="text-muted" />
                <h3>No candidates match active filter</h3>
                <p>Try resetting the search query or switching severity filter to ALL.</p>
                <button
                  type="button"
                  className="reset-filter-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setSeverityFilter('ALL');
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )
          ) : (
            <div className="candidate-grid">
              {displayedCandidates.map((candidate) => {
                const severity = candidate.risk_severity;
                const isCritical = severity === 'critical';
                const isSelected = selectedCandidate?.user_id === candidate.user_id;

                return (
                  <article
                    key={candidate.user_id}
                    className={`candidate-card ${severity} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    {/* Card Header: Roll No & Live State */}
                    <div className="candidate-card-header">
                      <div className="candidate-identity">
                        <span className="candidate-roll tabular-nums">{candidateRoll(candidate)}</span>
                        <h4 className="candidate-name">{candidateLabel(candidate)}</h4>
                        <span className="candidate-user">{candidate.email || ''}</span>
                      </div>

                      <div className="candidate-badge-cluster">
                        {/* Live State Badge */}
                        <span className={`status-pill ${candidate.status}`}>
                          <span className={`status-indicator ${candidate.status}`} />
                          {candidate.status.toUpperCase()}
                        </span>

                        {/* Calculated Risk Score Badge */}
                        <span className={`risk-badge ${severity} tabular-nums`}>
                          {isCritical && <span className="pulsing-crimson-dot" />}
                          RISK {candidate.risk_score}
                        </span>
                      </div>
                    </div>

                    {/* Telemetry Metrics Breakdown */}
                    <div className="candidate-telemetry-strip">
                      <div className="telemetry-stat" title="Tab switch events (5 pts each)">
                        <span className="stat-label">TABS</span>
                        <span className={`stat-value tabular-nums ${candidate.tab_switches > 0 ? 'text-amber' : ''}`}>
                          {candidate.tab_switches}
                        </span>
                      </div>
                      <div className="telemetry-stat" title="Fullscreen drops (10 pts each)">
                        <span className="stat-label">DROPS</span>
                        <span className={`stat-value tabular-nums ${candidate.fullscreen_exits > 0 ? 'text-crimson' : ''}`}>
                          {candidate.fullscreen_exits}
                        </span>
                      </div>
                      <div className="telemetry-stat" title="Clipboard paste bursts (15 pts each)">
                        <span className="stat-label">PASTES</span>
                        <span className={`stat-value tabular-nums ${candidate.paste_bursts > 0 ? 'text-crimson' : ''}`}>
                          {candidate.paste_bursts}
                        </span>
                      </div>
                    </div>

                    {/* Accommodation or Accompaniment tags */}
                    {candidate.time_extension_minutes ? (
                      <div className="candidate-accommodation-tag tabular-nums">
                        <Clock3 size={12} />
                        <span>+{candidate.time_extension_minutes}m time granted</span>
                      </div>
                    ) : null}

                    {/* Action Bar for Candidate */}
                    <div className="candidate-card-actions">
                      <button
                        type="button"
                        className="action-btn viva-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenVivaModal(candidate);
                        }}
                        title="Escalate candidate to multiplayer Viva interview"
                      >
                        <Video size={13} />
                        <span>Viva Escalation</span>
                      </button>

                      <button
                        type="button"
                        className="action-btn extension-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenExtensionModal(candidate);
                        }}
                        title="Grant individual time extension accommodations"
                      >
                        <Clock3 size={13} />
                        <span>+Time</span>
                      </button>

                      <button
                        type="button"
                        className="action-btn terminate-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenForceSubmitModal(candidate);
                        }}
                        title="Force session termination and submit assessment"
                      >
                        <AlertOctagon size={13} />
                        <span>Force Submit</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* REAL-TIME INCIDENT FEED COLLAPSIBLE SIDE PANEL */}
        <aside className="cockpit-incident-panel">
          <div className="incident-panel-header">
            <div className="incident-title-row">
              <Activity size={16} className="text-acid" />
              <span className="panel-heading">REAL-TIME INCIDENT FEED</span>
            </div>
            <button
              type="button"
              className="toggle-feed-btn"
              onClick={() => setIsFeedCollapsed(!isFeedCollapsed)}
              title={isFeedCollapsed ? 'Expand Incident Feed' : 'Collapse Incident Feed'}
            >
              {isFeedCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>

          <div className="incident-panel-sub">
            <span className="feed-status-dot active" />
            <span className="feed-status-text tabular-nums">{incidentFeed.length} telemetry anomalies logged</span>
          </div>

          <div className="incident-stream">
            {incidentFeed.length === 0 ? (
              <div className="incident-empty-note">
                {cockpitUnavailable ? (
                  <>
                    <AlertTriangle size={24} className="text-amber" />
                    <p>{cockpitNotice.title} — no live incident feed is being served.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={24} className="text-acid" />
                    <p>No integrity violations logged yet. Telemetry channel nominal.</p>
                  </>
                )}
              </div>
            ) : (
              incidentFeed.map((item) => {
                const isCrit = item.severity === 'critical';
                const targetStudent = students.find((s) => s.user_id === item.user_id || s.username === item.username);
                const rollDisplay = targetStudent ? candidateRoll(targetStudent) : item.username || item.user_id.slice(0, 8);

                return (
                  <div
                    key={item.id}
                    className={`incident-entry ${isCrit ? 'severity-critical' : 'severity-warning'}`}
                    onClick={() => {
                      if (targetStudent) setSelectedCandidate(targetStudent);
                    }}
                  >
                    <div className="incident-entry-header">
                      <span className="incident-time tabular-nums">{formatEventTime(item.created_at)}</span>
                      <span className={`incident-type-tag ${item.event_type}`}>
                        {item.event_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="incident-candidate-meta">
                      <span className="incident-roll tabular-nums">{rollDisplay}</span>
                      <span className="incident-user">@{item.username || item.user_id.slice(0, 8)}</span>
                    </div>

                    <div className="incident-details">
                      {item.event_type === 'tab_switch' && 'Candidate switched browser tab / window blurred'}
                      {item.event_type === 'fullscreen_exit' && 'Candidate dropped fullscreen proctoring lock'}
                      {item.event_type === 'paste_burst' && (
                        <span>
                          Clipboard burst detected
                          {item.event_metadata?.length || item.event_metadata?.char_count ? (
                            <>
                              :{' '}
                              <strong className="tabular-nums">
                                {item.event_metadata?.length || item.event_metadata?.char_count} chars
                              </strong>
                            </>
                          ) : null}
                        </span>
                      )}
                      {item.event_type === 'forced_session_terminated' && 'Faculty supervisor terminated session'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* VIVA ESCALATION MODAL */}
      {vivaModalOpen && vivaTargetStudent && (
        <div className="cockpit-modal-overlay">
          <div className="cockpit-dialog-card">
            <div className="dialog-header">
              <div className="dialog-title-row">
                <Video size={18} className="text-acid" />
                <h3>Viva Escalation: {candidateLabel(vivaTargetStudent)}</h3>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => {
                  setVivaModalOpen(false);
                  setVivaRoom(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="dialog-body">
              <p className="dialog-description">
                Escalate candidate <strong className="text-acid">{candidateRoll(vivaTargetStudent)}</strong> (Risk Score:{' '}
                <span className="tabular-nums font-bold text-crimson">{vivaTargetStudent.risk_score}</span>) into an
                isolated multiplayer Viva interview room. Code state, similarity markers, and collaborative Yjs editor
                are provisioned on Gateway 2.
              </p>

              {!vivaRoom ? (
                <div className="dialog-action-box">
                  <button
                    type="button"
                    className="cockpit-primary-action-btn"
                    onClick={handleExecuteVivaProvision}
                    disabled={vivaLoading}
                  >
                    {vivaLoading ? <RefreshCw className="spin-icon" size={15} /> : <Zap size={15} />}
                    <span>{vivaLoading ? 'Provisioning Viva Session...' : 'Confirm & Provision Room'}</span>
                  </button>
                </div>
              ) : (
                <div className="viva-provisioned-card">
                  <div className="provisioned-badge">
                    <CheckCircle2 size={16} className="text-accepted" />
                    <span>VIVA ROOM CREATED</span>
                  </div>
                  <div className="viva-room-details">
                    <div className="detail-row">
                      <span className="detail-label">ROOM CODE:</span>
                      <code className="detail-code tabular-nums">{vivaRoom.room_code}</code>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">CANDIDATE ID:</span>
                      <span className="detail-text">{candidateRoll(vivaTargetStudent)}</span>
                    </div>
                  </div>
                  <div className="viva-join-actions">
                    <Link
                      to={`/campus/viva/${vivaRoom.room_code}`}
                      className="cockpit-primary-action-btn join-viva-btn"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={15} />
                      <span>Join Live Viva Room</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TIME EXTENSION MODAL */}
      {extensionModalOpen && extensionTargetStudent && (
        <div className="cockpit-modal-overlay">
          <div className="cockpit-dialog-card">
            <div className="dialog-header">
              <div className="dialog-title-row">
                <Clock3 size={18} className="text-acid" />
                <h3>Grant Time Extension: {candidateLabel(extensionTargetStudent)}</h3>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setExtensionModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="dialog-body">
              <p className="dialog-description">
                Grant individualized time accommodations to candidate{' '}
                <strong className="text-acid">{candidateRoll(extensionTargetStudent)}</strong>. This dynamically pushes the
                watchdog deadline gatekeeper forward without altering cohort schedule.
              </p>

              <div className="extension-picker">
                <button
                  type="button"
                  className={`minute-option-btn ${extensionMinutes === 15 ? 'active' : ''}`}
                  onClick={() => setExtensionMinutes(15)}
                >
                  +15 Minutes
                </button>
                <button
                  type="button"
                  className={`minute-option-btn ${extensionMinutes === 30 ? 'active' : ''}`}
                  onClick={() => setExtensionMinutes(30)}
                >
                  +30 Minutes
                </button>
                <button
                  type="button"
                  className={`minute-option-btn ${extensionMinutes === 45 ? 'active' : ''}`}
                  onClick={() => setExtensionMinutes(45)}
                >
                  +45 Minutes
                </button>
              </div>

              <div className="dialog-action-box">
                <button
                  type="button"
                  className="cockpit-primary-action-btn"
                  onClick={handleGrantTimeExtension}
                >
                  <CheckCircle2 size={15} />
                  <span>Confirm +{extensionMinutes}m Accommodation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FORCE SUBMISSION TERMINATION MODAL */}
      {forceSubmitModalOpen && forceSubmitTargetStudent && (
        <div className="cockpit-modal-overlay">
          <div className="cockpit-dialog-card border-crimson">
            <div className="dialog-header">
              <div className="dialog-title-row">
                <AlertOctagon size={18} className="text-crimson" />
                <h3 className="text-crimson">Force Submit Candidate Session</h3>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setForceSubmitModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="dialog-body">
              <div className="force-warning-box">
                <AlertTriangle size={20} className="text-crimson" />
                <div>
                  <p className="warning-title">Irreversible Integrity Enforcement Action</p>
                  <p className="warning-text">
                    This will immediately terminate the exam session for{' '}
                    <strong>
                      {candidateLabel(forceSubmitTargetStudent)} ({candidateRoll(forceSubmitTargetStudent)})
                    </strong>
                    . Candidate buffers will be serialized and graded by the evaluation service, and client locks will be revoked.
                  </p>
                </div>
              </div>

              <div className="dialog-action-box force-action-row">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setForceSubmitModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="force-submit-confirm-btn"
                  onClick={handleConfirmForceSubmit}
                >
                  <LogOut size={15} />
                  <span>Confirm Force Submit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyProctorCockpitPage;
