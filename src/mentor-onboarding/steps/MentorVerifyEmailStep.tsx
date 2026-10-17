import React, { useState } from 'react';
import { Mail, CheckCircle2, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';

interface MentorVerifyEmailStepProps {
  email: string;
  onNext: () => void;
  onBack: () => void;
}

export const MentorVerifyEmailStep: React.FC<MentorVerifyEmailStepProps> = ({
  email,
  onNext,
  onBack,
}) => {
  const [code, setCode] = useState(['8', '4', '2', '9', '1', '6']);
  const [error, setError] = useState('');
  const [resendNotice, setResendNotice] = useState(false);

  const handleCodeChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const updated = [...code];
    updated[index] = val;
    setCode(updated);
    if (error) setError('');

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`mentor-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleAutoFill = () => {
    setCode(['5', '9', '1', '7', '3', '0']);
    setError('');
  };

  const handleResend = () => {
    setResendNotice(true);
    setTimeout(() => setResendNotice(false), 4000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    onNext();
  };

  return (
    <div className="mob-step-container">
      <div className="mob-step-header">
        <span className="mob-step-tag">Step 2 of 6</span>
        <h2 className="mob-step-title">Verify your Email Address</h2>
        <p className="mob-step-subtitle">
          We simulated a confirmation code sent to <strong style={{ color: '#1B2A4E' }}>{email || 'your email'}</strong>.
        </p>
      </div>

      <div className="yw-alert yw-alert-info" style={{ marginBottom: '1.5rem' }}>
        <Mail size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>Prototype Simulation:</strong> No external email was dispatched. Use the pre-filled code or click
          "Auto-fill Code" below to test the verification step.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mob-form">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '1.5rem 0' }}>
          {code.map((digit, idx) => (
            <input
              key={idx}
              id={`mentor-otp-${idx}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(idx, e.target.value)}
              className="yw-form-input"
              style={{
                width: '48px',
                height: '52px',
                textAlign: 'center',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#1B2A4E',
              }}
            />
          ))}
        </div>

        {error && (
          <p className="yw-form-error" style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {resendNotice && (
          <div className="yw-alert yw-alert-success" style={{ margin: '1rem 0', justifyContent: 'center' }}>
            <CheckCircle2 size={18} />
            <span>Simulated code regenerated: 591730</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button
            type="button"
            className="yw-btn yw-btn-secondary yw-btn-sm"
            onClick={handleAutoFill}
          >
            Auto-fill Valid Code
          </button>
          <button
            type="button"
            className="yw-btn yw-btn-secondary yw-btn-sm"
            onClick={handleResend}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <RefreshCw size={14} />
            <span>Resend Code</span>
          </button>
        </div>

        <div className="mob-actions-row">
          <button
            type="button"
            className="yw-btn yw-btn-secondary"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            <span>Back to Account</span>
          </button>
          <button
            type="submit"
            className="yw-btn yw-btn-primary"
            id="mentor-step2-continue"
            style={{ minWidth: '160px' }}
          >
            <span>Confirm & Continue</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
