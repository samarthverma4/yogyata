import React, { useState } from 'react';
import { Building2, LogOut, Sparkles } from 'lucide-react';
import { RecruiterProgressIndicator } from './RecruiterProgressIndicator';
import type { RecruiterOnboardingStep } from './types';

interface RecruiterOnboardingLayoutProps {
  currentStep: RecruiterOnboardingStep;
  onStepClick?: (step: RecruiterOnboardingStep) => void;
  onExit: () => void;
  onSignInClick?: () => void;
  children: React.ReactNode;
}

export const RecruiterOnboardingLayout: React.FC<RecruiterOnboardingLayoutProps> = ({
  currentStep,
  onStepClick,
  onExit,
  onSignInClick,
  children,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  return (
    <div className="founder-onboarding-shell">
      {/* Top Header */}
      <header className="founder-onboarding-header">
        <div className="founder-header-inner">
          <div className="founder-logo-area">
            <span className="founder-brand-name">YOGYATA</span>
            <span
              className="badge"
              style={{
                background: '#F0FDF4',
                color: '#15803D',
                border: '1px solid #BBF7D0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
              }}
            >
              <Building2 size={12} />
              Recruiter Onboarding
            </span>
          </div>

          <div className="founder-header-actions">
            {onSignInClick && (
              <button
                type="button"
                className="btn-ghost"
                onClick={onSignInClick}
                style={{ fontSize: '0.8125rem' }}
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowExitConfirm(true)}
              style={{
                fontSize: '0.8125rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <LogOut size={14} />
              Save &amp; Exit
            </button>
          </div>
        </div>
      </header>

      {/* Progress Tracker Bar */}
      <div className="founder-progress-bar-wrap">
        <div className="founder-progress-container">
          <RecruiterProgressIndicator
            currentStep={currentStep}
            onStepClick={onStepClick}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="founder-onboarding-main">
        <div className="founder-content-container">{children}</div>
      </main>

      {/* Footer */}
      <footer className="founder-onboarding-footer">
        <div className="founder-footer-inner">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-text-muted)',
              fontSize: '0.8125rem',
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--color-accent)' }} />
            <span>
              YOGYATA Talent Acquisition • Evidence-Driven Candidate Discovery
            </span>
          </div>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-subtle)',
              margin: 0,
            }}
          >
            Draft progress is saved locally. Simulated onboarding prototype.
          </p>
        </div>
      </footer>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-modal-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <h3
              id="exit-modal-title"
              style={{
                margin: '0 0 0.5rem',
                fontSize: '1.125rem',
                color: 'var(--color-text-primary)',
              }}
            >
              Leave Recruiter Onboarding?
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
                margin: '0 0 1.25rem',
              }}
            >
              Your current progress has been saved automatically. You can return
              anytime to finish setting up your hiring profile and talent pipeline.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowExitConfirm(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
              >
                Save &amp; Return Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
