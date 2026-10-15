import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Rocket,
  Trophy,
  Calendar,
  Users,
  Code2,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface HackathonItem {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  status: 'live' | 'upcoming' | 'completed';
  prizePool: string;
  mode: string;
  dates: string;
  tracks: string[];
  teamSize: string;
  registrationsCount: number;
}

const HACKATHONS_DATA: HackathonItem[] = [
  {
    id: 'devshouse-26',
    slug: 'devshouse-26',
    title: "DevsHouse '26",
    tagline: 'National Systems & AI Buildathon — Engineering the next generation of high-throughput software',
    status: 'live',
    prizePool: '₹5,00,000',
    mode: 'Hybrid · VIT Chennai & Online',
    dates: 'Oct 24 - Oct 26, 2026',
    tracks: ['Rust & Systems', 'Agentic AI', 'FinTech & Quant', 'Open Innovation'],
    teamSize: '2 - 4 Members',
    registrationsCount: 1420,
  },
  {
    id: 'csi-origin-2026',
    slug: 'csi-origin-2026',
    title: 'CSI ORIGIN 2026',
    tagline: 'Flagship 36-Hour Hackathon on Distributed Infrastructure and Cloud Architecture',
    status: 'upcoming',
    prizePool: '₹2,50,000',
    mode: 'In-Person · Anna University',
    dates: 'Nov 14 - Nov 16, 2026',
    tracks: ['Cloud Native', 'Cybersecurity', 'Web3 & Identity'],
    teamSize: '3 - 4 Members',
    registrationsCount: 680,
  },
  {
    id: 'gemma-ai-challenge',
    slug: 'gemma-ai-challenge',
    title: 'Build With Gemma AI Challenge',
    tagline: 'Accelerating Multimodal Reasoning and On-Device LLM Applications',
    status: 'upcoming',
    prizePool: '$10,000',
    mode: 'Global Online',
    dates: 'Dec 01 - Dec 15, 2026',
    tracks: ['On-Device AI', 'Robotics & Vision', 'Developer Tooling'],
    teamSize: '1 - 3 Members',
    registrationsCount: 2310,
  },
  {
    id: 'algoceleris-rust-sprint',
    slug: 'algoceleris-rust-sprint',
    title: 'AlgoCeleris Global Rust Sprint',
    tagline: 'Low-Latency Sandboxing, Async Runtimes & Linux Cgroups Hackathon',
    status: 'completed',
    prizePool: '₹3,00,000',
    mode: 'Virtual Showcase',
    dates: 'Aug 2026',
    tracks: ['Linux Kernel', 'Async Axum', 'Compiler Optimizations'],
    teamSize: 'Solo or Duo',
    registrationsCount: 940,
  },
];

export const HackathonsPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedTrack, setSelectedTrack] = useState<string>('All Tracks');

  const filtered = HACKATHONS_DATA.filter((h) => {
    if (filterStatus !== 'all' && h.status !== filterStatus) return false;
    if (selectedTrack !== 'All Tracks' && !h.tracks.includes(selectedTrack)) return false;
    return true;
  });

  return (
    <div className="hackathons-catalog-page">
      <div className="hackathons-container">
        {/* Flagship Hero Banner */}
        <section className="hackathon-hero-card">
          <div className="hero-top-row">
            <span className="live-status-pill">
              <span className="pulse-dot" />
              <span>LIVE FLAGSHIP EVENT</span>
            </span>
            <span className="hero-prize-badge">Prize Pool: ₹5,00,000 ($6,000)</span>
          </div>

          <h1 className="hero-title">DevsHouse '26 — National Systems & AI Buildathon</h1>
          <p className="hero-desc">
            Build high-throughput backends, real-time sandboxes, and agentic AI systems. 48-hour build sprint,
            rigorous automated judge evaluation, and ₹5,00,000 in bounties.
          </p>

          <div className="hero-meta-strip">
            <div className="hero-meta-item">
              <Calendar size={14} />
              <span>Oct 24 – 26, 2026</span>
            </div>
            <div className="hero-meta-item">
              <Users size={14} />
              <span>1,420 Builders Registered</span>
            </div>
            <div className="hero-meta-item">
              <Code2 size={14} />
              <span>Hybrid · VIT Chennai & Online</span>
            </div>
          </div>

          <div className="hero-actions-row">
            <Link
              to="/hackathons/devshouse-26"
              className="btn btn-primary hero-enter-btn"
              id="btn-enter-devshouse"
            >
              <span>Enter Hackathon Command Center</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        {/* Filter Controls */}
        <div className="hackathon-controls-bar">
          <div className="status-tabs-group" role="tablist">
            {(['all', 'live', 'upcoming', 'completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`status-tab-btn ${filterStatus === st ? 'active' : ''}`}
                onClick={() => setFilterStatus(st)}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Hackathons Grid */}
        <div className="hackathons-grid">
          {filtered.map((item) => (
            <div key={item.id} className="hackathon-card">
              <div className="card-status-bar">
                <span className={`status-pill pill-${item.status}`}>
                  {item.status === 'live' && <span className="pill-dot-live" />}
                  {item.status.toUpperCase()}
                </span>
                <span className="prize-pool-text">{item.prizePool}</span>
              </div>

              <h2 className="hackathon-card-title">{item.title}</h2>
              <p className="hackathon-card-tagline">{item.tagline}</p>

              <div className="hackathon-card-tracks">
                {item.tracks.map((tr) => (
                  <span key={tr} className="track-badge">
                    {tr}
                  </span>
                ))}
              </div>

              <div className="hackathon-card-footer">
                <div className="footer-meta">
                  <span>{item.dates}</span>
                  <span className="meta-dot">·</span>
                  <span>{item.teamSize}</span>
                </div>

                <Link
                  to={`/hackathons/${item.slug}`}
                  className="btn btn-secondary card-view-btn"
                >
                  <span>View Details</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HackathonsPage;
