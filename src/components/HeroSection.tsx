import React from 'react';
import { ArrowRight, Network, BadgeCheck } from 'lucide-react';
import { RoleSelectionPanel } from './RoleSelectionPanel';
import type { RoleId, RoleOption } from '../types';

interface HeroSectionProps {
  selectedRole: RoleId | null;
  onRoleSelect: (id: RoleId) => void;
  onContinue: (role: RoleOption) => void;
  onExploreClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  selectedRole,
  onRoleSelect,
  onContinue,
  onExploreClick,
}) => {
  return (
    <main className="hero-main-section" id="hero" role="main">
      <div className="page-container">
        <div className="hero-grid">
          {/* ========== LEFT: Brand/Copy Column ========== */}
          <div className="hero-content-column">
            {/* Eyebrow Label */}
            <div className="hero-eyebrow" aria-label="Tagline">
              <div className="hero-eyebrow-accent" aria-hidden="true" />
              <span className="hero-eyebrow-text">Your Career. Your Proof.</span>
            </div>

            {/* Main Heading */}
            <h1 className="hero-heading">
              Your skills deserve
              <br />
              to be{' '}
              <span className="hero-heading-highlight">more than words.</span>
            </h1>

            {/* Supporting Description */}
            <p className="hero-description">
              Build your professional profile, connect with opportunities, and
              turn your capabilities into credible proof with YOGYATA.
            </p>

            {/* Trust Statements */}
            <div
              className="hero-trust-statements"
              aria-label="Platform highlights"
            >
              <div className="trust-item">
                <span className="trust-item-icon-wrapper" aria-hidden="true">
                  <Network size={12} strokeWidth={2} />
                </span>
                <span>One connected ecosystem</span>
              </div>
              <div className="trust-item">
                <span className="trust-item-icon-wrapper" aria-hidden="true">
                  <BadgeCheck size={12} strokeWidth={2} />
                </span>
                <span>Skills backed by evidence</span>
              </div>
            </div>

            {/* Explore CTA Link */}
            <button
              type="button"
              className="hero-explore-link"
              onClick={onExploreClick}
              id="explore-how-it-works-link"
            >
              <span>Explore how YOGYATA works</span>
              <ArrowRight
                size={16}
                className="hero-explore-arrow"
                aria-hidden="true"
              />
            </button>
          </div>

          {/* ========== RIGHT: Role Selection Card ========== */}
          <RoleSelectionPanel
            selectedRole={selectedRole}
            onRoleSelect={onRoleSelect}
            onContinue={onContinue}
          />
        </div>
      </div>
    </main>
  );
};
