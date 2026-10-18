import React, { useState } from 'react';
import type { MentorProfile } from '../types';
import { sanitizeUrl } from '../storage';
import { Briefcase, Link2, ArrowLeft, ArrowRight, Award } from 'lucide-react';

interface MentorProfileStepProps {
  fullName: string;
  data: MentorProfile;
  onChange: (data: MentorProfile) => void;
  onNext: () => void;
  onBack: () => void;
}

export const MentorProfileStep: React.FC<MentorProfileStepProps> = ({
  fullName,
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!data.headline.trim()) {
      errs.headline = 'Professional headline is required.';
    }
    if (!data.currentRole.trim()) {
      errs.currentRole = 'Current role is required.';
    }
    if (data.yearsOfExperience === '' || Number(data.yearsOfExperience) < 1) {
      errs.yearsOfExperience = 'Please enter your years of experience (at least 1).';
    }
    if (!data.bio.trim()) {
      errs.bio = 'Please provide a brief professional biography.';
    } else if (data.bio.trim().length < 30) {
      errs.bio = 'Bio should be at least 30 characters.';
    }

    if (data.linkedInUrl && data.linkedInUrl.trim()) {
      const sanitized = sanitizeUrl(data.linkedInUrl);
      if (sanitized === '#') {
        errs.linkedInUrl = 'Please provide a valid HTTP or HTTPS URL.';
      }
    }
    if (data.portfolioUrl && data.portfolioUrl.trim()) {
      const sanitized = sanitizeUrl(data.portfolioUrl);
      if (sanitized === '#') {
        errs.portfolioUrl = 'Please provide a valid HTTP or HTTPS URL.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'ME';

  return (
    <div className="mob-step-container">
      <div className="mob-step-header">
        <span className="mob-step-tag">Step 3 of 6</span>
        <h2 className="mob-step-title">Your Mentor Profile</h2>
        <p className="mob-step-subtitle">
          Help prospective mentees understand your industry background, current focus, and leadership trajectory.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 1fr)', gap: '1.75rem' }}>
        {/* Form Column */}
        <form onSubmit={handleSubmit} noValidate className="mob-form">
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor="mentor-headline">
              Professional Headline <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="mentor-headline"
              type="text"
              className="yw-form-input"
              placeholder="e.g. Staff Distributed Systems Engineer | ex-Google"
              value={data.headline}
              onChange={(e) => {
                onChange({ ...data, headline: e.target.value });
                if (errors.headline) setErrors((prev) => ({ ...prev, headline: '' }));
              }}
            />
            {errors.headline && <span className="yw-form-error">{errors.headline}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-currentRole">
                Current Role / Title <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="mentor-currentRole"
                type="text"
                className="yw-form-input"
                placeholder="e.g. Lead Architect"
                value={data.currentRole}
                onChange={(e) => {
                  onChange({ ...data, currentRole: e.target.value });
                  if (errors.currentRole) setErrors((prev) => ({ ...prev, currentRole: '' }));
                }}
              />
              {errors.currentRole && <span className="yw-form-error">{errors.currentRole}</span>}
            </div>

            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-org">
                Organization / Company <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                id="mentor-org"
                type="text"
                className="yw-form-input"
                placeholder="e.g. Stripe, Independent"
                value={data.organization || ''}
                onChange={(e) => onChange({ ...data, organization: e.target.value })}
              />
            </div>
          </div>

          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor="mentor-experience">
              Years of Professional Experience <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="mentor-experience"
              type="number"
              min={1}
              max={50}
              className="yw-form-input"
              placeholder="e.g. 8"
              value={data.yearsOfExperience}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                onChange({ ...data, yearsOfExperience: val });
                if (errors.yearsOfExperience) setErrors((prev) => ({ ...prev, yearsOfExperience: '' }));
              }}
            />
            {errors.yearsOfExperience && <span className="yw-form-error">{errors.yearsOfExperience}</span>}
          </div>

          <div className="yw-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="yw-form-label" htmlFor="mentor-bio">
                Professional Bio & Mentorship Philosophy <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {data.bio.length}/500
              </span>
            </div>
            <textarea
              id="mentor-bio"
              className="yw-form-textarea"
              rows={4}
              maxLength={500}
              placeholder="Tell prospective mentees about your engineering/product journey, how you approach coaching, and what you enjoy working on together..."
              value={data.bio}
              onChange={(e) => {
                onChange({ ...data, bio: e.target.value });
                if (errors.bio) setErrors((prev) => ({ ...prev, bio: '' }));
              }}
            />
            {errors.bio && <span className="yw-form-error">{errors.bio}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-linkedin">
                LinkedIn Profile URL
              </label>
              <input
                id="mentor-linkedin"
                type="url"
                className="yw-form-input"
                placeholder="https://linkedin.com/in/username"
                value={data.linkedInUrl || ''}
                onChange={(e) => {
                  onChange({ ...data, linkedInUrl: e.target.value });
                  if (errors.linkedInUrl) setErrors((prev) => ({ ...prev, linkedInUrl: '' }));
                }}
              />
              {errors.linkedInUrl && <span className="yw-form-error">{errors.linkedInUrl}</span>}
            </div>

            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor="mentor-portfolio">
                GitHub / Portfolio URL
              </label>
              <input
                id="mentor-portfolio"
                type="url"
                className="yw-form-input"
                placeholder="https://github.com/username"
                value={data.portfolioUrl || ''}
                onChange={(e) => {
                  onChange({ ...data, portfolioUrl: e.target.value });
                  if (errors.portfolioUrl) setErrors((prev) => ({ ...prev, portfolioUrl: '' }));
                }}
              />
              {errors.portfolioUrl && <span className="yw-form-error">{errors.portfolioUrl}</span>}
            </div>
          </div>

          <div className="mob-actions-row" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="yw-btn yw-btn-secondary" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button type="submit" className="yw-btn yw-btn-primary" id="mentor-step3-continue">
              <span>Continue to Expertise</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {/* Live Preview Column */}
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            Live Mentee Preview
          </div>
          <div className="yw-card" style={{ padding: '1.5rem', background: '#FFFFFF', borderColor: 'var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--color-blue) 0%, var(--color-navy) 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {fullName || 'Your Name'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-blue)', fontWeight: 600 }}>
                  {data.headline || 'Your Headline Will Appear Here'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Briefcase size={14} color="var(--color-text-muted)" />
                {data.currentRole || 'Role'} {data.organization ? `@ ${data.organization}` : ''}
              </span>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Award size={14} color="#D97706" />
                {data.yearsOfExperience ? `${data.yearsOfExperience} yrs exp` : 'Years of exp'}
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0, fontStyle: data.bio ? 'normal' : 'italic' }}>
              {data.bio || 'Your mentoring philosophy and bio preview will appear here.'}
            </p>

            {(data.linkedInUrl || data.portfolioUrl) && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-surface-2)', display: 'flex', gap: '0.75rem', fontSize: '0.78rem' }}>
                {data.linkedInUrl && (
                  <span style={{ color: 'var(--color-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Link2 size={13} /> LinkedIn
                  </span>
                )}
                {data.portfolioUrl && (
                  <span style={{ color: 'var(--color-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Link2 size={13} /> Portfolio
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
