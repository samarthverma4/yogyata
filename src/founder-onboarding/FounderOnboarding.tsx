import React, { useCallback, useEffect, useState } from 'react';
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
import {
  loadFounderDraft,
  saveFounderDraft,
  clearFounderDraft,
  formatTimeAgo,
  MAX_IMAGE_STORAGE_LENGTH,
} from './storage';
import {
  initializeWorkspaceFromOnboarding,
  saveFounderWorkspace,
} from '../founder-workspace/storage';
import type { FounderWorkspaceState } from '../founder-workspace/types';

interface FounderOnboardingProps {
  onExit: () => void;
  onSignInClick?: () => void;
  onEnterWorkspace?: (workspace: FounderWorkspaceState) => void;
  /** Signed-in account: skips the prototype sign-up and email steps and prefills name and email. */
  account?: { fullName: string; email: string };
}

export const FounderOnboarding: React.FC<FounderOnboardingProps> = ({
  onExit,
  onSignInClick,
  onEnterWorkspace,
  account,
}) => {
  const firstView: FounderOnboardingView = account ? 'profile' : 'signup';
  const accountName = account?.fullName;
  const accountEmail = account?.email;
  const withAccount = useCallback(
    (s: FounderOnboardingState): FounderOnboardingState =>
      accountEmail !== undefined
        ? {
            ...s,
            account: { ...s.account, fullName: accountName ?? '', email: accountEmail },
            profile: { ...s.profile, fullName: s.profile.fullName || accountName || '' },
          }
        : s,
    [accountName, accountEmail]
  );
  // Initialize state lazily from stored draft if available
  const [initialData] = useState(() => {
    const draft = loadFounderDraft();
    if (draft) {
      const hasMeaningfulData = Boolean(
        draft.state.account.email ||
        draft.state.account.fullName ||
        draft.state.profile.fullName ||
        draft.state.startup.startupName ||
        draft.state.goals.primaryGoal ||
        draft.state.talentRequirements.length > 0 ||
        (draft.state.taskDraft && !draft.state.taskDraft.isSkipped && draft.state.taskDraft.taskTitle)
      );

      if (hasMeaningfulData) {
        const draftView = draft.currentView || firstView;
        return {
          state: withAccount(draft.state),
          // a signed-in founder never returns to the prototype account steps
          view: account && (draftView === 'signup' || draftView === 'verify-email') ? firstView : draftView,
          draftRestoredTime: formatTimeAgo(draft.savedAt),
        };
      }
    }
    return {
      state: withAccount(INITIAL_FOUNDER_ONBOARDING_STATE),
      view: firstView,
      draftRestoredTime: null,
    };
  });

  const [view, setView] = useState<FounderOnboardingView>(initialData.view);
  const [state, setState] = useState<FounderOnboardingState>(initialData.state);
  const [isEditingFromReview, setIsEditingFromReview] = useState(false);
  const [draftRestoredTime, setDraftRestoredTime] = useState<string | null>(initialData.draftRestoredTime);

  // Derive whether photo or logo is omitted from local storage due to payload size
  const imageOmittedNotice = Boolean(
    (state.profile.profilePhotoUrl && state.profile.profilePhotoUrl.length > MAX_IMAGE_STORAGE_LENGTH) ||
    (state.startup.logoUrl && state.startup.logoUrl.length > MAX_IMAGE_STORAGE_LENGTH)
  );

  // Save non-sensitive draft on state or view changes
  useEffect(() => {
    if (view === 'complete') {
      clearFounderDraft();
      return;
    }
    saveFounderDraft(state, view);
  }, [state, view]);

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

  const handleEditFromReview = useCallback((target: FounderOnboardingView) => {
    setIsEditingFromReview(true);
    goTo(target);
  }, [goTo]);

  const handleReturnToReview = useCallback(() => {
    setIsEditingFromReview(false);
    goTo('review');
  }, [goTo]);

  const handleStageClick = useCallback((targetView: FounderOnboardingView) => {
    setIsEditingFromReview(false);
    goTo(targetView);
  }, [goTo]);

  const handleResetDraft = useCallback(() => {
    clearFounderDraft();
    setState(withAccount(INITIAL_FOUNDER_ONBOARDING_STATE));
    setView(firstView);
    setIsEditingFromReview(false);
    setDraftRestoredTime(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [withAccount, firstView]);

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
            onBack={() => (account ? onExit() : goTo('verify-email'))}
            isEditingFromReview={isEditingFromReview}
            onReturnToReview={handleReturnToReview}
          />
        );
      case 'startup':
        return (
          <StartupDetailsStep
            data={state.startup}
            onChange={(d) => updateState('startup', d)}
            onNext={() => goTo('goals')}
            onBack={() => goTo('profile')}
            isEditingFromReview={isEditingFromReview}
            onReturnToReview={handleReturnToReview}
          />
        );
      case 'goals':
        return (
          <BusinessGoalsStep
            data={state.goals}
            onChange={(d) => updateState('goals', d)}
            onNext={() => goTo('talent')}
            onBack={() => goTo('startup')}
            isEditingFromReview={isEditingFromReview}
            onReturnToReview={handleReturnToReview}
          />
        );
      case 'talent':
        return (
          <TalentRequirementsStep
            requirements={state.talentRequirements}
            onChange={(reqs) => updateState('talentRequirements', reqs)}
            onNext={() => goTo('task')}
            onBack={() => goTo('goals')}
            isEditingFromReview={isEditingFromReview}
            onReturnToReview={handleReturnToReview}
          />
        );
      case 'task':
        return (
          <ProjectTaskStep
            data={state.taskDraft}
            onChange={(d) => updateState('taskDraft', d)}
            onNext={() => goTo('review')}
            onBack={() => goTo('talent')}
            isEditingFromReview={isEditingFromReview}
            onReturnToReview={handleReturnToReview}
          />
        );
      case 'review':
        return (
          <FounderReviewStep
            state={state}
            onEdit={handleEditFromReview}
            onComplete={() => {
              clearFounderDraft();
              goTo('complete');
            }}
            onBack={() => goTo('task')}
            onChangePrivacy={(p) => updateState('privacy', p)}
          />
        );
      case 'complete':
        return (
          <FounderCompleteStep
            state={state}
            onExit={() => {
              clearFounderDraft();
              onExit();
            }}
            onEnterWorkspace={() => {
              clearFounderDraft();
              const ws = initializeWorkspaceFromOnboarding(state);
              saveFounderWorkspace(ws);
              if (onEnterWorkspace) {
                onEnterWorkspace(ws);
              } else {
                onExit();
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FounderOnboardingLayout
      currentView={view}
      onExit={onExit}
      onStageClick={handleStageClick}
      isEditingFromReview={isEditingFromReview}
      onReturnToReview={handleReturnToReview}
      draftRestoredTime={draftRestoredTime}
      imageOmittedNotice={imageOmittedNotice}
      onResetDraft={handleResetDraft}
    >
      {renderStep()}
    </FounderOnboardingLayout>
  );
};
