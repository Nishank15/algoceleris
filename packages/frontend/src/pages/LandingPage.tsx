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
          <span>LINUX CGROUPS V2 · TRANSIENT SCOPES</span>
        </div>

        <h1 className="landing-hero-title">
          Ultra-low-latency code evaluation.
        </h1>

        <p className="landing-hero-subtitle">
          Sub-millisecond worker dispatch, kernel-enforced 256MB memory boundaries, and live per-testcase WebSocket telemetry.
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
            Architectural Benchmark Telemetry
          </h2>
          <p className="landing-section-subtitle">
            Measured against bare-metal Linux daemons under production load.
          </p>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <Zap size={16} className="telemetry-icon" />
              <span className="telemetry-badge">COLD-START</span>
            </div>
            <div className="telemetry-value">&lt; 15ms</div>
            <div className="telemetry-label">Sandbox Startup</div>
            <p className="telemetry-desc">
              Transient systemd-run scopes bypass heavy container or VM hypervisor spinup overhead.
            </p>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <ShieldCheck size={16} className="telemetry-icon" />
              <span className="telemetry-badge">MEMORY CAP</span>
            </div>
            <div className="telemetry-value">256 MB</div>
            <div className="telemetry-label">Strict RAM Limit</div>
            <p className="telemetry-desc">
              Linux cgroup memory.max enforcement with immediate kernel OOM SIGKILL containment.
            </p>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <Server size={16} className="telemetry-icon" />
              <span className="telemetry-badge">COMPUTE QUOTA</span>
            </div>
            <div className="telemetry-value">1.0 vCPU</div>
            <div className="telemetry-label">CFS CPU Allocation</div>
            <p className="telemetry-desc">
              Dedicated 100,000µs quota per 100,000µs period prevents noisy neighbor starvation.
            </p>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-card-top">
              <Activity size={16} className="telemetry-icon" />
              <span className="telemetry-badge">NETWORK JAIL</span>
            </div>
            <div className="telemetry-value">Air-Gapped</div>
            <div className="telemetry-label">Zero Socket Access</div>
            <p className="telemetry-desc">
              CLONE_NEWNET unshared network namespace drops all external socket capabilities.
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
            <span className="footer-label">EXECUTION DAEMON</span>
            <span className="footer-val">Isolated Linux cgroups v2 Worker Pool</span>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
