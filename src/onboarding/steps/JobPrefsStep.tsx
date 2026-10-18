import React, { useState } from 'react';
import type { JobPrefsData, ProfessionalData, OpportunityType, WorkMode, Availability } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  FormNav,
} from '../shared';
import {
  Plus, X, MapPin, Briefcase, Globe, Clock, Calendar,
  Sparkles, GraduationCap, Rocket, Building2, Zap, Check,
} from 'lucide-react';

interface OppTypeConfig {
  value: OpportunityType;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const OPPORTUNITY_CARDS: OppTypeConfig[] = [
  { value: 'full-time', title: 'Full-time', desc: 'Permanent salaried role with benefits & growth', icon: Briefcase },
  { value: 'internship', title: 'Internship', desc: 'College or early career placement & mentorship', icon: GraduationCap },
  { value: 'contract', title: 'Contract / Freelance', desc: 'Project-based deliverables or consulting gigs', icon: Rocket },
  { value: 'part-time', title: 'Part-time', desc: 'Flexible schedule & dedicated weekly hours', icon: Clock },
];

interface WorkModeConfig {
  value: WorkMode;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const WORK_MODE_CARDS: WorkModeConfig[] = [
  { value: 'remote', title: 'Remote', desc: 'Work from anywhere with high autonomy', icon: Globe },
  { value: 'hybrid', title: 'Hybrid', desc: 'Flexible blend of office & remote collaboration', icon: Building2 },
  { value: 'on-site', title: 'On-site', desc: 'Immersive in-person team environment', icon: MapPin },
];

interface AvailabilityConfig {
  value: Availability;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const AVAILABILITY_CARDS: AvailabilityConfig[] = [
  { value: 'immediately', title: 'Immediate', desc: 'Ready within 7 days', icon: Zap },
  { value: 'within-30', title: 'Within 30 Days', desc: 'Standard 1-month notice', icon: Calendar },
  { value: 'within-60', title: 'Within 60 Days', desc: 'Serving extended notice', icon: Clock },
  { value: 'flexible', title: 'Flexible / Exploring', desc: 'Passively open to the right fit', icon: Sparkles },
];

const NOTICE_PERIOD_OPTIONS = [
  { value: '', label: 'Select notice period' },
  { value: 'immediate', label: 'Immediate / Serving notice' },
  { value: '15-days', label: '15 days' },
  { value: '30-days', label: '30 days' },
  { value: '60-days', label: '60 days' },
  { value: '90-days', label: '90 days' },
];

const COMMON_CITIES = ['Bengaluru', 'Remote', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai'];

const SALARY_PRESETS = [
  '₹6–10 LPA',
  '₹10–15 LPA',
  '₹15–25 LPA',
  '₹25–40 LPA',
  'Open to negotiation',
];

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

  const toggleOpportunityType = (type: OpportunityType) => {
    const isSelected = data.opportunityTypes.includes(type);
    const updated = isSelected
      ? data.opportunityTypes.filter((t) => t !== type)
      : [...data.opportunityTypes, type];
    onChange({ ...data, opportunityTypes: updated });
    if (errors.opportunityTypes && updated.length > 0) {
      setErrors((prev) => ({ ...prev, opportunityTypes: undefined }));
    }
  };

  const toggleWorkMode = (mode: WorkMode) => {
    const isSelected = data.workModes.includes(mode);
    const updated = isSelected
      ? data.workModes.filter((m) => m !== mode)
      : [...data.workModes, mode];
    onChange({ ...data, workModes: updated });
    if (errors.workModes && updated.length > 0) {
      setErrors((prev) => ({ ...prev, workModes: undefined }));
    }
  };

  const setAvailability = (val: Availability) => {
    onChange({ ...data, availability: val });
    if (errors.availability) {
      setErrors((prev) => ({ ...prev, availability: undefined }));
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
      errs.opportunityTypes = 'Select at least one opportunity type.';
    }
    if (data.workModes.length === 0) {
      errs.workModes = 'Select at least one work mode preference.';
    }
    if (!data.availability) {
      errs.availability = 'Please indicate your availability.';
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
        eyebrow="Step 4 of 5 · Work Preferences"
        heading="Where & how do you want to work?"
        subheading="Configure your opportunity and environment preferences so YOGYATA matches you with matching founders."
      />

      {/* ── CARD 1: Opportunity Types & Work Modes ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Opportunity & Work Modes</h2>
              <p className="ob-section-box-sub">Select all types of engagements you are open to</p>
            </div>
          </div>
          <span className="ob-pill-badge">Required</span>
        </div>

        {/* Opportunity Types Multi-Select Grid */}
        <div className="ob-field-group">
          <label className="ob-label">
            Opportunity types (select all that apply)
            <span className="ob-required-star" aria-hidden="true"> *</span>
          </label>
          <div className="ob-status-grid" role="group" aria-label="Opportunity types">
            {OPPORTUNITY_CARDS.map((item) => {
              const Icon = item.icon;
              const isActive = data.opportunityTypes.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  role="checkbox"
                  aria-checked={isActive}
                  className={`ob-status-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => toggleOpportunityType(item.value)}
                >
                  <div className="ob-status-card-top">
                    <div className="ob-status-card-icon" aria-hidden="true">
                      <Icon size={18} />
                    </div>
                    <div className="ob-status-check" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="ob-status-card-title">{item.title}</div>
                  <div className="ob-status-card-desc">{item.desc}</div>
                </button>
              );
            })}
          </div>
          {errors.opportunityTypes && (
            <p className="ob-field-error" role="alert">{errors.opportunityTypes}</p>
          )}
        </div>

        {/* Work Modes Multi-Select Grid */}
        <div className="ob-field-group" style={{ marginTop: '20px' }}>
          <label className="ob-label">
            Work mode preferences (select all that apply)
            <span className="ob-required-star" aria-hidden="true"> *</span>
          </label>
          <div className="ob-status-grid" role="group" aria-label="Work mode preferences">
            {WORK_MODE_CARDS.map((item) => {
              const Icon = item.icon;
              const isActive = data.workModes.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  role="checkbox"
                  aria-checked={isActive}
                  className={`ob-status-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => toggleWorkMode(item.value)}
                >
                  <div className="ob-status-card-top">
                    <div className="ob-status-card-icon" aria-hidden="true">
                      <Icon size={18} />
                    </div>
                    <div className="ob-status-check" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="ob-status-card-title">{item.title}</div>
                  <div className="ob-status-card-desc">{item.desc}</div>
                </button>
              );
            })}
          </div>
          {errors.workModes && (
            <p className="ob-field-error" role="alert">{errors.workModes}</p>
          )}
        </div>
      </div>

      {/* ── CARD 2: Availability & Joining Timeline ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Availability & Joining Timeline</h2>
              <p className="ob-section-box-sub">When can you start if matched with a startup role?</p>
            </div>
          </div>
          <span className="ob-pill-badge">Required</span>
        </div>

        <div className="ob-field-group">
          <label className="ob-label">
            When are you available to start?
            <span className="ob-required-star" aria-hidden="true"> *</span>
          </label>
          <div className="ob-status-grid" role="radiogroup" aria-label="Availability options">
            {AVAILABILITY_CARDS.map((item) => {
              const Icon = item.icon;
              const isActive = data.availability === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`ob-status-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => setAvailability(item.value)}
                >
                  <div className="ob-status-card-top">
                    <div className="ob-status-card-icon" aria-hidden="true">
                      <Icon size={18} />
                    </div>
                    <div className="ob-status-check" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>
                  <div className="ob-status-card-title">{item.title}</div>
                  <div className="ob-status-card-desc">{item.desc}</div>
                </button>
              );
            })}
          </div>
          {errors.availability && (
            <p className="ob-field-error" role="alert">{errors.availability}</p>
          )}
        </div>

        {isEmployed && (
          <div style={{ marginTop: '16px' }}>
            <FieldGroup
              label="Official notice period"
              htmlFor="pref-notice-period"
              hint="Current employer notice policy"
            >
              <div className="ob-input-icon-left">
                <span className="ob-field-left-icon" aria-hidden="true">
                  <Calendar size={17} />
                </span>
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
              </div>
            </FieldGroup>
          </div>
        )}
      </div>

      {/* ── CARD 3: Locations & Compensation ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Locations & Compensation</h2>
              <p className="ob-section-box-sub">Your preferred work locations and compensation expectation</p>
            </div>
          </div>
          <span className="ob-pill-badge">Optional</span>
        </div>

        <FieldGroup
          label="Preferred work locations (up to 5)"
          htmlFor="pref-location-input"
          hint="Cities or regions you are willing to work in or relocate to."
        >
          <div className="ob-inline-input-action">
            <div className="ob-input-icon-left" style={{ flex: 1 }}>
              <span className="ob-field-left-icon" aria-hidden="true">
                <MapPin size={17} />
              </span>
              <TextInput
                inputId="pref-location-input"
                type="text"
                placeholder="e.g. Bengaluru, Remote, Pune, Delhi NCR"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLocation(cityInput);
                  }
                }}
              />
            </div>
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

        <div className="ob-preset-group">
          <span className="ob-preset-label">Popular hubs:</span>
          {COMMON_CITIES.map((c) => {
            const isSelected = data.preferredLocations.some((l) => l.toLowerCase() === c.toLowerCase());
            return (
              <button
                key={c}
                type="button"
                className={`ob-preset-pill ${isSelected ? 'is-selected' : ''}`}
                disabled={isSelected}
                onClick={() => addLocation(c)}
              >
                + {c}
              </button>
            );
          })}
        </div>

        {data.preferredLocations.length > 0 && (
          <div className="ob-selected-roles-wrap" style={{ marginTop: '14px' }}>
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

        <div style={{ marginTop: '20px' }}>
          <FieldGroup
            label="Expected compensation / salary"
            htmlFor="pref-salary"
            hint="e.g. ₹12–15 LPA, $80,000/year, or Open to negotiation"
          >
            <div className="ob-input-icon-left">
              <span className="ob-field-left-icon" aria-hidden="true">
                <Sparkles size={17} />
              </span>
              <TextInput
                inputId="pref-salary"
                type="text"
                placeholder="e.g. ₹12–18 LPA or Negotiable"
                value={data.expectedSalary}
                onChange={(e) => onChange({ ...data, expectedSalary: e.target.value })}
              />
            </div>
          </FieldGroup>

          <div className="ob-preset-group" style={{ marginTop: '6px' }}>
            <span className="ob-preset-label">Quick select:</span>
            {SALARY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="ob-preset-pill"
                onClick={() => onChange({ ...data, expectedSalary: preset })}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
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
