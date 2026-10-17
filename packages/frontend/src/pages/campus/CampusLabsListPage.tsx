import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  Clock,
  Calendar,
  ArrowRight,
  Search,
  Award,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { getCampusLabs, LabSummaryResponse } from '../../services/api';
import { getCampusSession } from '../../services/campusSession';

export const CampusLabsListPage: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const location = useLocation();
  const session = getCampusSession(orgSlug);

  const [labs, setLabs] = useState<LabSummaryResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'evaluated'>(
    location.pathname.includes('completed') ? 'evaluated' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (location.pathname.includes('completed')) {
      setFilterTab('evaluated');
    }
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;
    async function fetchLabs() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCampusLabs(orgSlug, session?.loginId);
        if (isMounted) setLabs(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to fetch labs');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchLabs();
    return () => {
      isMounted = false;
    };
  }, [orgSlug, session?.loginId]);

  const filteredLabs = labs.filter((lab) => {
    const isEvaluated = lab.student_status === 'Evaluated' || lab.status === 'evaluated';
    if (filterTab === 'active' && isEvaluated) return false;
    if (filterTab === 'evaluated' && !isEvaluated) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        lab.title.toLowerCase().includes(q) ||
        lab.code.toLowerCase().includes(q) ||
        lab.clo.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Academic Course Labs
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 510, color: '#ffffff', letterSpacing: '-0.022em' }}>
            Laboratory Assessments & Continuous Evaluation
          </h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: '#8a8f98' }}>
            6-stage progressive evaluation sandbox with section-locked code and ABET CLO attainment
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '6px',
              background: '#0f1011',
              border: '1px solid #23252a',
              fontSize: '13px',
              color: '#d0d6e0',
            }}
          >
            <BookOpen size={14} color="#8a8f98" />
            <span>BACS101 · Problem Solving Using Java</span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(235, 87, 87, 0.1)', border: '1px solid #eb5757', borderRadius: '8px', padding: '14px 18px', color: '#eb5757', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: '#0f1011',
          border: '1px solid #23252a',
          borderRadius: '8px',
          padding: '8px 12px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'active', 'evaluated'] as const).map((tab) => {
            const isActive = filterTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: isActive ? '#141517' : 'transparent',
                  color: isActive ? '#ffffff' : '#8a8f98',
                  transition: 'all 120ms ease',
                }}
              >
                {tab === 'all' ? 'All Labs' : tab === 'active' ? 'Active' : 'Evaluated'}
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', minWidth: '260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#62666d' }} />
          <input
            type="text"
            placeholder="Search by topic, code, or CLO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '6px',
              background: '#141517',
              border: '1px solid #23252a',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Lab List Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#8a8f98', fontSize: '14px' }}>
          Loading institutional curriculum...
        </div>
      ) : filteredLabs.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#8a8f98', fontSize: '14px', background: '#0f1011', border: '1px solid #23252a', borderRadius: '12px' }}>
          No laboratory assessments match your search criteria.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredLabs.map((lab) => {
            const isEvaluated = lab.student_status === 'Evaluated' || lab.status === 'evaluated';
            return (
              <div
                key={lab.id}
                style={{
                  background: '#0f1011',
                  border: '1px solid #23252a',
                  borderRadius: '12px',
                  padding: '24px 28px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '20px',
                  transition: 'border-color 150ms ease',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '750px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(228, 242, 34, 0.12)',
                        color: '#e4f222',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {lab.code}
                    </span>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: '#818cf8',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {lab.clo}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: isEvaluated ? 'rgba(34, 197, 94, 0.1)' : 'rgba(228, 242, 34, 0.1)',
                        color: isEvaluated ? '#22c55e' : '#e4f222',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isEvaluated ? '#22c55e' : '#e4f222' }} />
                      {isEvaluated ? 'Evaluated' : 'Active'}
                    </span>
                  </div>

                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 510, color: '#ffffff', letterSpacing: '-0.015em' }}>
                    {lab.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8a8f98', lineHeight: '1.5' }}>
                    {lab.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '4px', fontSize: '12px', color: '#62666d' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} />
                      {lab.duration_minutes} minutes
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} />
                      Due {lab.deadline}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Award size={13} />
                      {isEvaluated ? `Score: ${lab.student_marks ?? 19.5} / ${lab.max_marks}` : `Max Marks: ${lab.max_marks}`}
                    </span>
                  </div>
                </div>

                <div>
                  {isEvaluated ? (
                    <Link
                      to={`/campus/${orgSlug}/student/labs/${lab.id}/review`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        borderRadius: '6px',
                        background: '#141517',
                        border: '1px solid #23252a',
                        color: '#d0d6e0',
                        fontSize: '13px',
                        fontWeight: 500,
                        textDecoration: 'none',
                        letterSpacing: '-0.011em',
                      }}
                    >
                      <span>Review Rubric & Feedback</span>
                      <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <Link
                      to={`/campus/${orgSlug}/student/labs/${lab.id}/room`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        borderRadius: '6px',
                        background: '#e4f222',
                        color: '#08090a',
                        fontSize: '13px',
                        fontWeight: 510,
                        textDecoration: 'none',
                        letterSpacing: '-0.011em',
                      }}
                    >
                      <span>Enter Lab Room</span>
                      <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CampusLabsListPage;
