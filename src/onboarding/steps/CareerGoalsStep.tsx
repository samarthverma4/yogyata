import React, { useState } from 'react';
import type { CareerGoalsData } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput,
  FormNav, InfoNotice,
} from '../shared';
import {
  Plus, X, Target, Code, Server, Palette,
  Smartphone, BarChart3, Cloud, Briefcase, Sparkles, Check,
} from 'lucide-react';

interface RoleOption {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const POPULAR_TARGET_ROLES: RoleOption[] = [
  { value: 'Full-Stack Developer', label: 'Full-Stack Developer', icon: Code },
  { value: 'Frontend Developer', label: 'Frontend Developer', icon: Sparkles },
  { value: 'Backend Developer', label: 'Backend Developer', icon: Server },
  { value: 'UI/UX Designer', label: 'UI/UX Designer', icon: Palette },
  { value: 'Mobile App Developer (iOS / Android)', label: 'Mobile App Developer', icon: Smartphone },
  { value: 'AI / Machine Learning Engineer', label: 'AI / ML Engineer', icon: Sparkles },
  { value: 'Data Analyst / Data Scientist', label: 'Data Analyst / Scientist', icon: BarChart3 },
  { value: 'DevOps & Cloud Engineer', label: 'DevOps & Cloud', icon: Cloud },
  { value: 'Product Manager', label: 'Product Manager', icon: Briefcase },
  { value: 'other', label: 'Other Specialization', icon: Plus },
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
        eyebrow="Step 4 of 5 · Career Goals"
        heading="Define your target roles."
        subheading="Tell us what you are aiming for so YOGYATA can map relevant skill benchmarks, startup tasks, and assessment challenges."
      />

      <InfoNotice variant="info">
        <strong>Skill Benchmarking:</strong> Selecting target roles allows YOGYATA to compare your declared skills against ecosystem benchmarks and suggest targeted assessments.
      </InfoNotice>

      {/* ── CARD 1: Primary Target Role ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Target size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Primary Target Role</h2>
              <p className="ob-section-box-sub">Choose your main aspiration for skill benchmark matching</p>
            </div>
          </div>
          <span className="ob-pill-badge">Required</span>
        </div>

        <div className="ob-field-group">
          <label className="ob-label">
            Select your primary role
            <span className="ob-required-star" aria-hidden="true"> *</span>
          </label>
          <div className="ob-status-grid" role="radiogroup" aria-label="Primary target role">
            {POPULAR_TARGET_ROLES.map((item) => {
              const Icon = item.icon;
              const isActive = data.primaryRole === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`ob-status-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => setPrimaryRole(item.value)}
                >
                  <div className="ob-status-card-top">
                    <div className="ob-status-card-icon" aria-hidden="true">
                      <Icon size={18} />
                    </div>
                    <div className="ob-status-check" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="ob-status-card-title">{item.label}</div>
                  <div className="ob-status-card-desc">
                    {item.value === 'other' ? 'Custom title' : 'Benchmarked role'}
                  </div>
                </button>
              );
            })}
          </div>
          {errors.primaryRole && (
            <p className="ob-field-error" role="alert">{errors.primaryRole}</p>
          )}
        </div>

        {data.primaryRole === 'other' && (
          <div style={{ marginTop: '16px' }}>
            <FieldGroup
              label="Specify your target role title"
              htmlFor="custom-primary-role"
              required
              error={errors.customPrimaryRole}
            >
              <div className="ob-input-icon-left">
                <span className="ob-field-left-icon" aria-hidden="true">
                  <Target size={17} />
                </span>
                <TextInput
                  inputId="custom-primary-role"
                  type="text"
                  placeholder="e.g. Solutions Architect, Growth Hacker, Security Engineer"
                  value={data.customPrimaryRole}
                  onChange={(e) => setCustomPrimaryRole(e.target.value)}
                  error={errors.customPrimaryRole}
                />
              </div>
            </FieldGroup>
          </div>
        )}
      </div>

      {/* ── CARD 2: Additional Secondary Roles ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Secondary / Additional Roles</h2>
              <p className="ob-section-box-sub">Add up to 3 cross-functional or backup roles you'd consider (Optional)</p>
            </div>
          </div>
        </div>

        <FieldGroup
          label="Add an additional target role"
          htmlFor="additional-role-input"
          hint="Press Enter or click Add to append to your target list."
          error={errors.additionalRole}
        >
          <div className="ob-inline-input-action">
            <div className="ob-input-icon-left" style={{ flex: 1 }}>
              <span className="ob-field-left-icon" aria-hidden="true">
                <Target size={17} />
              </span>
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
            </div>
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

        {/* Quick Suggestions */}
        <div className="ob-preset-group" style={{ marginTop: '12px' }}>
          <span className="ob-preset-label">Quick suggestions:</span>
          {SUGGESTED_ADDITIONAL_ROLES.map((r) => {
            const isPrimary =
              (data.primaryRole === 'other' ? data.customPrimaryRole : data.primaryRole).toLowerCase() ===
              r.toLowerCase();
            const isSelected = data.additionalRoles.some((ar) => ar.toLowerCase() === r.toLowerCase());
            return (
              <button
                key={r}
                type="button"
                className={`ob-preset-pill ${isSelected ? 'is-selected' : ''}`}
                disabled={isPrimary || isSelected}
                onClick={() => addAdditionalRole(r)}
              >
                + {r}
              </button>
            );
          })}
        </div>

        {/* Selected Roles List */}
        {data.additionalRoles.length > 0 && (
          <div className="ob-selected-roles-wrap" style={{ marginTop: '16px' }}>
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
