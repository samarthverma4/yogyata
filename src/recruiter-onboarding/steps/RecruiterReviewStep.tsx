import React, { useState } from 'react';
import {
  Edit2,
  ArrowRight,
  ArrowLeft,
  Building2,
  User,
  Briefcase,
} from 'lucide-react';
import type { RecruiterOnboardingState, RecruiterOnboardingStep } from '../types';

interface RecruiterReviewStepProps {
  state: RecruiterOnboardingState;
  onJumpToStep: (step: RecruiterOnboardingStep) => void;
  onAgreeChange: (agreed: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export const RecruiterReviewStep: React.FC<RecruiterReviewStepProps> = ({
  state,
  onJumpToStep,
  onAgreeChange,
  onNext,
  onBack,
}) => {
  const [error, setError] = useState('');

  const displayName =
    state.profile.recruiterName.trim() ||
    state.account.fullName.trim() ||
    'Recruiter';

  const handleFinish = () => {
    if (!state.agreedToGuidelines) {
      setError('Please review and accept the hiring integrity guidelines to complete setup');
      return;
    }
    onNext();
  };

  return (
    <div className="founder-step-card">
      <div className="founder-step-header">
        <h2 className="founder-step-title">Review Your Recruiter &amp; Company Setup</h2>
        <p className="founder-step-subtitle">
          Verify your organization profile and hiring criteria before opening the Recruiter Workspace.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Card 1: Account & Recruiter Profile */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-navy)' }}>
              <User size={16} style={{ color: 'var(--color-blue)' }} />
              Recruiter Identity &amp; Account
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onJumpToStep(3)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Edit2 size={12} /> Edit Profile
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Name: </span>
              <strong>{displayName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Work Email: </span>
              <strong>{state.account.workEmail}</strong>{' '}
              <span style={{ color: '#16A34A', fontSize: '0.75rem', fontWeight: 600 }}>(Verified)</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Job Title: </span>
              <strong>{state.profile.jobTitle}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Experience: </span>
              <strong>{state.profile.recruitingExperience}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Specialization: </span>
              <strong>{state.profile.hiringSpecialization}</strong>
            </div>
            {state.profile.linkedInUrl && (
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Profile: </span>
                <a href={state.profile.linkedInUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                  {state.profile.linkedInUrl}
                </a>
              </div>
            )}
          </div>
          {state.profile.professionalBio && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              <em>"{state.profile.professionalBio}"</em>
            </div>
          )}
        </div>

        {/* Card 2: Company Profile */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-navy)' }}>
              <Building2 size={16} style={{ color: '#16A34A' }} />
              Company Information
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onJumpToStep(4)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Edit2 size={12} /> Edit Company
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Company: </span>
              <strong>{state.company.companyName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Industry: </span>
              <strong>{state.company.industry}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Size: </span>
              <strong>{state.company.companySize}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Stage: </span>
              <strong>{state.company.companyStage}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Location: </span>
              <strong>{state.company.location}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)' }}>Website: </span>
              <a href={state.company.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                {state.company.website}
              </a>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.375rem' }}>
              Hiring Domains:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {state.company.hiringDomains.map((d) => (
                <span
                  key={d}
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#15803D',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 0,
                    fontWeight: 500,
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Hiring Preferences */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--color-navy)' }}>
              <Briefcase size={16} style={{ color: 'var(--color-blue)' }} />
              Hiring Preferences &amp; Target Openings
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onJumpToStep(5)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Edit2 size={12} /> Edit Preferences
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.8125rem' }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Target Openings:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {state.hiring.rolesCommonlyHired.map((r) => (
                  <span
                    key={r}
                    style={{
                      background: 'var(--color-blue-tint)',
                      border: '1px solid var(--color-blue-line)',
                      color: 'var(--color-blue-hover)',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 0,
                      fontWeight: 500,
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Skills Highlighted:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {state.hiring.technicalSkillsSought.map((s) => (
                  <span
                    key={s}
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border-hover)',
                      color: 'var(--color-navy)',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 0,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.25rem' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Work Arrangements: </span>
                <span>{state.hiring.workArrangements.join(', ') || 'Flexible'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Employment Types: </span>
                <span>{state.hiring.employmentTypes.join(', ') || 'Full-Time'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Guidelines Confirmation Checkbox */}
        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1rem',
            marginTop: '0.5rem',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={state.agreedToGuidelines}
              onChange={(e) => {
                onAgreeChange(e.target.checked);
                if (error) setError('');
              }}
              style={{ marginTop: '0.2rem', cursor: 'pointer' }}
            />
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-navy)', lineHeight: 1.5 }}>
              <strong>Fair Hiring &amp; Skill Evidence Agreement:</strong> I confirm that
              candidate evaluations will be grounded in verifiable skill evidence. I acknowledge
              that hiring decisions, interviews, and recruiter notes do not alter or award
              verified Skill Passport tiers.
            </div>
          </label>
          {error && <p className="form-error-msg" style={{ marginTop: '0.5rem' }}>{error}</p>}
        </div>

        {/* Actions */}
        <div className="founder-step-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleFinish}
            style={{ minWidth: '200px' }}
          >
            <span>Confirm &amp; Complete</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
