import React, { useCallback, useState } from 'react';
import type { FounderOnboardingView, FounderOnboardingState } from './types';
import { INITIAL_FOUNDER_ONBOARDING_STATE } from './types';
import { FounderOnboardingLayout } from './FounderOnboardingLayout';
import { FounderSignupStep } from './steps/FounderSignupStep';
import { FounderVerifyEmailStep } from './steps/FounderVerifyEmailStep';
import { FounderProfileStep } from './steps/FounderProfileStep';
import { StartupDetailsStep } from './steps/StartupDetailsStep';
import { BusinessGoalsStep } from './steps/BusinessGoalsStep';
import { TalentRequirementsStep } from './steps/TalentRequirementsStep';
import { ProjectTaskStep } from './steps/ProjectTaskStep';
import { FounderReviewStep } from './steps/FounderReviewStep';
import { FounderCompleteStep } from './steps/FounderCompleteStep';

interface FounderOnboardingProps {
  onExit: () => void;
  onSignInClick?: () => void;
}

export const FounderOnboarding: React.FC<FounderOnboardingProps> = ({
  onExit,
  onSignInClick,
}) => {
  const [view, setView] = useState<FounderOnboardingView>('signup');
  const [state, setState] = useState<FounderOnboardingState>(INITIAL_FOUNDER_ONBOARDING_STATE);

  const updateState = useCallback(
    <K extends keyof FounderOnboardingState>(key: K, value: FounderOnboardingState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const goTo = useCallback((next: FounderOnboardingView) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const renderStep = () => {
    switch (view) {
      case 'signup':
        return (
          <FounderSignupStep
            data={state.account}
            onChange={(d) => {
              updateState('account', d);
              // Prefill profile name if not yet customized
              if (!state.profile.fullName || state.profile.fullName === state.account.fullName) {
                updateState('profile', { ...state.profile, fullName: d.fullName });
              }
            }}
            onNext={() => goTo('verify-email')}
            onSignInClick={onSignInClick}
          />
        );
      case 'verify-email':
        return (
          <FounderVerifyEmailStep
            email={state.account.email}
            onNext={() => goTo('profile')}
            onBack={() => goTo('signup')}
          />
        );
      case 'profile':
        return (
          <FounderProfileStep
            data={state.profile}
            onChange={(d) => updateState('profile', d)}
            onNext={() => goTo('startup')}
            onBack={() => goTo('verify-email')}
          />
        );
      case 'startup':
        return (
          <StartupDetailsStep
            data={state.startup}
            onChange={(d) => updateState('startup', d)}
            onNext={() => goTo('goals')}
            onBack={() => goTo('profile')}
          />
        );
      case 'goals':
        return (
          <BusinessGoalsStep
            data={state.goals}
            onChange={(d) => updateState('goals', d)}
            onNext={() => goTo('talent')}
            onBack={() => goTo('startup')}
          />
        );
      case 'talent':
        return (
          <TalentRequirementsStep
            requirements={state.talentRequirements}
            onChange={(reqs) => updateState('talentRequirements', reqs)}
            onNext={() => goTo('task')}
            onBack={() => goTo('goals')}
          />
        );
      case 'task':
        return (
          <ProjectTaskStep
            data={state.taskDraft}
            onChange={(d) => updateState('taskDraft', d)}
            onNext={() => goTo('review')}
            onBack={() => goTo('talent')}
          />
        );
      case 'review':
        return (
          <FounderReviewStep
            state={state}
            onEdit={(target) => goTo(target)}
            onComplete={() => goTo('complete')}
            onBack={() => goTo('task')}
            onChangePrivacy={(p) => updateState('privacy', p)}
          />
        );
      case 'complete':
        return (
          <FounderCompleteStep
            state={state}
            onExit={onExit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FounderOnboardingLayout currentView={view} onExit={onExit}>
      {renderStep()}
    </FounderOnboardingLayout>
  );
};
