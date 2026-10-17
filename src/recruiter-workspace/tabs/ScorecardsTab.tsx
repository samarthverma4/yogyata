import React, { useState } from 'react';
import {
  FileCheck,
  Star,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  ShieldAlert,
  Search,
} from 'lucide-react';
import type {
  Scorecard,
  Recommendation,
  InterviewRound,
  CandidateProfile,
} from '../types';
import { ROUND_LABELS, RECOMMENDATION_LABELS } from '../types';

interface ScorecardsTabProps {
  scorecards: Scorecard[];
  candidates: CandidateProfile[];
  availableRoles: string[];
  onCreateScorecard: (scorecard: Omit<Scorecard, 'id' | 'submittedAt'>) => void;
  onUpdateScorecard: (id: string, updates: Partial<Scorecard>) => void;
  onDeleteScorecard: (id: string) => void;
}

export const ScorecardsTab: React.FC<ScorecardsTabProps> = ({
  scorecards,
  candidates,
  availableRoles,
  onCreateScorecard,
  onUpdateScorecard,
  onDeleteScorecard,
}) => {
  const [filterRecommendation, setFilterRecommendation] = useState<'all' | Recommendation>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingScorecard, setEditingScorecard] = useState<Scorecard | null>(null);
  const [deletingScorecard, setDeletingScorecard] = useState<Scorecard | null>(null);

  // Form State
  const [candidateId, setCandidateId] = useState('');
  const [targetRole, setTargetRole] = useState(availableRoles[0] || 'Senior Technical Contributor');
  const [round, setRound] = useState<InterviewRound>('technical-deep-dive');
  const [interviewerName, setInterviewerName] = useState('');
  const [technicalRating, setTechnicalRating] = useState(4);
  const [problemSolvingRating, setProblemSolvingRating] = useState(4);
  const [communicationRating, setCommunicationRating] = useState(4);
  const [roleAlignmentRating, setRoleAlignmentRating] = useState(4);
  const [strengths, setStrengths] = useState('');
  const [areasOfConcern, setAreasOfConcern] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [recommendation, setRecommendation] = useState<Recommendation>('hire');
  const [formError, setFormError] = useState('');

  const filteredScorecards = scorecards.filter((sc) => {
    if (filterRecommendation !== 'all' && sc.recommendation !== filterRecommendation) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = sc.candidateName.toLowerCase().includes(q);
      const matchRole = sc.targetRole.toLowerCase().includes(q);
      const matchInterviewer = sc.interviewerName.toLowerCase().includes(q);
      const matchNotes = sc.interviewNotes.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchInterviewer && !matchNotes) return false;
    }
    return true;
  });

  const openCreateModal = () => {
    setEditingScorecard(null);
    setCandidateId(candidates[0]?.id || '');
    setTargetRole(availableRoles[0] || 'Senior Technical Contributor');
    setRound('technical-deep-dive');
    setInterviewerName('Shalini Menon (Lead Recruiter)');
    setTechnicalRating(4);
    setProblemSolvingRating(4);
    setCommunicationRating(4);
    setRoleAlignmentRating(4);
    setStrengths('');
    setAreasOfConcern('');
    setInterviewNotes('');
    setRecommendation('hire');
    setFormError('');
    setShowCreateModal(true);
  };

  const openEditModal = (sc: Scorecard) => {
    setEditingScorecard(sc);
    setCandidateId(sc.candidateId);
    setTargetRole(sc.targetRole);
    setRound(sc.round);
    setInterviewerName(sc.interviewerName);
    setTechnicalRating(sc.technicalRating);
    setProblemSolvingRating(sc.problemSolvingRating);
    setCommunicationRating(sc.communicationRating);
    setRoleAlignmentRating(sc.roleAlignmentRating);
    setStrengths(sc.strengths);
    setAreasOfConcern(sc.areasOfConcern);
    setInterviewNotes(sc.interviewNotes);
    setRecommendation(sc.recommendation);
    setFormError('');
    setShowCreateModal(true);
  };

  const validateScorecard = (): boolean => {
    if (!candidateId) {
      setFormError('Candidate is required');
      return false;
    }
    if (!interviewerName.trim()) {
      setFormError('Interviewer name is required');
      return false;
    }
    if (!strengths.trim()) {
      setFormError('Observed strengths are required');
      return false;
    }
    if (!interviewNotes.trim()) {
      setFormError('Interview summary notes are required');
      return false;
    }

    // Check duplicate scorecard for same candidate, round, and interviewer
    const duplicate = scorecards.find(
      (sc) =>
        sc.id !== editingScorecard?.id &&
        sc.candidateId === candidateId &&
        sc.round === round &&
        sc.interviewerName.toLowerCase().trim() === interviewerName.toLowerCase().trim()
    );
    if (duplicate) {
      setFormError('A scorecard for this candidate, round, and interviewer already exists.');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleSaveScorecard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateScorecard()) return;

    const cand = candidates.find((c) => c.id === candidateId);
    const candidateName = cand?.name || 'Candidate';

    if (editingScorecard) {
      onUpdateScorecard(editingScorecard.id, {
        candidateId,
        candidateName,
        targetRole,
        round,
        interviewerName,
        technicalRating,
        problemSolvingRating,
        communicationRating,
        roleAlignmentRating,
        strengths,
        areasOfConcern,
        interviewNotes,
        recommendation,
      });
    } else {
      onCreateScorecard({
        candidateId,
        candidateName,
        targetRole,
        round,
        interviewerName,
        technicalRating,
        problemSolvingRating,
        communicationRating,
        roleAlignmentRating,
        strengths,
        areasOfConcern,
        interviewNotes,
        recommendation,
      });
    }

    setShowCreateModal(false);
  };

  const renderStars = (rating: number) => {
    return (
      <div style={{ display: 'inline-flex', gap: '2px', color: '#F59E0B' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={13}
            fill={star <= rating ? '#F59E0B' : 'transparent'}
            stroke={star <= rating ? '#F59E0B' : '#CBD5E1'}
          />
        ))}
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0F172A', marginLeft: '4px' }}>
          {rating}/5
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
              Candidate Interview Scorecards
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Standardize technical interview evaluations across technical competency, problem-solving, and culture fit.
            </p>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={openCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8125rem',
              background: '#7C3AED',
              borderColor: '#7C3AED',
            }}
          >
            <Plus size={15} />
            <span>Create Scorecard</span>
          </button>
        </div>
      </div>

      {/* Skill Passport Invariant Banner */}
      <div
        className="alert-banner alert-banner-info"
        style={{
          background: '#FAF5FF',
          borderColor: '#E9D5FF',
          color: '#6B21A8',
        }}
      >
        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <strong>Evaluation Rule:</strong> Interview scorecards are internal qualitative evaluations.
          Favorable scorecards or "Strong Hire" recommendations do <em>not</em> issue or modify Verified Skill Passport
          credentials. Verified credentials remain strictly based on objective challenge assessments.
        </div>
      </div>

      {/* Filter and Search Bar */}
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={filterRecommendation}
            onChange={(e) => setFilterRecommendation(e.target.value as any)}
            style={{ minWidth: '170px', fontSize: '0.8125rem' }}
          >
            <option value="all">All Recommendations</option>
            <option value="strong-hire">Strong Hire</option>
            <option value="hire">Hire</option>
            <option value="hold">Hold</option>
            <option value="no-hire">No Hire</option>
          </select>
        </div>

        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search scorecards by candidate or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.1rem', fontSize: '0.8125rem' }}
          />
        </div>
      </div>

      {/* Scorecards Feed */}
      <div>
        {filteredScorecards.length === 0 ? (
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
              <FileCheck size={22} />
            </div>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: '#0F172A' }}>
              No scorecards recorded
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#64748B' }}>
              Log an interview evaluation with technical, problem-solving, and role alignment scores.
            </p>
            <button type="button" className="btn-secondary" onClick={openCreateModal} style={{ fontSize: '0.8125rem' }}>
              Create Scorecard
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredScorecards.map((sc) => {
              const recMeta = RECOMMENDATION_LABELS[sc.recommendation];
              const avgScore = (
                (sc.technicalRating + sc.problemSolvingRating + sc.communicationRating + sc.roleAlignmentRating) /
                4
              ).toFixed(1);

              return (
                <div
                  key={sc.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1rem', color: '#0F172A' }}>
                          {sc.candidateName}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            background: recMeta.bg,
                            color: recMeta.color,
                            fontWeight: 700,
                          }}
                        >
                          {recMeta.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          (Avg {avgScore}/5)
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.2rem' }}>
                        {sc.targetRole} • {ROUND_LABELS[sc.round]} • Interviewer: {sc.interviewerName}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => openEditModal(sc)}
                        title="Edit Scorecard"
                        style={{ padding: '0.3rem', color: '#64748B' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setDeletingScorecard(sc)}
                        title="Delete Scorecard"
                        style={{ padding: '0.3rem', color: '#DC2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* 4 Ratings Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.625rem',
                      background: '#F8FAFC',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      marginBottom: '0.875rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Technical Competency:</span>
                      {renderStars(sc.technicalRating)}
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Problem Solving:</span>
                      {renderStars(sc.problemSolvingRating)}
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Communication:</span>
                      {renderStars(sc.communicationRating)}
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Role Alignment:</span>
                      {renderStars(sc.roleAlignmentRating)}
                    </div>
                  </div>

                  {/* Strengths & Areas of Concern */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.8125rem' }}>
                    <div style={{ background: '#F0FDF4', padding: '0.625rem 0.75rem', borderRadius: '6px', border: '1px solid #DCFCE7' }}>
                      <strong style={{ color: '#15803D', fontSize: '0.75rem', display: 'block', marginBottom: '2px' }}>
                        Observed Strengths:
                      </strong>
                      <span style={{ color: '#166534', lineHeight: 1.4 }}>{sc.strengths}</span>
                    </div>

                    {sc.areasOfConcern && (
                      <div style={{ background: '#FFFBEB', padding: '0.625rem 0.75rem', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                        <strong style={{ color: '#B45309', fontSize: '0.75rem', display: 'block', marginBottom: '2px' }}>
                          Areas of Concern / Follow-up:
                        </strong>
                        <span style={{ color: '#92400E', lineHeight: 1.4 }}>{sc.areasOfConcern}</span>
                      </div>
                    )}
                  </div>

                  {/* Interview Notes */}
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.45 }}>
                    <strong>Interviewer Summary:</strong> {sc.interviewNotes}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Scorecard Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scorecard-modal-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 id="scorecard-modal-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem', color: '#0F172A' }}>
              {editingScorecard ? 'Edit Interview Scorecard' : 'Record Interview Scorecard'}
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

            <form onSubmit={handleSaveScorecard}>
              <div className="form-group">
                <label className="form-label">
                  Candidate <span className="required-star">*</span>
                </label>
                <select
                  className="form-input"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  disabled={Boolean(editingScorecard)}
                >
                  <option value="">Select a candidate</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.headline})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Target Role</label>
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
                  <label className="form-label">Interview Round</label>
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

              <div className="form-group">
                <label className="form-label">
                  Interviewer Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Shalini Menon (Lead Recruiter)"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                />
              </div>

              {/* 4 Ratings Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#F8FAFC', padding: '0.875rem', borderRadius: '6px', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Technical Competency (1-5)
                  </label>
                  <select
                    className="form-input"
                    value={technicalRating}
                    onChange={(e) => setTechnicalRating(Number(e.target.value))}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <option value={1}>1 - Unsatisfactory</option>
                    <option value={2}>2 - Below Bar</option>
                    <option value={3}>3 - Meets Bar</option>
                    <option value={4}>4 - Exceeds Bar</option>
                    <option value={5}>5 - Exceptional</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Problem Solving (1-5)
                  </label>
                  <select
                    className="form-input"
                    value={problemSolvingRating}
                    onChange={(e) => setProblemSolvingRating(Number(e.target.value))}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <option value={1}>1 - Unsatisfactory</option>
                    <option value={2}>2 - Below Bar</option>
                    <option value={3}>3 - Meets Bar</option>
                    <option value={4}>4 - Exceeds Bar</option>
                    <option value={5}>5 - Exceptional</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Communication (1-5)
                  </label>
                  <select
                    className="form-input"
                    value={communicationRating}
                    onChange={(e) => setCommunicationRating(Number(e.target.value))}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <option value={1}>1 - Unsatisfactory</option>
                    <option value={2}>2 - Below Bar</option>
                    <option value={3}>3 - Meets Bar</option>
                    <option value={4}>4 - Exceeds Bar</option>
                    <option value={5}>5 - Exceptional</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>
                    Role Alignment (1-5)
                  </label>
                  <select
                    className="form-input"
                    value={roleAlignmentRating}
                    onChange={(e) => setRoleAlignmentRating(Number(e.target.value))}
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <option value={1}>1 - Unsatisfactory</option>
                    <option value={2}>2 - Below Bar</option>
                    <option value={3}>3 - Meets Bar</option>
                    <option value={4}>4 - Exceeds Bar</option>
                    <option value={5}>5 - Exceptional</option>
                  </select>
                </div>
              </div>

              {/* Strengths */}
              <div className="form-group">
                <label className="form-label">
                  Observed Strengths &amp; Evidence <span className="required-star">*</span>
                </label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder="Key technical capabilities and communication strengths..."
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Areas of Concern */}
              <div className="form-group">
                <label className="form-label">Areas of Concern / Development</label>
                <textarea
                  rows={2}
                  className="form-input"
                  placeholder="Knowledge gaps, trade-offs, or questions for next rounds..."
                  value={areasOfConcern}
                  onChange={(e) => setAreasOfConcern(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Interview Summary Notes */}
              <div className="form-group">
                <label className="form-label">
                  Detailed Interview Notes <span className="required-star">*</span>
                </label>
                <textarea
                  rows={3}
                  className="form-input"
                  placeholder="Summary of answers, problem-solving methodology, and behavioral signals..."
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Recommendation */}
              <div className="form-group">
                <label className="form-label">
                  Hiring Recommendation <span className="required-star">*</span>
                </label>
                <select
                  className="form-input"
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value as Recommendation)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="strong-hire">Strong Hire — Exceeds technical bar</option>
                  <option value="hire">Hire — Meets all role criteria</option>
                  <option value="hold">Hold — Needs further review</option>
                  <option value="no-hire">No Hire — Does not meet current criteria</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#7C3AED', borderColor: '#7C3AED' }}>
                  {editingScorecard ? 'Save Changes' : 'Submit Scorecard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingScorecard && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-scorecard-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '420px' }}>
            <h3 id="delete-scorecard-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Delete Interview Scorecard?
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.84rem', color: '#64748B', lineHeight: 1.45 }}>
              Are you sure you want to permanently delete the scorecard for{' '}
              <strong>{deletingScorecard.candidateName}</strong> ({ROUND_LABELS[deletingScorecard.round]}) by{' '}
              {deletingScorecard.interviewerName}?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingScorecard(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onDeleteScorecard(deletingScorecard.id);
                  setDeletingScorecard(null);
                }}
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
              >
                Delete Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
