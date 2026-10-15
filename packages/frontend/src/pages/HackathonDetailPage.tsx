import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Rocket,
  Trophy,
  Calendar,
  Users,
  Code2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Shield,
  FileText,
  Upload,
  ThumbsUp,
  Share2,
  Copy,
  AlertCircle,
  Cpu,
  Layers,
  Terminal,
  ChevronRight,
} from 'lucide-react';

type HackathonTab = 'overview' | 'tracks' | 'team' | 'submission' | 'showcase';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  github: string;
}

interface ShowcaseProject {
  id: string;
  title: string;
  tagline: string;
  teamName: string;
  track: string;
  githubUrl: string;
  liveUrl?: string;
  upvotes: number;
  rubric: {
    technicalDepth: number;
    architecture: number;
    innovation: number;
    uxPolish: number;
    total: number;
  };
  techStack: string[];
}

export const HackathonDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<HackathonTab>('overview');

  // Countdown timer (Build sprint)
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 47,
    minutes: 58,
    seconds: 32,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Team state
  const [myTeamName, setMyTeamName] = useState<string>('FlowControl');
  const [inviteCode, setInviteCode] = useState<string>('FLOW-26');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [matchmakingFilter, setMatchmakingFilter] = useState<string>('All');

  // Submission form state
  const [projectTitle, setProjectTitle] = useState<string>('Nirnay Engine');
  const [tagline, setTagline] = useState<string>(
    'Ultra-low-latency distributed emergency dispatch and route negotiation engine'
  );
  const [selectedTrack, setSelectedTrack] = useState<string>('Rust & Systems');
  const [githubUrl, setGithubUrl] = useState<string>('https://github.com/algo-celeris/nirnay-engine');
  const [liveUrl, setLiveUrl] = useState<string>('https://nirnay.algoceleris.dev');
  const [demoVideoUrl, setDemoVideoUrl] = useState<string>('https://youtu.be/demo-nirnay-2026');
  const [deckFileName, setDeckFileName] = useState<string>('nirnay-architecture-deck.pdf');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(true);

  // Showcase projects & Upvotes state
  const [showcaseProjects, setShowcaseProjects] = useState<ShowcaseProject[]>([
    {
      id: 'proj-1',
      title: 'Nirnay Engine',
      tagline: 'High-throughput emergency dispatch engine written in async Rust with sub-10ms routing',
      teamName: 'FlowControl',
      track: 'Rust & Systems',
      githubUrl: 'https://github.com/algo-celeris/nirnay-engine',
      liveUrl: 'https://nirnay.algoceleris.dev',
      upvotes: 184,
      rubric: {
        technicalDepth: 24,
        architecture: 25,
        innovation: 24,
        uxPolish: 23,
        total: 96,
      },
      techStack: ['Rust', 'Axum', 'PostgreSQL', 'WebSockets', 'Docker'],
    },
    {
      id: 'proj-2',
      title: 'SocraticJudge',
      tagline: 'Compiler diagnostic copilot that guides learners using AST-level hints without giving solutions',
      teamName: 'ByteWizards',
      track: 'Agentic AI',
      githubUrl: 'https://github.com/algo-celeris/socratic-judge',
      liveUrl: 'https://socratic.algoceleris.dev',
      upvotes: 142,
      rubric: {
        technicalDepth: 23,
        architecture: 23,
        innovation: 25,
        uxPolish: 22,
        total: 93,
      },
      techStack: ['TypeScript', 'Gemini 2.5', 'Tree-sitter', 'React'],
    },
    {
      id: 'proj-3',
      title: 'LOBster Quant',
      tagline: 'Lock-free microsecond Limit Order Book with FIFO matching and price-level depth caches',
      teamName: 'QuantCore',
      track: 'FinTech & Quant',
      githubUrl: 'https://github.com/algo-celeris/lobster-quant',
      liveUrl: 'https://lobster.algoceleris.dev',
      upvotes: 118,
      rubric: {
        technicalDepth: 25,
        architecture: 24,
        innovation: 22,
        uxPolish: 21,
        total: 92,
      },
      techStack: ['C++20', 'SIMD', 'gRPC', 'Chronicle'],
    },
  ]);

  const handleUpvote = (id: string) => {
    setShowcaseProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p))
    );
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const soloMatchmakingDirectory: TeamMember[] = [
    {
      id: 'solo-1',
      name: 'Rohan Verma',
      role: 'Backend / Rust',
      skills: ['Rust', 'Tokio', 'eBPF', 'Linux'],
      github: 'https://github.com/rohan-v',
    },
    {
      id: 'solo-2',
      name: 'Ananya Sharma',
      role: 'ML / AI',
      skills: ['PyTorch', 'LangChain', 'vLLM', 'Python'],
      github: 'https://github.com/ananya-s',
    },
    {
      id: 'solo-3',
      name: 'Vikram Sundaram',
      role: 'Frontend / Three.js',
      skills: ['TypeScript', 'React', 'Three.js', 'WebGL'],
      github: 'https://github.com/vikram-s',
    },
  ];

  return (
    <div className="hackathon-command-center">
      {/* 1. TOP COMMAND CENTER HERO HEADER */}
      <header className="command-center-hero">
        <div className="hero-top-navigation">
          <Link to="/hackathons" className="btn btn-secondary back-hackathons-btn">
            <ArrowLeft size={14} />
            <span>Back to Hackathons</span>
          </Link>

          <div className="command-live-indicator">
            <span className="live-pulse-dot" />
            <span className="font-mono">48-HOUR BUILD SPRINT ACTIVE</span>
          </div>
        </div>

        <div className="hero-main-content">
          <div className="hero-text-block">
            <div className="hero-flagship-tag">
              <Rocket size={14} color="#60a5fa" />
              <span>National Flagship Hackathon</span>
            </div>
            <h1 className="hero-title">DevsHouse '26 — Command Center</h1>
            <p className="hero-desc">
              National Systems, Distributed Infrastructure & AI Buildathon hosted by VIT Chennai Developers Club.
            </p>

            <div className="hero-meta-badges">
              <span className="meta-badge">
                <Calendar size={13} />
                <span>Oct 18 – 20, 2026</span>
              </span>
              <span className="meta-badge">
                <Trophy size={13} color="#fbbf24" />
                <span className="text-amber">Prize Pool: ₹5,00,000 ($6,000)</span>
              </span>
              <span className="meta-badge">
                <Users size={13} />
                <span>1,420 Registered · 380 Teams</span>
              </span>
            </div>
          </div>

          <div className="hero-countdown-card">
            <span className="countdown-label">Time Remaining in Build Sprint</span>
            <div className="countdown-digits-row font-mono">
              <div className="digit-box">
                <span className="digit-val">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="digit-unit">HRS</span>
              </div>
              <span className="digit-sep">:</span>
              <div className="digit-box">
                <span className="digit-val">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="digit-unit">MIN</span>
              </div>
              <span className="digit-sep">:</span>
              <div className="digit-box">
                <span className="digit-val">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="digit-unit">SEC</span>
              </div>
            </div>

            <div className="team-status-chip font-mono">
              <span>My Team: <strong>{myTeamName}</strong> (3/4 Members)</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. 5-TAB COMMAND CENTER NAVIGATION */}
      <nav className="command-tabs-bar" role="tablist">
        <button
          type="button"
          className={`cmd-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Layers size={14} />
          <span>1. Overview & Timeline</span>
        </button>

        <button
          type="button"
          className={`cmd-tab ${activeTab === 'tracks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracks')}
        >
          <Trophy size={14} />
          <span>2. Tracks & Bounties</span>
        </button>

        <button
          type="button"
          className={`cmd-tab ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <Users size={14} />
          <span>3. Team Lobby ({inviteCode})</span>
        </button>

        <button
          type="button"
          className={`cmd-tab ${activeTab === 'submission' ? 'active' : ''}`}
          onClick={() => setActiveTab('submission')}
        >
          <Upload size={14} />
          <span>4. Qualifier & Project Submission</span>
        </button>

        <button
          type="button"
          className={`cmd-tab ${activeTab === 'showcase' ? 'active' : ''}`}
          onClick={() => setActiveTab('showcase')}
        >
          <Sparkles size={14} />
          <span>5. Project Showcase & Leaderboard</span>
        </button>
      </nav>

      {/* 3. TAB WORKSPACE PANELS */}
      <div className="command-content-body">
        {/* ==============================================================
            TAB 1: OVERVIEW & 5-PHASE MILESTONE STEPPER
            ============================================================== */}
        {activeTab === 'overview' && (
          <div className="overview-tab-panel">
            {/* 5-Phase Milestone Stepper */}
            <div className="milestone-stepper-card">
              <h3 className="section-title">5-Phase Hackathon Execution Stepper</h3>
              <div className="stepper-track">
                {[
                  { phase: 1, title: 'Registration & Team Formation', date: 'Oct 01 – Oct 15', status: 'completed' },
                  { phase: 2, title: 'Algorithmic Coding Qualifier', date: 'Oct 16 · 06:00 PM', status: 'completed' },
                  { phase: 3, title: 'Idea & Architecture Abstract', date: 'Oct 17, 2026', status: 'completed' },
                  { phase: 4, title: '48-Hour Live Build Sprint', date: 'Oct 18 – 20, 2026', status: 'active' },
                  { phase: 5, title: 'Live Demo & Rubric Judging', date: 'Oct 20 · 02:00 PM', status: 'upcoming' },
                ].map((st) => (
                  <div key={st.phase} className={`stepper-node ${st.status}`}>
                    <div className="node-circle font-mono">
                      {st.status === 'completed' ? '✓' : st.phase}
                    </div>
                    <div className="node-content">
                      <span className="node-title">{st.title}</span>
                      <span className="node-date font-mono">{st.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rules & Eligibility */}
            <div className="rules-grid">
              <div className="rule-card">
                <h4>Rules & Conduct</h4>
                <ul>
                  <li>Teams must consist of 2 to 4 registered university or early-career participants.</li>
                  <li>All code submitted for evaluation must be authored during the 48-hour build sprint.</li>
                  <li>Libraries and LLM APIs may be used, provided they are cited in the project repository README.</li>
                  <li>Zero tolerance for plagiarism; every repository will be processed through AST Winnowing.</li>
                </ul>
              </div>

              <div className="rule-card">
                <h4>Eligibility & Perks</h4>
                <ul>
                  <li>Open to undergraduate and postgraduate students worldwide.</li>
                  <li>Free API credits provided by Google Cloud, AlgoCeleris, and Zerodha.</li>
                  <li>Access to high-throughput Rust Worker execution clusters for stress testing.</li>
                  <li>Top teams receive direct interview fast-tracks for Systems & Backend engineering roles.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 2: TRACKS & BOUNTIES
            ============================================================== */}
        {activeTab === 'tracks' && (
          <div className="tracks-tab-panel">
            <div className="tracks-grid">
              {[
                {
                  id: 'rust',
                  title: 'Rust & High-Performance Systems',
                  prize: '₹1,50,000 First Prize',
                  sponsor: 'Cloudflare & AlgoCeleris',
                  problem:
                    'High-Throughput Distributed Rate Limiter: Implement a token bucket or sliding window algorithm capable of handling 500,000 req/sec with sub-millisecond tail latency.',
                },
                {
                  id: 'ai',
                  title: 'Agentic AI & Multimodal Workflows',
                  prize: '₹1,50,000 First Prize',
                  sponsor: 'Google Cloud',
                  problem:
                    'Emergency Dispatch Intelligence: Autonomous multi-agent coordination between dispatchers, traffic networks, and hospital triage units.',
                },
                {
                  id: 'fintech',
                  title: 'FinTech, Order Books & Quant Systems',
                  prize: '₹1,00,000 First Prize',
                  sponsor: 'Zerodha Tech',
                  problem:
                    'Microsecond Limit Order Book (LOB) matching engine with strict price-time priority in pure Rust.',
                },
                {
                  id: 'open',
                  title: 'Open Innovation & Campus Tech',
                  prize: '₹1,00,000 First Prize',
                  sponsor: 'VIT Chennai Alumni Foundation',
                  problem:
                    'Build next-generation developer tooling, campus automation, or peer learning copilot architectures.',
                },
              ].map((trk) => (
                <div key={trk.id} className="track-spec-card">
                  <div className="track-top">
                    <span className="track-prize-badge font-mono">{trk.prize}</span>
                    <span className="track-sponsor">Sponsor: {trk.sponsor}</span>
                  </div>
                  <h3 className="track-title">{trk.title}</h3>
                  <div className="track-problem-box">
                    <strong>Challenge Problem Statement:</strong>
                    <p>{trk.problem}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 3: TEAM LOBBY & MATCHMAKING
            ============================================================== */}
        {activeTab === 'team' && (
          <div className="team-tab-panel">
            {/* My Team Box */}
            <div className="my-team-card">
              <div className="my-team-header">
                <div>
                  <span className="team-tag font-mono">TEAM 42</span>
                  <h3 className="team-name">{myTeamName}</h3>
                </div>
                <div className="invite-code-box">
                  <span className="code-label">Team Invite Code:</span>
                  <div className="code-chip font-mono">
                    <span>{inviteCode}</span>
                    <button type="button" className="btn-copy" onClick={handleCopyInvite}>
                      {copiedCode ? <CheckCircle2 size={13} color="#34d399" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="team-members-list">
                <div className="member-item">
                  <span className="avatar">NC</span>
                  <div className="member-info">
                    <strong>Nishank Chhipa (Team Lead)</strong>
                    <span>Systems Architecture & Rust Backend</span>
                  </div>
                  <span className="lead-pill">Lead</span>
                </div>
                <div className="member-item">
                  <span className="avatar">AS</span>
                  <div className="member-info">
                    <strong>Aravind S</strong>
                    <span>Distributed Systems & Networking</span>
                  </div>
                  <span className="member-pill">Member</span>
                </div>
                <div className="member-item">
                  <span className="avatar">PK</span>
                  <div className="member-info">
                    <strong>Priya K</strong>
                    <span>Machine Learning & Pipeline Design</span>
                  </div>
                  <span className="member-pill">Member</span>
                </div>
                <div className="member-item empty">
                  <div className="empty-slot-text">
                    <span>+ Slot Available (Share code <strong>{inviteCode}</strong> to invite 4th member)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Solo Teammate Matchmaking Directory */}
            <div className="matchmaking-directory-card">
              <div className="dir-header">
                <div>
                  <h3>Teammate Matchmaking Directory</h3>
                  <p>Connect with builders looking for teams to complete your roster.</p>
                </div>
                <div className="role-filter-pills">
                  {['All', 'Backend / Rust', 'ML / AI', 'Frontend / Three.js'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`role-filter-btn ${matchmakingFilter === r ? 'active' : ''}`}
                      onClick={() => setMatchmakingFilter(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="solo-builders-grid">
                {soloMatchmakingDirectory
                  .filter((b) => matchmakingFilter === 'All' || b.role === matchmakingFilter)
                  .map((b) => (
                    <div key={b.id} className="solo-builder-card">
                      <div className="builder-top">
                        <strong>{b.name}</strong>
                        <span className="builder-role">{b.role}</span>
                      </div>
                      <div className="builder-skills">
                        {b.skills.map((sk) => (
                          <span key={sk} className="skill-pill font-mono">{sk}</span>
                        ))}
                      </div>
                      <div className="builder-footer">
                        <a href={b.github} target="_blank" rel="noreferrer" className="github-link">
                          <Code2 size={13} />
                          <span>GitHub</span>
                        </a>
                        <button
                          type="button"
                          className="btn btn-secondary btn-invite"
                          onClick={() => alert(`Invitation to join ${myTeamName} sent to ${b.name}!`)}
                        >
                          Invite to Team
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 4: QUALIFIER & PROJECT SUBMISSION
            ============================================================== */}
        {activeTab === 'submission' && (
          <div className="submission-tab-panel">
            {/* Round 1 Qualifier Status */}
            <div className="qualifier-status-card">
              <div className="qualifier-left">
                <CheckCircle2 size={24} color="#34d399" />
                <div>
                  <h4>Round 1: Algorithmic Qualifier (Complete)</h4>
                  <p className="font-mono text-xs">
                    Score: 300 / 300 · Ranked 14th of 380 teams · Qualified for 48-Hour Live Build Sprint
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-view-qualifier"
                onClick={() => alert('Qualifier Result: 3/3 test suites passed against Linux cgroups sandbox.')}
              >
                <span>View Score Report</span>
              </button>
            </div>

            {/* Round 2 Project Submission Form */}
            <div className="submission-form-card">
              <div className="form-head">
                <h3>Round 2: Project Submission Portal</h3>
                <p>Submit your final project artifact before the deadline. All links will be audited by the judging panel.</p>
              </div>

              {isSubmitted && (
                <div className="submission-confirmed-banner">
                  <CheckCircle2 size={16} color="#34d399" />
                  <span>Project successfully registered for final evaluation. You can update links anytime until sprint closes.</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setIsSubmitted(true);
                  alert('Project updated successfully!');
                }}
                className="project-submit-form"
              >
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Project Title</label>
                    <input
                      type="text"
                      className="form-input"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Selected Track</label>
                    <select
                      className="form-input"
                      value={selectedTrack}
                      onChange={(e) => setSelectedTrack(e.target.value)}
                    >
                      <option value="Rust & Systems">Rust & High-Performance Systems</option>
                      <option value="Agentic AI">Agentic AI & Multimodal Workflows</option>
                      <option value="FinTech & Quant">FinTech, Order Books & Quant Systems</option>
                      <option value="Open Innovation">Open Innovation & Campus Tech</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Tagline (One-line description)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">GitHub Repository URL</label>
                    <input
                      type="url"
                      className="form-input font-mono"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Live Deployment URL</label>
                    <input
                      type="url"
                      className="form-input font-mono"
                      value={liveUrl}
                      onChange={(e) => setLiveUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Video Demo URL (YouTube / Loom)</label>
                    <input
                      type="url"
                      className="form-input font-mono"
                      value={demoVideoUrl}
                      onChange={(e) => setDemoVideoUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Architecture Diagram / Deck PDF</label>
                    <div className="pdf-upload-row">
                      <label className="btn btn-secondary btn-upload-pdf">
                        <Upload size={13} />
                        <span>Upload PDF Deck</span>
                        <input
                          type="file"
                          accept=".pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files?.[0]) setDeckFileName(e.target.files[0].name);
                          }}
                        />
                      </label>
                      {deckFileName && (
                        <span className="deck-file-tag font-mono">{deckFileName}</span>
                      )}
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary submit-final-project-btn">
                  <Upload size={15} />
                  <span>Update Hackathon Submission</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 5: PROJECT SHOWCASE & LEADERBOARD
            ============================================================== */}
        {activeTab === 'showcase' && (
          <div className="showcase-tab-panel">
            <div className="showcase-header">
              <div>
                <h3>Project Showcase Gallery & Live Rubric Scores</h3>
                <p>Audited submissions graded across the 4 official evaluation criteria.</p>
              </div>
            </div>

            <div className="showcase-cards-list">
              {showcaseProjects.map((p, idx) => (
                <div key={p.id} className="showcase-card">
                  <div className="showcase-top">
                    <div className="showcase-rank font-mono">#{idx + 1}</div>
                    <div className="showcase-title-block">
                      <div className="showcase-title-row">
                        <h4 className="showcase-title">{p.title}</h4>
                        <span className="showcase-team font-mono">by {p.teamName}</span>
                        <span className="track-chip">{p.track}</span>
                      </div>
                      <p className="showcase-tagline">{p.tagline}</p>
                    </div>

                    <div className="showcase-score-hero">
                      <span className="score-lbl">Judge Score</span>
                      <span className="score-num font-mono">{p.rubric.total} / 100</span>
                    </div>
                  </div>

                  {/* 4-Criterion Judge Rubric Breakdown */}
                  <div className="rubric-bars-grid">
                    <div className="rubric-item">
                      <span className="rubric-label">Technical Depth: <strong>{p.rubric.technicalDepth}/25</strong></span>
                      <div className="rubric-track">
                        <div className="rubric-fill" style={{ width: `${(p.rubric.technicalDepth / 25) * 100}%` }} />
                      </div>
                    </div>
                    <div className="rubric-item">
                      <span className="rubric-label">Architecture: <strong>{p.rubric.architecture}/25</strong></span>
                      <div className="rubric-track">
                        <div className="rubric-fill" style={{ width: `${(p.rubric.architecture / 25) * 100}%` }} />
                      </div>
                    </div>
                    <div className="rubric-item">
                      <span className="rubric-label">Innovation: <strong>{p.rubric.innovation}/25</strong></span>
                      <div className="rubric-track">
                        <div className="rubric-fill" style={{ width: `${(p.rubric.innovation / 25) * 100}%` }} />
                      </div>
                    </div>
                    <div className="rubric-item">
                      <span className="rubric-label">UX Polish: <strong>{p.rubric.uxPolish}/25</strong></span>
                      <div className="rubric-track">
                        <div className="rubric-fill" style={{ width: `${(p.rubric.uxPolish / 25) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Tech stack & Action Row */}
                  <div className="showcase-footer">
                    <div className="tech-stack-pills">
                      {p.techStack.map((t) => (
                        <span key={t} className="tech-tag font-mono">{t}</span>
                      ))}
                    </div>

                    <div className="showcase-actions">
                      <a href={p.githubUrl} target="_blank" rel="noreferrer" className="btn btn-secondary link-btn">
                        <Code2 size={13} />
                        <span>Code</span>
                      </a>
                      {p.liveUrl && (
                        <a href={p.liveUrl} target="_blank" rel="noreferrer" className="btn btn-secondary link-btn">
                          <ExternalLink size={13} />
                          <span>Live Demo</span>
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary upvote-btn font-mono"
                        onClick={() => handleUpvote(p.id)}
                      >
                        <ThumbsUp size={13} color="#60a5fa" />
                        <span>{p.upvotes} Upvotes</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HackathonDetailPage;
