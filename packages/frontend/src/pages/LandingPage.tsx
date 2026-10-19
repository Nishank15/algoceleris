import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, Server, Activity } from 'lucide-react';
import { MicroSandboxTeaser } from '../components/MicroSandboxTeaser';

export const LandingPage: React.FC = () => {
  return (
    <main className="landing-page-root">
      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-badge">
          <span className="landing-badge-dot" />
          <span>ENTERPRISE SECURITY · ISOLATED EVALUATION</span>
        </div>

        <h1 className="landing-hero-title">
          Ultra-low-latency code evaluation.
        </h1>

        <p className="landing-hero-subtitle">
          Instant automated grading, dedicated memory boundaries, and real-time per-testcase execution streaming.
        </p>

        <div className="landing-cta-cluster">
          <Link to="/problems" className="btn btn-secondary landing-cta-primary" id="landing-explore-btn">
            <span>Explore Problem Catalog</span>
            <ArrowRight size={14} />
          </Link>
          <Link to="/contests" className="btn btn-secondary landing-cta-secondary" id="landing-contests-btn">
            <Activity size={14} />
            <span>Live Contests</span>
          </Link>
        </div>
      </section>

      {/* Telemetry Benchmark Grid */}
      <section className="landing-telemetry-section" aria-labelledby="telemetry-heading">
        <div className="landing-section-header">
          <h2 id="telemetry-heading" className="landing-section-title">
            Architectural Performance Telemetry
          </h2>
          <p className="landing-section-subtitle">
            Measured against production benchmarks under continuous load.
          </p>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <Zap size={16} className="telemetry-icon" />
              <span className="telemetry-badge">RESPONSE TIME</span>
            </div>
            <div className="telemetry-value">&lt; 15ms</div>
            <div className="telemetry-label">Instant Evaluation</div>
            <p className="telemetry-desc">
              Evaluations begin immediately, so students get feedback within the same working session.
            </p>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <ShieldCheck size={16} className="telemetry-icon" />
              <span className="telemetry-badge">REPRODUCIBLE</span>
            </div>
            <div className="telemetry-value">Same every run</div>
            <div className="telemetry-label">Deterministic Grading</div>
            <p className="telemetry-desc">
              Every submission is evaluated in a fresh environment, so scores reflect the solution rather than the machine it ran on.
            </p>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <Server size={16} className="telemetry-icon" />
              <span className="telemetry-badge">FACULTY CONTROL</span>
            </div>
            <div className="telemetry-value">Per question</div>
            <div className="telemetry-label">Configurable Time and Memory Limits</div>
            <p className="telemetry-desc">
              Faculty set the time and memory allowance for each question, and the same limits apply to every submission.
            </p>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <Activity size={16} className="telemetry-icon" />
              <span className="telemetry-badge">SECURITY</span>
            </div>
            <div className="telemetry-value">Isolated</div>
            <div className="telemetry-label">No Network Access During Evaluation</div>
            <p className="telemetry-desc">
              Submissions cannot reach the network or read another student's work, keeping multi-tenant evaluations separate.
            </p>
          </div>
        </div>
      </section>

      {/* Live Micro-Sandbox Runner Teaser */}
      <section className="landing-sandbox-section" aria-labelledby="sandbox-heading">
        <div className="landing-section-header">
          <div className="landing-section-pill">INTERACTIVE SANDBOX</div>
          <h2 id="sandbox-heading" className="landing-section-title">
            Execute code in the sandbox live.
          </h2>
          <p className="landing-section-subtitle">
            Try Python 3.12, C++20, or Java 21 directly against the evaluation queue.
          </p>
        </div>

        <MicroSandboxTeaser />
      </section>

      {/* Architecture Footer Highlights */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-col">
            <span className="footer-label">INGRESS PROXY</span>
            <span className="footer-val">HAProxy 3.0 L7 Reverse Proxy (:8080)</span>
          </div>
          <div className="landing-footer-col">
            <span className="footer-label">API GATEWAY</span>
            <span className="footer-val">FastAPI Asynchronous Runtime (:8000)</span>
          </div>
          <div className="landing-footer-col">
            <span className="footer-label">MESSAGE BROKER</span>
            <span className="footer-val">Redis 7.2 In-Memory Task Queue</span>
          </div>
          <div className="landing-footer-col">
            <span className="footer-label">EXECUTION ENGINE</span>
            <span className="footer-val">Secure Isolated Evaluation Engine</span>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
