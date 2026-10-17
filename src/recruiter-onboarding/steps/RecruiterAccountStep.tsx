import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User, ShieldAlert, ArrowRight } from 'lucide-react';
import type { RecruiterAccount } from '../types';

interface RecruiterAccountStepProps {
  data: RecruiterAccount;
  onChange: (data: Partial<RecruiterAccount>) => void;
  onNext: () => void;
}

export const RecruiterAccountStep: React.FC<RecruiterAccountStepProps> = ({
  data,
  onChange,
  onNext,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!data.fullName.trim()) {
      errs.fullName = 'Full name is required';
    }

    if (!data.workEmail.trim()) {
      errs.workEmail = 'Work email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.workEmail)) {
      errs.workEmail = 'Please enter a valid work email address';
    }

    if (!data.password) {
      errs.password = 'Password is required';
    } else if (data.password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }

    if (!data.confirmPassword) {
      errs.confirmPassword = 'Confirm your password';
    } else if (data.password !== data.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
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
        <h2 className="founder-step-title">Create Recruiter Account</h2>
        <p className="founder-step-subtitle">
          Sign up to search verified Skill Passport profiles, evaluate evidence,
          and organize your talent pipeline.
        </p>
      </div>

      <div
        className="alert-banner alert-banner-info"
        style={{
          background: '#F0FDF4',
          borderColor: '#BBF7D0',
          color: '#166534',
          marginBottom: '1.5rem',
        }}
      >
        <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
          <strong>Prototype Notice:</strong> Account authentication is simulated in
          this frontend prototype. Credentials are validated locally and plain-text
          passwords are <em>never</em> stored in localStorage drafts.
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Full Name */}
        <div className="form-group">
          <label htmlFor="recruiter-fullName" className="form-label">
            Full Name <span className="required-star">*</span>
          </label>
          <div className="input-with-icon">
            <User size={18} className="input-icon" />
            <input
              id="recruiter-fullName"
              type="text"
              className={`form-input ${errors.fullName ? 'has-error' : ''}`}
              placeholder="e.g. Shalini Menon"
              value={data.fullName}
              onChange={(e) => {
                onChange({ fullName: e.target.value });
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              autoComplete="name"
            />
          </div>
          {errors.fullName && <p className="form-error-msg">{errors.fullName}</p>}
        </div>

        {/* Work Email */}
        <div className="form-group">
          <label htmlFor="recruiter-workEmail" className="form-label">
            Work Email <span className="required-star">*</span>
          </label>
          <div className="input-with-icon">
            <Mail size={18} className="input-icon" />
            <input
              id="recruiter-workEmail"
              type="email"
              className={`form-input ${errors.workEmail ? 'has-error' : ''}`}
              placeholder="e.g. shalini@acmecorp.com"
              value={data.workEmail}
              onChange={(e) => {
                onChange({ workEmail: e.target.value });
                if (errors.workEmail) setErrors((prev) => ({ ...prev, workEmail: '' }));
              }}
              autoComplete="email"
            />
          </div>
          {errors.workEmail && <p className="form-error-msg">{errors.workEmail}</p>}
          <span className="form-help-text">
            Use your corporate or organization work email to connect with your company profile.
          </span>
        </div>

        {/* Password */}
        <div className="form-group">
          <label htmlFor="recruiter-password" className="form-label">
            Password <span className="required-star">*</span>
          </label>
          <div className="input-with-icon">
            <Lock size={18} className="input-icon" />
            <input
              id="recruiter-password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${errors.password ? 'has-error' : ''}`}
              placeholder="At least 8 characters"
              value={data.password || ''}
              onChange={(e) => {
                onChange({ password: e.target.value });
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
              }}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="form-error-msg">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label htmlFor="recruiter-confirmPassword" className="form-label">
            Confirm Password <span className="required-star">*</span>
          </label>
          <div className="input-with-icon">
            <Lock size={18} className="input-icon" />
            <input
              id="recruiter-confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              className={`form-input ${errors.confirmPassword ? 'has-error' : ''}`}
              placeholder="Re-enter your password"
              value={data.confirmPassword || ''}
              onChange={(e) => {
                onChange({ confirmPassword: e.target.value });
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
              }}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="form-error-msg">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Form Actions */}
        <div className="founder-step-actions" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button type="submit" className="btn-primary" style={{ minWidth: '180px' }}>
            <span>Continue to Verification</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
