import React, { useState } from 'react';
import type {
  FounderWorkspaceState,
  WorkspaceTab,
} from '../types';
import { sanitizeUrl } from '../storage';
import type {
  StartupProfile,
  FounderProfile,
  BusinessGoal,
  TalentRequirement,
  StartupStage,
  TeamSize,
  FounderWorkMode,
  ExperiencePreference,
  RequirementWorkArrangement,
  EngagementType,
  CompensationType,
} from '../../founder-onboarding/types';

interface MyStartupTabProps {
  workspace: FounderWorkspaceState;
  onUpdateStartup: (
    startup: StartupProfile,
    founder: FounderProfile,
    goals: BusinessGoal,
    talentRequirements: TalentRequirement[]
  ) => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
}

const STAGE_OPTIONS: StartupStage[] = [
  'Idea Stage',
  'Pre-seed',
  'Seed',
  'Early-stage',
  'Growing Business',
  'Other',
];

const TEAM_SIZE_OPTIONS: TeamSize[] = [
  'Just me',
  '2–5',
  '6–10',
  '11–25',
  '26+',
];

export const MyStartupTab: React.FC<MyStartupTabProps> = ({
  workspace,
  onUpdateStartup,
  onNavigateTab,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local form state for editing
  const [startupForm, setStartupForm] = useState<StartupProfile>({
    ...workspace.startup,
  });
  const [founderForm, setFounderForm] = useState<FounderProfile>({
    ...workspace.founder,
  });
  const [goalsForm, setGoalsForm] = useState<BusinessGoal>({
    ...workspace.goals,
  });
  const [talentRequirementsForm, setTalentRequirementsForm] = useState<TalentRequirement[]>(
    JSON.parse(JSON.stringify(workspace.talentRequirements))
  );

  // New skill input helper for talent requirements
  const [newSkillInputs, setNewSkillInputs] = useState<Record<string, string>>({});

  const handleStartEdit = () => {
    setStartupForm({ ...workspace.startup });
    setFounderForm({ ...workspace.founder });
    setGoalsForm({ ...workspace.goals });
    setTalentRequirementsForm(JSON.parse(JSON.stringify(workspace.talentRequirements)));
    setErrors({});
    setSaveSuccess(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setStartupForm({ ...workspace.startup });
    setFounderForm({ ...workspace.founder });
    setGoalsForm({ ...workspace.goals });
    setTalentRequirementsForm(JSON.parse(JSON.stringify(workspace.talentRequirements)));
    setErrors({});
    setIsEditing(false);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!startupForm.startupName.trim()) {
      errs.startupName = 'Startup / Venture name is required';
    }
    if (!startupForm.description.trim()) {
      errs.description = 'A short description of your startup is required';
    }
    if (!founderForm.fullName.trim()) {
      errs.fullName = 'Founder name is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onUpdateStartup(startupForm, founderForm, goalsForm, talentRequirementsForm);
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  // Talent requirement helpers
  const handleAddRequirement = () => {
    const newReq: TalentRequirement = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      roleTitle: 'Frontend Engineer',
      requiredSkills: ['React', 'TypeScript'],
      contributorsCount: '1',
      experiencePreference: 'intermediate',
      workArrangement: 'remote',
      engagementType: 'project-based',
      compensation: 'paid',
    };
    setTalentRequirementsForm((prev) => [...prev, newReq]);
  };

  const handleRemoveRequirement = (id: string) => {
    setTalentRequirementsForm((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRequirementField = (
    id: string,
    field: keyof TalentRequirement,
    value: string
  ) => {
    setTalentRequirementsForm((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleAddSkillToReq = (reqId: string) => {
    const skillName = (newSkillInputs[reqId] || '').trim();
    if (!skillName) return;

    setTalentRequirementsForm((prev) =>
      prev.map((r) => {
        if (r.id !== reqId) return r;
        if (r.requiredSkills.includes(skillName)) return r;
        return { ...r, requiredSkills: [...r.requiredSkills, skillName] };
      })
    );
    setNewSkillInputs((prev) => ({ ...prev, [reqId]: '' }));
  };

  const handleRemoveSkillFromReq = (reqId: string, skillName: string) => {
    setTalentRequirementsForm((prev) =>
      prev.map((r) => {
        if (r.id !== reqId) return r;
        return {
          ...r,
          requiredSkills: r.requiredSkills.filter((s) => s !== skillName),
        };
      })
    );
  };

  const startupInitial = (workspace.startup.startupName || 'V')[0]?.toUpperCase() || 'V';

  return (
    <div className="yw-content">
      {saveSuccess && (
        <div className="yw-alert yw-alert-success" role="status">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <strong>Startup profile updated successfully!</strong> Changes are reflected across
            all workspace projects, tasks, and discovery views.
          </div>
        </div>
      )}

      {/* Hero Card */}
      <div className="yw-card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--color-navy) 0%, #2D4373 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(27, 42, 78, 0.15)',
              }}
            >
              {startupInitial}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
                  {workspace.startup.startupName || 'Untitled Venture'}
                </h2>
                {workspace.startup.stage && (
                  <span className="yw-badge yw-badge-blue">{workspace.startup.stage}</span>
                )}
                <span className="yw-badge yw-badge-neutral">
                  Team: {workspace.startup.teamSize || '1–5 members'}
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {workspace.startup.industry || 'Technology / Software'} •{' '}
                {workspace.startup.city
                  ? `${workspace.startup.city}, ${workspace.startup.country}`
                  : 'Location not specified'}{' '}
                • Work Mode: {workspace.startup.workMode || 'Remote / Flexible'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!isEditing ? (
              <>
                {workspace.startup.websiteUrl && (
                  <a
                    href={sanitizeUrl(workspace.startup.websiteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="yw-btn yw-btn-secondary"
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    Visit Website
                  </a>
                )}
                <button
                  type="button"
                  className="yw-btn yw-btn-primary"
                  onClick={handleStartEdit}
                  id="btn-edit-startup"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit Profile
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="yw-btn yw-btn-secondary"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="yw-btn yw-btn-primary"
                  onClick={handleSave}
                  id="btn-save-startup"
                >
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!isEditing ? (
        /* ─── VIEW MODE ─── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {/* Startup Overview */}
          <div className="yw-card">
            <h3 className="yw-card-title">Venture Mission & Bio</h3>
            <p style={{ color: 'var(--color-navy)', lineHeight: 1.6, fontSize: '0.9375rem', marginTop: '0.5rem' }}>
              {workspace.startup.description ||
                'No startup description provided. Click "Edit Profile" to summarize your venture vision.'}
            </p>

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Operational Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Stage:</span>{' '}
                  <strong style={{ color: 'var(--color-navy)' }}>{workspace.startup.stage || 'Not set'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Team Size:</span>{' '}
                  <strong style={{ color: 'var(--color-navy)' }}>{workspace.startup.teamSize || '1–5'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Work Mode:</span>{' '}
                  <strong style={{ color: 'var(--color-navy)' }}>{workspace.startup.workMode || 'Remote'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Industry:</span>{' '}
                  <strong style={{ color: 'var(--color-navy)' }}>{workspace.startup.industry || 'Technology'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Founder Leadership */}
          <div className="yw-card">
            <h3 className="yw-card-title">Founder Leadership</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--color-border)',
                  color: 'var(--color-navy)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.125rem',
                }}
              >
                {(workspace.founder.fullName || 'F')[0]?.toUpperCase()}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-navy)', fontWeight: 600 }}>
                  {workspace.founder.fullName || 'Anonymous Founder'}
                </h4>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {workspace.founder.professionalTitle || 'Co-founder / Managing Partner'}
                </p>
                <p style={{ margin: 0, color: 'var(--color-text-faint)', fontSize: '0.8125rem' }}>
                  {workspace.accountEmail}
                </p>
              </div>
            </div>

            {workspace.founder.bio && (
              <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                {workspace.founder.bio}
              </p>
            )}

            {workspace.founder.linkedInUrl && (
              <div style={{ marginTop: '0.75rem' }}>
                <a
                  href={sanitizeUrl(workspace.founder.linkedInUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#D97706', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none' }}
                >
                  LinkedIn Profile →
                </a>
              </div>
            )}
          </div>

          {/* Business Milestones & Goals */}
          <div className="yw-card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="yw-card-title">Business Milestones & Primary Objective</h3>
              <button
                type="button"
                className="yw-btn yw-btn-secondary yw-btn-sm"
                onClick={() => onNavigateTab('projects')}
              >
                View Linked Projects →
              </button>
            </div>

            <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span className="yw-badge yw-badge-amber">Primary Objective</span>
                <strong style={{ color: 'var(--color-navy)', fontSize: '1rem' }}>
                  {workspace.goals.primaryGoal || 'MVP Development & Market Validation'}
                </strong>
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.5, margin: '0.25rem 0' }}>
                {workspace.goals.projectDescription ||
                  'Delivering core features and gathering pilot validation from prospective customers.'}
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                <span>
                  <strong>Category:</strong> {workspace.goals.projectCategory || 'Software / Web'}
                </span>
                {workspace.goals.projectLink && (
                  <span>
                    <strong>Specification:</strong>{' '}
                    <a
                      href={sanitizeUrl(workspace.goals.projectLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#D97706' }}
                    >
                      {workspace.goals.projectLink}
                    </a>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Open Talent Requirements */}
          <div className="yw-card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 className="yw-card-title">Talent & Skill Requirements</h3>
                <p className="yw-card-subtitle">
                  Key roles and capabilities your venture is actively seeking to recruit.
                </p>
              </div>
              <button
                type="button"
                className="yw-btn yw-btn-secondary yw-btn-sm"
                onClick={() => onNavigateTab('talent')}
              >
                Discover Matching Talent →
              </button>
            </div>

            {workspace.talentRequirements.length === 0 ? (
              <div className="yw-empty-state" style={{ padding: '2rem 1rem' }}>
                <p className="yw-empty-state-title">No talent requirements defined</p>
                <p className="yw-empty-state-desc">
                  Define the technical or domain roles you need to help build your startup.
                </p>
                <button
                  type="button"
                  className="yw-btn yw-btn-primary yw-btn-sm"
                  onClick={handleStartEdit}
                >
                  + Add Talent Requirements
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {workspace.talentRequirements.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-navy)', fontWeight: 600 }}>
                        {req.roleTitle}
                      </h4>
                      <span className="yw-badge yw-badge-blue">
                        {req.contributorsCount} {Number(req.contributorsCount) === 1 ? 'person' : 'people'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', margin: '0.75rem 0' }}>
                      {req.requiredSkills.map((sk) => (
                        <span key={sk} className="yw-skill-pill yw-skill-assessed">
                          {sk}
                        </span>
                      ))}
                    </div>

                    <div style={{ borderTop: '1px solid var(--color-surface-2)', paddingTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                      <div>
                        <span>Type:</span>{' '}
                        <strong style={{ color: 'var(--color-navy)' }}>{req.engagementType}</strong>
                      </div>
                      <div>
                        <span>Mode:</span>{' '}
                        <strong style={{ color: 'var(--color-navy)' }}>{req.workArrangement}</strong>
                      </div>
                      <div>
                        <span>Compensation:</span>{' '}
                        <strong style={{ color: 'var(--color-navy)' }}>{req.compensation}</strong>
                      </div>
                      <div>
                        <span>Experience:</span>{' '}
                        <strong style={{ color: 'var(--color-navy)' }}>{req.experiencePreference}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── EDIT MODE ─── */
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1: Venture Profile */}
          <div className="yw-card">
            <h3 className="yw-card-title">Edit Startup Profile</h3>
            <p className="yw-card-subtitle">
              Update your organization identity, location, and operational parameters.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-startup-name">
                  Startup Name *
                </label>
                <input
                  id="edit-startup-name"
                  type="text"
                  className="yw-form-input"
                  value={startupForm.startupName}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, startupName: e.target.value })
                  }
                />
                {errors.startupName && <span className="yw-form-error">{errors.startupName}</span>}
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-industry">
                  Industry / Domain
                </label>
                <input
                  id="edit-industry"
                  type="text"
                  className="yw-form-input"
                  value={startupForm.industry}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, industry: e.target.value })
                  }
                  placeholder="e.g. EdTech, SaaS, FinTech, AI"
                />
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-website">
                  Website / URL
                </label>
                <input
                  id="edit-website"
                  type="url"
                  className="yw-form-input"
                  value={startupForm.websiteUrl || ''}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, websiteUrl: e.target.value })
                  }
                  placeholder="https://yourstartup.com"
                />
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-stage">
                  Venture Stage
                </label>
                <select
                  id="edit-stage"
                  className="yw-form-select"
                  value={startupForm.stage}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, stage: e.target.value as StartupStage })
                  }
                >
                  <option value="">Select stage...</option>
                  {STAGE_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-teamsize">
                  Team Size
                </label>
                <select
                  id="edit-teamsize"
                  className="yw-form-select"
                  value={startupForm.teamSize}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, teamSize: e.target.value as TeamSize })
                  }
                >
                  <option value="">Select team size...</option>
                  {TEAM_SIZE_OPTIONS.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-workmode">
                  Work Mode
                </label>
                <select
                  id="edit-workmode"
                  className="yw-form-select"
                  value={startupForm.workMode}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, workMode: e.target.value as FounderWorkMode })
                  }
                >
                  <option value="remote">Remote-first</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on-site">On-site</option>
                </select>
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-country">
                  Country
                </label>
                <input
                  id="edit-country"
                  type="text"
                  className="yw-form-input"
                  value={startupForm.country}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, country: e.target.value })
                  }
                  placeholder="e.g. India, United States"
                />
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-city">
                  City
                </label>
                <input
                  id="edit-city"
                  type="text"
                  className="yw-form-input"
                  value={startupForm.city}
                  onChange={(e) =>
                    setStartupForm({ ...startupForm, city: e.target.value })
                  }
                  placeholder="e.g. Bengaluru, New Delhi"
                />
              </div>
            </div>

            <div className="yw-form-group" style={{ marginTop: '1rem' }}>
              <label className="yw-form-label" htmlFor="edit-description">
                Startup Description *
              </label>
              <textarea
                id="edit-description"
                rows={4}
                className="yw-form-textarea"
                value={startupForm.description}
                onChange={(e) =>
                  setStartupForm({ ...startupForm, description: e.target.value })
                }
                placeholder="What problem are you solving and what is your core offering?"
              />
              {errors.description && <span className="yw-form-error">{errors.description}</span>}
            </div>
          </div>

          {/* Section 2: Founder Details */}
          <div className="yw-card">
            <h3 className="yw-card-title">Founder Details</h3>
            <p className="yw-card-subtitle">
              Your professional representation visible to prospective contributors.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-founder-name">
                  Full Name *
                </label>
                <input
                  id="edit-founder-name"
                  type="text"
                  className="yw-form-input"
                  value={founderForm.fullName}
                  onChange={(e) =>
                    setFounderForm({ ...founderForm, fullName: e.target.value })
                  }
                />
                {errors.fullName && <span className="yw-form-error">{errors.fullName}</span>}
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-founder-title">
                  Professional Title
                </label>
                <input
                  id="edit-founder-title"
                  type="text"
                  className="yw-form-input"
                  value={founderForm.professionalTitle}
                  onChange={(e) =>
                    setFounderForm({ ...founderForm, professionalTitle: e.target.value })
                  }
                  placeholder="e.g. Founder & CEO, Technical Co-founder"
                />
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-founder-linkedin">
                  LinkedIn Profile
                </label>
                <input
                  id="edit-founder-linkedin"
                  type="url"
                  className="yw-form-input"
                  value={founderForm.linkedInUrl || ''}
                  onChange={(e) =>
                    setFounderForm({ ...founderForm, linkedInUrl: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
            </div>

            <div className="yw-form-group" style={{ marginTop: '1rem' }}>
              <label className="yw-form-label" htmlFor="edit-founder-bio">
                Founder Bio / Background
              </label>
              <textarea
                id="edit-founder-bio"
                rows={3}
                className="yw-form-textarea"
                value={founderForm.bio || ''}
                onChange={(e) =>
                  setFounderForm({ ...founderForm, bio: e.target.value })
                }
                placeholder="Briefly describe your domain background, previous ventures, or technical focus."
              />
            </div>
          </div>

          {/* Section 3: Goals */}
          <div className="yw-card">
            <h3 className="yw-card-title">Business Goals & Project Specification</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-goal-title">
                  Primary Milestone Objective
                </label>
                <input
                  id="edit-goal-title"
                  type="text"
                  className="yw-form-input"
                  value={goalsForm.primaryGoal}
                  onChange={(e) =>
                    setGoalsForm({ ...goalsForm, primaryGoal: e.target.value })
                  }
                  placeholder="e.g. MVP Launch, Market Validation"
                />
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-goal-cat">
                  Project Category
                </label>
                <input
                  id="edit-goal-cat"
                  type="text"
                  className="yw-form-input"
                  value={goalsForm.projectCategory}
                  onChange={(e) =>
                    setGoalsForm({ ...goalsForm, projectCategory: e.target.value })
                  }
                  placeholder="e.g. Software, Mobile App, Design System"
                />
              </div>

              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor="edit-goal-link">
                  External Specification or Pitch Deck URL
                </label>
                <input
                  id="edit-goal-link"
                  type="url"
                  className="yw-form-input"
                  value={goalsForm.projectLink || ''}
                  onChange={(e) =>
                    setGoalsForm({ ...goalsForm, projectLink: e.target.value })
                  }
                  placeholder="https://docs.google.com/..."
                />
              </div>
            </div>

            <div className="yw-form-group" style={{ marginTop: '1rem' }}>
              <label className="yw-form-label" htmlFor="edit-goal-desc">
                Project Milestone Description
              </label>
              <textarea
                id="edit-goal-desc"
                rows={3}
                className="yw-form-textarea"
                value={goalsForm.projectDescription}
                onChange={(e) =>
                  setGoalsForm({ ...goalsForm, projectDescription: e.target.value })
                }
              />
            </div>
          </div>

          {/* Section 4: Talent Requirements Editor */}
          <div className="yw-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="yw-card-title">Talent Requirements</h3>
                <p className="yw-card-subtitle">
                  Configure specific roles, headcount, skills, and engagement models.
                </p>
              </div>
              <button
                type="button"
                className="yw-btn yw-btn-secondary yw-btn-sm"
                onClick={handleAddRequirement}
              >
                + Add Role Requirement
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {talentRequirementsForm.map((req, idx) => (
                <div
                  key={req.id}
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <strong style={{ color: 'var(--color-navy)' }}>Role #{idx + 1}</strong>
                    <button
                      type="button"
                      className="yw-btn yw-btn-danger yw-btn-sm"
                      onClick={() => handleRemoveRequirement(req.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div className="yw-form-group">
                      <label className="yw-form-label">Role Title</label>
                      <input
                        type="text"
                        className="yw-form-input"
                        value={req.roleTitle}
                        onChange={(e) =>
                          handleUpdateRequirementField(req.id, 'roleTitle', e.target.value)
                        }
                      />
                    </div>

                    <div className="yw-form-group">
                      <label className="yw-form-label">Open Headcount</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        className="yw-form-input"
                        value={req.contributorsCount}
                        onChange={(e) =>
                          handleUpdateRequirementField(req.id, 'contributorsCount', e.target.value)
                        }
                      />
                    </div>

                    <div className="yw-form-group">
                      <label className="yw-form-label">Engagement Type</label>
                      <select
                        className="yw-form-select"
                        value={req.engagementType}
                        onChange={(e) =>
                          handleUpdateRequirementField(
                            req.id,
                            'engagementType',
                            e.target.value as EngagementType
                          )
                        }
                      >
                        <option value="project-based">Project-based</option>
                        <option value="part-time">Part-time</option>
                        <option value="full-time">Full-time</option>
                        <option value="freelance">Freelance</option>
                        <option value="co-founder">Co-founder</option>
                      </select>
                    </div>

                    <div className="yw-form-group">
                      <label className="yw-form-label">Work Arrangement</label>
                      <select
                        className="yw-form-select"
                        value={req.workArrangement}
                        onChange={(e) =>
                          handleUpdateRequirementField(
                            req.id,
                            'workArrangement',
                            e.target.value as RequirementWorkArrangement
                          )
                        }
                      >
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="on-site">On-site</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>

                    <div className="yw-form-group">
                      <label className="yw-form-label">Compensation</label>
                      <select
                        className="yw-form-select"
                        value={req.compensation}
                        onChange={(e) =>
                          handleUpdateRequirementField(
                            req.id,
                            'compensation',
                            e.target.value as CompensationType
                          )
                        }
                      >
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid / Learning</option>
                        <option value="to-be-discussed">To be discussed</option>
                      </select>
                    </div>

                    <div className="yw-form-group">
                      <label className="yw-form-label">Experience</label>
                      <select
                        className="yw-form-select"
                        value={req.experiencePreference}
                        onChange={(e) =>
                          handleUpdateRequirementField(
                            req.id,
                            'experiencePreference',
                            e.target.value as ExperiencePreference
                          )
                        }
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="experienced">Experienced</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>
                  </div>

                  {/* Skills tags */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <label className="yw-form-label">Required Skills</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      {req.requiredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="yw-skill-pill yw-skill-assessed"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          {sk}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkillFromReq(req.id, sk)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#1E40AF',
                              cursor: 'pointer',
                              padding: '0 2px',
                              fontWeight: 700,
                            }}
                            title="Remove skill"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '360px' }}>
                      <input
                        type="text"
                        className="yw-form-input"
                        placeholder="Add skill (e.g. Next.js)..."
                        value={newSkillInputs[req.id] || ''}
                        onChange={(e) =>
                          setNewSkillInputs({ ...newSkillInputs, [req.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSkillToReq(req.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="yw-btn yw-btn-secondary yw-btn-sm"
                        onClick={() => handleAddSkillToReq(req.id)}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1rem',
              background: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              className="yw-btn yw-btn-secondary"
              onClick={handleCancelEdit}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="yw-btn yw-btn-primary"
              id="btn-save-startup-footer"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
