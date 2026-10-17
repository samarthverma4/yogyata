import React from 'react';
import type { FounderOnboardingView } from './types';

interface Stage {
  id: string;
  label: string;
  views: FounderOnboardingView[];
  step: number;
}

const STAGES: Stage[] = [
  { id: 'account',  label: 'Account',         step: 1, views: ['signup', 'verify-email'] },
  { id: 'profile',  label: 'Founder Profile', step: 2, views: ['profile'] },
  { id: 'startup',  label: 'Startup',         step: 3, views: ['startup'] },
  { id: 'goals',    label: 'Goals & Talent',  step: 4, views: ['goals', 'talent'] },
  { id: 'task',     label: 'Optional Task',   step: 5, views: ['task'] },
  { id: 'review',   label: 'Review',          step: 6, views: ['review', 'complete'] },
];

function getStageForView(view: FounderOnboardingView): Stage | undefined {
  return STAGES.find((s) => s.views.includes(view));
}

interface FounderProgressIndicatorProps {
  currentView: FounderOnboardingView;
}

export const FounderProgressIndicator: React.FC<FounderProgressIndicatorProps> = ({
  currentView,
}) => {
  const currentStage = getStageForView(currentView);
  const currentStep = currentStage?.step ?? 1;

  return (
    <nav className="ob-progress" aria-label="Founder onboarding progress">
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
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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
