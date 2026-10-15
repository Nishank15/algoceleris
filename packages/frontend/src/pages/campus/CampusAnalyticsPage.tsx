import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Compass,
  Cpu,
  Brain,
  BarChart3,
  Clock,
  FlaskConical,
  Activity,
  Send,
  Sparkles,
  Award,
  Calendar,
  Filter,
  CheckCircle2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export const CampusAnalyticsPage: React.FC = () => {
  const { orgSlug: paramSlug, tab } = useParams<{ orgSlug?: string; tab?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const navigate = useNavigate();

  const activeTab = tab || 'learning-journey';

  const [selectedCourse, setSelectedCourse] = useState<string>('bacs101');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all_time');

  // Tab 1: Learning Journey Mock Data
  const activityOverTimeData = [
    { date: 'Oct 01', runs: 24, ai: 2 },
    { date: 'Oct 03', runs: 38, ai: 3 },
    { date: 'Oct 05', runs: 65, ai: 5 },
    { date: 'Oct 08', runs: 42, ai: 1 },
    { date: 'Oct 10', runs: 90, ai: 8 },
    { date: 'Oct 12', runs: 110, ai: 12 },
    { date: 'Oct 14', runs: 75, ai: 4 },
  ];

  const activityBreakdownData = [
    { category: 'Run Code', count: 476, fill: '#3b82f6' },
    { category: 'Ask AI Hint', count: 14, fill: '#8b5cf6' },
    { category: 'Submit Solution', count: 209, fill: '#10b981' },
    { category: 'MCQ Quiz Answers', count: 240, fill: '#f59e0b' },
  ];

  const timeSpentPerLabData = [
    { lab: 'Lab Ex 1 (Basics)', hours: 1.2 },
    { lab: 'Lab Ex 2 (OOP)', hours: 2.1 },
    { lab: 'Lab Ex 3 (Inheritance)', hours: 2.4 },
    { lab: 'Week 10_PPS', hours: 3.2 },
    { lab: 'Week 11_Multithread', hours: 4.8 },
    { lab: 'Week 12_Generics', hours: 5.2 },
  ];

  // Tab 2: Programming Analytics Mock Data
  const marksProgressionData = [
    { submission: 'Sub 1', marks: 12.0 },
    { submission: 'Sub 5', marks: 14.5 },
    { submission: 'Sub 10', marks: 16.0 },
    { submission: 'Sub 15', marks: 17.5 },
    { submission: 'Sub 20', marks: 18.5 },
    { submission: 'Sub 25', marks: 20.0 },
  ];

  const codeRunsOverTimeData = [
    { day: 'Mon', runs: 62 },
    { day: 'Tue', runs: 85 },
    { day: 'Wed', runs: 45 },
    { day: 'Thu', runs: 110 },
    { day: 'Fri', runs: 95 },
    { day: 'Sat', runs: 40 },
    { day: 'Sun', runs: 39 },
  ];

  // Tab 3: AI Mentor Analytics Mock Data
  const aiQuestionsOverTimeData = [
    { date: 'Week 1', questions: 1, latencyMs: 1200 },
    { date: 'Week 2', questions: 3, latencyMs: 1400 },
    { date: 'Week 3', questions: 2, latencyMs: 1350 },
    { date: 'Week 4', questions: 4, latencyMs: 1500 },
    { date: 'Week 5', questions: 4, latencyMs: 1420 },
  ];

  const hintsByTypeData = [
    { type: 'Debugging / NullPointerException', count: 6, fill: '#ef4444' },
    { type: 'Concurrency / Race Conditions', count: 5, fill: '#f59e0b' },
    { type: 'Generic Wildcard Invariance', count: 3, fill: '#3b82f6' },
  ];

  // Tab 4: CLO Analytics Mock Data
  const cloAttainmentData = [
    { clo: 'CLO-1: Core Java OOP', attainment: 88, benchmark: 75 },
    { clo: 'CLO-2: Concurrency & Threads', attainment: 92, benchmark: 75 },
    { clo: 'CLO-3: Collections Framework', attainment: 82, benchmark: 75 },
    { clo: 'CLO-4: Generics & Serialization', attainment: 76, benchmark: 75 },
  ];

  const cloTrendData = [
    { assessment: 'PAT 1', attainment: 78 },
    { assessment: 'Lab Ex 1-4', attainment: 82 },
    { assessment: 'PAT 2', attainment: 81 },
    { assessment: 'Lab Ex 5-8', attainment: 85 },
    { assessment: 'FAT Mock', attainment: 89 },
  ];

  return (
    <div className="campus-analytics-page">
      {/* Top Header & Course Filters */}
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Student Learning Analytics Suite</h1>
          <p className="analytics-sub">
            Track engagement, programming velocity, AI mentor Socratic cues, and Course Learning Outcome (CLO) attainment.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="analytics-filter-controls">
          <div className="filter-item">
            <span className="filter-label">Course</span>
            <select
              className="analytics-select"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="bacs101">BACS101 · Problem Solving Using Java</option>
              <option value="all">All Courses</option>
            </select>
          </div>

          <div className="filter-item">
            <span className="filter-label">Timeframe</span>
            <select
              className="analytics-select"
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
            >
              <option value="all_time">All Time (Fall 2025-26)</option>
              <option value="30_days">Last 30 Days</option>
              <option value="7_days">Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 Analytics Navigation Tabs */}
      <nav className="analytics-tabs-bar" role="tablist">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'learning-journey' ? 'active' : ''}`}
          onClick={() => navigate(`/campus/${orgSlug}/student/analytics/learning-journey`)}
        >
          <Compass size={15} />
          <span>1. Learning Journey</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'programming' ? 'active' : ''}`}
          onClick={() => navigate(`/campus/${orgSlug}/student/analytics/programming`)}
        >
          <Cpu size={15} />
          <span>2. Programming Analytics</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'ai-mentor' ? 'active' : ''}`}
          onClick={() => navigate(`/campus/${orgSlug}/student/analytics/ai-mentor`)}
        >
          <Brain size={15} />
          <span>3. AI Mentor Analytics</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'clo' ? 'active' : ''}`}
          onClick={() => navigate(`/campus/${orgSlug}/student/analytics/clo`)}
        >
          <BarChart3 size={15} />
          <span>4. CLO Analytics</span>
        </button>
      </nav>

      {/* TAB 1: LEARNING JOURNEY */}
      {activeTab === 'learning-journey' && (
        <div className="analytics-body">
          {/* 4 KPI Cards */}
          <div className="analytics-kpi-row">
            <div className="kpi-card">
              <span className="kpi-lbl">Active time</span>
              <span className="kpi-num font-mono">18h 59m</span>
              <span className="kpi-trend text-blue">Across active semester</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Labs engaged</span>
              <span className="kpi-num font-mono">24</span>
              <span className="kpi-trend text-green">100% completion rate</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Activities</span>
              <span className="kpi-num font-mono">490</span>
              <span className="kpi-trend text-purple">Runs, MCQs, Hints</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Submissions</span>
              <span className="kpi-num font-mono">209</span>
              <span className="kpi-trend text-amber">Graded code entries</span>
            </div>
          </div>

          {/* Recharts Grid */}
          <div className="analytics-chart-grid">
            <div className="chart-card">
              <div className="chart-head">
                <h3>Activity Over Time</h3>
                <span className="chart-sub">Daily code execution and AI interactions</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={activityOverTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Legend />
                    <Line type="monotone" dataKey="runs" stroke="#3b82f6" strokeWidth={2} name="Code Runs" />
                    <Line type="monotone" dataKey="ai" stroke="#8b5cf6" strokeWidth={2} name="AI Questions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <h3>Activity Breakdown</h3>
                <span className="chart-sub">Distribution of student actions</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={activityBreakdownData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis type="number" stroke="#6b7280" fontSize={11} />
                    <YAxis dataKey="category" type="category" stroke="#6b7280" fontSize={11} width={110} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card full-width">
              <div className="chart-head">
                <h3>Time Spent Per Lab Exercise</h3>
                <span className="chart-sub">Hours dedicated per progressive lab module</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={timeSpentPerLabData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis dataKey="lab" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROGRAMMING ANALYTICS */}
      {activeTab === 'programming' && (
        <div className="analytics-body">
          <div className="analytics-kpi-row">
            <div className="kpi-card">
              <span className="kpi-lbl">Code runs</span>
              <span className="kpi-num font-mono">476</span>
              <span className="kpi-trend text-blue">Across test cases</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Submissions</span>
              <span className="kpi-num font-mono">209</span>
              <span className="kpi-trend text-green">Practice & challenges</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Average marks</span>
              <span className="kpi-num font-mono">8.82 / 10</span>
              <span className="kpi-trend text-amber">Top 15% in cohort</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Best marks</span>
              <span className="kpi-num font-mono">18.75 / 20</span>
              <span className="kpi-trend text-purple">Week 12_Generics</span>
            </div>
          </div>

          <div className="analytics-chart-grid">
            <div className="chart-card">
              <div className="chart-head">
                <h3>Marks Progression</h3>
                <span className="chart-sub">Evaluation score growth over submissions</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={marksProgressionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis dataKey="submission" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} domain={[10, 20]} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Line type="monotone" dataKey="marks" stroke="#10b981" strokeWidth={2} name="Score (Points)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <h3>Weekly Code Runs Velocity</h3>
                <span className="chart-sub">Compilation activity distribution</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={codeRunsOverTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Bar dataKey="runs" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Runs" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI MENTOR ANALYTICS */}
      {activeTab === 'ai-mentor' && (
        <div className="analytics-body">
          <div className="analytics-kpi-row">
            <div className="kpi-card">
              <span className="kpi-lbl">AI questions</span>
              <span className="kpi-num font-mono">14</span>
              <span className="kpi-trend text-blue">Socratic prompts</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Avg response</span>
              <span className="kpi-num font-mono">1.4s</span>
              <span className="kpi-trend text-green">Tok/sec high speed</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Hints used</span>
              <span className="kpi-num font-mono">14</span>
              <span className="kpi-trend text-amber">Zero direct code reveals</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Mentors used</span>
              <span className="kpi-num font-mono">2</span>
              <span className="kpi-trend text-purple">Java & Concurrency</span>
            </div>
          </div>

          <div className="analytics-chart-grid">
            <div className="chart-card">
              <div className="chart-head">
                <h3>AI Questions & Latency Over Weeks</h3>
                <span className="chart-sub">Mentor query volume vs response time</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={aiQuestionsOverTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Line type="monotone" dataKey="questions" stroke="#8b5cf6" strokeWidth={2} name="Questions" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <h3>Hints by Problem Category</h3>
                <span className="chart-sub">Where assistance was sought most</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={hintsByTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis type="number" stroke="#6b7280" fontSize={11} />
                    <YAxis dataKey="type" type="category" stroke="#6b7280" fontSize={11} width={150} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLO ANALYTICS */}
      {activeTab === 'clo' && (
        <div className="analytics-body">
          <div className="analytics-kpi-row">
            <div className="kpi-card">
              <span className="kpi-lbl">CLOs tracked</span>
              <span className="kpi-num font-mono">4</span>
              <span className="kpi-trend text-blue">Accredited outcomes</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Average attainment</span>
              <span className="kpi-num font-mono">84%</span>
              <span className="kpi-trend text-green">&gt; 75% target threshold</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Strongest CLO</span>
              <span className="kpi-num font-mono">CLO-2</span>
              <span className="kpi-trend text-purple">Concurrency (92%)</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-lbl">Weakest CLO</span>
              <span className="kpi-num font-mono">CLO-4</span>
              <span className="kpi-trend text-amber">Generics (76%)</span>
            </div>
          </div>

          <div className="analytics-chart-grid">
            <div className="chart-card">
              <div className="chart-head">
                <h3>Attainment by Course Learning Outcome (CLO)</h3>
                <span className="chart-sub">Actual score vs NBA/ABET accreditation benchmark</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={cloAttainmentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis dataKey="clo" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Legend />
                    <Bar dataKey="attainment" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual Attainment %" />
                    <Bar dataKey="benchmark" fill="#6b7280" radius={[4, 4, 0, 0]} name="Benchmark %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <h3>CLO Attainment Trend Across Evaluations</h3>
                <span className="chart-sub">Progression over semester assessments</span>
              </div>
              <div className="chart-container" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={cloTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#23252a" />
                    <XAxis dataKey="assessment" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} domain={[70, 100]} />
                    <Tooltip contentStyle={{ background: '#121316', borderColor: '#23252a' }} />
                    <Line type="monotone" dataKey="attainment" stroke="#60a5fa" strokeWidth={2} name="Attainment %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusAnalyticsPage;
