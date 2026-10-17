import React, { useState } from 'react';
import type { JobPrefsData, ProfessionalData, OpportunityType, WorkMode, Availability } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  FormNav, SectionDivider, ChipGroup,
} from '../shared';
import { Plus, X, MapPin } from 'lucide-react';

const OPPORTUNITY_TYPE_OPTIONS: { value: OpportunityType; label: string }[] = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract / Freelance' },
  { value: 'part-time', label: 'Part-time' },
];

const WORK_MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on-site', label: 'On-site' },
];

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: '', label: 'Select your availability' },
  { value: 'immediately', label: 'Immediately available' },
  { value: 'within-30', label: 'Within 30 days' },
  { value: 'within-60', label: 'Within 60 days' },
  { value: 'flexible', label: 'Flexible / Exploring options' },
];

const NOTICE_PERIOD_OPTIONS = [
  { value: '', label: 'Select notice period' },
  { value: 'immediate', label: 'Immediate / Not applicable' },
  { value: 'serving-notice', label: 'Currently serving notice' },
  { value: '15-days', label: '15 days' },
  { value: '30-days', label: '30 days' },
  { value: '60-days', label: '60 days' },
  { value: '90-days', label: '90 days' },
];

const COMMON_CITIES = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai'];

interface JobPrefsStepProps {
  data: JobPrefsData;
  professional: ProfessionalData;
  onChange: (d: JobPrefsData) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Errors {
  opportunityTypes?: string;
  workModes?: string;
  availability?: string;
}

export const JobPrefsStep: React.FC<JobPrefsStepProps> = ({
  data,
  professional,
  onChange,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Errors>({});
  const [cityInput, setCityInput] = useState('');

  const isEmployed = professional.status === 'employed';

  const handleOpportunityTypesChange = (types: string[]) => {
    onChange({ ...data, opportunityTypes: types as OpportunityType[] });
    if (errors.opportunityTypes && types.length > 0) {
      setErrors((prev) => ({ ...prev, opportunityTypes: undefined }));
    }
  };

  const handleWorkModesChange = (modes: string[]) => {
    onChange({ ...data, workModes: modes as WorkMode[] });
    if (errors.workModes && modes.length > 0) {
      setErrors((prev) => ({ ...prev, workModes: undefined }));
    }
  };

  const addLocation = (loc: string) => {
    const trimmed = loc.trim();
    if (!trimmed) return;
    if (data.preferredLocations.some((l) => l.toLowerCase() === trimmed.toLowerCase())) return;
    if (data.preferredLocations.length >= 5) return;
    onChange({
      ...data,
      preferredLocations: [...data.preferredLocations, trimmed],
    });
    setCityInput('');
  };

  const removeLocation = (loc: string) => {
    onChange({
      ...data,
      preferredLocations: data.preferredLocations.filter((l) => l !== loc),
    });
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    if (data.opportunityTypes.length === 0) {
      errs.opportunityTypes = 'Please select at least one opportunity type.';
    }
    if (data.workModes.length === 0) {
      errs.workModes = 'Please select at least one work mode.';
    }
    if (!data.availability) {
      errs.availability = 'Please select your current availability.';
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
        eyebrow="Step 4 of 5 — Work Preferences"
        heading="Where & how do you want to work?"
        subheading="Configure your opportunity and environment preferences to receive relevant matches."
      />

      <div className="ob-form">
        <SectionDivider title="Opportunity Types & Work Modes" />

        <div className="ob-pref-section">
          <ChipGroup
            label="Opportunity types (select all that apply) *"
            groupId="pref-opp-types"
            options={OPPORTUNITY_TYPE_OPTIONS}
            selected={data.opportunityTypes}
            onChange={handleOpportunityTypesChange}
            error={errors.opportunityTypes}
          />
        </div>

        <div className="ob-pref-section">
          <ChipGroup
            label="Work mode preferences *"
            groupId="pref-work-modes"
            options={WORK_MODE_OPTIONS}
            selected={data.workModes}
            onChange={handleWorkModesChange}
            error={errors.workModes}
          />
        </div>

        <SectionDivider title="Locations & Compensation" />

        <FieldGroup
          label="Preferred work locations (up to 5)"
          htmlFor="pref-location-input"
          hint="Cities or regions you are willing to work in or relocate to. Optional."
        >
          <div className="ob-inline-input-action">
            <TextInput
              inputId="pref-location-input"
              type="text"
              placeholder="e.g. Bengaluru, Remote, London"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLocation(cityInput);
                }
              }}
            />
            <button
              type="button"
              className="ob-btn-primary ob-inline-add-btn"
              onClick={() => addLocation(cityInput)}
              id="add-location-btn"
              aria-label="Add preferred location"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
        </FieldGroup>

        <div className="ob-suggested-roles">
          <p className="ob-suggested-title">Popular hubs:</p>
          <div className="ob-suggested-chips">
            {COMMON_CITIES.map((c) => {
              const isSelected = data.preferredLocations.some((l) => l.toLowerCase() === c.toLowerCase());
              return (
                <button
                  key={c}
                  type="button"
                  className={`ob-suggestion-chip ${isSelected ? 'is-selected' : ''}`}
                  disabled={isSelected}
                  onClick={() => addLocation(c)}
                  aria-label={`Add location: ${c}`}
                >
                  <Plus size={12} aria-hidden="true" />
                  <span>{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        {data.preferredLocations.length > 0 && (
          <div className="ob-selected-roles-wrap">
            <p className="ob-selected-roles-label">Selected locations:</p>
            <ul className="ob-selected-roles-list">
              {data.preferredLocations.map((loc) => (
                <li key={loc} className="ob-role-pill">
                  <MapPin size={14} aria-hidden="true" className="ob-role-pill-icon" />
                  <span>{loc}</span>
                  <button
                    type="button"
                    className="ob-pill-remove-btn"
                    onClick={() => removeLocation(loc)}
                    aria-label={`Remove ${loc}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="ob-form-row">
          <FieldGroup
            label="Availability *"
            htmlFor="pref-availability"
            required
            error={errors.availability}
          >
            <SelectInput
              inputId="pref-availability"
              value={data.availability}
              onChange={(e) => {
                onChange({ ...data, availability: e.target.value as Availability });
                if (errors.availability) setErrors((prev) => ({ ...prev, availability: undefined }));
              }}
              error={errors.availability}
            >
              {AVAILABILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectInput>
          </FieldGroup>

          {isEmployed && (
            <FieldGroup
              label="Notice period"
              htmlFor="pref-notice-period"
              hint="Current official notice period with employer."
            >
              <SelectInput
                inputId="pref-notice-period"
                value={data.noticePeriod}
                onChange={(e) => onChange({ ...data, noticePeriod: e.target.value })}
              >
                {NOTICE_PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </FieldGroup>
          )}
        </div>

        <FieldGroup
          label="Expected compensation / salary (optional)"
          htmlFor="pref-salary"
          hint="e.g. ₹12–15 LPA, $90,000/year, or Open to negotiation"
        >
          <TextInput
            inputId="pref-salary"
            type="text"
            placeholder="e.g. ₹12–18 LPA or Negotiable"
            value={data.expectedSalary}
            onChange={(e) => onChange({ ...data, expectedSalary: e.target.value })}
          />
        </FieldGroup>
      </div>

      <FormNav
        onBack={onBack}
        onNext={handleNext}
        nextLabel="Continue to Profile Review"
        nextId="prefs-next-btn"
      />
    </StepWrapper>
  );
};
