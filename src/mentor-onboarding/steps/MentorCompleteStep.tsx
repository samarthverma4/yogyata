import React from 'react';
import { CheckCircle2, Compass, ArrowRight, Home, Shield } from 'lucide-react';

interface MentorCompleteStepProps {
  mentorName: string;
  onEnterWorkspace: () => void;
  onExitToHome: () => void;
}

export const MentorCompleteStep: React.FC<MentorCompleteStepProps> = ({
  mentorName,
  onEnterWorkspace,
  onExitToHome,
}) => {
  return (
    <div className="mob-step-container" style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: '#ECFDF5',
          color: '#059669',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          boxShadow: '0 4px 14px rgba(5, 150, 105, 0.15)',
        }}
      >
        <CheckCircle2 size={40} />
      </div>

      <span className="yw-badge yw-badge-green" style={{ fontSize: '0.78rem', marginBottom: '0.75rem' }}>
        Profile Registration Ready
      </span>

      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-navy)', margin: '0.25rem 0 0.75rem 0', letterSpacing: '-0.02em' }}>
        Welcome to YOGYATA, {mentorName || 'Mentor'}!
      </h2>

      <p style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
        Your mentor onboarding profile has been created and initialized. You can now access your
        dedicated <strong>Mentor Workspace</strong> to manage mentee relationships, coordinate 1:1 sessions,
        and provide formative learning feedback.
      </p>

      <div
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 0,
          padding: '1.125rem',
          textAlign: 'left',
          marginBottom: '2rem',
          fontSize: '0.8125rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '0.375rem' }}>
          <Shield size={16} color="var(--color-blue)" />
          Prototype Verification Standard
        </div>
        This prototype profile operates in client-side storage. Under platform rules, mentor onboarding
        establishes your coaching roster and topic tracks, while Skill Passport credentials remain backed
        by practical task challenges and assessment benchmarks.
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="yw-btn yw-btn-secondary"
          onClick={onExitToHome}
        >
          <Home size={16} />
          <span>Return to Home</span>
        </button>

        <button
          type="button"
          className="yw-btn yw-btn-primary"
          onClick={onEnterWorkspace}
          id="btn-launch-mentor-workspace"
          style={{ minWidth: '220px', background: 'var(--color-blue)', borderColor: 'var(--color-blue)' }}
        >
          <Compass size={18} />
          <span>Open Mentor Workspace</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
