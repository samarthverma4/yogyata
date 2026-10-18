import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  Lock,
  LogOut,
  Check,
} from 'lucide-react';
import type { RecruiterSettings, RecruiterProfile } from '../types';

interface SettingsTabProps {
  settings: RecruiterSettings;
  recruiter: RecruiterProfile;
  availableRoles: string[];
  onSaveSettings: (updated: RecruiterSettings) => void;
  onExitToHome: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  recruiter: _recruiter,
  availableRoles: _availableRoles,
  onSaveSettings,
  onExitToHome,
}) => {
  const [formData, setFormData] = useState<RecruiterSettings>(settings);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleToggleNotification = (key: keyof RecruiterSettings['simulatedNotifications']) => {
    setFormData({
      ...formData,
      simulatedNotifications: {
        ...formData.simulatedNotifications,
        [key]: !formData.simulatedNotifications[key],
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '800px' }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-navy)' }}>
          Workspace Settings &amp; Preferences
        </h2>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Configure default interview durations, candidate visibility, and prototype notifications.
        </p>
      </div>

      {saveSuccess && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            padding: '0.625rem 1rem',
            borderRadius: 0,
            fontSize: '0.8125rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Check size={16} />
          <span>Settings saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Card 1: Interview Scheduling Defaults */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calendar size={16} style={{ color: '#D97706' }} />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-navy)' }}>
              Interview Scheduling Defaults
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Default Duration</label>
              <select
                className="form-input"
                value={formData.defaultInterviewDuration}
                onChange={(e) => setFormData({ ...formData, defaultInterviewDuration: Number(e.target.value) })}
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Default Format</label>
              <select
                className="form-input"
                value={formData.defaultInterviewFormat}
                onChange={(e) => setFormData({ ...formData, defaultInterviewFormat: e.target.value as any })}
              >
                <option value="video">Video Call (Google Meet / Zoom)</option>
                <option value="phone">Phone Screen</option>
                <option value="onsite">On-Site Office</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Simulated Notifications */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Bell size={16} style={{ color: 'var(--color-blue)' }} />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-navy)' }}>
              Notification Preferences
            </h3>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Prototype simulation: Controls in-app banner alerts for pipeline updates. No external emails are sent.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input
                type="checkbox"
                checked={formData.simulatedNotifications.newApplications}
                onChange={() => handleToggleNotification('newApplications')}
              />
              <span>Alert when verified candidates match our target skills</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input
                type="checkbox"
                checked={formData.simulatedNotifications.interviewReminders}
                onChange={() => handleToggleNotification('interviewReminders')}
              />
              <span>Send 24-hour reminder before scheduled technical rounds</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input
                type="checkbox"
                checked={formData.simulatedNotifications.scorecardAlerts}
                onChange={() => handleToggleNotification('scorecardAlerts')}
              />
              <span>Prompt interviewers when scorecards are pending after completed calls</span>
            </label>
          </div>
        </div>

        {/* Card 3: Discovery & Privacy */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Lock size={16} style={{ color: '#15803D' }} />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-navy)' }}>
              Candidate Data &amp; Visibility
            </h3>
          </div>

          <div className="form-group">
            <label className="form-label">Talent Pool Discovery Mode</label>
            <select
              className="form-input"
              value={formData.candidateVisibility}
              onChange={(e) => setFormData({ ...formData, candidateVisibility: e.target.value as any })}
            >
              <option value="public">Open Discovery — Show all verified Skill Passport candidates</option>
              <option value="shortlist-only">Restricted — Only show candidates in active pipeline or bookmarked</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.75rem' }}>
          <button type="submit" className="btn-primary" style={{ minWidth: '140px' }}>
            Save Preferences
          </button>
        </div>
      </form>

      {/* Account */}
      <div className="ws-card" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <p className="ws-card-subtitle" style={{ margin: 0 }}>
          Sign out of the recruiter workspace on this device.
        </p>
        <button type="button" className="ob-btn-secondary" onClick={onExitToHome}>
          <LogOut size={14} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
};
