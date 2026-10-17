import React, { useState } from 'react';
import type { MentorOnboardingState, MentorOnboardingView } from '../types';
import {
  CheckCircle2,
  Edit3,
  ArrowLeft,
  User,
  Award,
  Compass,
  AlertCircle,
} from 'lucide-react';

interface MentorReviewStepProps {
  state: MentorOnboardingState;
  onEdit: (view: MentorOnboardingView) => void;
  onComplete: () => void;
  onBack: () => void;
}

export const MentorReviewStep: React.FC<MentorReviewStepProps> = ({
  state,
  onEdit,
  onComplete,
  onBack,
}) => {
  const [confirmedGuidelines, setConfirmedGuidelines] = useState(false);
  const [error, setError] = useState('');

  const { account, profile, expertise, preferences } = state;

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedGuidelines) {
      setError('Please acknowledge the final profile verification confirmation.');
      return;
    }
    onComplete();
  };

  return (
    <div className="mob-step-container">
      <div className="mob-step-header">
        <span className="mob-step-tag">Step 6 of 6</span>
        <h2 className="mob-step-title">Review & Confirm Your Mentor Profile</h2>
        <p className="mob-step-subtitle">
          Please review your professional summary, coaching focus, and availability before publishing your profile.
        </p>
      </div>

      <form onSubmit={handleFinalSubmit} className="mob-form">
        {error && (
          <div className="yw-alert yw-alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Account & Profile Card */}
        <div className="yw-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} color="#2563EB" />
              Professional Identity
            </h3>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => onEdit('profile')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Edit3 size={14} />
              <span>Edit Profile</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Full Name</span>
              <div style={{ fontWeight: 700, color: '#1B2A4E', marginTop: '2px' }}>{account.fullName || 'Not provided'}</div>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Email Address</span>
              <div style={{ color: '#1B2A4E', marginTop: '2px' }}>{account.email}</div>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Current Role & Org</span>
              <div style={{ color: '#1B2A4E', marginTop: '2px' }}>
                {profile.currentRole} {profile.organization ? `@ ${profile.organization}` : ''}
              </div>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Experience Level</span>
              <div style={{ color: '#1B2A4E', marginTop: '2px' }}>
                {profile.yearsOfExperience} years ({expertise.experienceLevel})
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
            <span style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Professional Headline</span>
            <p style={{ margin: '3px 0 0.5rem 0', fontWeight: 600, color: '#2563EB', fontSize: '0.9rem' }}>
              {profile.headline}
            </p>
            <span style={{ color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Bio & Philosophy</span>
            <p style={{ margin: '3px 0 0 0', color: '#475569', fontSize: '0.84rem', lineHeight: 1.5 }}>
              {profile.bio}
            </p>
          </div>
        </div>

        {/* 2. Expertise & Skills Card */}
        <div className="yw-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} color="#D97706" />
              Expertise & Competencies
            </h3>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => onEdit('expertise')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Edit3 size={14} />
              <span>Edit Expertise</span>
            </button>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Focus Areas</span>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '4px' }}>
              {expertise.expertiseAreas.map((area) => (
                <span key={area} className="yw-badge yw-badge-neutral" style={{ fontSize: '0.75rem' }}>
                  {area}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Key Technologies</span>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '4px' }}>
              {expertise.technicalSkills.map((s) => (
                <span key={s} className="yw-skill-pill yw-skill-assessed" style={{ fontSize: '0.75rem' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
            <div>
              <strong style={{ color: '#64748B' }}>Industries: </strong>
              <span style={{ color: '#1B2A4E' }}>{expertise.industries.join(', ') || 'General Software'}</span>
            </div>
            <div>
              <strong style={{ color: '#64748B' }}>Languages: </strong>
              <span style={{ color: '#1B2A4E' }}>{expertise.languages.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* 3. Tracks & Schedule Preferences Card */}
        <div className="yw-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass size={18} color="#059669" />
              Offerings & Availability
            </h3>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => onEdit('tracks')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Edit3 size={14} />
              <span>Edit Tracks</span>
            </button>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Selected Coaching Tracks</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '4px' }}>
              {preferences.selectedTracks.map((t) => (
                <span key={t} className="yw-badge yw-badge-green" style={{ fontSize: '0.75rem' }}>
                  ✓ {t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.84rem', marginTop: '0.75rem' }}>
            <div>
              <strong style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Target Levels</strong>
              <span style={{ color: '#1B2A4E' }}>{preferences.preferredMenteeLevels.join(', ')}</span>
            </div>
            <div>
              <strong style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Format & Duration</strong>
              <span style={{ color: '#1B2A4E' }}>
                {preferences.sessionFormat === 'online' ? 'Online Video' : 'Flexible'} · {preferences.sessionDurationMinutes} min
              </span>
            </div>
            <div>
              <strong style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Weekly Commitment</strong>
              <span style={{ color: '#1B2A4E' }}>
                {preferences.weeklyAvailabilityHours} hrs/week (Max {preferences.maxActiveMentees} active mentees)
              </span>
            </div>
            <div>
              <strong style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Pricing Model</strong>
              <span style={{ color: '#1B2A4E', fontWeight: 600 }}>
                {preferences.pricingModel === 'free'
                  ? 'Community / Free'
                  : preferences.pricingModel === 'paid'
                  ? `Paid (${preferences.hourlyRate || '$75/session'})`
                  : 'Selective Scholarship'}
              </span>
            </div>
          </div>
        </div>

        {/* Final Acknowledgment */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem', marginBottom: '1.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="mentor-confirm-ack"
              checked={confirmedGuidelines}
              onChange={(e) => {
                setConfirmedGuidelines(e.target.checked);
                if (error) setError('');
              }}
              style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.45 }}>
              I confirm that my profile details are accurate and that I understand YOGYATA's evidence standard:
              Mentorship sessions provide coaching and formative feedback, while formal skill verification requires
              explicit evaluation of practical project challenges.
            </span>
          </label>
        </div>

        <div className="mob-actions-row">
          <button type="button" className="yw-btn yw-btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button
            type="submit"
            className="yw-btn yw-btn-primary"
            id="mentor-complete-launch-btn"
            style={{ minWidth: '220px', background: '#059669', borderColor: '#059669' }}
          >
            <CheckCircle2 size={16} />
            <span>Complete & Launch Workspace</span>
          </button>
        </div>
      </form>
    </div>
  );
};
