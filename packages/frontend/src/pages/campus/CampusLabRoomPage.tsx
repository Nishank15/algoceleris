import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  BookOpen,
  Code2,
  CheckCircle2,
  Cpu,
  Award,
  Send,
  Lock,
  Clock,
  Sparkles,
  Play,
  FileText,
  Upload,
  AlertCircle,
  FileCheck2,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Download,
  Info,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getCampusSession } from '../../services/campusSession';

type StageTab = 'content' | 'demo' | 'led' | 'practice' | 'challenging' | 'submit';

interface PracticeProblemDef {
  id: number;
  title: string;
  category: 'debugging' | 'problem_solving';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  description: string;
  sampleInput: string;
  sampleOutput: string;
  lockedHeader: string;
  initialCode: string;
  lockedFooter: string;
  isSolved: boolean;
}

const INITIAL_PRACTICE_PROBLEMS: PracticeProblemDef[] = [
  {
    id: 1,
    title: 'Thread Never Actually Started (extends Thread)',
    category: 'debugging',
    difficulty: 'Medium',
    marks: 10,
    description:
      'The code extends the Thread class but calls run() instead of start(), or fails to invoke the thread scheduler properly. Fix the implementation to ensure the background worker thread starts concurrently and executes the iteration sequence.',
    sampleInput: '5',
    sampleOutput: 'Thread-0 started\nNum: 1\nNum: 2\nNum: 3\nNum: 4\nNum: 5\nDone',
    lockedHeader: `import java.util.Scanner;\n\nclass NumberPrinter extends Thread {\n    private int n;\n    public NumberPrinter(int n) { this.n = n; }`,
    initialCode: `    // TODO: Implement the correct Thread execution lifecycle\n    @Override\n    public void run() {\n        System.out.println(Thread.currentThread().getName() + " started");\n        for (int i = 1; i <= n; i++) {\n            System.out.println("Num: " + i);\n        }\n        System.out.println("Done");\n    }`,
    lockedFooter: `}\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.hasNextInt() ? sc.nextInt() : 5;\n        NumberPrinter t = new NumberPrinter(n);\n        t.start();\n        try { t.join(); } catch (Exception e) {}\n    }\n}`,
    isSolved: false,
  },
  {
    id: 2,
    title: 'Synchronized Counter Increment Race Condition',
    category: 'debugging',
    difficulty: 'Medium',
    marks: 10,
    description:
      'Two threads increment a shared counter 10,000 times concurrently. Due to missing synchronization, the final result is unpredictable. Implement an atomic or synchronized increment method to guarantee exactly 20,000.',
    sampleInput: '10000',
    sampleOutput: 'Final Count: 20000',
    lockedHeader: `class SharedCounter {\n    private int count = 0;`,
    initialCode: `    // TODO: Prevent race condition between concurrent threads\n    public synchronized void increment() {\n        count++;\n    }\n    public int getCount() { return count; }`,
    lockedFooter: `}\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        SharedCounter c = new SharedCounter();\n        Thread t1 = new Thread(() -> { for(int i=0; i<10000; i++) c.increment(); });\n        Thread t2 = new Thread(() -> { for(int i=0; i<10000; i++) c.increment(); });\n        t1.start(); t2.start();\n        t1.join(); t2.join();\n        System.out.println("Final Count: " + c.getCount());\n    }\n}`,
    isSolved: false,
  },
  {
    id: 3,
    title: 'Producer-Consumer Bounded Queue Synchronization',
    category: 'problem_solving',
    difficulty: 'Hard',
    marks: 10,
    description:
      'Implement a thread-safe circular buffer with capacity 5 using wait() and notifyAll(). Prevent buffer overflow when full and buffer underflow when empty.',
    sampleInput: '3 items',
    sampleOutput: 'Produced 1\nProduced 2\nConsumed 1\nProduced 3\nConsumed 2\nConsumed 3',
    lockedHeader: `import java.util.LinkedList;\n\nclass BoundedBuffer<T> {\n    private final LinkedList<T> list = new LinkedList<>();\n    private final int capacity = 5;`,
    initialCode: `    public synchronized void produce(T item) throws InterruptedException {\n        while (list.size() == capacity) { wait(); }\n        list.addLast(item);\n        notifyAll();\n    }\n    public synchronized T consume() throws InterruptedException {\n        while (list.isEmpty()) { wait(); }\n        T val = list.removeFirst();\n        notifyAll();\n        return val;\n    }`,
    lockedFooter: `}\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Bounded Buffer Synchronized");\n    }\n}`,
    isSolved: false,
  },
];

