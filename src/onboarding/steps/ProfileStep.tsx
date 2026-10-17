import React, { useState } from 'react';
import type { ProfessionalData, EducationData } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  FormNav, SectionDivider, CheckboxField,
} from '../shared';

// ─── Options ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'Select your current status' },
  { value: 'employed', label: 'Currently employed' },
  { value: 'actively-looking', label: 'Actively looking for a job' },
  { value: 'open-to-opportunities', label: 'Open to better opportunities' },
  { value: 'freelancer', label: 'Freelancer / independent professional' },
  { value: 'career-switcher', label: 'Career switcher' },
];

const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Select your experience level' },
  { value: 'fresher', label: 'Fresher / no professional experience' },
  { value: 'less-than-1', label: 'Less than 1 year' },
  { value: '1-2', label: '1–2 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '6-10', label: '6–10 years' },
  { value: 'more-than-10', label: 'More than 10 years' },
];

const EDUCATION_LEVEL_OPTIONS = [
  { value: '', label: 'Select your education level' },
  { value: 'high-school', label: 'High School / Secondary' },
  { value: 'diploma', label: 'Diploma / Certificate' },
  { value: 'associate', label: 'Associate Degree' },
  { value: 'bachelor', label: "Bachelor's Degree" },
  { value: 'master', label: "Master's Degree" },
  { value: 'phd', label: 'PhD / Doctorate' },
  { value: 'other', label: 'Other' },
];

const COUNTRY_OPTIONS = [
  { value: '', label: 'Select country' },
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'OTHER', label: 'Other' },
];

