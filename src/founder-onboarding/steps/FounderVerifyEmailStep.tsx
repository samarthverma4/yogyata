import React, { useRef, useState } from 'react';
import { StepWrapper, StepHeader, FormNav, InfoNotice } from '../../onboarding/shared';
import { Mail, RefreshCw } from 'lucide-react';

interface FounderVerifyEmailStepProps {
  email: string;
  onNext: () => void;
  onBack: () => void;
}

export const FounderVerifyEmailStep: React.FC<FounderVerifyEmailStepProps> = ({
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
      setError('Please enter the full 6-digit verification code.');
      return;
    }
    onNext();
  };

  const handleResend = () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    setResendMessage('A new verification code simulation was triggered. You may use any 6-digit code in this prototype.');
    inputRefs.current[0]?.focus();
  };

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Stage 1 of 6 — Account Verification"
        heading="Verify your email"
        subheading="Founder verification ensures trusted venture listings and secure contributor matching."
      />

      <InfoNotice variant="warning">
        <strong>Prototype mode:</strong> No real email was dispatched. Enter any 6 digits and click Verify, or use the prototype bypass button below.
      </InfoNotice>

      {/* Email display */}
      <div className="ob-verify-email-display">
        <Mail size={18} aria-hidden="true" />
        <span>
          A verification code would be sent to{' '}
          <strong>{email || 'your work email'}</strong>
        </span>
      </div>

      {/* OTP Input */}
      <div className="ob-otp-group">
        <label className="ob-label" id="founder-otp-label">
          Enter 6-digit verification code
        </label>
        <div
          className="ob-otp-inputs"
          role="group"
          aria-labelledby="founder-otp-label"
          aria-describedby={error ? 'founder-otp-error' : undefined}
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
              id={`founder-otp-digit-${idx}`}
              autoComplete="one-time-code"
            />
          ))}
        </div>
        {error && (
          <p className="ob-field-error" role="alert" id="founder-otp-error">{error}</p>
        )}
        {resendMessage && (
          <p className="ob-field-hint" role="status">{resendMessage}</p>
        )}
      </div>

      {/* Resend Action */}
      <div className="ob-verify-actions">
        <button
          type="button"
          className="ob-text-action-btn"
          onClick={handleResend}
          id="founder-resend-code-btn"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Resend verification code
        </button>
      </div>

      {/* Development Prototype Skip */}
      <div className="ob-dev-notice">
        <span className="ob-dev-badge">PROTOTYPE</span>
        <button
          type="button"
          className="ob-dev-skip-btn"
          onClick={onNext}
          id="founder-skip-verification-btn"
        >
          Skip verification (Development simulation)
        </button>
      </div>

      <FormNav
        onBack={onBack}
        onNext={handleVerify}
        nextLabel="Verify & Continue"
        nextId="founder-verify-submit-btn"
      />
    </StepWrapper>
  );
};
