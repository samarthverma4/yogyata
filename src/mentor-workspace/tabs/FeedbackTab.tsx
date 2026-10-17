import React, { useState } from 'react';
import type {
  MentorWorkspaceState,
  LearningFeedback,
  FeedbackVisibility,
} from '../types';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Lock,
  Share2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Eye,
} from 'lucide-react';

interface FeedbackTabProps {
  workspace: MentorWorkspaceState;
  onUpdateWorkspace: (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => void;
  preselectedMenteeId?: string | null;
  preselectedSessionId?: string | null;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = ({
  workspace,
  onUpdateWorkspace,
  preselectedMenteeId,
  preselectedSessionId,
}) => {
  const { feedback, mentees, sessions } = workspace;

  const [visibilityFilter, setVisibilityFilter] = useState<'all' | FeedbackVisibility>('all');
  const [menteeFilter, setMenteeFilter] = useState<string>('all');

  // Modals state
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<LearningFeedback | null>(null);
  const [deletingFeedback, setDeletingFeedback] = useState<LearningFeedback | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Form state
  const [formMenteeId, setFormMenteeId] = useState<string>(
    preselectedMenteeId || (mentees.length > 0 ? mentees[0].id : '')
  );
  const [formSessionId, setFormSessionId] = useState<string>(preselectedSessionId || '');
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formStrengths, setFormStrengths] = useState('');
  const [formImprovements, setFormImprovements] = useState('');
  const [formNextSteps, setFormNextSteps] = useState('');
  const [formPrivateReflection, setFormPrivateReflection] = useState('');
  const [formVisibility, setFormVisibility] = useState<FeedbackVisibility>('shared-with-mentee');
  const [formError, setFormError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Mentee & session lists
  const activeMentees = mentees.filter((m) => m.status === 'active');
  const completedSessionsForMentee = sessions.filter(
    (s) => s.menteeId === formMenteeId && s.status === 'completed'
  );

  // Filtered feedback
  const filteredFeedback = feedback.filter((fb) => {
    const matchesVis = visibilityFilter === 'all' || fb.visibility === visibilityFilter;
    const matchesMentee = menteeFilter === 'all' || fb.menteeId === menteeFilter;
    return matchesVis && matchesMentee;
  });

  const sharedCount = feedback.filter((f) => f.visibility === 'shared-with-mentee').length;
  const privateCount = feedback.filter((f) => f.visibility === 'private-mentor-note').length;

  const handleOpenNewModal = () => {
    setEditingFeedback(null);
    setFormMenteeId(preselectedMenteeId || (activeMentees.length > 0 ? activeMentees[0].id : ''));
    setFormSessionId(preselectedSessionId || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormStrengths('');
    setFormImprovements('');
    setFormNextSteps('');
    setFormPrivateReflection('');
    setFormVisibility('shared-with-mentee');
    setFormError('');
    setShowLivePreview(false);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (fb: LearningFeedback) => {
    setEditingFeedback(fb);
    setFormMenteeId(fb.menteeId);
    setFormSessionId(fb.sessionId || '');
    setFormDate(fb.feedbackDate);
    setFormStrengths(fb.strengthsObserved);
    setFormImprovements(fb.improvementAreas);
    setFormNextSteps(fb.recommendedNextSteps);
    setFormPrivateReflection(fb.privateMentorReflection || '');
    setFormVisibility(fb.visibility);
    setFormError('');
    setShowLivePreview(false);
    setIsEditorModalOpen(true);
  };

  const handleSaveFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formMenteeId) {
      setFormError('Please select a mentee.');
      return;
    }
    if (!formStrengths.trim()) {
      setFormError('Please specify strengths observed.');
      return;
    }
    if (!formImprovements.trim()) {
      setFormError('Please specify improvement areas.');
      return;
    }
    if (!formNextSteps.trim()) {
      setFormError('Please specify recommended next steps.');
      return;
    }

    const menteeObj = mentees.find((m) => m.id === formMenteeId);
    const menteeName = menteeObj ? menteeObj.menteeName : 'Mentee';

    if (editingFeedback) {
      onUpdateWorkspace((prev) => ({
        ...prev,
        feedback: prev.feedback.map((f) =>
          f.id === editingFeedback.id
            ? {
                ...f,
                menteeId: formMenteeId,
                menteeName,
                sessionId: formSessionId || undefined,
                feedbackDate: formDate,
                strengthsObserved: formStrengths.trim(),
                improvementAreas: formImprovements.trim(),
                recommendedNextSteps: formNextSteps.trim(),
                privateMentorReflection: formPrivateReflection.trim() || undefined,
                visibility: formVisibility,
              }
            : f
        ),
      }));
      setToastMsg('Feedback entry updated successfully.');
    } else {
      const newFb: LearningFeedback = {
        id: `fb-${Date.now()}`,
        menteeId: formMenteeId,
        menteeName,
        sessionId: formSessionId || undefined,
        feedbackDate: formDate,
        strengthsObserved: formStrengths.trim(),
        improvementAreas: formImprovements.trim(),
        recommendedNextSteps: formNextSteps.trim(),
        privateMentorReflection: formPrivateReflection.trim() || undefined,
        visibility: formVisibility,
        isDemoRecord: true,
      };

      onUpdateWorkspace((prev) => ({
        ...prev,
        feedback: [newFb, ...prev.feedback],
      }));
      setToastMsg(`Feedback logged for ${menteeName}.`);
    }

    setIsEditorModalOpen(false);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleConfirmDelete = () => {
    if (!deletingFeedback) return;

    onUpdateWorkspace((prev) => ({
      ...prev,
      feedback: prev.feedback.filter((f) => f.id !== deletingFeedback.id),
    }));

    setToastMsg('Feedback record deleted.');
    setDeletingFeedback(null);
    setTimeout(() => setToastMsg(''), 4000);
  };

  return (
    <div className="tab-pane-content" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1B2A4E', margin: '0 0 6px 0' }}>
            Learning Feedback & Guidance
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.88rem' }}>
            Provide actionable mentorship reflections, highlight core strengths, and steer technical progression.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewModal}
          disabled={mentees.length === 0}
          style={{
            padding: '9px 18px',
            background: mentees.length === 0 ? '#94A3B8' : '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: mentees.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Plus size={16} /> Record Feedback
        </button>
      </div>

      {/* CRITICAL SKILL PASSPORT NOTICE BANNER */}
      <div
        style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <ShieldAlert size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.82rem', color: '#92400E', lineHeight: 1.5 }}>
          <strong>Developmental Guidance Policy:</strong> Mentor feedback logged here provides qualitative advice and
          coaching recommendations. Creating feedback, completing mentoring sessions, or completing action items does
          <strong> not</strong> automatically issue or upgrade a Verified Skill Passport credential. Formal credentials
          strictly require objective project challenge evaluations.
        </div>
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

      {/* Filters */}
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setVisibilityFilter('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: visibilityFilter === 'all' ? '1px solid #2563EB' : '1px solid #E2E8F0',
              background: visibilityFilter === 'all' ? '#EFF6FF' : '#FFFFFF',
              color: visibilityFilter === 'all' ? '#1D4ED8' : '#64748B',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            All Feedback ({feedback.length})
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter('shared-with-mentee')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: visibilityFilter === 'shared-with-mentee' ? '1px solid #059669' : '1px solid #E2E8F0',
              background: visibilityFilter === 'shared-with-mentee' ? '#ECFDF5' : '#FFFFFF',
              color: visibilityFilter === 'shared-with-mentee' ? '#065F46' : '#64748B',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Shared with Mentee ({sharedCount})
          </button>
          <button
            type="button"
            onClick={() => setVisibilityFilter('private-mentor-note')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: visibilityFilter === 'private-mentor-note' ? '1px solid #D97706' : '1px solid #E2E8F0',
              background: visibilityFilter === 'private-mentor-note' ? '#FFFBEB' : '#FFFFFF',
              color: visibilityFilter === 'private-mentor-note' ? '#92400E' : '#64748B',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Private Mentor Only ({privateCount})
          </button>
        </div>

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

      {/* Feedback Feed */}
      {filteredFeedback.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px dashed #CBD5E1',
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <MessageSquare size={36} style={{ color: '#94A3B8', marginBottom: '10px' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', margin: '0 0 6px 0' }}>
            No feedback entries found
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.84rem', maxWidth: '400px', margin: '0 auto 16px auto' }}>
            Record structured coaching feedback after sessions or during code pairing reviews.
          </p>
          {mentees.length > 0 && (
            <button
              type="button"
              onClick={handleOpenNewModal}
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
              + Record First Feedback
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredFeedback.map((fb) => {
            const isShared = fb.visibility === 'shared-with-mentee';

            return (
              <div
                key={fb.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        border: '1px solid #E0E7FF',
                      }}
                    >
                      {fb.menteeName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                          Feedback for {fb.menteeName}
                        </h3>
                        {fb.isDemoRecord && (
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
                      <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                        Logged on {new Date(fb.feedbackDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Visibility Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isShared ? (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '12px',
                          background: '#ECFDF5',
                          color: '#065F46',
                          border: '1px solid #A7F3D0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Share2 size={12} /> Shared with Mentee
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '12px',
                          background: '#FFFBEB',
                          color: '#92400E',
                          border: '1px solid #FDE68A',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Lock size={12} /> Private Note Only
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(fb)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Edit Feedback"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingFeedback(fb)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Delete Feedback"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Feedback 3-column breakdown */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#166534',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Strengths Observed
                    </span>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#14532D', lineHeight: 1.45 }}>
                      {fb.strengthsObserved}
                    </p>
                  </div>

                  <div
                    style={{
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      borderRadius: '8px',
                      padding: '12px 14px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#92400E',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Growth & Improvement Areas
                    </span>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#78350F', lineHeight: 1.45 }}>
                      {fb.improvementAreas}
                    </p>
                  </div>

                  <div
                    style={{
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '8px',
                      padding: '12px 14px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#1D4ED8',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Recommended Next Steps
                    </span>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#1E40AF', lineHeight: 1.45 }}>
                      {fb.recommendedNextSteps}
                    </p>
                  </div>
                </div>

                {/* Private Reflection if present */}
                {fb.privateMentorReflection && (
                  <div
                    style={{
                      background: '#FFFDF5',
                      borderLeft: '3px solid #D97706',
                      padding: '8px 12px',
                      borderRadius: '0 6px 6px 0',
                      fontSize: '0.8125rem',
                      color: '#78350F',
                    }}
                  >
                    <strong>Private Reflection (Only visible to you): </strong>
                    {fb.privateMentorReflection}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {isEditorModalOpen && (
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
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal header */}
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
                {editingFeedback ? 'Edit Learning Feedback' : 'Record Mentee Feedback'}
              </h2>
              <button
                type="button"
                onClick={() => setIsEditorModalOpen(false)}
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

            <form onSubmit={handleSaveFeedback}>
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

                {/* Mentee & Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Mentee *
                    </label>
                    <select
                      value={formMenteeId}
                      onChange={(e) => {
                        setFormMenteeId(e.target.value);
                        setFormSessionId('');
                      }}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.82rem',
                      }}
                    >
                      {activeMentees.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.menteeName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Feedback Date *
                    </label>
                    <input
                      type="date"
                      value={formDate}
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
                </div>

                {/* Related session */}
                {completedSessionsForMentee.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Link to Concluded Session (Optional)
                    </label>
                    <select
                      value={formSessionId}
                      onChange={(e) => setFormSessionId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.82rem',
                      }}
                    >
                      <option value="">-- General / Ad-hoc Review --</option>
                      {completedSessionsForMentee.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({s.date})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Strengths */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Strengths Observed *
                  </label>
                  <textarea
                    rows={2}
                    value={formStrengths}
                    onChange={(e) => setFormStrengths(e.target.value)}
                    placeholder="Highlight technical competence, code quality, communication, or architectural clarity..."
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

                {/* Improvement Areas */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Improvement Areas *
                  </label>
                  <textarea
                    rows={2}
                    value={formImprovements}
                    onChange={(e) => setFormImprovements(e.target.value)}
                    placeholder="Where should the mentee focus next? (e.g. error handling, concurrency, test coverage)..."
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

                {/* Recommended Next Steps */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Recommended Next Steps & Exercises *
                  </label>
                  <textarea
                    rows={2}
                    value={formNextSteps}
                    onChange={(e) => setFormNextSteps(e.target.value)}
                    placeholder="Concrete exercises, suggested reading, or repo challenge assignments..."
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

                {/* Private Mentor Reflection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#92400E', marginBottom: '4px' }}>
                    Private Mentor Reflection (Optional — Only visible to you)
                  </label>
                  <input
                    type="text"
                    value={formPrivateReflection}
                    onChange={(e) => setFormPrivateReflection(e.target.value)}
                    placeholder="Personal notes on candidate readiness, interview preparedness..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #FDE68A',
                      background: '#FFFDF5',
                      fontSize: '0.84rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Visibility Setting */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Visibility Preference
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="visibility"
                        value="shared-with-mentee"
                        checked={formVisibility === 'shared-with-mentee'}
                        onChange={() => setFormVisibility('shared-with-mentee')}
                      />
                      <Share2 size={14} color="#059669" /> Shared with Mentee
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="visibility"
                        value="private-mentor-note"
                        checked={formVisibility === 'private-mentor-note'}
                        onChange={() => setFormVisibility('private-mentor-note')}
                      />
                      <Lock size={14} color="#D97706" /> Private Mentor Note
                    </label>
                  </div>
                </div>

                {/* Live Preview Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowLivePreview(!showLivePreview)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563EB',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    <Eye size={13} /> {showLivePreview ? 'Hide Preview' : 'Show Feedback Preview'}
                  </button>

                  {showLivePreview && (
                    <div
                      style={{
                        marginTop: '10px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                        Preview: Feedback Card
                      </div>
                      <p style={{ margin: '0 0 4px 0', color: '#166534' }}>
                        <strong>Strengths: </strong> {formStrengths || '(No strengths specified yet)'}
                      </p>
                      <p style={{ margin: '0 0 4px 0', color: '#92400E' }}>
                        <strong>Improvement Areas: </strong> {formImprovements || '(No improvement areas specified yet)'}
                      </p>
                      <p style={{ margin: 0, color: '#1E40AF' }}>
                        <strong>Next Steps: </strong> {formNextSteps || '(No next steps specified yet)'}
                      </p>
                    </div>
                  )}
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
                  onClick={() => setIsEditorModalOpen(false)}
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
                  {editingFeedback ? 'Update Feedback' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingFeedback && (
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
              <AlertCircle size={22} color="#DC2626" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1B2A4E', margin: 0 }}>
                Delete Feedback Record?
              </h2>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete this feedback entry for{' '}
              <strong>{deletingFeedback.menteeName}</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingFeedback(null)}
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
                Keep Record
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
