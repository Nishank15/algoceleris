import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  provisionCampusOrg,
  CampusProvisionRequest,
  setAccessToken,
} from '../../services/api';
import { saveCampusSession } from '../../services/campusSession';
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

export const CampusOnboardingPage: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState({
    orgName: '',
    orgSlug: '',
    allowedDomains: '',
    expectedStudents: 500,
    tier: 'Enterprise Campus',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provisionedResult, setProvisionedResult] = useState<{
    orgSlug: string;
    orgName: string;
    adminEmail: string;
    portalUrl: string;
  } | null>(null);

  // Auto-generate slug from name if slug hasn't been manually edited
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormData((prev) => ({
      ...prev,
      orgName: val,
      orgSlug: generatedSlug,
    }));
  };

  const validateStep1 = () => {
    if (!formData.orgName.trim()) {
      setErrorMessage('Institution name is required.');
      return false;
    }
    if (!formData.orgSlug.trim()) {
      setErrorMessage('Institution slug identifier is required.');
      return false;
    }
    if (!formData.allowedDomains.trim()) {
      setErrorMessage('At least one institutional email domain is required (e.g. university.edu).');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const validateStep2 = () => {
    if (!formData.tier) {
      setErrorMessage('Please select a deployment tier.');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const validateStep3 = () => {
    if (!formData.adminName.trim()) {
      setErrorMessage('Lead Administrator full name is required.');
      return false;
    }
    if (!formData.adminEmail.trim() || !formData.adminEmail.includes('@')) {
      setErrorMessage('Valid institutional administrator email is required.');
      return false;
    }
    if (!formData.adminPassword || formData.adminPassword.length < 8) {
      setErrorMessage('Master password must be at least 8 characters long.');
      return false;
    }
    if (formData.adminPassword !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const domains = formData.allowedDomains
      .split(',')
      .map((d) => d.trim().replace(/^@/, ''))
      .filter((d) => d.length > 0);

    const payload: CampusProvisionRequest = {
      org_name: formData.orgName.trim(),
      org_slug: formData.orgSlug.trim(),
      admin_name: formData.adminName.trim(),
      admin_email: formData.adminEmail.trim(),
      admin_password: formData.adminPassword,
      tier: formData.tier,
      allowed_domains: domains,
      expected_students: Number(formData.expectedStudents) || 500,
      payment_ref: 'CAMPUS_PROVISION_DIRECT',
    };

    try {
      const resp = await provisionCampusOrg(payload);

      // Authenticate active session with received real token
      setAccessToken(resp.access_token);
      saveCampusSession({
        role: 'org_admin',
        orgSlug: resp.org_slug,
        orgName: resp.org_name,
        userId: resp.user.user_id,
        name: resp.user.username,
        loginId: resp.user.email,
        regNumber: resp.user.reg_number || 'ADM-001',
        department: 'Institutional Administration',
        initials: resp.user.username.slice(0, 2).toUpperCase(),
        token: resp.access_token,
        cohortId: resp.user.cohort_id,
        cohortName: resp.user.cohort_name,
      });

      setProvisionedResult({
        orgSlug: resp.org_slug,
        orgName: resp.org_name,
        adminEmail: resp.admin_email,
        portalUrl: `/campus/${resp.org_slug}/admin/dashboard`,
      });

      setStep(4);
    } catch (err: any) {
      console.error('Provisioning failed:', err);
      setErrorMessage(err.message || 'Tenant provisioning failed. Please verify unique slug.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#08090a',
        color: '#ffffff',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Top Header */}
      <div style={{ maxWidth: '680px', width: '100%', marginBottom: '32px' }}>
        <Link
          to="/campus"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#8a8f98',
            textDecoration: 'none',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={14} /> Back to Campus Directory
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: '6px',
              background: 'rgba(228, 242, 34, 0.1)',
              color: '#e4f222',
              display: 'flex',
            }}
          >
            <Building2 size={20} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 590, margin: 0, letterSpacing: '-0.02em' }}>
            Institution Provisioning Wizard
          </h1>
        </div>
        <p style={{ color: '#8a8f98', fontSize: '14px', margin: 0 }}>
          Deploy a dedicated, domain-whitelisted AlgoCeleris virtual lab cluster for your university.
        </p>

        {/* Step Progression Bar */}
        {step < 4 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '24px',
              borderBottom: '1px solid #23252a',
              paddingBottom: '16px',
            }}
          >
            {[
              { num: 1, label: 'Identity & Whitelist' },
              { num: 2, label: 'Plan & Tier' },
              { num: 3, label: 'Lead Admin' },
            ].map((s) => (
              <div
                key={s.num}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: step === s.num ? '#ffffff' : step > s.num ? '#22c55e' : '#62666d',
                  fontSize: '12px',
                  fontWeight: 510,
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background:
                      step === s.num
                        ? '#e4f222'
                        : step > s.num
                        ? '#22c55e'
                        : '#141517',
                    color: step === s.num ? '#08090a' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <span>{s.label}</span>
                {s.num < 3 && <span style={{ color: '#23252a', margin: '0 4px' }}>—</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Form Container */}
      <div
        style={{
          maxWidth: '680px',
          width: '100%',
          background: '#0f1011',
          border: '1px solid #23252a',
          borderRadius: '12px',
          padding: '36px',
          boxSizing: 'border-box',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(235, 87, 87, 0.1)',
              border: '1px solid rgba(235, 87, 87, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#eb5757',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Institution Identity & Domain Whitelist */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 590, margin: '0 0 8px 0' }}>
              1. Institutional Identity & Domain Whitelisting
            </h3>
            <p style={{ color: '#8a8f98', fontSize: '13px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Specify the university credentials and student email domains permitted to register and evaluate code.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                  Institution / University Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vellore Institute of Technology, Chennai"
                  value={formData.orgName}
                  onChange={handleNameChange}
                  style={{
                    width: '100%',
                    background: '#161718',
                    border: '1px solid #23252a',
                    borderRadius: '6px',
                    padding: '11px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                  Tenant Slug Identifier (Permanent Subpath) *
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      background: '#141517',
                      border: '1px solid #23252a',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px',
                      padding: '11px 12px',
                      color: '#62666d',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    /campus/
                  </span>
                  <input
                    type="text"
                    placeholder="vit-chennai"
                    value={formData.orgSlug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        orgSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    style={{
                      width: '100%',
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '0 6px 6px 0',
                      padding: '11px 14px',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontFamily: 'JetBrains Mono, monospace',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: '#62666d', marginTop: '4px' }}>
                  Only lowercase alphanumeric characters and hyphens allowed.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                  Allowed Student & Faculty Domains (Comma-Separated) *
                </label>
                <input
                  type="text"
                  placeholder="vitstudent.ac.in, vit.ac.in"
                  value={formData.allowedDomains}
                  onChange={(e) => setFormData({ ...formData, allowedDomains: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#161718',
                    border: '1px solid #23252a',
                    borderRadius: '6px',
                    padding: '11px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontFamily: 'JetBrains Mono, monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '11px', color: '#62666d', marginTop: '4px' }}>
                  Any student logging in with an email matching these domains will be authenticated into this tenant.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                  Estimated Active Student Enrollment
                </label>
                <input
                  type="number"
                  min="50"
                  max="50000"
                  value={formData.expectedStudents}
                  onChange={(e) => setFormData({ ...formData, expectedStudents: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    background: '#161718',
                    border: '1px solid #23252a',
                    borderRadius: '6px',
                    padding: '11px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button
                type="button"
                onClick={handleNext}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  padding: '11px 22px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 590,
                  cursor: 'pointer',
                }}
              >
                Proceed to Tier Selection <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Deployment Tier & Capacity */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 590, margin: '0 0 8px 0' }}>
              2. Select Deployment Tier & Capacity
            </h3>
            <p style={{ color: '#8a8f98', fontSize: '13px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              Choose the architectural sizing for your university's sandboxed worker daemons and cohort limits.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                {
                  tier: 'Enterprise Campus',
                  tag: 'Recommended for Universities',
                  desc: 'Unlimited cohorts, dedicated 256MB cgroup worker nodes, full ABET/NBA CLO automated attainment, and Tree-sitter AST anti-cheat.',
                  seats: '1,000+ Students · 50 Faculty',
                },
                {
                  tier: 'Department Tier',
                  tag: 'For Academic Departments',
                  desc: 'Up to 10 cohorts, pooled worker execution, real-time proctoring telemetry, and automated rubric grading.',
                  seats: 'Up to 500 Students · 20 Faculty',
                },
                {
                  tier: 'Pilot Trial',
                  tag: '30-Day Department Trial',
                  desc: 'Single cohort evaluation sandbox with 100 student seats and basic lab authoring suite.',
                  seats: '100 Students · 2 Faculty',
                },
              ].map((item) => (
                <div
                  key={item.tier}
                  onClick={() => setFormData({ ...formData, tier: item.tier })}
                  style={{
                    background: formData.tier === item.tier ? '#161718' : '#141517',
                    border: `1px solid ${formData.tier === item.tier ? '#e4f222' : '#23252a'}`,
                    borderRadius: '8px',
                    padding: '18px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: `2px solid ${formData.tier === item.tier ? '#e4f222' : '#62666d'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {formData.tier === item.tier && (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: '#e4f222',
                            }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 590, color: '#ffffff' }}>
                        {item.tier}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: formData.tier === item.tier ? '#e4f222' : '#8a8f98',
                        border: '1px solid #23252a',
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>

                  <p style={{ color: '#8a8f98', fontSize: '12px', margin: '0 0 10px 26px', lineHeight: 1.4 }}>
                    {item.desc}
                  </p>
                  <div style={{ marginLeft: '26px', fontSize: '11px', color: '#62666d', fontFamily: 'JetBrains Mono, monospace' }}>
                    {item.seats}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: 'transparent',
                  color: '#8a8f98',
                  border: '1px solid #23252a',
                  padding: '11px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleNext}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  padding: '11px 22px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 590,
                  cursor: 'pointer',
                }}
              >
                Configure Administrator <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Lead Administrator Credentials */}
        {step === 3 && (
          <form onSubmit={handleSubmit}>
            <h3 style={{ fontSize: '18px', fontWeight: 590, margin: '0 0 8px 0' }}>
              3. Lead Administrator Credentials
            </h3>
            <p style={{ color: '#8a8f98', fontSize: '13px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              This account will have full `org_admin` privileges to create academic cohorts, upload rosters, and manage faculty licenses.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                  Administrator Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Saravanan P"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#161718',
                    border: '1px solid #23252a',
                    borderRadius: '6px',
                    padding: '11px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                  Administrator Official Email *
                </label>
                <input
                  type="email"
                  placeholder="admin.cse@vit.ac.in"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#161718',
                    border: '1px solid #23252a',
                    borderRadius: '6px',
                    padding: '11px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                    Master Password (min 8 chars) *
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '6px',
                      padding: '11px 14px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 510, color: '#d0d6e0', marginBottom: '6px' }}>
                    Confirm Master Password *
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    style={{
                      width: '100%',
                      background: '#161718',
                      border: '1px solid #23252a',
                      borderRadius: '6px',
                      padding: '11px 14px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                style={{
                  background: 'transparent',
                  color: '#8a8f98',
                  border: '1px solid #23252a',
                  padding: '11px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  padding: '11px 24px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 590,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Provisioning Tenant Mesh...' : 'Deploy University Tenant Portal →'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Success Confirmation */}
        {step === 4 && provisionedResult && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e',
                margin: '0 auto 20px auto',
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: 590, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              {provisionedResult.orgName} Provisioned!
            </h2>
            <p style={{ color: '#8a8f98', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
              Your institutional tenant is online. A default 2026 cohort has been provisioned and your administrative JWT has been issued.
            </p>

            <div
              style={{
                background: '#141517',
                border: '1px solid #23252a',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'left',
                marginBottom: '28px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#8a8f98' }}>Tenant Slug:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e4f222' }}>
                  /{provisionedResult.orgSlug}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#8a8f98' }}>Administrator Login:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ffffff' }}>
                  {provisionedResult.adminEmail}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8a8f98' }}>Kernel Status:</span>
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                  cgroups v2 Isolated
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => navigate(`/campus/${provisionedResult.orgSlug}/admin/dashboard`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 590,
                  cursor: 'pointer',
                }}
              >
                Enter Admin Portal Console →
              </button>

              <button
                type="button"
                onClick={() => navigate(`/campus/${provisionedResult.orgSlug}/login`)}
                style={{
                  background: '#161718',
                  color: '#d0d6e0',
                  border: '1px solid #23252a',
                  padding: '12px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Test Institutional Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default CampusOnboardingPage;
