import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Cpu,
  Activity,
  Plus,
  Lock,
  Search,
  X,
} from 'lucide-react';
import {
  getCampusOrgRoster,
  addCampusOrgRosterMember,
  getCampusAdminAudit,
  RosterMemberResponse,
  CampusAdminAuditResponse,
  AddRosterMemberRequest,
} from '../../services/api';
import { getCampusSession } from '../../services/campusSession';

export const CampusAdminDashboard: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const session = getCampusSession(orgSlug);

  const [roster, setRoster] = useState<RosterMemberResponse[]>([]);
  const [audit, setAudit] = useState<CampusAdminAuditResponse | null>(null);
  const [_loading, setLoading] = useState<boolean>(true);
  const [_error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'roster' | 'security' | 'plagiarism'>('roster');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [newMember, setNewMember] = useState<AddRosterMemberRequest>({
    name: '',
    email: '',
    role: 'student',
    reg_number: '',
    department: 'Computer Science & Engineering',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rosterData, auditData] = await Promise.all([
        getCampusOrgRoster(orgSlug),
        getCampusAdminAudit(orgSlug),
      ]);
      setRoster(rosterData);
      setAudit(auditData);
    } catch (err: any) {
      console.error('Failed to load campus admin data:', err);
      setError(err.message || 'Failed to load administrative records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgSlug]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.email) {
      setAddError('Name and email are required');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await addCampusOrgRosterMember(orgSlug, newMember);
      setShowAddModal(false);
      setNewMember({
        name: '',
        email: '',
        role: 'student',
        reg_number: '',
        department: 'Computer Science & Engineering',
      });
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add member to roster');
    } finally {
      setAdding(false);
    }
  };

  const filteredRoster = roster.filter((m) => {
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const q = searchQuery.toLowerCase();
    const nameMatch = (m.name ? m.name.toLowerCase() : (m.username ? m.username.toLowerCase() : '')).includes(q);
    const emailMatch = (m.email ? m.email.toLowerCase() : '').includes(q);
    const regMatch = (m.reg_number ? m.reg_number.toLowerCase() : '').includes(q);
    return matchesRole && (nameMatch || emailMatch || regMatch);
  });

  const orgName = session?.orgName || orgSlug.toUpperCase().replace('-', ' ');

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)',
          border: '1px solid var(--border-subtle)',
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
              TENANT ADMINISTRATION
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Tier: Enterprise Multi-Tenant
            </span>
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: 590,
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            {orgName} Administrative Center
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Manage institutional roster access, monitor execution security boundaries, and inspect code similarity logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--accent-primary-fg)',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '6px',
            fontWeight: 590,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={15} /> Add Roster Member
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Institutional Roster
            </span>
            <Users size={16} style={{ color: '#02b8cc' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {roster.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Enrolled students & faculty
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Evaluations
            </span>
            <Cpu size={16} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', marginBottom: '4px' }}>
            {audit ? audit.active_sandboxes_count : 1}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            No environment startup delay
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Executions (24h)
            </span>
            <Activity size={16} style={{ color: '#e4f222' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#e4f222', marginBottom: '4px' }}>
            {audit ? audit.sandbox_executions_last_24h : 142}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Evaluated in an isolated environment
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Security Hardening
            </span>
            <ShieldCheck size={16} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', marginBottom: '4px' }}>
            Dedicated Compute Allocation
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Protected runtime boundaries & isolated execution
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'roster' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'roster' ? 590 : 400,
            color: activeTab === 'roster' ? '#e4f222' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={15} /> Member Roster & IAM ({roster.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'security' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'security' ? 590 : 400,
            color: activeTab === 'security' ? '#e4f222' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldCheck size={15} /> Evaluation Safety Audit ({audit?.security_audit_events.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plagiarism')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'plagiarism' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'plagiarism' ? 590 : 400,
            color: activeTab === 'plagiarism' ? '#e4f222' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Lock size={15} /> AST Plagiarism Scans ({audit?.plagiarism_scans.length || 0})
        </button>
      </div>

      {/* Tab 1: Member Roster */}
      {activeTab === 'roster' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name, email, or reg no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px 8px 32px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'student', 'faculty', 'org_admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  style={{
                    background: roleFilter === r ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: roleFilter === r ? '#e4f222' : 'var(--text-secondary)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {r === 'all' ? 'All Roles' : r === 'org_admin' ? 'Admin' : r}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Member</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Identifier / Reg</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Department</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No roster members found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 510, color: 'var(--text-primary)' }}>{m.name || m.username}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.email}</div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#e4f222' }}>
                        {m.reg_number || '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background:
                              m.role === 'org_admin'
                                ? 'rgba(228, 242, 34, 0.1)'
                                : m.role === 'faculty'
                                ? 'rgba(2, 184, 204, 0.1)'
                                : 'rgba(34, 197, 94, 0.1)',
                            color:
                              m.role === 'org_admin'
                                ? '#e4f222'
                                : m.role === 'faculty'
                                ? '#02b8cc'
                                : '#22c55e',
                            border: `1px solid ${
                              m.role === 'org_admin'
                                ? 'rgba(228, 242, 34, 0.25)'
                                : m.role === 'faculty'
                                ? 'rgba(2, 184, 204, 0.25)'
                                : 'rgba(34, 197, 94, 0.25)'
                            }`,
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {m.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {m.department || 'Computer Science'}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Evaluation Safety Audit */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Resource Limits
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#22c55e', fontFamily: 'JetBrains Mono, monospace', marginBottom: '8px' }}>
                Safe execution boundaries active
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Submissions evaluate in isolated environments with strict execution boundaries and automated memory protection.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Runtime Protection
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#02b8cc', fontFamily: 'JetBrains Mono, monospace', marginBottom: '8px' }}>
                {audit?.seccomp_status || 'Runtime protection active'}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Submission runtimes cannot open network sockets, spawn unbounded processes, or read files outside their working directory.
              </p>
            </div>
          </div>

          {/* Audit Events Log */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: 'var(--text-primary)' }}>
                Execution Safety Telemetry & Security Audit
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '4px 0 0 0' }}>
                Safety events recorded automatically during evaluation runs.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Timestamp</th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Event</th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Container ID</th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Action</th>
                    <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {!audit || audit.security_audit_events.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No audit events recorded in current cycle.
                      </td>
                    </tr>
                  ) : (
                    audit.security_audit_events.map((evt) => (
                      <tr key={evt.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 510, color: 'var(--text-primary)' }}>
                          {evt.event}
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>
                          {evt.container_id}
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {evt.action}
                        </td>
                        <td style={{ padding: '14px 24px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background:
                                evt.severity === 'info'
                                  ? 'rgba(34, 197, 94, 0.1)'
                                  : 'rgba(235, 87, 87, 0.1)',
                              color: evt.severity === 'info' ? '#22c55e' : '#eb5757',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          >
                            {evt.severity.toUpperCase()}
                          </span>
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

      {/* Tab 3: Plagiarism Scans */}
      {activeTab === 'plagiarism' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: 'var(--text-primary)' }}>
              Code Similarity & Plagiarism Reports
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '4px 0 0 0' }}>
              Structural similarity scans across all submitted lab solutions.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Lab ID</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Comparison Pair</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Similarity</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Similarity Matches</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Integrity Verdict</th>
                </tr>
              </thead>
              <tbody>
                {!audit || audit.plagiarism_scans.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No plagiarism records found.
                    </td>
                  </tr>
                ) : (
                  audit.plagiarism_scans.map((scan, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 24px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>
                        {scan.lab_id}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {scan.student_a} <span style={{ color: 'var(--text-muted)' }}>↔</span> {scan.student_b}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#22c55e' }}>
                        {(scan.ast_similarity_score * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {scan.similarity_matches} similarity matches
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
                          {scan.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 590, margin: 0, color: 'var(--text-primary)' }}>
                Add Institutional Roster Member
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {addError && (
              <div
                style={{
                  background: 'rgba(235, 87, 87, 0.1)',
                  border: '1px solid #eb5757',
                  borderRadius: '6px',
                  padding: '10px',
                  color: '#eb5757',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priyanshu Roy"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  placeholder={`e.g. name@${orgSlug}.ac.in`}
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Role
                  </label>
                  <select
                    value={newMember.role}
                    onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="org_admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Registration / Faculty No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 25BCE1699"
                    value={newMember.reg_number || ''}
                    onChange={(e) => setNewMember({ ...newMember, reg_number: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Department
                </label>
                <input
                  type="text"
                  value={newMember.department || ''}
                  onChange={(e) => setNewMember({ ...newMember, department: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  style={{
                    background: 'var(--accent-primary)',
                    color: 'var(--accent-primary-fg)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 590,
                    fontSize: '13px',
                    cursor: adding ? 'not-allowed' : 'pointer',
                    opacity: adding ? 0.7 : 1,
                  }}
                >
                  {adding ? 'Adding...' : 'Add to Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusAdminDashboard;
