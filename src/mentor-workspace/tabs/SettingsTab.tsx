import React, { useState } from 'react';
import type { MentorWorkspaceState } from '../types';
import type { SessionFrequency } from '../../mentor-onboarding/types';
import {
  Bell,
  UserCheck,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Save,
} from 'lucide-react';

interface SettingsTabProps {
  workspace: MentorWorkspaceState;
  onUpdateWorkspace: (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => void;
  onExitToHome: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  workspace,
  onUpdateWorkspace,
  onExitToHome,
}) => {
  const { settings } = workspace;

  const [maxActiveMentees, setMaxActiveMentees] = useState(settings.maxActiveMentees || 3);
  const [weeklyAvailabilityHours, setWeeklyAvailabilityHours] = useState(
    settings.weeklyAvailabilityHours || 4
  );
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(
    settings.sessionDurationMinutes || 45
  );
  const [sessionFrequency, setSessionFrequency] = useState<SessionFrequency>(
    settings.sessionFrequency || 'weekly'
  );
  const [profileVisibility, setProfileVisibility] = useState<
    'public' | 'mentees-only' | 'private'
  >(settings.profileVisibility || 'public');

  const [notifyNewRequests, setNotifyNewRequests] = useState(settings.notifyNewRequests ?? true);
  const [notifyUpcomingSessions, setNotifyUpcomingSessions] = useState(
    settings.notifyUpcomingSessions ?? true
  );
  const [weeklyDigest, setWeeklyDigest] = useState(settings.weeklyDigest ?? true);

  const [toastMsg, setToastMsg] = useState('');
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    onUpdateWorkspace((prev) => ({
      ...prev,
      settings: {
        maxActiveMentees,
        weeklyAvailabilityHours,
        sessionDurationMinutes,
        sessionFrequency,
        profileVisibility,
        notifyNewRequests,
        notifyUpcomingSessions,
        weeklyDigest,
      },
      preferences: {
        ...prev.preferences,
        maxActiveMentees,
        weeklyAvailabilityHours,
        sessionDurationMinutes,
        sessionFrequency,
      },
    }));

    setToastMsg('Preferences & configuration saved successfully.');
    setTimeout(() => setToastMsg(''), 4000);
  };


  return (
    <div className="tab-pane-content" style={{ padding: '24px 32px', maxWidth: '820px' }}>
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 6px 0' }}>
          Mentor Workspace Settings
        </h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
          Configure your mentee capacity limits, notification preferences, and local prototype state.
        </p>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            padding: '10px 16px',
            borderRadius: 0,
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Card 1: Capacity & Availability */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <UserCheck size={18} color="var(--color-blue)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Capacity & Availability Limits
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Max Concurrent Active Mentees
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxActiveMentees}
                onChange={(e) => setMaxActiveMentees(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 0,
                  border: '1px solid var(--color-border-hover)',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-faint)', marginTop: '4px', display: 'block' }}>
                Warnings will appear if requests exceed this preferred limit.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Weekly Availability Commitment (Hours)
              </label>
              <input
                type="number"
                min={1}
                max={25}
                value={weeklyAvailabilityHours}
                onChange={(e) => setWeeklyAvailabilityHours(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 0,
                  border: '1px solid var(--color-border-hover)',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--color-text-faint)', marginTop: '4px', display: 'block' }}>
                Estimated hours allocated across all mentees per week.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Default Session Duration
              </label>
              <select
                value={sessionDurationMinutes}
                onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 0,
                  border: '1px solid var(--color-border-hover)',
                  fontSize: '0.85rem',
                }}
              >
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes (Recommended)</option>
                <option value={60}>60 Minutes</option>
                <option value={90}>90 Minutes</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                Preferred Cadence
              </label>
              <select
                value={sessionFrequency}
                onChange={(e) => setSessionFrequency(e.target.value as SessionFrequency)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 0,
                  border: '1px solid var(--color-border-hover)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="weekly">Weekly Check-in</option>
                <option value="bi-weekly">Bi-weekly Check-in</option>
                <option value="monthly">Monthly Check-in</option>
                <option value="flexible">Flexible / Milestone Based</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Discovery & Visibility */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Eye size={18} color="var(--color-blue)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Profile Visibility & Discovery
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                border: '1px solid var(--color-border)',
                borderRadius: 0,
                cursor: 'pointer',
                background: profileVisibility === 'public' ? 'var(--color-blue-tint)' : '#FFFFFF',
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={profileVisibility === 'public'}
                onChange={() => setProfileVisibility('public')}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-navy)' }}>Public Discovery</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Visible to talent and learners seeking mentorship across YOGYATA tracks.
                </p>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                border: '1px solid var(--color-border)',
                borderRadius: 0,
                cursor: 'pointer',
                background: profileVisibility === 'mentees-only' ? 'var(--color-blue-tint)' : '#FFFFFF',
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={profileVisibility === 'mentees-only'}
                onChange={() => setProfileVisibility('mentees-only')}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-navy)' }}>Accepted Mentees Only</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Hide profile from general search; only accessible to learners you have approved.
                </p>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                border: '1px solid var(--color-border)',
                borderRadius: 0,
                cursor: 'pointer',
                background: profileVisibility === 'private' ? 'var(--color-blue-tint)' : '#FFFFFF',
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={profileVisibility === 'private'}
                onChange={() => setProfileVisibility('private')}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-navy)' }}>Private / Sabbatical</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Pause new mentorship requests while you focus on current commitments.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Card 3: Notification Simulation */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--color-border)',
            borderRadius: 0,
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Bell size={18} color="var(--color-blue)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Simulated Notifications
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                  New Mentorship Request Alerts
                </span>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                  Receive dashboard indicators when learners submit requests.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyNewRequests}
                onChange={(e) => setNotifyNewRequests(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                  Upcoming Session Reminders
                </span>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                  Highlight sessions scheduled within the next 48 hours.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyUpcomingSessions}
                onChange={(e) => setNotifyUpcomingSessions(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                  Mentee Milestone Progress Digest
                </span>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                  Summary of action items checked off by active mentees.
                </p>
              </div>
              <input
                type="checkbox"
                checked={weeklyDigest}
                onChange={(e) => setWeeklyDigest(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>

        {/* Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            style={{
              padding: '9px 24px',
              borderRadius: 0,
              background: 'var(--color-blue)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Save size={15} /> Save All Settings
          </button>
        </div>

        {/* Danger Zone: Reset & Exit */}
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 0,
            padding: '24px',
            marginTop: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={18} color="#DC2626" />
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#991B1B', margin: 0 }}>
              Account
            </h2>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#7F1D1D' }}>
            Sign out of the mentor workspace on this device.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsExitModalOpen(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 0,
                background: '#FFFFFF',
                border: '1px solid var(--color-border-hover)',
                color: 'var(--color-text-muted)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </form>


      {/* Exit Confirmation Modal */}
      {isExitModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 0,
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <LogOut size={20} color="var(--color-blue)" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                Exit to Role Selection?
              </h2>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Your workspace data is saved in your local browser and you can return anytime via the Mentor role or
              <code>#mentor-workspace</code>.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsExitModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 0,
                  background: '#FFFFFF',
                  border: '1px solid var(--color-border-hover)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Stay Here
              </button>
              <button
                type="button"
                onClick={onExitToHome}
                style={{
                  padding: '8px 18px',
                  borderRadius: 0,
                  background: 'var(--color-blue)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Exit to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
