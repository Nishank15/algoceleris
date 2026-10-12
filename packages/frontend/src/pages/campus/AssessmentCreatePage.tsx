import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Shield,
  BookOpen,
  Video,
  ArrowRight,
  Search,
  Sparkles,
} from 'lucide-react';
import { PROBLEMS } from '../../constants/problems';
import {
  AssessmentMode,
  RubricCriterion,
  createAssessment,
  validateTimeline,
  calculateRubricTotal,
  MOCK_COHORTS,
} from '../../services/campusApi';

export const AssessmentCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { org_slug } = useParams<{ org_slug?: string }>();

  // Cohort & General Metadata
  const [selectedCohortId, setSelectedCohortId] = useState<string>(MOCK_COHORTS[0].id);
  const [title, setTitle] = useState<string>('Midterm Assessment: Data Structures & Algorithms');
  const [description, setDescription] = useState<string>(
    'Comprehensive institutional evaluation on Graph algorithms, Dynamic Programming, and Amortized Analysis.'
  );
  const [mode, setMode] = useState<AssessmentMode>('EXAM');

  // Timeline (default: publish now, starts in 1h, due in 3h, cutoff in 5h)
  const formatDatetimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const defaultBase = useMemo(() => new Date(), []);
  const [publishAt, setPublishAt] = useState<string>(
    formatDatetimeLocal(new Date(defaultBase.getTime()))
  );
  const [startsAt, setStartsAt] = useState<string>(
    formatDatetimeLocal(new Date(defaultBase.getTime() + 3600 * 1000))
  );
  const [dueAt, setDueAt] = useState<string>(
    formatDatetimeLocal(new Date(defaultBase.getTime() + 3 * 3600 * 1000))
  );
  const [cutoffAt, setCutoffAt] = useState<string>(
    formatDatetimeLocal(new Date(defaultBase.getTime() + 5 * 3600 * 1000))
  );

  // Exam duration & late penalty
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [latePenaltyPerHour, setLatePenaltyPerHour] = useState<number>(10.0);
  const [maxLatePenalty, setMaxLatePenalty] = useState<number>(50.0);

  // Problem Catalog Selection
  const [selectedProblems, setSelectedProblems] = useState<string[]>([
    'two-sum',
    'longest-increasing-subsequence',
  ]);
  const [problemSearch, setProblemSearch] = useState<string>('');

  // Rubric Builder
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([
    { id: '1', title: 'Automated Test Suite (Functional)', weightPercent: 60, description: 'All public and hidden test cases' },
    { id: '2', title: 'Time & Space Complexity', weightPercent: 25, description: 'Meets O(N log N) asymptotic bound' },
    { id: '3', title: 'Cleanliness & Idiomatic Style', weightPercent: 15, description: 'Modular abstractions and formatting' },
  ]);

  // Proctoring Settings
  const [enforceFullscreen, setEnforceFullscreen] = useState<boolean>(true);
  const [trackTabSwitches, setTrackTabSwitches] = useState<boolean>(true);
  const [blockPasteBurst, setBlockPasteBurst] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Timeline Instant Validation
  const timelineValidation = useMemo(() => {
    return validateTimeline(publishAt, startsAt, dueAt, cutoffAt);
  }, [publishAt, startsAt, dueAt, cutoffAt]);

  // Rubric Total Weight
  const rubricTotalWeight = useMemo(() => {
    return calculateRubricTotal(rubricCriteria);
  }, [rubricCriteria]);

  // Filtered problems list
  const filteredProblems = useMemo(() => {
    const q = problemSearch.toLowerCase().trim();
    if (!q) return PROBLEMS;
    return PROBLEMS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [problemSearch]);

  // Handlers for Rubric
  const handleAddCriterion = () => {
    const currentSum = calculateRubricTotal(rubricCriteria);
    const remaining = Math.max(0, 100 - currentSum);
    const newId = String(Date.now());
    setRubricCriteria([
      ...rubricCriteria,
      { id: newId, title: 'New Evaluation Criterion', weightPercent: remaining || 10 },
    ]);
  };

  const handleUpdateCriterion = (id: string, field: keyof RubricCriterion, value: any) => {
    setRubricCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveCriterion = (id: string) => {
    if (rubricCriteria.length <= 1) return;
    setRubricCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  // Toggle problem selection
  const toggleProblem = (slug: string) => {
    setSelectedProblems((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!timelineValidation.isValid) {
      setSubmitError(timelineValidation.error || 'Timeline validation failed.');
      return;
    }
    if (rubricTotalWeight !== 100) {
      setSubmitError(`Rubric weights sum to ${rubricTotalWeight}%. They must total exactly 100%.`);
      return;
    }
    if (selectedProblems.length === 0) {
      setSubmitError('Select at least one problem for this assessment.');
      return;
    }

    setSubmitting(true);
    try {
      await createAssessment(selectedCohortId, {
        title,
        description,
        mode,
        problem_slugs: selectedProblems,
        scoring_rubric: {
          criteria: rubricCriteria,
          totalWeight: rubricTotalWeight,
        },
        publish_at: new Date(publishAt).toISOString(),
        starts_at: new Date(startsAt).toISOString(),
        due_at: new Date(dueAt).toISOString(),
        cutoff_at: new Date(cutoffAt).toISOString(),
        duration_minutes: isTimed && mode === 'EXAM' ? durationMinutes : null,
        late_penalty_percent_per_hour: mode === 'HOMEWORK' ? latePenaltyPerHour : 0.0,
        max_late_penalty_percent: mode === 'HOMEWORK' ? maxLatePenalty : 0.0,
        proctoring_config: {
          enforce_fullscreen: mode === 'EXAM' ? enforceFullscreen : false,
          track_tab_switches: mode === 'EXAM' ? trackTabSwitches : false,
          block_paste_burst: mode === 'EXAM' ? blockPasteBurst : false,
        },
        status: 'SCHEDULED',
      });

      // Redirect to Calendar
      const targetUrl = org_slug ? `/portal/${org_slug}/calendar` : '/campus/calendar';
      navigate(targetUrl);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to schedule assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="campus-studio-root">
      <div className="campus-studio-container">
        {/* Header Breadcrumb & Actions */}
        <div className="campus-studio-header">
          <div>
            <div className="campus-studio-eyebrow">
              <span className="campus-eyebrow-badge">INSTITUTIONAL PORTAL</span>
              <span>/</span>
              <span>ASSESSMENT STUDIO</span>
            </div>
            <h1 className="campus-studio-title">Faculty Assessment Studio</h1>
            <p className="campus-studio-subtitle">
              Configure proctored exam conditions, problem sets, timeline gatekeepers, and grading rubrics.
            </p>
          </div>
          <div className="campus-studio-header-actions">
            <Link to={org_slug ? `/portal/${org_slug}/calendar` : '/campus/calendar'} className="btn-secondary-link">
              <Calendar size={14} />
              <span>Campus Calendar</span>
            </Link>
          </div>
        </div>

        {submitError && (
          <div className="campus-alert-banner error" role="alert">
            <AlertTriangle size={16} />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="campus-studio-form">
          {/* 1. Mode & Target Cohort */}
          <section className="campus-studio-card">
            <div className="card-header-clean">
              <div className="card-title-group">
                <span className="step-num-pill">01</span>
                <div>
                  <h2 className="card-heading">ASSESSMENT TYPE & COHORT</h2>
                  <p className="card-subtext">Choose the operational evaluation mode and target roster.</p>
                </div>
              </div>
            </div>

            <div className="mode-toggle-grid">
              <button
                type="button"
                className={`mode-card ${mode === 'EXAM' ? 'active' : ''}`}
                onClick={() => setMode('EXAM')}
              >
                <div className="mode-card-header">
                  <Shield size={20} className="mode-icon" />
                  <span className="mode-pill">SYNCHRONOUS</span>
                </div>
                <div className="mode-card-body">
                  <span className="mode-name">EXAM</span>
                  <p className="mode-desc">
                    Strict timed environment with fullscreen watchdog, auto-submit timer, and telemetry proctoring.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className={`mode-card ${mode === 'HOMEWORK' ? 'active' : ''}`}
                onClick={() => setMode('HOMEWORK')}
              >
                <div className="mode-card-header">
                  <BookOpen size={20} className="mode-icon" />
                  <span className="mode-pill">ASYNCHRONOUS</span>
                </div>
                <div className="mode-card-body">
                  <span className="mode-name">HOMEWORK</span>
                  <p className="mode-desc">
                    Take-home problem set with soft due date and automated hourly late penalty deduction curve.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className={`mode-card ${mode === 'VIVA' ? 'active' : ''}`}
                onClick={() => setMode('VIVA')}
              >
                <div className="mode-card-header">
                  <Video size={20} className="mode-icon" />
                  <span className="mode-pill">COLLABORATIVE</span>
                </div>
                <div className="mode-card-body">
                  <span className="mode-name">VIVA</span>
                  <p className="mode-desc">
                    1-on-1 collaborative code interview with Yjs CRDT multiplayer Monaco editor and private rubric scoring.
                  </p>
                </div>
              </button>
            </div>

            <div className="form-row-duo">
              <div className="form-group">
                <label className="linear-label" htmlFor="cohort-select">Target Cohort</label>
                <select
                  id="cohort-select"
                  className="linear-select"
                  value={selectedCohortId}
                  onChange={(e) => setSelectedCohortId(e.target.value)}
                >
                  {MOCK_COHORTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) - {c.term}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="linear-label" htmlFor="assessment-title">Assessment Title</label>
                <input
                  id="assessment-title"
                  type="text"
                  className="linear-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midterm 1: Dynamic Programming"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="linear-label" htmlFor="assessment-desc">Instructions & Description</label>
              <textarea
                id="assessment-desc"
                className="linear-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Guidelines, allowed documentation, and submission protocol..."
              />
            </div>
          </section>

          {/* 2. Timeline Gatekeeper */}
          <section className="campus-studio-card">
            <div className="card-header-clean">
              <div className="card-title-group">
                <span className="step-num-pill">02</span>
                <div>
                  <h2 className="card-heading">TIMELINE GATEKEEPER</h2>
                  <p className="card-subtext">
                    Enforces mathematical invariant: <code className="formula-code">publish_at &le; starts_at &le; due_at &le; cutoff_at</code>.
                  </p>
                </div>
              </div>
              <div className={`validation-indicator ${timelineValidation.isValid ? 'valid' : 'invalid'}`}>
                {timelineValidation.isValid ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>TIMELINE VALID</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} />
                    <span>TIMELINE VIOLATION</span>
                  </>
                )}
              </div>
            </div>

            {!timelineValidation.isValid && (
              <div className="timeline-error-box">
                <AlertTriangle size={14} />
                <span>{timelineValidation.error}</span>
              </div>
            )}

            <div className="timeline-inputs-grid">
              <div className="timeline-col">
                <label className="linear-label" htmlFor="publish_at">
                  <span>1. Publish At</span>
                  <span className="label-hint">Visible in catalog</span>
                </label>
                <input
                  id="publish_at"
                  name="publish_at"
                  type="datetime-local"
                  className={`linear-input tabular-nums ${!timelineValidation.isValid ? 'input-warn' : ''}`}
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  required
                />
              </div>

              <div className="timeline-col">
                <label className="linear-label" htmlFor="starts_at">
                  <span>2. Starts At</span>
                  <span className="label-hint">Submissions open</span>
                </label>
                <input
                  id="starts_at"
                  name="starts_at"
                  type="datetime-local"
                  className={`linear-input tabular-nums ${!timelineValidation.isValid ? 'input-warn' : ''}`}
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </div>

              <div className="timeline-col">
                <label className="linear-label" htmlFor="due_at">
                  <span>3. Due At</span>
                  <span className="label-hint">Grace period starts</span>
                </label>
                <input
                  id="due_at"
                  name="due_at"
                  type="datetime-local"
                  className={`linear-input tabular-nums ${!timelineValidation.isValid ? 'input-warn' : ''}`}
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  required
                />
              </div>

              <div className="timeline-col">
                <label className="linear-label" htmlFor="cutoff_at">
                  <span>4. Cutoff At</span>
                  <span className="label-hint">Hard closure</span>
                </label>
                <input
                  id="cutoff_at"
                  name="cutoff_at"
                  type="datetime-local"
                  className={`linear-input tabular-nums ${!timelineValidation.isValid ? 'input-warn' : ''}`}
                  value={cutoffAt}
                  onChange={(e) => setCutoffAt(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Duration & Late Penalty Sliders */}
            <div className="timeline-sub-config">
              {mode === 'EXAM' && (
                <div className="duration-box">
                  <div className="duration-header">
                    <Clock size={16} />
                    <span className="duration-title">EXAM DURATION LIMIT</span>
                  </div>
                  <div className="duration-controls">
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        checked={isTimed}
                        onChange={(e) => setIsTimed(e.target.checked)}
                      />
                      <span>Enforce individual timer</span>
                    </label>
                    {isTimed && (
                      <div className="duration-input-cluster">
                        <input
                          id="duration_minutes"
                          name="duration_minutes"
                          type="number"
                          min="15"
                          max="480"
                          step="15"
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
                          className="linear-input duration-num tabular-nums"
                        />
                        <span className="unit-label">minutes</span>
                        <div className="preset-pills">
                          {[60, 90, 120, 180].map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={`pill-btn ${durationMinutes === m ? 'active' : ''}`}
                              onClick={() => setDurationMinutes(m)}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mode === 'HOMEWORK' && (
                <div className="penalty-box">
                  <div className="penalty-header">
                    <span className="penalty-title">LATE PENALTY SLIDERS</span>
                    <span className="penalty-badge">FORMULA: Raw &times; (1 - min(Cap, Hours &times; Rate))</span>
                  </div>
                  <div className="penalty-sliders-grid">
                    <div className="slider-item">
                      <div className="slider-label-row">
                        <span className="slider-label">Penalty Rate / Hour</span>
                        <span className="slider-val tabular-nums">{latePenaltyPerHour}%/hr</span>
                      </div>
                      <input
                        id="late_penalty_percent_per_hour"
                        name="late_penalty_percent_per_hour"
                        type="range"
                        min="0"
                        max="30"
                        step="1"
                        value={latePenaltyPerHour}
                        onChange={(e) => setLatePenaltyPerHour(Number(e.target.value))}
                        className="linear-range"
                      />
                    </div>

                    <div className="slider-item">
                      <div className="slider-label-row">
                        <span className="slider-label">Max Penalty Cap</span>
                        <span className="slider-val tabular-nums">{maxLatePenalty}%</span>
                      </div>
                      <input
                        id="max_late_penalty_percent"
                        name="max_late_penalty_percent"
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={maxLatePenalty}
                        onChange={(e) => setMaxLatePenalty(Number(e.target.value))}
                        className="linear-range"
                      />
                    </div>
                  </div>
                  <div className="penalty-simulation-callout">
                    <span className="sim-pill">SIMULATION</span>
                    <span>
                      A submission 2 hours past Due Date receives a{' '}
                      <strong>{Math.min(maxLatePenalty, 2 * latePenaltyPerHour)}%</strong> deduction. A raw 100/100 score converts to{' '}
                      <strong>{100 - Math.min(maxLatePenalty, 2 * latePenaltyPerHour)} pts</strong>.
                    </span>
                  </div>
                </div>
              )}

              {mode === 'EXAM' && (
                <div className="proctoring-toggle-cluster">
                  <span className="proctor-cluster-title">INTEGRITY & PROCTORING CONTROLS</span>
                  <div className="proctor-switches">
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={enforceFullscreen}
                        onChange={(e) => setEnforceFullscreen(e.target.checked)}
                      />
                      <span>Enforce Fullscreen API Lock</span>
                    </label>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={trackTabSwitches}
                        onChange={(e) => setTrackTabSwitches(e.target.checked)}
                      />
                      <span>Log Tab Switch Anomaly Telemetry</span>
                    </label>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={blockPasteBurst}
                        onChange={(e) => setBlockPasteBurst(e.target.checked)}
                      />
                      <span>Flag Rapid Paste Bursts (&gt;50 chars)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. Problem Selector */}
          <section className="campus-studio-card">
            <div className="card-header-clean">
              <div className="card-title-group">
                <span className="step-num-pill">03</span>
                <div>
                  <h2 className="card-heading">PROBLEM SELECTION CATALOG</h2>
                  <p className="card-subtext">Choose institutional challenge set from problem bank.</p>
                </div>
              </div>
              <span className="counter-pill tabular-nums" id="selected-problems-counter">
                {selectedProblems.length} SELECTED
              </span>
            </div>

            {/* Selected Problems Pills */}
            <div className="selected-problem-pills" id="selected-problem-pills-container">
              {selectedProblems.map((slug) => {
                const prob = PROBLEMS.find((p) => p.id === slug);
                return (
                  <div key={slug} className="prob-chip">
                    <span className={`diff-dot ${prob?.difficulty.toLowerCase() || 'medium'}`} />
                    <span className="prob-chip-title">{prob ? prob.title : slug}</span>
                    <button
                      type="button"
                      className="prob-chip-remove"
                      onClick={() => toggleProblem(slug)}
                      aria-label={`Remove problem ${slug}`}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Catalog Search & Grid */}
            <div className="catalog-browser">
              <div className="search-bar-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  className="linear-input search-input"
                  placeholder="Search problem catalog by title, tag, or slug..."
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                />
              </div>

              <div className="catalog-items-scroll">
                {filteredProblems.map((prob) => {
                  const isChecked = selectedProblems.includes(prob.id);
                  return (
                    <div
                      key={prob.id}
                      className={`catalog-row ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleProblem(prob.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="catalog-checkbox"
                      />
                      <div className="catalog-row-info">
                        <span className="catalog-row-title">{prob.title}</span>
                        <div className="catalog-row-meta">
                          <span className={`diff-pill ${prob.difficulty.toLowerCase()}`}>
                            {prob.difficulty}
                          </span>
                          {prob.tags.slice(0, 2).map((t) => (
                            <span key={t} className="tag-pill">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="catalog-slug-mono font-mono">{prob.id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 4. Scoring Rubric Builder */}
          <section className="campus-studio-card">
            <div className="card-header-clean">
              <div className="card-title-group">
                <span className="step-num-pill">04</span>
                <div>
                  <h2 className="card-heading">SCORING RUBRIC BUILDER</h2>
                  <p className="card-subtext">
                    Multi-criteria evaluation dimensions. Criteria weights must sum to exactly 100%.
                  </p>
                </div>
              </div>
              <div
                className={`rubric-sum-badge ${rubricTotalWeight === 100 ? 'valid' : 'invalid'}`}
                id="rubric-total-badge"
              >
                <Award size={14} />
                <span className="rubric-weight-sum tabular-nums">{rubricTotalWeight}%</span>
                <span>{rubricTotalWeight === 100 ? 'BALANCED' : 'MUST BE 100%'}</span>
              </div>
            </div>

            <div className="rubric-list">
              {rubricCriteria.map((criterion, idx) => (
                <div key={criterion.id} className="rubric-row">
                  <span className="rubric-index-pill font-mono">{idx + 1}</span>
                  <div className="rubric-input-group">
                    <input
                      type="text"
                      className="linear-input rubric-title-input"
                      placeholder="Criterion Name (e.g. Test Cases Correctness)"
                      value={criterion.title}
                      onChange={(e) => handleUpdateCriterion(criterion.id, 'title', e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      className="linear-input rubric-desc-input"
                      placeholder="Evaluation detail (optional)..."
                      value={criterion.description || ''}
                      onChange={(e) => handleUpdateCriterion(criterion.id, 'description', e.target.value)}
                    />
                  </div>
                  <div className="rubric-weight-control">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="linear-input weight-input tabular-nums"
                      value={criterion.weightPercent}
                      onChange={(e) =>
                        handleUpdateCriterion(criterion.id, 'weightPercent', Number(e.target.value) || 0)
                      }
                      required
                    />
                    <span className="weight-percent-sign">%</span>
                  </div>
                  <button
                    type="button"
                    className="rubric-delete-btn"
                    onClick={() => handleRemoveCriterion(criterion.id)}
                    disabled={rubricCriteria.length <= 1}
                    aria-label={`Remove criterion ${criterion.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="rubric-footer">
              <button
                type="button"
                className="btn-add-criterion"
                onClick={handleAddCriterion}
              >
                <Plus size={14} />
                <span>Add Evaluation Criterion</span>
              </button>
              <div className="rubric-summary-callout">
                {rubricTotalWeight < 100 && (
                  <span className="deficit-text tabular-nums">
                    Need +{100 - rubricTotalWeight}% more to reach 100%
                  </span>
                )}
                {rubricTotalWeight > 100 && (
                  <span className="excess-text tabular-nums">
                    Excess weight: -{rubricTotalWeight - 100}%
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Action Bar */}
          <div className="campus-submit-bar">
            <Link to={org_slug ? `/portal/${org_slug}/calendar` : '/campus/calendar'} className="btn-cancel">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn-submit-primary"
              disabled={submitting || !timelineValidation.isValid || rubricTotalWeight !== 100}
            >
              {submitting ? (
                <span>Scheduling Assessment...</span>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Publish &amp; Schedule Assessment</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssessmentCreatePage;
