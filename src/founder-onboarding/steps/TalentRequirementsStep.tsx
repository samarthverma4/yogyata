import React, { useState } from 'react';
import type {
  TalentRequirement,
  ExperiencePreference,
  RequirementWorkArrangement,
  EngagementType,
  CompensationType,
} from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  FormNav, SectionDivider, InfoNotice,
} from '../../onboarding/shared';
import { Plus, X, Trash2, Copy, Users, Check, AlertCircle } from 'lucide-react';

const COMMON_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'AI / ML Engineer',
  'Data Analyst / Scientist',
  'UI/UX Designer',
  'DevOps & Cloud Engineer',
  'Product Manager',
  'Marketing Specialist',
  'Mobile App Developer',
  'Co-Founder (Technical)',
  'Co-Founder (Business)',
  'Other',
];

const EXPERIENCE_OPTIONS: { value: ExperiencePreference; label: string }[] = [
  { value: 'flexible', label: 'Flexible / Open to all levels' },
  { value: 'beginner', label: 'Beginner / Early career (hungry to learn)' },
  { value: 'intermediate', label: 'Intermediate (1–3 years experience)' },
  { value: 'experienced', label: 'Experienced / Senior (3+ years experience)' },
];

const ARRANGEMENT_OPTIONS: { value: RequirementWorkArrangement; label: string }[] = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on-site', label: 'On-site' },
];

const ENGAGEMENT_OPTIONS: { value: EngagementType; label: string }[] = [
  { value: 'project-based', label: 'Project-based / Milestone' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'freelance', label: 'Freelance / Contract' },
  { value: 'co-founder', label: 'Co-founder / Equity partnership' },
];

const COMPENSATION_OPTIONS: { value: CompensationType; label: string }[] = [
  { value: 'paid', label: 'Paid (Market salary or stipend)' },
  { value: 'unpaid', label: 'Unpaid / Volunteer / Learning opportunity' },
  { value: 'to-be-discussed', label: 'To be discussed / Equity / Hybrid' },
];

let reqIdCounter = 1;

interface TalentRequirementsStepProps {
  requirements: TalentRequirement[];
  onChange: (reqs: TalentRequirement[]) => void;
  onNext: () => void;
  onBack: () => void;
  isEditingFromReview?: boolean;
  onReturnToReview?: () => void;
}

interface NewRequirementFormState {
  roleTitle: string;
  customRoleTitle: string;
  skills: string[];
  contributorsCount: string;
  experiencePreference: ExperiencePreference;
  workArrangement: RequirementWorkArrangement;
  engagementType: EngagementType;
  compensation: CompensationType;
  duration: string;
  startDate: string;
}

const INITIAL_FORM: NewRequirementFormState = {
  roleTitle: '',
  customRoleTitle: '',
  skills: [],
  contributorsCount: '1',
  experiencePreference: 'flexible',
  workArrangement: 'remote',
  engagementType: 'project-based',
  compensation: 'paid',
  duration: '',
  startDate: '',
};

