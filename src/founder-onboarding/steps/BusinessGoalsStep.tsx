import React, { useState } from 'react';
import type { BusinessGoal } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  TextAreaInput, FormNav, SectionDivider, InfoNotice,
} from '../../onboarding/shared';

const GOAL_OPTIONS = [
  { value: '', label: 'Select your primary goal' },
  { value: 'Build an MVP', label: 'Build an MVP' },
  { value: 'Develop a New Feature', label: 'Develop a New Feature' },
  { value: 'Improve an Existing Product', label: 'Improve an Existing Product' },
  { value: 'Find Technical Contributors', label: 'Find Technical Contributors' },
  { value: 'Expand the Team', label: 'Expand the Team' },
  { value: 'Validate a Business Idea', label: 'Validate a Business Idea' },
  { value: 'Solve a Technical Challenge', label: 'Solve a Technical Challenge' },
  { value: 'Other', label: 'Other (specify below)' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select project category' },
  { value: 'Web Development', label: 'Web Development' },
  { value: 'Mobile App Development', label: 'Mobile App Development' },
  { value: 'AI / Machine Learning', label: 'AI / Machine Learning' },
  { value: 'Data Science', label: 'Data Science & Analytics' },
  { value: 'UI/UX Design', label: 'UI/UX Design' },
  { value: 'Cloud / DevOps', label: 'Cloud / DevOps & Infrastructure' },
  { value: 'Business & Marketing', label: 'Business & Marketing' },
  { value: 'Research', label: 'Research & Prototyping' },
  { value: 'Other', label: 'Other' },
];

function isValidUrl(val: string): boolean {
  try {
    const url = new URL(val.startsWith('http') ? val : `https://${val}`);
    return url.hostname.length > 3;
  } catch {
    return false;
  }
}

interface BusinessGoalsStepProps {
  data: BusinessGoal;
  onChange: (d: BusinessGoal) => void;
  onNext: () => void;
  onBack: () => void;
  isEditingFromReview?: boolean;
  onReturnToReview?: () => void;
}

interface Errors {
  primaryGoal?: string;
  customPrimaryGoal?: string;
  projectDescription?: string;
  projectCategory?: string;
  projectLink?: string;
}

export const BusinessGoalsStep: React.FC<BusinessGoalsStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
  isEditingFromReview,
  onReturnToReview,
}) => {
  const [errors, setErrors] = useState<Errors>({});

  const set = (field: keyof BusinessGoal, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    if (!data.primaryGoal) errs.primaryGoal = 'Please select your primary goal.';
    if (data.primaryGoal === 'Other' && !data.customPrimaryGoal?.trim()) {
      errs.customPrimaryGoal = 'Please specify your primary goal.';
    }
    if (!data.projectDescription.trim()) {
      errs.projectDescription = 'Please describe the problem you are solving, what you are building, and what support you need.';
    }
    if (!data.projectCategory) errs.projectCategory = 'Please select a project category.';

    if (data.projectLink && data.projectLink.trim()) {
      if (!isValidUrl(data.projectLink)) {
        errs.projectLink = 'Please enter a valid URL (e.g. GitHub repository, design link, or demo).';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
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
        eyebrow="Stage 4 of 6 — Objectives & Scope"
        heading="What's your next big milestone?"
        subheading="Tell us what you are trying to achieve and what kind of support or talent would accelerate your progress."
      />

      <InfoNotice variant="info">
        <strong>Talent Match Benchmarking:</strong> These details help personalize future project and contributor discovery. No repository or existing product is required if you are still at the ideation stage.
      </InfoNotice>

      <div className="ob-form">
        <SectionDivider title="Milestone & Target" />

        {/* Primary Goal */}
        <FieldGroup
          label="Primary milestone goal"
          htmlFor="founder-primary-goal"
          required
          error={errors.primaryGoal}
        >
          <SelectInput
            inputId="founder-primary-goal"
            value={data.primaryGoal}
            onChange={(e) => set('primaryGoal', e.target.value)}
            error={errors.primaryGoal}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectInput>
        </FieldGroup>

        {data.primaryGoal === 'Other' && (
          <FieldGroup
            label="Specify your primary goal"
            htmlFor="founder-custom-goal"
            required
            error={errors.customPrimaryGoal}
          >
            <TextInput
              inputId="founder-custom-goal"
              type="text"
              placeholder="e.g. Prepare for enterprise pilot rollout"
              value={data.customPrimaryGoal || ''}
              onChange={(e) => set('customPrimaryGoal', e.target.value)}
              error={errors.customPrimaryGoal}
            />
          </FieldGroup>
        )}

        {/* Project Category */}
        <FieldGroup
          label="Primary project category"
          htmlFor="founder-project-category"
          required
          error={errors.projectCategory}
        >
          <SelectInput
            inputId="founder-project-category"
            value={data.projectCategory}
            onChange={(e) => set('projectCategory', e.target.value)}
            error={errors.projectCategory}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectInput>
        </FieldGroup>

        {/* Project Description */}
        <FieldGroup
          label="Project description & needs"
          htmlFor="founder-project-desc"
          required
          hint="Describe the problem you're solving, what you're building, and what kind of support you need."
          error={errors.projectDescription}
        >
          <TextAreaInput
            inputId="founder-project-desc"
            rows={4}
            placeholder="e.g. We are building the frontend dashboard and telemetry pipelines for our core product. We need a capable full-stack developer who understands React, Node.js, and WebSocket streaming to help complete our alpha milestone."
            value={data.projectDescription}
            onChange={(e) => set('projectDescription', e.target.value)}
            maxLength={600}
            currentLength={data.projectDescription.length}
            error={errors.projectDescription}
          />
        </FieldGroup>

        {/* Project Link */}
        <FieldGroup
          label="Project demo, repo, or spec link (optional)"
          htmlFor="founder-project-link"
          hint="Accepts a link to a prototype, GitHub repo, Figma spec, or demo site."
          error={errors.projectLink}
        >
          <TextInput
            inputId="founder-project-link"
            type="url"
            placeholder="https://github.com/my-org/project or https://demo.mysite.com"
            value={data.projectLink || ''}
            onChange={(e) => set('projectLink', e.target.value)}
            error={errors.projectLink}
          />
        </FieldGroup>
      </div>

      <FormNav
        onBack={onBack}
        onNext={handleNext}
        nextLabel={isEditingFromReview ? 'Save & Return to Review' : 'Continue to Talent Requirements'}
        nextId="goals-next-btn"
      />
    </StepWrapper>
  );
};
