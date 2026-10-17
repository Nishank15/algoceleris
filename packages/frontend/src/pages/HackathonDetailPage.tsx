import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Github,
  Globe,
  MapPin,
  Send,
  Share2,
  Star,
  ThumbsUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  getHackathonDetail,
  registerHackathon,
  createOrJoinHackathonTeam,
  submitHackathonProject,
  upvoteHackathonSubmission,
  HackathonDetailResponse,
  HackathonTeamItem,
} from '../services/api';

export const HackathonDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [data, setData] = useState<HackathonDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tracks' | 'lobby' | 'qualifier' | 'showcase'>('overview');

  // Registration modal / form state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regTrack, setRegTrack] = useState('');
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Team creation state
  const [createTeamName, setCreateTeamName] = useState('');
  const [createLeadName, setCreateLeadName] = useState('');
  const [createLeadEmail, setCreateLeadEmail] = useState('');
  const [createTrack, setCreateTrack] = useState('');
  const [createTeamLoading, setCreateTeamLoading] = useState(false);
  const [teamSuccessMsg, setTeamSuccessMsg] = useState<string | null>(null);

  // Join team state
  const [joinCode, setJoinCode] = useState('');
  const [joinMemberName, setJoinMemberName] = useState('');
  const [joinMemberEmail, setJoinMemberEmail] = useState('');
  const [joinTeamLoading, setJoinTeamLoading] = useState(false);
  const [joinErrorMsg, setJoinErrorMsg] = useState<string | null>(null);

  // Active user's team state (persisted in local state)
  const [activeTeam, setActiveTeam] = useState<HackathonTeamItem | null>(null);

  // Submission form state
  const [subTitle, setSubTitle] = useState('');
  const [subTagline, setSubTagline] = useState('');
  const [subTrack, setSubTrack] = useState('');
  const [subTeamName, setSubTeamName] = useState('');
  const [subGithub, setSubGithub] = useState('');
  const [subLive, setSubLive] = useState('');
  const [subDeck, setSubDeck] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [subSuccessMsg, setSubSuccessMsg] = useState<string | null>(null);

  // Upvoted project IDs in session
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  // Countdown timer
  const [countdown, setCountdown] = useState({ days: 1, hours: 8, minutes: 25, seconds: 14 });

  const loadHackathon = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getHackathonDetail(slug);
      setData(res);
      // Auto-select first track for submission if not set
      if (res.tracks.length > 0 && !subTrack) {
        setSubTrack(res.tracks[0].title);
        setCreateTrack(res.tracks[0].title);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch hackathon details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHackathon();
  }, [slug]);

  useEffect(() => {
    const targetDate = new Date('2026-10-18T09:00:00+05:30').getTime();
    const interval = setInterval(() => {
      const distance = targetDate - new Date().getTime();
      if (distance <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !regName || !regEmail) return;
    try {
      setRegSubmitting(true);
      setRegSuccessMsg(null);
      const res = await registerHackathon(slug, {
        participant_name: regName,
        email: regEmail,
        university_or_org: regOrg || undefined,
        track_preference: regTrack || undefined,
      });
      setRegSuccessMsg(res.message);
      setIsRegistering(false);
      // Re-fetch hackathon to update live participant count
      await loadHackathon();
    } catch (err: any) {
      alert(err?.message || 'Registration failed');
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !createTeamName || !createLeadName || !createLeadEmail) return;
    try {
      setCreateTeamLoading(true);
      setTeamSuccessMsg(null);
      const res = await createOrJoinHackathonTeam(slug, {
        action: 'create',
        team_name: createTeamName,
        member_name: createLeadName,
        member_email: createLeadEmail,
        track: createTrack || undefined,
      });
      setTeamSuccessMsg(res.message);
      const newTeamItem: HackathonTeamItem = {
        id: res.team_id,
        team_name: res.team_name,
        invite_code: res.invite_code,
        members: res.members,
        track: createTrack,
      };
      setActiveTeam(newTeamItem);
      setSubTeamName(res.team_name);
      // Reset form
      setCreateTeamName('');
      await loadHackathon();
    } catch (err: any) {
      alert(err?.message || 'Failed to create team');
    } finally {
      setCreateTeamLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !joinCode || !joinMemberName || !joinMemberEmail) return;
    try {
      setJoinTeamLoading(true);
      setJoinErrorMsg(null);
      const res = await createOrJoinHackathonTeam(slug, {
        action: 'join',
        invite_code: joinCode,
        member_name: joinMemberName,
        member_email: joinMemberEmail,
      });
      const joinedTeamItem: HackathonTeamItem = {
        id: res.team_id,
        team_name: res.team_name,
        invite_code: res.invite_code,
        members: res.members,
      };
      setActiveTeam(joinedTeamItem);
      setSubTeamName(res.team_name);
      setJoinCode('');
      setTeamSuccessMsg(`Successfully joined '${res.team_name}'!`);
      await loadHackathon();
    } catch (err: any) {
      setJoinErrorMsg(err?.message || 'Failed to join team. Check code and retry.');
    } finally {
      setJoinTeamLoading(false);
    }
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !subTitle || !subTagline || !subTrack || !subGithub) return;
    try {
      setSubLoading(true);
      setSubSuccessMsg(null);
      const team = subTeamName || (activeTeam ? activeTeam.team_name : 'Solo Candidate');
      const res = await submitHackathonProject(slug, {
        project_title: subTitle,
        tagline: subTagline,
        track: subTrack,
        team_name: team,
        github_url: subGithub,
        live_url: subLive || undefined,
        architecture_deck_url: subDeck || undefined,
      });
      setSubSuccessMsg(`Project submitted successfully! Assigned Rubric Score: ${res.rubric_score}`);
      // Re-fetch data and switch to showcase
      await loadHackathon();
      setActiveTab('showcase');
      // Reset form
      setSubTitle('');
      setSubTagline('');
      setSubGithub('');
      setSubLive('');
      setSubDeck('');
    } catch (err: any) {
      alert(err?.message || 'Submission failed');
    } finally {
      setSubLoading(false);
    }
  };

  const handleUpvote = async (projectId: string) => {
    if (!slug || upvotedIds.has(projectId) || upvotingId) return;
    try {
      setUpvotingId(projectId);
      const res = await upvoteHackathonSubmission(slug, projectId);
      setUpvotedIds((prev) => new Set([...prev, projectId]));
      // Update local showcase count immediately
      if (data) {
        setData({
          ...data,
          showcase: data.showcase.map((p) =>
            p.id === projectId ? { ...p, upvotes: res.upvotes } : p
          ),
        });
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to record upvote');
    } finally {
      setUpvotingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#08090a', color: '#f8fafc', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#8a8f98' }}>
          <div style={{ width: '18px', height: '18px', border: '2px solid #3e4149', borderTopColor: '#e4f222', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading Hackathon Command Center...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#08090a', color: '#f8fafc', padding: '60px 20px', maxWidth: '800px', margin: '0 auto' }}>
        <Link to="/hackathons" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#8a8f98', textDecoration: 'none', marginBottom: '20px', fontSize: '0.85rem' }}>
          <ArrowLeft size={14} /> Back to Catalog
        </Link>
        <div style={{ padding: '24px', background: '#141517', border: '1px solid #23252a', borderRadius: '12px' }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>Hackathon Not Found</h2>
          <p style={{ color: '#8a8f98', fontSize: '0.9rem' }}>{error || 'Unable to retrieve event details.'}</p>
          <button
            onClick={loadHackathon}
            style={{ marginTop: '12px', padding: '8px 16px', background: '#23252a', border: '1px solid #3e4149', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hackathon-command-center" style={{ background: '#08090a', minHeight: '100vh', color: '#f8fafc', padding: '24px 20px' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Navigation Breadcrumb & Back Link */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#8a8f98' }}>
            <Link to="/hackathons" style={{ color: '#8a8f98', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={13} />
              <span>Hackathons</span>
            </Link>
            <span>/</span>
            <span style={{ color: '#ffffff', fontWeight: 600 }}>{data.title}</span>
          </div>

          {/* Active Team Pill or Register CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeTeam ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#141517',
                  border: '1px solid #23252a',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                }}
              >
                <Users size={13} style={{ color: '#22c55e' }} />
                <span style={{ color: '#8a8f98' }}>Team:</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{activeTeam.team_name}</span>
                <span style={{ color: '#383b3f' }}>|</span>
                <span style={{ color: '#8a8f98' }}>Code:</span>
                <code style={{ color: '#e4f222', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                  {activeTeam.invite_code}
                </code>
              </div>
            ) : (
              <button
                onClick={() => setIsRegistering(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <UserPlus size={13} />
                <span>Register for Sprint</span>
              </button>
            )}
          </div>
        </div>

        {/* Command Center Hero */}
        <div
          style={{
            background: '#141517',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ flex: 1, minWidth: '320px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.35)',
                    color: '#22c55e',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                  {data.status} COMMAND CENTER
                </span>
                <span style={{ fontSize: '0.74rem', color: '#8a8f98' }}>{data.host}</span>
              </div>
              <h1 style={{ fontSize: '2.1rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.025em', color: '#ffffff' }}>
                {data.title}
              </h1>
              <p style={{ margin: 0, fontSize: '0.94rem', color: '#8a8f98', lineHeight: 1.55, maxWidth: '750px' }}>
                {data.tagline}
              </p>
            </div>

            {/* Tabular Countdown Timer Box */}
            <div
              style={{
                background: '#08090a',
                border: '1px solid #23252a',
                borderRadius: '8px',
                padding: '14px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                fontFamily: "'JetBrains Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div style={{ fontSize: '0.68rem', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Build Sprint Starts In
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                <span>{String(countdown.days).padStart(2, '0')}d</span>
                <span style={{ color: '#383b3f' }}>:</span>
                <span>{String(countdown.hours).padStart(2, '0')}h</span>
                <span style={{ color: '#383b3f' }}>:</span>
                <span>{String(countdown.minutes).padStart(2, '0')}m</span>
                <span style={{ color: '#383b3f' }}>:</span>
                <span style={{ color: '#e4f222' }}>{String(countdown.seconds).padStart(2, '0')}s</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#e4f222', fontWeight: 700 }}>
                {data.prize_pool} Total Bounties
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              flexWrap: 'wrap',
              borderTop: '1px solid #23252a',
              paddingTop: '16px',
              fontSize: '0.8rem',
              color: '#8a8f98',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} style={{ color: '#8a8f98' }} />
              <span>Participants:</span>
              <span style={{ color: '#ffffff', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                {data.registered_count.toLocaleString()} Registered
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: '#8a8f98' }} />
              <span>Timeline:</span>
              <span style={{ color: '#e5e5e6' }}>{data.start_date} – {data.end_date}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} style={{ color: '#8a8f98' }} />
              <span>Venue:</span>
              <span style={{ color: '#e5e5e6' }}>{data.location}</span>
            </div>
          </div>
        </div>

        {/* 5 Linear Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderBottom: '1px solid #23252a',
            paddingBottom: '2px',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'overview', label: '01 Overview & Schedule' },
            { id: 'tracks', label: '02 Tracks & Bounties' },
            { id: 'lobby', label: '03 Team Lobby' },
            { id: 'qualifier', label: '04 Qualifier & Submission' },
            { id: 'showcase', label: '05 Project Showcase & Standings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #e4f222' : '2px solid transparent',
                color: activeTab === tab.id ? '#ffffff' : '#8a8f98',
                fontSize: '0.82rem',
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Success toast banners */}
        {regSuccessMsg && (
          <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', color: '#86efac', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{regSuccessMsg}</span>
          </div>
        )}
        {teamSuccessMsg && (
          <div style={{ padding: '12px 16px', background: 'rgba(228, 242, 34, 0.12)', border: '1px solid rgba(228, 242, 34, 0.3)', borderRadius: '6px', color: '#fef08a', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{teamSuccessMsg}</span>
          </div>
        )}

        {/* TAB 1: OVERVIEW & SCHEDULE */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* 5-Stage Pipeline Tracker */}
            <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                5-Stage Sprint Lifecycle
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {data.milestones.map((m) => {
                  const isCompleted = m.status === 'COMPLETED';
                  const isActive = m.status === 'ACTIVE';

                  return (
                    <div
                      key={m.phase}
                      style={{
                        background: '#0f1011',
                        border: `1px solid ${isActive ? '#e4f222' : isCompleted ? '#22c55e' : '#23252a'}`,
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8a8f98', fontFamily: "'JetBrains Mono', monospace" }}>
                          PHASE 0{m.phase}
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isActive ? 'rgba(228, 242, 34, 0.15)' : isCompleted ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: isActive ? '#e4f222' : isCompleted ? '#22c55e' : '#8a8f98',
                          }}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#e4f222', fontFamily: "'JetBrains Mono', monospace" }}>
                        {m.date}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.76rem', color: '#8a8f98', lineHeight: 1.45 }}>
                        {m.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rules & Eligibility Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  Sprint Evaluation Rules
                </h4>
                <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#8a8f98', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  {data.rules.map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  Eligibility & Requirements
                </h4>
                <p style={{ margin: 0, color: '#8a8f98', fontSize: '0.82rem', lineHeight: 1.55 }}>
                  {data.eligibility}
                </p>
                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setActiveTab('lobby')}
                    style={{
                      padding: '8px 16px',
                      background: '#e4f222',
                      color: '#08090a',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Form or Join a Team →
                  </button>
                  <button
                    onClick={() => setActiveTab('tracks')}
                    style={{
                      padding: '8px 16px',
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Inspect Problem Statements
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRACKS & BOUNTIES */}
        {activeTab === 'tracks' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {data.tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  background: '#141517',
                  border: '1px solid #23252a',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      color: '#8a8f98',
                    }}
                  >
                    {track.id.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#e4f222',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {track.prize}
                  </span>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                    {track.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#8a8f98', lineHeight: 1.5 }}>
                    {track.description}
                  </p>
                </div>

                <div style={{ background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', padding: '12px', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: '#e5e5e6', marginBottom: '4px' }}>Problem Statement:</div>
                  {track.problem_statement}
                </div>

                {track.sponsor && (
                  <div style={{ fontSize: '0.74rem', color: '#8a8f98', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Presented by:</span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{track.sponsor}</span>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                  <button
                    onClick={() => {
                      setSubTrack(track.title);
                      setActiveTab('qualifier');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Submit Project in this Track</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: TEAM LOBBY */}
        {activeTab === 'lobby' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Create & Join Team Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              
              {/* Form A: Create Team */}
              <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus size={16} style={{ color: '#e4f222' }} />
                  <span>Create a New Team</span>
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: '#8a8f98' }}>
                  Register a squad and generate a unique 6-character code to share with teammates.
                </p>

                <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Team Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. FlowControl, ByteWizards"
                      value={createTeamName}
                      onChange={(e) => setCreateTeamName(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Lead Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Your name"
                        value={createLeadName}
                        onChange={(e) => setCreateLeadName(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Lead Email</label>
                      <input
                        type="email"
                        required
                        placeholder="your.email@university.edu"
                        value={createLeadEmail}
                        onChange={(e) => setCreateLeadEmail(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={createTeamLoading}
                    style={{
                      marginTop: '6px',
                      padding: '9px',
                      background: '#e4f222',
                      color: '#08090a',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {createTeamLoading ? 'Generating Team...' : 'Create Team & Generate 6-Char Code ->'}
                  </button>
                </form>
              </div>

              {/* Form B: Join Team */}
              <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} style={{ color: '#22c55e' }} />
                  <span>Join an Existing Team</span>
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: '#8a8f98' }}>
                  Enter the 6-character invite code provided by your team lead.
                </p>

                {joinErrorMsg && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.75rem', marginBottom: '10px' }}>
                    {joinErrorMsg}
                  </div>
                )}

                <form onSubmit={handleJoinTeam} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Invite Code (6 Characters)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. FLOW26, BYTE26"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={8}
                      style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#e4f222', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.88rem', fontWeight: 700, outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Your Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Full name"
                        value={joinMemberName}
                        onChange={(e) => setJoinMemberName(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Your Email</label>
                      <input
                        type="email"
                        required
                        placeholder="email@domain.com"
                        value={joinMemberEmail}
                        onChange={(e) => setJoinMemberEmail(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={joinTeamLoading}
                    style={{
                      marginTop: '6px',
                      padding: '9px',
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    {joinTeamLoading ? 'Verifying Code...' : 'Join Team with Code ->'}
                  </button>
                </form>
              </div>
            </div>

            {/* Live Teams Registered */}
            <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                  Registered Teams ({data.teams.length})
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#8a8f98' }}>Live synchronized with Rust backend</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {data.teams.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                        {t.team_name}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(t.invite_code);
                          alert(`Invite code '${t.invite_code}' copied to clipboard!`);
                        }}
                        style={{
                          background: '#08090a',
                          border: '1px solid #23252a',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          color: '#e4f222',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Click to copy invite code"
                      >
                        <span>{t.invite_code}</span>
                        <Copy size={11} />
                      </button>
                    </div>

                    {t.track && (
                      <span style={{ fontSize: '0.7rem', color: '#8a8f98' }}>{t.track}</span>
                    )}

                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#62666d', marginBottom: '4px' }}>Members:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {t.members.map((m, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              background: '#141517',
                              borderRadius: '4px',
                              border: '1px solid #23252a',
                              color: '#cbd5e1',
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Teammate Matchmaking Directory */}
            <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                Teammate Matchmaking Directory
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {data.matchmaking.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: '#0f1011',
                      border: '1px solid #23252a',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>{p.name}</span>
                      <span style={{ fontSize: '0.68rem', color: '#8a8f98' }}>{p.role}</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {p.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            background: '#141517',
                            border: '1px solid #23252a',
                            borderRadius: '3px',
                            color: '#e5e5e6',
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#8a8f98', lineHeight: 1.4 }}>
                      {p.looking_for}
                    </p>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(p.contact);
                        alert(`Email copied for ${p.name}: ${p.contact}`);
                      }}
                      style={{
                        marginTop: 'auto',
                        padding: '6px',
                        background: '#08090a',
                        border: '1px solid #23252a',
                        borderRadius: '4px',
                        color: '#d0d6e0',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Share2 size={12} />
                      <span>Copy Contact ({p.contact})</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: QUALIFIER & PROJECT SUBMISSION */}
        {activeTab === 'qualifier' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Round 1: Algorithmic Qualifier */}
            <div
              style={{
                background: '#141517',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                    ROUND 1 · ACTIVE
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#8a8f98' }}>Kernel Sandbox Qualifier</span>
                </div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                  Two Sum & Algorithmic Foundations
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#8a8f98', maxWidth: '640px' }}>
                  Validate your code execution speed and correctness inside our Linux cgroups v2 isolated sandbox before final sprint submission.
                </p>
              </div>

              <Link
                to="/problems/two-sum"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#0f1011',
                  border: '1px solid #23252a',
                  color: '#ffffff',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <span>Launch Qualifier Arena</span>
                <ExternalLink size={13} />
              </Link>
            </div>

            {/* Round 2: Project Submission Form */}
            <div style={{ background: '#141517', border: '1px solid #23252a', borderRadius: '12px', padding: '28px' }}>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#0f1011', border: '1px solid #23252a', color: '#8a8f98' }}>
                  ROUND 2 · BUILD SPRINT ARTIFACT
                </span>
                <h3 style={{ margin: '8px 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  Project Artifact Submission
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#8a8f98' }}>
                  Submit your working codebase, live preview, and architecture deck. All repositories are indexed into the live showcase and evaluated against our 4-point rubric.
                </p>
              </div>

              {subSuccessMsg && (
                <div style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px', color: '#86efac', fontSize: '0.82rem', marginBottom: '16px' }}>
                  {subSuccessMsg}
                </div>
              )}

              <form onSubmit={handleSubmitProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f98', marginBottom: '4px' }}>
                      Project Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nirnay Emergency Mesh"
                      value={subTitle}
                      onChange={(e) => setSubTitle(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#ffffff', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f98', marginBottom: '4px' }}>
                      Track Category *
                    </label>
                    <select
                      value={subTrack}
                      onChange={(e) => setSubTrack(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#ffffff', fontSize: '0.82rem', outline: 'none' }}
                    >
                      {data.tracks.map((t) => (
                        <option key={t.id} value={t.title}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f98', marginBottom: '4px' }}>
                    Project Tagline / Elevator Pitch *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Short 1-sentence description of the problem solved"
                    value={subTagline}
                    onChange={(e) => setSubTagline(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#ffffff', fontSize: '0.82rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f98', marginBottom: '4px' }}>
                      Team Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={activeTeam ? activeTeam.team_name : 'Enter your registered team name'}
                      value={subTeamName}
                      onChange={(e) => setSubTeamName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#ffffff', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f98', marginBottom: '4px' }}>
                      GitHub Repository URL *
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://github.com/org/repo"
                      value={subGithub}
                      onChange={(e) => setSubGithub(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#ffffff', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f98', marginBottom: '4px' }}>
                      Live Demo URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://my-app.dev"
                      value={subLive}
                      onChange={(e) => setSubLive(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#ffffff', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8a8f98', marginBottom: '4px' }}>
                      Architecture Deck / Video URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/... or YouTube"
                      value={subDeck}
                      onChange={(e) => setSubDeck(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#ffffff', fontSize: '0.82rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={subLoading}
                  style={{
                    marginTop: '8px',
                    padding: '12px 24px',
                    background: '#e4f222',
                    color: '#08090a',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 10px rgba(228, 242, 34, 0.2)',
                  }}
                >
                  <Send size={15} />
                  <span>{subLoading ? 'Submitting to Rust Gateway...' : 'Submit Final Project for Evaluation ->'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: PROJECT SHOWCASE & STANDINGS */}
        {activeTab === 'showcase' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  Project Showcase & Ranked Standings
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#8a8f98' }}>
                  Live leaderboard scored against the 4-criterion rubric. Upvoting synchronizes directly with the Axum backend.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('qualifier')}
                style={{
                  padding: '7px 14px',
                  background: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Submit Project
              </button>
            </div>

            {/* Showcase Items Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
              {data.showcase.map((p, idx) => {
                const isUpvoted = upvotedIds.has(p.id);

                return (
                  <div
                    key={p.id}
                    style={{
                      background: '#141517',
                      border: '1px solid #23252a',
                      borderRadius: '12px',
                      padding: '22px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Header: Rank + Track */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            color: idx === 0 ? '#e4f222' : idx === 1 ? '#e5e5e6' : '#8a8f98',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#8a8f98' }}>{p.track}</span>
                      </div>

                      {/* Rubric Score Badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#08090a',
                          border: '1px solid #23252a',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          color: '#e4f222',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        <Star size={12} style={{ fill: '#e4f222' }} />
                        <span>{p.rubric_score.toFixed(1)} / 10</span>
                      </span>
                    </div>

                    {/* Title & Tagline */}
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                        {p.project_title}
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: '#62666d', marginBottom: '6px' }}>
                        by <span style={{ color: '#ffffff', fontWeight: 600 }}>{p.team_name}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#8a8f98', lineHeight: 1.5 }}>
                        {p.tagline}
                      </p>
                    </div>

                    {/* Tech Stack badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {p.tech_stack.map((t, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            background: '#0f1011',
                            border: '1px solid #23252a',
                            borderRadius: '4px',
                            color: '#d0d6e0',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    {/* Footer with Links & Real Upvote Button */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '12px',
                        borderTop: '1px solid #23252a',
                        marginTop: 'auto',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <a
                          href={p.github_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#8a8f98', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', textDecoration: 'none' }}
                        >
                          <Github size={13} />
                          <span>Code</span>
                        </a>
                        {p.live_url && (
                          <a
                            href={p.live_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#8a8f98', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', textDecoration: 'none' }}
                          >
                            <Globe size={13} />
                            <span>Demo</span>
                          </a>
                        )}
                      </div>

                      {/* Upvote Button connected to backend */}
                      <button
                        onClick={() => handleUpvote(p.id)}
                        disabled={isUpvoted || upvotingId === p.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isUpvoted ? 'rgba(228, 242, 34, 0.15)' : '#08090a',
                          border: `1px solid ${isUpvoted ? '#e4f222' : '#23252a'}`,
                          color: isUpvoted ? '#e4f222' : '#ffffff',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: isUpvoted ? 'default' : 'pointer',
                          fontFamily: "'JetBrains Mono', monospace",
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <ThumbsUp size={12} style={{ fill: isUpvoted ? '#e4f222' : 'none' }} />
                        <span>▲ {p.upvotes}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal: Quick Register for Sprint */}
        {isRegistering && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: '20px',
            }}
          >
            <div
              style={{
                background: '#141517',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '28px',
                maxWidth: '440px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  Register for {data.title}
                </h3>
                <button
                  onClick={() => setIsRegistering(false)}
                  style={{ background: 'transparent', border: 'none', color: '#8a8f98', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="your.email@university.edu"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>University or Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. VIT Chennai, IIT Madras"
                    value={regOrg}
                    onChange={(e) => setRegOrg(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#8a8f98', marginBottom: '4px' }}>Preferred Track</label>
                  <select
                    value={regTrack}
                    onChange={(e) => setRegTrack(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                  >
                    <option value="">Undecided / Open</option>
                    {data.tracks.map((t) => (
                      <option key={t.id} value={t.title}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    style={{ flex: 1, padding: '8px', background: '#08090a', border: '1px solid #23252a', borderRadius: '6px', color: '#8a8f98', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={regSubmitting}
                    style={{ flex: 2, padding: '8px', background: '#e4f222', color: '#08090a', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {regSubmitting ? 'Registering...' : 'Confirm Registration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
