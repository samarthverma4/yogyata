import React, { useState } from 'react';
import type { MentorAccount } from '../types';
import { Eye, EyeOff, ShieldCheck, UserCheck } from 'lucide-react';

interface MentorAccountStepProps {
  data: MentorAccount;
  onChange: (data: MentorAccount) => void;
  onNext: () => void;
  onSignInClick?: () => void;
}

export const MentorAccountStep: React.FC<MentorAccountStepProps> = ({
  data,
  onChange,
  onNext,
  onSignInClick,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!data.fullName.trim()) {
      errs.fullName = 'Full name is required.';
    }
    if (!data.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!data.password) {
      errs.password = 'Password is required.';
    } else if (data.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (!data.confirmPassword) {
      errs.confirmPassword = 'Confirm your password.';
    } else if (data.password !== data.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    if (!data.agreedToTerms) {
      errs.agreedToTerms = 'You must agree to the platform guidelines to continue.';
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
    <div className="mob-step-container">
      <div className="mob-step-header">
        <span className="mob-step-tag">Step 1 of 6</span>
        <h2 className="mob-step-title">Create your Mentor Account</h2>
        <p className="mob-step-subtitle">
          Join YOGYATA to guide emerging builders, evaluate project challenges, and share industry wisdom.
        </p>
      </div>

      <div className="yw-alert yw-alert-info" style={{ marginBottom: '1.5rem' }}>
        <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Frontend Prototype Notice:</strong> Account creation is simulated locally in your browser.
          Passwords and authentication secrets are never transmitted to a server or saved in local storage drafts.
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mob-form">
        <div className="yw-form-group">
          <label className="yw-form-label" htmlFor="mentor-fullName">
            Full Name <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            id="mentor-fullName"
            type="text"
            className="yw-form-input"
            placeholder="e.g. Dr. Priya Venkatesh"
            value={data.fullName}
            onChange={(e) => {
              onChange({ ...data, fullName: e.target.value });
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
            }}
          />
          {errors.fullName && <span className="yw-form-error">{errors.fullName}</span>}
        </div>

        <div className="yw-form-group">
          <label className="yw-form-label" htmlFor="mentor-email">
            Professional Email Address <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input
            id="mentor-email"
            type="email"
            className="yw-form-input"
            placeholder="priya.v@organization.com"
            value={data.email}
            onChange={(e) => {
              onChange({ ...data, email: e.target.value });
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
            }}
          />
          {errors.email && <span className="yw-form-error">{errors.email}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor="mentor-password">
              Password <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="mentor-password"
                type={showPassword ? 'text' : 'password'}
                className="yw-form-input"
                placeholder="At least 8 characters"
                value={data.password || ''}
                onChange={(e) => {
                  onChange({ ...data, password: e.target.value });
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <span className="yw-form-error">{errors.password}</span>}
          </div>

          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor="mentor-confirmPassword">
              Confirm Password <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="mentor-confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="yw-form-input"
                placeholder="Re-enter password"
                value={data.confirmPassword || ''}
                onChange={(e) => {
                  onChange({ ...data, confirmPassword: e.target.value });
                  if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                }}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <span className="yw-form-error">{errors.confirmPassword}</span>}
          </div>
        </div>

        <div style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="mentor-agree-terms"
              checked={data.agreedToTerms}
              onChange={(e) => {
                onChange({ ...data, agreedToTerms: e.target.checked });
                if (errors.agreedToTerms) setErrors((prev) => ({ ...prev, agreedToTerms: '' }));
              }}
              style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.45 }}>
              I agree to the YOGYATA Mentorship Code of Conduct, committing to constructive, respectful,
              and evidence-based professional guidance.
            </span>
          </label>
          {errors.agreedToTerms && <span className="yw-form-error" style={{ display: 'block', marginTop: '4px' }}>{errors.agreedToTerms}</span>}
        </div>

        <div className="mob-actions-row">
          {onSignInClick && (
            <button
              type="button"
              className="yw-btn yw-btn-secondary"
              onClick={onSignInClick}
              style={{ fontSize: '0.85rem' }}
            >
              Already have an account? Sign in
            </button>
          )}
          <button
            type="submit"
            className="yw-btn yw-btn-primary"
            id="mentor-step1-continue"
            style={{ marginLeft: 'auto', minWidth: '160px' }}
          >
            <UserCheck size={16} />
            <span>Continue to Verification</span>
          </button>
        </div>
      </form>
    </div>
  );
};
