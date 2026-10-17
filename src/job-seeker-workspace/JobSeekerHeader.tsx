import React, { useState } from 'react';
import { Briefcase, LogOut, ShieldCheck } from 'lucide-react';
import type { JobSeekerProfile } from './types';

interface JobSeekerHeaderProps {
  profile: JobSeekerProfile;
  onExitToHome: () => void;
}

export const JobSeekerHeader: React.FC<JobSeekerHeaderProps> = ({
  profile,
  onExitToHome,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const initials = profile.fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'JS';

  return (
    <header className="jsw-header" role="banner">
      <div className="jsw-header-left">
        <span className="jsw-brand">YOGYATA</span>
        <span className="jsw-badge">
          <Briefcase size={13} />
          Job Seeker Workspace
        </span>
      </div>

      <div className="jsw-header-right">
        <div className="jsw-user-chip" title={profile.email}>
          <div className="jsw-avatar">{initials}</div>
          <span style={{ fontWeight: 600 }}>{profile.fullName || 'Candidate'}</span>
        </div>

        <button
          type="button"
          className="jsw-btn jsw-btn-secondary jsw-btn-sm"
          onClick={() => setShowExitConfirm(true)}
          id="btn-job-seeker-exit"
        >
          <LogOut size={14} />
          <span>Save &amp; Exit</span>
        </button>
      </div>

      {showExitConfirm && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-exit-js-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <h3 id="modal-exit-js-title" style={{ margin: 0, fontSize: '1.125rem', color: '#0F172A' }}>
                Exit Job Seeker Workspace?
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
              Your candidate profile, Skill Passport evidence, assessment results, and application records are autosaved in your browser.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                onClick={() => setShowExitConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="jsw-btn jsw-btn-primary jsw-btn-sm"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExitToHome();
                }}
                id="btn-confirm-job-seeker-exit"
              >
                Exit to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
