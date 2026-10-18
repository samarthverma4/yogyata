import { BrandMark } from '../brand/BrandMark';
import React, { useState } from 'react';
import type { MentorOnboardingView } from './types';
import { MentorProgressIndicator } from './MentorProgressIndicator';
import { GraduationCap, LogOut, RotateCcw } from 'lucide-react';

interface MentorOnboardingLayoutProps {
  currentView: MentorOnboardingView;
  onExit: () => void;
  onRestart?: () => void;
  onStepClick?: (view: MentorOnboardingView) => void;
  children: React.ReactNode;
}

export const MentorOnboardingLayout: React.FC<MentorOnboardingLayoutProps> = ({
  currentView,
  onExit,
  onRestart,
  onStepClick,
  children,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  return (
    <div className="ob-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* ── Top Header ── */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid var(--color-border)',
          padding: '12px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <BrandMark />
            <span
              className="yw-badge"
              style={{
                background: 'var(--color-blue-tint)',
                color: 'var(--color-blue)',
                border: '1px solid var(--color-blue-line)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
              }}
            >
              <GraduationCap size={13} />
              Mentor Onboarding
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onRestart && currentView !== 'complete' && (
              <button
                type="button"
                className="yw-btn yw-btn-secondary yw-btn-sm"
                onClick={() => setShowRestartConfirm(true)}
                style={{ fontSize: '0.78rem' }}
              >
                <RotateCcw size={13} />
                <span>Restart</span>
              </button>
            )}
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => setShowExitConfirm(true)}
              id="mentor-onboarding-exit-btn"
              style={{ fontSize: '0.78rem' }}
            >
              <LogOut size={13} />
              <span>Save & Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Body ── */}
      <main style={{ flex: 1, padding: '32px 16px 64px 16px', maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
        {currentView !== 'complete' && (
          <MentorProgressIndicator currentView={currentView} onStepClick={onStepClick} />
        )}

        <div style={{ background: '#FFFFFF', border: '1px solid var(--color-border)', borderRadius: 0, padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {children}
        </div>
      </main>

      {/* ── Exit Confirmation Dialog ── */}
      {showExitConfirm && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-mentor-exit-title">
          <div className="yw-modal-box" style={{ maxWidth: '440px' }}>
            <div className="yw-modal-header">
              <h3 id="modal-mentor-exit-title" className="yw-modal-title">
                Save & Exit Onboarding?
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setShowExitConfirm(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="yw-modal-body">
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Your progress has been saved as a local draft. You can return to continue your mentor registration at any time.
              </p>
            </div>
            <div className="yw-modal-footer">
              <button
                type="button"
                className="yw-btn yw-btn-secondary"
                onClick={() => setShowExitConfirm(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="yw-btn yw-btn-primary"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
              >
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restart Confirmation Dialog ── */}
      {showRestartConfirm && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-mentor-restart-title">
          <div className="yw-modal-box" style={{ maxWidth: '440px' }}>
            <div className="yw-modal-header">
              <h3 id="modal-mentor-restart-title" className="yw-modal-title" style={{ color: '#DC2626' }}>
                Restart Mentor Onboarding?
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setShowRestartConfirm(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="yw-modal-body">
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Are you sure you want to reset your entered details? All draft data in this onboarding session will be cleared.
              </p>
            </div>
            <div className="yw-modal-footer">
              <button
                type="button"
                className="yw-btn yw-btn-secondary"
                onClick={() => setShowRestartConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="yw-btn yw-btn-danger"
                onClick={() => {
                  setShowRestartConfirm(false);
                  onRestart?.();
                }}
              >
                Yes, Clear & Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
