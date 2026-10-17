import React, { useState, useMemo } from 'react';
import type {
  CandidateProfile,
  SkillEvidenceLevel,
  WorkspaceTask,
} from '../types';
import { DEMO_CANDIDATES } from '../storage';

interface TalentDiscoveryTabProps {
  tasks: WorkspaceTask[];
}

export const TalentDiscoveryTab: React.FC<TalentDiscoveryTabProps> = ({ tasks }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExperience, setSelectedExperience] = useState<string>('all');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all');
  const [selectedSkillTag, setSelectedSkillTag] = useState<string>('all');

  // Selected candidate for modal detail inspection
  const [inspectedCandidate, setInspectedCandidate] = useState<CandidateProfile | null>(null);

  // Simulated invitation states
  const [invitingCandidate, setInvitingCandidate] = useState<CandidateProfile | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || '');
  const [inviteMessage, setInviteMessage] = useState('');
  const [simulatedInvites, setSimulatedInvites] = useState<Record<string, string>>({}); // candidateId -> taskId
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  // Extract distinct skill tags from demo candidates
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    DEMO_CANDIDATES.forEach((c) => {
      c.skills.forEach((s) => set.add(s.skillName));
    });
    return Array.from(set).sort();
  }, []);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return DEMO_CANDIDATES.filter((cand) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cand.fullName.toLowerCase().includes(q) ||
        cand.headline.toLowerCase().includes(q) ||
        cand.location.toLowerCase().includes(q) ||
        cand.skills.some((s) => s.skillName.toLowerCase().includes(q));

      const matchesExp =
        selectedExperience === 'all' || cand.experienceLevel === selectedExperience;

      const matchesAvail =
        selectedAvailability === 'all' || cand.availability === selectedAvailability;

      const matchesSkill =
        selectedSkillTag === 'all' ||
        cand.skills.some((s) => s.skillName === selectedSkillTag);

      return matchesSearch && matchesExp && matchesAvail && matchesSkill;
    });
  }, [searchQuery, selectedExperience, selectedAvailability, selectedSkillTag]);

  const handleOpenInviteModal = (candidate: CandidateProfile) => {
    setInvitingCandidate(candidate);
    setSelectedTaskId(tasks[0]?.id || '');
    setInviteMessage(`Hi ${candidate.fullName}, your Skill Passport profile caught our attention for our upcoming project challenge.`);
  };

  const handleSendSimulatedInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitingCandidate) return;

    setSimulatedInvites((prev) => ({
      ...prev,
      [invitingCandidate.id]: selectedTaskId,
    }));

    const candName = invitingCandidate.fullName;
    setInvitingCandidate(null);
    setInviteFeedback(
      `Simulated invitation sent to demo profile "${candName}". Note: As this is a prototype, no real candidate communication occurred.`
    );
    setTimeout(() => setInviteFeedback(null), 5000);
  };

  const renderEvidencePill = (level: SkillEvidenceLevel, skillName: string) => {
    switch (level) {
      case 'verified':
        return (
          <span key={skillName} className="yw-skill-pill yw-skill-verified" title="Verified by evaluated work">
            ✓ {skillName} (Verified)
          </span>
        );
      case 'assessed':
        return (
          <span key={skillName} className="yw-skill-pill yw-skill-assessed" title="Evaluated via benchmark assessment">
            ⚡ {skillName} (Assessed)
          </span>
        );
      case 'declared':
        return (
          <span key={skillName} className="yw-skill-pill yw-skill-declared" title="Self-declared on resume">
            {skillName} (Declared)
          </span>
        );
    }
  };

  return (
    <div className="yw-content">
      {/* Prototype Demo Banner */}
      <div className="yw-alert yw-alert-info" style={{ marginBottom: '1.25rem' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <strong>PROTOTYPE DEMO CANDIDATES:</strong> The profiles below are mock records provided
          for testing YOGYATA's Skill Passport evidence model. Real platform matching, automated
          ranking, and external notifications will be powered by backend services in a future phase.
        </div>
      </div>

      {inviteFeedback && (
        <div className="yw-alert yw-alert-success" role="status" style={{ marginBottom: '1.25rem' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>{inviteFeedback}</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="yw-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
              <input
                type="text"
                className="yw-form-input"
                placeholder="Search candidate name, skills, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                id="input-search-candidates"
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="#94A3B8"
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Experience dropdown */}
              <select
                className="yw-form-select"
                value={selectedExperience}
                onChange={(e) => setSelectedExperience(e.target.value)}
                style={{ width: '150px' }}
              >
                <option value="all">All Experience</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Experienced">Experienced</option>
              </select>

              {/* Availability dropdown */}
              <select
                className="yw-form-select"
                value={selectedAvailability}
                onChange={(e) => setSelectedAvailability(e.target.value)}
                style={{ width: '150px' }}
              >
                <option value="all">All Availability</option>
                <option value="Immediately">Immediately</option>
                <option value="Within 2 weeks">Within 2 weeks</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>
          </div>

          {/* Quick Skill Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 600 }}>
              Filter by Skill:
            </span>
            <button
              type="button"
              className={`yw-btn yw-btn-sm ${selectedSkillTag === 'all' ? 'yw-btn-primary' : 'yw-btn-secondary'}`}
              onClick={() => setSelectedSkillTag('all')}
            >
              All Skills
            </button>
            {allSkills.slice(0, 8).map((sk) => (
              <button
                key={sk}
                type="button"
                className={`yw-btn yw-btn-sm ${selectedSkillTag === sk ? 'yw-btn-primary' : 'yw-btn-secondary'}`}
                onClick={() => setSelectedSkillTag(sk)}
              >
                {sk}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Candidate List */}
      {filteredCandidates.length === 0 ? (
        <div className="yw-card">
          <div className="yw-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="yw-empty-state-title">No candidate profiles match your criteria</p>
            <p className="yw-empty-state-desc">
              Try resetting your search query or selecting "All Skills" to view the full demo set.
            </p>
            <button
              type="button"
              className="yw-btn yw-btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setSelectedExperience('all');
                setSelectedAvailability('all');
                setSelectedSkillTag('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredCandidates.map((cand) => {
            const hasInvited = !!simulatedInvites[cand.id];

            return (
              <div key={cand.id} className="yw-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.875rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: '#EEF2F6',
                        color: '#1B2A4E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.125rem',
                      }}
                    >
                      {cand.fullName[0]}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#1B2A4E', fontWeight: 600 }}>
                          {cand.fullName}
                        </h4>
                        <span className="yw-badge yw-badge-neutral" style={{ fontSize: '0.7rem' }}>
                          DEMO PROFILE
                        </span>
                      </div>
                      <p style={{ margin: '0.125rem 0 0 0', color: '#64748B', fontSize: '0.8125rem' }}>
                        {cand.headline}
                      </p>
                    </div>
                  </div>
                </div>

                <p style={{ margin: '0.75rem 0', color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, flex: 1 }}>
                  {cand.bio}
                </p>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: '#64748B', margin: '0.25rem 0 0.75rem 0' }}>
                  <span>📍 {cand.location}</span>
                  <span>⏱ {cand.availability}</span>
                  <span>🏢 {cand.preferredWorkMode}</span>
                </div>

                {/* Skill Passport Evidence Pills */}
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 600 }}>
                    Skill Passport Evidence:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
                    {cand.skills.map((s) => renderEvidencePill(s.level, s.skillName))}
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <button
                    type="button"
                    className="yw-btn yw-btn-secondary yw-btn-sm"
                    onClick={() => setInspectedCandidate(cand)}
                  >
                    Inspect Passport & Bio →
                  </button>

                  <button
                    type="button"
                    className={`yw-btn yw-btn-sm ${hasInvited ? 'yw-btn-secondary' : 'yw-btn-primary'}`}
                    onClick={() => handleOpenInviteModal(cand)}
                  >
                    {hasInvited ? '✓ Invited (Simulated)' : 'Simulate Task Invite'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CANDIDATE PROFILE & PASSPORT INSPECTION MODAL ─── */}
      {inspectedCandidate && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-candidate-title">
          <div className="yw-modal-box" style={{ maxWidth: '680px' }}>
            <div className="yw-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: '#1B2A4E',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {inspectedCandidate.fullName[0]}
                </div>
                <div>
                  <h3 id="modal-candidate-title" className="yw-modal-title">
                    {inspectedCandidate.fullName}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                    {inspectedCandidate.headline} • {inspectedCandidate.location}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setInspectedCandidate(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="yw-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.375rem 0', fontSize: '0.8125rem', textTransform: 'uppercase', color: '#64748B' }}>
                  Candidate Summary
                </h4>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                  {inspectedCandidate.bio}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#F8FAFC', padding: '0.875rem', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Experience Level</span>
                  <div style={{ fontWeight: 600, color: '#1B2A4E' }}>{inspectedCandidate.experienceLevel}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Availability</span>
                  <div style={{ fontWeight: 600, color: '#1B2A4E' }}>{inspectedCandidate.availability}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Completed Challenges</span>
                  <div style={{ fontWeight: 600, color: '#1B2A4E' }}>
                    {inspectedCandidate.completedChallengesCount} reviewed tasks
                  </div>
                </div>
              </div>

              {/* YOGYATA Skill Passport Breakdown */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', textTransform: 'uppercase', color: '#1B2A4E', fontWeight: 700 }}>
                    Official YOGYATA Skill Passport
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>3 Evidence Tiers</span>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="yw-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Skill</th>
                        <th>Evidence Level</th>
                        <th>Verification Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectedCandidate.skills.map((s) => (
                        <tr key={s.skillName}>
                          <td style={{ fontWeight: 600, color: '#1B2A4E' }}>{s.skillName}</td>
                          <td>
                            {s.level === 'verified' && (
                              <span className="yw-skill-pill yw-skill-verified">✓ Verified</span>
                            )}
                            {s.level === 'assessed' && (
                              <span className="yw-skill-pill yw-skill-assessed">⚡ Assessed</span>
                            )}
                            {s.level === 'declared' && (
                              <span className="yw-skill-pill yw-skill-declared">Declared</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                            {s.evidenceSource}
                            {s.verifiedAt && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                                Verified on {s.verifiedAt}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="yw-modal-footer">
              <button
                type="button"
                className="yw-btn yw-btn-secondary"
                onClick={() => setInspectedCandidate(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="yw-btn yw-btn-primary"
                onClick={() => {
                  const cand = inspectedCandidate;
                  setInspectedCandidate(null);
                  handleOpenInviteModal(cand);
                }}
              >
                Simulate Task Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SIMULATED INVITATION MODAL ─── */}
      {invitingCandidate && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-invite-title">
          <div className="yw-modal-box">
            <div className="yw-modal-header">
              <h3 id="modal-invite-title" className="yw-modal-title">
                Simulate Challenge Invite: {invitingCandidate.fullName}
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setInvitingCandidate(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendSimulatedInvite}>
              <div className="yw-modal-body">
                <div className="yw-alert yw-alert-info" style={{ marginBottom: '1rem' }}>
                  <strong>Simulated Interaction:</strong> This interaction tests the founder
                  invitation UX. No real emails or push notifications are dispatched to candidates.
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="select-invite-task">
                    Select Task Challenge *
                  </label>
                  <select
                    id="select-invite-task"
                    className="yw-form-select"
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                  >
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="invite-msg">
                    Invitation Note
                  </label>
                  <textarea
                    id="invite-msg"
                    rows={3}
                    className="yw-form-textarea"
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                  />
                </div>
              </div>

              <div className="yw-modal-footer">
                <button
                  type="button"
                  className="yw-btn yw-btn-secondary"
                  onClick={() => setInvitingCandidate(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="yw-btn yw-btn-primary">
                  Send Simulated Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
