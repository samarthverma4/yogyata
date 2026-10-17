import React, { useCallback, useState } from 'react';
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

interface JobSeekerOnboardingProps {
  onExit: () => void;
}

export const JobSeekerOnboarding: React.FC<JobSeekerOnboardingProps> = ({
  onExit,
}) => {
  const [view, setView] = useState<OnboardingView>('signup');
  const [state, setState] = useState<OnboardingState>(INITIAL_ONBOARDING_STATE);

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
            onBack={() => goTo('verify-email')}
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
            onExit={onExit}
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