export const CampusLabRoomPage: React.FC = () => {
  const { orgSlug: paramSlug, labId } = useParams<{ orgSlug?: string; labId?: string }>();
  const orgSlug = (paramSlug || 'vit-chennai').toLowerCase();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const session = getCampusSession(orgSlug);

  const labTitle =
    labId === 'pps-11-multi-threading'
      ? 'PPS_11_Multi_Threading'
      : (labId || 'Lab Exercise')
          .split('-')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');

  // Active Stage
  const [activeStage, setActiveStage] = useState<StageTab>('content');

  // Stage 1 Content Subtabs
  const [contentSubtab, setContentSubtab] = useState<'notes' | 'pdf'>('notes');
  const [pdfZoom, setPdfZoom] = useState<number>(100);

  // Stage 3 LED MCQs state (10 questions)
  const [ledAnswers, setLedAnswers] = useState<Record<number, number>>({
    1: 1,
    2: 2,
    3: 0,
  });

  // Stage 4 Practice state
  const [practiceCategory, setPracticeCategory] = useState<'debugging' | 'problem_solving'>('debugging');
  const [practiceProblems, setPracticeProblems] = useState<PracticeProblemDef[]>(INITIAL_PRACTICE_PROBLEMS);
  const [selectedPracticeIndex, setSelectedPracticeIndex] = useState<number>(0);
  const [practiceCode, setPracticeCode] = useState<string>(INITIAL_PRACTICE_PROBLEMS[0].initialCode);
  const [practiceOutput, setPracticeOutput] = useState<string | null>(null);
  const [practiceIsRunning, setPracticeIsRunning] = useState<boolean>(false);
  const [aiHint, setAiHint] = useState<string | null>(null);

  // Stage 5 Challenging problem state
  const [challengeSubtab, setChallengeSubtab] = useState<'pseudocode' | 'editor' | 'results'>('pseudocode');
  const [pseudocodeText, setPseudocodeText] = useState<string>(
    '1. Identify shared lock objects (resourceA, resourceB).\n2. Sort locks by intrinsic System.identityHashCode to enforce global total lock ordering.\n3. Synchronize on primary lock first, then nested synchronize on secondary lock.\n4. Perform transaction work within critical section.\n5. Guarantee release in reverse acquisition order.'
  );
  const [uploadedDesignPdf, setUploadedDesignPdf] = useState<string | null>(
    'flowchart-concurrency-locks.pdf'
  );
  const [challengeCode, setChallengeCode] = useState<string>(
    `public void transfer(Account from, Account to, double amount) {\n    Account first = from.id < to.id ? from : to;\n    Account second = from.id < to.id ? to : from;\n    synchronized (first) {\n        synchronized (second) {\n            from.debit(amount);\n            to.credit(amount);\n        }\n    }\n}`
  );
  const [challengeSolved, setChallengeSolved] = useState<boolean>(true);

  // Live countdown timer (ticking)
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 92,
    minutes: 32,
    seconds: 14,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update editor value when switching practice problem
  const currentPractice = practiceProblems[selectedPracticeIndex] || practiceProblems[0];
  const handleSelectPractice = (idx: number) => {
    setSelectedPracticeIndex(idx);
    setPracticeCode(practiceProblems[idx].initialCode);
    setPracticeOutput(null);
    setAiHint(null);
  };

  // Run practice code simulation
  const handleRunPractice = () => {
    setPracticeIsRunning(true);
    setPracticeOutput('Compiling solution with OpenJDK Java 21...\nRunning test cases...');
    setTimeout(() => {
      setPracticeIsRunning(false);
      setPracticeOutput(
        '✓ Test Case 1: PASSED (Execution time: 14ms · Memory: 18.2 MB)\n' +
        '✓ Test Case 2: PASSED (Execution time: 16ms · Memory: 18.4 MB)\n\n' +
        'Sample Output:\n' +
        currentPractice.sampleOutput +
        '\n\nResult: ALL SAMPLE TESTS PASSED'
      );
    }, 600);
  };

  // Submit practice problem
  const handleSubmitPractice = () => {
    setPracticeProblems((prev) =>
      prev.map((p, idx) => (idx === selectedPracticeIndex ? { ...p, isSolved: true } : p))
    );
    alert(`Practice problem "${currentPractice.title}" passed and marked completed!`);
  };

  // Ask AI hint
  const handleAskAiHint = () => {
    setAiHint(
      'Socratic Hint: Remember that calling .run() on a Thread instance executes the method synchronously in the caller thread. To launch an asynchronous worker thread managed by the JVM OS scheduler, use the .start() method.'
    );
  };

  // Calculate completion checklists
  const ledCount = Object.keys(ledAnswers).length;
  const practiceSolvedCount = practiceProblems.filter((p) => p.isSolved).length;
  const isSubmitReady = ledCount >= 10 && practiceSolvedCount >= practiceProblems.length && challengeSolved;

  // 1-Click Demo autofill to mark everything complete
  const handleDemoMarkAllComplete = () => {
    // Fill 10 LED answers
    const fullLed: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) fullLed[i] = (i % 4);
    setLedAnswers(fullLed);

    // Mark all practice solved
    setPracticeProblems((prev) => prev.map((p) => ({ ...p, isSolved: true })));

    // Mark challenge solved
    setChallengeSolved(true);
    setUploadedDesignPdf('flowchart-lock-ordering.pdf');

    alert('Demo State Applied: All 10 LED questions, Practice problems, and Concurrency Challenge marked complete!');
  };

  const handleFinalSubmit = () => {
    navigate(`/campus/${orgSlug}/student/labs/${labId || 'pps-11-multi-threading'}/review`);
  };

  return (
    <div className="campus-lab-room">
      {/* 1. TOP WORKSPACE HEADER */}
      <header className="lab-room-header">
        <div className="lab-room-header-top">
          <div className="header-student-tag">
            <span className="student-reg font-mono">ID: {session.regNumber}</span>
            <span className="student-role-chip">🎓 Student</span>
          </div>

          <Link
            to={`/campus/${orgSlug}/student/labs`}
            className="btn btn-secondary btn-back-labs"
          >
            <ArrowLeft size={14} />
            <span>Back to Active Lab Exercises</span>
          </Link>
        </div>

        <div className="lab-room-subbar">
          <div className="subbar-title-block">
            <h1 className="lab-room-title">{labTitle}</h1>
            <span className="course-chip font-mono">BACS101 · Java</span>
          </div>

          <div className="subbar-meta-right">
            <div className="countdown-pill" title="Time remaining for lab exercise submission">
              <Clock size={14} className="countdown-clock" />
              <span className="font-mono">
                ⏱ {String(timeLeft.hours).padStart(2, '0')}:
                {String(timeLeft.minutes).padStart(2, '0')}:
                {String(timeLeft.seconds).padStart(2, '0')} left
              </span>
            </div>

            <div className="student-identity-chip">
              <span className="avatar-mini">{session.initials}</span>
              <span className="student-full-name">{session.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. 6 HORIZONTAL WORKFLOW STAGE TABS */}
      <nav className="lab-stage-tabs" role="tablist">
        <button
          type="button"
          className={`stage-tab-btn ${activeStage === 'content' ? 'active' : ''}`}
          onClick={() => setActiveStage('content')}
        >
          <BookOpen size={15} />
          <span>1. Content</span>
        </button>

        <button
          type="button"
          className={`stage-tab-btn ${activeStage === 'demo' ? 'active' : ''}`}
          onClick={() => setActiveStage('demo')}
        >
          <Code2 size={15} />
          <span>2. Demonstration</span>
        </button>

        <button
          type="button"
          className={`stage-tab-btn ${activeStage === 'led' ? 'active' : ''}`}
          onClick={() => setActiveStage('led')}
        >
          <CheckCircle2 size={15} />
          <span>3. LED ({ledCount}/10)</span>
        </button>

        <button
          type="button"
          className={`stage-tab-btn ${activeStage === 'practice' ? 'active' : ''}`}
          onClick={() => setActiveStage('practice')}
        >
          <Cpu size={15} />
          <span>4. Practice Problems ({practiceSolvedCount}/{practiceProblems.length})</span>
        </button>

        <button
          type="button"
          className={`stage-tab-btn ${activeStage === 'challenging' ? 'active' : ''}`}
          onClick={() => setActiveStage('challenging')}
        >
          <Award size={15} />
          <span>5. Challenging ({challengeSolved ? 'Solved' : 'Open'})</span>
        </button>

        <button
          type="button"
          className={`stage-tab-btn submit-tab ${activeStage === 'submit' ? 'active' : ''}`}
          onClick={() => setActiveStage('submit')}
        >
          <Send size={15} />
          <span>6. Submit Lab</span>
        </button>
      </nav>

      {/* 3. STAGE CONTENT WORKSPACE */}
      <div className="lab-room-stage-body">
        {/* ==============================================================
            STAGE 1: CONTENT TAB
            ============================================================== */}
        {activeStage === 'content' && (
          <div className="stage-content-container">
            <div className="content-subnav">
              <button
                type="button"
                className={`content-subnav-btn ${contentSubtab === 'notes' ? 'active' : ''}`}
                onClick={() => setContentSubtab('notes')}
              >
                <BookOpen size={14} />
                <span>Learning Content</span>
              </button>
              <button
                type="button"
                className={`content-subnav-btn ${contentSubtab === 'pdf' ? 'active' : ''}`}
                onClick={() => setContentSubtab('pdf')}
              >
                <FileText size={14} />
                <span>Reference PDF Viewer</span>
              </button>
            </div>

            {contentSubtab === 'notes' ? (
              <div className="content-notes-pane">
                <h2>Multithreading, Concurrency & Synchronization in Java</h2>
                <p>
                  A thread is a lightweight sub-process, the smallest unit of processing. Multiprocessing
                  and multithreading are used to achieve multitasking. In Java, threads can be created by
                  either extending the <code>Thread</code> class or implementing the <code>Runnable</code> interface.
                </p>

                <h3>1. Thread Life Cycle</h3>
                <p>
                  A thread in Java always exists in one of several states: <code>NEW</code>, <code>RUNNABLE</code>,
                  <code>BLOCKED</code>, <code>WAITING</code>, <code>TIMED_WAITING</code>, or <code>TERMINATED</code>.
                </p>

                <div className="notes-code-card">
                  <div className="card-top">
                    <span>Example: Extending Thread Class</span>
                    <span className="font-mono">Java 21</span>
                  </div>
                  <pre className="font-mono">
{`class MyThread extends Thread {
    public void run() {
        System.out.println("Concurrent thread running: " + Thread.currentThread().getId());
    }
}

public class Main {
    public static void main(String[] args) {
        MyThread t = new MyThread();
        t.start(); // Invokes thread scheduler
    }
}`}
                  </pre>
                </div>

                <h3>2. Preventing Deadlocks with Lock Ordering</h3>
                <p>
                  A deadlock occurs when two or more threads are blocked forever, waiting for each other.
                  The canonical prevention strategy is global lock ordering: always acquire resource locks
                  in an identical strict order across all threads.
                </p>
              </div>
            ) : (
              <div className="content-pdf-viewer">
                <div className="pdf-viewer-toolbar">
                  <div className="pdf-page-indicator">
                    <span>Page 1 of 6</span>
                    <span className="pdf-file-name">BACS101_Lecture11_Multithreading.pdf</span>
                  </div>
                  <div className="pdf-controls">
                    <button
                      type="button"
                      className="pdf-btn"
                      onClick={() => setPdfZoom((z) => Math.max(75, z - 15))}
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="font-mono">{pdfZoom}%</span>
                    <button
                      type="button"
                      className="pdf-btn"
                      onClick={() => setPdfZoom((z) => Math.min(150, z + 15))}
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      type="button"
                      className="pdf-btn"
                      onClick={() => alert('Downloading reference PDF for offline study...')}
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <div className="pdf-simulated-canvas" style={{ transform: `scale(${pdfZoom / 100})` }}>
                  <div className="pdf-sheet">
                    <div className="pdf-sheet-header">
                      <span>VELLORE INSTITUTE OF TECHNOLOGY · CHENNAI CAMPUS</span>
                      <span className="font-mono">BACS101 · Fall 2025-26</span>
                    </div>
                    <div className="pdf-sheet-body">
                      <h1>Lecture 11: Java Multithreading & Race Condition Mitigation</h1>
                      <p>
                        Instructor: <strong>Dr. SARAVANAN P</strong> — School of Computer Science & Engineering
                      </p>
                      <hr />
                      <h3>Key Objectives:</h3>
                      <ul>
                        <li>Understand concurrent memory models and memory visibility via volatile.</li>
                        <li>Implement mutual exclusion using intrinsic object monitors.</li>
                        <li>Solve classic synchronization puzzles: Producer-Consumer, Dining Philosophers.</li>
                      </ul>
                      <div className="pdf-diagram-box">
                        [ Architecture Diagram: JVM Main Heap vs Thread Local Stack Frames ]
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==============================================================
            STAGE 2: DEMONSTRATION PROBLEMS
            ============================================================== */}
        {activeStage === 'demo' && (
          <div className="stage-demo-container">
            <div className="demo-card">
              <div className="demo-header-row">
                <div>
                  <span className="demo-badge">Demonstration Problem</span>
                  <h3 className="demo-title">Thread-Safe Synchronized Bounded Buffer</h3>
                </div>
                <span className="demo-mark font-mono">Walkthrough Only</span>
              </div>

              <p className="demo-text">
                Demonstrates how to safely synchronize shared data between producer and consumer threads
                using <code>wait()</code> and <code>notifyAll()</code> inside an intrinsic monitor loop.
              </p>

              <div className="demo-code-wrapper font-mono">
                <pre>
{`import java.util.LinkedList;

public class BoundedBuffer<E> {
    private final LinkedList<E> list = new LinkedList<>();
    private final int limit;

    public BoundedBuffer(int limit) {
        this.limit = limit;
    }

    public synchronized void put(E item) throws InterruptedException {
        // Guard condition must be checked inside a while loop, never an if statement
        while (list.size() == limit) {
            wait();
        }
        list.add(item);
        notifyAll(); // Wake up consumers
    }

    public synchronized E take() throws InterruptedException {
        while (list.isEmpty()) {
            wait();
        }
        E item = list.removeFirst();
        notifyAll(); // Wake up producers
        return item;
    }
}`}
                </pre>
              </div>

              <div className="demo-trace-box">
                <h4>Execution Trace Walkthrough</h4>
                <ol>
                  <li><strong>Producer invokes put(X):</strong> Acquires buffer lock, checks capacity. Since size &lt; limit, adds item and notifies consumers.</li>
                  <li><strong>Buffer becomes full:</strong> Producer thread enters WAITING state, voluntarily relinquishing the intrinsic lock.</li>
                  <li><strong>Consumer invokes take():</strong> Removes item and signals notifyAll(), resuming producer execution.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            STAGE 3: LED (LEARNING BY DOING) 10-QUESTION MCQ QUIZ
            ============================================================== */}
        {activeStage === 'led' && (
          <div className="stage-led-container">
            <div className="led-quiz-header">
              <div>
                <h2>LED Assessment (Learning by Doing)</h2>
                <p>Answer all 10 questions to demonstrate conceptual proficiency before entering the coding sandbox.</p>
              </div>
              <div className="led-counter-pill font-mono">
                <span>{ledCount} / 10 Answered</span>
              </div>
            </div>

            <div className="led-questions-grid">
              {[
                {
                  id: 1,
                  q: 'Which method must be called to allocate an execution stack and start a thread concurrently?',
                  options: ['t.run()', 't.start()', 't.execute()', 't.begin()'],
                  correct: 1,
                },
                {
                  id: 2,
                  q: 'What occurs when two threads simultaneously modify a non-synchronized variable without mutual exclusion?',
                  options: ['Deadlock', 'Starvation', 'Race Condition', 'Thread Abortion'],
                  correct: 2,
                },
                {
                  id: 3,
                  q: 'Which keyword guarantees memory visibility across threads by bypassing local CPU caches?',
                  options: ['volatile', 'synchronized', 'transient', 'final'],
                  correct: 0,
                },
                {
                  id: 4,
                  q: 'What state does a thread enter when it invokes Object.wait()?',
                  options: ['TERMINATED', 'WAITING', 'RUNNABLE', 'BLOCKED'],
                  correct: 1,
                },
                {
                  id: 5,
                  q: 'Why should wait() always be called inside a while loop rather than an if statement?',
                  options: ['Compiler optimization', 'To prevent spurious wakeups', 'Stack overflow mitigation', 'Garbage collection'],
                  correct: 1,
                },
                {
                  id: 6,
                  q: 'Which class in java.util.concurrent provides lock-free thread-safe integer operations?',
                  options: ['AtomicInteger', 'ConcurrentInt', 'VolatileInteger', 'SyncNumber'],
                  correct: 0,
                },
                {
                  id: 7,
                  q: 'What is the primary condition required for a Deadlock to occur?',
                  options: ['Mutual Exclusion', 'Hold and Wait', 'No Preemption', 'All of the above'],
                  correct: 3,
                },
                {
                  id: 8,
                  q: 'What does the join() method on a thread instance accomplish?',
                  options: ['Terminates the target thread', 'Waits for the target thread to die before continuing', 'Combines two thread priority levels', 'Pauses JVM GC'],
                  correct: 1,
                },
                {
                  id: 9,
                  q: 'Can a synchronized static method and a synchronized instance method of the same class execute concurrently?',
                  options: ['Yes, because they lock on different objects (Class vs this)', 'No, locks conflict', 'Only on multi-core CPUs', 'Only in Java 21'],
                  correct: 0,
                },
                {
                  id: 10,
                  q: 'What exception is thrown when a thread in sleep or wait state is interrupted?',
                  options: ['IllegalThreadStateException', 'InterruptedException', 'ThreadDeadlockException', 'RuntimeException'],
                  correct: 1,
                },
              ].map((item) => (
                <div key={item.id} className="led-question-item">
                  <div className="led-q-head">
                    <span className="q-badge">Q{item.id}</span>
                    <span className="q-title">{item.q}</span>
                    <span className="q-mark font-mono">1 Mark</span>
                  </div>

                  <div className="led-q-opts">
                    {item.options.map((opt, optIdx) => {
                      const isSelected = ledAnswers[item.id] === optIdx;
                      return (
                        <label
                          key={optIdx}
                          className={`led-opt-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => setLedAnswers((prev) => ({ ...prev, [item.id]: optIdx }))}
                        >
                          <input
                            type="radio"
                            name={`led-q-${item.id}`}
                            checked={isSelected}
                            onChange={() => {}}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==============================================================
            STAGE 4: PRACTICE PROBLEMS (SECTION-LOCKED WORKSPACE)
            ============================================================== */}
        {activeStage === 'practice' && (
          <div className="stage-practice-split">
            {/* LEFT 40% PANE: Problem description & numbered selector pills */}
            <div className="practice-left-pane">
              {/* Category Subnav */}
              <div className="practice-category-tabs">
                <button
                  type="button"
                  className={`cat-btn ${practiceCategory === 'debugging' ? 'active' : ''}`}
                  onClick={() => setPracticeCategory('debugging')}
                >
                  Debugging Code (6)
                </button>
                <button
                  type="button"
                  className={`cat-btn ${practiceCategory === 'problem_solving' ? 'active' : ''}`}
                  onClick={() => setPracticeCategory('problem_solving')}
                >
                  Problem Solving (4)
                </button>
              </div>

              {/* Numbered Problem Pills */}
              <div className="problem-pills-bar">
                {practiceProblems.map((prob, idx) => (
                  <button
                    key={prob.id}
                    type="button"
                    className={`problem-pill-btn ${selectedPracticeIndex === idx ? 'active' : ''} ${
                      prob.isSolved ? 'solved' : 'unsolved'
                    }`}
                    onClick={() => handleSelectPractice(idx)}
                  >
                    <span>{prob.id}</span>
                    {prob.isSolved && <span className="pill-dot-green">✓</span>}
                  </button>
                ))}
              </div>

              {/* Problem Details */}
              <div className="practice-problem-desc-card">
                <div className="desc-top">
                  <h3 className="desc-title">{currentPractice.title}</h3>
                  <div className="desc-meta">
                    <span className="badge-diff medium">{currentPractice.difficulty}</span>
                    <span className="badge-marks font-mono">Marks: {currentPractice.marks}</span>
                  </div>
                </div>

                <div className="desc-body">
                  <p>{currentPractice.description}</p>

                  <h4>Sample Input</h4>
                  <pre className="font-mono sample-box">{currentPractice.sampleInput}</pre>

                  <h4>Sample Output</h4>
                  <pre className="font-mono sample-box">{currentPractice.sampleOutput}</pre>
                </div>
              </div>
            </div>

            {/* RIGHT 60% PANE: Section-Locked Code Editor */}
            <div className="practice-right-pane">
              <div className="pane-topbar">
                <div className="status-indicator">
                  <span className={`status-dot ${currentPractice.isSolved ? 'green' : 'amber'}`} />
                  <span className="status-label">
                    {currentPractice.isSolved ? 'Completed' : 'Not Completed'}
                  </span>
                </div>
                <div className="editor-theme-label font-mono">
                  OpenJDK Java 21 · Linear Midnight
                </div>
              </div>

              {/* SECTION-LOCKED WORKSPACE */}
              <div className="section-locked-workspace">
                {/* Fixed Section 1 Header */}
                <div className="locked-code-block top">
                  <div className="locked-badge">
                    <Lock size={12} />
                    <span>Section 1: Fixed — read only (Header & Imports)</span>
                  </div>
                  <pre className="font-mono locked-pre">{currentPractice.lockedHeader}</pre>
                </div>

                {/* Middle Editable Solution Area */}
                <div className="editable-code-block">
                  <div className="editable-badge">
                    <span>Writable Solution Area — Enter Fix Below:</span>
                  </div>
                  <div className="monaco-wrapper">
                    <Editor
                      height="260px"
                      language="java"
                      theme={theme === 'light' ? 'vs' : 'vs-dark'}
                      value={practiceCode}
                      onChange={(val) => setPracticeCode(val || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>

                {/* Fixed Section 2 Driver */}
                <div className="locked-code-block bottom">
                  <div className="locked-badge">
                    <Lock size={12} />
                    <span>Section 2: Fixed — read only (Main Driver Entry)</span>
                  </div>
                  <pre className="font-mono locked-pre">{currentPractice.lockedFooter}</pre>
                </div>
              </div>

              {/* Action Bar */}
              <div className="practice-action-bar">
                <div className="action-left">
                  <button
                    type="button"
                    className="btn btn-secondary btn-run"
                    onClick={handleRunPractice}
                    disabled={practiceIsRunning}
                  >
                    <Play size={14} fill="currentColor" />
                    <span>{practiceIsRunning ? 'Running...' : 'Run Code'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-hint"
                    onClick={handleAskAiHint}
                  >
                    <Sparkles size={14} />
                    <span>Ask AI Mentor Hint</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-submit-prob"
                  onClick={handleSubmitPractice}
                >
                  <CheckCircle2 size={14} />
                  <span>Submit Practice Problem</span>
                </button>
              </div>

              {/* AI Hint Box */}
              {aiHint && (
                <div className="ai-hint-drawer">
                  <div className="hint-header">
                    <Sparkles size={14} className="sparkle-ai" />
                    <strong>AlgoCeleris AI Mentor</strong>
                  </div>
                  <p className="hint-text">{aiHint}</p>
                </div>
              )}

              {/* Terminal Output */}
              {practiceOutput && (
                <div className="practice-terminal-box">
                  <div className="terminal-title">Execution Console Output:</div>
                  <pre className="font-mono terminal-pre">{practiceOutput}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            STAGE 5: CHALLENGING PROBLEMS
            ============================================================== */}
        {activeStage === 'challenging' && (
          <div className="stage-practice-split">
            {/* Left 40% */}
            <div className="practice-left-pane">
              <div className="problem-pills-bar">
                <button type="button" className="problem-pill-btn active solved">
                  <span>1</span>
                  <span className="pill-dot-green">✓</span>
                </button>
                <button type="button" className="problem-pill-btn">
                  <span>2</span>
                </button>
                <button type="button" className="problem-pill-btn">
                  <span>3</span>
                </button>
                <button type="button" className="problem-pill-btn">
                  <span>4</span>
                </button>
              </div>

              <div className="practice-problem-desc-card">
                <div className="desc-top">
                  <h3 className="desc-title">Deadlock-Free Locking of Two Shared Resources</h3>
                  <div className="desc-meta">
                    <span className="badge-diff hard">High</span>
                    <span className="badge-marks font-mono">Marks: 10</span>
                  </div>
                </div>

                <div className="desc-body">
                  <p>
                    Implement a bulletproof account transfer method that guarantees absolute freedom from
                    circular deadlocks when two simultaneous transactions execute <code>transfer(A, B)</code>
                    and <code>transfer(B, A)</code> concurrently.
                  </p>
                  <p>
                    You must provide your structured pseudocode, optionally upload a design flowchart PDF,
                    and write the section-locked Java implementation.
                  </p>
                </div>
              </div>
            </div>

            {/* Right 60% with 3 Subtabs */}
            <div className="practice-right-pane">
              <div className="challenge-subnav">
                <button
                  type="button"
                  className={`sub-btn ${challengeSubtab === 'pseudocode' ? 'active' : ''}`}
                  onClick={() => setChallengeSubtab('pseudocode')}
                >
                  1. Pseudocode Approach
                </button>
                <button
                  type="button"
                  className={`sub-btn ${challengeSubtab === 'editor' ? 'active' : ''}`}
                  onClick={() => setChallengeSubtab('editor')}
                >
                  2. Design PDF & Code
                </button>
                <button
                  type="button"
                  className={`sub-btn ${challengeSubtab === 'results' ? 'active' : ''}`}
                  onClick={() => setChallengeSubtab('results')}
                >
                  3. Final Submission
                </button>
              </div>

              {challengeSubtab === 'pseudocode' && (
                <div className="challenge-pseudocode-pane">
                  <div className="pseudocode-instruction">
                    <Info size={14} />
                    <span>Outline your approach before coding. This is part of the evaluation criteria.</span>
                  </div>
                  <textarea
                    className="pseudocode-textarea font-mono"
                    rows={12}
                    value={pseudocodeText}
                    onChange={(e) => setPseudocodeText(e.target.value)}
                  />
                  <div className="pane-footer-action">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setChallengeSubtab('editor')}
                    >
                      <span>Save Approach & Proceed to Code Editor</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {challengeSubtab === 'editor' && (
                <div className="challenge-editor-pane">
                  {/* PDF Upload Box */}
                  <div className="design-pdf-uploader">
                    <div className="uploader-meta">
                      <strong>Design (PDF) Upload Box</strong>
                      <span className="text-secondary text-xs">
                        Optionally upload your design — flowchart, UML, or approach — as a single PDF (max 5 MB).
                      </span>
                    </div>

                    <div className="uploader-action-row">
                      <label className="btn btn-secondary file-upload-btn">
                        <Upload size={14} />
                        <span>Upload Design PDF</span>
                        <input
                          type="file"
                          accept=".pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setUploadedDesignPdf(e.target.files[0].name);
                            }
                          }}
                        />
                      </label>
                      {uploadedDesignPdf && (
                        <div className="uploaded-pdf-badge font-mono">
                          <FileText size={14} color="#60a5fa" />
                          <span>{uploadedDesignPdf}</span>
                          <span className="pdf-tag">Verified</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Monaco Editor */}
                  <div className="monaco-wrapper" style={{ marginTop: '12px' }}>
                    <Editor
                      height="240px"
                      language="java"
                      theme={theme === 'light' ? 'vs' : 'vs-dark'}
                      value={challengeCode}
                      onChange={(val) => setChallengeCode(val || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        automaticLayout: true,
                      }}
                    />
                  </div>

                  <div className="practice-action-bar" style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setChallengeSolved(true);
                        setChallengeSubtab('results');
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Submit Challenging Solution</span>
                    </button>
                  </div>
                </div>
              )}

              {challengeSubtab === 'results' && (
                <div className="challenge-results-pane">
                  <div className="result-card-item success">
                    <CheckCircle2 size={18} color="#34d399" />
                    <div>
                      <strong>Public & Private Test Cases Passed</strong>
                      <p className="font-mono text-xs">
                        Passed 3/3 Public Test Cases · Passed 4/4 Hidden Stress Tests (Execution: 28ms)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            STAGE 6: SUBMIT LAB TAB (COMPLETION CHECKLIST GATEKEEPER)
            ============================================================== */}
        {activeStage === 'submit' && (
          <div className="stage-submit-container">
            <div className="submit-lab-card">
              <div className="submit-card-header">
                <h2>Submit Lab Exercise</h2>
                <p>Verify that all mandatory components have been successfully completed before submitting for grade evaluation.</p>
              </div>

              {/* Completion Checklist */}
              <div className="completion-checklist-box">
                <h4 className="checklist-title">Completion checklist:</h4>

                <div className="checklist-row">
                  <div className="check-item-left">
                    <span className={`check-icon ${ledCount >= 10 ? 'complete' : 'pending'}`}>
                      {ledCount >= 10 ? '✓' : '○'}
                    </span>
                    <span>LED (Learning by Doing) MCQs</span>
                  </div>
                  <span className="check-count font-mono">{ledCount}/10 completed</span>
                </div>

                <div className="checklist-row">
                  <div className="check-item-left">
                    <span className={`check-icon ${practiceSolvedCount >= practiceProblems.length ? 'complete' : 'pending'}`}>
                      {practiceSolvedCount >= practiceProblems.length ? '✓' : '○'}
                    </span>
                    <span>Practice Problems</span>
                  </div>
                  <span className="check-count font-mono">{practiceSolvedCount}/{practiceProblems.length} completed</span>
                </div>

                <div className="checklist-row">
                  <div className="check-item-left">
                    <span className={`check-icon ${challengeSolved ? 'complete' : 'pending'}`}>
                      {challengeSolved ? '✓' : '○'}
                    </span>
                    <span>Challenging Problems</span>
                  </div>
                  <span className="check-count font-mono">{challengeSolved ? '1/1' : '0/1'} completed</span>
                </div>
              </div>

              {/* Gatekeeper status banner */}
              {!isSubmitReady ? (
                <div className="submit-warning-banner">
                  <AlertCircle size={18} className="warn-icon" />
                  <div className="warn-text">
                    <strong>⚠️ Not ready to submit</strong>
                    <p>Complete every part above before you can submit this lab exercise.</p>
                  </div>
                </div>
              ) : (
                <div className="submit-success-banner">
                  <CheckCircle2 size={18} className="success-icon" />
                  <div className="success-text">
                    <strong>All Requirements Satisfied</strong>
                    <p>Your solution has passed all test checks and is ready for final grade evaluation.</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="submit-action-stack">
                <button
                  type="button"
                  className="btn btn-primary final-submit-btn"
                  disabled={!isSubmitReady}
                  onClick={handleFinalSubmit}
                  id="btn-final-submit-lab"
                >
                  <Send size={15} />
                  <span>Submit Lab Exercise for Final Grading</span>
                </button>

                {/* Instant Demo Helper */}
                <button
                  type="button"
                  className="btn btn-secondary demo-mark-all-btn"
                  onClick={handleDemoMarkAllComplete}
                >
                  <span>⚡ Demo: Mark All Sections Complete & Ready to Submit</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampusLabRoomPage;
