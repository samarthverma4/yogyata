import React, { useState } from 'react';
import type {
  MentorWorkspaceState,
  MentorshipSession,
  SessionStatus,
} from '../types';
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  Edit2,
  AlertCircle,
  ArrowRight,
  Info,
} from 'lucide-react';

interface SessionsTabProps {
  workspace: MentorWorkspaceState;
  onUpdateWorkspace: (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => void;
  onNavigateToFeedback?: (menteeId: string, sessionId?: string) => void;
  preselectedMenteeId?: string | null;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  workspace,
  onUpdateWorkspace,
  onNavigateToFeedback,
  preselectedMenteeId,
}) => {
  const { sessions, mentees } = workspace;

  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');
  const [menteeFilter, setMenteeFilter] = useState<string>('all');

  // Modals state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<MentorshipSession | null>(null);
  const [completingSession, setCompletingSession] = useState<MentorshipSession | null>(null);
  const [cancellingSession, setCancellingSession] = useState<MentorshipSession | null>(null);

  // Form states for Schedule / Edit
  const [formMenteeId, setFormMenteeId] = useState<string>(
    preselectedMenteeId || (mentees.length > 0 ? mentees[0].id : '')
  );
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('18:00');
  const [formDuration, setFormDuration] = useState(45);
  const [formFormat, setFormFormat] = useState<'online' | 'flexible'>('online');
  const [formAgenda, setFormAgenda] = useState('');
  const [formPrepNotes, setFormPrepNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Form states for Complete Modal
  const [postNotes, setPostNotes] = useState('');
  const [newActionItem, setNewActionItem] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState('');

  // Helper today date string
  const [todayStr] = useState(() => new Date().toISOString().split('T')[0]);

  const activeMentees = mentees.filter((m) => m.status === 'active');

  // Filtered Sessions
  const filteredSessions = sessions.filter((sess) => {
    const matchesStatus = statusFilter === 'all' || sess.status === statusFilter;
    const matchesMentee = menteeFilter === 'all' || sess.menteeId === menteeFilter;
    return matchesStatus && matchesMentee;
  });

  const scheduledCount = sessions.filter((s) => s.status === 'scheduled').length;
  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const cancelledCount = sessions.filter((s) => s.status === 'cancelled').length;

  const handleOpenScheduleModal = () => {
    setEditingSession(null);
    setFormMenteeId(preselectedMenteeId || (activeMentees.length > 0 ? activeMentees[0].id : ''));
    setFormTitle('');
    setFormDate(todayStr);
    setFormTime('18:00');
    setFormDuration(45);
    setFormFormat('online');
    setFormAgenda('');
    setFormPrepNotes('');
    setFormError('');
    setIsScheduleModalOpen(true);
  };

  const handleOpenEditModal = (sess: MentorshipSession) => {
    setEditingSession(sess);
    setFormMenteeId(sess.menteeId);
    setFormTitle(sess.title);
    setFormDate(sess.date);
    setFormTime(sess.startTime);
    setFormDuration(sess.durationMinutes);
    setFormFormat(sess.sessionFormat);
    setFormAgenda(sess.agenda);
    setFormPrepNotes(sess.prepNotes || '');
    setFormError('');
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validations
    if (!formMenteeId) {
      setFormError('Please select a mentee.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Please provide a session title.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a session date.');
      return;
    }
    if (!formTime) {
      setFormError('Please select a session start time.');
      return;
    }
    if (!formAgenda.trim()) {
      setFormError('Please enter a session agenda or discussion topics.');
      return;
    }

    // Past date check
    if (formDate < todayStr) {
      setFormError('Cannot schedule a session in the past. Please pick a current or future date.');
      return;
    }

    // Duplicate check: Same mentee, same date, same start time (exclude the one currently being edited)
    const duplicate = sessions.find(
      (s) =>
        s.id !== editingSession?.id &&
        s.menteeId === formMenteeId &&
        s.date === formDate &&
        s.startTime === formTime &&
        s.status !== 'cancelled'
    );

    if (duplicate) {
      setFormError(
        `A session with this mentee is already scheduled at ${formTime} on ${formDate}. Please choose a different time.`
      );
      return;
    }

    const menteeObj = mentees.find((m) => m.id === formMenteeId);
    const menteeName = menteeObj ? menteeObj.menteeName : 'Mentee';

    if (editingSession) {
      // Update existing
      onUpdateWorkspace((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === editingSession.id
            ? {
                ...s,
                menteeId: formMenteeId,
                menteeName,
                title: formTitle.trim(),
                date: formDate,
                startTime: formTime,
                durationMinutes: formDuration,
                sessionFormat: formFormat,
                agenda: formAgenda.trim(),
                prepNotes: formPrepNotes.trim() || undefined,
              }
            : s
        ),
      }));
      setToastMsg(`Session "${formTitle}" updated successfully.`);
    } else {
      // Create new session
      const newSession: MentorshipSession = {
        id: `sess-${Date.now()}`,
        menteeId: formMenteeId,
        menteeName,
        title: formTitle.trim(),
        date: formDate,
        startTime: formTime,
        durationMinutes: formDuration,
        sessionFormat: formFormat,
        agenda: formAgenda.trim(),
        prepNotes: formPrepNotes.trim() || undefined,
        status: 'scheduled',
        isDemoRecord: true,
      };

      onUpdateWorkspace((prev) => ({
        ...prev,
        sessions: [newSession, ...prev.sessions],
        mentees: prev.mentees.map((m) =>
          m.id === formMenteeId ? { ...m, nextSessionDate: formDate } : m
        ),
      }));
      setToastMsg(`Session "${formTitle}" scheduled for ${formDate}.`);
    }

    setIsScheduleModalOpen(false);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleConfirmCancel = () => {
    if (!cancellingSession) return;

    onUpdateWorkspace((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === cancellingSession.id ? { ...s, status: 'cancelled' as const } : s
      ),
      mentees: prev.mentees.map((m) =>
        m.id === cancellingSession.menteeId && m.nextSessionDate === cancellingSession.date
          ? { ...m, nextSessionDate: undefined }
          : m
      ),
    }));

    setToastMsg(`Session cancelled.`);
    setCancellingSession(null);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleConfirmComplete = () => {
    if (!completingSession) return;

    const actionItemsToAdd = newActionItem.trim() ? [newActionItem.trim()] : [];

    onUpdateWorkspace((prev) => {
      // 1. Update session
      const updatedSessions = prev.sessions.map((s) =>
        s.id === completingSession.id
          ? {
              ...s,
              status: 'completed' as const,
              postSessionNotes: postNotes.trim() || 'Session concluded successfully.',
              actionItemsAdded: actionItemsToAdd.length > 0 ? actionItemsToAdd : s.actionItemsAdded,
            }
          : s
      );

      // 2. Update mentee's lastSessionDate & append action items
      const updatedMentees = prev.mentees.map((m) => {
        if (m.id === completingSession.menteeId) {
          const newActions = actionItemsToAdd.map((txt) => ({
            id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            text: txt,
            completed: false,
          }));
          return {
            ...m,
            lastSessionDate: completingSession.date,
            nextSessionDate: undefined,
            actionItems: [...(m.actionItems || []), ...newActions],
          };
        }
        return m;
      });

      return {
        ...prev,
        sessions: updatedSessions,
        mentees: updatedMentees,
      };
    });

    setToastMsg(`Session marked as completed!`);
    setCompletingSession(null);
    setPostNotes('');
    setNewActionItem('');
    setTimeout(() => setToastMsg(''), 4000);
  };

  return (
    <div className="tab-pane-content" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1B2A4E', margin: '0 0 6px 0' }}>
            Mentorship Sessions
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.88rem' }}>
            Schedule and manage guidance calls, track agendas, and log post-session outcomes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenScheduleModal}
          disabled={activeMentees.length === 0}
          style={{
            padding: '9px 18px',
            background: activeMentees.length === 0 ? '#94A3B8' : '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: activeMentees.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Plus size={16} /> Schedule Session
        </button>
      </div>

      {/* Prototype Calendar Disclaimer Banner */}
      <div
        style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.8125rem',
          color: '#1E40AF',
        }}
      >
        <Info size={16} color="#2563EB" />
        <span>
          <strong>Frontend Prototype:</strong> Sessions are local demonstration records managed in your browser. Real
          Google Calendar / Outlook synchronization and video links are not included in this phase.
        </span>
      </div>

      {/* Toast message */}
      {toastMsg && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
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

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
        }}
      >
        {/* Status filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: statusFilter === 'all' ? '1px solid #2563EB' : '1px solid #E2E8F0',
              background: statusFilter === 'all' ? '#EFF6FF' : '#FFFFFF',
              color: statusFilter === 'all' ? '#1D4ED8' : '#64748B',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            All ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('scheduled')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: statusFilter === 'scheduled' ? '1px solid #059669' : '1px solid #E2E8F0',
              background: statusFilter === 'scheduled' ? '#ECFDF5' : '#FFFFFF',
              color: statusFilter === 'scheduled' ? '#065F46' : '#64748B',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Upcoming ({scheduledCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: statusFilter === 'completed' ? '1px solid #2563EB' : '1px solid #E2E8F0',
              background: statusFilter === 'completed' ? '#EFF6FF' : '#FFFFFF',
              color: statusFilter === 'completed' ? '#1D4ED8' : '#64748B',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Completed ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('cancelled')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: statusFilter === 'cancelled' ? '1px solid #64748B' : '1px solid #E2E8F0',
              background: statusFilter === 'cancelled' ? '#F1F5F9' : '#FFFFFF',
              color: statusFilter === 'cancelled' ? '#334155' : '#64748B',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Cancelled ({cancelledCount})
          </button>
        </div>

        {/* Mentee dropdown filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Filter Mentee:</span>
          <select
            value={menteeFilter}
            onChange={(e) => setMenteeFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.82rem',
              color: '#334155',
              outline: 'none',
              background: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Mentees</option>
            {mentees.map((m) => (
              <option key={m.id} value={m.id}>
                {m.menteeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Calendar size={36} style={{ color: '#94A3B8', marginBottom: '10px' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>
            No sessions match your criteria
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.84rem', maxWidth: '400px', margin: '0 auto 16px auto' }}>
            {activeMentees.length === 0
              ? 'You need at least one active mentee to schedule sessions. Accept a mentorship application first.'
              : 'Schedule your next 1:1 session or change your filter.'}
          </p>
          {activeMentees.length > 0 && (
            <button
              type="button"
              onClick={handleOpenScheduleModal}
              style={{
                padding: '8px 16px',
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Schedule First Session
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredSessions.map((sess) => {
            const isScheduled = sess.status === 'scheduled';
            const isCompleted = sess.status === 'completed';
            const isCancelled = sess.status === 'cancelled';

            return (
              <div
                key={sess.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '18px 22px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Top header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: isScheduled ? '#EFF6FF' : isCompleted ? '#F0FDF4' : '#F1F5F9',
                        border: `1px solid ${
                          isScheduled ? '#BFDBFE' : isCompleted ? '#BBF7D0' : '#E2E8F0'
                        }`,
                        textAlign: 'center',
                        minWidth: '65px',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: isScheduled ? '#1D4ED8' : isCompleted ? '#166534' : '#64748B',
                        }}
                      >
                        {new Date(sess.date + 'T00:00:00').toLocaleDateString(undefined, {
                          month: 'short',
                        })}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: '#1B2A4E',
                          lineHeight: 1.1,
                        }}
                      >
                        {new Date(sess.date + 'T00:00:00').getDate()}
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                          {sess.title}
                        </h3>
                        {sess.isDemoRecord && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 5px',
                              background: '#F1F5F9',
                              color: '#64748B',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            DEMO
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2563EB' }}>
                          Mentee: {sess.menteeName}
                        </span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: '#64748B',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={13} /> {sess.startTime} ({sess.durationMinutes} mins)
                        </span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ fontSize: '0.8rem', color: '#64748B', textTransform: 'capitalize' }}>
                          {sess.sessionFormat} call
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div>
                    {isScheduled && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        Upcoming
                      </span>
                    )}
                    {isCompleted && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: '#F0FDF4',
                          color: '#166534',
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        Completed
                      </span>
                    )}
                    {isCancelled && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: '#F1F5F9',
                          color: '#64748B',
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Agenda */}
                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', fontSize: '0.84rem' }}>
                  <span style={{ fontWeight: 700, color: '#334155' }}>Agenda: </span>
                  <span style={{ color: '#475569' }}>{sess.agenda}</span>
                </div>

                {/* Post notes or action items if completed */}
                {isCompleted && sess.postSessionNotes && (
                  <div
                    style={{
                      background: '#F0FDF4',
                      borderLeft: '3px solid #16A34A',
                      padding: '8px 12px',
                      borderRadius: '0 6px 6px 0',
                      fontSize: '0.82rem',
                      color: '#166534',
                    }}
                  >
                    <strong>Post-Session Summary: </strong>
                    {sess.postSessionNotes}
                  </div>
                )}

                {/* Action buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #F1F5F9',
                    paddingTop: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {sess.prepNotes && (
                      <span style={{ fontSize: '0.76rem', color: '#64748B', fontStyle: 'italic' }}>
                        Prep: {sess.prepNotes}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isScheduled && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCancellingSession(sess)}
                          style={{
                            padding: '5px 10px',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '5px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#64748B',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sess)}
                          style={{
                            padding: '5px 10px',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '5px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletingSession(sess)}
                          style={{
                            padding: '5px 12px',
                            background: '#059669',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={13} /> Complete Session
                        </button>
                      </>
                    )}

                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigateToFeedback && onNavigateToFeedback(sess.menteeId, sess.id)
                        }
                        style={{
                          padding: '5px 12px',
                          background: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: '5px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#1D4ED8',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Record Learning Feedback <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / Edit Modal */}
      {isScheduleModalOpen && (
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
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>
                {editingSession ? 'Edit Mentorship Session' : 'Schedule Mentorship Session'}
              </h2>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSchedule}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {formError && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#B91C1C',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Mentee selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Mentee *
                  </label>
                  <select
                    value={formMenteeId}
                    onChange={(e) => setFormMenteeId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                    }}
                  >
                    {activeMentees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.menteeName} ({m.mentorshipTrack})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Session Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Session Title *
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. System Design Mock Interview or Sprint Code Review"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Date & Time row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      min={todayStr}
                      onChange={(e) => setFormDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.82rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Start Time *
                    </label>
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.82rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Duration
                    </label>
                    <select
                      value={formDuration}
                      onChange={(e) => setFormDuration(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.82rem',
                      }}
                    >
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>60 mins</option>
                      <option value={90}>90 mins</option>
                    </select>
                  </div>
                </div>

                {/* Agenda */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Agenda & Focus Topics *
                  </label>
                  <textarea
                    rows={3}
                    value={formAgenda}
                    onChange={(e) => setFormAgenda(e.target.value)}
                    placeholder="Outline discussion items, code repos to evaluate, or specific interview scenarios..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.84rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Preparation notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Preparation Notes for Mentee (Optional)
                  </label>
                  <input
                    type="text"
                    value={formPrepNotes}
                    onChange={(e) => setFormPrepNotes(e.target.value)}
                    placeholder="e.g. Please send GitHub repository link prior to the call."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  style={{
                    padding: '8px 16px',
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
                  type="submit"
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
                  {editingSession ? 'Save Changes' : 'Confirm & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Session Modal */}
      {completingSession && (
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
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>
                Mark Session Completed
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '0.82rem' }}>
                {completingSession.title} with {completingSession.menteeName}
              </p>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Post-Session Notes & Summary
                </label>
                <textarea
                  rows={3}
                  value={postNotes}
                  onChange={(e) => setPostNotes(e.target.value)}
                  placeholder="Summarize key topics covered, candidate questions, and primary takeaways..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Assign Follow-up Action Item (Optional)
                </label>
                <input
                  type="text"
                  value={newActionItem}
                  onChange={(e) => setNewActionItem(e.target.value)}
                  placeholder="e.g. Implement recommended database indexing strategy"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #E2E8F0',
                background: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setCompletingSession(null)}
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
                onClick={handleConfirmComplete}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: '#059669',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirm Completion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingSession && (
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
              <AlertCircle size={22} color="#DC2626" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>
                Cancel Session?
              </h2>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5 }}>
              Are you sure you want to cancel "<strong>{cancellingSession.title}</strong>" scheduled with{' '}
              {cancellingSession.menteeName} on {cancellingSession.date}?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setCancellingSession(null)}
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
                Keep Session
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
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
                Yes, Cancel Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
