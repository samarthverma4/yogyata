import React from 'react';
import type { OnboardingView } from './types';

// ─── Progress Stage Config ────────────────────────────────────────────────────

interface Stage {
  id: string;
  label: string;
  views: OnboardingView[];
  step: number; // 1-indexed
}

const STAGES: Stage[] = [
  { id: 'account',  label: 'Account',        step: 1, views: ['signup', 'verify-email'] },
  { id: 'profile',  label: 'Profile',         step: 2, views: ['profile'] },
  { id: 'resume',   label: 'Resume & Skills', step: 3, views: ['resume-skills'] },
  { id: 'goals',    label: 'Career Goals',    step: 4, views: ['career-goals', 'job-prefs'] },
  { id: 'review',   label: 'Review',          step: 5, views: ['review', 'privacy', 'complete'] },
];

function getStageForView(view: OnboardingView): Stage | undefined {
  return STAGES.find((s) => s.views.includes(view));
}

interface ProgressIndicatorProps {
  currentView: OnboardingView;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentView,
}) => {
  const currentStage = getStageForView(currentView);
  const currentStep = currentStage?.step ?? 1;

  return (
    <nav
      className="ob-progress"
      aria-label="Onboarding progress"
    >
      {STAGES.map((stage, idx) => {
        const isComplete = stage.step < currentStep;
        const isActive = stage.step === currentStep;
        const isUpcoming = stage.step > currentStep;

        return (
          <React.Fragment key={stage.id}>
            <div
              className={`ob-progress-step ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''} ${isUpcoming ? 'is-upcoming' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="ob-progress-dot" aria-hidden="true">
                {isComplete ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span className="ob-progress-num">{stage.step}</span>
                )}
              </div>
              <span className="ob-progress-label">{stage.label}</span>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className={`ob-progress-connector ${stage.step < currentStep ? 'is-complete' : ''}`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
