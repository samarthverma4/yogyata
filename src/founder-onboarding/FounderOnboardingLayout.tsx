import React from 'react';
import type { FounderOnboardingView } from './types';
import { FounderProgressIndicator } from './FounderProgressIndicator';
import { Lightbulb } from 'lucide-react';

interface FounderOnboardingLayoutProps {
  currentView: FounderOnboardingView;
  onExit: () => void;
  children: React.ReactNode;
}

export const FounderOnboardingLayout: React.FC<FounderOnboardingLayoutProps> = ({
  currentView,
  onExit,
  children,
}) => {
  const showProgress = currentView !== 'complete';

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

      {/* ── Progress Bar ── */}
      {showProgress && (
        <div className="ob-progress-bar-wrap">
          <div className="ob-progress-bar-inner">
            <FounderProgressIndicator currentView={currentView} />
          </div>
        </div>
      )}

      {/* ── Step Content ── */}
      <main className="ob-main" id="main-content" role="main">
        <div className="ob-main-inner">
          {children}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="ob-footer" role="contentinfo">
        <span>© 2025 YOGYATA. All rights reserved.</span>
        <span className="ob-footer-sep" aria-hidden="true">·</span>
        <a href="#" className="ob-footer-link">Privacy Policy</a>
        <span className="ob-footer-sep" aria-hidden="true">·</span>
        <a href="#" className="ob-footer-link">Terms of Service</a>
      </footer>
    </div>
  );
};
