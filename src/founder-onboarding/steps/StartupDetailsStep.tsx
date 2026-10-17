import React, { useRef, useState } from 'react';
import type { StartupProfile, StartupStage, TeamSize, FounderWorkMode } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  TextAreaInput, FormNav, SectionDivider, InfoNotice,
} from '../../onboarding/shared';
import { Building2, Upload, X } from 'lucide-react';

const INDUSTRY_OPTIONS = [
  { value: '', label: 'Select your industry' },
  { value: 'AI / Machine Learning', label: 'AI / Machine Learning' },
  { value: 'Software / SaaS', label: 'Software / SaaS' },
  { value: 'FinTech', label: 'FinTech' },
  { value: 'HealthTech', label: 'HealthTech' },
  { value: 'EdTech', label: 'EdTech' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'ClimateTech', label: 'ClimateTech' },
  { value: 'Social Impact', label: 'Social Impact' },
  { value: 'Consumer Products', label: 'Consumer Products' },
  { value: 'Other', label: 'Other (specify below)' },
];

const STAGE_OPTIONS: { value: StartupStage; label: string }[] = [
  { value: '', label: 'Select current venture stage' },
  { value: 'Idea Stage', label: 'Idea Stage (Validating concept)' },
  { value: 'Pre-seed', label: 'Pre-seed (Building prototype / MVP)' },
  { value: 'Seed', label: 'Seed (Early traction / active fundraising)' },
  { value: 'Early-stage', label: 'Early-stage (Product-market fit)' },
  { value: 'Growing Business', label: 'Growing Business (Scaling operations)' },
  { value: 'Other', label: 'Other' },
];

const TEAM_SIZE_OPTIONS: { value: TeamSize; label: string }[] = [
  { value: '', label: 'Select team size' },
  { value: 'Just me', label: 'Solo founder (Just me)' },
  { value: '2–5', label: '2–5 members' },
  { value: '6–10', label: '6–10 members' },
  { value: '11–25', label: '11–25 members' },
  { value: '26+', label: '26+ members' },
];

const WORK_MODE_OPTIONS: { value: FounderWorkMode; label: string }[] = [
  { value: '', label: 'Select team work mode' },
  { value: 'remote', label: 'Remote-first / Distributed' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on-site', label: 'On-site / Office-based' },
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'Select country' },
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'DE', label: 'Germany' },
  { value: 'AU', label: 'Australia' },
  { value: 'OTHER', label: 'Other' },
];

function isValidUrl(val: string): boolean {
  try {
    const url = new URL(val.startsWith('http') ? val : `https://${val}`);
    return url.hostname.length > 3;
  } catch {
    return false;
  }
}

interface StartupDetailsStepProps {
  data: StartupProfile;
  onChange: (d: StartupProfile) => void;
  onNext: () => void;
  onBack: () => void;
  isEditingFromReview?: boolean;
  onReturnToReview?: () => void;
}

interface Errors {
  startupName?: string;
  industry?: string;
  customIndustry?: string;
  websiteUrl?: string;
  description?: string;
  stage?: string;
  teamSize?: string;
  country?: string;
  city?: string;
  workMode?: string;
  logo?: string;
}

