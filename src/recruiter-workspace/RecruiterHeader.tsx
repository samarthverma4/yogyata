import { BrandMark } from '../brand/BrandMark';
import React, { useState } from 'react';
import {
  Building2,
  Search,
  LogOut,
  MapPin,
  Menu,
} from 'lucide-react';
import type { RecruiterProfile, CompanyProfile, RecruiterWorkspaceTab } from './types';

interface RecruiterHeaderProps {
  recruiter: RecruiterProfile;
  company: CompanyProfile;
  activeTab: RecruiterWorkspaceTab;
  onTabChange: (tab: RecruiterWorkspaceTab) => void;
  onExitToHome: () => void;
  onToggleMobileMenu: () => void;
}

export const RecruiterHeader: React.FC<RecruiterHeaderProps> = ({
  recruiter,
  company,
  activeTab,
  onTabChange,
  onExitToHome,
  onToggleMobileMenu,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const recruiterDisplayName = recruiter.recruiterName || 'Talent Lead';
  const companyDisplayName = company.companyName || 'Hiring Organization';

  return (
    <header
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid var(--color-border)',
        padding: '0.75rem 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          maxWidth: '1600px',
          margin: '0 auto',
        }}
      >
        {/* Left: Mobile Toggle & Brand + Company identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <button
            type="button"
            className="btn-ghost recruiter-mobile-toggle-btn"
            onClick={onToggleMobileMenu}
            aria-label="Toggle mobile menu"
            style={{
              display: 'none',
              padding: '0.35rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <Menu size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <BrandMark />
            <span
              className="badge"
              style={{
                background: 'var(--color-blue-tint)',
                color: 'var(--color-blue)',
                border: '1px solid var(--color-blue-line)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: 0,
              }}
            >
              <Building2 size={12} />
              Recruiter
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: '0.5rem',
              paddingLeft: '0.875rem',
              borderLeft: '1px solid var(--color-border)',
              fontSize: '0.8125rem',
            }}
          >
            <strong style={{ color: 'var(--color-navy)' }}>{companyDisplayName}</strong>
            {company.location && (
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                }}
              >
                <MapPin size={11} /> {company.location}
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick actions & Recruiter Avatar & Exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onTabChange('talent-search')}
            style={{
              fontSize: '0.8125rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.35rem 0.75rem',
              background: activeTab === 'talent-search' ? 'var(--color-blue-tint)' : undefined,
              borderColor: activeTab === 'talent-search' ? 'var(--color-blue-line)' : undefined,
              color: activeTab === 'talent-search' ? 'var(--color-blue-hover)' : undefined,
            }}
          >
            <Search size={14} />
            Find Talent
          </button>

          {/* Recruiter Profile Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.25rem 0.5rem',
              borderRadius: 0,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-navy) 0%, #15803D 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            >
              {recruiterDisplayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                {recruiterDisplayName}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                {recruiter.jobTitle}
              </span>
            </div>
          </div>

          {/* Exit Role Selection */}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowExitConfirm(true)}
            style={{
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.6rem',
            }}
            title="Return to YOGYATA role selection"
          >
            <LogOut size={15} />
            <span>Switch Role</span>
          </button>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recruiter-exit-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '420px' }}>
            <h3
              id="recruiter-exit-title"
              style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: 'var(--color-navy)' }}
            >
              Leave Recruiter Workspace?
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
                margin: '0 0 1.25rem',
              }}
            >
              All candidate notes, pipeline stages, interviews, and scorecards are saved
              locally. You can return anytime via <code>#recruiter-workspace</code>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowExitConfirm(false)}
              >
                Stay Here
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExitToHome();
                }}
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
