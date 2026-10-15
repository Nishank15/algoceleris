import React, { useState, useMemo } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FlaskConical,
  CheckCircle2,
  Clock,
  Calendar,
  Filter,
  Search,
  ArrowRight,
  Code2,
  ExternalLink,
  ChevronRight,
  FileCode2,
  Award,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface LabItem {
  id: string;
  slug: string;
  title: string;
  course: string;
  cohort: string;
  faculty: string;
  semester: string;
  startDate: string;
  endDate: string;
  submittedDate?: string;
  score?: string;
  maxScore?: string;
  percentage?: string;
  status: 'ACTIVE' | 'EVALUATED' | 'PENDING_EVALUATION';
  questionsCount?: string;
  isTest?: boolean;
}

const MOCK_ACTIVE_LABS: LabItem[] = [
  {
    id: 'lab-active-01',
    slug: 'pps-11-multi-threading',
    title: 'PPS_11_Multi_Threading',
    course: 'Problem Solving Using Java (BACS101)',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Oct 12, 2026 · 09:00 AM',
    endDate: 'Oct 19, 2026 · 11:59 PM',
    status: 'ACTIVE',
  },
];

const MOCK_COMPLETED_LABS: LabItem[] = [
  {
    id: 'lab-comp-01',
    slug: 'week-12-generics',
    title: 'Week 12_Generics',
    course: 'Problem Solving Using Java (BACS101)',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Oct 06, 2026 · 09:00 AM',
    endDate: 'Oct 13, 2026 · 11:59 PM',
    submittedDate: 'Oct 12, 2026 · 10:14 PM',
    score: '20',
    maxScore: '20',
    percentage: '100%',
    status: 'EVALUATED',
  },
  {
    id: 'lab-comp-02',
    slug: 'week-11-multithreading',
    title: 'Week 11_Multithreading',
    course: 'Problem Solving Using Java (BACS101)',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Sep 29, 2026 · 09:00 AM',
    endDate: 'Oct 06, 2026 · 11:59 PM',
    submittedDate: 'Oct 05, 2026 · 08:30 PM',
    score: '20',
    maxScore: '20',
    percentage: '100%',
    status: 'EVALUATED',
  },
  {
    id: 'lab-comp-03',
    slug: 'week-10-pps',
    title: 'Week 10_PPS',
    course: 'Problem Solving Using Java (BACS101)',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Sep 22, 2026 · 09:00 AM',
    endDate: 'Sep 29, 2026 · 11:59 PM',
    submittedDate: 'Sep 28, 2026 · 09:45 PM',
    score: '18.5',
    maxScore: '18.5',
    percentage: '100%',
    status: 'EVALUATED',
  },
  {
    id: 'lab-comp-04',
    slug: 'week-10-pps-serialization',
    title: 'Week 10_PPS_Serialization',
    course: 'Problem Solving Using Java (BACS101)',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Sep 15, 2026 · 09:00 AM',
    endDate: 'Sep 22, 2026 · 11:59 PM',
    submittedDate: 'Sep 21, 2026 · 11:10 PM',
    score: '20',
    maxScore: '20',
    percentage: '100%',
    status: 'EVALUATED',
  },
];

const MOCK_ACTIVE_TESTS: LabItem[] = [
  {
    id: 'test-act-01',
    slug: 'java-fat-mock-2026',
    title: 'Java 2026 FAT Lab Exam (Mock)',
    course: 'Problem Solving Using Java (BACS101)',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Oct 15, 2026 · 02:00 PM',
    endDate: 'Oct 15, 2026 · 05:00 PM',
    status: 'ACTIVE',
    questionsCount: '2 questions',
    isTest: true,
  },
];

