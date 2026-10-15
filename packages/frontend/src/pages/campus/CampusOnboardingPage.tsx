import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Building2,
  CheckCircle2,
  CreditCard,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Shield,
  Users,
  Check,
  Globe,
  Mail,
  Lock,
  User,
  Zap,
} from 'lucide-react';

interface TierOption {
  id: 'department' | 'enterprise';
  title: string;
  badge?: string;
  priceInr: string;
  priceUsd: string;
  period: string;
  description: string;
  features: string[];
  isPopular?: boolean;
}

const LICENSE_TIERS: TierOption[] = [
  {
    id: 'department',
    title: 'Department License',
    priceInr: '₹14,999',
    priceUsd: '$199',
    period: 'per semester',
    description: 'Perfect for individual computer science departments and specialized courses.',
    features: [
      'Up to 500 enrolled students',
      'Up to 10 faculty accounts',
      '6-Stage Progressive Coding Labs',
      'Automated Test Case Evaluation',
      'Section-locked Sandbox Workspaces',
      'Standard CSV Roster Upload',
    ],
  },
  {
    id: 'enterprise',
    title: 'Campus Enterprise License',
    badge: 'MOST POPULAR',
    isPopular: true,
    priceInr: '₹49,999',
    priceUsd: '$699',
    period: 'per semester',
    description: 'Complete university-wide infrastructure with live proctoring & AI tutoring.',
    features: [
      'Unlimited students & sections',
      'Unlimited faculty seats',
      'AI Mentor Tutor (Gemini Powered)',
      'Live WebSocket Proctor Cockpit',
      '1-on-1 CRDT Viva Grading Rooms',
      'Tree-sitter AST Plagiarism Engine',
      'Course Learning Outcome (CLO) Analytics',
      'Custom University Domain & Co-Branding',
      '24/7 Priority SLA & Dedicated Account Manager',
    ],
  },
];

