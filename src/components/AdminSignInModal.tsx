import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldAlert, ArrowLeft, Lock, Mail } from 'lucide-react';

interface AdminSignInModalProps {
  onClose: () => void;
  onSubmit: () => void;
}

export const AdminSignInModal: React.FC<AdminSignInModalProps> = ({
  onClose,
  onSubmit,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  // Focus email input on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog admin-signin-dialog">
        {/* Header */}
        <div className="modal-header admin-modal-header">
          <div className="admin-modal-title-group">
            <div className="admin-modal-icon" aria-hidden="true">
              <ShieldAlert size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="modal-title" id="admin-modal-title">
                Admin Sign In
              </h2>
              <p className="admin-modal-subtitle">
                Restricted access — authorised personnel only
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close admin sign in"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Restricted Access Notice */}
        <div className="admin-access-notice" role="note">
          <Lock size={13} strokeWidth={2} aria-hidden="true" />
          <span>
            Admin accounts are created and managed through a controlled
            administrative process. Public sign-up is not available.
          </span>
        </div>

        {/* Form */}
        <form
          className="admin-signin-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Admin sign in form"
        >
          {/* Email Field */}
          <div className="admin-form-field">
            <label
              htmlFor="admin-email"
              className="admin-form-label"
            >
              Email address
            </label>
            <div className="admin-input-wrapper">
              <span className="admin-input-icon" aria-hidden="true">
                <Mail size={15} strokeWidth={1.75} />
              </span>
              <input
                ref={emailRef}
                id="admin-email"
                type="email"
                className="admin-form-input"
                placeholder="admin@yogyata.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-required="true"
                aria-label="Admin email address"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="admin-form-field">
            <label
              htmlFor="admin-password"
              className="admin-form-label"
            >
              Password
            </label>
            <div className="admin-input-wrapper">
              <span className="admin-input-icon" aria-hidden="true">
                <Lock size={15} strokeWidth={1.75} />
              </span>
              <input
                id="admin-password"
                type="password"
                className="admin-form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-required="true"
                aria-label="Admin password"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-back-btn"
              onClick={onClose}
              id="admin-back-btn"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Back</span>
            </button>
            <button
              type="submit"
              className="admin-submit-btn"
              id="admin-submit-btn"
            >
              <ShieldAlert size={15} aria-hidden="true" />
              <span>Sign in</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