const MOCK_COMPLETED_TESTS: LabItem[] = [
  {
    id: 'test-comp-01',
    slug: 'java-pat2-131026',
    title: 'Java 25 27_L910_PAT2_131026',
    course: 'Problem Solving Using Java',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Oct 13, 2026 · 10:00 AM',
    endDate: 'Oct 13, 2026 · 11:40 AM',
    submittedDate: 'Oct 13, 2026 · 11:35 AM',
    score: '24.5',
    maxScore: '30',
    percentage: '81.67%',
    status: 'EVALUATED',
    questionsCount: '1 / 1 answered',
    isTest: true,
  },
  {
    id: 'test-comp-02',
    slug: 'java-pat3-101026',
    title: 'Java 25 27_L52_PAT3_101026',
    course: 'Problem Solving Using Java',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Oct 10, 2026 · 02:00 PM',
    endDate: 'Oct 10, 2026 · 03:40 PM',
    submittedDate: 'Oct 10, 2026 · 03:32 PM',
    score: '28',
    maxScore: '30',
    percentage: '93.33%',
    status: 'EVALUATED',
    questionsCount: '1 / 1 answered',
    isTest: true,
  },
  {
    id: 'test-comp-03',
    slug: 'java-fall26-pat2',
    title: 'Java Fall 26 27_PAT2_L9 L10',
    course: 'Problem Solving Using Java',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Oct 04, 2026 · 09:00 AM',
    endDate: 'Oct 04, 2026 · 10:40 AM',
    submittedDate: 'Oct 04, 2026 · 10:38 AM',
    score: 'Pending',
    maxScore: '30',
    percentage: 'Reviewing',
    status: 'PENDING_EVALUATION',
    questionsCount: '1 / 1 answered',
    isTest: true,
  },
  {
    id: 'test-comp-04',
    slug: 'mock-pat',
    title: 'Mock Pat',
    course: 'Problem Solving Using Java',
    cohort: 'BACS101 - CH2025260101659',
    faculty: 'Dr. SARAVANAN P',
    semester: 'Fall Semester 2025-26',
    startDate: 'Sep 25, 2026 · 10:00 AM',
    endDate: 'Sep 25, 2026 · 12:00 PM',
    submittedDate: 'Sep 25, 2026 · 11:50 AM',
    score: '30',
    maxScore: '30',
    percentage: '100%',
    status: 'EVALUATED',
    questionsCount: '2 / 2 answered',
    isTest: true,
  },
];

