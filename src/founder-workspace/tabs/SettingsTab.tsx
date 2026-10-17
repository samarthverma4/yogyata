import React, { useState } from 'react';
import type {
  FounderWorkspaceState,
  WorkspaceSettings,
} from '../types';

interface SettingsTabProps {
  workspace: FounderWorkspaceState;
  onUpdateSettings: (settings: WorkspaceSettings) => void;
  onResetWorkspace: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  workspace,
  onUpdateSettings,
  onResetWorkspace,
}) => {
  const [settings, setSettings] = useState<WorkspaceSettings>({
    ...workspace.settings,
  });
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleToggle = (key: keyof WorkspaceSettings) => {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);
    onUpdateSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleConfirmReset = () => {
    setIsResetModalOpen(false);
    onResetWorkspace();
  };

  return (
    <div className="yw-content">
      {saveSuccess && (
        <div className="yw-alert yw-alert-success" role="status" style={{ marginBottom: '1.25rem' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>Preferences saved to local workspace storage.</div>
        </div>
      )}

      {/* Prototype Settings Notice */}
      <div className="yw-alert yw-alert-info" style={{ marginBottom: '1.5rem' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <strong>Frontend Prototype Preferences:</strong> Configuration options here manage
          your local browser workspace behavior. Account credentials and security controls are not
          present because authentication is not connected to a backend.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Startup Directory Visibility */}
        <div className="yw-card">
          <h3 className="yw-card-title">Venture Visibility & Discovery</h3>
          <p className="yw-card-subtitle">
            Control how your startup profile and published challenges are showcased.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#1B2A4E', fontSize: '0.9375rem' }}>Stealth Mode</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.8125rem' }}>
                  Hide startup name and direct URLs from general directory searches.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.stealthMode}
                  onChange={() => handleToggle('stealthMode')}
                  style={{ width: '20px', height: '20px', accentColor: '#1B2A4E', cursor: 'pointer' }}
                  id="toggle-stealth-mode"
                />
              </label>
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#1B2A4E', fontSize: '0.9375rem' }}>
                  Allow Contributor Expressions of Interest
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.8125rem' }}>
                  Permit prospective job seekers and talent to submit direct proposals.
                </p>
              </div>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.allowPublicApplications}
                  onChange={() => handleToggle('allowPublicApplications')}
                  style={{ width: '20px', height: '20px', accentColor: '#1B2A4E', cursor: 'pointer' }}
                  id="toggle-public-apps"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Local Notification Preferences */}
        <div className="yw-card">
          <h3 className="yw-card-title">Workspace Notification Preferences</h3>
          <p className="yw-card-subtitle">
            Configure simulated alert preferences for incoming deliverables and milestones.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#1B2A4E', fontSize: '0.9375rem' }}>Email Notifications</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.8125rem' }}>
                  Receive summary updates at {workspace.accountEmail}.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={() => handleToggle('emailNotifications')}
                style={{ width: '20px', height: '20px', accentColor: '#1B2A4E', cursor: 'pointer' }}
              />
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#1B2A4E', fontSize: '0.9375rem' }}>
                  Task Submission Alerts
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.8125rem' }}>
                  Notify immediately when a candidate submits work for evaluation.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.contributorAlerts}
                onChange={() => handleToggle('contributorAlerts')}
                style={{ width: '20px', height: '20px', accentColor: '#1B2A4E', cursor: 'pointer' }}
              />
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#1B2A4E', fontSize: '0.9375rem' }}>
                  Weekly Venture Digest
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.8125rem' }}>
                  A weekly executive summary of challenge progress, applicant pipelines, and milestones.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.weeklyDigest}
                onChange={() => handleToggle('weeklyDigest')}
                style={{ width: '20px', height: '20px', accentColor: '#1B2A4E', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Data Architecture & Reset */}
        <div className="yw-card" style={{ borderColor: '#FECACA' }}>
          <h3 className="yw-card-title" style={{ color: '#DC2626' }}>
            Danger Zone & Data Reset
          </h3>
          <p className="yw-card-subtitle">
            Local browser storage controls for this prototype workspace.
          </p>

          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <strong style={{ color: '#991B1B', fontSize: '0.9375rem' }}>
                Reset Founder Workspace Data
              </strong>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.8125rem', maxWidth: '520px' }}>
                Clears all projects, custom task challenges, evaluation records, and profile edits
                saved in this browser. Onboarding drafts will remain untouched.
              </p>
            </div>

            <button
              type="button"
              className="yw-btn yw-btn-danger"
              onClick={() => setIsResetModalOpen(true)}
              id="btn-open-reset-modal"
            >
              Reset Workspace Data
            </button>
          </div>
        </div>
      </div>

      {/* ─── RESET CONFIRMATION MODAL ─── */}
      {isResetModalOpen && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-reset-title">
          <div className="yw-modal-box">
            <div className="yw-modal-header">
              <h3 id="modal-reset-title" className="yw-modal-title" style={{ color: '#DC2626' }}>
                Confirm Workspace Reset
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setIsResetModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="yw-modal-body">
              <p style={{ color: '#334155', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                Are you sure you want to reset your Founder Workspace?
              </p>
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '6px',
                  padding: '0.875rem',
                  fontSize: '0.875rem',
                  color: '#991B1B',
                  marginTop: '0.75rem',
                }}
              >
                This action will delete all local projects, tasks, and evaluations, and reinitialize
                the workspace state. This cannot be undone.
              </div>
            </div>

            <div className="yw-modal-footer">
              <button
                type="button"
                className="yw-btn yw-btn-secondary"
                onClick={() => setIsResetModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="yw-btn yw-btn-danger"
                onClick={handleConfirmReset}
                id="btn-confirm-workspace-reset"
              >
                Yes, Reset All Workspace Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
