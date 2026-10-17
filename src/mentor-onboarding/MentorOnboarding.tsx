import React, { useState, useCallback, useEffect } from 'react';
import type { MentorOnboardingView, MentorOnboardingState } from './types';
import { INITIAL_MENTOR_ONBOARDING_STATE } from './types';
import {
  saveMentorOnboardingDraft,
  loadMentorOnboardingDraft,
  clearMentorOnboardingDraft,
} from './storage';
import { MentorOnboardingLayout } from './MentorOnboardingLayout';
import { MentorAccountStep } from './steps/MentorAccountStep';
import { MentorVerifyEmailStep } from './steps/MentorVerifyEmailStep';
import { MentorProfileStep } from './steps/MentorProfileStep';
import { MentorExpertiseStep } from './steps/MentorExpertiseStep';
import { MentorshipTracksStep } from './steps/MentorshipTracksStep';
import { MentorReviewStep } from './steps/MentorReviewStep';
import { MentorCompleteStep } from './steps/MentorCompleteStep';

interface MentorOnboardingProps {
  onExit: () => void;
  onSignInClick?: () => void;
  onEnterWorkspace: (onboardingState: MentorOnboardingState) => void;
}

export const MentorOnboarding: React.FC<MentorOnboardingProps> = ({
  onExit,
  onSignInClick,
  onEnterWorkspace,
}) => {
  const [view, setView] = useState<MentorOnboardingView>(() => {
    const draft = loadMentorOnboardingDraft();
    return draft ? draft.currentView : 'account';
  });

  const [state, setState] = useState<MentorOnboardingState>(() => {
    const draft = loadMentorOnboardingDraft();
    return draft ? draft.state : INITIAL_MENTOR_ONBOARDING_STATE;
  });

  // Auto-persist draft whenever state or view updates
  useEffect(() => {
    if (view !== 'complete') {
      saveMentorOnboardingDraft(state, view);
    }
  }, [state, view]);

  const goTo = useCallback((nextView: MentorOnboardingView) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleRestart = useCallback(() => {
    clearMentorOnboardingDraft();
    setState(INITIAL_MENTOR_ONBOARDING_STATE);
    setView('account');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleComplete = useCallback(() => {
    clearMentorOnboardingDraft();
    goTo('complete');
  }, [goTo]);

  const renderStep = () => {
    switch (view) {
      case 'account':
        return (
          <MentorAccountStep
            data={state.account}
            onChange={(account) => setState((prev) => ({ ...prev, account }))}
            onNext={() => goTo('verify-email')}
            onSignInClick={onSignInClick}
          />
        );
      case 'verify-email':
        return (
          <MentorVerifyEmailStep
            email={state.account.email}
            onNext={() => goTo('profile')}
            onBack={() => goTo('account')}
          />
        );
      case 'profile':
        return (
          <MentorProfileStep
            fullName={state.account.fullName}
            data={state.profile}
            onChange={(profile) => setState((prev) => ({ ...prev, profile }))}
            onNext={() => goTo('expertise')}
            onBack={() => goTo('verify-email')}
          />
        );
      case 'expertise':
        return (
          <MentorExpertiseStep
            data={state.expertise}
            onChange={(expertise) => setState((prev) => ({ ...prev, expertise }))}
            onNext={() => goTo('tracks')}
            onBack={() => goTo('profile')}
          />
        );
      case 'tracks':
        return (
          <MentorshipTracksStep
            data={state.preferences}
            onChange={(preferences) => setState((prev) => ({ ...prev, preferences }))}
            onNext={() => goTo('review')}
            onBack={() => goTo('expertise')}
          />
        );
      case 'review':
        return (
          <MentorReviewStep
            state={state}
            onEdit={(targetView) => goTo(targetView)}
            onComplete={handleComplete}
            onBack={() => goTo('tracks')}
          />
        );
      case 'complete':
        return (
          <MentorCompleteStep
            mentorName={state.account.fullName}
            onEnterWorkspace={() => onEnterWorkspace(state)}
            onExitToHome={onExit}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MentorOnboardingLayout
      currentView={view}
      onExit={onExit}
      onRestart={handleRestart}
      onStepClick={(stepView) => goTo(stepView)}
    >
      {renderStep()}
    </MentorOnboardingLayout>
  );
};
