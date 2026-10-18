import React from 'react';
import type { MentorWorkspaceState, MentorWorkspaceTab } from '../types';
import {
  Users,
  Inbox,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Compass,
} from 'lucide-react';

interface OverviewTabProps {
  workspace: MentorWorkspaceState;
  onNavigateTab: (tab: MentorWorkspaceTab) => void;
  onOpenScheduleModal: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  workspace,
  onNavigateTab,
  onOpenScheduleModal,
}) => {
  const { mentor, mentees, requests, sessions, preferences } = workspace;

  const activeMentees = mentees.filter((m) => m.status === 'active');
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const upcomingSessions = sessions
    .filter((s) => s.status === 'scheduled')
    .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime());
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const capacityPercent = Math.min(
    100,
    Math.round((activeMentees.length / Math.max(1, preferences.maxActiveMentees)) * 100)
  );

  return (
    <div className="yw-content">
      {/* ── Welcome Hero Banner ── */}
      <div className="ws-welcome-card" style={{ background: 'linear-gradient(135deg, var(--color-blue-tint) 0%, #FFFFFF 100%)', borderColor: 'var(--color-blue-line)' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <span className="badge-mentor-guide yw-badge">
              <Compass size={13} />
              Mentor Workspace
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {mentor.currentRole} {mentor.organization ? `@ ${mentor.organization}` : ''}
            </span>
          </div>
          <h2 className="ws-welcome-title">Welcome back, {mentor.fullName}</h2>
          <p className="ws-welcome-desc">
            You are currently mentoring <strong style={{ color: 'var(--color-navy)' }}>{activeMentees.length} active builder(s)</strong> across {preferences.selectedTracks.length} coaching tracks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="yw-btn yw-btn-secondary yw-btn-sm"
            onClick={() => onNavigateTab('requests')}
            id="overview-quick-requests-btn"
          >
            <Inbox size={15} />
            <span>Review Requests ({pendingRequests.length})</span>
          </button>
          <button
            type="button"
            className="yw-btn yw-btn-primary yw-btn-sm"
            onClick={onOpenScheduleModal}
            id="overview-quick-schedule-btn"
            style={{ background: 'var(--color-blue)', borderColor: 'var(--color-blue)' }}
          >
            <Plus size={15} />
            <span>Schedule Session</span>
          </button>
        </div>
      </div>

      {/* ── Metric Cards Grid ── */}
      <div className="ws-stats-grid">
        <div className="ws-stat-card" onClick={() => onNavigateTab('mentees')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="ws-stat-label">Active Mentees</div>
            <div className="ws-stat-num">{activeMentees.length}</div>
            <div className="ws-stat-subtext">Capacity: {preferences.maxActiveMentees} max</div>
          </div>
          <div className="ws-stat-icon-wrap icon-blue">
            <Users size={20} />
          </div>
        </div>

        <div className="ws-stat-card" onClick={() => onNavigateTab('requests')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="ws-stat-label">Pending Requests</div>
            <div className="ws-stat-num" style={{ color: pendingRequests.length > 0 ? '#D97706' : 'var(--color-navy)' }}>
              {pendingRequests.length}
            </div>
            <div className="ws-stat-subtext">Awaiting evaluation</div>
          </div>
          <div className="ws-stat-icon-wrap icon-amber">
            <Inbox size={20} />
          </div>
        </div>

        <div className="ws-stat-card" onClick={() => onNavigateTab('sessions')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="ws-stat-label">Upcoming Sessions</div>
            <div className="ws-stat-num">{upcomingSessions.length}</div>
            <div className="ws-stat-subtext">Next: {upcomingSessions[0] ? `${upcomingSessions[0].date}` : 'None'}</div>
          </div>
          <div className="ws-stat-icon-wrap icon-emerald">
            <Calendar size={20} />
          </div>
        </div>

        <div className="ws-stat-card" onClick={() => onNavigateTab('sessions')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="ws-stat-label">Completed Sessions</div>
            <div className="ws-stat-num">{completedSessions.length}</div>
            <div className="ws-stat-subtext">{workspace.feedback.length} learning feedback notes</div>
          </div>
          <div className="ws-stat-icon-wrap icon-purple">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* ── Capacity & Availability Strip ── */}
      <div className="yw-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="var(--color-blue)" />
            <strong style={{ fontSize: '0.875rem', color: 'var(--color-navy)' }}>
              Mentee Cohort Capacity & Schedule Allocation
            </strong>
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {activeMentees.length} / {preferences.maxActiveMentees} Mentees ({preferences.weeklyAvailabilityHours} hrs/week committed)
          </span>
        </div>
        <div className="ws-progress-track" style={{ margin: '8px 0 0 0', height: '6px' }}>
          <div
            className="ws-progress-fill"
            style={{
              width: `${capacityPercent}%`,
              background: capacityPercent >= 100 ? '#EF4444' : 'linear-gradient(90deg, var(--color-blue), #10B981)',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* ── Upcoming Sessions Column ── */}
        <div className="yw-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-navy)' }}>
              Upcoming Sessions
            </h3>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => onNavigateTab('sessions')}
            >
              View Calendar →
            </button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {upcomingSessions.length === 0 ? (
              <div className="yw-empty-state" style={{ padding: '24px 16px' }}>
                <p className="yw-empty-state-title" style={{ fontSize: '0.95rem' }}>No upcoming sessions</p>
                <p className="yw-empty-state-desc" style={{ fontSize: '0.8125rem', marginBottom: '12px' }}>
                  Coordinate with your active mentees to schedule your next coaching sync.
                </p>
                <button
                  type="button"
                  className="yw-btn yw-btn-primary yw-btn-sm"
                  onClick={onOpenScheduleModal}
                >
                  + Schedule a Session
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcomingSessions.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '12px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 0,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-navy)' }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Mentee: <strong>{s.menteeName}</strong> · {s.durationMinutes} min
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge-scheduled yw-badge">{s.date}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{s.startTime}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Pending Requests Preview Column ── */}
        <div className="yw-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-navy)' }}>
              Pending Mentorship Requests
            </h3>
            <button
              type="button"
              className="yw-btn yw-btn-secondary yw-btn-sm"
              onClick={() => onNavigateTab('requests')}
            >
              View All ({pendingRequests.length}) →
            </button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {pendingRequests.length === 0 ? (
              <div className="yw-empty-state" style={{ padding: '24px 16px' }}>
                <p className="yw-empty-state-title" style={{ fontSize: '0.95rem' }}>Inbox is clear</p>
                <p className="yw-empty-state-desc" style={{ fontSize: '0.8125rem' }}>
                  No pending mentee applications right now. New expressions will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingRequests.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '12px',
                      background: '#FFFDF7',
                      border: '1px solid #FDE68A',
                      borderRadius: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-navy)' }}>
                        {r.menteeName}
                      </div>
                      <span className="badge-pending yw-badge" style={{ fontSize: '0.65rem' }}>Pending</span>
                    </div>
                    <p style={{ margin: '3px 0 6px 0', fontSize: '0.78rem', color: '#92400E', fontWeight: 600 }}>
                      Track: {r.requestedTrack}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      "{r.introMessage}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
