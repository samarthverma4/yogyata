import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Award,
  ExternalLink,
  MapPin,
  Briefcase,
  Bookmark,
  BookmarkCheck,
  Plus,
  FileText,
} from 'lucide-react';
import type { CandidateProfile, PipelineStage, PipelineCandidate } from './types';

interface CandidateDetailModalProps {
  candidate: CandidateProfile;
  isOpen: boolean;
  isInPipeline: boolean;
  pipelineEntry?: PipelineCandidate;
  onClose: () => void;
  onToggleSave: (candidateId: string) => void;
  onAddToPipeline: (candidateId: string, role: string, stage: PipelineStage) => void;
  availableRoles: string[];
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({
  candidate,
  isOpen,
  isInPipeline,
  pipelineEntry,
  onClose,
  onToggleSave,
  onAddToPipeline,
  availableRoles,
}) => {
  const [selectedRole, setSelectedRole] = useState(
    availableRoles[0] || 'Senior Technical Contributor'
  );
  const [selectedStage, setSelectedStage] = useState<PipelineStage>('screening');
  const [activeTab, setActiveTab] = useState<'evidence' | 'bio'>('evidence');

  if (!isOpen) return null;

  const verifiedEvidence = candidate.skillEvidence.filter((e) => e.tier === 'verified');
  const assessedEvidence = candidate.skillEvidence.filter((e) => e.tier === 'assessed');

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="candidate-modal-title"
      style={{ zIndex: 1050 }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: '780px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '12px',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8FAFC',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1E293B 0%, #2563EB 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.125rem',
                flexShrink: 0,
              }}
            >
              {candidate.avatarInitials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3
                  id="candidate-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    color: '#0F172A',
                    fontWeight: 700,
                  }}
                >
                  {candidate.name}
                </h3>
                {verifiedEvidence.length > 0 && (
                  <span className="tier-badge-verified">
                    <ShieldCheck size={12} />
                    Verified Skill Passport
                  </span>
                )}
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.875rem', color: '#475569' }}>
                {candidate.headline}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '0.75rem',
                  color: '#64748B',
                  marginTop: '0.35rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <MapPin size={12} /> {candidate.location}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Briefcase size={12} /> {candidate.experienceRange}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onToggleSave(candidate.id)}
              title={candidate.isSaved ? 'Remove from bookmarks' : 'Bookmark candidate'}
              style={{ padding: '0.4rem', color: candidate.isSaved ? '#2563EB' : '#64748B' }}
            >
              {candidate.isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              aria-label="Close modal"
              style={{ padding: '0.4rem', color: '#64748B' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Policy Invariant Banner */}
        <div
          style={{
            background: '#F0FDF4',
            borderBottom: '1px solid #DCFCE7',
            padding: '0.625rem 1.5rem',
            fontSize: '0.75rem',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShieldCheck size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
          <span>
            <strong>Skill Passport Governance:</strong> Evidence records reflect objective
            project validations and test harness benchmarks. Recruiter actions, pipeline stage
            moves, and hiring decisions <em>never</em> alter or promote a candidate's verified tier.
          </span>
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 1.5rem',
            background: '#FFFFFF',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'evidence' ? '2px solid #2563EB' : '2px solid transparent',
              color: activeTab === 'evidence' ? '#2563EB' : '#64748B',
              fontWeight: activeTab === 'evidence' ? 600 : 500,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <Award size={15} />
            Skill Passport Evidence ({candidate.skillEvidence.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bio')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'bio' ? '2px solid #2563EB' : '2px solid transparent',
              color: activeTab === 'bio' ? '#2563EB' : '#64748B',
              fontWeight: activeTab === 'bio' ? 600 : 500,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            <FileText size={15} />
            Background &amp; Preferences
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'evidence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* 1. Verified Evidence Section */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span className="tier-badge-verified">Verified Evidence</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Independently tested, benchmarked, or peer-reviewed challenge submissions
                  </span>
                </div>

                {verifiedEvidence.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: '#94A3B8', fontStyle: 'italic' }}>
                    No verified credentials recorded yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {verifiedEvidence.map((ev, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#FAFAFA',
                          border: '1px solid #E2E8F0',
                          borderLeft: '4px solid #10B981',
                          borderRadius: '0 8px 8px 0',
                          padding: '0.875rem 1rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>
                              {ev.skillName}
                            </span>
                            {ev.score && (
                              <span
                                style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.75rem',
                                  background: '#DCFCE7',
                                  color: '#15803D',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                }}
                              >
                                {ev.score}
                              </span>
                            )}
                          </div>
                          {ev.verifiedDate && (
                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              Verified: {ev.verifiedDate}
                            </span>
                          )}
                        </div>

                        <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.8125rem', color: '#334155', lineHeight: 1.45 }}>
                          {ev.description}
                        </p>

                        {ev.verifierNote && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: '#065F46',
                              background: '#ECFDF5',
                              padding: '0.35rem 0.6rem',
                              borderRadius: '4px',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <strong>Audit Note:</strong> {ev.verifierNote}
                          </div>
                        )}

                        {ev.sourceUrl && (
                          <a
                            href={ev.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.75rem',
                              color: '#2563EB',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontWeight: 500,
                            }}
                          >
                            <span>Inspect Verification Artifact</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Assessed Skills Section */}
              <div style={{ marginTop: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span className="tier-badge-assessed">Assessed Skills</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Standardized technical assessment tests and proctored problem sets
                  </span>
                </div>

                {assessedEvidence.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: '#94A3B8', fontStyle: 'italic' }}>
                    No assessment scores recorded.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {assessedEvidence.map((ev, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#FFFDF5',
                          border: '1px solid #FEF3C7',
                          borderLeft: '4px solid #F59E0B',
                          borderRadius: '0 6px 6px 0',
                          padding: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.84rem', color: '#78350F' }}>
                            {ev.skillName}
                          </strong>
                          {ev.score && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B45309' }}>
                              {ev.score}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#92400E', lineHeight: 1.4 }}>
                          {ev.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Declared Skills Section */}
              <div style={{ marginTop: '0.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span className="tier-badge-declared">Self-Declared Skills</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    Candidate self-reported claims (without verified test benchmarks)
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {candidate.declaredSkills.map((sk) => (
                    <span
                      key={sk}
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        background: '#F1F5F9',
                        border: '1px solid #E2E8F0',
                        fontSize: '0.75rem',
                        color: '#475569',
                      }}
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.84rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#0F172A', fontWeight: 600 }}>
                  Candidate Biography
                </h4>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.55 }}>
                  {candidate.bio}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', color: '#0F172A', fontWeight: 600 }}>
                    Career &amp; Domain Interests
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.5 }}>
                    {candidate.careerInterests.map((interest, i) => (
                      <li key={i}>{interest}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', color: '#0F172A', fontWeight: 600 }}>
                    Employment Preferences
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.5 }}>
                    {candidate.employmentPreferences.map((pref, i) => (
                      <li key={i}>{pref}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Pipeline Action Area */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {isInPipeline ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#166534' }}>
              <CheckCircle2 size={16} />
              <span>
                In Pipeline for <strong>{pipelineEntry?.targetRole}</strong> (Stage: <strong>{pipelineEntry?.stage}</strong>)
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
                Add to Pipeline:
              </span>
              <select
                className="form-input"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', minWidth: '180px' }}
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value as PipelineStage)}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', minWidth: '120px' }}
              >
                <option value="sourced">Sourced</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
              </select>

              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onAddToPipeline(candidate.id, selectedRole, selectedStage);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.8125rem',
                  background: '#15803D',
                  borderColor: '#15803D',
                }}
              >
                <Plus size={14} /> Add Candidate
              </button>
            </div>
          )}

          <button type="button" className="btn-secondary" onClick={onClose} style={{ fontSize: '0.8125rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
