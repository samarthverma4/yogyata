import React, { useState } from 'react';
import {
  Layers,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  Eye,
  LayoutGrid,
  List,
} from 'lucide-react';
import type {
  PipelineCandidate,
  PipelineStage,
  PipelinePriority,
  CandidateProfile,
} from '../types';
import { STAGE_LABELS } from '../types';
import { CandidateDetailModal } from '../CandidateDetailModal';

interface PipelineTabProps {
  pipeline: PipelineCandidate[];
  candidates: CandidateProfile[];
  availableRoles: string[];
  onUpdateStage: (pipelineId: string, nextStage: PipelineStage) => void;
  onUpdateDetails: (
    pipelineId: string,
    data: { recruiterNotes?: string; nextAction?: string; priority?: PipelinePriority; tags?: string[] }
  ) => void;
  onRemoveFromPipeline: (pipelineId: string) => void;
  onAddToPipeline: (candidateId: string, role: string, stage: PipelineStage) => void;
  onToggleSaveCandidate: (candidateId: string) => void;
}

export const PipelineTab: React.FC<PipelineTabProps> = ({
  pipeline,
  candidates,
  availableRoles,
  onUpdateStage,
  onUpdateDetails,
  onRemoveFromPipeline,
  onAddToPipeline,
  onToggleSaveCandidate,
}) => {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filterStage, setFilterStage] = useState<'all' | PipelineStage>('all');
  const [filterRole, setFilterRole] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEditingId, setActiveEditingId] = useState<string | null>(null);
  const [candidateToInspect, setCandidateToInspect] = useState<CandidateProfile | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<PipelineCandidate | null>(null);

  // Edit note/action form state
  const [editNotes, setEditNotes] = useState('');
  const [editNextAction, setEditNextAction] = useState('');
  const [editPriority, setEditPriority] = useState<PipelinePriority>('medium');
  const [editTags, setEditTags] = useState<string[]>([]);

  const stages: PipelineStage[] = [
    'sourced',
    'screening',
    'interview',
    'offer',
    'hired',
    'archived',
  ];

  const filteredPipeline = pipeline.filter((item) => {
    if (filterStage !== 'all' && item.stage !== filterStage) return false;
    if (filterRole !== 'all' && item.targetRole !== filterRole) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.candidateName.toLowerCase().includes(q);
      const matchRole = item.targetRole.toLowerCase().includes(q);
      const matchNotes = item.recruiterNotes.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchNotes) return false;
    }
    return true;
  });

  const startEditing = (item: PipelineCandidate) => {
    setActiveEditingId(item.id);
    setEditNotes(item.recruiterNotes || '');
    setEditNextAction(item.nextAction || '');
    setEditPriority(item.priority || 'medium');
    setEditTags(item.tags || []);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditingId) return;
    onUpdateDetails(activeEditingId, {
      recruiterNotes: editNotes,
      nextAction: editNextAction,
      priority: editPriority,
      tags: editTags,
    });
    setActiveEditingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header and Controls */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
              Candidate Hiring Pipeline
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Track active candidates through Sourced, Screening, Interview, Offer, and Hired milestones.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                background: '#F1F5F9',
                padding: '0.2rem',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className="btn-ghost"
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  background: viewMode === 'board' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'board' ? '#0F172A' : '#64748B',
                  fontWeight: viewMode === 'board' ? 600 : 400,
                  boxShadow: viewMode === 'board' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <LayoutGrid size={14} /> Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="btn-ghost"
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  background: viewMode === 'list' ? '#FFFFFF' : 'transparent',
                  color: viewMode === 'list' ? '#0F172A' : '#64748B',
                  fontWeight: viewMode === 'list' ? 600 : 400,
                  boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <List size={14} /> Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Reminder Banner */}
      <div
        style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          fontSize: '0.75rem',
          color: '#92400E',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <AlertCircle size={15} style={{ flexShrink: 0 }} />
        <span>
          <strong>Hiring Decision Notice:</strong> Transitioning a candidate to "Hired" or extending
          an offer is a local hiring milestone only. It does NOT automatically issue, promote, or alter
          verified Skill Passport credentials.
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '0.875rem 1rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search candidates in pipeline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem', fontSize: '0.84rem' }}
          />
        </div>

        <select
          className="form-input"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ minWidth: '160px', fontSize: '0.84rem' }}
        >
          <option value="all">All Target Roles</option>
          {availableRoles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value as any)}
          style={{ minWidth: '150px', fontSize: '0.84rem' }}
        >
          <option value="all">All Stages</option>
          {stages.map((st) => (
            <option key={st} value={st}>
              {STAGE_LABELS[st]}
            </option>
          ))}
        </select>
      </div>

      {/* Empty State */}
      {filteredPipeline.length === 0 ? (
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
            <Layers size={22} />
          </div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: '#0F172A' }}>
            No candidates in this pipeline view
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#64748B' }}>
            Add candidates from the Talent Search tab to begin tracking their hiring stages.
          </p>
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="pipeline-board-container">
          {stages.map((stage) => {
            const inStage = filteredPipeline.filter((p) => p.stage === stage);
            return (
              <div key={stage} className="pipeline-stage-column">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '2px solid #E2E8F0',
                  }}
                >
                  <strong style={{ fontSize: '0.84rem', color: '#0F172A' }}>
                    {STAGE_LABELS[stage]}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      background: inStage.length > 0 ? '#DCFCE7' : '#F1F5F9',
                      color: inStage.length > 0 ? '#15803D' : '#64748B',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '9999px',
                      fontWeight: 700,
                    }}
                  >
                    {inStage.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {inStage.length === 0 ? (
                    <div style={{ padding: '2rem 0.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                      No candidates in {STAGE_LABELS[stage].toLowerCase()}
                    </div>
                  ) : (
                    inStage.map((cand) => {
                      const matchedProfile = candidates.find((c) => c.id === cand.candidateId);
                      return (
                        <div key={cand.id} className="pipeline-candidate-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                            <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>
                              {cand.candidateName}
                            </strong>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                                background:
                                  cand.priority === 'high' ? '#FEE2E2' : cand.priority === 'medium' ? '#FEF3C7' : '#F1F5F9',
                                color:
                                  cand.priority === 'high' ? '#B91C1C' : cand.priority === 'medium' ? '#B45309' : '#475569',
                              }}
                            >
                              {cand.priority}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500, marginBottom: '0.35rem' }}>
                            {cand.targetRole}
                          </div>

                          {cand.nextAction && (
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: '#1E40AF',
                                background: '#EFF6FF',
                                padding: '0.25rem 0.45rem',
                                borderRadius: '4px',
                                marginBottom: '0.5rem',
                                lineHeight: 1.3,
                              }}
                            >
                              <strong>Next:</strong> {cand.nextAction}
                            </div>
                          )}

                          {cand.recruiterNotes && (
                            <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', color: '#64748B', lineHeight: 1.35, fontStyle: 'italic' }}>
                              "{cand.recruiterNotes}"
                            </p>
                          )}

                          {/* Stage Transition Selector */}
                          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <select
                              value={cand.stage}
                              onChange={(e) => onUpdateStage(cand.id, e.target.value as PipelineStage)}
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                color: '#0F172A',
                                cursor: 'pointer',
                              }}
                            >
                              {stages.map((st) => (
                                <option key={st} value={st}>
                                  Move to: {STAGE_LABELS[st]}
                                </option>
                              ))}
                            </select>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {matchedProfile && (
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={() => setCandidateToInspect(matchedProfile)}
                                  title="View Skill Passport"
                                  style={{ padding: '0.25rem', color: '#2563EB' }}
                                >
                                  <Eye size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => startEditing(cand)}
                                title="Edit Recruiter Notes & Action"
                                style={{ padding: '0.25rem', color: '#64748B' }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setCandidateToDelete(cand)}
                                title="Remove / Archive"
                                style={{ padding: '0.25rem', color: '#DC2626' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE / LIST VIEW */
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Candidate</th>
                <th style={{ padding: '0.75rem 1rem' }}>Target Role</th>
                <th style={{ padding: '0.75rem 1rem' }}>Stage</th>
                <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                <th style={{ padding: '0.75rem 1rem' }}>Next Action</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPipeline.map((item) => {
                const matchedProfile = candidates.find((c) => c.id === item.candidateId);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <strong style={{ color: '#0F172A' }}>{item.candidateName}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Added: {item.dateAdded}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>
                      {item.targetRole}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <select
                        value={item.stage}
                        onChange={(e) => onUpdateStage(item.id, e.target.value as PipelineStage)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        {stages.map((st) => (
                          <option key={st} value={st}>
                            {STAGE_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          background:
                            item.priority === 'high' ? '#FEE2E2' : item.priority === 'medium' ? '#FEF3C7' : '#F1F5F9',
                          color:
                            item.priority === 'high' ? '#B91C1C' : item.priority === 'medium' ? '#B45309' : '#475569',
                        }}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569', maxWidth: '240px' }}>
                      {item.nextAction || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {matchedProfile && (
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setCandidateToInspect(matchedProfile)}
                            title="View Skill Passport"
                            style={{ padding: '0.3rem', color: '#2563EB' }}
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => startEditing(item)}
                          title="Edit"
                          style={{ padding: '0.3rem', color: '#64748B' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setCandidateToDelete(item)}
                          title="Remove"
                          style={{ padding: '0.3rem', color: '#DC2626' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Notes & Next Action Modal */}
      {activeEditingId && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pipeline-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <h3 id="edit-pipeline-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Update Candidate Notes &amp; Next Action
            </h3>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Next Action Item</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Schedule System Design round on Oct 24"
                  value={editNextAction}
                  onChange={(e) => setEditNextAction(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-input"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as PipelinePriority)}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Recruiter Evaluation Notes</label>
                <textarea
                  rows={4}
                  className="form-input"
                  placeholder="Add private observations regarding skills, communication, or notice period..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveEditingId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {candidateToDelete && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-pipeline-title"
        >
          <div className="modal-dialog" style={{ maxWidth: '420px' }}>
            <h3 id="delete-pipeline-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Remove from Active Pipeline?
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{candidateToDelete.candidateName}</strong> from the
              hiring pipeline for <strong>{candidateToDelete.targetRole}</strong>? Their Skill Passport profile
              remains accessible in Talent Search.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCandidateToDelete(null)}
              >
                Keep in Pipeline
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onRemoveFromPipeline(candidateToDelete.id);
                  setCandidateToDelete(null);
                }}
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skill Passport Inspection Drawer */}
      {candidateToInspect && (
        <CandidateDetailModal
          candidate={candidateToInspect}
          isOpen={Boolean(candidateToInspect)}
          isInPipeline={true}
          pipelineEntry={pipeline.find((p) => p.candidateId === candidateToInspect.id)}
          onClose={() => setCandidateToInspect(null)}
          onToggleSave={onToggleSaveCandidate}
          onAddToPipeline={onAddToPipeline}
          availableRoles={availableRoles}
        />
      )}
    </div>
  );
};
