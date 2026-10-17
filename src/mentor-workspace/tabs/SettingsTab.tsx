import React, { useState } from 'react';
import type { MentorWorkspaceState } from '../types';
import type { SessionFrequency } from '../../mentor-onboarding/types';
import { createInitialMentorDemoData } from '../storage';
import {
  Bell,
  UserCheck,
  RotateCcw,
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
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
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

  const handleConfirmResetDemo = () => {
    const seed = createInitialMentorDemoData();

    onUpdateWorkspace((prev) => ({
      ...prev,
      requests: seed.requests,
      mentees: seed.mentees,
      sessions: seed.sessions,
      feedback: seed.feedback,
    }));

    setIsResetModalOpen(false);
    setToastMsg('Demo requests, mentees, sessions, and feedback reset to standard demo seed.');
    setTimeout(() => setToastMsg(''), 5000);
  };

  return (
    <div className="tab-pane-content" style={{ padding: '24px 32px', maxWidth: '820px' }}>
      {/* Header */}
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1B2A4E', margin: '0 0 6px 0' }}>
          Mentor Workspace Settings
        </h1>
        <p style={{ margin: 0, color: '#64748B', fontSize: '0.88rem' }}>
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
            borderRadius: '8px',
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
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <UserCheck size={18} color="#2563EB" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', margin: 0 }}>
              Capacity & Availability Limits
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                Warnings will appear if requests exceed this preferred limit.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
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
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                Estimated hours allocated across all mentees per week.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Default Session Duration
              </label>
              <select
                value={sessionDurationMinutes}
                onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
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
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Preferred Cadence
              </label>
              <select
                value={sessionFrequency}
                onChange={(e) => setSessionFrequency(e.target.value as SessionFrequency)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
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
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Eye size={18} color="#2563EB" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', margin: 0 }}>
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
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                cursor: 'pointer',
                background: profileVisibility === 'public' ? '#EFF6FF' : '#FFFFFF',
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={profileVisibility === 'public'}
                onChange={() => setProfileVisibility('public')}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1E293B' }}>Public Discovery</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
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
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                cursor: 'pointer',
                background: profileVisibility === 'mentees-only' ? '#EFF6FF' : '#FFFFFF',
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={profileVisibility === 'mentees-only'}
                onChange={() => setProfileVisibility('mentees-only')}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1E293B' }}>Accepted Mentees Only</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
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
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                cursor: 'pointer',
                background: profileVisibility === 'private' ? '#EFF6FF' : '#FFFFFF',
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={profileVisibility === 'private'}
                onChange={() => setProfileVisibility('private')}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1E293B' }}>Private / Sabbatical</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748B' }}>
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
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Bell size={18} color="#2563EB" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', margin: 0 }}>
              Simulated Notifications
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  New Mentorship Request Alerts
                </span>
                <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B' }}>
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
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  Upcoming Session Reminders
                </span>
                <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B' }}>
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
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  Mentee Milestone Progress Digest
                </span>
                <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748B' }}>
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
              borderRadius: '6px',
              background: '#2563EB',
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
            borderRadius: '10px',
            padding: '24px',
            marginTop: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={18} color="#DC2626" />
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#991B1B', margin: 0 }}>
              Prototype State & Demo Controls
            </h2>
          </div>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#7F1D1D' }}>
            Reset simulated records back to their factory demo seed or exit to the YOGYATA role selection screen.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: '#FFFFFF',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RotateCcw size={14} /> Reset Demo Workspace Data
            </button>

            <button
              type="button"
              onClick={() => setIsExitModalOpen(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogOut size={14} /> Exit Mentor Workspace
            </button>
          </div>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
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
              borderRadius: '12px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={22} color="#DC2626" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>
                Reset Demo Workspace Data?
              </h2>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5 }}>
              This will reset all current mentorship requests, active mentees, logged sessions, and feedback records back
              to the standard initial demo state.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDemo}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

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
              borderRadius: '12px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <LogOut size={20} color="#2563EB" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>
                Exit to Role Selection?
              </h2>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5 }}>
              Your workspace data is saved in your local browser and you can return anytime via the Mentor role or
              <code>#mentor-workspace</code>.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsExitModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
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
                  borderRadius: '6px',
                  background: '#2563EB',
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
