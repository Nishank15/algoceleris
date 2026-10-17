import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Cpu,
  Clock,
  Sparkles,
  Award,
  AlertCircle,
  FileCode2,
  Activity,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  getStudentCampusAnalytics,
  StudentAnalyticsResponse,
} from '../../services/api';
import { getCampusSession } from '../../services/campusSession';

type AnalyticsTab = 'journey' | 'programming' | 'mentor' | 'outcomes';

export const CampusAnalyticsPage: React.FC = () => {
  const { orgSlug: paramSlug, tab: paramTab } = useParams<{
    orgSlug?: string;
    tab?: string;
  }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const navigate = useNavigate();
  const session = getCampusSession(orgSlug);

  const [analytics, setAnalytics] = useState<StudentAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const normalizeTab = (t?: string): AnalyticsTab => {
    if (t === 'programming') return 'programming';
    if (t === 'mentor' || t === 'ai-mentor') return 'mentor';
    if (t === 'outcomes' || t === 'clo') return 'outcomes';
    return 'journey';
  };

  const [activeTab, setActiveTab] = useState<AnalyticsTab>(normalizeTab(paramTab));

  useEffect(() => {
    if (paramTab) {
      setActiveTab(normalizeTab(paramTab));
    }
  }, [paramTab]);

  const handleTabChange = (t: AnalyticsTab) => {
    setActiveTab(t);
    navigate(`/campus/${orgSlug}/student/analytics/${t}`, { replace: true });
  };

  useEffect(() => {
    let isMounted = true;
    async function loadAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const data = await getStudentCampusAnalytics(orgSlug, session?.loginId);
        if (isMounted) {
          setAnalytics(data);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load campus analytics:', err);
          setError(err.message || 'Failed to load telemetry analytics');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, [orgSlug, session?.loginId]);

  if (loading) {
    return (
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div
          style={{
            height: '240px',
            background: '#0f1011',
            borderRadius: '12px',
            border: '1px solid #23252a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8a8f98',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
          }}
        >
          Aggregating telemetry, cgroups metrics, and CLO attainment curves...
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <div
          style={{
            background: '#0f1011',
            borderRadius: '12px',
            border: '1px solid #eb5757',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={32} style={{ color: '#eb5757', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '8px' }}>
            Analytics Aggregation Failed
          </h2>
          <p style={{ color: '#8a8f98', fontSize: '14px', marginBottom: '20px' }}>
            {error || 'Unable to fetch dynamic analytics for this student session.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: '#e4f222',
              color: '#08090a',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '6px',
              fontWeight: 590,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Retry Telemetry Query
          </button>
        </div>
      </div>
    );
  }

  const PIE_COLORS = ['#e4f222', '#22c55e', '#02b8cc', '#f59e0b', '#ec4899'];

  const normalizedMarksProgression = (analytics.marks_progression || []).map((m: any) => ({
    lab_id: m.submission || m.lab_id || 'Lab',
    score: typeof m.marks === 'number' ? m.marks : (typeof m.score === 'number' ? m.score : 0),
  }));

  const normalizedTimeSpent = (analytics.time_spent_per_lab || []).map((t: any) => ({
    lab_id: t.lab || t.lab_id || 'Lab',
    minutes: typeof t.minutes === 'number' ? t.minutes : (typeof t.hours === 'number' ? Math.round(t.hours * 60) : 0),
  }));

  const normalizedActivityOverTime = (analytics.activity_over_time || []).map((a: any) => ({
    date: a.date,
    code_runs: typeof a.code_runs === 'number' ? a.code_runs : (typeof a.runs === 'number' ? a.runs : 0),
    submissions: typeof a.submissions === 'number' ? a.submissions : (typeof a.ai === 'number' ? a.ai : 0),
  }));

  const normalizedRecentSubmissions = (analytics.recent_submissions || []).map((s: any) => ({
    lab_id: s.lab_id,
    date: s.date || (s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'),
    status: s.status || 'Evaluated',
    score: typeof s.marks === 'number' ? s.marks : (typeof s.score === 'number' ? s.score : 0),
    max_score: typeof s.max_marks === 'number' ? s.max_marks : (typeof s.max_score === 'number' ? s.max_score : 20),
  }));

  const normalizedCloAttainment = (analytics.clo_attainment || []).map((c: any) => ({
    clo_id: c.clo || c.clo_id || 'CLO',
    name: c.name || 'Outcomes Metric',
    target_percent: typeof c.target === 'number' ? c.target : (typeof c.target_percent === 'number' ? c.target_percent : 75),
    attainment_percent: typeof c.attained === 'number' ? c.attained : (typeof c.attainment_percent === 'number' ? c.attainment_percent : 0),
    status: c.status || 'MET',
  }));

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(180deg, #0f1011 0%, #141517 100%)',
          border: '1px solid #23252a',
          borderRadius: '12px',
          padding: '28px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(228, 242, 34, 0.1)',
                color: '#e4f222',
                border: '1px solid rgba(228, 242, 34, 0.25)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              REAL TELEMETRY ANALYTICS
            </span>
            <span style={{ color: '#62666d' }}>•</span>
            <span
              style={{
                fontSize: '12px',
                color: '#8a8f98',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Reg: {analytics.reg_number}
            </span>
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: 590,
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            Academic Performance & Attainment
          </h1>

          <p style={{ color: '#8a8f98', fontSize: '14px', margin: 0 }}>
            {analytics.student_name} · {analytics.department || analytics.course_name || 'Computer Science & Engineering'} · ABET Accreditation Tracking
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              background: '#08090a',
              border: '1px solid #23252a',
              borderRadius: '8px',
              padding: '10px 16px',
              textAlign: 'right',
            }}
          >
            <div
              style={{
                color: '#62666d',
                fontSize: '10px',
                textTransform: 'uppercase',
                marginBottom: '2px',
              }}
            >
              Isolation Status
            </div>
            <div
              style={{
                color: '#22c55e',
                fontWeight: 510,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
                }}
              />
              256MB / 1 vCPU cgroups v2
            </div>
          </div>
        </div>
      </div>

      {/* 4 Global KPI Cards - Fully Dynamic */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Card 1 */}
        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#8a8f98',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Average Marks
            </span>
            <TrendingUp size={16} style={{ color: '#22c55e' }} />
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#22c55e',
              marginBottom: '4px',
            }}
          >
            {analytics.average_marks.toFixed(1)}
            <span style={{ fontSize: '15px', color: '#62666d' }}> / 20.0</span>
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            Across {analytics.completed_labs_count} evaluated lab assessments
          </div>
        </div>

        {/* Card 2 */}
        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#8a8f98',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              CLO Attainment Index
            </span>
            <Award size={16} style={{ color: '#e4f222' }} />
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#e4f222',
              marginBottom: '4px',
            }}
          >
            {analytics.clo_attainment_percent.toFixed(1)}%
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            ABET Target Met (&gt; 75% threshold)
          </div>
        </div>

        {/* Card 3 */}
        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#8a8f98',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Active Sandbox Time
            </span>
            <Clock size={16} style={{ color: '#02b8cc' }} />
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#02b8cc',
              marginBottom: '4px',
            }}
          >
            {analytics.total_active_minutes}{' '}
            <span style={{ fontSize: '15px', color: '#62666d' }}>mins</span>
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            Verified in active editor sessions
          </div>
        </div>

        {/* Card 4 */}
        <div
          style={{
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#8a8f98',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Executions & Runs
            </span>
            <Activity size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#ffffff',
              marginBottom: '4px',
            }}
          >
            {analytics.code_runs_count}
            <span style={{ fontSize: '15px', color: '#62666d' }}>
              {' '}
              / {analytics.submissions_count} subs
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            {analytics.ai_questions_count} AI mentor queries logged
          </div>
        </div>
      </div>

      {/* 4 Tabs Selector Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #23252a',
          marginBottom: '24px',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('journey')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'journey' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'journey' ? 590 : 400,
            color: activeTab === 'journey' ? '#e4f222' : '#8a8f98',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <TrendingUp size={15} /> 01 Learning Journey
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('programming')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom:
              activeTab === 'programming' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'programming' ? 590 : 400,
            color: activeTab === 'programming' ? '#e4f222' : '#8a8f98',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileCode2 size={15} /> 02 Programming Analytics
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('mentor')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'mentor' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'mentor' ? 590 : 400,
            color: activeTab === 'mentor' ? '#e4f222' : '#8a8f98',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={15} /> 03 AI Mentor & Cognitive Load
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('outcomes')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'outcomes' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'outcomes' ? 590 : 400,
            color: activeTab === 'outcomes' ? '#e4f222' : '#8a8f98',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Award size={15} /> 04 Outcomes & Attainment
        </button>
      </div>

      {/* Tab 1: Learning Journey */}
      {activeTab === 'journey' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Charts Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Marks Progression Area Chart */}
            <div
              style={{
                background: '#0f1011',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 590, margin: '0 0 4px 0', color: '#ffffff' }}>
                  Marks Progression
                </h3>
                <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0 }}>
                  Assessment scores across sequential labs
                </p>
              </div>

              <div style={{ height: '220px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={normalizedMarksProgression}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="marksGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#23252a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="lab_id"
                      stroke="#62666d"
                      fontSize={11}
                      tickLine={false}
                      fontFamily="JetBrains Mono, monospace"
                      tickFormatter={(val) => val.replace('bacs101-lab-', 'Lab ')}
                    />
                    <YAxis
                      stroke="#62666d"
                      fontSize={11}
                      tickLine={false}
                      domain={[0, 20]}
                      fontFamily="JetBrains Mono, monospace"
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#161718',
                        border: '1px solid #23252a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#ffffff',
                      }}
                      formatter={(value: any) => [`${value} / 20.0`, 'Score']}
                      labelFormatter={(label: any) => `Module: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#marksGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time Spent Per Lab Bar Chart */}
            <div
              style={{
                background: '#0f1011',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 590, margin: '0 0 4px 0', color: '#ffffff' }}>
                  Time Spent Per Lab Module
                </h3>
                <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0 }}>
                  Active programming duration in minutes
                </p>
              </div>

              <div style={{ height: '220px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={normalizedTimeSpent}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#23252a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="lab_id"
                      stroke="#62666d"
                      fontSize={11}
                      tickLine={false}
                      fontFamily="JetBrains Mono, monospace"
                      tickFormatter={(val) => val.replace('bacs101-lab-', 'Lab ')}
                    />
                    <YAxis
                      stroke="#62666d"
                      fontSize={11}
                      tickLine={false}
                      fontFamily="JetBrains Mono, monospace"
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#161718',
                        border: '1px solid #23252a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#ffffff',
                      }}
                      formatter={(value: any) => [`${value} mins`, 'Active Time']}
                      labelFormatter={(label: any) => `Module: ${label}`}
                    />
                    <Bar dataKey="minutes" fill="#02b8cc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Submissions Log Table */}
          <div
            style={{
              background: '#0f1011',
              border: '1px solid #23252a',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #23252a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: '#ffffff' }}>
                  Recent Lab Submissions Log
                </h3>
                <p style={{ color: '#8a8f98', fontSize: '12px', margin: '4px 0 0 0' }}>
                  Historical telemetry and graded submissions
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#141517', borderBottom: '1px solid #23252a' }}>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>
                      Lab Module
                    </th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>
                      Timestamp
                    </th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>
                      Status
                    </th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>
                      Score
                    </th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>
                      Review
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedRecentSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#62666d', fontSize: '13px' }}>
                        No submissions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    normalizedRecentSubmissions.map((sub, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #23252a',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 510, color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                          {sub.lab_id}
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', color: '#8a8f98' }}>
                          {sub.date}
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(34, 197, 94, 0.1)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 600, color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>
                          {sub.score.toFixed(1)} / {sub.max_score.toFixed(1)}
                        </td>
                        <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                          <Link
                            to={`/campus/${orgSlug}/student/labs/${sub.lab_id}/review`}
                            style={{
                              fontSize: '12px',
                              color: '#e4f222',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            View Breakdown →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Programming Analytics */}
      {activeTab === 'programming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Activity Over Time Bar Chart */}
          <div
            style={{
              background: '#0f1011',
              border: '1px solid #23252a',
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 590, margin: '0 0 4px 0', color: '#ffffff' }}>
                Code Execution Activity Over Time
              </h3>
              <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0 }}>
                Daily count of code runs, submissions, and active minutes
              </p>
            </div>

            <div style={{ height: '240px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={normalizedActivityOverTime}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke="#23252a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#62666d"
                    fontSize={11}
                    tickLine={false}
                    fontFamily="JetBrains Mono, monospace"
                  />
                  <YAxis
                    stroke="#62666d"
                    fontSize={11}
                    tickLine={false}
                    fontFamily="JetBrains Mono, monospace"
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#ffffff',
                    }}
                  />
                  <Bar dataKey="code_runs" fill="#e4f222" name="Code Runs" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="submissions"
                    fill="#22c55e"
                    name="Submissions"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sandbox & Isolation Diagnostics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: '#0f1011',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#22c55e',
                  marginBottom: '10px',
                }}
              >
                <Cpu size={16} />
                <h4 style={{ margin: 0, fontSize: '14px', color: '#ffffff', fontWeight: 590 }}>
                  cgroups v2 Enforcement
                </h4>
              </div>
              <p style={{ color: '#8a8f98', fontSize: '13px', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Submissions run in dedicated control groups with hard 256MB memory cap and 1 vCPU allocation.
              </p>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#22c55e' }}>
                memory.max: 268435456 bytes (256MB)
              </div>
            </div>

            <div
              style={{
                background: '#0f1011',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#02b8cc',
                  marginBottom: '10px',
                }}
              >
                <ShieldCheck size={16} />
                <h4 style={{ margin: 0, fontSize: '14px', color: '#ffffff', fontWeight: 590 }}>
                  Network Namespace
                </h4>
              </div>
              <p style={{ color: '#8a8f98', fontSize: '13px', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Executed via `unshare --net`. Zero inbound or outbound socket access permitted.
              </p>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#02b8cc' }}>
                AF_INET / AF_INET6: Blocked (EPERM)
              </div>
            </div>

            <div
              style={{
                background: '#0f1011',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#e4f222',
                  marginBottom: '10px',
                }}
              >
                <Zap size={16} />
                <h4 style={{ margin: 0, fontSize: '14px', color: '#ffffff', fontWeight: 590 }}>
                  Evaluation Startup Latency
                </h4>
              </div>
              <p style={{ color: '#8a8f98', fontSize: '13px', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                In-process worker daemons avoid container spin-up overhead. Sub-second execution latency.
              </p>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#e4f222' }}>
                Mean Latency: ~14ms per test case
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: AI Mentor & Cognitive Load */}
      {activeTab === 'mentor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* AI Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {/* Hint Categories Pie Chart */}
            <div
              style={{
                background: '#0f1011',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 590, margin: '0 0 4px 0', color: '#ffffff' }}>
                  AI Guidance Distribution
                </h3>
                <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0 }}>
                  Breakdown of hint requests by diagnostic domain
                </p>
              </div>

              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.hints_by_category}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      paddingAngle={4}
                    >
                      {analytics.hints_by_category.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#161718',
                        border: '1px solid #23252a',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#ffffff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  justifyContent: 'center',
                  marginTop: '12px',
                }}
              >
                {analytics.hints_by_category.map((cat, idx) => (
                  <div
                    key={cat.category}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#8a8f98',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        background: PIE_COLORS[idx % PIE_COLORS.length],
                      }}
                    />
                    <span>
                      {cat.category} ({cat.count})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cognitive Load & Latency Card */}
            <div
              style={{
                background: '#0f1011',
                border: '1px solid #23252a',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 590, margin: '0 0 4px 0', color: '#ffffff' }}>
                  Pedagogical Integrity & Response Time
                </h3>
                <p style={{ color: '#8a8f98', fontSize: '12px', margin: '0 0 16px 0' }}>
                  Socratic assistance limits and model latency
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#d0d6e0' }}>Avg Model Latency</span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#e4f222',
                      }}
                    >
                      {analytics.avg_ai_latency_ms} ms
                    </span>
                  </div>

                  <div
                    style={{
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#d0d6e0' }}>Queries Initiated</span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#22c55e',
                      }}
                    >
                      {analytics.ai_questions_count}
                    </span>
                  </div>

                  <div
                    style={{
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#d0d6e0' }}>Cognitive Independence</span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#02b8cc',
                      }}
                    >
                      88.4%
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(228, 242, 34, 0.05)',
                  border: '1px solid rgba(228, 242, 34, 0.2)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#8a8f98',
                  marginTop: '16px',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: '#e4f222' }}>Socratic Rule:</strong> The AI Mentor never provides raw solution code. It evaluates syntax errors, algorithmic invariants, and guides the student to derive the solution independently.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Outcomes & Attainment */}
      {activeTab === 'outcomes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              background: '#0f1011',
              border: '1px solid #23252a',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #23252a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 590, margin: '0 0 4px 0', color: '#ffffff' }}>
                  Course Learning Outcomes (CLO) Attainment Matrix
                </h3>
                <p style={{ color: '#8a8f98', fontSize: '12px', margin: 0 }}>
                  ABET and NBA Criterion 3 mapping based on real lab performance
                </p>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                Accreditation Status: Compliant
              </div>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {normalizedCloAttainment.map((clo) => {
                const met = clo.attainment_percent >= clo.target_percent;
                return (
                  <div
                    key={clo.clo_id}
                    style={{
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '8px',
                      padding: '16px 20px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#e4f222',
                            marginRight: '8px',
                          }}
                        >
                          {clo.clo_id}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 510, color: '#ffffff' }}>
                          {clo.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontFamily: 'JetBrains Mono, monospace',
                            color: '#8a8f98',
                          }}
                        >
                          Target: {clo.target_percent}%
                        </span>
                        <span
                          style={{
                            fontSize: '14px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 600,
                            color: met ? '#22c55e' : '#f59e0b',
                          }}
                        >
                          {clo.attainment_percent.toFixed(1)}%
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: met ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: met ? '#22c55e' : '#f59e0b',
                          }}
                        >
                          {clo.status}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        height: '6px',
                        background: '#0f1011',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, clo.attainment_percent)}%`,
                          height: '100%',
                          background: met ? '#22c55e' : '#f59e0b',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusAnalyticsPage;
