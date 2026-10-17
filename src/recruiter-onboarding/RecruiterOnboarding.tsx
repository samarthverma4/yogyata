import React, { useState, useEffect, useCallback } from 'react';
import { RecruiterOnboardingLayout } from './RecruiterOnboardingLayout';
import { RecruiterAccountStep } from './steps/RecruiterAccountStep';
import { RecruiterVerifyDomainStep } from './steps/RecruiterVerifyDomainStep';
import { RecruiterProfileStep } from './steps/RecruiterProfileStep';
import { CompanyProfileStep } from './steps/CompanyProfileStep';
import { HiringPreferencesStep } from './steps/HiringPreferencesStep';
import { RecruiterReviewStep } from './steps/RecruiterReviewStep';
import { RecruiterCompleteStep } from './steps/RecruiterCompleteStep';
import type {
  RecruiterOnboardingState,
  RecruiterOnboardingStep,
  RecruiterAccount,
  RecruiterProfile,
  CompanyProfile,
  HiringPreferences,
} from './types';
import {
  loadRecruiterDraft,
  saveRecruiterDraft,
  clearRecruiterDraft,
} from './storage';

interface RecruiterOnboardingProps {
  onExit: () => void;
  onSignInClick?: () => void;
  onEnterWorkspace: (state: RecruiterOnboardingState) => void;
}

export const RecruiterOnboarding: React.FC<RecruiterOnboardingProps> = ({
  onExit,
  onSignInClick,
  onEnterWorkspace,
}) => {
  const [state, setState] = useState<RecruiterOnboardingState>(() => loadRecruiterDraft());

  // Autosave draft whenever state changes
  useEffect(() => {
    saveRecruiterDraft(state);
  }, [state]);

  const updateAccount = useCallback((data: Partial<RecruiterAccount>) => {
    setState((prev) => ({
      ...prev,
      account: { ...prev.account, ...data },
    }));
  }, []);

  const updateProfile = useCallback((data: Partial<RecruiterProfile>) => {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...data },
    }));
  }, []);

  const updateCompany = useCallback((data: Partial<CompanyProfile>) => {
    setState((prev) => ({
      ...prev,
      company: { ...prev.company, ...data },
    }));
  }, []);

  const updateHiring = useCallback((data: Partial<HiringPreferences>) => {
    setState((prev) => ({
      ...prev,
      hiring: { ...prev.hiring, ...data },
    }));
  }, []);

  const setAgreedToGuidelines = useCallback((agreed: boolean) => {
    setState((prev) => ({ ...prev, agreedToGuidelines: agreed }));
  }, []);

  const goToStep = useCallback((step: RecruiterOnboardingStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      const next = Math.min(prev.currentStep + 1, 7) as RecruiterOnboardingStep;
      return { ...prev, currentStep: next };
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const prevStepNum = Math.max(prev.currentStep - 1, 1) as RecruiterOnboardingStep;
      return { ...prev, currentStep: prevStepNum };
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleFinishOnboarding = useCallback(() => {
    const finalState: RecruiterOnboardingState = {
      ...state,
      currentStep: 7,
      isComplete: true,
    };
    setState(finalState);
    saveRecruiterDraft(finalState);
  }, [state]);

  const handleEnterWorkspaceClicked = useCallback(() => {
    clearRecruiterDraft();
    onEnterWorkspace(state);
  }, [onEnterWorkspace, state]);

  return (
    <RecruiterOnboardingLayout
      currentStep={state.currentStep}
      onStepClick={goToStep}
      onExit={onExit}
      onSignInClick={onSignInClick}
    >
      {state.currentStep === 1 && (
        <RecruiterAccountStep
          data={state.account}
          onChange={updateAccount}
          onNext={nextStep}
        />
      )}

      {state.currentStep === 2 && (
        <RecruiterVerifyDomainStep
          account={state.account}
          onChange={updateAccount}
          onNext={nextStep}
          onBack={prevStep}
        />
      )}

      {state.currentStep === 3 && (
        <RecruiterProfileStep
          data={state.profile}
          fullNameFallback={state.account.fullName}
          onChange={updateProfile}
          onNext={nextStep}
          onBack={prevStep}
        />
      )}

      {state.currentStep === 4 && (
        <CompanyProfileStep
          data={state.company}
          onChange={updateCompany}
          onNext={nextStep}
          onBack={prevStep}
        />
      )}

      {state.currentStep === 5 && (
        <HiringPreferencesStep
          data={state.hiring}
          onChange={updateHiring}
          onNext={nextStep}
          onBack={prevStep}
        />
      )}

      {state.currentStep === 6 && (
        <RecruiterReviewStep
          state={state}
          onJumpToStep={goToStep}
          onAgreeChange={setAgreedToGuidelines}
          onNext={() => {
            handleFinishOnboarding();
            goToStep(7);
          }}
          onBack={prevStep}
        />
      )}

      {state.currentStep === 7 && (
        <RecruiterCompleteStep
          state={state}
          onEnterWorkspace={handleEnterWorkspaceClicked}
          onReturnToRoles={onExit}
        />
      )}
    </RecruiterOnboardingLayout>
  );
};
