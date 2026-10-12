import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  provisionVivaRoom,
  connectProctoringWebSocket,
  MOCK_ASSESSMENTS,
} from '../../services/campusApi';

export const calculateRiskScore = (tabSwitches: number, fullscreenDrops: number, pasteBursts: number): number => {
  return (Number(tabSwitches) || 0) * 5 + (Number(fullscreenDrops) || 0) * 10 + (Number(pasteBursts) || 0) * 15;
};

export const resolveRiskSeverity = (score: number): 'low' | 'elevated' | 'critical' => {
  if (score >= 35) return 'critical';
  if (score >= 15) return 'elevated';
  return 'low';
};

export const FacultyProctorCockpitPage: React.FC = () => {
  const { id, org_slug } = useParams<{ id: string; org_slug?: string }>();
  const assessmentId = id || 'a1111111-1111-4111-8111-111111111111';

  // Core Data State
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [students, setStudents] = useState<ProctoredCandidateState[]>([]);
  const [incidentFeed, setIncidentFeed] = useState<ProctorEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
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

  const wsRef = useRef<WebSocket | null>(null);

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
          setAssessment(assessmentData || MOCK_ASSESSMENTS[0]);
          setStudents(studentsData);
          setIncidentFeed(eventsData);
        }
      } catch (err) {
        console.error('Failed to load cockpit data:', err);
        if (mounted) {
          setAssessment(MOCK_ASSESSMENTS[0]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [assessmentId]);

  // Live WebSocket Connection Hook
  useEffect(() => {
    let socket: WebSocket | null = null;
    try {
      socket = connectProctoringWebSocket(
        assessmentId,
        (message: any) => {
          if (!message) return;

          if (message.event_type === 'active_students_snapshot' && Array.isArray(message.data)) {
            setStudents((prev) => {
              const updated = [...prev];
              message.data.forEach((incoming: any) => {
                const idx = updated.findIndex((s) => s.user_id === incoming.user_id);
                if (idx >= 0) {
                  updated[idx] = {
                    ...updated[idx],
                    ...incoming,
                    risk_score: calculateRiskScore(
                      incoming.tab_switches ?? updated[idx].tab_switches,
                      incoming.fullscreen_exits ?? updated[idx].fullscreen_exits,
                      incoming.paste_bursts ?? updated[idx].paste_bursts
                    ),
                  };
                }
              });
              return updated;
            });
            setWsConnected(true);
          } else if (
            message.event_type === 'tab_switch' ||
            message.event_type === 'fullscreen_exit' ||
            message.event_type === 'paste_burst'
          ) {
            const targetUserId = message.user_id;
            const targetUsername = message.username;

            setStudents((prev) =>
              prev.map((student) => {
                if (student.user_id === targetUserId || student.username === targetUsername) {
                  const updated: ProctoredCandidateState = { ...student };
                  if (message.event_type === 'tab_switch') updated.tab_switches = (updated.tab_switches || 0) + 1;
                  if (message.event_type === 'fullscreen_exit') updated.fullscreen_exits = (updated.fullscreen_exits || 0) + 1;
                  if (message.event_type === 'paste_burst') updated.paste_bursts = (updated.paste_bursts || 0) + 1;
                  updated.risk_score = calculateRiskScore(
                    updated.tab_switches,
                    updated.fullscreen_exits,
                    updated.paste_bursts
                  );
                  updated.last_seen = message.timestamp || new Date().toISOString();
                  return updated;
                }
                return student;
              })
            );

            // Record into Real-time Incident Feed
            const calculatedScore = message.risk_score || 0;
            const severity: 'critical' | 'warning' | 'info' =
              calculatedScore >= 35 || message.event_type === 'paste_burst' ? 'critical' : 'warning';

            const newEvent: ProctorEventItem = {
              id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              assessment_id: assessmentId,
              user_id: targetUserId || 'unknown',
              username: targetUsername || 'candidate',
              event_type: message.event_type,
              severity: severity,
              event_metadata: message.metadata || {},
              created_at: message.timestamp || new Date().toISOString(),
            };

            setIncidentFeed((prev) => [newEvent, ...prev].slice(0, 100));

            // Optional Audio Chirp for Critical Breaches
            if (severity === 'critical' && soundAlertsEnabled && typeof window !== 'undefined' && window.AudioContext) {
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
            }
          } else if (message.event_type === 'heartbeat') {
            setStudents((prev) =>
              prev.map((student) => {
                if (student.user_id === message.user_id || student.username === message.username) {
                  return {
                    ...student,
                    status: 'connected',
                    last_seen: message.timestamp || new Date().toISOString(),
                  };
                }
                return student;
              })
            );
          }
        },
        () => {
          setWsConnected(false);
        }
      );
      wsRef.current = socket;
      setWsConnected(true);
    } catch (e) {
      console.warn('Proctoring WebSocket connection failed:', e);
      setWsConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [assessmentId, soundAlertsEnabled]);

  // Aggregate Metrics & Counts
  const totalStudents = students.length;
  const onlineCount = useMemo(() => students.filter((s) => s.status === 'connected').length, [students]);
  const idleCount = useMemo(() => students.filter((s) => s.status === 'idle').length, [students]);
  const criticalCount = useMemo(() => students.filter((s) => s.risk_score >= 35).length, [students]);
  const elevatedCount = useMemo(
    () => students.filter((s) => s.risk_score >= 15 && s.risk_score < 35).length,
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
          s.roll_number.toLowerCase().includes(q) ||
          s.full_name.toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q)
      );
    }

    // Severity Filter
    if (severityFilter === 'CRITICAL') {
      result = result.filter((s) => s.risk_score >= 35);
    } else if (severityFilter === 'ELEVATED') {
      result = result.filter((s) => s.risk_score >= 15 && s.risk_score < 35);
    } else if (severityFilter === 'LOW') {
      result = result.filter((s) => s.risk_score < 15);
    } else if (severityFilter === 'DISCONNECTED') {
      result = result.filter((s) => s.status === 'disconnected');
    }

    // Sorting
    if (sortBy === 'risk_desc') {
      result.sort((a, b) => b.risk_score - a.risk_score);
    } else if (sortBy === 'roll_asc') {
      result.sort((a, b) => a.roll_number.localeCompare(b.roll_number));
    } else if (sortBy === 'name_asc') {
      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
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
      showNotificationToast(`Viva room provisioned for ${vivaTargetStudent.full_name}: ${room.room_code}`);
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
      `Granted +${extensionMinutes}m extension to ${extensionTargetStudent.full_name} (${extensionTargetStudent.roll_number})`
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
    setStudents((prev) =>
      prev.map((s) => {
        if (s.user_id === forceSubmitTargetStudent.user_id) {
          return {
            ...s,
            status: 'disconnected',
          };
        }
        return s;
      })
    );

    // Record violation termination event
    const forcedEvent: ProctorEventItem = {
      id: `ev-${Date.now()}-forced`,
      assessment_id: assessmentId,
      user_id: forceSubmitTargetStudent.user_id,
      username: forceSubmitTargetStudent.username,
      event_type: 'forced_session_terminated',
      severity: 'critical',
      event_metadata: { reason: 'proctor_invoked_submission', enforced_by: 'faculty_proctor' },
      created_at: new Date().toISOString(),
    };
    setIncidentFeed((prev) => [forcedEvent, ...prev]);

    showNotificationToast(
      `Forced session termination applied for candidate ${forceSubmitTargetStudent.full_name} (${forceSubmitTargetStudent.roll_number})`
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

  const assessmentTitle = assessment?.title || 'Midterm 1: Dynamic Programming & Graphs';
  const cohortCode = assessment?.cohort_name || 'CS301-FALL26';

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
            <span className="cockpit-cohort-badge">{cohortCode}</span>
          </div>
          <div className="cockpit-subtitle-row">
            <span className="connection-pill">
              <span className={`live-pulse-dot ${wsConnected ? 'active' : 'idle'}`} />
              {wsConnected ? 'LIVE MESH CONNECTED' : 'OFFLINE / RECONNECTING'}
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
          ) : (
            <div className="candidate-grid">
              {displayedCandidates.map((candidate) => {
                const severity = resolveRiskSeverity(candidate.risk_score);
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
                        <span className="candidate-roll tabular-nums">{candidate.roll_number}</span>
                        <h4 className="candidate-name">{candidate.full_name}</h4>
                        <span className="candidate-user">@{candidate.username}</span>
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
                <CheckCircle2 size={24} className="text-acid" />
                <p>No integrity violations logged yet. Telemetry channel nominal.</p>
              </div>
            ) : (
              incidentFeed.map((item) => {
                const isCrit = item.severity === 'critical';
                const targetStudent = students.find((s) => s.user_id === item.user_id || s.username === item.username);
                const rollDisplay = targetStudent?.roll_number || item.username;

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
                      <span className="incident-user">@{item.username}</span>
                    </div>

                    <div className="incident-details">
                      {item.event_type === 'tab_switch' && 'Candidate switched browser tab / window blurred'}
                      {item.event_type === 'fullscreen_exit' && 'Candidate dropped fullscreen proctoring lock'}
                      {item.event_type === 'paste_burst' && (
                        <span>
                          Clipboard burst detected:{' '}
                          <strong className="tabular-nums">{item.event_metadata?.char_count || 140} chars</strong>
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
                <h3>Viva Escalation: {vivaTargetStudent.full_name}</h3>
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
                Escalate candidate <strong className="text-acid">{vivaTargetStudent.roll_number}</strong> (Risk Score:{' '}
                <span className="tabular-nums font-bold text-crimson">{vivaTargetStudent.risk_score}</span>) into an
                isolated multiplayer Viva interview room. Code state, AST winnowing markers, and collaborative Yjs editor
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
                      <span className="detail-text">{vivaTargetStudent.roll_number}</span>
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
                <h3>Grant Time Extension: {extensionTargetStudent.full_name}</h3>
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
                <strong className="text-acid">{extensionTargetStudent.roll_number}</strong>. This dynamically pushes the
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
                      {forceSubmitTargetStudent.full_name} ({forceSubmitTargetStudent.roll_number})
                    </strong>
                    . Candidate buffers will be serialized and graded in worker daemons, and client locks will be revoked.
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
