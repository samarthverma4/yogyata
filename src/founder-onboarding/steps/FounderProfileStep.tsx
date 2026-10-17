import React, { useRef, useState } from 'react';
import type { FounderProfile } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  TextAreaInput, FormNav, SectionDivider, InfoNotice,
} from '../../onboarding/shared';
import { User, Upload, X } from 'lucide-react';

const TITLE_SUGGESTIONS = [
  'Founder',
  'Co-Founder',
  'Founder & CEO',
  'Technical Co-Founder',
  'Entrepreneur',
  'Business Owner',
  'Startup Operator',
  'Managing Director',
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

interface FounderProfileStepProps {
  data: FounderProfile;
  onChange: (d: FounderProfile) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Errors {
  fullName?: string;
  professionalTitle?: string;
  country?: string;
  city?: string;
  linkedInUrl?: string;
  photo?: string;
}

export const FounderProfileStep: React.FC<FounderProfileStepProps> = ({
  data,
  onChange,
  onNext,
  onBack,
}) => {
  const [errors, setErrors] = useState<Errors>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof FounderProfile, value: string) => {
    onChange({ ...data, [field]: value });
    if (errors[field as keyof Errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: 'Please select an image file (PNG, JPG, or WEBP).' }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: 'Profile photo must be under 2MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({
        ...data,
        profilePhotoName: file.name,
        profilePhotoUrl: event.target?.result as string,
      });
      setErrors((prev) => ({ ...prev, photo: undefined }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removePhoto = () => {
    onChange({
      ...data,
      profilePhotoName: '',
      profilePhotoUrl: '',
    });
    setErrors((prev) => ({ ...prev, photo: undefined }));
  };

  const validate = (): boolean => {
    const errs: Errors = {};
    if (!data.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!data.professionalTitle.trim()) errs.professionalTitle = 'Professional title is required.';
    if (!data.country) errs.country = 'Country is required.';
    if (!data.city.trim()) errs.city = 'City is required.';

    if (data.linkedInUrl && data.linkedInUrl.trim()) {
      if (!isValidUrl(data.linkedInUrl)) {
        errs.linkedInUrl = 'Please enter a valid LinkedIn URL.';
      }
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
        eyebrow="Stage 2 of 6 — Founder Profile"
        heading="Tell us about yourself."
        subheading="Introduce yourself and the experience you bring to your venture."
      />

      <InfoNotice variant="info">
        <strong>Founder Identity:</strong> Your founder profile represents your personal professional background, separate from your startup or venture details.
      </InfoNotice>

      <div className="ob-form">
        <SectionDivider title="Personal Information" />

        {/* Profile Photo Upload */}
        <div className="founder-photo-row">
          <div className="founder-avatar-preview" aria-hidden="true">
            {data.profilePhotoUrl ? (
              <img src={data.profilePhotoUrl} alt="Founder preview" className="founder-avatar-img" />
            ) : (
              <User size={32} className="founder-avatar-placeholder-icon" />
            )}
          </div>
          <div className="founder-photo-actions">
            <span className="ob-label">Profile photo (optional)</span>
            <p className="ob-field-hint">PNG, JPG or WEBP · Max 2MB</p>
            <div className="founder-photo-btns">
              <button
                type="button"
                className="ob-btn-secondary founder-upload-btn"
                onClick={() => photoInputRef.current?.click()}
                id="founder-upload-photo-btn"
              >
                <Upload size={14} aria-hidden="true" />
                <span>{data.profilePhotoUrl ? 'Change photo' : 'Upload photo'}</span>
              </button>
              {data.profilePhotoUrl && (
                <button
                  type="button"
                  className="ob-btn-secondary founder-remove-btn"
                  onClick={removePhoto}
                  id="founder-remove-photo-btn"
                  aria-label="Remove uploaded photo"
                >
                  <X size={14} aria-hidden="true" />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="ob-file-input-hidden"
              onChange={handlePhotoSelect}
              tabIndex={-1}
            />
            {errors.photo && <p className="ob-field-error" role="alert">{errors.photo}</p>}
          </div>
        </div>

        {/* Full Name */}
        <FieldGroup
          label="Full name"
          htmlFor="founder-profile-name"
          required
          error={errors.fullName}
        >
          <TextInput
            inputId="founder-profile-name"
            type="text"
            placeholder="Maya Chen"
            value={data.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            error={errors.fullName}
          />
        </FieldGroup>

        {/* Professional Title */}
        <FieldGroup
          label="Professional title"
          htmlFor="founder-profile-title"
          required
          hint="e.g. Founder, Co-Founder, Entrepreneur, Business Owner, Startup Operator"
          error={errors.professionalTitle}
        >
          <TextInput
            inputId="founder-profile-title"
            type="text"
            placeholder="e.g. Founder & CEO"
            value={data.professionalTitle}
            onChange={(e) => set('professionalTitle', e.target.value)}
            error={errors.professionalTitle}
          />
          {/* Quick suggestions */}
          <div className="ob-suggested-chips" style={{ marginTop: '6px' }}>
            {TITLE_SUGGESTIONS.map((title) => (
              <button
                key={title}
                type="button"
                className={`ob-suggestion-chip ${data.professionalTitle === title ? 'is-selected' : ''}`}
                onClick={() => set('professionalTitle', title)}
              >
                {title}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Professional Bio */}
        <FieldGroup
          label="Professional bio (optional)"
          htmlFor="founder-profile-bio"
          hint="A brief summary of your track record, background, and passion (up to 400 characters)."
        >
          <TextAreaInput
            inputId="founder-profile-bio"
            rows={3}
            placeholder="e.g. Serial entrepreneur with 8 years in SaaS engineering. Passionate about AI workflow automation and developer tooling."
            value={data.bio || ''}
            onChange={(e) => set('bio', e.target.value)}
            maxLength={400}
            currentLength={(data.bio || '').length}
          />
        </FieldGroup>

        {/* LinkedIn Profile */}
        <FieldGroup
          label="LinkedIn profile URL (optional)"
          htmlFor="founder-profile-linkedin"
          hint="Helps prospective contributors and advisors verify your background."
          error={errors.linkedInUrl}
        >
          <TextInput
            inputId="founder-profile-linkedin"
            type="url"
            placeholder="https://linkedin.com/in/mayachen"
            value={data.linkedInUrl || ''}
            onChange={(e) => set('linkedInUrl', e.target.value)}
            error={errors.linkedInUrl}
          />
        </FieldGroup>

        {/* Location Row */}
        <div className="ob-form-row">
          <FieldGroup
            label="Country"
            htmlFor="founder-profile-country"
            required
            error={errors.country}
          >
            <SelectInput
              inputId="founder-profile-country"
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
            htmlFor="founder-profile-city"
            required
            error={errors.city}
          >
            <TextInput
              inputId="founder-profile-city"
              type="text"
              placeholder="e.g. San Francisco or Bengaluru"
              value={data.city}
              onChange={(e) => set('city', e.target.value)}
              error={errors.city}
            />
          </FieldGroup>
        </div>
      </div>

      <FormNav
        onBack={onBack}
        onNext={handleNext}
        nextLabel="Continue to Startup Details"
        nextId="founder-profile-next-btn"
      />
    </StepWrapper>
  );
};
