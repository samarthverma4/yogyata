import React, { useState } from 'react';
import type {
  MentorWorkspaceState,
  MenteeRelationshipStatus,
  MenteeActionItem,
} from '../types';
import {
  Users,
  Search,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  CalendarPlus,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface MenteesTabProps {
  workspace: MentorWorkspaceState;
  onUpdateWorkspace: (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => void;
  onNavigateToSessionsWithMentee?: (menteeId: string) => void;
  onNavigateToFeedbackWithMentee?: (menteeId: string) => void;
}

export const MenteesTab: React.FC<MenteesTabProps> = ({
  workspace,
  onUpdateWorkspace,
  onNavigateToSessionsWithMentee,
  onNavigateToFeedbackWithMentee,
}) => {
  const { mentees } = workspace;

  const [statusFilter, setStatusFilter] = useState<'all' | MenteeRelationshipStatus>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(
    mentees.length > 0 ? mentees[0].id : null
  );

  // Sub-states for selected mentee editing
  const [newGoalText, setNewGoalText] = useState('');
  const [newActionItemText, setNewActionItemText] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [privateNotesBuffer, setPrivateNotesBuffer] = useState<string>(() =>
    mentees.length > 0 ? mentees[0].privateNotes || '' : ''
  );
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesSavedToast, setNotesSavedToast] = useState(false);

  // Selected mentee
  const activeMentee = mentees.find((m) => m.id === selectedMenteeId) || mentees[0] || null;

  const handleSelectMentee = (menteeId: string) => {
    setSelectedMenteeId(menteeId);
    const target = mentees.find((m) => m.id === menteeId);
    if (target) {
      setPrivateNotesBuffer(target.privateNotes || '');
      setIsEditingNotes(false);
    }
  };

  // Filters
  const filteredMentees = mentees.filter((m) => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      m.menteeName.toLowerCase().includes(query) ||
      m.careerGoal.toLowerCase().includes(query) ||
      m.mentorshipTrack.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const activeCount = mentees.filter((m) => m.status === 'active').length;
  const completedCount = mentees.filter((m) => m.status === 'completed').length;
  const onHoldCount = mentees.filter((m) => m.status === 'on-hold').length;

  // Handlers for active mentee
  const handleStatusChange = (newStatus: MenteeRelationshipStatus) => {
    if (!activeMentee) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      mentees: prev.mentees.map((m) =>
        m.id === activeMentee.id ? { ...m, status: newStatus } : m
      ),
    }));
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentee || !newGoalText.trim()) return;

    const trimmed = newGoalText.trim();
    onUpdateWorkspace((prev) => ({
      ...prev,
      mentees: prev.mentees.map((m) =>
        m.id === activeMentee.id ? { ...m, goals: [...m.goals, trimmed] } : m
      ),
    }));
    setNewGoalText('');
  };

  const handleRemoveGoal = (indexToRemove: number) => {
    if (!activeMentee) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      mentees: prev.mentees.map((m) =>
        m.id === activeMentee.id
          ? { ...m, goals: m.goals.filter((_, idx) => idx !== indexToRemove) }
          : m
      ),
    }));
  };

  const handleAddActionItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMentee || !newActionItemText.trim()) return;

    const newItem: MenteeActionItem = {
      id: `act-${Date.now()}`,
      text: newActionItemText.trim(),
      completed: false,
      dueDate: newActionDueDate || undefined,
    };

    onUpdateWorkspace((prev) => ({
      ...prev,
      mentees: prev.mentees.map((m) =>
        m.id === activeMentee.id
          ? { ...m, actionItems: [...(m.actionItems || []), newItem] }
          : m
      ),
    }));
    setNewActionItemText('');
    setNewActionDueDate('');
  };

  const handleToggleActionItem = (itemId: string) => {
    if (!activeMentee) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      mentees: prev.mentees.map((m) =>
        m.id === activeMentee.id
          ? {
              ...m,
              actionItems: m.actionItems.map((act) =>
                act.id === itemId ? { ...act, completed: !act.completed } : act
              ),
            }
          : m
      ),
    }));
  };

  const handleDeleteActionItem = (itemId: string) => {
    if (!activeMentee) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      mentees: prev.mentees.map((m) =>
        m.id === activeMentee.id
          ? { ...m, actionItems: m.actionItems.filter((act) => act.id !== itemId) }
          : m
      ),
    }));
  };

  const handleSavePrivateNotes = () => {
    if (!activeMentee) return;
    onUpdateWorkspace((prev) => ({
      ...prev,
      mentees: prev.mentees.map((m) =>
        m.id === activeMentee.id ? { ...m, privateNotes: privateNotesBuffer } : m
      ),
    }));
    setIsEditingNotes(false);
    setNotesSavedToast(true);
    setTimeout(() => setNotesSavedToast(false), 3000);
  };

  return (
    <div className="tab-pane-content" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 6px 0' }}>
          Mentee Roster & Progression
        </h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
          Track active learner milestones, assign action items, and record private developmental observations.
        </p>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px minmax(0, 1fr)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Filter & Mentee List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Search & Filter Pill Group */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-border)',
              borderRadius: 0,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-faint)',
                }}
              />
              <input
                type="text"
                placeholder="Search mentees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: 0,
                  border: '1px solid var(--color-border)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: 0,
                  border: statusFilter === 'active' ? '1px solid #059669' : '1px solid var(--color-border)',
                  background: statusFilter === 'active' ? '#ECFDF5' : '#FFFFFF',
                  color: statusFilter === 'active' ? '#065F46' : 'var(--color-text-muted)',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('on-hold')}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: 0,
                  border: statusFilter === 'on-hold' ? '1px solid #D97706' : '1px solid var(--color-border)',
                  background: statusFilter === 'on-hold' ? '#FFFBEB' : '#FFFFFF',
                  color: statusFilter === 'on-hold' ? '#92400E' : 'var(--color-text-muted)',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Hold ({onHoldCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: 0,
                  border: statusFilter === 'completed' ? '1px solid var(--color-blue)' : '1px solid var(--color-border)',
                  background: statusFilter === 'completed' ? 'var(--color-blue-tint)' : '#FFFFFF',
                  color: statusFilter === 'completed' ? 'var(--color-blue-hover)' : 'var(--color-text-muted)',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Done ({completedCount})
              </button>
            </div>
          </div>

          {/* Mentee List */}
          {filteredMentees.length === 0 ? (
            <div
              style={{
                background: '#FFFFFF',
                border: '1px dashed var(--color-border-hover)',
                borderRadius: 0,
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <Users size={28} style={{ color: 'var(--color-text-faint)', marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                No mentees match your filter.
              </p>
            </div>
          ) : (
            filteredMentees.map((m) => {
              const isSelected = activeMentee && activeMentee.id === m.id;
              const pendingActionCount = (m.actionItems || []).filter((a) => !a.completed).length;

              return (
                <div
                  key={m.id}
                  onClick={() => handleSelectMentee(m.id)}
                  style={{
                    background: isSelected ? 'var(--color-blue-tint)' : '#FFFFFF',
                    border: isSelected ? '1.5px solid var(--color-blue)' : '1px solid var(--color-border)',
                    borderRadius: 0,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.08)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: isSelected ? 'var(--color-blue-line)' : 'var(--color-surface-2)',
                        color: isSelected ? 'var(--color-blue-hover)' : 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      {m.menteeName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: 'var(--color-navy)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {m.menteeName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 0,
                            background:
                              m.status === 'active'
                                ? '#ECFDF5'
                                : m.status === 'on-hold'
                                ? '#FFFBEB'
                                : 'var(--color-surface-2)',
                            color:
                              m.status === 'active'
                                ? '#059669'
                                : m.status === 'on-hold'
                                ? '#D97706'
                                : 'var(--color-text-muted)',
                          }}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '2px 0 0 0',
                          fontSize: '0.76rem',
                          color: 'var(--color-text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {m.mentorshipTrack}
                      </p>
                    </div>
                  </div>

                  {pendingActionCount > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#D97706', fontWeight: 600 }}>
                      • {pendingActionCount} pending action item{pendingActionCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Mentee Detail View */}
        {activeMentee ? (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--color-border)',
              borderRadius: 0,
              padding: '24px 28px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* Mentee Header & Primary Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--color-surface-2)',
                paddingBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'var(--color-blue-tint)',
                    color: 'var(--color-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    border: '1px solid var(--color-blue-tint)',
                  }}
                >
                  {activeMentee.menteeName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)', margin: 0 }}>
                      {activeMentee.menteeName}
                    </h2>
                    {activeMentee.isDemoRecord && (
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
                        DEMO RECORD
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                    {activeMentee.menteeEmail} • Mentoring since{' '}
                    {new Date(activeMentee.startDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Status and Direct Session/Feedback CTA */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={activeMentee.status}
                  onChange={(e) => handleStatusChange(e.target.value as MenteeRelationshipStatus)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 0,
                    border: '1px solid var(--color-border-hover)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--color-navy)',
                    outline: 'none',
                    background: 'var(--color-bg)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="active">Active Relationship</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Mentorship Completed</option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    onNavigateToSessionsWithMentee && onNavigateToSessionsWithMentee(activeMentee.id)
                  }
                  style={{
                    padding: '7px 14px',
                    borderRadius: 0,
                    background: 'var(--color-blue)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CalendarPlus size={14} /> Schedule Session
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onNavigateToFeedbackWithMentee && onNavigateToFeedbackWithMentee(activeMentee.id)
                  }
                  style={{
                    padding: '7px 12px',
                    borderRadius: 0,
                    background: '#FFFFFF',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border-hover)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <MessageSquare size={14} /> Feedback
                </button>
              </div>
            </div>

            {/* Profile & Track Banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                background: 'var(--color-bg)',
                padding: '14px 18px',
                borderRadius: 0,
                border: '1px solid var(--color-border)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 700 }}>
                  Mentorship Track
                </span>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-blue)' }}>
                  {activeMentee.mentorshipTrack}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 700 }}>
                  Career Goal
                </span>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-navy)' }}>
                  {activeMentee.careerGoal}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-faint)', fontWeight: 700 }}>
                  Next Session
                </span>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                  {activeMentee.nextSessionDate ? (
                    <span style={{ color: '#059669', fontWeight: 600 }}>{activeMentee.nextSessionDate}</span>
                  ) : (
                    <span style={{ color: 'var(--color-text-faint)' }}>None scheduled</span>
                  )}
                </p>
              </div>
            </div>

            {/* Structured Learning Goals */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                  Mentorship Milestones & Goals
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {activeMentee.goals.length} defined milestone{activeMentee.goals.length === 1 ? '' : 's'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                {activeMentee.goals.map((goal, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      border: '1px solid var(--color-border)',
                      borderRadius: 0,
                      fontSize: '0.84rem',
                      color: 'var(--color-navy)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={14} color="var(--color-blue)" />
                      <span>{goal}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveGoal(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-faint)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                      title="Remove Goal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Goal Input */}
              <form onSubmit={handleAddGoal} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Add a new learning milestone or goal..."
                  value={newGoalText}
                  onChange={(e) => setNewGoalText(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 0,
                    border: '1px solid var(--color-border-hover)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 14px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border-hover)',
                    borderRadius: 0,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--color-navy)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Plus size={14} /> Add
                </button>
              </form>
            </div>

            {/* Mentee Action Items */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                  Action Items & Assignments
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {(activeMentee.actionItems || []).filter((a) => a.completed).length} of{' '}
                  {(activeMentee.actionItems || []).length} completed
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {(activeMentee.actionItems || []).length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-faint)', fontStyle: 'italic' }}>
                    No pending action items assigned.
                  </p>
                ) : (
                  (activeMentee.actionItems || []).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: item.completed ? 'var(--color-bg)' : '#FFFFFF',
                        border: `1px solid ${item.completed ? 'var(--color-border)' : 'var(--color-border-hover)'}`,
                        borderRadius: 0,
                        fontSize: '0.84rem',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          flex: 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleActionItem(item.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            color: item.completed ? 'var(--color-text-faint)' : 'var(--color-navy)',
                            textDecoration: item.completed ? 'line-through' : 'none',
                          }}
                        >
                          {item.text}
                        </span>
                        {item.dueDate && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: 0,
                              background: 'var(--color-surface-2)',
                              color: 'var(--color-text-muted)',
                              marginLeft: '6px',
                            }}
                          >
                            Due: {item.dueDate}
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteActionItem(item.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-faint)',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Action Item Form */}
              <form onSubmit={handleAddActionItem} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Assign new task, challenge, or reading..."
                  value={newActionItemText}
                  onChange={(e) => setNewActionItemText(e.target.value)}
                  style={{
                    flex: 2,
                    padding: '8px 12px',
                    borderRadius: 0,
                    border: '1px solid var(--color-border-hover)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
                <input
                  type="date"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 0,
                    border: '1px solid var(--color-border-hover)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    color: 'var(--color-navy)',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    background: 'var(--color-blue)',
                    border: 'none',
                    borderRadius: 0,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  Assign
                </button>
              </form>
            </div>

            {/* Strictly Private Mentor Notes */}
            <div
              style={{
                background: '#FFFDF5',
                border: '1px solid #FDE68A',
                borderRadius: 0,
                padding: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={15} color="#D97706" />
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#92400E', margin: 0 }}>
                    Private Mentor Journal & Observations
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    background: '#FEF3C7',
                    color: '#B45309',
                    borderRadius: 0,
                    fontWeight: 600,
                  }}
                >
                  STRICTLY PRIVATE
                </span>
              </div>

              <p style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#78350F' }}>
                These notes are confidential to you and will never be shared with the mentee or exported to their profile.
              </p>

              <textarea
                rows={3}
                value={privateNotesBuffer}
                onChange={(e) => {
                  setPrivateNotesBuffer(e.target.value);
                  setIsEditingNotes(true);
                }}
                placeholder="Record private reflections on mentee's strengths, potential roadblocks, or topics for future 1:1 discussions..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 0,
                  border: '1px solid #FDE68A',
                  fontSize: '0.84rem',
                  fontFamily: 'inherit',
                  color: '#451A03',
                  boxSizing: 'border-box',
                  background: '#FFFFFF',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '8px' }}>
                {notesSavedToast && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: '#059669',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <CheckCircle2 size={14} /> Notes saved locally!
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSavePrivateNotes}
                  disabled={!isEditingNotes && !notesSavedToast}
                  style={{
                    padding: '6px 14px',
                    background: isEditingNotes ? '#D97706' : 'var(--color-surface-2)',
                    color: isEditingNotes ? '#FFFFFF' : 'var(--color-text-faint)',
                    border: 'none',
                    borderRadius: 0,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: isEditingNotes ? 'pointer' : 'default',
                  }}
                >
                  Save Private Notes
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px dashed var(--color-border-hover)',
              borderRadius: 0,
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <Users size={36} style={{ color: 'var(--color-text-faint)', marginBottom: '10px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-navy)', margin: '0 0 6px 0' }}>
              No Active Mentee Selected
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>
              Select a mentee from the left roster or accept a new application from the Requests tab.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
