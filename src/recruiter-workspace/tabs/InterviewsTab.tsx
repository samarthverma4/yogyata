import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  Building,
  Plus,
  Edit2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  FileCheck,
} from 'lucide-react';
import type {
  Interview,
  InterviewRound,
  InterviewFormat,
  InterviewStatus,
  CandidateProfile,
  RecruiterWorkspaceTab,
} from '../types';
import { ROUND_LABELS } from '../types';

interface InterviewsTabProps {
  interviews: Interview[];
  candidates: CandidateProfile[];
  availableRoles: string[];
  onScheduleInterview: (interview: Omit<Interview, 'id'>) => void;
  onUpdateInterview: (id: string, updates: Partial<Interview>) => void;
  onCancelInterview: (id: string, reason: string) => void;
  onTabChange: (tab: RecruiterWorkspaceTab) => void;
}

function getCurrentDateFormatted(): string {
  return new Date().toISOString().split('T')[0];
}

export const InterviewsTab: React.FC<InterviewsTabProps> = ({
  interviews,
  candidates,
  availableRoles,
  onScheduleInterview,
  onUpdateInterview,
  onCancelInterview,
  onTabChange,
}) => {
  const [filterStatus, setFilterStatus] = useState<InterviewStatus>('scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [cancellingInterview, setCancellingInterview] = useState<Interview | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Form State for Scheduling / Editing
  const [candidateId, setCandidateId] = useState('');
  const [targetRole, setTargetRole] = useState(availableRoles[0] || 'Senior Technical Contributor');
  const [round, setRound] = useState<InterviewRound>('technical-deep-dive');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('11:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [format, setFormat] = useState<InterviewFormat>('video');
  const [locationOrLink, setLocationOrLink] = useState('https://meet.google.com/xyz-recruiter-demo');
  const [assignedInterviewers, setAssignedInterviewers] = useState('Lead Recruiter & Principal Engineer');
  const [agenda, setAgenda] = useState('');
  const [prepNotes, setPrepNotes] = useState('');
  const [formError, setFormError] = useState('');

  const [todayStr] = useState(() => getCurrentDateFormatted());

  const filteredInterviews = interviews.filter((i) => {
    if (i.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = i.candidateName.toLowerCase().includes(q);
      const matchRole = i.targetRole.toLowerCase().includes(q);
      const matchAgenda = i.agenda.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchAgenda) return false;
    }
    return true;
  });

  const openScheduleModal = () => {
    setEditingInterview(null);
    setCandidateId(candidates[0]?.id || '');
    setTargetRole(availableRoles[0] || 'Senior Technical Contributor');
    setRound('technical-deep-dive');
    setDate('');
    setStartTime('14:00');
    setDurationMinutes(60);
    setFormat('video');
    setLocationOrLink('https://meet.google.com/yogyata-interview-demo');
    setAssignedInterviewers('Engineering Lead & Senior Talent Partner');
    setAgenda('Hands-on architectural review, code problem-solving, and system trade-offs.');
    setPrepNotes('Review candidate verified challenge PR and Skill Passport profile before the call.');
    setFormError('');
    setShowScheduleModal(true);
  };

  const openEditModal = (interview: Interview) => {
    setEditingInterview(interview);
    setCandidateId(interview.candidateId);
    setTargetRole(interview.targetRole);
    setRound(interview.round);
    setDate(interview.date);
    setStartTime(interview.startTime);
    setDurationMinutes(interview.durationMinutes);
    setFormat(interview.format);
    setLocationOrLink(interview.locationOrLink);
    setAssignedInterviewers(interview.assignedInterviewers.join(', '));
    setAgenda(interview.agenda);
    setPrepNotes(interview.prepNotes);
    setFormError('');
    setShowScheduleModal(true);
  };

  const validateInterview = (): boolean => {
    if (!candidateId) {
      setFormError('Please select a candidate');
      return false;
    }
    if (!targetRole.trim()) {
      setFormError('Target role is required');
      return false;
    }
    if (!date) {
      setFormError('Interview date is required');
      return false;
    }
    if (!editingInterview && date < todayStr) {
      setFormError('Cannot schedule an interview on a past date');
      return false;
    }
    if (!startTime) {
      setFormError('Start time is required');
      return false;
    }
    if (!agenda.trim()) {
      setFormError('Interview agenda is required');
      return false;
    }

    // Check collision for same candidate, date, time, and round
    const collision = interviews.find(
      (i) =>
        i.id !== editingInterview?.id &&
        i.candidateId === candidateId &&
        i.date === date &&
        i.startTime === startTime &&
        i.status !== 'cancelled'
    );
    if (collision) {
      setFormError('Collision detected: This candidate already has an active interview at this date & time.');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleSaveInterview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInterview()) return;

    const cand = candidates.find((c) => c.id === candidateId);
    const candidateName = cand?.name || 'Selected Candidate';
    const interviewersList = assignedInterviewers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingInterview) {
      onUpdateInterview(editingInterview.id, {
        candidateId,
        candidateName,
        targetRole,
        round,
        date,
        startTime,
        durationMinutes,
        format,
        locationOrLink,
        assignedInterviewers: interviewersList,
        agenda,
        prepNotes,
      });
    } else {
      onScheduleInterview({
        candidateId,
        candidateName,
        targetRole,
        round,
        date,
        startTime,
        durationMinutes,
        format,
        locationOrLink,
        assignedInterviewers: interviewersList,
        agenda,
        prepNotes,
        status: 'scheduled',
      });
    }

    setShowScheduleModal(false);
  };

  const handleConfirmCancel = () => {
    if (!cancellingInterview) return;
    onCancelInterview(cancellingInterview.id, cancellationReason.trim() || 'Rescheduled by hiring team');
    setCancellingInterview(null);
    setCancellationReason('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
              Interview Scheduler
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Coordinate technical screening, architecture rounds, and evaluation calls with collision detection.
            </p>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={openScheduleModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8125rem',
              background: '#D97706',
              borderColor: '#D97706',
            }}
          >
            <Plus size={15} />
            <span>Schedule New Interview</span>
          </button>
        </div>
      </div>

      {/* Prototype Notice */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '0.625rem 1rem',
          fontSize: '0.75rem',
          color: '#64748B',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <Calendar size={14} style={{ color: '#D97706', flexShrink: 0 }} />
        <span>
          <strong>Prototype Notice:</strong> Interview bookings are managed locally. No external
          Google Calendar, Outlook, or video invites are dispatched.
        </span>
      </div>

      {/* Filter and Tab Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '0.875rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['scheduled', 'completed', 'cancelled'] as InterviewStatus[]).map((status) => {
            const count = interviews.filter((i) => i.status === status).length;
            const isActive = filterStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #D97706' : '1px solid #E2E8F0',
                  background: isActive ? '#FEF3C7' : '#FFFFFF',
                  color: isActive ? '#B45309' : '#475569',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>{status}</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: isActive ? '#FDE68A' : '#F1F5F9',
                    padding: '0.05rem 0.35rem',
                    borderRadius: '9999px',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search by candidate or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.1rem', fontSize: '0.8125rem' }}
          />
        </div>
      </div>

      {/* Interview Cards List */}
      <div>
        {filteredInterviews.length === 0 ? (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '3rem 1.5rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#F1F5F9',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Calendar size={22} />
            </div>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: '#0F172A' }}>
              No {filterStatus} interviews found
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#64748B' }}>
              {filterStatus === 'scheduled'
                ? 'Schedule an interview with any candidate from your pipeline.'
                : `No interviews with status "${filterStatus}".`}
            </p>
            {filterStatus === 'scheduled' && (
              <button type="button" className="btn-secondary" onClick={openScheduleModal} style={{ fontSize: '0.8125rem' }}>
                Schedule Interview
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {filteredInterviews.map((interview) => (
              <div
                key={interview.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1rem', color: '#0F172A' }}>
                        {interview.candidateName}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {ROUND_LABELS[interview.round]}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '0.2rem', fontWeight: 500 }}>
                      Target Role: {interview.targetRole}
                    </div>

                    {/* Schedule Time Details */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginTop: '0.5rem',
                        fontSize: '0.8125rem',
                        color: '#334155',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={14} style={{ color: '#D97706' }} />
                        <strong>{interview.date}</strong> at {interview.startTime}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={14} style={{ color: '#64748B' }} />
                        {interview.durationMinutes} minutes
                      </span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textTransform: 'capitalize' }}>
                        {interview.format === 'video' ? <Video size={14} /> : interview.format === 'phone' ? <Phone size={14} /> : <Building size={14} />}
                        {interview.format} call
                      </span>
                    </div>

                    {/* Agenda & Prep */}
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#475569' }}>
                      <strong>Agenda: </strong> {interview.agenda}
                    </div>

                    {interview.prepNotes && (
                      <div
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.75rem',
                          color: '#64748B',
                          background: '#F8FAFC',
                          padding: '0.35rem 0.6rem',
                          borderRadius: '4px',
                        }}
                      >
                        <strong>Prep: </strong> {interview.prepNotes}
                      </div>
                    )}

                    {/* Cancellation reason if cancelled */}
                    {interview.status === 'cancelled' && interview.cancellationReason && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#B91C1C', background: '#FEF2F2', padding: '0.35rem 0.6rem', borderRadius: '4px' }}>
                        <strong>Cancellation Reason:</strong> {interview.cancellationReason}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                    {interview.status === 'scheduled' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            onUpdateInterview(interview.id, { status: 'completed' });
                          }}
                          style={{
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: '#15803D',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Mark Completed</span>
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEditModal(interview)}
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>

                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setCancellingInterview(interview)}
                          style={{ fontSize: '0.75rem', color: '#DC2626', padding: '0.35rem 0.6rem' }}
                        >
                          <XCircle size={13} /> Cancel
                        </button>
                      </div>
                    )}

                    {interview.status === 'completed' && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onTabChange('scorecards')}
                        style={{
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: '#7C3AED',
                          borderColor: '#7C3AED',
                        }}
                      >
                        <FileCheck size={13} />
                        <span>Log Scorecard</span>
                      </button>
                    )}

                    {interview.locationOrLink && (
                      <a
                        href={interview.locationOrLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.75rem',
                          color: '#2563EB',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          marginTop: '0.25rem',
                        }}
                      >
                        <span>Meeting Location / Link</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule / Edit Modal */}
      {showScheduleModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '560px' }}>
            <h3 id="schedule-modal-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem', color: '#0F172A' }}>
              {editingInterview ? 'Edit Interview Details' : 'Schedule Technical Interview'}
            </h3>

            {formError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#B91C1C',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveInterview}>
              {/* Candidate Selection */}
              <div className="form-group">
                <label className="form-label">
                  Candidate <span className="required-star">*</span>
                </label>
                <select
                  className="form-input"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  disabled={Boolean(editingInterview)}
                >
                  <option value="">Select a candidate</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.headline}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Role & Round */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Target Role <span className="required-star">*</span>
                  </label>
                  <select
                    className="form-input"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Interview Round <span className="required-star">*</span>
                  </label>
                  <select
                    className="form-input"
                    value={round}
                    onChange={(e) => setRound(e.target.value as InterviewRound)}
                  >
                    <option value="initial-screening">Initial Screening</option>
                    <option value="technical-deep-dive">Technical Deep Dive</option>
                    <option value="system-design">System Architecture</option>
                    <option value="culture-fit">Culture &amp; Values Fit</option>
                    <option value="final-round">Final Leadership Round</option>
                  </select>
                </div>
              </div>

              {/* Date & Time Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Date <span className="required-star">*</span>
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Start Time <span className="required-star">*</span>
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <select
                    className="form-input"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  >
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins</option>
                    <option value={90}>90 mins</option>
                  </select>
                </div>
              </div>

              {/* Format & Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Format</label>
                  <select
                    className="form-input"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as InterviewFormat)}
                  >
                    <option value="video">Video Call</option>
                    <option value="phone">Phone Screen</option>
                    <option value="onsite">On-Site</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Meeting URL or Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://meet.google.com/..."
                    value={locationOrLink}
                    onChange={(e) => setLocationOrLink(e.target.value)}
                  />
                </div>
              </div>

              {/* Interviewers */}
              <div className="form-group">
                <label className="form-label">Assigned Interviewers</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Shalini Menon, Dr. Alok Verma"
                  value={assignedInterviewers}
                  onChange={(e) => setAssignedInterviewers(e.target.value)}
                />
              </div>

              {/* Agenda */}
              <div className="form-group">
                <label className="form-label">
                  Interview Agenda <span className="required-star">*</span>
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder="Key topics to evaluate..."
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#D97706', borderColor: '#D97706' }}>
                  {editingInterview ? 'Save Changes' : 'Confirm & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingInterview && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-interview-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '420px' }}>
            <h3 id="cancel-interview-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Cancel Scheduled Interview?
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.84rem', color: '#64748B', lineHeight: 1.45 }}>
              Are you sure you want to cancel the <strong>{ROUND_LABELS[cancellingInterview.round]}</strong> with{' '}
              <strong>{cancellingInterview.candidateName}</strong> on {cancellingInterview.date}?
            </p>

            <div className="form-group">
              <label className="form-label">Cancellation Reason</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Candidate rescheduled, interviewer conflict"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCancellingInterview(null)}
              >
                Keep Scheduled
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmCancel}
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
