import { scopedKey } from '../lib/storageScope';
import React, { useCallback, useEffect, useState } from 'react';
import type { OnboardingView, OnboardingState } from './types';
import { INITIAL_ONBOARDING_STATE } from './types';
import { OnboardingLayout } from './OnboardingLayout';
import { SignupStep } from './steps/SignupStep';
import { EmailVerifyStep } from './steps/EmailVerifyStep';
import { ProfileStep } from './steps/ProfileStep';
import { ResumeSkillsStep } from './steps/ResumeSkillsStep';
import { CareerGoalsStep } from './steps/CareerGoalsStep';
import { JobPrefsStep } from './steps/JobPrefsStep';
import { ReviewStep } from './steps/ReviewStep';
import { CompleteStep } from './steps/CompleteStep';

const JOB_SEEKER_DRAFT_KEY = 'yogyata_job_seeker_onboarding_draft';

function loadDraft(): OnboardingState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(scopedKey(JOB_SEEKER_DRAFT_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.account) return null;
    return {
      ...INITIAL_ONBOARDING_STATE,
      ...parsed,
      account: {
        ...INITIAL_ONBOARDING_STATE.account,
        ...parsed.account,
        password: '',
        confirmPassword: '',
      },
    };
  } catch {
    return null;
  }
}

/** The answers are saved to Supabase on completion, so the draft is no longer needed. */
function clearDraft(): void {
  try {
    localStorage.removeItem(scopedKey(JOB_SEEKER_DRAFT_KEY));
  } catch {
    /* nothing to clear */
  }
}

function saveDraft(state: OnboardingState): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = {
      ...state,
      account: {
        ...state.account,
        password: '',
        confirmPassword: '',
      },
    };
    localStorage.setItem(scopedKey(JOB_SEEKER_DRAFT_KEY), JSON.stringify(sanitized));
  } catch {
    // Ignore storage errors
  }
}

interface JobSeekerOnboardingProps {
  onExit: () => void;
  /** Signed-in account: skips the prototype sign-up and email steps and prefills name and email. */
  account?: { fullName: string; email: string };
  /** Called from the completion screen with everything the seeker entered. */
  onComplete?: (state: OnboardingState) => void;
}

export const JobSeekerOnboarding: React.FC<JobSeekerOnboardingProps> = ({
  onExit,
  account,
  onComplete,
}) => {
  const [view, setView] = useState<OnboardingView>(account ? 'profile' : 'signup');
  const [state, setState] = useState<OnboardingState>(() => {
    // resume a saved draft; a signed-in account always supplies the name and email
    const base = loadDraft() || INITIAL_ONBOARDING_STATE;
    return account ? { ...base, account: { ...base.account, ...account } } : base;
  });

  // Autosave draft on state change
  useEffect(() => {
    saveDraft(state);
  }, [state]);

  const updateState = useCallback(
    <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const goTo = useCallback((next: OnboardingView) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const renderStep = () => {
    switch (view) {
      case 'signup':
        return (
          <SignupStep
            data={state.account}
            onChange={(d) => updateState('account', d)}
            onNext={() => goTo('verify-email')}
          />
        );
      case 'verify-email':
        return (
          <EmailVerifyStep
            email={state.account.email}
            onNext={() => goTo('profile')}
            onBack={() => goTo('signup')}
          />
        );
      case 'profile':
        return (
          <ProfileStep
            professional={state.professional}
            education={state.education}
            onChangeProfessional={(d) => updateState('professional', d)}
            onChangeEducation={(d) => updateState('education', d)}
            onNext={() => goTo('resume-skills')}
            onBack={() => (account ? onExit() : goTo('verify-email'))}
          />
        );
      case 'resume-skills':
        return (
          <ResumeSkillsStep
            data={state.resumeSkills}
            onChange={(d) => updateState('resumeSkills', d)}
            onNext={() => goTo('career-goals')}
            onBack={() => goTo('profile')}
          />
        );
      case 'career-goals':
        return (
          <CareerGoalsStep
            data={state.careerGoals}
            onChange={(d) => updateState('careerGoals', d)}
            onNext={() => goTo('job-prefs')}
            onBack={() => goTo('resume-skills')}
          />
        );
      case 'job-prefs':
        return (
          <JobPrefsStep
            data={state.jobPrefs}
            professional={state.professional}
            onChange={(d) => updateState('jobPrefs', d)}
            onNext={() => goTo('review')}
            onBack={() => goTo('career-goals')}
          />
        );
      case 'review':
        return (
          <ReviewStep
            state={state}
            onEdit={(target: OnboardingView) => goTo(target)}
            onComplete={() => goTo('complete')}
            onBack={() => goTo('job-prefs')}
            onChangePrivacy={(d) => updateState('privacy', d)}
          />
        );
      case 'complete':
        return (
          <CompleteStep
            name={state.account.fullName}
            onExit={
              onComplete
                ? () => {
                    clearDraft();
                    onComplete(state);
                  }
                : onExit
            }
            actionLabel={onComplete ? 'Open my Skill Passport' : undefined}
          />
        );
      default:
        return null;
    }
  };

  return (
    <OnboardingLayout currentView={view} onExit={onExit}>
      {renderStep()}
    </OnboardingLayout>
  );
};
