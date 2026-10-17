import React, { useState } from 'react';
import type { FounderOnboardingView } from './types';
import { FounderProgressIndicator } from './FounderProgressIndicator';
import { Modal } from '../components/Modal';
import { Lightbulb, RotateCcw } from 'lucide-react';

interface FounderOnboardingLayoutProps {
  currentView: FounderOnboardingView;
  onExit: () => void;
  onStageClick?: (view: FounderOnboardingView) => void;
  isEditingFromReview?: boolean;
  onReturnToReview?: () => void;
  draftRestoredTime?: string | null;
  imageOmittedNotice?: boolean;
  onResetDraft?: () => void;
  children: React.ReactNode;
}

export const FounderOnboardingLayout: React.FC<FounderOnboardingLayoutProps> = ({
  currentView,
  onExit,
  onStageClick,
  isEditingFromReview,
  onReturnToReview,
  draftRestoredTime,
  imageOmittedNotice,
  onResetDraft,
  children,
}) => {
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const showProgress = currentView !== 'complete';
  const showReviewEditBanner = Boolean(isEditingFromReview && currentView !== 'review' && currentView !== 'complete');

  return (
    <div className="ob-root">
      {/* ── Onboarding Header ── */}
      <header className="ob-header" role="banner">
        <div className="ob-header-inner">
          {/* Brand */}
          <button
            type="button"
            className="brand-link ob-brand-link"
            onClick={onExit}
            aria-label="YOGYATA – return to home"
          >
            <div className="brand-emblem-wrapper ob-emblem" aria-hidden="true">
              <svg
                className="brand-emblem-svg"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2.5L19 6V11.5C19 16 16 19.3 12 21.5C8 19.3 5 16 5 11.5V6L12 2.5Z"
                  fill="#465FA8"
                />
                <path
                  d="M10.8 14.5L8.5 12.2L9.6 11.1L10.8 12.3L14.4 8.7L15.5 9.8L10.8 14.5Z"
                  fill="#FFC936"
                />
              </svg>
            </div>
            <div className="brand-text-group">
              <span className="brand-title">YOGYATA</span>
              <span className="brand-tagline-sub">Skills You Can Prove</span>
            </div>
          </button>

          {/* Centre: Role Badge */}
          <div className="ob-role-badge ob-role-badge-founder" aria-label="Current role: Founder / Entrepreneur">
            <Lightbulb size={13} aria-hidden="true" />
            <span>Founder / Entrepreneur</span>
          </div>

          {/* Right: Save and exit */}
          <div className="ob-header-actions">
            <button
              type="button"
              className="ob-exit-btn"
              onClick={onExit}
              id="founder-save-exit-btn"
            >
              Save & exit
            </button>
          </div>
        </div>
      </header>

      {/* ── Optional Draft Restored Banner ── */}
      {draftRestoredTime && currentView !== 'complete' && (
        <div className="ob-draft-banner-wrap" role="status">
          <div className="ob-draft-banner-inner">
            <span className="ob-draft-banner-text">
              Restored saved onboarding progress from {draftRestoredTime}.
              {imageOmittedNotice ? ' (Photo/logo preserved in memory for this session)' : ''}
            </span>
            {onResetDraft && (
              <button
                type="button"
                className="ob-draft-reset-btn"
                onClick={onResetDraft}
                id="founder-reset-draft-btn"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Reset & start fresh</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Progress Bar ── */}
      {showProgress && (
        <div className="ob-progress-bar-wrap">
          <div className="ob-progress-bar-inner">
            <FounderProgressIndicator
              currentView={currentView}
              onStageClick={onStageClick}
            />
          </div>
        </div>
      )}

      {/* ── Review Edit Banner ── */}
      {showReviewEditBanner && (
        <div className="ob-review-edit-banner-wrap">
          <div className="ob-review-edit-banner" role="status">
            <div className="ob-review-edit-banner-left">
              <span className="ob-review-edit-pill">Review Edit Mode</span>
              <span className="ob-review-edit-text">
                Updating details from your Review screen. All other sections are safely preserved.
              </span>
            </div>
            {onReturnToReview && (
              <button
                type="button"
                className="ob-review-return-btn"
                onClick={onReturnToReview}
                id="banner-return-to-review-btn"
              >
                <span>Return to Review →</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step Content ── */}
      <main className="ob-main" id="main-content" role="main">
        <div className="ob-main-inner">
          {children}
        </div>
      </main>

      {/* ── Footer with Accessible Modal Triggers ── */}
      <footer className="ob-footer" role="contentinfo">
        <span>© 2025 YOGYATA. All rights reserved.</span>
        <span className="ob-footer-sep" aria-hidden="true">·</span>
        <button
          type="button"
          className="ob-footer-link-btn"
          onClick={() => setLegalModal('privacy')}
          id="founder-footer-privacy-btn"
        >
          Privacy Policy
        </button>
        <span className="ob-footer-sep" aria-hidden="true">·</span>
        <button
          type="button"
          className="ob-footer-link-btn"
          onClick={() => setLegalModal('terms')}
          id="founder-footer-terms-btn"
        >
          Terms of Service
        </button>
      </footer>

      {/* ── Legal Modals ── */}
      {legalModal === 'privacy' && (
        <Modal
          title="Privacy Policy (Prototype)"
          onClose={() => setLegalModal(null)}
        >
          <div className="legal-modal-content">
            <div className="ob-info-notice ob-notice-warning" style={{ marginBottom: '16px' }}>
              <strong>Prototype Notice:</strong> This privacy summary describes data handling for this development milestone. Official legal documentation will govern production deployments.
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              1. Information We Collect
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '14px' }}>
              We collect your full name, work email address, professional title, location, venture details, business objectives, and talent requirements to facilitate matching with capable contributors.
            </p>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              2. Credentials & Prototype Security
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '14px' }}>
              Passwords and verification OTPs are strictly client-side prototype values. They are never stored in browser local storage and never transmitted to third parties in this phase.
            </p>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              3. Stealth vs. Discoverable Ventures
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '14px' }}>
              Founders retain complete control over visibility. In Stealth Mode, your project scope is restricted to contributors you explicitly invite. In Discoverable mode, verified candidates with matching Skill Passports can discover your practical challenges.
            </p>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              4. Local Session Storage
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
              Non-sensitive form inputs are saved in your browser's local storage so you do not lose progress if you refresh. You can clear this stored draft at any time using the "Reset & start fresh" button.
            </p>
          </div>
        </Modal>
      )}

      {legalModal === 'terms' && (
        <Modal
          title="Terms of Service (Prototype)"
          onClose={() => setLegalModal(null)}
        >
          <div className="legal-modal-content">
            <div className="ob-info-notice ob-notice-warning" style={{ marginBottom: '16px' }}>
              <strong>Prototype Notice:</strong> These terms define community and participation principles for the YOGYATA prototype and require formal legal certification before public launch.
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              1. Ecosystem Roles
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '14px' }}>
              Founders participate in YOGYATA to formulate challenges, discover talent, and match with contributors who prove their abilities through verified practical work.
            </p>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              2. Transparency in Opportunities
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '14px' }}>
              Founders agree to clearly disclose compensation arrangements (Paid, Unpaid/Learning, or Equity/To Be Discussed) and provide objective criteria when creating project tasks.
            </p>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              3. Intellectual Property Rights
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5, marginBottom: '14px' }}>
              Founders retain ownership of proprietary company specifications and materials. Contributor work submissions are subject to agreed project licenses before task commencement.
            </p>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
              4. Milestone Prototype Disclaimer
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
              This release represents a frontend functional milestone. Real transaction processing, candidate vetting, and contractual agreements will be activated in subsequent platform phases.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
