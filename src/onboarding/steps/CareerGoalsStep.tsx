import React, { useState } from 'react';
import type { CareerGoalsData } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  FormNav, SectionDivider, InfoNotice,
} from '../shared';
import { Plus, X, Target } from 'lucide-react';

const COMMON_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'Mobile App Developer (iOS / Android)',
  'UI/UX Designer',
  'Product Manager',
  'Data Analyst / Data Scientist',
  'DevOps & Cloud Engineer',
  'QA & Test Automation Engineer',
  'AI / Machine Learning Engineer',
  'Digital Marketing Specialist',
  'Business Analyst',
  'Cybersecurity Analyst',
  'Other',
];

const SUGGESTED_ADDITIONAL_ROLES = [
  'Full-Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'UI/UX Designer',
  'Product Manager',
  'DevOps & Cloud Engineer',
  'Mobile App Developer',
  'Data Analyst',
];

interface CareerGoalsStepProps {
  data: CareerGoalsData;
  onChange: (d: CareerGoalsData) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Errors {
  primaryRole?: string;
  customPrimaryRole?: string;
  additionalRole?: string;
}

export const CareerGoalsStep: React.FC<CareerGoalsStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Errors>({});
  const [customAddRole, setCustomAddRole] = useState('');

  const setPrimaryRole = (role: string) => {
    onChange({
      ...data,
      primaryRole: role,
      customPrimaryRole: role === 'other' ? data.customPrimaryRole : '',
    });
    if (errors.primaryRole) {
      setErrors((prev) => ({ ...prev, primaryRole: undefined }));
    }
  };

  const setCustomPrimaryRole = (val: string) => {
    onChange({ ...data, customPrimaryRole: val });
    if (errors.customPrimaryRole) {
      setErrors((prev) => ({ ...prev, customPrimaryRole: undefined }));
    }
  };

  const addAdditionalRole = (role: string) => {
    const trimmed = role.trim();
    if (!trimmed) return;

    const currentPrimary = data.primaryRole === 'other' ? data.customPrimaryRole : data.primaryRole;
    if (currentPrimary && currentPrimary.toLowerCase() === trimmed.toLowerCase()) {
      setErrors((prev) => ({ ...prev, additionalRole: 'This is already your primary role.' }));
      return;
    }

    if (data.additionalRoles.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      setErrors((prev) => ({ ...prev, additionalRole: 'Role already added to your target list.' }));
      return;
    }

    if (data.additionalRoles.length >= 3) {
      setErrors((prev) => ({ ...prev, additionalRole: 'You can add up to 3 additional target roles.' }));
      return;
    }

    setErrors((prev) => ({ ...prev, additionalRole: undefined }));
    onChange({
      ...data,
      additionalRoles: [...data.additionalRoles, trimmed],
    });
    setCustomAddRole('');
  };

  const removeAdditionalRole = (role: string) => {
    onChange({
      ...data,
      additionalRoles: data.additionalRoles.filter((r) => r !== role),
    });
    setErrors((prev) => ({ ...prev, additionalRole: undefined }));
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    if (!data.primaryRole) {
      errs.primaryRole = 'Please select your primary target role.';
    } else if (data.primaryRole === 'other' && !data.customPrimaryRole.trim()) {
      errs.customPrimaryRole = 'Please specify your target role title.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Step 4 of 5 — Career Goals"
        heading="Define your target roles."
        subheading="Tell us what you are aiming for so YOGYATA can map relevant skill benchmarks and challenges."
      />

      <InfoNotice variant="info">
        <strong>Skill Benchmarking:</strong> Selecting target roles allows YOGYATA
        to compare your declared skills against ecosystem benchmarks and suggest
        targeted assessments.
      </InfoNotice>

      <div className="ob-form">
        <SectionDivider title="Primary Target Role" />

        <FieldGroup
          label="Primary target role"
          htmlFor="primary-role-select"
          required
          hint="This is the main role you want opportunities and skill assessments tailored for."
          error={errors.primaryRole}
        >
          <SelectInput
            inputId="primary-role-select"
            value={data.primaryRole}
            onChange={(e) => setPrimaryRole(e.target.value)}
            error={errors.primaryRole}
          >
            <option value="">Select your primary target role</option>
            {COMMON_ROLES.map((r) => (
              <option key={r} value={r === 'Other' ? 'other' : r}>
                {r}
              </option>
            ))}
          </SelectInput>
        </FieldGroup>

        {data.primaryRole === 'other' && (
          <FieldGroup
            label="Specify your target role"
            htmlFor="custom-primary-role"
            required
            error={errors.customPrimaryRole}
          >
            <TextInput
              inputId="custom-primary-role"
              type="text"
              placeholder="e.g. Solutions Architect, Growth Hacker"
              value={data.customPrimaryRole}
              onChange={(e) => setCustomPrimaryRole(e.target.value)}
              error={errors.customPrimaryRole}
            />
          </FieldGroup>
        )}

        <SectionDivider title="Secondary / Additional Roles (Optional)" />

        <FieldGroup
          label="Additional target roles (up to 3)"
          htmlFor="additional-role-input"
          hint="Secondary roles you would also consider or want to prepare for."
          error={errors.additionalRole}
        >
          <div className="ob-inline-input-action">
            <TextInput
              inputId="additional-role-input"
              type="text"
              placeholder="e.g. Technical Lead, DevOps Specialist"
              value={customAddRole}
              onChange={(e) => setCustomAddRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAdditionalRole(customAddRole);
                }
              }}
            />
            <button
              type="button"
              className="ob-btn-primary ob-inline-add-btn"
              onClick={() => addAdditionalRole(customAddRole)}
              id="add-additional-role-btn"
              aria-label="Add additional target role"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
        </FieldGroup>

        {/* Quick select suggestions */}
        <div className="ob-suggested-roles">
          <p className="ob-suggested-title">Quick suggestions:</p>
          <div className="ob-suggested-chips">
            {SUGGESTED_ADDITIONAL_ROLES.map((r) => {
              const isPrimary =
                (data.primaryRole === 'other' ? data.customPrimaryRole : data.primaryRole).toLowerCase() ===
                r.toLowerCase();
              const isSelected = data.additionalRoles.some((ar) => ar.toLowerCase() === r.toLowerCase());
              return (
                <button
                  key={r}
                  type="button"
                  className={`ob-suggestion-chip ${isSelected ? 'is-selected' : ''}`}
                  disabled={isPrimary || isSelected}
                  onClick={() => addAdditionalRole(r)}
                  aria-label={`Add suggested role: ${r}`}
                >
                  <Plus size={12} aria-hidden="true" />
                  <span>{r}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected additional roles list */}
        {data.additionalRoles.length > 0 && (
          <div className="ob-selected-roles-wrap">
            <p className="ob-selected-roles-label">Selected secondary roles:</p>
            <ul className="ob-selected-roles-list">
              {data.additionalRoles.map((role) => (
                <li key={role} className="ob-role-pill">
                  <Target size={14} aria-hidden="true" className="ob-role-pill-icon" />
                  <span>{role}</span>
                  <button
                    type="button"
                    className="ob-pill-remove-btn"
                    onClick={() => removeAdditionalRole(role)}
                    aria-label={`Remove ${role}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <FormNav
        onBack={onBack}
        onNext={handleNext}
        nextLabel="Continue to Preferences"
        nextId="goals-next-btn"
      />
    </StepWrapper>
  );
};
