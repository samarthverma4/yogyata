import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  Lock,
  RotateCcw,
  LogOut,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { RecruiterSettings, RecruiterProfile } from '../types';

interface SettingsTabProps {
  settings: RecruiterSettings;
  recruiter: RecruiterProfile;
  availableRoles: string[];
  onSaveSettings: (updated: RecruiterSettings) => void;
  onResetDemoData: () => void;
  onExitToHome: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  recruiter: _recruiter,
  availableRoles: _availableRoles,
  onSaveSettings,
  onResetDemoData,
  onExitToHome,
}) => {
  const [formData, setFormData] = useState<RecruiterSettings>(settings);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
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
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
          Workspace Settings &amp; Preferences
        </h2>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
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
            borderRadius: '6px',
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
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calendar size={16} style={{ color: '#D97706' }} />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
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
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Bell size={16} style={{ color: '#2563EB' }} />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
              Notification Preferences
            </h3>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: '#64748B' }}>
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
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Lock size={16} style={{ color: '#15803D' }} />
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
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

      {/* Danger Zone: Reset to Demo Data & Switch Role */}
      <div
        style={{
          background: '#FFF5F5',
          border: '1px solid #FED7D7',
          borderRadius: '8px',
          padding: '1.25rem',
          marginTop: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <AlertTriangle size={16} style={{ color: '#E53E3E' }} />
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#9B2C2C' }}>
            Prototype Management &amp; Demo Data
          </h3>
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#742A2A', lineHeight: 1.45 }}>
          Reset all recruiter pipeline records, scorecards, and interviews to the original factory seed
          dataset, or safely exit back to public role selection.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowResetConfirm(true)}
            style={{
              borderColor: '#FEB2B2',
              color: '#9B2C2C',
              background: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8125rem',
            }}
          >
            <RotateCcw size={14} />
            <span>Reset to Factory Demo Data</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onExitToHome}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8125rem',
            }}
          >
            <LogOut size={14} />
            <span>Return to Role Selection</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '420px' }}>
            <h3 id="reset-modal-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Reset Recruiter Demo Data?
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.84rem', color: '#64748B', lineHeight: 1.45 }}>
              This will restore the original demo candidates, pipeline stages, upcoming interviews,
              and sample scorecards. Any custom notes or scheduled interviews will be reset.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onResetDemoData();
                  setShowResetConfirm(false);
                }}
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
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
