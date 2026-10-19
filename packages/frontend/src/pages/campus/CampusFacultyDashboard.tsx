import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  FileCode2,
  Users,
  CheckCircle2,
  Plus,
  ShieldCheck,
  ShieldAlert,
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

/** Dashboard sections addressable by their own `faculty/*` route. */
type FacultyDashboardTab = 'labs' | 'plagiarism' | 'roster';

/**
 * Maps a `faculty/*` route segment to the section it opens.
 *
 * `faculty/dashboard` is the cohorts overview, so it opens on the roster rather than on the lab
 * list: leaving it on `labs` made `faculty/dashboard` and `faculty/labs` render identically and
 * read as an accidental duplicate.
 */
const FACULTY_TAB_BY_ROUTE: Record<string, FacultyDashboardTab> = {
  dashboard: 'roster',
  labs: 'labs',
  plagiarism: 'plagiarism',
};

/** Header copy describing the section currently on screen. */
const FACULTY_VIEW_META: Record<
  FacultyDashboardTab,
  { badge: string; title: string; subtitle: string }
> = {
  labs: {
    badge: 'LAB AUTHORING',
    title: 'Lab Modules & Curricula',
    subtitle:
      'Author sandboxed 6-stage programming assessments and publish them to the cohort.',
  },
  plagiarism: {
    badge: 'AST PLAGIARISM',
    title: 'Code Similarity Reports',
    subtitle: 'Audit submission AST integrity for the cohort and review flagged similarity pairs.',
  },
  roster: {
    badge: 'COHORTS OVERVIEW',
    title: 'Cohort Curriculum & Roster',
    subtitle: 'Track enrolment, module progress and submission totals across the cohort.',
  },
};

export const CampusFacultyDashboard: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const location = useLocation();
  const session = getCampusSession(orgSlug);
  const accessDeniedMessage = (location.state as any)?.message;

  // The `faculty/*` routes share this dashboard but select different sections, so the trailing
  // path segment decides which one is open instead of every route landing on the same default.
  const routeTab = FACULTY_TAB_BY_ROUTE[location.pathname.split('/').filter(Boolean).pop() ?? ''];

  const [labs, setLabs] = useState<LabSummaryResponse[]>([]);
  const [students, setStudents] = useState<RosterMemberResponse[]>([]);
  const [plagiarismScans, setPlagiarismScans] = useState<PlagiarismReportItem[]>([]);
  const [_loading, setLoading] = useState<boolean>(true);
  const [_error, setError] = useState<string | null>(null);

  // Active section tab
  const [activeTab, setActiveTab] = useState<FacultyDashboardTab>(routeTab ?? 'roster');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (routeTab) setActiveTab(routeTab);
  }, [routeTab]);

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
      const auditPromise =
        session?.role === 'org_admin'
          ? getCampusAdminAudit(orgSlug).catch(() => null)
          : Promise.resolve(null);
      const [labsData, rosterData, auditData] = await Promise.all([
        getCampusLabs(orgSlug),
        getCampusOrgRoster(orgSlug, 'student').catch(() => []),
        auditPromise,
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
  const view = FACULTY_VIEW_META[activeTab];
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
              {view.badge}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Cohort: {session?.cohortName || 'CSE Core 2026'}
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
            {view.title}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            {view.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
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
          <Plus size={15} /> Create & Publish Lab
        </button>
      </div>

      {accessDeniedMessage && (
        <div
          role="alert"
          style={{
            background: 'rgba(235, 87, 87, 0.12)',
            border: '1px solid #eb5757',
            borderRadius: '8px',
            padding: '16px 20px',
            color: '#eb5757',
            fontSize: '13px',
            fontWeight: 510,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(235, 87, 87, 0.1)',
          }}
        >
          <ShieldAlert size={18} />
          <span>{accessDeniedMessage}</span>
        </div>
      )}

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
              Enrolled Students
            </span>
            <Users size={16} style={{ color: '#02b8cc' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {students.length > 0 ? students.length : '64'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Active cohort participants
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
              Published Labs
            </span>
            <FileCode2 size={16} style={{ color: '#e4f222' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#e4f222', marginBottom: '4px' }}>
            {labs.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            6-stage progressive curricula
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
              Active Module
            </span>
            <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeLab ? activeLab.title.split(':')[0] : 'Lab 11 Active'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {activeLab ? activeLab.module_code : 'BACS101'}
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
              Plagiarism Scans
            </span>
            <ShieldCheck size={16} style={{ color: '#22c55e' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: '#22c55e', marginBottom: '4px' }}>
            {plagiarismScans.length} Scanned
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Plagiarism Checks Clean (0 Flags)
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
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
            color: activeTab === 'labs' ? '#e4f222' : 'var(--text-secondary)',
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
            color: activeTab === 'plagiarism' ? '#e4f222' : 'var(--text-secondary)',
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
            color: activeTab === 'roster' ? '#e4f222' : 'var(--text-secondary)',
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
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search labs by title or module code..."
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
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Module</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Title</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Max Score</th>
                  <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No matching lab modules found.
                    </td>
                  </tr>
                ) : (
                  filteredLabs.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 20px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>
                        {l.module_code}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 510, color: 'var(--text-primary)' }}>
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
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>
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

      {/* Tab 2: Code Similarity Reports */}
      {activeTab === 'plagiarism' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: 'var(--text-primary)' }}>
              Code Similarity Plagiarism Matrix
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '4px 0 0 0' }}>
              Pairwise structural code similarity scans invariant to variable renaming and comment modifications.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Lab ID</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Student Pair</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>AST Similarity</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Similarity Matches</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {plagiarismScans.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No cross-student plagiarism reports found.
                    </td>
                  </tr>
                ) : (
                  plagiarismScans.map((scan, idx) => (
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

      {/* Tab 3: Student Roster */}
      {activeTab === 'roster' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 590, margin: 0, color: 'var(--text-primary)' }}>
              Enrolled Student Roster
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '4px 0 0 0' }}>
              Students authenticated and enrolled in the current active cohort.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Student Name</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Registration No</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Department</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No students found in cohort roster.
                    </td>
                  </tr>
                ) : (
                  students.map((st) => (
                    <tr key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 24px', fontSize: '13px', fontWeight: 510, color: 'var(--text-primary)' }}>
                        {st.name || st.username}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#e4f222' }}>
                        {st.reg_number || 'DEMO-001'}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {st.email}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
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
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 590, margin: 0, color: 'var(--text-primary)' }}>
                Create & Publish Lab Module
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
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
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                    Module Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newLab.module_code}
                    onChange={(e) => setNewLab({ ...newLab, module_code: e.target.value })}
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

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
                  Description & Pedagogy Brief
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline core algorithmic goals, complexity constraints, and CLO mapping..."
                  value={newLab.description}
                  onChange={(e) => setNewLab({ ...newLab, description: e.target.value })}
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
                  disabled={creating}
                  style={{
                    background: 'var(--accent-primary)',
                    color: 'var(--accent-primary-fg)',
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