export const StartupDetailsStep: React.FC<StartupDetailsStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
  isEditingFromReview,
  onReturnToReview,
}) => {
  const [errors, setErrors] = useState<Errors>({});
  const logoInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof StartupProfile, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, logo: 'Please select an image file (PNG, JPG, or SVG).' }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, logo: 'Logo must be under 2MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({
        ...data,
        logoName: file.name,
        logoUrl: event.target?.result as string,
      });
      setErrors((prev) => ({ ...prev, logo: undefined }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeLogo = () => {
    onChange({
      ...data,
      logoName: '',
      logoUrl: '',
    });
    setErrors((prev) => ({ ...prev, logo: undefined }));
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    if (!data.startupName.trim()) errs.startupName = 'Startup or venture name is required.';
    if (!data.industry) errs.industry = 'Industry selection is required.';
    if (data.industry === 'Other' && !data.customIndustry?.trim()) {
      errs.customIndustry = 'Please specify your industry.';
    }
    if (!data.description.trim()) {
      errs.description = 'Please describe what your venture does and the problem it solves.';
    }
    if (!data.stage) errs.stage = 'Please select your startup stage.';
    if (!data.teamSize) errs.teamSize = 'Please select your current team size.';
    if (!data.country) errs.country = 'Country is required.';
    if (!data.city.trim()) errs.city = 'City is required.';
    if (!data.workMode) errs.workMode = 'Work mode preference is required.';

    if (data.websiteUrl && data.websiteUrl.trim()) {
      if (!isValidUrl(data.websiteUrl)) {
        errs.websiteUrl = 'Please enter a valid website URL.';
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
        eyebrow="Stage 3 of 6 — Venture Profile"
        heading="Tell us about your venture."
        subheading="Help contributors understand what problem you are solving and where you are on your journey."
      />

      <InfoNotice variant="info">
        <strong>Idea Stage Welcome:</strong> Formal company registration documents are not required. Founders validating early concepts are fully welcomed to participate.
      </InfoNotice>

      <div className="ob-form">
        <SectionDivider title="Venture Identity" />

        {/* Logo Upload */}
        <div className="founder-photo-row">
          <div className="founder-logo-preview" aria-hidden="true">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="Startup Logo Preview" className="founder-logo-img" />
            ) : (
              <Building2 size={28} className="founder-avatar-placeholder-icon" />
            )}
          </div>
          <div className="founder-photo-actions">
            <span className="ob-label">Startup logo (optional)</span>
            <p className="ob-field-hint">Square format recommended · PNG, JPG or SVG · Max 2MB</p>
            <div className="founder-photo-btns">
              <button
                type="button"
                className="ob-btn-secondary founder-upload-btn"
                onClick={() => logoInputRef.current?.click()}
                id="startup-upload-logo-btn"
              >
                <Upload size={14} aria-hidden="true" />
                <span>{data.logoUrl ? 'Change logo' : 'Upload logo'}</span>
              </button>
              {data.logoUrl && (
                <button
                  type="button"
                  className="ob-btn-secondary founder-remove-btn"
                  onClick={removeLogo}
                  id="startup-remove-logo-btn"
                  aria-label="Remove uploaded logo"
                >
                  <X size={14} aria-hidden="true" />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="ob-file-input-hidden"
              onChange={handleLogoSelect}
              tabIndex={-1}
            />
            {errors.logo && <p className="ob-field-error" role="alert">{errors.logo}</p>}
          </div>
        </div>

        {/* Startup Name */}
        <FieldGroup
          label="Startup / Venture name"
          htmlFor="startup-name"
          required
          error={errors.startupName}
        >
          <TextInput
            inputId="startup-name"
            type="text"
            placeholder="e.g. NexusFlow AI"
            value={data.startupName}
            onChange={(e) => set('startupName', e.target.value)}
            error={errors.startupName}
          />
        </FieldGroup>

        {/* Industry */}
        <FieldGroup
          label="Industry"
          htmlFor="startup-industry"
          required
          error={errors.industry}
        >
          <SelectInput
            inputId="startup-industry"
            value={data.industry}
            onChange={(e) => set('industry', e.target.value)}
            error={errors.industry}
          >
            {INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectInput>
        </FieldGroup>

        {data.industry === 'Other' && (
          <FieldGroup
            label="Specify industry"
            htmlFor="startup-custom-industry"
            required
            error={errors.customIndustry}
          >
            <TextInput
              inputId="startup-custom-industry"
              type="text"
              placeholder="e.g. BioTech & Genomics"
              value={data.customIndustry || ''}
              onChange={(e) => set('customIndustry', e.target.value)}
              error={errors.customIndustry}
            />
          </FieldGroup>
        )}

        {/* Website */}
        <FieldGroup
          label="Website URL (optional)"
          htmlFor="startup-website"
          hint="If you already have a landing page or product demo."
          error={errors.websiteUrl}
        >
          <TextInput
            inputId="startup-website"
            type="url"
            placeholder="https://nexusflow.ai"
            value={data.websiteUrl || ''}
            onChange={(e) => set('websiteUrl', e.target.value)}
            error={errors.websiteUrl}
          />
        </FieldGroup>

        {/* Description */}
        <FieldGroup
          label="Startup description"
          htmlFor="startup-desc"
          required
          hint="Explain what your venture does, the core problem it solves, and who it serves."
          error={errors.description}
        >
          <TextAreaInput
            inputId="startup-desc"
            rows={4}
            placeholder="e.g. NexusFlow is building AI-powered incident management tooling for mid-market engineering teams. We reduce system downtime by triaging logs into actionable pull requests."
            value={data.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={600}
            currentLength={data.description.length}
            error={errors.description}
          />
        </FieldGroup>

        <SectionDivider title="Operations & Team" />

        <div className="ob-form-row">
          {/* Stage */}
          <FieldGroup
            label="Current venture stage"
            htmlFor="startup-stage"
            required
            error={errors.stage}
          >
            <SelectInput
              inputId="startup-stage"
              value={data.stage}
              onChange={(e) => set('stage', e.target.value as StartupStage)}
              error={errors.stage}
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </SelectInput>
          </FieldGroup>

          {/* Team Size */}
          <FieldGroup
            label="Current team size"
            htmlFor="startup-teamsize"
            required
            error={errors.teamSize}
          >
            <SelectInput
              inputId="startup-teamsize"
              value={data.teamSize}
              onChange={(e) => set('teamSize', e.target.value as TeamSize)}
              error={errors.teamSize}
            >
              {TEAM_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </SelectInput>
          </FieldGroup>
        </div>

        {/* Location & Work Mode */}
        <div className="ob-form-row">
          <FieldGroup
            label="Country"
            htmlFor="startup-country"
            required
            error={errors.country}
          >
            <SelectInput
              inputId="startup-country"
              value={data.country}
              onChange={(e) => set('country', e.target.value)}
              error={errors.country}
            >
              {COUNTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </SelectInput>
          </FieldGroup>

          <FieldGroup
            label="City"
            htmlFor="startup-city"
            required
            error={errors.city}
          >
            <TextInput
              inputId="startup-city"
              type="text"
              placeholder="e.g. Austin or Bengaluru"
              value={data.city}
              onChange={(e) => set('city', e.target.value)}
              error={errors.city}
            />
          </FieldGroup>
        </div>

        <FieldGroup
          label="Work arrangement mode"
          htmlFor="startup-workmode"
          required
          error={errors.workMode}
        >
          <SelectInput
            inputId="startup-workmode"
            value={data.workMode}
            onChange={(e) => set('workMode', e.target.value as FounderWorkMode)}
            error={errors.workMode}
          >
            {WORK_MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectInput>
        </FieldGroup>
      </div>

      <FormNav
        onBack={onBack}
        onNext={handleNext}
        nextLabel={isEditingFromReview ? 'Save & Return to Review' : 'Continue to Business Goals'}
        nextId="startup-next-btn"
      />
    </StepWrapper>
  );
};