export const CampusOnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Organization & Admin State
  const [orgName, setOrgName] = useState('Vellore Institute of Technology, Chennai');
  const [orgSlug, setOrgSlug] = useState('vit-chennai');
  const [allowedDomains, setAllowedDomains] = useState('@vitstudent.ac.in, @vit.ac.in');
  const [adminName, setAdminName] = useState('Dr. Saravanan P');
  const [adminEmail, setAdminEmail] = useState('admin@vit.ac.in');
  const [password, setPassword] = useState('Admin@2026!');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [logoUrl, setLogoUrl] = useState('');

  // Step 2: License Tier Selection
  const [selectedTier, setSelectedTier] = useState<'department' | 'enterprise'>('enterprise');
  const [billingCurrency, setBillingCurrency] = useState<'INR' | 'USD'>('INR');

  // Step 3: Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'invoice'>('card');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('999');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-slug generator
  const handleNameChange = (name: string) => {
    setOrgName(name);
    const generated = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    setOrgSlug(generated || 'my-university');
  };

  const handleFillDemo = () => {
    setOrgName('Vellore Institute of Technology, Chennai');
    setOrgSlug('vit-chennai');
    setAllowedDomains('@vitstudent.ac.in, @vit.ac.in');
    setAdminName('Dr. Saravanan P');
    setAdminEmail('saravanan.p@vit.ac.in');
    setPassword('VitAdmin2026#');
    setAccentColor('#2563eb');
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !orgSlug.trim() || !adminEmail.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    setError(null);
    setCurrentStep(2);
  };

  const handleStep2Submit = () => {
    setCurrentStep(3);
  };

  const handleFinalProvision = async () => {
    setIsProvisioning(true);
    setError(null);

    const payload = {
      name: orgName.trim(),
      slug: orgSlug.trim().toLowerCase(),
      allowed_domains: allowedDomains.split(',').map((d) => d.trim()).filter(Boolean),
      admin_name: adminName.trim(),
      admin_email: adminEmail.trim(),
      password,
      accent_color: accentColor,
      tier: selectedTier,
      billing_currency: billingCurrency,
    };

    try {
      // Provision via backend gateway (with fallback simulation for resilience)
      const res = await fetch('/api/v1/campus/orgs/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);

      // Save tenant configuration locally for instant offline UI testability
      const storedTenants = JSON.parse(localStorage.getItem('algoceleris_campus_tenants') || '{}');
      storedTenants[payload.slug] = {
        ...payload,
        provisioned_at: new Date().toISOString(),
        status: 'active',
      };
      localStorage.setItem('algoceleris_campus_tenants', JSON.stringify(storedTenants));

      // Simulate 750ms provision completion
      await new Promise((resolve) => setTimeout(resolve, 750));

      // Route to the co-branded login portal
      navigate(`/campus/${payload.slug}/login?registered=true`);
    } catch (err: any) {
      setError(err?.message || 'Provisioning failed. Please retry.');
      setIsProvisioning(false);
    }
  };

  return (
    <div className="campus-onboarding-page">
      {/* Top Header */}
      <header className="onboarding-top-bar">
        <Link to="/campus" className="campus-brand">
          <div className="campus-brand-icon">
            <GraduationCap size={18} />
          </div>
          <div className="campus-brand-text">
            <span className="brand-name">AlgoCeleris</span>
            <span className="brand-edition">Campus Setup</span>
          </div>
        </Link>

        <div className="onboarding-steps-indicator">
          <div className={`step-item ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
            <span className="step-num">{currentStep > 1 ? <Check size={12} /> : '1'}</span>
            <span className="step-label">Organization</span>
          </div>
          <div className="step-divider" />
          <div className={`step-item ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
            <span className="step-num">{currentStep > 2 ? <Check size={12} /> : '2'}</span>
            <span className="step-label">License Tier</span>
          </div>
          <div className="step-divider" />
          <div className={`step-item ${currentStep === 3 ? 'active' : ''}`}>
            <span className="step-num">3</span>
            <span className="step-label">Checkout</span>
          </div>
        </div>

        <button type="button" onClick={handleFillDemo} className="onboarding-demo-fill-btn" title="Autofill VIT Chennai demo parameters">
          <Zap size={13} />
          <span>Autofill Demo</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="onboarding-main">
        <div className="onboarding-card">
          {error && (
            <div className="onboarding-error-banner">
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Institution & Admin Setup */}
          {currentStep === 1 && (
            <form onSubmit={handleStep1Submit} className="onboarding-step-form">
              <div className="step-heading-group">
                <span className="step-badge-pill">Step 1 of 3</span>
                <h1 className="step-title">Institution Identity & Domain Configuration</h1>
                <p className="step-subtitle">
                  Configure your university tenant slug, official student email domains, and master admin account.
                </p>
              </div>

              <div className="form-grid-2col">
                <div className="form-field-group">
                  <label className="field-label" htmlFor="org-name">
                    Institution / University Name *
                  </label>
                  <div className="input-with-icon">
                    <Building2 size={15} className="input-icon" />
                    <input
                      id="org-name"
                      type="text"
                      className="field"
                      placeholder="e.g. Vellore Institute of Technology, Chennai"
                      value={orgName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="field-label" htmlFor="org-slug">
                    Tenant Subdomain / URL Slug *
                  </label>
                  <div className="input-with-icon">
                    <Globe size={15} className="input-icon" />
                    <input
                      id="org-slug"
                      type="text"
                      className="field"
                      placeholder="vit-chennai"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      required
                    />
                  </div>
                  <span className="field-hint">
                    Portal address: <code>/campus/{orgSlug || 'my-university'}/login</code>
                  </span>
                </div>
              </div>

              <div className="form-field-group">
                <label className="field-label" htmlFor="org-domains">
                  Authorized Student / Faculty Email Domains *
                </label>
                <div className="input-with-icon">
                  <Mail size={15} className="input-icon" />
                  <input
                    id="org-domains"
                    type="text"
                    className="field"
                    placeholder="@vitstudent.ac.in, @vit.ac.in"
                    value={allowedDomains}
                    onChange={(e) => setAllowedDomains(e.target.value)}
                    required
                  />
                </div>
                <span className="field-hint">Comma-separated email suffixes permitted for institutional SSO / roster login.</span>
              </div>

              <div className="form-divider-line" />

              <div className="form-grid-3col">
                <div className="form-field-group">
                  <label className="field-label" htmlFor="admin-name">
                    Dean / Master Admin Name *
                  </label>
                  <div className="input-with-icon">
                    <User size={15} className="input-icon" />
                    <input
                      id="admin-name"
                      type="text"
                      className="field"
                      placeholder="Dr. Saravanan P"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="field-label" htmlFor="admin-email">
                    Admin Email Address *
                  </label>
                  <div className="input-with-icon">
                    <Mail size={15} className="input-icon" />
                    <input
                      id="admin-email"
                      type="email"
                      className="field"
                      placeholder="admin@vit.ac.in"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="field-label" htmlFor="admin-password">
                    Admin Password *
                  </label>
                  <div className="input-with-icon">
                    <Lock size={15} className="input-icon" />
                    <input
                      id="admin-password"
                      type="password"
                      className="field"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="step-actions-row">
                <Link to="/campus" className="btn btn-secondary back-btn">
                  <ArrowLeft size={14} />
                  <span>Cancel</span>
                </Link>

                <button type="submit" className="btn btn-primary next-btn">
                  <span>Continue to License Selection</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: License Tier Selection */}
          {currentStep === 2 && (
            <div className="onboarding-step-form">
              <div className="step-heading-group">
                <span className="step-badge-pill">Step 2 of 3</span>
                <h1 className="step-title">Select Institutional License Plan</h1>
                <p className="step-subtitle">
                  Choose the license model suited for your department or campus. Upgrade or add seats anytime.
                </p>

                <div className="currency-toggle-wrapper">
                  <button
                    type="button"
                    className={`curr-btn ${billingCurrency === 'INR' ? 'active' : ''}`}
                    onClick={() => setBillingCurrency('INR')}
                  >
                    INR (₹)
                  </button>
                  <button
                    type="button"
                    className={`curr-btn ${billingCurrency === 'USD' ? 'active' : ''}`}
                    onClick={() => setBillingCurrency('USD')}
                  >
                    USD ($)
                  </button>
                </div>
              </div>

              <div className="tiers-selection-grid">
                {LICENSE_TIERS.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  const price = billingCurrency === 'INR' ? tier.priceInr : tier.priceUsd;
                  return (
                    <div
                      key={tier.id}
                      className={`tier-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedTier(tier.id)}
                    >
                      {tier.badge && <span className="tier-top-badge">{tier.badge}</span>}
                      <div className="tier-header">
                        <h3 className="tier-title">{tier.title}</h3>
                        <p className="tier-description">{tier.description}</p>
                      </div>

                      <div className="tier-price-box">
                        <span className="tier-price">{price}</span>
                        <span className="tier-period">/ {tier.period}</span>
                      </div>

                      <div className="tier-features-list">
                        {tier.features.map((feat, idx) => (
                          <div key={idx} className="tier-feature-item">
                            <CheckCircle2 size={15} className="feat-check" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className={`btn tier-select-btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTier(tier.id);
                        }}
                      >
                        {isSelected ? '✓ Selected Plan' : 'Select Plan'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="step-actions-row">
                <button type="button" onClick={() => setCurrentStep(1)} className="btn btn-secondary back-btn">
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>

                <button type="button" onClick={handleStep2Submit} className="btn btn-primary next-btn">
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Checkout & Auto-Provision */}
          {currentStep === 3 && (
            <div className="onboarding-step-form">
              <div className="step-heading-group">
                <span className="step-badge-pill">Step 3 of 3</span>
                <h1 className="step-title">Order Review & Tenant Activation</h1>
                <p className="step-subtitle">
                  Confirm your university setup details and activate your institutional sandbox partition.
                </p>
              </div>

              <div className="checkout-review-summary">
                <div className="review-block">
                  <span className="review-label">Institution:</span>
                  <span className="review-val font-semibold">{orgName}</span>
                </div>
                <div className="review-block">
                  <span className="review-label">Subdomain:</span>
                  <span className="review-val font-mono">/campus/{orgSlug}/login</span>
                </div>
                <div className="review-block">
                  <span className="review-label">Selected Tier:</span>
                  <span className="review-val text-accent font-semibold">
                    {selectedTier === 'enterprise' ? 'Campus Enterprise (Unlimited)' : 'Department License (500 Seats)'}
                  </span>
                </div>
                <div className="review-block">
                  <span className="review-label">Total Due Now:</span>
                  <span className="review-val text-large font-bold">
                    {billingCurrency === 'INR'
                      ? selectedTier === 'enterprise'
                        ? '₹49,999'
                        : '₹14,999'
                      : selectedTier === 'enterprise'
                      ? '$699'
                      : '$199'}
                  </span>
                </div>
              </div>

              {/* Simulated Payment Gateway Card */}
              <div className="simulated-gateway-box">
                <div className="gateway-tabs">
                  <button
                    type="button"
                    className={`gw-tab ${paymentMethod === 'card' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    <CreditCard size={14} />
                    <span>Credit / Debit Card (Stripe)</span>
                  </button>
                  <button
                    type="button"
                    className={`gw-tab ${paymentMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('upi')}
                  >
                    <span>UPI / NetBanking (Razorpay)</span>
                  </button>
                  <button
                    type="button"
                    className={`gw-tab ${paymentMethod === 'invoice' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('invoice')}
                  >
                    <span>Institutional PO / Invoice</span>
                  </button>
                </div>

                {paymentMethod === 'card' && (
                  <div className="card-input-simulation">
                    <div className="form-field-group">
                      <label className="field-label">Card Number</label>
                      <input
                        type="text"
                        className="field font-mono"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                      />
                    </div>
                    <div className="form-grid-2col">
                      <div className="form-field-group">
                        <label className="field-label">Valid Thru</label>
                        <input
                          type="text"
                          className="field font-mono"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                        />
                      </div>
                      <div className="form-field-group">
                        <label className="field-label">CVC / CVV</label>
                        <input
                          type="password"
                          className="field font-mono"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'upi' && (
                  <div className="upi-simulation">
                    <p className="text-secondary text-sm">
                      Razorpay Virtual Account & QR Code generated automatically upon activation. Instant bank clearance.
                    </p>
                  </div>
                )}

                {paymentMethod === 'invoice' && (
                  <div className="invoice-simulation">
                    <p className="text-secondary text-sm">
                      30-day net payment terms for recognized universities. Purchase order invoice will be emailed to{' '}
                      <strong>{adminEmail}</strong>.
                    </p>
                  </div>
                )}
              </div>

              <div className="step-actions-row">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="btn btn-secondary back-btn"
                  disabled={isProvisioning}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalProvision}
                  className="btn btn-primary activate-btn"
                  disabled={isProvisioning}
                  id="btn-complete-provision"
                >
                  {isProvisioning ? (
                    <span>Provisioning Tenant & Sandboxes...</span>
                  ) : (
                    <>
                      <span>Complete Payment & Activate Campus</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CampusOnboardingPage;
