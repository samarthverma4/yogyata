import React, { useState } from 'react';
import type { ProjectTaskDraft } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  TextAreaInput, FormNav, SectionDivider, InfoNotice,
} from '../../onboarding/shared';
import { Plus, X, Sparkles, ArrowRight } from 'lucide-react';

const REWARD_OPTIONS = [
  { value: 'unspecified', label: 'To be discussed / Portfolio credit' },
  { value: 'paid', label: 'Paid challenge / Cash bounty' },
  { value: 'unpaid', label: 'Unpaid practical challenge / Learning badge' },
];

function isValidUrl(val: string): boolean {
  try {
    const url = new URL(val.startsWith('http') ? val : `https://${val}`);
    return url.hostname.length > 3;
  } catch {
    return false;
  }
}

interface ProjectTaskStepProps {
  data: ProjectTaskDraft;
  onChange: (d: ProjectTaskDraft) => void;
  onNext: () => void;
  onBack: () => void;
  isEditingFromReview?: boolean;
  onReturnToReview?: () => void;
}

interface Errors {
  taskTitle?: string;
  problemStatement?: string;
  requiredSkills?: string;
  expectedDeliverable?: string;
  evaluationCriteria?: string;
  projectLink?: string;
}

export const ProjectTaskStep: React.FC<ProjectTaskStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
  isEditingFromReview,
  onReturnToReview,
}) => {
  const [isCreating, setIsCreating] = useState(!data.isSkipped);
  const [skillInput, setSkillInput] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const setField = <K extends keyof ProjectTaskDraft>(field: K, val: ProjectTaskDraft[K]) => {
    onChange({ ...data, [field]: val });
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    if (data.requiredSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    onChange({
      ...data,
      requiredSkills: [...data.requiredSkills, trimmed],
    });
    setSkillInput('');
    if (errors.requiredSkills) {
      setErrors((prev) => ({ ...prev, requiredSkills: undefined }));
    }
  };

  const removeSkill = (skill: string) => {
    onChange({
      ...data,
      requiredSkills: data.requiredSkills.filter((s) => s !== skill),
    });
  };

  const handleSkip = () => {
    onChange({
      ...data,
      isSkipped: true,
    });
    if (isEditingFromReview && onReturnToReview) {
      onReturnToReview();
    } else {
      onNext();
    }
  };

  const handleStartCreating = () => {
    setIsCreating(true);
    onChange({
      ...data,
      isSkipped: false,
    });
  };

  const validate = (): boolean => {
    if (data.isSkipped) return true;
    const errs: Errors = {};
    if (!data.taskTitle.trim()) errs.taskTitle = 'Task title is required.';
    if (!data.problemStatement.trim()) errs.problemStatement = 'Problem statement is required.';
    if (data.requiredSkills.length === 0) errs.requiredSkills = 'Please add at least one required skill.';
    if (!data.expectedDeliverable.trim()) errs.expectedDeliverable = 'Expected deliverable description is required.';
    if (!data.evaluationCriteria.trim()) errs.evaluationCriteria = 'Evaluation criteria is required.';

    if (data.relatedProjectLink && data.relatedProjectLink.trim()) {
      if (!isValidUrl(data.relatedProjectLink)) {
        errs.projectLink = 'Please enter a valid URL.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (data.isSkipped || validate()) {
      if (isEditingFromReview && onReturnToReview) {
        onReturnToReview();
      } else {
        onNext();
      }
    }
  };

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Stage 5 of 6 — Practical Challenge (Optional)"
        heading="Have a challenge worth solving?"
        subheading="Create a practical task to help prospective contributors demonstrate their capabilities with real proof."
      />

      <InfoNotice variant="info">
        <strong>Skill Proof Distinction:</strong> YOGYATA connects practical work with skill evidence. A completed task alone does not automatically grant a VERIFIED Skill Passport status without structured review and evidence validation.
      </InfoNotice>

      {!isCreating ? (
        <div className="founder-task-prompt-card">
          <div className="founder-task-prompt-icon" aria-hidden="true">
            <Sparkles size={32} />
          </div>
          <h2 className="founder-task-prompt-title">Would you like to draft a project task now?</h2>
          <p className="founder-task-prompt-desc">
            Tasks can represent real product bugs, architecture specs, landing page designs, or API endpoints. Contributors tackle these to prove their capability.
          </p>
          <div className="founder-task-prompt-actions">
            <button
              type="button"
              className="ob-btn-primary"
              onClick={handleStartCreating}
              id="founder-create-task-opt-btn"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Create a Task</span>
            </button>
            <button
              type="button"
              className="ob-btn-secondary"
              onClick={handleSkip}
              id="founder-skip-task-btn"
            >
              <span>Skip for Now</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="ob-form">
          <div className="founder-task-status-row">
            <span className="ob-dev-badge" style={{ background: 'var(--color-blue)' }}>DRAFT PREPARATION</span>
            <button
              type="button"
              className="ob-inline-link-btn"
              onClick={() => {
                setIsCreating(false);
                onChange({ ...data, isSkipped: true });
              }}
              style={{ fontSize: '0.84rem' }}
            >
              I prefer to skip task creation
            </button>
          </div>

          <SectionDivider title="Task Details" />

          {/* Task Title */}
          <FieldGroup
            label="Task title *"
            htmlFor="task-title"
            error={errors.taskTitle}
            hint="A clear, actionable summary of the work (e.g. 'Build an accessible dark-mode toggle for dashboard')."
          >
            <TextInput
              inputId="task-title"
              type="text"
              placeholder="e.g. Implement resilient WebSocket connection retry logic"
              value={data.taskTitle}
              onChange={(e) => setField('taskTitle', e.target.value)}
              error={errors.taskTitle}
            />
          </FieldGroup>

          {/* Problem Statement */}
          <FieldGroup
            label="Problem statement & context *"
            htmlFor="task-problem"
            required
            hint="Describe the bug, technical challenge, or feature need in detail."
            error={errors.problemStatement}
          >
            <TextAreaInput
              inputId="task-problem"
              rows={4}
              placeholder="e.g. When the client loses network connectivity for over 10 seconds, the active session terminates without reconnection attempts. We need an exponential-backoff retry layer that queues failed telemetry events."
              value={data.problemStatement}
              onChange={(e) => setField('problemStatement', e.target.value)}
              maxLength={700}
              currentLength={data.problemStatement.length}
              error={errors.problemStatement}
            />
          </FieldGroup>

          {/* Required Skills */}
          <FieldGroup
            label="Required skills for this challenge *"
            htmlFor="task-skill-input"
            error={errors.requiredSkills}
            hint="Contributors with these declared or assessed skills will be matched."
          >
            <div className="ob-inline-input-action">
              <TextInput
                inputId="task-skill-input"
                type="text"
                placeholder="e.g. TypeScript, WebSocket, Jest"
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
                id="add-task-skill-btn"
              >
                <Plus size={16} aria-hidden="true" />
                <span>Add</span>
              </button>
            </div>

            {data.requiredSkills.length > 0 && (
              <div className="ob-selected-roles-wrap">
                <div className="ob-selected-roles-list">
                  {data.requiredSkills.map((skill) => (
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

          <SectionDivider title="Deliverable & Criteria" />

          {/* Deliverable */}
          <FieldGroup
            label="Expected deliverable *"
            htmlFor="task-deliverable"
            required
            hint="What should the contributor submit? (e.g. GitHub Pull Request, Figma file, Loom demo video)."
            error={errors.expectedDeliverable}
          >
            <TextAreaInput
              inputId="task-deliverable"
              rows={3}
              placeholder="e.g. A tested GitHub Pull Request with unit test coverage and clean TypeScript types."
              value={data.expectedDeliverable}
              onChange={(e) => setField('expectedDeliverable', e.target.value)}
              maxLength={400}
              currentLength={data.expectedDeliverable.length}
              error={errors.expectedDeliverable}
            />
          </FieldGroup>

          {/* Evaluation Criteria */}
          <FieldGroup
            label="Evaluation & acceptance criteria *"
            htmlFor="task-criteria"
            required
            hint="How will you decide if the submission is accepted?"
            error={errors.evaluationCriteria}
          >
            <TextAreaInput
              inputId="task-criteria"
              rows={3}
              placeholder="e.g. Passes all existing unit tests, includes unit tests for the exponential backoff, and adheres to clean code conventions."
              value={data.evaluationCriteria}
              onChange={(e) => setField('evaluationCriteria', e.target.value)}
              maxLength={400}
              currentLength={data.evaluationCriteria.length}
              error={errors.evaluationCriteria}
            />
          </FieldGroup>

          <div className="ob-form-row">
            {/* Compensation / Reward Model */}
            <FieldGroup label="Task reward / compensation" htmlFor="task-reward-select">
              <SelectInput
                inputId="task-reward-select"
                value={data.compensationModel}
                onChange={(e) => setField('compensationModel', e.target.value as 'paid' | 'unpaid' | 'unspecified')}
              >
                {REWARD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectInput>
            </FieldGroup>

            {/* Deadline */}
            <FieldGroup
              label="Estimated deadline / turnaround (optional)"
              htmlFor="task-deadline"
              hint="e.g. 7 days, 2 weeks, or Flexible"
            >
              <TextInput
                inputId="task-deadline"
                type="text"
                placeholder="e.g. 10 days"
                value={data.deadline || ''}
                onChange={(e) => setField('deadline', e.target.value)}
              />
            </FieldGroup>
          </div>

          {/* Reward Details if paid */}
          {data.compensationModel === 'paid' && (
            <FieldGroup
              label="Reward amount / stipend details"
              htmlFor="task-reward-details"
              hint="e.g. $150 bounty, ₹10,000 upon merge, or milestone stipend"
            >
              <TextInput
                inputId="task-reward-details"
                type="text"
                placeholder="e.g. $250 upon accepted PR"
                value={data.rewardDetails || ''}
                onChange={(e) => setField('rewardDetails', e.target.value)}
              />
            </FieldGroup>
          )}

          {/* Related link */}
          <FieldGroup
            label="Related issue, spec, or repository link (optional)"
            htmlFor="task-link"
            error={errors.projectLink}
          >
            <TextInput
              inputId="task-link"
              type="url"
              placeholder="https://github.com/my-repo/issues/42"
              value={data.relatedProjectLink || ''}
              onChange={(e) => setField('relatedProjectLink', e.target.value)}
              error={errors.projectLink}
            />
          </FieldGroup>
        </div>
      )}

      <FormNav
        onBack={onBack}
        onNext={handleNext}
        nextLabel={isEditingFromReview ? 'Save & Return to Review' : 'Continue to Review & Privacy'}
        nextId="task-next-btn"
      />
    </StepWrapper>
  );
};
