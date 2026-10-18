import React, { useState } from 'react';
import {
  User,
  Briefcase,
  Link2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import type { RecruiterProfile } from '../types';
import { sanitizeRecruiterUrl } from '../storage';

interface RecruiterProfileStepProps {
  data: RecruiterProfile;
  fullNameFallback: string;
  onChange: (data: Partial<RecruiterProfile>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const RecruiterProfileStep: React.FC<RecruiterProfileStepProps> = ({
  data,
  fullNameFallback,
  onChange,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const displayName = data.recruiterName.trim() || fullNameFallback.trim() || 'Talent Lead';

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!data.recruiterName.trim() && !fullNameFallback.trim()) {
      errs.recruiterName = 'Display name is required';
    }

    if (!data.jobTitle.trim()) {
      errs.jobTitle = 'Job title is required';
    }

    if (!data.professionalBio.trim()) {
      errs.professionalBio = 'Please enter a brief recruiter bio';
    } else if (data.professionalBio.trim().length < 25) {
      errs.professionalBio = 'Biography must be at least 25 characters';
    }

    if (data.linkedInUrl.trim()) {
      const sanitized = sanitizeRecruiterUrl(data.linkedInUrl);
      if (!sanitized) {
        errs.linkedInUrl = 'Please provide a valid URL';
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

  return (
    <div className="founder-step-card">
      <div className="founder-step-header">
        <h2 className="founder-step-title">Recruiter Profile</h2>
        <p className="founder-step-subtitle">
          Introduce yourself to candidates and hiring managers across your talent network.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        <form onSubmit={handleSubmit} noValidate>
          {/* Recruiter Display Name */}
          <div className="form-group">
            <label htmlFor="recruiter-name" className="form-label">
              Display Name <span className="required-star">*</span>
            </label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                id="recruiter-name"
                type="text"
                className={`form-input ${errors.recruiterName ? 'has-error' : ''}`}
                placeholder="e.g. Shalini Menon"
                value={data.recruiterName || fullNameFallback}
                onChange={(e) => {
                  onChange({ recruiterName: e.target.value });
                  if (errors.recruiterName) setErrors((prev) => ({ ...prev, recruiterName: '' }));
                }}
              />
            </div>
            {errors.recruiterName && <p className="form-error-msg">{errors.recruiterName}</p>}
          </div>

          {/* Job Title & Experience Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="recruiter-title" className="form-label">
                Job Title <span className="required-star">*</span>
              </label>
              <div className="input-with-icon">
                <Briefcase size={18} className="input-icon" />
                <input
                  id="recruiter-title"
                  type="text"
                  className={`form-input ${errors.jobTitle ? 'has-error' : ''}`}
                  placeholder="e.g. Lead Technical Recruiter"
                  value={data.jobTitle}
                  onChange={(e) => {
                    onChange({ jobTitle: e.target.value });
                    if (errors.jobTitle) setErrors((prev) => ({ ...prev, jobTitle: '' }));
                  }}
                />
              </div>
              {errors.jobTitle && <p className="form-error-msg">{errors.jobTitle}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="recruiter-experience" className="form-label">
                Recruiting Experience <span className="required-star">*</span>
              </label>
              <select
                id="recruiter-experience"
                className="form-input"
                value={data.recruitingExperience}
                onChange={(e) => onChange({ recruitingExperience: e.target.value })}
              >
                <option value="1-2 years">1-2 years</option>
                <option value="3-5 years">3-5 years</option>
                <option value="5-8 years">5-8 years</option>
                <option value="8-12 years">8-12 years</option>
                <option value="12+ years">12+ years</option>
              </select>
            </div>
          </div>

          {/* Specialization */}
          <div className="form-group">
            <label htmlFor="recruiter-specialization" className="form-label">
              Primary Hiring Specialization <span className="required-star">*</span>
            </label>
            <select
              id="recruiter-specialization"
              className="form-input"
              value={data.hiringSpecialization}
              onChange={(e) => onChange({ hiringSpecialization: e.target.value })}
            >
              <option value="Engineering & Product">Software Engineering &amp; Product</option>
              <option value="AI / Machine Learning & Data">AI / Machine Learning &amp; Data Science</option>
              <option value="Cloud, DevOps & Security">Cloud Architecture &amp; Security</option>
              <option value="Design & Frontend Experience">UI/UX Design &amp; Frontend</option>
              <option value="Leadership & Executive">Leadership &amp; Executive Search</option>
              <option value="General Technical Talent">General Technical Talent</option>
            </select>
          </div>

          {/* Professional Biography */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="recruiter-bio" className="form-label">
                Professional Biography <span className="required-star">*</span>
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                {data.professionalBio.length}/500 chars
              </span>
            </div>
            <textarea
              id="recruiter-bio"
              rows={4}
              maxLength={500}
              className={`form-input ${errors.professionalBio ? 'has-error' : ''}`}
              placeholder="Tell candidates about your hiring focus, team philosophy, and what you look for in practical skill evidence..."
              value={data.professionalBio}
              onChange={(e) => {
                onChange({ professionalBio: e.target.value });
                if (errors.professionalBio) setErrors((prev) => ({ ...prev, professionalBio: '' }));
              }}
              style={{ resize: 'vertical' }}
            />
            {errors.professionalBio && (
              <p className="form-error-msg">{errors.professionalBio}</p>
            )}
          </div>

          {/* LinkedIn URL */}
          <div className="form-group">
            <label htmlFor="recruiter-linkedin" className="form-label">
              LinkedIn or Public Profile URL <span style={{ color: 'var(--color-text-subtle)' }}>(Optional)</span>
            </label>
            <div className="input-with-icon">
              <Link2 size={18} className="input-icon" />
              <input
                id="recruiter-linkedin"
                type="url"
                className={`form-input ${errors.linkedInUrl ? 'has-error' : ''}`}
                placeholder="https://linkedin.com/in/username"
                value={data.linkedInUrl}
                onChange={(e) => {
                  onChange({ linkedInUrl: e.target.value });
                  if (errors.linkedInUrl) setErrors((prev) => ({ ...prev, linkedInUrl: '' }));
                }}
              />
            </div>
            {errors.linkedInUrl && <p className="form-error-msg">{errors.linkedInUrl}</p>}
          </div>

          {/* Live Preview Card */}
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-navy)', fontSize: '0.8125rem', fontWeight: 600 }}>
              <Sparkles size={14} style={{ color: 'var(--color-blue)' }} />
              Live Candidate-Facing Preview
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-blue) 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                  flexShrink: 0,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-navy)' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {data.jobTitle || 'Technical Talent Acquisition'} • {data.recruitingExperience} exp
                </div>
                <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--color-blue)', fontWeight: 500 }}>
                  Specialization: {data.hiringSpecialization}
                </div>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-navy)', fontStyle: data.professionalBio ? 'normal' : 'italic', lineHeight: 1.4, margin: '0.5rem 0 0' }}>
                  {data.professionalBio || 'Bio will appear here as you type...'}
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="founder-step-actions" style={{ marginTop: '2rem' }}>
            <button type="button" className="btn-secondary" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button type="submit" className="btn-primary" style={{ minWidth: '180px' }}>
              <span>Continue to Company</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
