import React, { useState, useEffect } from 'react';
import { ShieldCheck, Mail, ArrowRight, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import type { RecruiterAccount } from '../types';

interface RecruiterVerifyDomainStepProps {
  account: RecruiterAccount;
  onChange: (data: Partial<RecruiterAccount>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const RecruiterVerifyDomainStep: React.FC<RecruiterVerifyDomainStepProps> = ({
  account,
  onChange,
  onNext,
  onBack,
}) => {
  const [code, setCode] = useState(account.verificationCode || '');
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSimulateFill = () => {
    const demoCode = '742918';
    setCode(demoCode);
    setError('');
  };

  const handleResend = () => {
    setResendCooldown(30);
    setError('');
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    if (code.trim().length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    onChange({
      isSimulatedVerified: true,
      verificationCode: code.trim(),
    });
    onNext();
  };

  return (
    <div className="founder-step-card">
      <div className="founder-step-header">
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#F0FDF4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#15803D',
            marginBottom: '1rem',
          }}
        >
          <ShieldCheck size={26} />
        </div>
        <h2 className="founder-step-title">Simulated Domain &amp; Work Email Verification</h2>
        <p className="founder-step-subtitle">
          We sent a simulated 6-digit security code to{' '}
          <strong>{account.workEmail || 'your email'}</strong>.
        </p>
      </div>

      <div
        className="alert-banner alert-banner-warning"
        style={{
          background: '#FFFBEB',
          borderColor: '#FDE68A',
          color: '#92400E',
          marginBottom: '1.5rem',
        }}
      >
        <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
          <strong>Prototype Simulation:</strong> No external email is sent and no
          independent enterprise authorization is verified. A corporate email domain
          in this prototype is treated as candidate discovery demo context only.
        </div>
      </div>

      <form onSubmit={handleVerify}>
        <div className="form-group">
          <label htmlFor="recruiter-otp" className="form-label">
            6-Digit Verification Code <span className="required-star">*</span>
          </label>
          <div className="input-with-icon">
            <Mail size={18} className="input-icon" />
            <input
              id="recruiter-otp"
              type="text"
              maxLength={6}
              className={`form-input ${error ? 'has-error' : ''}`}
              placeholder="e.g. 742918"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setCode(val);
                if (error) setError('');
              }}
              style={{ letterSpacing: '4px', fontWeight: 600, fontSize: '1.125rem' }}
              autoComplete="one-time-code"
            />
          </div>
          {error && <p className="form-error-msg">{error}</p>}
        </div>

        {/* Demo Helper & Resend Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            margin: '1rem 0 2rem',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSimulateFill}
            style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem' }}
          >
            Auto-fill Demo Code (742918)
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <RefreshCw size={14} className={resendCooldown > 0 ? 'spin' : ''} />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>

        {/* Navigation Actions */}
        <div className="founder-step-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button type="submit" className="btn-primary" style={{ minWidth: '180px' }}>
            <span>Verify &amp; Continue</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
