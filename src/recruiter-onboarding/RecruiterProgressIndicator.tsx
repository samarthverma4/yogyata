import React from 'react';
import {
  User,
  ShieldCheck,
  Briefcase,
  Building2,
  Filter,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import type { RecruiterOnboardingStep } from './types';

interface StepMeta {
  number: RecruiterOnboardingStep;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const STEPS: StepMeta[] = [
  { number: 1, label: 'Account', icon: User },
  { number: 2, label: 'Verification', icon: ShieldCheck },
  { number: 3, label: 'Profile', icon: Briefcase },
  { number: 4, label: 'Company', icon: Building2 },
  { number: 5, label: 'Hiring Focus', icon: Filter },
  { number: 6, label: 'Review', icon: FileCheck },
  { number: 7, label: 'Ready', icon: CheckCircle2 },
];

interface RecruiterProgressIndicatorProps {
  currentStep: RecruiterOnboardingStep;
  onStepClick?: (step: RecruiterOnboardingStep) => void;
}

export const RecruiterProgressIndicator: React.FC<RecruiterProgressIndicatorProps> = ({
  currentStep,
  onStepClick,
}) => {
  return (
    <nav className="founder-progress-nav" aria-label="Recruiter Onboarding Progress">
      <ol className="founder-progress-list">
        {STEPS.map((step) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isAccessible = step.number < currentStep && onStepClick;
          const Icon = step.icon;

          return (
            <li
              key={step.number}
              className={`founder-progress-item ${
                isCompleted ? 'is-completed' : ''
              } ${isCurrent ? 'is-current' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <button
                type="button"
                className="founder-progress-btn"
                onClick={() => isAccessible && onStepClick(step.number)}
                disabled={!isAccessible}
                title={`Step ${step.number}: ${step.label}`}
              >
                <span className="founder-progress-icon-wrap" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="founder-progress-label">
                  <span className="founder-progress-step-num">Step {step.number}</span>
                  <span className="founder-progress-step-title">{step.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
