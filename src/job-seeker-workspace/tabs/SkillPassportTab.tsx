import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Plus,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Edit2,
  X,
  Search,
} from 'lucide-react';
import type { JobSeekerSkill, SkillTier } from '../types';

interface SkillPassportTabProps {
  skills: JobSeekerSkill[];
  onAddDeclaredSkill: (skill: Omit<JobSeekerSkill, 'id' | 'tier' | 'dateAdded'>) => void;
  onUpdateDeclaredSkill: (id: string, updated: Partial<JobSeekerSkill>) => void;
  onDeleteDeclaredSkill: (id: string) => void;
}

export const SkillPassportTab: React.FC<SkillPassportTabProps> = ({
  skills,
  onAddDeclaredSkill,
  onUpdateDeclaredSkill,
  onDeleteDeclaredSkill,
}) => {
  const [selectedTier, setSelectedTier] = useState<SkillTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [inspectSkill, setInspectSkill] = useState<JobSeekerSkill | null>(null);

  // New skill form state
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Frontend Development');
  const [newSkillDescription, setNewSkillDescription] = useState('');
  const [newSkillSource, setNewSkillSource] = useState('');
  const [formError, setFormError] = useState('');

  // Edit skill state
  const [editingSkill, setEditingSkill] = useState<JobSeekerSkill | null>(null);
  const [editDescription, setEditDescription] = useState('');

  const filteredSkills = skills.filter((s) => {
    const matchesTier = selectedTier === 'all' || s.tier === selectedTier;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  const verifiedSkills = skills.filter((s) => s.tier === 'verified');
  const assessedSkills = skills.filter((s) => s.tier === 'assessed');
  const declaredSkills = skills.filter((s) => s.tier === 'declared');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) {
      setFormError('Skill name is required');
      return;
    }

    // CRITICAL: candidate can ONLY add self-declared skills
    onAddDeclaredSkill({
      name: newSkillName.trim(),
      category: newSkillCategory,
      description: newSkillDescription.trim() || 'Self-declared candidate technical skill.',
      source: newSkillSource.trim() || 'Self-Declared by Candidate',
    });

    setNewSkillName('');
    setNewSkillDescription('');
    setNewSkillSource('');
    setFormError('');
    setShowAddModal(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;

    onUpdateDeclaredSkill(editingSkill.id, {
      description: editDescription.trim(),
    });
    setEditingSkill(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>
            Verified Skill Passport
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Structured 3-tier credentials: from candidate-declared claims to audited verified evidence.
          </p>
        </div>

        <button
          type="button"
          className="jsw-btn jsw-btn-primary"
          onClick={() => setShowAddModal(true)}
          id="btn-add-declared-skill"
        >
          <Plus size={16} />
          <span>Add Declared Skill</span>
        </button>
      </div>

      {/* ── Evidence Guarantee Disclaimer Notice ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.875rem',
          padding: '1rem 1.25rem',
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '10px',
          color: '#166534',
          fontSize: '0.8125rem',
          lineHeight: 1.5,
        }}
      >
        <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#15803D' }} />
        <div>
          <strong>Evidence Standard Notice:</strong> Skills are only promoted to{' '}
          <span className="tier-pill tier-pill-verified" style={{ padding: '0.1rem 0.4rem' }}>Verified</span> through accepted solutions to verified engineering briefs with automated test suites and architectural peer review. Self-declared skills, resume uploads, and interview evaluations cannot grant verified credentials.
        </div>
      </div>

      {/* ── 3-Tier Summary Ribbon ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <button
          type="button"
          onClick={() => setSelectedTier(selectedTier === 'verified' ? 'all' : 'verified')}
          style={{
            background: selectedTier === 'verified' ? '#ECFDF5' : '#FFFFFF',
            border: `1.5px solid ${selectedTier === 'verified' ? '#059669' : '#E2E8F0'}`,
            borderRadius: '10px',
            padding: '1.15rem',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span className="tier-pill tier-pill-verified">Tier 3: Verified</span>
            <strong style={{ fontSize: '1.25rem', color: '#047857' }}>{verifiedSkills.length}</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
            Audited practical projects and code test harnesses with proof.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTier(selectedTier === 'assessed' ? 'all' : 'assessed')}
          style={{
            background: selectedTier === 'assessed' ? '#EEF2FF' : '#FFFFFF',
            border: `1.5px solid ${selectedTier === 'assessed' ? '#4F46E5' : '#E2E8F0'}`,
            borderRadius: '10px',
            padding: '1.15rem',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span className="tier-pill tier-pill-assessed">Tier 2: Assessed</span>
            <strong style={{ fontSize: '1.25rem', color: '#4338CA' }}>{assessedSkills.length}</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
            Standardized diagnostic tests with percentile benchmark scores.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTier(selectedTier === 'declared' ? 'all' : 'declared')}
          style={{
            background: selectedTier === 'declared' ? '#F1F5F9' : '#FFFFFF',
            border: `1.5px solid ${selectedTier === 'declared' ? '#64748B' : '#E2E8F0'}`,
            borderRadius: '10px',
            padding: '1.15rem',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span className="tier-pill tier-pill-declared">Tier 1: Declared</span>
            <strong style={{ fontSize: '1.25rem', color: '#334155' }}>{declaredSkills.length}</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
            Self-reported candidate proficiency awaiting benchmark assessments.
          </p>
        </button>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search skills by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'verified', 'assessed', 'declared'] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              className={`jsw-btn jsw-btn-sm ${selectedTier === tier ? 'jsw-btn-primary' : 'jsw-btn-secondary'}`}
              onClick={() => setSelectedTier(tier)}
            >
              {tier === 'all' ? 'All Tiers' : tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Skills Grid ── */}
      {filteredSkills.length === 0 ? (
        <div className="jsw-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748B' }}>
          <Award size={36} style={{ margin: '0 auto 0.75rem', color: '#CBD5E1' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: '#0F172A' }}>No skills match your criteria</h3>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>Try clearing your search query or add a new self-declared skill.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="jsw-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `4px solid ${
                  skill.tier === 'verified' ? '#059669' : skill.tier === 'assessed' ? '#4F46E5' : '#94A3B8'
                }`,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.2rem', color: '#0F172A' }}>
                      {skill.name}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{skill.category}</span>
                  </div>
                  <span className={`tier-pill tier-pill-${skill.tier}`}>{skill.tier}</span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.5, margin: '0 0 1rem' }}>
                  {skill.description}
                </p>

                {skill.scoreOrOutcome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#4338CA', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <CheckCircle2 size={14} />
                    <span>Outcome: {skill.scoreOrOutcome}</span>
                  </div>
                )}

                {skill.verifierNote && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '0.6rem', fontSize: '0.75rem', color: '#166534', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    <strong>Verifier Audit:</strong> {skill.verifierNote}
                  </div>
                )}

                {skill.evidenceUrl && (
                  <a
                    href={skill.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}
                  >
                    <span>View Accepted Code Suite</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #E2E8F0', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  Added: {skill.dateAdded}
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                    onClick={() => setInspectSkill(skill)}
                  >
                    Details
                  </button>

                  {skill.tier === 'declared' && (
                    <>
                      <button
                        type="button"
                        className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                        onClick={() => {
                          setEditingSkill(skill);
                          setEditDescription(skill.description);
                        }}
                        title="Edit Description"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                        style={{ color: '#DC2626' }}
                        onClick={() => onDeleteDeclaredSkill(skill.id)}
                        title="Remove Self-Declared Skill"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Self-Declared Skill Modal ── */}
      {showAddModal && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-add-skill-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 id="modal-add-skill-title" style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>
                Add Self-Declared Skill
              </h3>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Self-declared skills initialize as <strong>Tier 1: Declared</strong>. You can subsequently validate them via skill diagnostics or practical challenges to attain Assessed or Verified tiers.
            </p>

            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="new-skill-name">Skill Name *</label>
                <input
                  id="new-skill-name"
                  type="text"
                  className={`form-input ${formError ? 'has-error' : ''}`}
                  placeholder="e.g. Docker, GraphQL, System Design"
                  value={newSkillName}
                  onChange={(e) => {
                    setNewSkillName(e.target.value);
                    if (formError) setFormError('');
                  }}
                />
                {formError && <span className="form-error-msg">{formError}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-skill-cat">Category</label>
                <select
                  id="new-skill-cat"
                  className="form-select"
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value)}
                >
                  <option value="Frontend Development">Frontend Development</option>
                  <option value="Backend & APIs">Backend &amp; APIs</option>
                  <option value="Programming Languages">Programming Languages</option>
                  <option value="DevOps & Cloud">DevOps &amp; Cloud</option>
                  <option value="Databases & Storage">Databases &amp; Storage</option>
                  <option value="Software Architecture">Software Architecture</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-skill-desc">Proficiency &amp; Experience Summary</label>
                <textarea
                  id="new-skill-desc"
                  className="form-textarea"
                  rows={3}
                  placeholder="Describe your practical usage, personal projects, or coursework..."
                  value={newSkillDescription}
                  onChange={(e) => setNewSkillDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-skill-source">Source Reference (Optional)</label>
                <input
                  id="new-skill-source"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Portfolio project, Open-source contribution"
                  value={newSkillSource}
                  onChange={(e) => setNewSkillSource(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="jsw-btn jsw-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jsw-btn jsw-btn-primary"
                  id="btn-confirm-add-skill"
                >
                  Add to Skill Passport
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Description Modal ── */}
      {editingSkill && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#0F172A' }}>
              Edit Declared Skill: {editingSkill.name}
            </h3>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-skill-desc">Description</label>
                <textarea
                  id="edit-skill-desc"
                  className="form-textarea"
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="jsw-btn jsw-btn-secondary"
                  onClick={() => setEditingSkill(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jsw-btn jsw-btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inspect Skill Details Drawer/Modal ── */}
      {inspectSkill && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>
                  {inspectSkill.name}
                </h3>
                <span className={`tier-pill tier-pill-${inspectSkill.tier}`}>{inspectSkill.tier}</span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setInspectSkill(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Category</span>
                <strong style={{ color: '#0F172A' }}>{inspectSkill.category}</strong>
              </div>

              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Description</span>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>{inspectSkill.description}</p>
              </div>

              <div>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Evidence Source</span>
                <span style={{ color: '#0F172A' }}>{inspectSkill.source}</span>
              </div>

              {inspectSkill.scoreOrOutcome && (
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Score or Outcome</span>
                  <span style={{ color: '#4338CA', fontWeight: 600 }}>{inspectSkill.scoreOrOutcome}</span>
                </div>
              )}

              {inspectSkill.verifierNote && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '0.875rem', borderRadius: '8px' }}>
                  <span style={{ color: '#15803D', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Verifier Audit Log</span>
                  <p style={{ margin: 0, color: '#166534', fontSize: '0.8125rem' }}>{inspectSkill.verifierNote}</p>
                </div>
              )}

              {inspectSkill.evidenceUrl && (
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Public Proof Link</span>
                  <a
                    href={inspectSkill.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', fontWeight: 600 }}
                  >
                    <span>{inspectSkill.evidenceUrl}</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
              <button
                type="button"
                className="jsw-btn jsw-btn-secondary"
                onClick={() => setInspectSkill(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