export const CampusLabsListPage: React.FC = () => {
  const { orgSlug: paramSlug } = useParams<{ orgSlug?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine which list variant is active from pathname
  const isCompletedLabs = location.pathname.includes('/labs/completed');
  const isActiveLabs = location.pathname.endsWith('/labs') || location.pathname.endsWith('/labs/');
  const isCompletedTests = location.pathname.includes('/tests/completed');
  const isActiveTests = location.pathname.endsWith('/tests') || location.pathname.endsWith('/tests/');

  // 5-Filter Bar states
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  // Filter logic for completed labs
  const filteredCompletedLabs = useMemo(() => {
    return MOCK_COMPLETED_LABS.filter((item) => {
      if (selectedFaculty !== 'all' && item.faculty !== selectedFaculty) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [selectedFaculty, selectedStatus, searchQuery]);

  // Filter logic for completed tests
  const filteredCompletedTests = useMemo(() => {
    return MOCK_COMPLETED_TESTS.filter((item) => {
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [selectedStatus, searchQuery]);

  return (
    <div className="campus-labs-list-page">
      {/* Page Title & View Switcher */}
      <div className="campus-labs-header">
        <div>
          <h1 className="labs-page-title">
            {isActiveLabs && 'Active Lab Exercises'}
            {isCompletedLabs && 'Completed Lab Exercises'}
            {isActiveTests && 'Lab Tests (PAT)'}
            {isCompletedTests && 'Completed Lab Tests (PAT)'}
          </h1>
          <p className="labs-page-sub">
            {isActiveLabs && 'Open progressive lab assignments currently scheduled for evaluation.'}
            {isCompletedLabs && 'Reviewed submissions with itemized public and private test case results.'}
            {isActiveTests && 'Proctored practical assessment tests and scheduled examinations.'}
            {isCompletedTests && 'Historical evaluation reports and test scores for PAT sessions.'}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="labs-view-tabs">
          <Link
            to={`/campus/${orgSlug}/student/labs`}
            className={`view-tab ${isActiveLabs ? 'active' : ''}`}
          >
            Active Labs
          </Link>
          <Link
            to={`/campus/${orgSlug}/student/labs/completed`}
            className={`view-tab ${isCompletedLabs ? 'active' : ''}`}
          >
            Completed Labs
          </Link>
          <Link
            to={`/campus/${orgSlug}/student/tests`}
            className={`view-tab ${isActiveTests ? 'active' : ''}`}
          >
            Active Tests
          </Link>
          <Link
            to={`/campus/${orgSlug}/student/tests/completed`}
            className={`view-tab ${isCompletedTests ? 'active' : ''}`}
          >
            Completed Tests
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          VIEW 1: ACTIVE LAB EXERCISES
          ------------------------------------------------------------------ */}
      {isActiveLabs && (
        <div className="active-labs-view">
          {/* Class Filter Dropdown */}
          <div className="active-filter-bar">
            <label className="filter-select-label">
              <span>Filter by Class:</span>
              <select
                className="filter-select"
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
              >
                <option value="all">All Classes</option>
                <option value="bacs101">BACS101 - CH2025260101659</option>
              </select>
            </label>
          </div>

          <div className="active-labs-grid">
            {MOCK_ACTIVE_LABS.map((lab) => (
              <div key={lab.id} className="active-lab-card" id={`lab-card-${lab.slug}`}>
                <div className="active-card-top">
                  <div className="active-status-badge">
                    <span className="pulse-dot" />
                    <span>Active</span>
                  </div>
                  <span className="card-cohort-badge">{lab.cohort}</span>
                </div>

                <h3 className="active-lab-name">{lab.title}</h3>
                <p className="active-lab-course">{lab.course}</p>

                <div className="active-time-meta">
                  <div className="time-item">
                    <span className="time-lbl">Start</span>
                    <span className="time-val font-mono">{lab.startDate}</span>
                  </div>
                  <div className="time-item">
                    <span className="time-lbl">Deadline</span>
                    <span className="time-val font-mono text-amber">{lab.endDate}</span>
                  </div>
                </div>

                <div className="active-card-faculty">
                  <span>Faculty: <strong>{lab.faculty}</strong></span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary active-open-btn"
                  onClick={() => navigate(`/campus/${orgSlug}/student/labs/${lab.slug}/room`)}
                  id={`btn-open-${lab.slug}`}
                >
                  <span>Open Lab</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          VIEW 2: COMPLETED LAB EXERCISES (With 5-Filter Bar & 2-Column Grid)
          ------------------------------------------------------------------ */}
      {isCompletedLabs && (
        <div className="completed-labs-view">
          {/* 5-Filter Bar */}
          <div className="five-filter-bar">
            <div className="filter-group">
              <span className="filter-lbl">Course</span>
              <select
                className="filter-dropdown"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
              >
                <option value="all">All courses</option>
                <option value="bacs101">Problem Solving Using Java</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-lbl">Semester</span>
              <select
                className="filter-dropdown"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                <option value="all">All semesters</option>
                <option value="fall2526">Fall Semester 2025-26</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-lbl">Faculty</span>
              <select
                className="filter-dropdown"
                value={selectedFaculty}
                onChange={(e) => setSelectedFaculty(e.target.value)}
              >
                <option value="all">All faculty</option>
                <option value="Dr. SARAVANAN P">Dr. SARAVANAN P</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-lbl">Evaluation Status</span>
              <select
                className="filter-dropdown"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="EVALUATED">Evaluated</option>
                <option value="PENDING_EVALUATION">Pending Evaluation</option>
              </select>
            </div>

            <div className="filter-group search-group">
              <span className="filter-lbl">Search Lab</span>
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="e.g. Generics, Threads..."
                  className="filter-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2-Column Card Grid */}
          <div className="completed-cards-grid">
            {filteredCompletedLabs.map((lab) => (
              <div key={lab.id} className="completed-lab-card" id={`comp-card-${lab.slug}`}>
                <div className="comp-card-top">
                  <span className="evaluated-badge blue">Evaluated</span>
                  <div className="comp-score-cluster">
                    <span className="comp-score font-mono">
                      {lab.score}/{lab.maxScore}
                    </span>
                    <span className="comp-percent font-mono">({lab.percentage})</span>
                  </div>
                </div>

                <h3 className="comp-card-title">{lab.title}</h3>
                <span className="comp-card-faculty">Faculty: {lab.faculty}</span>

                <div className="comp-timestamps-table">
                  <div className="stamp-row">
                    <span className="stamp-k">Start</span>
                    <span className="stamp-v font-mono">{lab.startDate}</span>
                  </div>
                  <div className="stamp-row">
                    <span className="stamp-k">End</span>
                    <span className="stamp-v font-mono">{lab.endDate}</span>
                  </div>
                  <div className="stamp-row">
                    <span className="stamp-k">Submitted</span>
                    <span className="stamp-v font-mono highlight">{lab.submittedDate}</span>
                  </div>
                </div>

                <div className="comp-actions-row">
                  <button
                    type="button"
                    className="btn btn-primary comp-details-btn"
                    onClick={() => navigate(`/campus/${orgSlug}/student/labs/${lab.slug}/review`)}
                    id={`btn-view-${lab.slug}`}
                  >
                    <span>View Details</span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary comp-practice-btn"
                    onClick={() => navigate(`/campus/${orgSlug}/student/labs/${lab.slug}/room`)}
                    title="Practice code without affecting grade"
                  >
                    <span>&gt;&lt; Just Practice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          VIEW 3: ACTIVE LAB TESTS (PAT)
          ------------------------------------------------------------------ */}
      {isActiveTests && (
        <div className="active-tests-view">
          <div className="active-labs-grid">
            {MOCK_ACTIVE_TESTS.map((test) => (
              <div key={test.id} className="active-lab-card test-variant">
                <div className="active-card-top">
                  <div className="active-status-badge red">
                    <span className="pulse-dot red" />
                    <span>Live Proctored Test</span>
                  </div>
                  <span className="card-cohort-badge">{test.cohort}</span>
                </div>

                <h3 className="active-lab-name">{test.title}</h3>
                <p className="active-lab-course">{test.course}</p>

                <div className="active-time-meta">
                  <div className="time-item">
                    <span className="time-lbl">Session Window</span>
                    <span className="time-val font-mono">{test.startDate} — {test.endDate}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary active-open-btn"
                  onClick={() => navigate(`/campus/${orgSlug}/student/labs/${test.slug}/room`)}
                >
                  <span>Enter Proctored Exam Arena</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          VIEW 4: COMPLETED LAB TESTS (PAT) (3-Column Card Grid)
          ------------------------------------------------------------------ */}
      {isCompletedTests && (
        <div className="completed-tests-view">
          <div className="completed-tests-grid">
            {filteredCompletedTests.map((test) => (
              <div key={test.id} className="completed-test-card" id={`test-card-${test.slug}`}>
                <div className="comp-card-top">
                  {test.status === 'EVALUATED' ? (
                    <span className="evaluated-badge blue">Evaluated</span>
                  ) : (
                    <span className="evaluated-badge amber">Pending Evaluation</span>
                  )}
                  {test.score !== 'Pending' && (
                    <div className="comp-score-cluster">
                      <span className="comp-score font-mono">{test.score}/{test.maxScore}</span>
                      <span className="comp-percent font-mono">({test.percentage})</span>
                    </div>
                  )}
                </div>

                <h3 className="test-card-title">{test.title}</h3>
                <span className="test-card-course">Course: {test.course}</span>
                <span className="test-card-questions">Questions: {test.questionsCount}</span>

                <div className="test-card-timestamps">
                  <div>
                    <span className="time-lbl">Conducted: </span>
                    <span className="font-mono">{test.startDate}</span>
                  </div>
                  <div>
                    <span className="time-lbl">Submitted: </span>
                    <span className="font-mono highlight">{test.submittedDate}</span>
                  </div>
                </div>

                <div className="comp-actions-row">
                  <button
                    type="button"
                    className="btn btn-primary comp-details-btn"
                    onClick={() => navigate(`/campus/${orgSlug}/student/labs/${test.slug}/review`)}
                  >
                    <span>View Submission</span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary comp-practice-btn"
                    onClick={() => navigate(`/campus/${orgSlug}/student/labs/${test.slug}/room`)}
                  >
                    <span>&gt;&lt; Just Practice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusLabsListPage;
