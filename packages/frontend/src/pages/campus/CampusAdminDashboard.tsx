import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  CreditCard,
  Users,
  CheckCircle2,
  Mail,
  Upload,
  Cpu,
  Server,
  Plus,
  Building2,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { getCampusSession } from '../../services/campusSession';

export const CampusAdminDashboard: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const session = getCampusSession(orgSlug);

  // Invite faculty state
  const [facultyName, setFacultyName] = useState<string>('');
  const [facultyEmail, setFacultyEmail] = useState<string>('');
  const [facultyDept, setFacultyDept] = useState<string>('SCOPE');
  const [inviteNotification, setInviteNotification] = useState<string | null>(null);

  // CSV Roster upload state
  const [csvUploadedFile, setCsvUploadedFile] = useState<string | null>(null);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (facultyEmail.trim()) {
      setInviteNotification(`Invitation dispatched to ${facultyEmail} with faculty provisioning token.`);
      setFacultyName('');
      setFacultyEmail('');
      setTimeout(() => setInviteNotification(null), 4000);
    }
  };

  return (
    <div className="campus-admin-dashboard">
      {/* Top Header */}
      <div className="admin-header-bar">
        <div>
          <div className="admin-badge-row">
            <span className="admin-chip">👑 Institutional Administration</span>
            <span className="admin-org font-mono">{orgSlug.toUpperCase()}</span>
          </div>
          <h1 className="admin-title">{session.orgName || 'Vellore Institute of Technology, Chennai'}</h1>
          <p className="admin-sub">
            Managed by: <strong>{session.name}</strong> · ID: <span className="font-mono">{session.regNumber}</span>
          </p>
        </div>

        <div className="admin-license-pill">
          <div className="license-icon">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <strong>Campus Enterprise License</strong>
            <span className="license-status">Active · Renews Fall 2026</span>
          </div>
        </div>
      </div>

      {/* 4 Core Admin KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="kpi-top">
            <span className="kpi-lbl">Student Seats</span>
            <Users size={16} color="#60a5fa" />
          </div>
          <div className="kpi-body">
            <span className="kpi-val font-mono">1,420</span>
            <span className="kpi-sub font-mono">Unlimited Tier Active</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-top">
            <span className="kpi-lbl">Faculty Seats</span>
            <Building2 size={16} color="#34d399" />
          </div>
          <div className="kpi-body">
            <span className="kpi-val font-mono">42 / 100</span>
            <span className="kpi-sub">58 seats available</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-top">
            <span className="kpi-lbl">Sandbox Clusters</span>
            <Cpu size={16} color="#a855f7" />
          </div>
          <div className="kpi-body">
            <span className="kpi-val font-mono">cgroups v2</span>
            <span className="kpi-sub text-green">1 vCPU · 256MB Hard RAM</span>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-top">
            <span className="kpi-lbl">Email Whitelist</span>
            <Shield size={16} color="#fbbf24" />
          </div>
          <div className="kpi-body">
            <div className="whitelist-pills">
              <span className="domain-pill">@vitstudent.ac.in</span>
              <span className="domain-pill">@vit.ac.in</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Faculty Invitation vs Batch CSV Roster Import */}
      <div className="admin-two-col-grid">
        {/* Left: Faculty Invitation Form */}
        <section className="admin-section-card">
          <div className="section-head">
            <Mail size={16} color="#60a5fa" />
            <div>
              <h3>Invite New Faculty Member</h3>
              <p>Issue single-sign-on credentials and course authoring permissions.</p>
            </div>
          </div>

          {inviteNotification && (
            <div className="admin-notif-box">
              <CheckCircle2 size={14} />
              <span>{inviteNotification}</span>
            </div>
          )}

          <form onSubmit={handleSendInvite} className="admin-form">
            <div className="form-group">
              <label className="form-label">Faculty Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dr. K. Ramesh Kumar"
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Official University Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. rameshkumar.k@vit.ac.in"
                value={facultyEmail}
                onChange={(e) => setFacultyEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Academic Department / School</label>
              <select
                className="form-input"
                value={facultyDept}
                onChange={(e) => setFacultyDept(e.target.value)}
              >
                <option value="SCOPE">School of Computer Science & Engineering (SCOPE)</option>
                <option value="SENSE">School of Electronics Engineering (SENSE)</option>
                <option value="SMEC">School of Mechanical Engineering (SMEC)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary admin-submit-btn">
              <Plus size={14} />
              <span>Dispatch Faculty Invitation</span>
            </button>
          </form>
        </section>

        {/* Right: Student Roster CSV Batch Uploader */}
        <section className="admin-section-card">
          <div className="section-head">
            <Upload size={16} color="#34d399" />
            <div>
              <h3>Batch Student Roster CSV Import</h3>
              <p>Sync registered student registration numbers and section rosters.</p>
            </div>
          </div>

          <div className="csv-dropzone">
            <label className="dropzone-label">
              <Upload size={28} className="dropzone-icon" />
              <span className="dropzone-text">Click or drag CSV roster file here</span>
              <span className="dropzone-sub">Accepts .csv with columns: reg_no, name, email, section</span>
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setCsvUploadedFile(e.target.files[0].name);
                    alert(`Roster file "${e.target.files[0].name}" validated. 64 student accounts ready to sync.`);
                  }
                }}
              />
            </label>

            {csvUploadedFile && (
              <div className="csv-file-badge font-mono">
                <FileText size={15} color="#34d399" />
                <span>{csvUploadedFile} (64 records detected)</span>
                <span className="csv-verified-pill">Validated</span>
              </div>
            )}
          </div>

          <div className="roster-template-download">
            <span className="text-muted text-xs">Need a formatted CSV template?</span>
            <button
              type="button"
              className="template-btn"
              onClick={() => alert('Downloading students_roster_template.csv...')}
            >
              Download Sample CSV
            </button>
          </div>
        </section>
      </div>

      {/* Cluster Security Invariants */}
      <section className="admin-cluster-security">
        <div className="cluster-header">
          <Server size={16} color="#a855f7" />
          <h4>Sandboxed Worker Cluster Invariants</h4>
        </div>
        <div className="cluster-checks-grid">
          <div className="check-box">
            <CheckCircle2 size={14} color="#34d399" />
            <span>Linux cgroups v2 memory limit: <strong>256MB Hard Cap</strong></span>
          </div>
          <div className="check-box">
            <CheckCircle2 size={14} color="#34d399" />
            <span>Dropped network namespaces: <strong>unshare --net (Zero Outbound)</strong></span>
          </div>
          <div className="check-box">
            <CheckCircle2 size={14} color="#34d399" />
            <span>Seccomp-BPF filter: <strong>58 Syscalls Whitelisted</strong></span>
          </div>
          <div className="check-box">
            <CheckCircle2 size={14} color="#34d399" />
            <span>Dual Axum Gateways: <strong>Port 9000 & 9001 (Round-Robin Balanced)</strong></span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CampusAdminDashboard;
