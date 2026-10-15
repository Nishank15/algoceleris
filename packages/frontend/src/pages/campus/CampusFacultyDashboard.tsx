import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  GraduationCap,
  PlusCircle,
  Eye,
  Video,
  FileCheck2,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FlaskConical,
  ExternalLink,
} from 'lucide-react';
import { getCampusSession } from '../../services/campusSession';

export const CampusFacultyDashboard: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const navigate = useNavigate();
  const session = getCampusSession(orgSlug);

  const [selectedCohort, setSelectedCohort] = useState<string>('BACS101 - CH2025260101659');

  const recentStudentSubmissions = [
    {
      studentId: '25BCE1642',
      name: 'NISHANK CHHIPA',
      lab: 'PPS_11_Multi_Threading',
      score: '20/20',
      status: 'Evaluated',
      submittedAt: '12 mins ago',
      plagiarismSimilarity: '4.2%',
    },
    {
      studentId: '25BCE1710',
      name: 'ARAVIND S',
      lab: 'PPS_11_Multi_Threading',
      score: '18.5/20',
      status: 'Evaluated',
      submittedAt: '34 mins ago',
      plagiarismSimilarity: '6.1%',
    },
    {
      studentId: '25BCE1892',
      name: 'PRIYA K',
      lab: 'PPS_11_Multi_Threading',
      score: 'Pending',
      status: 'In Review',
      submittedAt: '1 hour ago',
      plagiarismSimilarity: '3.8%',
    },
  ];

  return (
    <div className="campus-faculty-dashboard">
      {/* Faculty Welcome & Action Bar */}
      <div className="faculty-header-bar">
        <div>
          <div className="faculty-badge-row">
            <span className="faculty-chip">👨‍🏫 Faculty Control Center</span>
            <span className="faculty-inst">{session.orgName || 'VIT Chennai'}</span>
          </div>
          <h1 className="faculty-title">Welcome, {session.name}</h1>
          <p className="faculty-sub">
            Faculty ID: <strong className="font-mono">{session.regNumber}</strong> · Department: {session.department}
          </p>
        </div>

        <div className="faculty-actions">
          <Link to="/campus/assessments/new" className="btn btn-primary faculty-new-lab-btn">
            <PlusCircle size={15} />
            <span>Create New 6-Stage Lab / PAT Exam</span>
          </Link>
        </div>
      </div>

      {/* Cohort Selector & Quick Metrics */}
      <div className="faculty-cohort-strip">
        <div className="cohort-select-wrap">
          <label className="cohort-label">Active Cohort:</label>
          <select
            className="cohort-select"
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
          >
            <option value="BACS101 - CH2025260101659">BACS101 - CH2025260101659 (Fall 2025-26)</option>
            <option value="BACS102 - CH2025260101700">BACS102 - Advanced Data Structures</option>
          </select>
        </div>

        <div className="cohort-stats-row">
          <span className="cohort-stat">
            Total Enrolled: <strong className="font-mono">64 Students</strong>
          </span>
          <span className="stat-sep">·</span>
          <span className="cohort-stat">
            Active Labs: <strong className="font-mono">1 Open</strong>
          </span>
          <span className="stat-sep">·</span>
          <span className="cohort-stat">
            Class Average: <strong className="font-mono text-green">8.82 / 10</strong>
          </span>
        </div>
      </div>

      {/* Active Lab Evaluation Progress */}
      <section className="faculty-progress-section">
        <div className="progress-card">
          <div className="progress-top">
            <div className="progress-title-block">
              <span className="live-dot" />
              <h3>PPS_11_Multi_Threading — Active Submission Progress</h3>
            </div>
            <span className="deadline-badge">Due in 4 days</span>
          </div>

          <div className="progress-bar-block">
            <div className="progress-info">
              <span>58 of 64 students submitted</span>
              <strong className="font-mono">90.6% Complete</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '90.6%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* 3 Quick Supervised Access Portals */}
      <div className="faculty-quick-portals">
        <div className="portal-card">
          <div className="portal-icon-box blue">
            <Eye size={20} />
          </div>
          <div className="portal-text">
            <h4>Live Proctor Cockpit</h4>
            <p>Monitor student browser focus, tab switches, and fullscreen integrity in real-time.</p>
          </div>
          <Link to="/campus/assessments/midterm-1/proctor" className="btn btn-secondary portal-btn">
            <span>Open Cockpit</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="portal-card">
          <div className="portal-icon-box green">
            <Video size={20} />
          </div>
          <div className="portal-text">
            <h4>Viva Grading Rooms</h4>
            <p>Collaborative multi-player Yjs CRDT code execution room with masked private rubric.</p>
          </div>
          <Link to="/campus/assessments/viva/VIVA-CS201-9871" className="btn btn-secondary portal-btn">
            <span>Enter Viva Room</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="portal-card">
          <div className="portal-icon-box purple">
            <FileCheck2 size={20} />
          </div>
          <div className="portal-text">
            <h4>AST Plagiarism Matrix</h4>
            <p>Tokenized AST Winnowing similarity detection invariant to variable renaming & comments.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary portal-btn"
            onClick={() => alert('AST Plagiarism Engine: 0 critical collusions detected across 58 submitted solutions.')}
          >
            <span>Scan Plagiarism</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Recent Student Submissions Table */}
      <section className="faculty-submissions-section">
        <div className="submissions-head">
          <h3>Recent Student Submissions</h3>
          <span className="text-muted text-xs">Evaluated via Rust kernel sandbox</span>
        </div>

        <div className="table-responsive">
          <table className="faculty-table">
            <thead>
              <tr>
                <th>Registration ID</th>
                <th>Student Name</th>
                <th>Lab Exercise</th>
                <th>Score</th>
                <th>Plagiarism Similarity</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentStudentSubmissions.map((sub, idx) => (
                <tr key={idx}>
                  <td className="font-mono">{sub.studentId}</td>
                  <td><strong>{sub.name}</strong></td>
                  <td>{sub.lab}</td>
                  <td className="font-mono text-green">{sub.score}</td>
                  <td>
                    <span className="plag-badge font-mono">{sub.plagiarismSimilarity} (Clean)</span>
                  </td>
                  <td className="text-muted">{sub.submittedAt}</td>
                  <td>
                    <Link
                      to={`/campus/${orgSlug}/student/labs/pps-11-multi-threading/review`}
                      className="table-action-link"
                    >
                      Inspect Solution &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default CampusFacultyDashboard;
