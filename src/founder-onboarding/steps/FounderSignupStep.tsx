import React, { useState } from 'react';
import type { FounderAccount } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput,
  FormNav, CheckboxField, InfoNotice,
} from '../../onboarding/shared';
import { Eye, EyeOff } from 'lucide-react';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password: string): string {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return '';
}

interface FounderSignupStepProps {
  data: FounderAccount;
  onChange: (d: FounderAccount) => void;
  onNext: () => void;
  onSignInClick?: () => void;
}

interface Errors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreedToTerms?: string;
  phoneNumber?: string;
}

export const FounderSignupStep: React.FC<FounderSignupStepProps> = ({
  data,
  onChange,
  onNext,
  onSignInClick,
}) => {
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field: keyof FounderAccount, value: string | boolean) => {
    onChange({ ...data, [field]: value });
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    const name = data.fullName.trim();
    if (!name) errs.fullName = 'Full name is required.';

    const email = data.email.trim();
    if (!email) errs.email = 'Work email address is required.';
    else if (!validateEmail(email)) errs.email = 'Enter a valid email address.';

    const pwError = validatePassword(data.password);
    if (!data.password) errs.password = 'Password is required.';
    else if (pwError) errs.password = pwError;

    if (!data.confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (data.password !== data.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (!data.agreedToTerms) {
      errs.agreedToTerms = 'You must agree to the Terms of Service and Privacy Policy to continue.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onNext();
  };

  const passwordStrength = (() => {
    const p = data.password;
    if (!p) return null;
    const score =
      (p.length >= 8 ? 1 : 0) +
      (/[A-Z]/.test(p) ? 1 : 0) +
      (/[0-9]/.test(p) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(p) ? 1 : 0);
    if (score <= 1) return { label: 'Weak', cls: 'weak' };
    if (score === 2) return { label: 'Fair', cls: 'fair' };
    if (score === 3) return { label: 'Good', cls: 'good' };
    return { label: 'Strong', cls: 'strong' };
  })();

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Stage 1 of 6 — Founder Account"
        heading="Bring your vision to life."
        subheading="Connect with talented professionals, build your team, and turn your ideas into meaningful work."
      />

      <InfoNotice variant="info">
        <strong>Frontend Prototype:</strong> No server account will be created. Passwords and credentials
        are never transmitted or persisted to cloud services.
      </InfoNotice>

      <div className="ob-form">
        {/* Full Name */}
        <FieldGroup
          label="Full name"
          htmlFor="founder-name"
          required
          error={errors.fullName}
        >
          <TextInput
            inputId="founder-name"
            type="text"
            placeholder="e.g. Maya Chen"
            value={data.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            autoComplete="name"
            error={errors.fullName}
          />
        </FieldGroup>

        {/* Work Email */}
        <FieldGroup
          label="Work email"
          htmlFor="founder-email"
          required
          hint="We suggest using your startup domain or professional email address."
          error={errors.email}
        >
          <TextInput
            inputId="founder-email"
            type="email"
            placeholder="maya@yourstartup.com"
            value={data.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
            error={errors.email}
          />
        </FieldGroup>

        {/* Phone Number (Optional) */}
        <FieldGroup
          label="Phone number (optional)"
          htmlFor="founder-phone"
          hint="For direct founder verification and partner communications."
        >
          <TextInput
            inputId="founder-phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={data.phoneNumber || ''}
            onChange={(e) => set('phoneNumber', e.target.value)}
            autoComplete="tel"
          />
        </FieldGroup>

        {/* Password */}
        <FieldGroup
          label="Password"
          htmlFor="founder-password"
          required
          hint="At least 8 characters, one uppercase letter, and one number."
          error={errors.password}
        >
          <div className="ob-input-icon-wrapper">
            <TextInput
              inputId="founder-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a secure password"
              value={data.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
              error={errors.password}
            />
            <button
              type="button"
              className="ob-input-toggle-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordStrength && !errors.password && (
            <div className="ob-password-strength" aria-live="polite">
              <div className={`ob-strength-bar ob-strength-${passwordStrength.cls}`} aria-hidden="true">
                <div className="ob-strength-fill" />
              </div>
              <span className={`ob-strength-label ob-strength-${passwordStrength.cls}`}>
                {passwordStrength.label}
              </span>
            </div>
          )}
        </FieldGroup>

        {/* Confirm Password */}
        <FieldGroup
          label="Confirm password"
          htmlFor="founder-confirm-password"
          required
          error={errors.confirmPassword}
        >
          <div className="ob-input-icon-wrapper">
            <TextInput
              inputId="founder-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={data.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              autoComplete="new-password"
              error={errors.confirmPassword}
            />
            <button
              type="button"
              className="ob-input-toggle-btn"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FieldGroup>

        {/* Terms & Privacy Consent */}
        <CheckboxField
          id="founder-terms"
          checked={data.agreedToTerms}
          onChange={(v) => set('agreedToTerms', v)}
          error={errors.agreedToTerms}
          label={
            <>
              I agree to the{' '}
              <a href="#" className="ob-inline-link">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="ob-inline-link">Privacy Policy</a>.
            </>
          }
        />
      </div>

      <FormNav
        onNext={handleSubmit}
        nextLabel="Create Founder Account"
        nextId="founder-signup-btn"
      />

      <p className="ob-step-footer-note">
        Already registered?{' '}
        <button
          type="button"
          className="ob-inline-link-btn"
          onClick={onSignInClick}
        >
          Sign in
        </button>
      </p>
    </StepWrapper>
  );
};
