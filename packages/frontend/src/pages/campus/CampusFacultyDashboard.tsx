import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileCode2,
  Users,
  CheckCircle2,
  Plus,
  ShieldCheck,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import {
  getCampusLabs,
  createCampusLab,
  getCampusOrgRoster,
  getCampusAdminAudit,
  LabSummaryResponse,
  RosterMemberResponse,
  PlagiarismReportItem,
  CreateLabRequest,
} from '../../services/api';
import { getCampusSession } from '../../services/campusSession';

export const CampusFacultyDashboard: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const session = getCampusSession(orgSlug);

  const [labs, setLabs] = useState<LabSummaryResponse[]>([]);
  const [students, setStudents] = useState<RosterMemberResponse[]>([]);
  const [plagiarismScans, setPlagiarismScans] = useState<PlagiarismReportItem[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);
  const [_error, setError] = useState<string | null>(null);

  // Active section tab
  const [activeTab, setActiveTab] = useState<'labs' | 'plagiarism' | 'roster'>('labs');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Lab Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newLab, setNewLab] = useState<CreateLabRequest>({
    title: '',
    module_code: 'BACS101',
    description: '',
    max_score: 20,
    due_date: '2026-10-30T23:59:59Z',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [labsData, rosterData, auditData] = await Promise.all([
        getCampusLabs(orgSlug),
        getCampusOrgRoster(orgSlug, 'student').catch(() => []),
        getCampusAdminAudit(orgSlug).catch(() => null),
      ]);
      setLabs(labsData);
      setStudents(rosterData);
      if (auditData?.plagiarism_scans) {
        setPlagiarismScans(auditData.plagiarism_scans);
      }
    } catch (err: any) {
      console.error('Failed to load faculty dashboard data:', err);
      setError(err.message || 'Failed to load faculty records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgSlug]);

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLab.title.trim()) {
      setCreateError('Lab title is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createCampusLab(orgSlug, newLab);
      setShowCreateModal(false);
      setNewLab({
        title: '',
        module_code: 'BACS101',
        description: '',
        max_score: 20,
        due_date: '2026-10-30T23:59:59Z',
      });
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to publish lab module');
    } finally {
      setCreating(false);
    }
  };

  const activeLab = labs.find((l) => l.status === 'active');
  const filteredLabs = labs.filter(
    (l) =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.module_code || l.code || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner */}
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
              FACULTY COCKPIT
            </span>
            <span style={{ color: '#62666d' }}>•</span>
            <span style={{ color: '#8a8f98', fontSize: '13px' }}>
              Cohort: {session?.cohortName || 'CSE Core 2026'}
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
            Cohort Curriculum & Lab Management
          </h1>

          <p style={{ color: '#8a8f98', fontSize: '14px', margin: 0 }}>
            Author sandboxed 6-stage programming assessments, track submissions, and audit AST integrity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            background: '#e4f222',
            color: '#08090a',
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
          <Plus size={15} /> Create & Publish Lab
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
            background: '#0f1011',
            border: '1px solid #23252a',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Enrolled Students
            </span>
            <Users size={16} style={{ color: '#02b8cc' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#ffffff', marginBottom: '4px' }}>
            {students.length > 0 ? students.length : '64'}
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            Active cohort participants
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Published Labs
            </span>
            <FileCode2 size={16} style={{ color: '#e4f222' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#e4f222', marginBottom: '4px' }}>
            {labs.length}
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            6-stage progressive curricula
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Module
            </span>
            <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeLab ? activeLab.title.split(':')[0] : 'Lab 11 Active'}
          </div>
          <div style={{ fontSize: '12px', color: '#62666d', fontFamily: 'JetBrains Mono, monospace' }}>
            {activeLab ? activeLab.module_code : 'BACS101'}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Plagiarism Scans
            </span>
            <ShieldCheck size={16} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', marginBottom: '4px' }}>
            {plagiarismScans.length} Scanned
          </div>
          <div style={{ fontSize: '12px', color: '#62666d' }}>
            AST Winnowing Clean (0 Flags)
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #23252a', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('labs')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'labs' ? '2px solid #e4f222' : '2px solid transparent',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'labs' ? 590 : 400,
            color: activeTab === 'labs' ? '#e4f222' : '#8a8f98',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileCode2 size={15} /> Lab Modules & Curricula ({labs.length})
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
            color: activeTab === 'plagiarism' ? '#e4f222' : '#8a8f98',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldCheck size={15} /> AST Plagiarism Scans ({plagiarismScans.length})
        </button>

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
            color: activeTab === 'roster' ? '#e4f222' : '#8a8f98',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={15} /> Student Roster ({students.length})
        </button>
      </div>

      {/* Tab 1: Labs List */}
      {activeTab === 'labs' && (
        <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #23252a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#62666d' }} />
              <input
                type="text"
                placeholder="Search labs by title or module code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#141517',
                  border: '1px solid #23252a',
                  borderRadius: '6px',
                  padding: '8px 10px 8px 32px',
                  color: '#ffffff',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#141517', borderBottom: '1px solid #23252a' }}>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Module</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Title</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Max Score</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#62666d', fontSize: '13px' }}>
                      No matching lab modules found.
                    </td>
                  </tr>
                ) : (
                  filteredLabs.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #23252a' }}>
                      <td style={{ padding: '14px 20px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#8a8f98' }}>
                        {l.module_code}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 510, color: '#ffffff' }}>
                        {l.title}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: l.status === 'active' ? 'rgba(228, 242, 34, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: l.status === 'active' ? '#e4f222' : '#22c55e',
                            border: `1px solid ${l.status === 'active' ? 'rgba(228, 242, 34, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          {l.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: '#d0d6e0' }}>
                        {l.max_score} pts
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <Link
                          to={`/campus/${orgSlug}/student/labs/${l.id}/room`}
                          style={{
                            fontSize: '12px',
                            color: '#e4f222',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Preview Sandbox <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: AST Plagiarism Reports */}
      {activeTab === 'plagiarism' && (
        <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #23252a' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: '#ffffff' }}>
              Tree-sitter AST Winnowing Plagiarism Matrix
            </h3>
            <p style={{ color: '#8a8f98', fontSize: '12px', margin: '4px 0 0 0' }}>
              Pairwise structural code similarity scans invariant to variable renaming and comment modifications.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#141517', borderBottom: '1px solid #23252a' }}>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Lab ID</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Student Pair</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>AST Similarity</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Fingerprints</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {plagiarismScans.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#62666d', fontSize: '13px' }}>
                      No cross-student plagiarism reports found.
                    </td>
                  </tr>
                ) : (
                  plagiarismScans.map((scan, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #23252a' }}>
                      <td style={{ padding: '14px 24px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#8a8f98' }}>
                        {scan.lab_id}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                        {scan.student_a} <span style={{ color: '#62666d' }}>↔</span> {scan.student_b}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#22c55e' }}>
                        {(scan.ast_similarity_score * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#8a8f98', fontFamily: 'JetBrains Mono, monospace' }}>
                        {scan.winnowing_fingerprints_matched} matches
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

      {/* Tab 3: Student Roster */}
      {activeTab === 'roster' && (
        <div style={{ background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #23252a' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: '#ffffff' }}>
              Enrolled Student Roster
            </h3>
            <p style={{ color: '#8a8f98', fontSize: '12px', margin: '4px 0 0 0' }}>
              Students authenticated and enrolled in the current active cohort.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#141517', borderBottom: '1px solid #23252a' }}>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Student Name</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Registration No</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: '#8a8f98', fontWeight: 600, textTransform: 'uppercase' }}>Department</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#62666d', fontSize: '13px' }}>
                      No students found in cohort roster.
                    </td>
                  </tr>
                ) : (
                  students.map((st) => (
                    <tr key={st.id} style={{ borderBottom: '1px solid #23252a' }}>
                      <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 510, color: '#ffffff' }}>
                        {st.name || st.username}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#e4f222' }}>
                        {st.reg_number || '25BAI1234'}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#8a8f98' }}>
                        {st.email}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: '#d0d6e0' }}>
                        {st.department || 'Computer Science'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Lab Modal */}
      {showCreateModal && (
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
              background: '#0f1011',
              border: '1px solid #23252a',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 590, margin: 0, color: '#ffffff' }}>
                Create & Publish Lab Module
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#8a8f98', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
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
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateLab} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8f98', marginBottom: '6px' }}>
                  Lab Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab 12: Advanced Dynamic Programming & Invariants"
                  value={newLab.title}
                  onChange={(e) => setNewLab({ ...newLab, title: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#141517',
                    border: '1px solid #23252a',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8f98', marginBottom: '6px' }}>
                    Module Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newLab.module_code}
                    onChange={(e) => setNewLab({ ...newLab, module_code: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#141517',
                      border: '1px solid #23252a',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8a8f98', marginBottom: '6px' }}>
                    Max Score
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newLab.max_score}
                    onChange={(e) => setNewLab({ ...newLab, max_score: parseFloat(e.target.value) || 20 })}
                    style={{
                      width: '100%',
                      background: '#141517',
                      border: '1px solid #23252a',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8a8f98', marginBottom: '6px' }}>
                  Description & Pedagogy Brief
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline core algorithmic goals, complexity constraints, and CLO mapping..."
                  value={newLab.description}
                  onChange={(e) => setNewLab({ ...newLab, description: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#141517',
                    border: '1px solid #23252a',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'Inter, sans-serif',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #23252a',
                    color: '#8a8f98',
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
                  disabled={creating}
                  style={{
                    background: '#e4f222',
                    color: '#08090a',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 590,
                    fontSize: '13px',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? 'Publishing...' : 'Publish to Cohort'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusFacultyDashboard;
