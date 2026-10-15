import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  FileText,
  Code2,
  FileCheck2,
  History,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Cpu,
  Brain,
  Shield,
  Clock,
  Award,
} from 'lucide-react';

type ReviewTab =
  | 'content'
  | 'demo'
  | 'led'
  | 'practice'
  | 'challenging'
  | 'evaluation'
  | 'history'
  | 'feedback';

export const CampusLabReviewPage: React.FC = () => {
  const { orgSlug: paramSlug, labId } = useParams<{ orgSlug?: string; labId?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ReviewTab>('evaluation');

  // Format title from labId
  const labTitle =
    labId === 'week-12-generics'
      ? 'Week 12_Generics'
      : labId === 'week-11-multithreading'
      ? 'Week 11_Multithreading'
      : labId === 'week-10-pps'
      ? 'Week 10_PPS'
      : (labId || 'Lab Exercise')
          .split('-')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');

  return (
    <div className="campus-review-page">
      {/* Top Info Banner */}
      <div className="campus-review-banner">
        <div className="banner-left">
          <Lock size={15} className="banner-lock-icon" />
          <div className="banner-text-cluster">
            <strong>Completed Lab Exercise</strong>
            <span>
              This lab exercise has already been submitted and scored. You are viewing your submission
              and evaluation in read-only mode.
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary review-back-btn"
          onClick={() => navigate(`/campus/${orgSlug}/student/labs/completed`)}
        >
          <ArrowLeft size={14} />
          <span>Back to Completed Labs</span>
        </button>
      </div>

      {/* Lab Header Summary */}
      <div className="campus-review-header">
        <div className="review-title-col">
          <div className="review-breadcrumbs">
            <span>BACS101 · Problem Solving Using Java</span>
            <ChevronRight size={12} />
            <span className="font-mono">{labTitle}</span>
          </div>
          <h1 className="review-lab-title">{labTitle}</h1>
          <div className="review-meta-pills">
            <span className="pill-status blue">
              <CheckCircle2 size={13} />
              <span>Evaluated</span>
            </span>
            <span className="pill-cohort">Cohort: BACS101 - CH2025260101659</span>
            <span className="pill-faculty">Faculty: Dr. SARAVANAN P</span>
          </div>
        </div>

        <div className="review-score-hero">
          <span className="score-hero-label">Final Evaluation Score</span>
          <div className="score-hero-digits">
            <span className="earned-points font-mono">20</span>
            <span className="total-points font-mono">/ 20</span>
            <span className="percent-badge font-mono">100%</span>
          </div>
          <span className="score-hero-sub">Grade Awarded by Faculty & Automated Judge</span>
        </div>
      </div>

      {/* 8 HORIZONTAL REVIEW TABS */}
      <div className="campus-review-tabs" role="tablist">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          <BookOpen size={14} />
          <span>1. Content</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'demo' ? 'active' : ''}`}
          onClick={() => setActiveTab('demo')}
        >
          <Code2 size={14} />
          <span>2. Demonstration</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'led' ? 'active' : ''}`}
          onClick={() => setActiveTab('led')}
        >
          <CheckCircle2 size={14} />
          <span>3. LED (5/5)</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'practice' ? 'active' : ''}`}
          onClick={() => setActiveTab('practice')}
        >
          <Cpu size={14} />
          <span>4. Practice Problems</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'challenging' ? 'active' : ''}`}
          onClick={() => setActiveTab('challenging')}
        >
          <Award size={14} />
          <span>5. Challenging Problem</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'evaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluation')}
        >
          <FileCheck2 size={14} />
          <span>6. Evaluation Summary</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={14} />
          <span>7. Submission History</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          <MessageSquare size={14} />
          <span>8. Feedback & CLO</span>
        </button>
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="campus-review-content-card">
        {/* TAB 1: Content */}
        {activeTab === 'content' && (
          <div className="tab-panel-inner">
            <h3 className="panel-title">Lecture Notes & Core Pedagogical Concepts</h3>
            <p className="panel-sub">
              Theoretical reference materials and code templates provided by the course faculty.
            </p>

            <div className="content-markdown-box">
              <h4>1. Java Generics and Type Erasure</h4>
              <p>
                Generics allow types (classes and interfaces) to be parameters when defining
                classes, interfaces and methods. Type parameters provide a way for you to re-use
                the same code with different inputs:
              </p>
              <pre className="code-block font-mono">
{`public class Box<T> {
    private T t;
    public void set(T t) { this.t = t; }
    public T get() { return t; }
}`}
              </pre>

              <h4>2. Bounded Type Parameters & Wildcards</h4>
              <p>
                Use upper-bounded wildcards <code>&lt;? extends Number&gt;</code> to relax the
                restrictions on a variable. A lower-bounded wildcard <code>&lt;? super Integer&gt;</code>
                restricts the unknown type to be a specific type or a super type.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Demonstration Problems */}
        {activeTab === 'demo' && (
          <div className="tab-panel-inner">
            <h3 className="panel-title">Worked Demonstration Problems</h3>
            <p className="panel-sub">
              Instructor walkthroughs and canonical reference solutions for study.
            </p>

            <div className="demo-problem-box">
              <div className="demo-header">
                <strong>Demo Problem 1: Generic Thread-Safe Stack</strong>
                <span className="badge-easy">Demonstration</span>
              </div>
              <p className="demo-desc">
                Implementing a bounded LIFO stack that safely handles simultaneous push and pop
                operations using Java synchronized blocks.
              </p>
              <pre className="code-block font-mono">
{`import java.util.LinkedList;

public class ThreadSafeStack<T> {
    private final LinkedList<T> list = new LinkedList<>();

    public synchronized void push(T item) {
        list.addFirst(item);
        notifyAll();
    }

    public synchronized T pop() throws InterruptedException {
        while (list.isEmpty()) {
            wait();
        }
        return list.removeFirst();
    }
}`}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: LED Assessment */}
        {activeTab === 'led' && (
          <div className="tab-panel-inner">
            <div className="led-top-status">
              <div className="led-badge-pill">
                <CheckCircle2 size={16} />
                <span>LED Assessment Complete: 5/5 Correct (100%)</span>
              </div>
              <span className="led-sub">Points Awarded: 5.0 / 5.0</span>
            </div>

            <div className="led-questions-list">
              <div className="led-q-card correct">
                <div className="q-head">
                  <span className="q-num">Q1</span>
                  <span className="q-title">Which of the following creates a bounded wildcard in Java?</span>
                  <span className="q-mark">1/1 Mark</span>
                </div>
                <div className="q-options">
                  <div className="q-opt selected-correct">
                    <span className="opt-radio">●</span>
                    <span>List&lt;? extends Number&gt; list</span>
                  </div>
                  <div className="q-opt">
                    <span className="opt-radio">○</span>
                    <span>List&lt;T : Number&gt; list</span>
                  </div>
                </div>
              </div>

              <div className="led-q-card correct">
                <div className="q-head">
                  <span className="q-num">Q2</span>
                  <span className="q-title">What happens to generic type information at runtime in Java?</span>
                  <span className="q-mark">1/1 Mark</span>
                </div>
                <div className="q-options">
                  <div className="q-opt selected-correct">
                    <span className="opt-radio">●</span>
                    <span>It is erased by the compiler via type erasure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Practice Problems */}
        {activeTab === 'practice' && (
          <div className="tab-panel-inner">
            <h3 className="panel-title">Practice Coding Challenges (Read-Only)</h3>
            <p className="panel-sub">
              Your passing solutions executed against the Linux sandbox container.
            </p>

            <div className="practice-subtabs">
              <span className="badge-pill active">Problem 1: Generic Pair Swapper (Solved · 10/10)</span>
            </div>

            <div className="code-read-only-box">
              <div className="code-editor-top">
                <span>Solution: PairSwapper.java (GCC Java 21)</span>
                <span className="test-pass-indicator">✓ All 4 Test Cases Passed</span>
              </div>
              <pre className="code-block font-mono">
{`public class PairSwapper {
    public static <T> void swap(T[] array, int i, int j) {
        if (array == null || i < 0 || j < 0 || i >= array.length || j >= array.length) {
            return;
        }
        T temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}`}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: Challenging Problems */}
        {activeTab === 'challenging' && (
          <div className="tab-panel-inner">
            <h3 className="panel-title">Challenging Concurrency Problem</h3>
            <p className="panel-sub">
              Multi-threaded Deadlock-Free Locking of Two Shared Resources with submitted pseudocode and design.
            </p>

            <div className="challenge-review-grid">
              <div className="challenge-item">
                <h4>Submitted Approach & Pseudocode</h4>
                <div className="pseudocode-preview font-mono">
                  1. Determine intrinsic System.identityHashCode for both locks.<br />
                  2. Always acquire the lock with lower hashcode first.<br />
                  3. If hashcodes collide, acquire tie-breaker secondary lock.<br />
                  4. Execute critical section within try-finally block.
                </div>
              </div>

              <div className="challenge-item">
                <h4>Uploaded Design Artifact</h4>
                <div className="artifact-preview">
                  <FileText size={20} color="#60a5fa" />
                  <div>
                    <strong>flowchart-lock-ordering.pdf</strong>
                    <span className="artifact-size">142 KB · Verified Upload</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: Evaluation Summary */}
        {activeTab === 'evaluation' && (
          <div className="tab-panel-inner">
            <h3 className="panel-title">Itemized Evaluation Breakdown</h3>
            <p className="panel-sub">
              Automated judge test suite results and rubric allocations.
            </p>

            <div className="eval-table-wrapper">
              <table className="eval-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Public Tests</th>
                    <th>Private (Hidden) Tests</th>
                    <th>Time (Max)</th>
                    <th>Memory</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>LED Concept Assessment</strong></td>
                    <td>5 / 5 passed</td>
                    <td>N/A</td>
                    <td>Instant</td>
                    <td>-</td>
                    <td className="score-cell font-mono">5.0 / 5.0</td>
                  </tr>
                  <tr>
                    <td><strong>Practice Part 1: Debugging Code</strong></td>
                    <td>2 / 2 passed</td>
                    <td>2 / 2 passed</td>
                    <td>14ms</td>
                    <td>18.4 MB</td>
                    <td className="score-cell font-mono">5.0 / 5.0</td>
                  </tr>
                  <tr>
                    <td><strong>Practice Part 2: Problem Solving</strong></td>
                    <td>2 / 2 passed</td>
                    <td>2 / 2 passed</td>
                    <td>18ms</td>
                    <td>21.2 MB</td>
                    <td className="score-cell font-mono">5.0 / 5.0</td>
                  </tr>
                  <tr>
                    <td><strong>Challenging Problem: Concurrency</strong></td>
                    <td>3 / 3 passed</td>
                    <td>4 / 4 passed</td>
                    <td>28ms</td>
                    <td>24.6 MB</td>
                    <td className="score-cell font-mono">5.0 / 5.0</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}><strong>Total Evaluated Marks</strong></td>
                    <td className="score-cell font-mono total">20.0 / 20.0 (100%)</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: Submission History */}
        {activeTab === 'history' && (
          <div className="tab-panel-inner">
            <h3 className="panel-title">Submission History & Audit Trail</h3>
            <div className="history-timeline">
              <div className="history-entry final">
                <div className="entry-dot" />
                <div className="entry-body">
                  <div className="entry-title-row">
                    <strong>Final Graded Submission</strong>
                    <span className="font-mono text-muted">Oct 12, 2026 · 10:14:22 PM</span>
                  </div>
                  <span className="entry-detail font-mono">Verdict: ACCEPTED · Score: 20/20 · SHA: a8f419b...</span>
                </div>
              </div>

              <div className="history-entry">
                <div className="entry-dot" />
                <div className="entry-body">
                  <div className="entry-title-row">
                    <span>Practice Run 3: Challenging Problem</span>
                    <span className="font-mono text-muted">Oct 12, 2026 · 10:02:15 PM</span>
                  </div>
                  <span className="entry-detail font-mono">Public Tests: 3/3 passed</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: Feedback Summary & CLO */}
        {activeTab === 'feedback' && (
          <div className="tab-panel-inner">
            <h3 className="panel-title">Instructor Feedback & Learning Outcomes</h3>

            <div className="feedback-card">
              <div className="feedback-source">
                <strong>👨‍🏫 Dr. SARAVANAN P (Course Faculty)</strong>
                <span className="feedback-date">Oct 13, 2026 · 09:15 AM</span>
              </div>
              <p className="feedback-text">
                "Excellent grasp of bounded wildcards and rigorous identity-hashcode lock ordering.
                Code formatting complies with Google Java style guidelines. Well done."
              </p>
            </div>

            <div className="feedback-card ai">
              <div className="feedback-source">
                <Sparkles size={14} className="sparkle-ai" />
                <strong>AlgoCeleris AI Mentor Insight</strong>
              </div>
              <p className="feedback-text">
                "Zero deadlock occurrences across 10,000 automated stress cycles. High cyclomatic
                efficiency (Complexity: 3). Strong candidate for advanced Distributed Systems modules."
              </p>
            </div>

            <div className="clo-attainment-box">
              <h4>Course Learning Outcome (CLO) Attainment</h4>
              <div className="clo-item">
                <div className="clo-info">
                  <span className="clo-code">CLO-2: Concurrency & Generic Data Structures</span>
                  <span className="clo-score font-mono">100% Attained</span>
                </div>
                <div className="clo-bar-track">
                  <div className="clo-bar-fill" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampusLabReviewPage;
