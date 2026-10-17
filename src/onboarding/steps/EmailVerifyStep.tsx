import React, { useRef, useState } from 'react';
import { StepWrapper, StepHeader, FormNav, InfoNotice } from '../shared';
import { Mail, RefreshCw } from 'lucide-react';

interface EmailVerifyStepProps {
  email: string;
  onNext: () => void;
  onBack: () => void;
}

export const EmailVerifyStep: React.FC<EmailVerifyStepProps> = ({
  email,
  onNext,
  onBack,
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setError('');
    if (val && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    // Frontend prototype: no real OTP validation
    onNext();
  };

  const handleResend = () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    setResendMessage('A new code would be sent in a production environment. Continue with the prototype path.');
    inputRefs.current[0]?.focus();
  };

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Step 1 of 5 — Account"
        heading="Verify your email"
        subheading="Email verification helps protect your YOGYATA account."
      />

      <InfoNotice variant="warning">
        <strong>Prototype mode:</strong> No email will be sent. Enter any
        6-digit code and click Verify, or use the "Skip verification (prototype)" path below.
      </InfoNotice>

      {/* Email display */}
      <div className="ob-verify-email-display">
        <Mail size={18} aria-hidden="true" />
        <span>
          A verification code would be sent to{' '}
          <strong>{email || 'your email address'}</strong>
        </span>
      </div>

      {/* OTP Input */}
      <div className="ob-otp-group">
        <label className="ob-label" id="otp-label">
          Enter verification code
        </label>
        <div
          className="ob-otp-inputs"
          role="group"
          aria-labelledby="otp-label"
          aria-describedby={error ? 'otp-error' : undefined}
        >
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(idx, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
              className={`ob-otp-input ${error ? 'is-invalid' : ''}`}
              aria-label={`Digit ${idx + 1} of 6`}
              id={`otp-digit-${idx}`}
              autoComplete="one-time-code"
            />
          ))}
        </div>
        {error && (
          <p className="ob-field-error" role="alert" id="otp-error">{error}</p>
        )}
        {resendMessage && (
          <p className="ob-field-hint" role="status">{resendMessage}</p>
        )}
      </div>

      {/* Resend */}
      <div className="ob-verify-actions">
        <button
          type="button"
          className="ob-text-action-btn"
          onClick={handleResend}
          id="resend-code-btn"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Resend code
        </button>
      </div>

      {/* Prototype skip path */}
      <div className="ob-dev-notice">
        <span className="ob-dev-badge">DEV ONLY</span>
        <button
          type="button"
          className="ob-dev-skip-btn"
          onClick={onNext}
          id="skip-verification-btn"
        >
          Skip verification (prototype — not real authentication)
        </button>
      </div>

      <FormNav
        onBack={onBack}
        onNext={handleVerify}
        nextLabel="Verify"
        nextId="verify-email-btn"
      />
    </StepWrapper>
  );
};
