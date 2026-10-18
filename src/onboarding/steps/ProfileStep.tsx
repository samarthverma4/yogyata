import React, { useState } from 'react';
import type { ProfessionalData, EducationData, ProfessionalStatus, ExperienceLevel } from '../types';
import {
  StepWrapper, StepHeader, FieldGroup, TextInput, SelectInput,
  FormNav,
} from '../shared';
import {
  Briefcase, Search, Sparkles, Rocket, RefreshCw,
  GraduationCap, Building2, Globe, MapPin, Check,
  Lightbulb, Clock, BookOpen,
} from 'lucide-react';

// ─── Status Cards Definition ──────────────────────────────────────────────────

interface StatusOption {
  value: ProfessionalStatus;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const STATUS_CARDS: StatusOption[] = [
  {
    value: 'actively-looking',
    title: 'Actively Looking',
    desc: 'Ready to interview & join immediately',
    icon: Search,
  },
  {
    value: 'employed',
    title: 'Currently Employed',
    desc: 'Working full-time or part-time',
    icon: Briefcase,
  },
  {
    value: 'open-to-opportunities',
    title: 'Open to Offers',
    desc: 'Casually exploring better opportunities',
    icon: Sparkles,
  },
  {
    value: 'freelancer',
    title: 'Freelancer / Indie',
    desc: 'Contract, consulting or gigs',
    icon: Rocket,
  },
  {
    value: 'career-switcher',
    title: 'Career Switcher',
    desc: 'Transitioning into tech or new field',
    icon: RefreshCw,
  },
];

// ─── Experience Levels ────────────────────────────────────────────────────────

interface ExperienceOption {
  value: ExperienceLevel;
  label: string;
  desc: string;
}

const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  { value: 'fresher', label: 'Fresher', desc: '0 yrs' },
  { value: 'less-than-1', label: '< 1 year', desc: 'Junior' },
  { value: '1-2', label: '1–2 years', desc: 'Early' },
  { value: '3-5', label: '3–5 years', desc: 'Mid-level' },
  { value: '6-10', label: '6–10 years', desc: 'Senior' },
  { value: 'more-than-10', label: '10+ years', desc: 'Lead / Staff' },
];

const PRESET_HEADLINES = [
  'Full-Stack Developer',
  'Frontend Engineer',
  'Backend Developer',
  'UI/UX Designer',
  'Data Analyst',
  'AI / ML Enthusiast',
];

