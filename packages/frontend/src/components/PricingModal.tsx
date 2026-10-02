import React, { useState, useEffect } from 'react';
import { X, Check, Zap, Sparkles, Shield, CreditCard, ArrowRight } from 'lucide-react';
import { SubscriptionTier, Currency } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  onUpgradeStripe: () => void;
  onUpgradeRazorpay: () => void;
  isProcessing?: boolean;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onUpgradeStripe,
  onUpgradeRazorpay,
  isProcessing = false,
}) => {
  const [currency, setCurrency] = useState<Currency>('USD');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="pricing-header">
          <div className="pricing-badge">
            <Sparkles size={14} />
            <span>CLOUD-JUDGE SUBSCRIPTIONS</span>
          </div>
          <h2 className="pricing-title">Level Up to Cloud-Judge Pro</h2>
          <p className="pricing-subtitle">
            Get instant access to ultra-low latency execution queues, intelligent AI code fixes, and plagiarism audits.
          </p>

          {/* Currency Toggle */}
          <div className="currency-toggle">
            <button
              className={`currency-btn ${currency === 'USD' ? 'active' : ''}`}
              onClick={() => setCurrency('USD')}
            >
              $ USD (Global)
            </button>
            <button
              className={`currency-btn ${currency === 'INR' ? 'active' : ''}`}
              onClick={() => setCurrency('INR')}
            >
              ₹ INR (India & UPI)
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="pricing-grid">
          {/* Free Tier Card */}
          <div className={`pricing-card ${currentTier === 'free' ? 'is-current' : ''}`}>
            <div className="card-top">
              <span className="tier-name">Free Developer</span>
              <div className="tier-price">
                <span className="price-amount">{currency === 'USD' ? '$0' : '₹0'}</span>
                <span className="price-cycle">/ month</span>
              </div>
              <p className="tier-tagline">Essential sandbox judge for casual practice and learning.</p>
            </div>

            <div className="tier-divider" />

            <ul className="feature-list">
              <li>
                <Check size={16} className="feature-icon" />
                <span>Standard execution queue</span>
              </li>
              <li>
                <Check size={16} className="feature-icon" />
                <span>5 submissions per minute</span>
              </li>
              <li>
                <Check size={16} className="feature-icon" />
                <span>Basic error stdout/stderr output</span>
              </li>
              <li>
                <Check size={16} className="feature-icon" />
                <span>Access to all public contests</span>
              </li>
              <li className="feature-disabled">
                <span className="dash-icon">—</span>
                <span>AI Debugging Assistant (Pro only)</span>
              </li>
              <li className="feature-disabled">
                <span className="dash-icon">—</span>
                <span>Plagiarism immunity pre-check</span>
              </li>
            </ul>

            <button className="btn btn-secondary card-btn" disabled>
              {currentTier === 'free' ? 'Current Plan' : 'Free Tier'}
            </button>
          </div>

          {/* Pro Tier Card */}
          <div className={`pricing-card pro-card ${currentTier === 'pro' ? 'is-current' : ''}`}>
            <div className="pro-pill-glow">MOST POPULAR</div>

            <div className="card-top">
              <div className="pro-title-row">
                <span className="tier-name pro-gradient-text">Pro Master</span>
                <Zap size={18} className="zap-icon" />
              </div>
              <div className="tier-price">
                <span className="price-amount">
                  {currency === 'USD' ? '$19' : '₹1,499'}
                </span>
                <span className="price-cycle">/ month</span>
              </div>
              <p className="tier-tagline">
                Hardened infrastructure & AI co-pilot for serious competitive coders.
              </p>
            </div>

            <div className="tier-divider" />

            <ul className="feature-list">
              <li>
                <Check size={16} className="feature-icon pro-check" />
                <strong>Priority Execution Fast-Lane Queue</strong>
              </li>
              <li>
                <Check size={16} className="feature-icon pro-check" />
                <strong>Unlimited Submissions (No throttling)</strong>
              </li>
              <li>
                <Check size={16} className="feature-icon pro-check" />
                <strong>Gemini 2.5 Flash AI Debug Assistant</strong>
              </li>
              <li>
                <Check size={16} className="feature-icon pro-check" />
                <strong>Deep Memory & CPU Telemetry Profiling</strong>
              </li>
              <li>
                <Check size={16} className="feature-icon pro-check" />
                <strong>AST Plagiarism Immunity Pre-Check</strong>
              </li>
              <li>
                <Check size={16} className="feature-icon pro-check" />
                <strong>Exclusive Rated Contests & Badges</strong>
              </li>
            </ul>

            {currentTier === 'pro' ? (
              <button className="btn btn-secondary card-btn active-pro-btn" disabled>
                <Shield size={16} /> Active Pro Member
              </button>
            ) : (
              <div className="dual-checkout-buttons">
                {/* Stripe Checkout */}
                <button
                  className="btn btn-primary stripe-checkout-btn"
                  onClick={onUpgradeStripe}
                  disabled={isProcessing}
                >
                  <CreditCard size={15} />
                  <span>{isProcessing ? 'Connecting...' : 'Upgrade with Stripe'}</span>
                  <ArrowRight size={14} />
                </button>

                {/* Razorpay Checkout */}
                <button
                  className="btn btn-secondary razorpay-checkout-btn"
                  onClick={onUpgradeRazorpay}
                  disabled={isProcessing}
                >
                  <span>Pay with Razorpay (UPI / NetBanking)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
