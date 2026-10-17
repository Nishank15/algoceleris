import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Search,
  Trophy,
  Users,
} from 'lucide-react';
import { listHackathons, HackathonSummary } from '../services/api';

export const HackathonsPage: React.FC = () => {
  const [hackathons, setHackathons] = useState<HackathonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Countdown timer for flagship event
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 1, hours: 8, minutes: 25, seconds: 14 });

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await listHackathons();
        if (mounted) {
          setHackathons(data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Failed to load hackathons from backend');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Dynamic countdown calculation targeted at Oct 18, 2026 09:00:00 IST
    const targetDate = new Date('2026-10-18T09:00:00+05:30').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const flagship = hackathons.find((h) => h.is_flagship) || hackathons[0];

  const filteredHackathons = hackathons.filter((h) => {
    const matchesFilter =
      filter === 'ALL' ? true : h.status.toUpperCase() === filter.toUpperCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === '' ||
      h.title.toLowerCase().includes(query) ||
      h.tagline.toLowerCase().includes(query) ||
      h.host.toLowerCase().includes(query) ||
      h.tracks.some((t) => t.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });

  const liveCount = hackathons.filter((h) => h.status.toUpperCase() === 'LIVE').length;
  const upcomingCount = hackathons.filter((h) => h.status.toUpperCase() === 'UPCOMING').length;
  const completedCount = hackathons.filter((h) => h.status.toUpperCase() === 'COMPLETED').length;

  return (
    <div className="hackathons-catalog-page" style={{ background: '#08090a', minHeight: '100vh', color: '#f8fafc' }}>
      <div className="hackathons-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Header Breadcrumb & Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#8a8f98' }}>
            <Link to="/" style={{ color: '#8a8f98', textDecoration: 'none' }}>Home</Link>
            <span>/</span>
            <span style={{ color: '#e5e5e6' }}>Hackathons & Build Sprints</span>
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, color: '#ffffff' }}>
            National Engineering Sprints
          </h1>
          <p style={{ margin: 0, fontSize: '0.94rem', color: '#8a8f98', maxWidth: '720px', lineHeight: 1.5 }}>
            Production hackathons evaluated by the AlgoCeleris low-latency kernel sandbox. Form teams, solve industry track statements, and compete for verified cash bounties.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#141517', border: '1px solid #23252a', borderRadius: '12px', color: '#8a8f98' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ width: '16px', height: '16px', border: '2px solid #3e4149', borderTopColor: '#e4f222', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Connecting to Rust Axum Hackathon Store...
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Failed to synchronize with backend</div>
            <div style={{ fontSize: '0.85rem' }}>{error}</div>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: '12px', padding: '6px 14px', background: '#23252a', border: '1px solid #3e4149', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Flagship Hero Sprint Card */}
        {!loading && flagship && (
          <div
            className="hackathon-hero-card"
            style={{
              background: '#141517',
              border: '1px solid #23252a',
              borderRadius: '12px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Top row with Live badge & Prize */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.35)',
                    color: '#22c55e',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
                    }}
                  />
                  LIVE NATIONAL SPRINT
                </span>
                <span
                  style={{
                    fontSize: '0.74rem',
                    color: '#8a8f98',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#0f1011',
                    border: '1px solid #23252a',
                  }}
                >
                  Flagship Event
                </span>
              </div>

              {/* Tabular Countdown Timer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#08090a',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #23252a',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#8a8f98' }}>
                  <Clock size={13} style={{ color: '#e4f222' }} />
                  <span>STARTS IN:</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                  <span>{String(timeLeft.days).padStart(2, '0')}d</span>
                  <span style={{ color: '#383b3f' }}>:</span>
                  <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
                  <span style={{ color: '#383b3f' }}>:</span>
                  <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
                  <span style={{ color: '#383b3f' }}>:</span>
                  <span style={{ color: '#e4f222' }}>{String(timeLeft.seconds).padStart(2, '0')}s</span>
                </div>
              </div>
            </div>

            {/* Main Title & Tagline */}
            <div>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 8px 0', color: '#ffffff' }}>
                {flagship.title}
              </h2>
              <p style={{ margin: 0, fontSize: '1rem', color: '#8a8f98', lineHeight: 1.55, maxWidth: '820px' }}>
                {flagship.tagline}
              </p>
            </div>

            {/* Metadata Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                flexWrap: 'wrap',
                fontSize: '0.82rem',
                color: '#8a8f98',
                borderTop: '1px solid #23252a',
                paddingTop: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={14} style={{ color: '#e4f222' }} />
                <span>Prize Pool:</span>
                <span style={{ color: '#e4f222', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  {flagship.prize_pool}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} style={{ color: '#8a8f98' }} />
                <span>Registrations:</span>
                <span style={{ color: '#ffffff', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                  {flagship.registered_count.toLocaleString()}+ Engineers
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} style={{ color: '#8a8f98' }} />
                <span>{flagship.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} style={{ color: '#8a8f98' }} />
                <span>{flagship.start_date}</span>
              </div>
            </div>

            {/* Track Tags & CTA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                {flagship.tracks.map((track, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 500,
                      padding: '4px 10px',
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      borderRadius: '6px',
                      color: '#d0d6e0',
                    }}
                  >
                    {track}
                  </span>
                ))}
              </div>

              <Link
                to={`/hackathons/${flagship.slug}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#e4f222',
                  color: '#08090a',
                  padding: '10px 22px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 8px rgba(228, 242, 34, 0.18)',
                }}
              >
                <span>Enter Sprint Command Center</span>
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* Filter Controls & Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            background: '#0f1011',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #23252a',
          }}
        >
          {/* Segmented Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#08090a', padding: '3px', borderRadius: '6px', border: '1px solid #23252a' }}>
            <button
              onClick={() => setFilter('ALL')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                background: filter === 'ALL' ? '#141517' : 'transparent',
                border: filter === 'ALL' ? '1px solid #3e4149' : '1px solid transparent',
                color: filter === 'ALL' ? '#ffffff' : '#8a8f98',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All Sprints ({hackathons.length})
            </button>
            <button
              onClick={() => setFilter('LIVE')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                background: filter === 'LIVE' ? '#141517' : 'transparent',
                border: filter === 'LIVE' ? '1px solid #3e4149' : '1px solid transparent',
                color: filter === 'LIVE' ? '#22c55e' : '#8a8f98',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Live ({liveCount})
            </button>
            <button
              onClick={() => setFilter('UPCOMING')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                background: filter === 'UPCOMING' ? '#141517' : 'transparent',
                border: filter === 'UPCOMING' ? '1px solid #3e4149' : '1px solid transparent',
                color: filter === 'UPCOMING' ? '#60a5fa' : '#8a8f98',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              style={{
                padding: '5px 12px',
                borderRadius: '4px',
                background: filter === 'COMPLETED' ? '#141517' : 'transparent',
                border: filter === 'COMPLETED' ? '1px solid #3e4149' : '1px solid transparent',
                color: filter === 'COMPLETED' ? '#e5e5e6' : '#8a8f98',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Completed ({completedCount})
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#62666d' }} />
            <input
              type="text"
              placeholder="Search by sprint name, tech stack, host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                background: '#08090a',
                border: '1px solid #23252a',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '0.78rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* 3-Column Hackathons Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {filteredHackathons.map((h) => {
            const isLive = h.status.toUpperCase() === 'LIVE';
            const isUpcoming = h.status.toUpperCase() === 'UPCOMING';

            return (
              <div
                key={h.id}
                style={{
                  background: '#141517',
                  border: '1px solid #23252a',
                  borderRadius: '10px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3e4149';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#23252a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Top Status & Prize row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      background: isLive
                        ? 'rgba(34, 197, 94, 0.12)'
                        : isUpcoming
                        ? 'rgba(59, 130, 246, 0.12)'
                        : 'rgba(255, 255, 255, 0.05)',
                      color: isLive ? '#22c55e' : isUpcoming ? '#60a5fa' : '#8a8f98',
                      border: `1px solid ${
                        isLive ? 'rgba(34, 197, 94, 0.3)' : isUpcoming ? 'rgba(59, 130, 246, 0.3)' : '#23252a'
                      }`,
                    }}
                  >
                    {isLive && (
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: '#22c55e',
                        }}
                      />
                    )}
                    {h.status}
                  </span>

                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#e4f222',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {h.prize_pool}
                  </span>
                </div>

                {/* Title & Tagline */}
                <div>
                  <Link
                    to={`/hackathons/${h.slug}`}
                    style={{
                      textDecoration: 'none',
                      color: '#ffffff',
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      letterSpacing: '-0.015em',
                      display: 'block',
                      marginBottom: '6px',
                    }}
                  >
                    {h.title}
                  </Link>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#8a8f98', lineHeight: 1.5, minHeight: '38px' }}>
                    {h.tagline}
                  </p>
                </div>

                {/* Tracks list */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' }}>
                  {h.tracks.slice(0, 3).map((track, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 500,
                        padding: '2px 7px',
                        background: '#0f1011',
                        border: '1px solid #23252a',
                        borderRadius: '4px',
                        color: '#8a8f98',
                      }}
                    >
                      {track}
                    </span>
                  ))}
                  {h.tracks.length > 3 && (
                    <span style={{ fontSize: '0.68rem', color: '#62666d', alignSelf: 'center' }}>
                      +{h.tracks.length - 3} more
                    </span>
                  )}
                </div>

                {/* Card Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid #23252a',
                    fontSize: '0.76rem',
                    color: '#8a8f98',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={12} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
                      {h.registered_count.toLocaleString()} registered
                    </span>
                  </div>

                  <Link
                    to={`/hackathons/${h.slug}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#e5e5e6',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <span>View Command</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {filteredHackathons.length === 0 && !loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#141517', border: '1px solid #23252a', borderRadius: '12px', color: '#8a8f98' }}>
            No hackathons matched the selected filter or search query.
          </div>
        )}
      </div>
    </div>
  );
};
