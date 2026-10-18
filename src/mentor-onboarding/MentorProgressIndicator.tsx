import React from 'react';
import type { MentorOnboardingView } from './types';
import { Check } from 'lucide-react';

interface MentorProgressIndicatorProps {
  currentView: MentorOnboardingView;
  onStepClick?: (view: MentorOnboardingView) => void;
}

const STEPS: { view: MentorOnboardingView; label: string; number: number }[] = [
  { view: 'account', label: 'Account', number: 1 },
  { view: 'verify-email', label: 'Verify', number: 2 },
  { view: 'profile', label: 'Profile', number: 3 },
  { view: 'expertise', label: 'Expertise', number: 4 },
  { view: 'tracks', label: 'Tracks', number: 5 },
  { view: 'review', label: 'Review', number: 6 },
];

export const MentorProgressIndicator: React.FC<MentorProgressIndicatorProps> = ({
  currentView,
  onStepClick,
}) => {
  const currentIndex = STEPS.findIndex((s) => s.view === currentView);
  if (currentIndex === -1) return null; // complete step does not show progress bar

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto 2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {/* Background Connecting Line */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '24px',
            right: '24px',
            height: '2px',
            background: 'var(--color-border)',
            zIndex: 0,
          }}
        />
        {/* Active Connecting Fill */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '24px',
            width: `${(currentIndex / (STEPS.length - 1)) * 92}%`,
            height: '2px',
            background: 'var(--color-blue)',
            transition: 'width 0.3s ease',
            zIndex: 1,
          }}
        />

        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isClickable = isDone && onStepClick;

          return (
            <div
              key={step.view}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.375rem',
                position: 'relative',
                zIndex: 2,
                cursor: isClickable ? 'pointer' : 'default',
              }}
              onClick={() => isClickable && onStepClick(step.view)}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isCurrent ? 'var(--color-blue)' : isDone ? '#10B981' : '#FFFFFF',
                  color: isCurrent || isDone ? '#FFFFFF' : 'var(--color-text-muted)',
                  border: `2px solid ${isCurrent ? 'var(--color-blue)' : isDone ? '#10B981' : 'var(--color-border-hover)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(37, 99, 235, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {isDone ? <Check size={16} strokeWidth={3} /> : step.number}
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--color-navy)' : isDone ? '#10B981' : 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
