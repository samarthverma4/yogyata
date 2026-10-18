import React, { useState } from 'react';
import type {
  MentorWorkspaceState,
  MentorshipRequest,
  RequestStatus,
  MenteeRelationship,
} from '../types';
import {
  Inbox,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';

interface RequestsTabProps {
  workspace: MentorWorkspaceState;
  onUpdateWorkspace: (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => void;
  onNavigateToTab: (tab: 'mentees' | 'sessions') => void;
}

export const RequestsTab: React.FC<RequestsTabProps> = ({
  workspace,
  onUpdateWorkspace,
  onNavigateToTab,
}) => {
  const { requests, mentees, preferences } = workspace;

  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<MentorshipRequest | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'accept' | 'decline' | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const activeMenteesCount = mentees.filter((m) => m.status === 'active').length;
  const maxCapacity = preferences.maxActiveMentees || 3;
  const isAtCapacity = activeMenteesCount >= maxCapacity;

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      req.menteeName.toLowerCase().includes(query) ||
      req.careerGoal.toLowerCase().includes(query) ||
      req.requestedTrack.toLowerCase().includes(query) ||
      req.relevantSkills.some((s) => s.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const acceptedCount = requests.filter((r) => r.status === 'accepted').length;
  const declinedCount = requests.filter((r) => r.status === 'declined').length;

  const handleOpenAction = (req: MentorshipRequest, mode: 'view' | 'accept' | 'decline') => {
    setSelectedRequest(req);
    setModalMode(mode);
    setResponseNote(req.responseNote || '');
    setErrorMsg('');
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
    setModalMode(null);
    setResponseNote('');
    setErrorMsg('');
  };

  const handleConfirmAccept = () => {
    if (!selectedRequest) return;

    // Check duplicate mentee
    const existingMentee = mentees.find(
      (m) =>
        m.menteeEmail.toLowerCase() === selectedRequest.menteeEmail.toLowerCase() ||
        m.menteeName.toLowerCase() === selectedRequest.menteeName.toLowerCase()
    );

    if (existingMentee && existingMentee.status === 'active') {
      setErrorMsg(`${selectedRequest.menteeName} is already an active mentee in your roster.`);
      return;
    }

    onUpdateWorkspace((prev) => {
      // 1. Update the request status
      const updatedRequests = prev.requests.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: 'accepted' as RequestStatus,
              responseNote: responseNote.trim() || 'Accepted request. Welcome to mentorship!',
            }
          : r
      );

      // 2. Upsert mentee relationship
      let updatedMentees = [...prev.mentees];
      if (existingMentee) {
        // reactivate if previously completed or on-hold
        updatedMentees = updatedMentees.map((m) =>
          m.id === existingMentee.id
            ? {
                ...m,
                status: 'active' as const,
                mentorshipTrack: selectedRequest.requestedTrack,
                careerGoal: selectedRequest.careerGoal,
                startDate: new Date().toISOString(),
              }
            : m
        );
      } else {
        const newMentee: MenteeRelationship = {
          id: `mentee-${Date.now()}`,
          requestId: selectedRequest.id,
          menteeName: selectedRequest.menteeName,
          menteeEmail: selectedRequest.menteeEmail,
          careerGoal: selectedRequest.careerGoal,
          mentorshipTrack: selectedRequest.requestedTrack,
          status: 'active',
          startDate: new Date().toISOString(),
          goals: [
            `Progress in ${selectedRequest.requestedTrack}`,
            'Establish structured weekly learning milestones',
          ],
          actionItems: [
            {
              id: `act-${Date.now()}-1`,
              text: 'Schedule initial orientation & alignment session',
              completed: false,
            },
          ],
          privateNotes: `Initial request notes: "${selectedRequest.introMessage}"`,
          isDemoRecord: true,
        };
        updatedMentees.push(newMentee);
      }

      return {
        ...prev,
        requests: updatedRequests,
        mentees: updatedMentees,
      };
    });

    setSuccessToast(`Accepted request from ${selectedRequest.menteeName}. Added to your Mentees roster!`);
    handleCloseModal();
    setTimeout(() => setSuccessToast(''), 4000);
  };

  const handleConfirmDecline = () => {
    if (!selectedRequest) return;

    onUpdateWorkspace((prev) => {
      const updatedRequests = prev.requests.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: 'declined' as RequestStatus,
              responseNote: responseNote.trim() || 'Declined due to mentor capacity limits.',
            }
          : r
      );
      return {
        ...prev,
        requests: updatedRequests,
      };
    });

    setSuccessToast(`Declined request from ${selectedRequest.menteeName}.`);
    handleCloseModal();
    setTimeout(() => setSuccessToast(''), 4000);
  };

  return (
    <div className="tab-pane-content" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 6px 0' }}>
            Mentorship Requests
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            Review incoming mentorship applications, evaluate compatibility, and accept learners into your roster.
          </p>
        </div>

        {/* Capacity Indicator Pill */}
        <div
          style={{
            background: isAtCapacity ? '#FFFBEB' : '#F0FDF4',
            border: `1px solid ${isAtCapacity ? '#FDE68A' : '#BBF7D0'}`,
            borderRadius: 0,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isAtCapacity ? '#D97706' : '#16A34A',
            }}
          />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isAtCapacity ? '#92400E' : '#166534' }}>
            Roster: {activeMenteesCount} / {maxCapacity} Mentees
            {isAtCapacity ? ' (Capacity Reached)' : ' (Slots Available)'}
          </span>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            padding: '12px 16px',
            borderRadius: 0,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FFFFFF',
          border: '1px solid var(--color-border)',
          borderRadius: 0,
          padding: '12px 16px',
          marginBottom: '24px',
        }}
      >
        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: statusFilter === 'all' ? '1px solid var(--color-blue)' : '1px solid var(--color-border)',
              background: statusFilter === 'all' ? 'var(--color-blue-tint)' : '#FFFFFF',
              color: statusFilter === 'all' ? 'var(--color-blue-hover)' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            All ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: statusFilter === 'pending' ? '1px solid #D97706' : '1px solid var(--color-border)',
              background: statusFilter === 'pending' ? '#FFFBEB' : '#FFFFFF',
              color: statusFilter === 'pending' ? '#B45309' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('accepted')}
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: statusFilter === 'accepted' ? '1px solid #059669' : '1px solid var(--color-border)',
              background: statusFilter === 'accepted' ? '#ECFDF5' : '#FFFFFF',
              color: statusFilter === 'accepted' ? '#047857' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            Accepted ({acceptedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('declined')}
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: statusFilter === 'declined' ? '1px solid #DC2626' : '1px solid var(--color-border)',
              background: statusFilter === 'declined' ? '#FEF2F2' : '#FFFFFF',
              color: statusFilter === 'declined' ? '#B91C1C' : 'var(--color-text-muted)',
              fontWeight: 600,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            Declined ({declinedCount})
          </button>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}
          />
          <input
            type="text"
            placeholder="Search mentee, track or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 0,
              border: '1px solid var(--color-border)',
              fontSize: '0.85rem',
              outline: 'none',
              color: 'var(--color-navy)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px dashed var(--color-border-hover)',
            borderRadius: 0,
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Inbox size={42} style={{ color: 'var(--color-text-faint)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-navy)', margin: '0 0 6px 0' }}>
            No mentorship requests found
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 16px auto' }}>
            {searchQuery || statusFilter !== 'all'
              ? 'Try resetting your search query or selecting a different status filter.'
              : 'You do not have any mentorship requests at this time. When learners apply to your tracks, their submissions will appear here.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                padding: '6px 14px',
                borderRadius: 0,
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredRequests.map((req) => {
            const isAccepted = req.status === 'accepted';
            const isDeclined = req.status === 'declined';
            const isPending = req.status === 'pending';

            return (
              <div
                key={req.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--color-border)',
                  borderRadius: 0,
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Top Row: Mentee info + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'var(--color-blue-tint)',
                        color: 'var(--color-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1rem',
                        border: '1px solid var(--color-blue-tint)',
                      }}
                    >
                      {req.menteeName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                          {req.menteeName}
                        </h3>
                        {req.isDemoRecord && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 6px',
                              background: 'var(--color-surface-2)',
                              color: 'var(--color-text-muted)',
                              borderRadius: 0,
                              fontWeight: 600,
                            }}
                          >
                            DEMO
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{req.menteeEmail}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPending && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 0,
                          background: '#FFFBEB',
                          color: '#B45309',
                          border: '1px solid #FDE68A',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Clock size={13} /> Pending Review
                      </span>
                    )}
                    {isAccepted && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 0,
                          background: '#ECFDF5',
                          color: '#059669',
                          border: '1px solid #A7F3D0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <CheckCircle2 size={13} /> Accepted
                      </span>
                    )}
                    {isDeclined && (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 0,
                          background: '#FEF2F2',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <XCircle size={13} /> Declined
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 700 }}>
                      Career Goal
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                      {req.careerGoal}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 700 }}>
                      Requested Track
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-blue)' }}>
                      {req.requestedTrack}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 700 }}>
                      Preferred Timing
                    </span>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>{req.preferredTime}</p>
                  </div>
                </div>

                {/* Skills Chips */}
                {req.relevantSkills && req.relevantSkills.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, marginRight: '4px' }}>
                      Learner Skills:
                    </span>
                    {req.relevantSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: 0,
                          background: 'var(--color-surface-2)',
                          color: 'var(--color-navy)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Intro message quote */}
                <div
                  style={{
                    background: 'var(--color-bg)',
                    borderLeft: '3px solid var(--color-border-hover)',
                    padding: '8px 12px',
                    borderRadius: '0 6px 6px 0',
                    fontSize: '0.84rem',
                    color: 'var(--color-text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  "{req.introMessage}"
                </div>

                {/* Response Note if present */}
                {req.responseNote && (
                  <div
                    style={{
                      background: isAccepted ? '#F0FDF4' : '#FEF2F2',
                      borderLeft: `3px solid ${isAccepted ? '#10B981' : '#EF4444'}`,
                      padding: '8px 12px',
                      borderRadius: '0 6px 6px 0',
                      fontSize: '0.82rem',
                      color: isAccepted ? '#065F46' : '#991B1B',
                    }}
                  >
                    <strong>Mentor Response:</strong> {req.responseNote}
                  </div>
                )}

                {/* Actions Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--color-surface-2)',
                    paddingTop: '12px',
                    marginTop: '4px',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                    Submitted on {new Date(req.submittedAt).toLocaleDateString()}
                  </span>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenAction(req, 'view')}
                      style={{
                        padding: '6px 12px',
                        background: '#FFFFFF',
                        border: '1px solid var(--color-border-hover)',
                        borderRadius: 0,
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      View Details
                    </button>

                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(req, 'decline')}
                          style={{
                            padding: '6px 12px',
                            background: '#FFFFFF',
                            border: '1px solid #FECACA',
                            borderRadius: 0,
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#DC2626',
                            cursor: 'pointer',
                          }}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAction(req, 'accept')}
                          style={{
                            padding: '6px 16px',
                            background: isAtCapacity ? 'var(--color-text-faint)' : 'var(--color-blue)',
                            border: 'none',
                            borderRadius: 0,
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#FFFFFF',
                            cursor: isAtCapacity ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Accept Application
                        </button>
                      </>
                    )}

                    {isAccepted && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('mentees')}
                        style={{
                          padding: '6px 14px',
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          borderRadius: 0,
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#065F46',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        Go to Mentee Profile <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for View / Accept / Decline */}
      {selectedRequest && modalMode && (
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
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                {modalMode === 'view' && 'Mentorship Application Details'}
                {modalMode === 'accept' && `Accept ${selectedRequest.menteeName}?`}
                {modalMode === 'decline' && `Decline ${selectedRequest.menteeName}?`}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-faint)',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMsg && (
                <div
                  style={{
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    padding: '10px 14px',
                    borderRadius: 0,
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {modalMode === 'accept' && isAtCapacity && (
                <div
                  style={{
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    padding: '10px 14px',
                    borderRadius: 0,
                    fontSize: '0.84rem',
                  }}
                >
                  <strong>Note:</strong> You currently have {activeMenteesCount} active mentees (preferred limit is{' '}
                  {maxCapacity}). Accepting another mentee will exceed your configured preferred capacity.
                </div>
              )}

              {/* Mentee summary */}
              <div style={{ background: 'var(--color-bg)', padding: '14px', borderRadius: 0, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-navy)', fontSize: '0.92rem' }}>
                    {selectedRequest.menteeName}
                  </span>
                  <span style={{ color: 'var(--color-blue)', fontWeight: 600, fontSize: '0.82rem' }}>
                    {selectedRequest.requestedTrack}
                  </span>
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                  <strong>Goal:</strong> {selectedRequest.careerGoal}
                </p>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                  <strong>Availability:</strong> {selectedRequest.preferredTime}
                </p>
              </div>

              {/* Intro message */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Learner Statement
                </label>
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--color-border-hover)',
                    borderRadius: 0,
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    color: 'var(--color-navy)',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedRequest.introMessage}
                </div>
              </div>

              {/* Response note input if accepting or declining */}
              {(modalMode === 'accept' || modalMode === 'decline') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    {modalMode === 'accept' ? 'Welcome Note (Optional)' : 'Decline Reason / Note'}
                  </label>
                  <textarea
                    rows={3}
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    placeholder={
                      modalMode === 'accept'
                        ? 'e.g. Excited to work with you! Let us schedule our first milestone review.'
                        : 'e.g. My mentee capacity is full this quarter, but I wish you the best!'
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 0,
                      border: '1px solid var(--color-border-hover)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  padding: '8px 16px',
                  borderRadius: 0,
                  background: '#FFFFFF',
                  border: '1px solid var(--color-border-hover)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {modalMode === 'view' ? 'Close' : 'Cancel'}
              </button>

              {modalMode === 'accept' && (
                <button
                  type="button"
                  onClick={handleConfirmAccept}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 0,
                    background: 'var(--color-blue)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Check size={16} /> Confirm & Add Mentee
                </button>
              )}

              {modalMode === 'decline' && (
                <button
                  type="button"
                  onClick={handleConfirmDecline}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 0,
                    background: '#DC2626',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle size={16} /> Confirm Decline
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
