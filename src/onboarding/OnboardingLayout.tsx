import React from 'react';
import type { OnboardingView } from './types';
import { ProgressIndicator } from './ProgressIndicator';
import { ShieldCheck } from 'lucide-react';
import { BrandMark } from '../brand/BrandMark';

interface OnboardingLayoutProps {
  currentView: OnboardingView;
  onExit: () => void;
  children: React.ReactNode;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
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
            aria-label="YOGYATA – go back to home"
          >
            <BrandMark sub="Job seeker onboarding" />
          </button>

          {/* Centre: Role Badge */}
          <div className="ob-role-badge" aria-label="Current signup role">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>Job Seeker</span>
          </div>

          {/* Right: Save and exit */}
          <div className="ob-header-actions">
            <button
              type="button"
              className="ob-exit-btn"
              onClick={onExit}
              id="save-exit-btn"
            >
              Save & exit
            </button>
          </div>
        </div>
      </header>

      {/* ── Progress ── */}
      {showProgress && (
        <div className="ob-progress-bar-wrap">
          <div className="ob-progress-bar-inner">
            <ProgressIndicator currentView={currentView} />
          </div>
        </div>
      )}

      {/* ── Step Content ── */}
      <main className="ob-main" id="main-content" role="main">
        <div className="ob-main-inner">
          {children}
        </div>
      </main>

      {/* ── Minimal Footer ── */}
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