const GRAD_YEAR_OPTIONS = () => {
  const current = new Date().getFullYear();
  const years = [{ value: '', label: 'Select year' }];
  for (let y = current + 2; y >= 1970; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
};

// ─── Validation ───────────────────────────────────────────────────────────────

interface ProfErrors {
  status?: string;
  experience?: string;
  country?: string;
  city?: string;
}

interface EduErrors {
  level?: string;
}

interface ProfileStepProps {
  professional: ProfessionalData;
  education: EducationData;
  onChangeProfessional: (d: ProfessionalData) => void;
  onChangeEducation: (d: EducationData) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ProfileStep: React.FC<ProfileStepProps> = ({
  professional,
  education,
  onChangeProfessional,
  onChangeEducation,
  onNext,
  onBack,
}) => {
  const [profErrors, setProfErrors] = useState<ProfErrors>({});
  const [eduErrors, setEduErrors] = useState<EduErrors>({});

  const setProf = (field: keyof ProfessionalData, value: string) => {
    onChangeProfessional({ ...professional, [field]: value });
    if (profErrors[field as keyof ProfErrors]) {
      setProfErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const setEdu = (field: keyof EducationData, value: string | boolean) => {
    onChangeEducation({ ...education, [field]: value });
    if (field === 'level' && eduErrors.level) {
      setEduErrors({});
    }
  };

  const validate = (): boolean => {
    const pe: ProfErrors = {};
    if (!professional.status) pe.status = 'Please select your current status.';
    if (!professional.experience) pe.experience = 'Please select your experience level.';
    if (!professional.country) pe.country = 'Country is required.';
    if (!professional.city.trim()) pe.city = 'City is required.';
    setProfErrors(pe);

    const ee: EduErrors = {};
    if (!education.skipEducation && !education.level) {
      ee.level = 'Please select your highest education level, or skip education details.';
    }
    setEduErrors(ee);

    return Object.keys(pe).length === 0 && Object.keys(ee).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  const requiresCollege =
    education.level !== '' &&
    education.level !== 'high-school' &&
    education.level !== 'diploma' &&
    !education.skipEducation;

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Step 2 of 5 — Profile"
        heading="Tell us about your professional journey."
        subheading="Help us understand where you are today so we can personalise your career experience."
      />

      {/* ── Professional Information ── */}
      <SectionDivider title="Professional information" />

      <div className="ob-form">
        <FieldGroup
          label="Current professional status"
          htmlFor="prof-status"
          required
          error={profErrors.status}
        >
          <SelectInput
            inputId="prof-status"
            value={professional.status}
            onChange={(e) => setProf('status', e.target.value)}
            error={profErrors.status}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectInput>
        </FieldGroup>

        <FieldGroup
          label="Total work experience"
          htmlFor="prof-experience"
          required
          error={profErrors.experience}
        >
          <SelectInput
            inputId="prof-experience"
            value={professional.experience}
            onChange={(e) => setProf('experience', e.target.value)}
            error={profErrors.experience}
          >
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectInput>
        </FieldGroup>

        <div className="ob-form-row">
          <FieldGroup label="Current job title" htmlFor="prof-title">
            <TextInput
              inputId="prof-title"
              type="text"
              placeholder="e.g. Software Engineer"
              value={professional.currentTitle}
              onChange={(e) => setProf('currentTitle', e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Current company" htmlFor="prof-company">
            <TextInput
              inputId="prof-company"
              type="text"
              placeholder="e.g. Acme Corp"
              value={professional.currentCompany}
              onChange={(e) => setProf('currentCompany', e.target.value)}
            />
          </FieldGroup>
        </div>

        <FieldGroup
          label="Professional headline"
          htmlFor="prof-headline"
          hint="A short phrase that describes your professional identity. Optional."
        >
          <TextInput
            inputId="prof-headline"
            type="text"
            placeholder="e.g. Full-Stack Developer passionate about EdTech"
            value={professional.headline}
            onChange={(e) => setProf('headline', e.target.value)}
          />
        </FieldGroup>

        <div className="ob-form-row">
          <FieldGroup
            label="Country"
            htmlFor="prof-country"
            required
            error={profErrors.country}
          >
            <SelectInput
              inputId="prof-country"
              value={professional.country}
              onChange={(e) => setProf('country', e.target.value)}
              error={profErrors.country}
            >
              {COUNTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </SelectInput>
          </FieldGroup>

          <FieldGroup
            label="City"
            htmlFor="prof-city"
            required
            error={profErrors.city}
          >
            <TextInput
              inputId="prof-city"
              type="text"
              placeholder="e.g. Bengaluru"
              value={professional.city}
              onChange={(e) => setProf('city', e.target.value)}
              error={profErrors.city}
            />
          </FieldGroup>
        </div>
      </div>

      {/* ── Education Information ── */}
      <SectionDivider title="Education details" />

      <div className="ob-form">
        <CheckboxField
          id="edu-skip"
          checked={education.skipEducation}
          onChange={(v) => setEdu('skipEducation', v)}
          label="I don't have a traditional college degree / prefer to skip education details"
        />

        {!education.skipEducation && (
          <>
            <FieldGroup
              label="Highest education level"
              htmlFor="edu-level"
              required
              error={eduErrors.level}
            >
              <SelectInput
                inputId="edu-level"
                value={education.level}
                onChange={(e) => setEdu('level', e.target.value)}
                error={eduErrors.level}
              >
                {EDUCATION_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectInput>
            </FieldGroup>

            {education.level && (
              <>
                <div className="ob-form-row">
                  <FieldGroup label="Degree / qualification" htmlFor="edu-degree">
                    <TextInput
                      inputId="edu-degree"
                      type="text"
                      placeholder="e.g. B.Tech, BSc Computer Science"
                      value={education.degree}
                      onChange={(e) => setEdu('degree', e.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Field of study" htmlFor="edu-field">
                    <TextInput
                      inputId="edu-field"
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={education.fieldOfStudy}
                      onChange={(e) => setEdu('fieldOfStudy', e.target.value)}
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="Institution name" htmlFor="edu-institution">
                  <TextInput
                    inputId="edu-institution"
                    type="text"
                    placeholder="e.g. IIT Bombay"
                    value={education.institution}
                    onChange={(e) => setEdu('institution', e.target.value)}
                  />
                </FieldGroup>

                {requiresCollege && (
                  <FieldGroup label="Graduation year" htmlFor="edu-grad-year">
                    <SelectInput
                      inputId="edu-grad-year"
                      value={education.graduationYear}
                      onChange={(e) => setEdu('graduationYear', e.target.value)}
                    >
                      {GRAD_YEAR_OPTIONS().map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </SelectInput>
                  </FieldGroup>
                )}
              </>
            )}
          </>
        )}
      </div>

      <FormNav onBack={onBack} onNext={handleNext} nextId="profile-next-btn" />
    </StepWrapper>
  );
};
