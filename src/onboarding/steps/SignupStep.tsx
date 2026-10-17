import React, { useState } from 'react';
import type { AccountData } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput,
  FormNav, CheckboxField, InfoNotice,
} from '../shared';
import { Eye, EyeOff } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password: string): string {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return '';
}

interface SignupStepProps {
  data: AccountData;
  onChange: (d: AccountData) => void;
  onNext: () => void;
}

interface Errors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreedToTerms?: string;
}

export const SignupStep: React.FC<SignupStepProps> = ({
  data,
  onChange,
  onNext,
}) => {
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field: keyof AccountData, value: string | boolean) => {
    onChange({ ...data, [field]: value });
    // Clear the error for this field on change
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errs: Errors = {};

    const name = data.fullName.trim();
    if (!name) errs.fullName = 'Full name is required.';

    const email = data.email.trim();
    if (!email) errs.email = 'Email address is required.';
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
      errs.agreedToTerms = 'You must agree to the Terms and Privacy Policy to continue.';
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
        eyebrow="Step 1 of 5 — Account"
        heading="Let's build your career profile."
        subheading="Create your YOGYATA account and take the first step towards proving your skills."
      />

      <InfoNotice variant="info">
        This is a frontend prototype. No account will be created on a server.
        Backend integration will be connected in the next development phase.
      </InfoNotice>

      <div className="ob-form">
        {/* Full Name */}
        <FieldGroup
          label="Full name"
          htmlFor="signup-name"
          required
          error={errors.fullName}
        >
          <TextInput
            inputId="signup-name"
            type="text"
            placeholder="Jane Doe"
            value={data.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            autoComplete="name"
            error={errors.fullName}
          />
        </FieldGroup>

        {/* Email */}
        <FieldGroup
          label="Email address"
          htmlFor="signup-email"
          required
          error={errors.email}
        >
          <TextInput
            inputId="signup-email"
            type="email"
            placeholder="jane@example.com"
            value={data.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
            error={errors.email}
          />
        </FieldGroup>

        {/* Password */}
        <FieldGroup
          label="Password"
          htmlFor="signup-password"
          required
          hint="At least 8 characters, one uppercase letter, and one number."
          error={errors.password}
        >
          <div className="ob-input-icon-wrapper">
            <TextInput
              inputId="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
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
              tabIndex={0}
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
          htmlFor="signup-confirm"
          required
          error={errors.confirmPassword}
        >
          <div className="ob-input-icon-wrapper">
            <TextInput
              inputId="signup-confirm"
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

        {/* Terms */}
        <CheckboxField
          id="signup-terms"
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
        nextLabel="Create Account"
        nextId="signup-create-btn"
      />

      <p className="ob-step-footer-note">
        Already have an account?{' '}
        <button type="button" className="ob-inline-link-btn">Sign in</button>
      </p>
    </StepWrapper>
  );
};