export const TalentRequirementsStep: React.FC<TalentRequirementsStepProps> = ({
  requirements,
  onChange,
  onNext,
  onBack,
  isEditingFromReview,
  onReturnToReview,
}) => {
  const [isAdding, setIsAdding] = useState(requirements.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewRequirementFormState>(INITIAL_FORM);
  const [skillInput, setSkillInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (form.skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setForm((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
    setSkillInput('');
  };

  const removeSkill = (skillToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  /**
   * Detects whether the editor contains meaningful unsaved information.
   */
  const hasUnsavedRequirement = (): boolean => {
    if (!isAdding) return false;
    // If editing existing requirement, the editor has an active edit in progress
    if (editingId !== null) return true;
    // If creating new: check if role title selected or custom entered or skills entered or duration/dates entered
    return Boolean(
      form.roleTitle.trim() ||
      form.customRoleTitle.trim() ||
      form.skills.length > 0 ||
      skillInput.trim() ||
      form.duration.trim() ||
      form.startDate.trim() ||
      (form.contributorsCount !== '1' && form.contributorsCount.trim() !== '') ||
      form.experiencePreference !== 'flexible' ||
      form.workArrangement !== 'remote' ||
      form.engagementType !== 'project-based' ||
      form.compensation !== 'paid'
    );
  };

  const saveRequirement = (): boolean => {
    setFormError(null);
    const finalRole = form.roleTitle === 'Other' ? form.customRoleTitle.trim() : form.roleTitle;
    if (!finalRole) {
      setFormError('Please select or specify a role title.');
      return false;
    }
    if (!form.contributorsCount || parseInt(form.contributorsCount, 10) < 1) {
      setFormError('Number of contributors must be at least 1.');
      return false;
    }

    if (editingId) {
      onChange(
        requirements.map((r) =>
          r.id === editingId
            ? {
                ...r,
                roleTitle: finalRole,
                requiredSkills: form.skills,
                contributorsCount: form.contributorsCount,
                experiencePreference: form.experiencePreference,
                workArrangement: form.workArrangement,
                engagementType: form.engagementType,
                compensation: form.compensation,
                duration: form.duration,
                startDate: form.startDate,
              }
            : r
        )
      );
      setEditingId(null);
    } else {
      const newReq: TalentRequirement = {
        id: `req-${++reqIdCounter}`,
        roleTitle: finalRole,
        requiredSkills: form.skills,
        contributorsCount: form.contributorsCount,
        experiencePreference: form.experiencePreference,
        workArrangement: form.workArrangement,
        engagementType: form.engagementType,
        compensation: form.compensation,
        duration: form.duration,
        startDate: form.startDate,
      };
      onChange([...requirements, newReq]);
    }

    setForm(INITIAL_FORM);
    setIsAdding(false);
    setShowUnsavedWarning(false);
    return true;
  };

  const handleNextClick = () => {
    if (hasUnsavedRequirement()) {
      setShowUnsavedWarning(true);
      return;
    }
    // No unsaved data:
    if (isAdding && !hasUnsavedRequirement()) {
      setIsAdding(false);
    }
    if (isEditingFromReview && onReturnToReview) {
      onReturnToReview();
    } else {
      onNext();
    }
  };

  const handleSaveAndContinue = () => {
    const success = saveRequirement();
    if (success) {
      if (isEditingFromReview && onReturnToReview) {
        onReturnToReview();
      } else {
        onNext();
      }
    }
  };

  const handleDiscardAndContinue = () => {
    setShowUnsavedWarning(false);
    setForm(INITIAL_FORM);
    setEditingId(null);
    setIsAdding(false);
    setFormError(null);
    if (isEditingFromReview && onReturnToReview) {
      onReturnToReview();
    } else {
      onNext();
    }
  };

  const startEdit = (req: TalentRequirement) => {
    const isStandard = COMMON_ROLES.includes(req.roleTitle);
    setForm({
      roleTitle: isStandard ? req.roleTitle : 'Other',
      customRoleTitle: isStandard ? '' : req.roleTitle,
      skills: [...req.requiredSkills],
      contributorsCount: req.contributorsCount,
      experiencePreference: req.experiencePreference,
      workArrangement: req.workArrangement,
      engagementType: req.engagementType,
      compensation: req.compensation,
      duration: req.duration || '',
      startDate: req.startDate || '',
    });
    setEditingId(req.id);
    setIsAdding(true);
    setShowUnsavedWarning(false);
  };

  const duplicateRequirement = (req: TalentRequirement) => {
    const copy: TalentRequirement = {
      ...req,
      id: `req-${++reqIdCounter}`,
      roleTitle: `${req.roleTitle} (Copy)`,
    };
    onChange([...requirements, copy]);
  };

  const removeRequirement = (id: string) => {
    onChange(requirements.filter((r) => r.id !== id));
    if (editingId === id) {
      setIsAdding(false);
      setEditingId(null);
      setShowUnsavedWarning(false);
    }
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowUnsavedWarning(false);
  };

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Stage 4 of 6 — Talent Requirements"
        heading="Who do you need to make it happen?"
        subheading="Describe the roles, capabilities, and collaboration preferences you are looking for. You can add multiple roles or skip if you are not currently recruiting."
      />

      <InfoNotice variant="info">
        <strong>Transparency & Trust:</strong> Clearly distinguishing between paid, equity, and volunteer opportunities builds trust with contributors and ensures high-intent matching.
      </InfoNotice>

      {/* Existing Requirements List */}
      {requirements.length > 0 && (
        <div className="founder-reqs-list" aria-label="Current talent requirements">
          <SectionDivider title={`Configured Requirements (${requirements.length})`} />
          <div className="founder-reqs-grid">
            {requirements.map((req) => (
              <div key={req.id} className="founder-req-card">
                <div className="founder-req-header">
                  <div className="founder-req-title-wrap">
                    <span className="founder-req-icon-box" aria-hidden="true">
                      <Users size={16} />
                    </span>
                    <div>
                      <h3 className="founder-req-role">{req.roleTitle}</h3>
                      <p className="founder-req-meta">
                        {req.contributorsCount} {parseInt(req.contributorsCount, 10) > 1 ? 'contributors' : 'contributor'} · {req.workArrangement} · {req.engagementType}
                      </p>
                    </div>
                  </div>
                  <div className="founder-req-actions">
                    <button
                      type="button"
                      className="ob-icon-btn"
                      onClick={() => duplicateRequirement(req)}
                      aria-label={`Duplicate ${req.roleTitle}`}
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      className="ob-icon-btn"
                      onClick={() => startEdit(req)}
                      aria-label={`Edit ${req.roleTitle}`}
                      title="Edit"
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="ob-icon-btn ob-icon-btn-danger"
                      onClick={() => removeRequirement(req.id)}
                      aria-label={`Remove ${req.roleTitle}`}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Compensation badge */}
                <div className="founder-req-badges">
                  <span className={`founder-comp-badge comp-${req.compensation}`}>
                    {req.compensation === 'paid' && 'Paid Opportunity'}
                    {req.compensation === 'unpaid' && 'Unpaid / Learning Opportunity'}
                    {req.compensation === 'to-be-discussed' && 'Terms To Be Discussed'}
                  </span>
                  <span className="founder-exp-badge">
                    Level: {req.experiencePreference}
                  </span>
                </div>

                {/* Required skills */}
                {req.requiredSkills.length > 0 && (
                  <div className="founder-req-skills">
                    {req.requiredSkills.map((skill) => (
                      <span key={skill} className="ob-review-tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Form Card */}
      {isAdding ? (
        <div className="founder-req-editor-card">
          <SectionDivider title={editingId ? 'Edit Requirement' : 'Define New Talent Requirement'} />

          {formError && (
            <div className="ob-field-error ob-error-banner" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="ob-form">
            <FieldGroup label="Target role *" htmlFor="req-role-select">
              <SelectInput
                inputId="req-role-select"
                value={form.roleTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, roleTitle: e.target.value }))}
              >
                <option value="">Select a target role</option>
                {COMMON_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </SelectInput>
            </FieldGroup>

            {form.roleTitle === 'Other' && (
              <FieldGroup label="Specify custom role title *" htmlFor="req-custom-role">
                <TextInput
                  inputId="req-custom-role"
                  type="text"
                  placeholder="e.g. Founding Infrastructure Architect"
                  value={form.customRoleTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, customRoleTitle: e.target.value }))}
                />
              </FieldGroup>
            )}

            {/* Skills Multi-Value Input */}
            <FieldGroup
              label="Key required skills"
              htmlFor="req-skill-input"
              hint="Press Enter or click Add to append a required skill. Duplicates are automatically prevented."
            >
              <div className="ob-inline-input-action">
                <TextInput
                  inputId="req-skill-input"
                  type="text"
                  placeholder="e.g. React, Python, PostgreSQL, Figma"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <button
                  type="button"
                  className="ob-btn-primary ob-inline-add-btn"
                  onClick={addSkill}
                  id="add-req-skill-btn"
                >
                  <Plus size={16} aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>

              {form.skills.length > 0 && (
                <div className="ob-selected-roles-wrap">
                  <div className="ob-selected-roles-list">
                    {form.skills.map((skill) => (
                      <span key={skill} className="ob-role-pill">
                        <span>{skill}</span>
                        <button
                          type="button"
                          className="ob-pill-remove-btn"
                          onClick={() => removeSkill(skill)}
                          aria-label={`Remove skill ${skill}`}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </FieldGroup>

            <div className="ob-form-row">
              <FieldGroup label="Number of contributors *" htmlFor="req-count">
                <TextInput
                  inputId="req-count"
                  type="number"
                  min="1"
                  max="50"
                  value={form.contributorsCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, contributorsCount: e.target.value }))}
                />
              </FieldGroup>

              <FieldGroup label="Experience level" htmlFor="req-exp">
                <SelectInput
                  inputId="req-exp"
                  value={form.experiencePreference}
                  onChange={(e) => setForm((prev) => ({ ...prev, experiencePreference: e.target.value as ExperiencePreference }))}
                >
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </SelectInput>
              </FieldGroup>
            </div>

            <div className="ob-form-row">
              <FieldGroup label="Work arrangement" htmlFor="req-arr">
                <SelectInput
                  inputId="req-arr"
                  value={form.workArrangement}
                  onChange={(e) => setForm((prev) => ({ ...prev, workArrangement: e.target.value as RequirementWorkArrangement }))}
                >
                  {ARRANGEMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </SelectInput>
              </FieldGroup>

              <FieldGroup label="Engagement type" htmlFor="req-engagement">
                <SelectInput
                  inputId="req-engagement"
                  value={form.engagementType}
                  onChange={(e) => setForm((prev) => ({ ...prev, engagementType: e.target.value as EngagementType }))}
                >
                  {ENGAGEMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </SelectInput>
              </FieldGroup>
            </div>

            {/* Compensation Model */}
            <FieldGroup label="Compensation structure *" htmlFor="req-compensation">
              <SelectInput
                inputId="req-compensation"
                value={form.compensation}
                onChange={(e) => setForm((prev) => ({ ...prev, compensation: e.target.value as CompensationType }))}
              >
                {COMPENSATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectInput>
            </FieldGroup>

            <div className="ob-form-row">
              <FieldGroup label="Expected duration (optional)" htmlFor="req-duration">
                <TextInput
                  inputId="req-duration"
                  type="text"
                  placeholder="e.g. 2–3 months, 6 weeks, or Ongoing"
                  value={form.duration}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                />
              </FieldGroup>

              <FieldGroup label="Expected start date (optional)" htmlFor="req-start">
                <TextInput
                  inputId="req-start"
                  type="text"
                  placeholder="e.g. Immediate, Next sprint, Flexible"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </FieldGroup>
            </div>

            <div className="founder-req-form-btns">
              {requirements.length > 0 && (
                <button
                  type="button"
                  className="ob-btn-secondary"
                  onClick={cancelForm}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="ob-btn-primary"
                onClick={saveRequirement}
                id="save-requirement-btn"
              >
                <Check size={16} aria-hidden="true" />
                <span>{editingId ? 'Save Changes' : 'Add Requirement Card'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="founder-add-req-trigger-wrap">
          <button
            type="button"
            className="ob-btn-secondary founder-add-another-btn"
            onClick={() => {
              setForm(INITIAL_FORM);
              setEditingId(null);
              setIsAdding(true);
            }}
            id="add-another-requirement-btn"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Add Another Requirement</span>
          </button>
        </div>
      )}

      {requirements.length === 0 && !isAdding && (
        <p className="ob-empty-state-text">
          No talent requirements added. You can proceed without requirements if you are not currently seeking contributors.
        </p>
      )}

      {showUnsavedWarning && (
        <div className="founder-unsaved-warning-box" role="alert">
          <div className="founder-unsaved-warning-header">
            <AlertCircle size={22} className="founder-unsaved-warning-icon" aria-hidden="true" />
            <div>
              <h4 className="founder-unsaved-warning-title">
                {editingId ? 'Unsaved edits to talent requirement' : 'Unsaved talent requirement in progress'}
              </h4>
              <p className="founder-unsaved-warning-text">
                {editingId
                  ? 'You are currently editing an existing requirement card. Would you like to save your edits before continuing?'
                  : 'You have entered details for a talent requirement card that has not been saved yet. Would you like to save it before continuing?'}
              </p>
            </div>
          </div>
          <div className="founder-unsaved-warning-actions">
            <button
              type="button"
              className="ob-btn-primary founder-warning-btn"
              onClick={handleSaveAndContinue}
              id="talent-save-and-continue-btn"
            >
              <Check size={16} aria-hidden="true" />
              <span>Save & Continue</span>
            </button>
            <button
              type="button"
              className="ob-btn-secondary founder-warning-btn"
              onClick={handleDiscardAndContinue}
              id="talent-discard-and-continue-btn"
            >
              <span>Discard Draft & Continue</span>
            </button>
            <button
              type="button"
              className="ob-inline-link-btn"
              onClick={() => setShowUnsavedWarning(false)}
              id="talent-keep-editing-btn"
            >
              Keep Editing
            </button>
          </div>
        </div>
      )}

      <FormNav
        onBack={onBack}
        onNext={handleNextClick}
        nextLabel={isEditingFromReview ? 'Save & Return to Review' : 'Continue to Optional Task'}
        nextId="talent-next-btn"
      />
    </StepWrapper>
  );
};
