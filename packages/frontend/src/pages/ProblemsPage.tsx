import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  CheckCircle2,
  CircleDot,
  Shuffle,
  ArrowUpDown,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { PROBLEMS } from '../constants/problems';
import { Problem, Difficulty } from '../types';
import { fetchProblems } from '../services/api';
import {
  getSolvedProblemIds,
  getAttemptedProblemIds,
  getProblemSolvedStatus,
  getAllTopics,
  filterProblems,
} from '../services/problemService';

type SortField = 'number' | 'title' | 'acceptance' | 'difficulty';
type SortOrder = 'asc' | 'desc';

export const ProblemsPage: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'All'>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All Topics');
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());

  // Catalog is server-authoritative; the bundled sample-only constants keep the page
  // usable for first paint and when the gateway is unreachable.
  const [catalog, setCatalog] = useState<Problem[]>(PROBLEMS);

  // Load solved and attempted status on mount
  useEffect(() => {
    setSolvedIds(getSolvedProblemIds());
    setAttemptedIds(getAttemptedProblemIds());
  }, []);

  // Hydrate the catalog from the gateway
  useEffect(() => {
    let cancelled = false;
    fetchProblems()
      .then((problems) => {
        if (!cancelled && problems.length > 0) {
          setCatalog(problems);
        }
      })
      .catch(() => {
        // Bundled sample-only fallback stays in place.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute all unique topic tags from catalog
  const topicList = useMemo(() => {
    return ['All Topics', ...getAllTopics(catalog)];
  }, [catalog]);

  // Filter problems based on search, difficulty, and tag
  const filteredProblems = useMemo(() => {
    const diffFilter = selectedDifficulty === 'All' ? null : selectedDifficulty;
    const tagFilter = selectedTag === 'All Topics' ? null : selectedTag;
    const matched = filterProblems(catalog, searchQuery, diffFilter, tagFilter);

    // Apply sorting
    return [...matched].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'number') {
        const numA = parseInt(a.title.split('.')[0], 10) || 0;
        const numB = parseInt(b.title.split('.')[0], 10) || 0;
        comparison = numA - numB;
      } else if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortField === 'acceptance') {
        comparison = a.acceptanceRate - b.acceptanceRate;
      } else if (sortField === 'difficulty') {
        const order: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
        comparison = order[a.difficulty] - order[b.difficulty];
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [catalog, searchQuery, selectedDifficulty, selectedTag, sortField, sortOrder]);

  // Solved statistics
  const totalCount = catalog.length;
  const solvedCount = useMemo(() => {
    return catalog.filter((p) => solvedIds.has(p.id)).length;
  }, [catalog, solvedIds]);
  const progressPct = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  // Toggle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Pick random problem
  const handlePickRandom = () => {
    const pool = filteredProblems.length > 0 ? filteredProblems : catalog;
    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex];
    if (chosen) {
      navigate(`/problems/${chosen.id}`);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDifficulty('All');
    setSelectedTag('All Topics');
  };

  return (
    <div className="problems-catalog-page">
      <div className="problems-container">
        {/* Top Header & Progress Summary */}
        <header className="catalog-header">
          <div className="catalog-title-group">
            <div className="catalog-title-row">
              <h1 className="catalog-title">Problem Catalog</h1>
              <span className="catalog-count-pill">{totalCount} problems</span>
            </div>
            <p className="catalog-subtitle">
              Hardened multi-language competitive programming sandbox. Filter by topic, difficulty, or keyword.
            </p>
          </div>

          <div className="catalog-stats-card">
            <div className="catalog-stats-meta">
              <span className="stats-label">Solved Progress</span>
              <span className="stats-metric">
                <strong>{solvedCount}</strong> / {totalCount} ({progressPct}%)
              </span>
            </div>
            <div className="catalog-progress-track">
              <div
                className="catalog-progress-fill"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </header>

        {/* Filter & Control Bar */}
        <section className="catalog-control-panel">
          <div className="catalog-search-row">
            <div className="catalog-search-wrapper">
              <Search className="search-icon-svg" size={16} />
              <input
                type="text"
                className="catalog-search-input"
                placeholder="Search problems by title, tag, or # (e.g. 'Two Sum', 'DP', '125')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="catalog-actions-group">
              {/* Difficulty Segmented Filter */}
              <div className="difficulty-segmented-group" role="group" aria-label="Filter by difficulty">
                {(['All', 'Easy', 'Medium', 'Hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    className={`difficulty-pill-btn ${selectedDifficulty === diff ? 'active' : ''} ${
                      diff !== 'All' ? `diff-${diff.toLowerCase()}` : ''
                    }`}
                    onClick={() => setSelectedDifficulty(diff)}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              {/* Pick Random Problem */}
              <button
                type="button"
                className="pick-random-btn"
                onClick={handlePickRandom}
                title="Open a random problem from current list"
              >
                <Shuffle size={14} />
                <span>Pick Random</span>
              </button>
            </div>
          </div>

          {/* Topic Taxonomy Chips Strip */}
          <div className="topic-chips-scroll" role="region" aria-label="Filter by algorithmic topic">
            {topicList.map((topic) => {
              const isSelected = selectedTag === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  className={`topic-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedTag(topic)}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </section>

        {/* Unified 100% Width CSS Grid Catalog */}
        <div className="catalog-table-wrapper" role="table" aria-label="Problems Catalog">
          {/* Header Row: 5 separate columns strictly matching row grid */}
          <div
            className="catalog-header-row problem-table-header"
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: '64px minmax(260px, 3.5fr) minmax(200px, 2.5fr) 120px 110px',
              gap: '16px',
              width: '100%',
              alignItems: 'center',
            }}
          >
            {/* Header Column 1: Status (own 64px column) */}
            <div
              className="catalog-col col-status"
              role="columnheader"
              style={{
                width: '64px',
                minWidth: '64px',
                maxWidth: '64px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <span>Status</span>
            </div>

            {/* Header Column 2: Title (own column matching row grid) */}
            <div
              className="catalog-col col-title"
              role="columnheader"
              style={{
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
              }}
              onClick={() => handleSort('title')}
            >
              <div className="th-sort-wrapper">
                <span>Title</span>
                <ArrowUpDown size={12} className="sort-icon-svg" />
              </div>
            </div>

            {/* Header Column 3: Topics */}
            <div
              className="catalog-col col-tags"
              role="columnheader"
              style={{ minWidth: 0 }}
            >
              <span>Topics</span>
            </div>

            {/* Header Column 4: Acceptance */}
            <div
              className="catalog-col col-acceptance"
              role="columnheader"
              style={{ width: '120px' }}
              onClick={() => handleSort('acceptance')}
            >
              <div className="th-sort-wrapper">
                <span>Acceptance</span>
                <ArrowUpDown size={12} className="sort-icon-svg" />
              </div>
            </div>

            {/* Header Column 5: Difficulty */}
            <div
              className="catalog-col col-difficulty"
              role="columnheader"
              style={{ width: '110px', display: 'flex', justifyContent: 'center' }}
              onClick={() => handleSort('difficulty')}
            >
              <div className="th-sort-wrapper">
                <span>Difficulty</span>
                <ArrowUpDown size={12} className="sort-icon-svg" />
              </div>
            </div>
          </div>

          <div className="catalog-body" role="rowgroup">
            {filteredProblems.length === 0 ? (
              <div className="catalog-empty-state">
                <Filter size={28} className="empty-state-icon" />
                <h3 className="empty-state-title">No problems match your criteria</h3>
                <p className="empty-state-desc">
                  Try adjusting your search query, difficulty pill, or topic filters.
                </p>
                <button
                  type="button"
                  className="empty-reset-btn"
                  onClick={handleResetFilters}
                >
                  <RotateCcw size={14} />
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              filteredProblems.map((problem) => {
                const status = getProblemSolvedStatus(problem.id, solvedIds, attemptedIds);
                const isSolved = status === 'solved';
                const isAttempted = status === 'attempted';

                return (
                  <div
                    key={problem.id}
                    className="catalog-row problem-table-row"
                    role="row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '64px minmax(260px, 3.5fr) minmax(200px, 2.5fr) 120px 110px',
                      gap: '16px',
                      width: '100%',
                      alignItems: 'center',
                    }}
                    onClick={() => navigate(`/problems/${problem.id}`)}
                  >
                    {/* Row Column 1: Status (own 64px column) */}
                    <div
                      className="catalog-col col-status"
                      role="cell"
                      style={{
                        width: '64px',
                        minWidth: '64px',
                        maxWidth: '64px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isSolved ? (
                        <span title="Solved" className="status-icon-solved">
                          <CheckCircle2 size={16} />
                        </span>
                      ) : isAttempted ? (
                        <span title="Attempted" className="status-icon-attempted">
                          <CircleDot size={16} />
                        </span>
                      ) : (
                        <span className="status-icon-unsolved">—</span>
                      )}
                    </div>

                    {/* Row Column 2: Title (own column matching header) */}
                    <div
                      className="catalog-col col-title"
                      role="cell"
                      style={{ minWidth: 0 }}
                    >
                      <Link
                        to={`/problems/${problem.id}`}
                        className="problem-title-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {problem.title}
                      </Link>
                    </div>

                    {/* Row Column 3: Topics (minmax(200px, 2.5fr), horizontal flex row) */}
                    <div
                      className="catalog-col col-tags"
                      role="cell"
                      style={{ minWidth: 0 }}
                    >
                      <div className="row-tags-wrapper">
                        {(problem.tags || []).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="catalog-tag-badge"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(tag);
                            }}
                            title={`Filter by ${tag}`}
                          >
                            {tag}
                          </span>
                        ))}
                        {(problem.tags || []).length > 3 && (
                          <span
                            className="catalog-tag-more"
                            title={(problem.tags || []).slice(3).join(', ')}
                          >
                            +{problem.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row Column 4: Acceptance (120px tabular-nums) */}
                    <div
                      className="catalog-col col-acceptance"
                      role="cell"
                      style={{ width: '120px' }}
                    >
                      <span className="acceptance-rate-mono">
                        {problem.acceptanceRate.toFixed(1)}%
                      </span>
                    </div>

                    {/* Row Column 5: Difficulty (110px, centered) */}
                    <div
                      className="catalog-col col-difficulty"
                      role="cell"
                      style={{ width: '110px', display: 'flex', justifyContent: 'center' }}
                    >
                      <span className={`catalog-diff-badge diff-${problem.difficulty.toLowerCase()}`}>
                        {problem.difficulty}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProblemsPage;
