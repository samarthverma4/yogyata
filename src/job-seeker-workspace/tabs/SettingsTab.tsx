import React, { useState } from 'react';
import {
  Eye,
  Bell,
  Shield,
  RotateCcw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { JobSeekerSettings } from '../types';

interface SettingsTabProps {
  settings: JobSeekerSettings;
  onUpdateSettings: (newSettings: JobSeekerSettings) => void;
  onResetDemoData: () => void;
  onExitToRoles: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  onResetDemoData,
  onExitToRoles,
}) => {
  const [formData, setFormData] = useState<JobSeekerSettings>(settings);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Top Header ── */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>
          Workspace &amp; Privacy Settings
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
          Manage your profile visibility, recruiter discovery consents, and demo preferences.
        </p>
      </div>

      {savedFeedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: '#ECFDF5',
            color: '#065F46',
            border: '1px solid #A7F3D0',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>Preferences updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* ── 1. Profile Visibility ── */}
        <div className="jsw-card">
          <h2 className="jsw-card-title" style={{ marginBottom: '1rem' }}>
            <Eye size={18} style={{ color: '#2563EB' }} />
            Profile Visibility &amp; Discovery
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '1rem',
                background: formData.profileVisibility === 'discoverable' ? '#EFF6FF' : '#F8FAFC',
                border: `1.5px solid ${formData.profileVisibility === 'discoverable' ? '#2563EB' : '#E2E8F0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="profile-vis"
                checked={formData.profileVisibility === 'discoverable'}
                onChange={() => setFormData({ ...formData, profileVisibility: 'discoverable' })}
                style={{ marginTop: '2px', accentColor: '#2563EB' }}
              />
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                  Discoverable to Verified Recruiters (Recommended)
                </strong>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.4 }}>
                  Verified enterprise recruiters and startup founders can find your Skill Passport credentials based on proven competencies.
                </p>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '1rem',
                background: formData.profileVisibility === 'private' ? '#EFF6FF' : '#F8FAFC',
                border: `1.5px solid ${formData.profileVisibility === 'private' ? '#2563EB' : '#E2E8F0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="profile-vis"
                checked={formData.profileVisibility === 'private'}
                onChange={() => setFormData({ ...formData, profileVisibility: 'private' })}
                style={{ marginTop: '2px', accentColor: '#2563EB' }}
              />
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#0F172A', display: 'block', marginBottom: '2px' }}>
                  Private (Only visible when applying)
                </strong>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.4 }}>
                  Your profile and evidence records will only be visible to employers you explicitly submit applications to.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* ── 2. Data & Partner Consents ── */}
        <div className="jsw-card">
          <h2 className="jsw-card-title" style={{ marginBottom: '1rem' }}>
            <Shield size={18} style={{ color: '#059669' }} />
            Data Sharing Consents
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.recruiterSharingConsent}
                onChange={(e) => setFormData({ ...formData, recruiterSharingConsent: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#2563EB' }}
              />
              <span>Allow verified hiring partners to send opportunity matches based on my Skill Passport</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.collegeSharingConsent}
                onChange={(e) => setFormData({ ...formData, collegeSharingConsent: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#2563EB' }}
              />
              <span>Share anonymized skill benchmark progress with academic or partner institutions (Optional)</span>
            </label>
          </div>
        </div>

        {/* ── 3. Simulated Notifications ── */}
        <div className="jsw-card">
          <h2 className="jsw-card-title" style={{ marginBottom: '1rem' }}>
            <Bell size={18} style={{ color: '#D97706' }} />
            Simulated Notification Preferences
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.emailAlerts}
                onChange={(e) => setFormData({ ...formData, emailAlerts: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#2563EB' }}
              />
              <span>Email updates for assessment completions and milestone achievements (Simulated)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.opportunityAlerts}
                onChange={(e) => setFormData({ ...formData, opportunityAlerts: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#2563EB' }}
              />
              <span>Alert me when new opportunities match my verified skill tags</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button type="submit" className="jsw-btn jsw-btn-primary" id="btn-save-settings">
            Save Preferences
          </button>
        </div>
      </form>

      {/* ── 4. Danger Zone / Demo Data Reset ── */}
      <div className="jsw-card" style={{ border: '1px solid #FECACA', background: '#FEF2F2' }}>
        <h2 className="jsw-card-title" style={{ color: '#991B1B', marginBottom: '0.75rem' }}>
          <AlertTriangle size={18} style={{ color: '#DC2626' }} />
          Reset Job Seeker Demo State
        </h2>

        <p style={{ fontSize: '0.8125rem', color: '#7F1D1D', lineHeight: 1.5, margin: '0 0 1.25rem' }}>
          Resetting will restore your Job Seeker workspace to factory demo candidate records. This operation affects <strong>ONLY</strong> Job Seeker data and strictly preserves Entrepreneur, Mentor, Recruiter, and Admin storage.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="jsw-btn"
            style={{ background: '#DC2626', color: '#FFFFFF' }}
            onClick={() => setShowResetModal(true)}
            id="btn-job-seeker-reset-demo"
          >
            <RotateCcw size={14} />
            <span>Reset Job Seeker Demo Data</span>
          </button>

          <button
            type="button"
            className="jsw-btn jsw-btn-secondary"
            onClick={onExitToRoles}
            id="btn-job-seeker-return-roles"
          >
            <LogOut size={14} />
            <span>Return to Role Selection</span>
          </button>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      {showResetModal && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
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
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Confirm Factory Demo Reset?
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5 }}>
              This will reset your Job Seeker profile, assessments, roadmap milestones, and application history to factory demo records. Entrepreneur, Mentor, and Recruiter modules remain untouched.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="jsw-btn jsw-btn-primary jsw-btn-sm"
                style={{ background: '#DC2626' }}
                onClick={() => {
                  onResetDemoData();
                  setShowResetModal(false);
                }}
                id="btn-confirm-reset-demo"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