const EDUCATION_LEVEL_OPTIONS = [
  { value: '', label: 'Select your education level' },
  { value: 'bachelor', label: "Bachelor's Degree (B.Tech, B.E., BSc, BCA, etc.)" },
  { value: 'master', label: "Master's Degree (M.Tech, MSc, MCA, MBA, etc.)" },
  { value: 'diploma', label: 'Diploma / Polytechnic' },
  { value: 'associate', label: 'Associate Degree' },
  { value: 'high-school', label: 'High School / Secondary' },
  { value: 'phd', label: 'PhD / Doctorate' },
  { value: 'other', label: 'Other qualification' },
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
  const years = [{ value: '', label: 'Select graduation year' }];
  for (let y = current + 2; y >= 1970; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
};

// ─── Validation Interfaces ────────────────────────────────────────────────────

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
    if (!professional.status) pe.status = 'Please choose your current status above.';
    if (!professional.experience) pe.experience = 'Please select your experience level above.';
    if (!professional.country) pe.country = 'Country is required.';
    if (!professional.city.trim()) pe.city = 'City is required.';
    setProfErrors(pe);

    const ee: EduErrors = {};
    if (!education.skipEducation && !education.level) {
      ee.level = 'Please select your highest education level, or choose the skills-first option.';
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
        eyebrow="Step 2 of 5 · Profile Setup"
        heading="Tell us about your professional journey."
        subheading="Help us personalise your verified skill challenges, founder tasks, and mentorship recommendations."
      />

      {/* ── CARD 1: Professional Status & Experience ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Professional Experience</h2>
              <p className="ob-section-box-sub">Select your current stage and working background</p>
            </div>
          </div>
          <span className="ob-pill-badge">Required</span>
        </div>

        {/* Interactive Role Status Cards */}
        <div className="ob-field-group">
          <label className="ob-label">
            Current professional status
            <span className="ob-required-star" aria-hidden="true"> *</span>
          </label>
          <div className="ob-status-grid" role="radiogroup" aria-label="Current professional status">
            {STATUS_CARDS.map((item) => {
              const Icon = item.icon;
              const isActive = professional.status === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`ob-status-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => setProf('status', item.value)}
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
          {profErrors.status && (
            <p className="ob-field-error" role="alert">{profErrors.status}</p>
          )}
        </div>

        {/* Interactive Experience Level Pills */}
        <div className="ob-field-group" style={{ marginTop: '22px' }}>
          <label className="ob-label">
            Total work experience
            <span className="ob-required-star" aria-hidden="true"> *</span>
          </label>
          <div className="ob-exp-list" role="radiogroup" aria-label="Total work experience">
            {EXPERIENCE_OPTIONS.map((exp) => {
              const isActive = professional.experience === exp.value;
              return (
                <button
                  key={exp.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`ob-exp-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => setProf('experience', exp.value)}
                >
                  <span className="ob-exp-dot" aria-hidden="true" />
                  <span>{exp.label}</span>
                </button>
              );
            })}
          </div>
          {profErrors.experience && (
            <p className="ob-field-error" role="alert">{profErrors.experience}</p>
          )}
        </div>
      </div>

      {/* ── CARD 2: Role Details & Location ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Role & Location Details</h2>
              <p className="ob-section-box-sub">Where you work and what describes you best</p>
            </div>
          </div>
        </div>

        <div className="ob-form" style={{ marginTop: '0' }}>
          <div className="ob-form-row">
            <FieldGroup label="Current job title" htmlFor="prof-title" hint="Optional if currently seeking">
              <div className="ob-input-icon-left">
                <span className="ob-field-left-icon" aria-hidden="true">
                  <Briefcase size={17} />
                </span>
                <TextInput
                  inputId="prof-title"
                  type="text"
                  placeholder="e.g. Software Engineer"
                  value={professional.currentTitle}
                  onChange={(e) => setProf('currentTitle', e.target.value)}
                />
              </div>
            </FieldGroup>

            <FieldGroup label="Current company" htmlFor="prof-company" hint="Optional if student or freelancer">
              <div className="ob-input-icon-left">
                <span className="ob-field-left-icon" aria-hidden="true">
                  <Building2 size={17} />
                </span>
                <TextInput
                  inputId="prof-company"
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={professional.currentCompany}
                  onChange={(e) => setProf('currentCompany', e.target.value)}
                />
              </div>
            </FieldGroup>
          </div>

          <FieldGroup
            label="Professional headline"
            htmlFor="prof-headline"
            hint="A concise one-liner shown on your Skill Passport"
          >
            <div className="ob-input-icon-left">
              <span className="ob-field-left-icon" aria-hidden="true">
                <Sparkles size={17} />
              </span>
              <TextInput
                inputId="prof-headline"
                type="text"
                placeholder="e.g. Full-Stack Developer passionate about scalable web apps"
                value={professional.headline}
                onChange={(e) => setProf('headline', e.target.value)}
              />
            </div>
            {/* Quick Suggestion Chips */}
            <div className="ob-preset-group">
              <span className="ob-preset-label">Quick suggestions:</span>
              {PRESET_HEADLINES.map((h) => (
                <button
                  key={h}
                  type="button"
                  className="ob-preset-pill"
                  onClick={() => setProf('headline', h)}
                >
                  + {h}
                </button>
              ))}
            </div>
          </FieldGroup>

          <div className="ob-form-row">
            <FieldGroup
              label="Country"
              htmlFor="prof-country"
              required
              error={profErrors.country}
            >
              <div className="ob-input-icon-left">
                <span className="ob-field-left-icon" aria-hidden="true">
                  <Globe size={17} />
                </span>
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
              </div>
            </FieldGroup>

            <FieldGroup
              label="City"
              htmlFor="prof-city"
              required
              error={profErrors.city}
            >
              <div className="ob-input-icon-left">
                <span className="ob-field-left-icon" aria-hidden="true">
                  <MapPin size={17} />
                </span>
                <TextInput
                  inputId="prof-city"
                  type="text"
                  placeholder="e.g. Bengaluru, Delhi, Mumbai"
                  value={professional.city}
                  onChange={(e) => setProf('city', e.target.value)}
                  error={profErrors.city}
                />
              </div>
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* ── CARD 3: Education & Pathway ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Education & Background</h2>
              <p className="ob-section-box-sub">Choose formal degree or skills-first evaluation</p>
            </div>
          </div>
        </div>

        {/* Pathway Selection: Formal Degree vs Skills-First */}
        <div className="ob-edu-toggle-grid">
          <button
            type="button"
            className={`ob-edu-choice-card ${!education.skipEducation ? 'is-active' : ''}`}
            onClick={() => setEdu('skipEducation', false)}
          >
            <div className="ob-status-card-icon" style={{ background: !education.skipEducation ? '#3559DF' : undefined, color: !education.skipEducation ? '#fff' : undefined }}>
              <GraduationCap size={20} />
            </div>
            <div>
              <div className="ob-edu-choice-title">College / Degree</div>
              <div className="ob-edu-choice-desc">Add my academic degree and university info</div>
            </div>
          </button>

          <button
            type="button"
            className={`ob-edu-choice-card ${education.skipEducation ? 'is-active' : ''}`}
            onClick={() => setEdu('skipEducation', true)}
          >
            <div className="ob-status-card-icon" style={{ background: education.skipEducation ? '#3559DF' : undefined, color: education.skipEducation ? '#fff' : undefined }}>
              <Lightbulb size={20} />
            </div>
            <div>
              <div className="ob-edu-choice-title">Skills-First / Self-Taught</div>
              <div className="ob-edu-choice-desc">Skip degree; assess me solely by my skills</div>
            </div>
          </button>
        </div>

        {education.skipEducation ? (
          <div className="ob-skills-first-banner">
            <div className="ob-skills-first-banner-icon" aria-hidden="true">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="ob-skills-first-title">Skills speak louder than degrees!</div>
              <p className="ob-skills-first-text">
                On Yogyata, founders and hiring managers assess real project submissions and your verified Skill Passport. You do not need a traditional degree to stand out and get hired.
              </p>
            </div>
          </div>
        ) : (
          <div className="ob-form" style={{ marginTop: '16px' }}>
            <FieldGroup
              label="Highest education level"
              htmlFor="edu-level"
              required
              error={eduErrors.level}
            >
              <div className="ob-input-icon-left">
                <span className="ob-field-left-icon" aria-hidden="true">
                  <GraduationCap size={17} />
                </span>
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
              </div>
            </FieldGroup>

            {education.level && (
              <>
                <div className="ob-form-row">
                  <FieldGroup label="Degree / qualification" htmlFor="edu-degree">
                    <div className="ob-input-icon-left">
                      <span className="ob-field-left-icon" aria-hidden="true">
                        <BookOpen size={17} />
                      </span>
                      <TextInput
                        inputId="edu-degree"
                        type="text"
                        placeholder="e.g. B.Tech Computer Science, BCA"
                        value={education.degree}
                        onChange={(e) => setEdu('degree', e.target.value)}
                      />
                    </div>
                  </FieldGroup>

                  <FieldGroup label="Field of study" htmlFor="edu-field">
                    <div className="ob-input-icon-left">
                      <span className="ob-field-left-icon" aria-hidden="true">
                        <BookOpen size={17} />
                      </span>
                      <TextInput
                        inputId="edu-field"
                        type="text"
                        placeholder="e.g. Information Technology"
                        value={education.fieldOfStudy}
                        onChange={(e) => setEdu('fieldOfStudy', e.target.value)}
                      />
                    </div>
                  </FieldGroup>
                </div>

                <div className="ob-form-row">
                  <FieldGroup label="Institution / University name" htmlFor="edu-institution">
                    <div className="ob-input-icon-left">
                      <span className="ob-field-left-icon" aria-hidden="true">
                        <Building2 size={17} />
                      </span>
                      <TextInput
                        inputId="edu-institution"
                        type="text"
                        placeholder="e.g. Delhi University, IIT, BITS"
                        value={education.institution}
                        onChange={(e) => setEdu('institution', e.target.value)}
                      />
                    </div>
                  </FieldGroup>

                  {requiresCollege && (
                    <FieldGroup label="Graduation year" htmlFor="edu-grad-year">
                      <div className="ob-input-icon-left">
                        <span className="ob-field-left-icon" aria-hidden="true">
                          <Clock size={17} />
                        </span>
                        <SelectInput
                          inputId="edu-grad-year"
                          value={education.graduationYear}
                          onChange={(e) => setEdu('graduationYear', e.target.value)}
                        >
                          {GRAD_YEAR_OPTIONS().map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </SelectInput>
                      </div>
                    </FieldGroup>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <FormNav onBack={onBack} onNext={handleNext} nextId="profile-next-btn" />
    </StepWrapper>
  );
};
