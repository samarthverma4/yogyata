import React from 'react';
import type { OnboardingState, OnboardingView, PrivacyData } from '../types';
import {
  StepWrapper, StepHeader, FormNav, InfoNotice, CheckboxField,
} from '../shared';
import {
  User, Briefcase, GraduationCap, FileText, Target,
  Compass, Shield, Edit3, Lock, Eye,
} from 'lucide-react';

interface ReviewStepProps {
  state: OnboardingState;
  onEdit: (target: OnboardingView) => void;
  onComplete: () => void;
  onBack: () => void;
  onChangePrivacy: (d: PrivacyData) => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  state,
  onEdit,
  onComplete,
  onBack,
  onChangePrivacy,
}) => {
  const { account, professional, education, resumeSkills, careerGoals, jobPrefs, privacy } = state;

  const setPrivacyField = <K extends keyof PrivacyData>(key: K, val: PrivacyData[K]) => {
    onChangePrivacy({ ...privacy, [key]: val });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const primaryRoleDisplay =
    careerGoals.primaryRole === 'other'
      ? careerGoals.customPrimaryRole || 'Other'
      : careerGoals.primaryRole || 'Not specified';

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Step 5 of 5 — Review & Visibility"
        heading="Review your profile & set privacy."
        subheading="Verify your information below and select your visibility preferences. You can update any section now or later from your dashboard."
      />

      <InfoNotice variant="info">
        <strong>Security & Transparency:</strong> Your password and sensitive credentials
        are encrypted and never shown. No data is sent to external servers in this prototype.
      </InfoNotice>

      <div className="ob-review-cards">
        {/* 1. Account Details */}
        <section className="ob-review-card" aria-labelledby="rev-account-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <User size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-account-title">Account details</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('signup')}
              aria-label="Edit account details"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            <div className="ob-review-item">
              <span className="ob-review-label">Full Name</span>
              <span className="ob-review-val">{account.fullName || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Email</span>
              <span className="ob-review-val">{account.email || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Password</span>
              <span className="ob-review-val ob-review-val-muted">•••••••••••• (Encrypted)</span>
            </div>
          </div>
        </section>

        {/* 2. Professional Profile */}
        <section className="ob-review-card" aria-labelledby="rev-prof-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Briefcase size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-prof-title">Professional profile</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('profile')}
              aria-label="Edit professional profile"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            <div className="ob-review-item">
              <span className="ob-review-label">Status</span>
              <span className="ob-review-val">{professional.status || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Experience</span>
              <span className="ob-review-val">{professional.experience || '—'}</span>
            </div>
            {(professional.currentTitle || professional.currentCompany) && (
              <div className="ob-review-item">
                <span className="ob-review-label">Current Role</span>
                <span className="ob-review-val">
                  {professional.currentTitle}
                  {professional.currentCompany ? ` at ${professional.currentCompany}` : ''}
                </span>
              </div>
            )}
            {professional.headline && (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Headline</span>
                <span className="ob-review-val">{professional.headline}</span>
              </div>
            )}
            <div className="ob-review-item">
              <span className="ob-review-label">Location</span>
              <span className="ob-review-val">
                {professional.city ? `${professional.city}, ` : ''}{professional.country || '—'}
              </span>
            </div>
          </div>
        </section>

        {/* 3. Education Details */}
        <section className="ob-review-card" aria-labelledby="rev-edu-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <GraduationCap size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-edu-title">Education</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('profile')}
              aria-label="Edit education details"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            {education.skipEducation ? (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-val ob-review-val-muted">
                  Education details skipped (non-traditional / self-taught pathway).
                </span>
              </div>
            ) : (
              <>
                <div className="ob-review-item">
                  <span className="ob-review-label">Education Level</span>
                  <span className="ob-review-val">{education.level || '—'}</span>
                </div>
                {education.degree && (
                  <div className="ob-review-item">
                    <span className="ob-review-label">Degree / Field</span>
                    <span className="ob-review-val">
                      {education.degree}
                      {education.fieldOfStudy ? ` in ${education.fieldOfStudy}` : ''}
                    </span>
                  </div>
                )}
                {education.institution && (
                  <div className="ob-review-item">
                    <span className="ob-review-label">Institution</span>
                    <span className="ob-review-val">{education.institution}</span>
                  </div>
                )}
                {education.graduationYear && (
                  <div className="ob-review-item">
                    <span className="ob-review-label">Graduation Year</span>
                    <span className="ob-review-val">{education.graduationYear}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* 4. Resume & Skills */}
        <section className="ob-review-card" aria-labelledby="rev-skills-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <FileText size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-skills-title">Resume & Declared skills</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('resume-skills')}
              aria-label="Edit resume and declared skills"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>

          <div className="ob-review-subblock">
            <span className="ob-review-label">Uploaded Resume:</span>
            {resumeSkills.resumeFile ? (
              <span className="ob-review-file-badge">
                <FileText size={14} aria-hidden="true" />
                {resumeSkills.resumeFile.name} ({formatFileSize(resumeSkills.resumeFile.sizeBytes)})
              </span>
            ) : (
              <span className="ob-review-val-muted">No resume uploaded (manual entry)</span>
            )}
          </div>

          <div className="ob-review-subblock">
            <span className="ob-review-label">Declared Skills ({resumeSkills.skills.length}):</span>
            {resumeSkills.skills.length === 0 ? (
              <p className="ob-review-val-muted">No skills added yet. You can add them anytime.</p>
            ) : (
              <div className="ob-review-skills-chips">
                {resumeSkills.skills.map((s) => (
                  <span key={s.id} className="ob-review-skill-chip">
                    <span className="ob-skill-badge-declared">DECLARED</span>
                    <span className="ob-review-skill-name">{s.name}</span>
                    <span className="ob-review-skill-cat">{s.category}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 5. Career Goals */}
        <section className="ob-review-card" aria-labelledby="rev-goals-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Target size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-goals-title">Target roles</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('career-goals')}
              aria-label="Edit career goals"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            <div className="ob-review-item">
              <span className="ob-review-label">Primary Target Role</span>
              <span className="ob-review-val ob-review-val-highlight">{primaryRoleDisplay}</span>
            </div>
            {careerGoals.additionalRoles.length > 0 && (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Secondary Target Roles</span>
                <div className="ob-review-tags-wrap">
                  {careerGoals.additionalRoles.map((role) => (
                    <span key={role} className="ob-review-tag">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 6. Work Preferences */}
        <section className="ob-review-card" aria-labelledby="rev-prefs-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Compass size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-prefs-title">Work preferences</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('job-prefs')}
              aria-label="Edit work preferences"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            <div className="ob-review-item">
              <span className="ob-review-label">Opportunity Types</span>
              <span className="ob-review-val">
                {jobPrefs.opportunityTypes.length > 0
                  ? jobPrefs.opportunityTypes.join(', ')
                  : 'Not specified'}
              </span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Work Modes</span>
              <span className="ob-review-val">
                {jobPrefs.workModes.length > 0
                  ? jobPrefs.workModes.join(', ')
                  : 'Not specified'}
              </span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Availability</span>
              <span className="ob-review-val">{jobPrefs.availability || 'Not specified'}</span>
            </div>
            {jobPrefs.noticePeriod && (
              <div className="ob-review-item">
                <span className="ob-review-label">Notice Period</span>
                <span className="ob-review-val">{jobPrefs.noticePeriod}</span>
              </div>
            )}
            {jobPrefs.preferredLocations.length > 0 && (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Preferred Locations</span>
                <span className="ob-review-val">{jobPrefs.preferredLocations.join(', ')}</span>
              </div>
            )}
            {jobPrefs.expectedSalary && (
              <div className="ob-review-item">
                <span className="ob-review-label">Expected Salary</span>
                <span className="ob-review-val">{jobPrefs.expectedSalary}</span>
              </div>
            )}
          </div>
        </section>

        {/* 7. Privacy & Visibility Controls */}
        <section className="ob-review-card ob-privacy-card" aria-labelledby="rev-privacy-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Shield size={18} aria-hidden="true" className="ob-review-icon ob-review-icon-shield" />
              <h2 className="ob-review-card-title" id="rev-privacy-title">Privacy & Visibility</h2>
            </div>
          </div>

          <p className="ob-privacy-desc">
            You retain full ownership and control over your data. Choose how recruiters
            and partners discover your Skill Passport.
          </p>

          <div className="ob-privacy-options">
            <label className={`ob-privacy-opt ${privacy.visibility === 'private' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="privacy-visibility"
                value="private"
                checked={privacy.visibility === 'private'}
                onChange={() => setPrivacyField('visibility', 'private')}
                className="ob-radio-input"
              />
              <div className="ob-privacy-opt-body">
                <div className="ob-privacy-opt-title">
                  <Lock size={15} aria-hidden="true" />
                  <strong>Private profile (Recommended for focused seekers)</strong>
                </div>
                <p className="ob-privacy-opt-sub">
                  Only organisations and founders where you actively apply can view your profile
                  and verified evidence.
                </p>
              </div>
            </label>

            <label className={`ob-privacy-opt ${privacy.visibility === 'discoverable' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="privacy-visibility"
                value="discoverable"
                checked={privacy.visibility === 'discoverable'}
                onChange={() => setPrivacyField('visibility', 'discoverable')}
                className="ob-radio-input"
              />
              <div className="ob-privacy-opt-body">
                <div className="ob-privacy-opt-title">
                  <Eye size={15} aria-hidden="true" />
                  <strong>Discoverable profile</strong>
                </div>
                <p className="ob-privacy-opt-sub">
                  Verified recruiters and startup founders in the YOGYATA ecosystem can search
                  and match you for relevant openings based on your skills.
                </p>
              </div>
            </label>
          </div>

          <div className="ob-privacy-consents">
            <CheckboxField
              id="privacy-recruiter-consent"
              checked={privacy.recruiterSharingConsent}
              onChange={(v) => setPrivacyField('recruiterSharingConsent', v)}
              label="Allow verified hiring partners to notify me of matching opportunities"
            />
            <CheckboxField
              id="privacy-college-consent"
              checked={privacy.collegeSharingConsent}
              onChange={(v) => setPrivacyField('collegeSharingConsent', v)}
              label="Share anonymised skill benchmark progress with academic or partner institutions (optional)"
            />
          </div>
        </section>
      </div>

      <FormNav
        onBack={onBack}
        onNext={onComplete}
        nextLabel="Submit & Complete Profile"
        nextId="review-submit-btn"
      />
    </StepWrapper>
  );
};
