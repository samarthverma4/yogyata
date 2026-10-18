import React from 'react';
import {
  CheckCircle2,
  Building2,
  ArrowRight,
  Search,
  Calendar,
  Layers,
  FileCheck,
  RotateCcw,
} from 'lucide-react';
import type { RecruiterOnboardingState } from '../types';

interface RecruiterCompleteStepProps {
  state: RecruiterOnboardingState;
  onEnterWorkspace: () => void;
  onReturnToRoles: () => void;
}

export const RecruiterCompleteStep: React.FC<RecruiterCompleteStepProps> = ({
  state,
  onEnterWorkspace,
  onReturnToRoles,
}) => {
  const companyName = state.company.companyName.trim() || 'Your Company';
  const recruiterName =
    state.profile.recruiterName.trim() ||
    state.account.fullName.trim() ||
    'Recruiter';

  return (
    <div className="founder-step-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      {/* Celebration Icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#F0FDF4',
          color: '#16A34A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          boxShadow: '0 0 0 8px #DCFCE7',
        }}
      >
        <CheckCircle2 size={36} />
      </div>

      <h2
        className="founder-step-title"
        style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--color-navy)' }}
      >
        Recruiter Workspace Ready!
      </h2>
      <p
        style={{
          fontSize: '0.9375rem',
          color: 'var(--color-text-muted)',
          maxWidth: '520px',
          margin: '0 auto 1.75rem',
          lineHeight: 1.5,
        }}
      >
        Welcome, <strong>{recruiterName}</strong>! Your hiring profile for{' '}
        <strong>{companyName}</strong> has been configured. You can now discover
        talent with verified practical skills and streamline your pipeline.
      </p>

      {/* Feature Capabilities Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          maxWidth: '720px',
          margin: '0 auto 2rem',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            <Search size={16} style={{ color: 'var(--color-blue)' }} />
            Talent Discovery
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
            Filter candidates by Declared, Assessed, and Verified skill tiers with proof.
          </p>
        </div>

        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            <Layers size={16} style={{ color: '#16A34A' }} />
            Candidate Pipeline
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
            Track talent from Sourced and Screening to Interview, Offer, and Hired stages.
          </p>
        </div>

        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            <Calendar size={16} style={{ color: '#D97706' }} />
            Interview Scheduler
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
            Organize interview rounds, set dates, log agendas, and avoid scheduling collisions.
          </p>
        </div>

        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-navy)', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
            <FileCheck size={16} style={{ color: 'var(--color-blue)' }} />
            Candidate Scorecards
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
            Standardize hiring criteria with ratings across technical, problem-solving, and communication bars.
          </p>
        </div>
      </div>

      {/* Prototype Notice */}
      <div
        style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 0,
          padding: '0.75rem 1rem',
          maxWidth: '620px',
          margin: '0 auto 2rem',
          fontSize: '0.75rem',
          color: '#92400E',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        <strong>Notice:</strong> This is a frontend prototype. Recruiter profile setup
        is saved to local storage. Recruiter accounts are not certified enterprise credentials.
      </div>

      {/* Primary Action Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn-secondary"
          onClick={onReturnToRoles}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <RotateCcw size={15} />
          Return to Role Selection
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={onEnterWorkspace}
          style={{
            minWidth: '220px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            fontSize: '0.9375rem',
            background: '#15803D',
            borderColor: '#15803D',
          }}
        >
          <Building2 size={16} />
          <span>Enter Recruiter Workspace</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
