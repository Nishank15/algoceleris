import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  Shield,
  Sparkles,
  Code2,
  Users,
  ArrowRight,
  CheckCircle2,
  Search,
  BookOpen,
  Cpu,
  Award,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface InstitutionPreset {
  name: string;
  slug: string;
  domain: string;
  location: string;
  accent: string;
  badge: string;
}

const FEATURED_INSTITUTIONS: InstitutionPreset[] = [
  {
    name: 'Vellore Institute of Technology, Chennai',
    slug: 'vit-chennai',
    domain: 'vit-chennai.algoceleris.dev',
    location: 'Chennai, Tamil Nadu',
    accent: '#3b82f6',
    badge: 'VIT Chennai',
  },
  {
    name: 'Indian Institute of Technology, Madras',
    slug: 'iitm',
    domain: 'iitm.algoceleris.dev',
    location: 'Chennai, Tamil Nadu',
    accent: '#f59e0b',
    badge: 'IIT Madras',
  },
  {
    name: 'National Institute of Technology, Tiruchirappalli',
    slug: 'nitt',
    domain: 'nitt.algoceleris.dev',
    location: 'Tiruchirappalli, Tamil Nadu',
    accent: '#10b981',
    badge: 'NIT Trichy',
  },
];

export const CampusLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedOrg, setSelectedOrg] = useState<string>('vit-chennai');
  const [customSlug, setCustomSlug] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const handleLaunchPortal = (orgSlug: string) => {
    const slug = (orgSlug || 'vit-chennai').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    navigate(`/campus/${slug}/login`);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSlug.trim()) {
      handleLaunchPortal(customSlug);
    }
  };

  return (
    <div className="campus-landing-page">
      {/* Top Standalone Institutional Header */}
      <header className="campus-nav-header">
        <div className="campus-nav-container">
          <Link to="/campus" className="campus-brand">
            <div className="campus-brand-icon">
              <GraduationCap size={20} />
            </div>
            <div className="campus-brand-text">
              <span className="brand-name">AlgoCeleris</span>
              <span className="brand-edition">Campus</span>
            </div>
          </Link>

          <nav className="campus-nav-links">
            <a href="#capabilities" className="campus-nav-link">Capabilities</a>
            <a href="#pedagogy" className="campus-nav-link">LPilot Workflow</a>
            <a href="#directory" className="campus-nav-link">Directory</a>
          </nav>

          <div className="campus-nav-actions">
            <Link to="/campus/vit-chennai/login" className="btn btn-secondary campus-nav-btn">
              <span>Sign In</span>
            </Link>
            <Link to="/campus/register" className="btn btn-primary campus-cta-btn">
              <span>Provision University</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Blueprint Grid */}
      <section className="campus-hero-section">
        <div className="campus-blueprint-overlay" />
        <div className="campus-hero-content">
          <div className="campus-hero-badge">
            <Sparkles size={13} className="badge-sparkle" />
            <span>AlgoCeleris Campus · AI Co-Pilot for Programming Labs</span>
          </div>

          <h1 className="campus-hero-headline">
            The lab management system built for{' '}
            <span className="hero-gradient-text">engineering education</span>
          </h1>

          <p className="campus-hero-subhead">
            Combines progressive learning workflows, automated evaluation, section-locked code
            sandboxes, and AI-assisted tutoring into a single platform for faculty and students.
          </p>

          {/* Tenant Gateway Card */}
          <div className="campus-tenant-card" id="directory">
            <div className="tenant-card-header">
              <Building2 size={16} className="tenant-icon" />
              <span>Select Your University Campus Portal</span>
            </div>

            <div className="tenant-preset-pills">
              {FEATURED_INSTITUTIONS.map((inst) => {
                const isSelected = selectedOrg === inst.slug;
                return (
                  <button
                    key={inst.slug}
                    type="button"
                    className={`tenant-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedOrg(inst.slug)}
                    style={{
                      borderColor: isSelected ? inst.accent : undefined,
                    }}
                  >
                    <span className="pill-dot" style={{ background: inst.accent }} />
                    <span className="pill-name">{inst.badge}</span>
                    <span className="pill-domain">({inst.domain})</span>
                  </button>
                );
              })}
            </div>

            <div className="tenant-action-row">
              <button
                type="button"
                className="btn btn-primary tenant-signin-btn"
                onClick={() => handleLaunchPortal(selectedOrg)}
                id="btn-sign-in-institution"
              >
                <span>Sign in to Institution Portal</span>
                <ArrowRight size={16} />
              </button>

              <Link to="/campus/register" className="btn btn-secondary tenant-register-btn" id="btn-provision-univ">
                <span>Provision Your University</span>
              </Link>
            </div>

            {/* Custom Slug Lookup */}
            <form onSubmit={handleCustomSubmit} className="tenant-custom-form">
              <div className="tenant-custom-input-wrapper">
                <Search size={14} className="tenant-search-icon" />
                <input
                  type="text"
                  placeholder="Or enter your custom campus slug (e.g. vit-chennai, iitm, srm-ktr)..."
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="tenant-custom-input"
                />
              </div>
              <button type="submit" className="tenant-custom-btn" disabled={!customSlug.trim()}>
                <span>Go</span>
                <ChevronRight size={13} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 6-Stage LPilot Pedagogical Architecture */}
      <section className="campus-pedagogy-section" id="pedagogy">
        <div className="campus-section-container">
          <div className="section-header-center">
            <span className="section-eyebrow">Pedagogical Framework</span>
            <h2 className="section-title">The 6-Stage Progressive Lab Workflow</h2>
            <p className="section-subtitle">
              Engineered for accredited engineering curricula (NBA & ABET), guiding students step-by-step
              from foundational concepts to complex system design.
            </p>
          </div>

          <div className="pedagogy-grid">
            <div className="pedagogy-card">
              <div className="pedagogy-step-badge">Stage 01</div>
              <div className="pedagogy-icon-box">
                <BookOpen size={20} />
              </div>
              <h3 className="pedagogy-title">Content & Theory Notes</h3>
              <p className="pedagogy-desc">
                Structured reference documentation and interactive embedded PDFs providing essential
                theoretical context before coding begins.
              </p>
            </div>

            <div className="pedagogy-card">
              <div className="pedagogy-step-badge">Stage 02</div>
              <div className="pedagogy-icon-box">
                <Code2 size={20} />
              </div>
              <h3 className="pedagogy-title">Demonstration Problems</h3>
              <p className="pedagogy-desc">
                Fully worked examples with step-by-step logic traces, annotated algorithmic patterns,
                and runtime complexity breakdowns.
              </p>
            </div>

            <div className="pedagogy-card">
              <div className="pedagogy-step-badge">Stage 03</div>
              <div className="pedagogy-icon-box">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="pedagogy-title">LED Concept Quizzes</h3>
              <p className="pedagogy-desc">
                10-question auto-graded interactive MCQs verifying syntax mastery and edge-case
                intuition before the student touches the editor.
              </p>
            </div>

            <div className="pedagogy-card">
              <div className="pedagogy-step-badge">Stage 04</div>
              <div className="pedagogy-icon-box">
                <Shield size={20} />
              </div>
              <h3 className="pedagogy-title">Practice (Section-Locked)</h3>
              <p className="pedagogy-desc">
                Debugging and problem-solving exercises with read-only header/driver sections, forcing
                clean modular implementations in isolated sandboxes.
              </p>
            </div>

            <div className="pedagogy-card">
              <div className="pedagogy-step-badge">Stage 05</div>
              <div className="pedagogy-icon-box">
                <Cpu size={20} />
              </div>
              <h3 className="pedagogy-title">Challenging & Architecture</h3>
              <p className="pedagogy-desc">
                Advanced concurrency and algorithm problems requiring structured pseudocode notes, UML/flowchart
                PDF uploads, and rigorous private test suites.
              </p>
            </div>

            <div className="pedagogy-card">
              <div className="pedagogy-step-badge">Stage 06</div>
              <div className="pedagogy-icon-box">
                <Award size={20} />
              </div>
              <h3 className="pedagogy-title">Submit & Evaluation Gate</h3>
              <p className="pedagogy-desc">
                Automated completion checklist enforcing 100% stage fulfillment, computing marks breakdown,
                and recording AST plagiarism hashes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Platform Capabilities */}
      <section className="campus-capabilities-section" id="capabilities">
        <div className="campus-section-container">
          <div className="section-header-center">
            <span className="section-eyebrow">Enterprise Capabilities</span>
            <h2 className="section-title">Built for Professors, Students & Deans</h2>
            <p className="section-subtitle">
              Role-based access control protecting academic integrity while delivering modern developer tooling.
            </p>
          </div>

          <div className="capabilities-grid">
            <div className="capability-card">
              <div className="capability-icon">
                <Users size={22} />
              </div>
              <h3>Strict 3-Tier Hierarchy</h3>
              <p>
                Complete separation of roles: <strong>Students</strong> view only enrolled labs & analytics,{' '}
                <strong>Faculty</strong> author 6-stage labs & monitor live proctors, and{' '}
                <strong>Org Admins</strong> oversee billing & rosters.
              </p>
            </div>

            <div className="capability-card">
              <div className="capability-icon">
                <Shield size={22} />
              </div>
              <h3>Live Proctoring & Anti-Cheat</h3>
              <p>
                Real-time WebSocket telemetry tracking fullscreen escapes, copy-paste events, and Tree-sitter
                AST winnowing for cross-cohort plagiarism detection.
              </p>
            </div>

            <div className="capability-card">
              <div className="capability-icon">
                <Sparkles size={22} />
              </div>
              <h3>AI Mentor Tutor</h3>
              <p>
                Integrated Gemini AI assistant configured to provide pedagogical hints, error diagnostics,
                and concept reminders without leaking direct answers.
              </p>
            </div>

            <div className="capability-card">
              <div className="capability-icon">
                <Award size={22} />
              </div>
              <h3>CLO & Outcome Analytics</h3>
              <p>
                Map every coding exercise and MCQ directly to Course Learning Outcomes (CLOs) with instant
                attainment dashboards for university accreditation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="campus-bottom-banner">
        <div className="banner-inner">
          <div className="banner-copy">
            <h2>Ready to transform your university's programming labs?</h2>
            <p>Self-serve onboarding in under 3 minutes. Department and enterprise tier licenses available.</p>
          </div>
          <div className="banner-actions">
            <Link to="/campus/register" className="btn btn-primary banner-cta">
              <span>Register & Provision Institution</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/campus/vit-chennai/login" className="btn btn-secondary banner-signin">
              <span>Demo Login (VIT Chennai)</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="campus-footer">
        <div className="campus-footer-container">
          <div className="footer-left">
            <span className="footer-brand">AlgoCeleris Campus</span>
            <span className="footer-copyright">&copy; 2026 Cloud-Judge V2. All rights reserved.</span>
          </div>
          <div className="footer-right">
            <Link to="/" className="footer-link">Consumer Platform</Link>
            <Link to="/problems" className="footer-link">Problem Catalog</Link>
            <Link to="/campus/register" className="footer-link">Institution Onboarding</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CampusLandingPage;
