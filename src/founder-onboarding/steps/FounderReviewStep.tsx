import React from 'react';
import type {
  FounderOnboardingState,
  FounderOnboardingView,
  FounderPrivacyPreferences,
} from '../types';
import {
  StepWrapper, StepHeader, FormNav, InfoNotice, CheckboxField,
} from '../../onboarding/shared';
import {
  User, Building2, Target, Users, FileCode2, Shield, Edit3, Lock, Eye,
} from 'lucide-react';

interface FounderReviewStepProps {
  state: FounderOnboardingState;
  onEdit: (view: FounderOnboardingView) => void;
  onComplete: () => void;
  onBack: () => void;
  onChangePrivacy: (privacy: FounderPrivacyPreferences) => void;
}

export const FounderReviewStep: React.FC<FounderReviewStepProps> = ({
  state,
  onEdit,
  onComplete,
  onBack,
  onChangePrivacy,
}) => {
  const { account, profile, startup, goals, talentRequirements, taskDraft, privacy } = state;

  const setPrivacyField = <K extends keyof FounderPrivacyPreferences>(
    key: K,
    val: FounderPrivacyPreferences[K]
  ) => {
    onChangePrivacy({ ...privacy, [key]: val });
  };

  const primaryGoalDisplay =
    goals.primaryGoal === 'Other'
      ? goals.customPrimaryGoal || 'Other'
      : goals.primaryGoal || 'Not specified';

  const industryDisplay =
    startup.industry === 'Other'
      ? startup.customIndustry || 'Other'
      : startup.industry || 'Not specified';

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Stage 6 of 6 — Review & Privacy"
        heading="Review your founder profile."
        subheading="Inspect your venture setup and set your discovery preferences. You can edit any section before finalizing."
      />

      <InfoNotice variant="info">
        <strong>Transparency:</strong> Credentials and sensitive fields remain local to this browser session in this prototype milestone. No server persistence has been triggered.
      </InfoNotice>

      <div className="ob-review-cards">
        {/* Section A: Founder Profile */}
        <section className="ob-review-card" aria-labelledby="rev-founder-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <User size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-founder-title">Founder Profile</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('profile')}
              aria-label="Edit founder personal profile"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            <div className="ob-review-item">
              <span className="ob-review-label">Full Name</span>
              <span className="ob-review-val">{profile.fullName || account.fullName || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Title</span>
              <span className="ob-review-val ob-review-val-highlight">{profile.professionalTitle || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Work Email</span>
              <span className="ob-review-val">{account.email || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Location</span>
              <span className="ob-review-val">{profile.city ? `${profile.city}, ` : ''}{profile.country || '—'}</span>
            </div>
            {profile.linkedInUrl && (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">LinkedIn</span>
                <span className="ob-review-val">{profile.linkedInUrl}</span>
              </div>
            )}
            {profile.bio && (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Bio</span>
                <span className="ob-review-val">{profile.bio}</span>
              </div>
            )}
          </div>
        </section>

        {/* Section B: Startup Profile */}
        <section className="ob-review-card" aria-labelledby="rev-startup-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Building2 size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-startup-title">Startup Details</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('startup')}
              aria-label="Edit startup venture details"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            <div className="ob-review-item">
              <span className="ob-review-label">Venture Name</span>
              <span className="ob-review-val ob-review-val-highlight">{startup.startupName || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Industry</span>
              <span className="ob-review-val">{industryDisplay}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Stage</span>
              <span className="ob-review-val">{startup.stage || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Team Size</span>
              <span className="ob-review-val">{startup.teamSize || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Headquarters</span>
              <span className="ob-review-val">{startup.city ? `${startup.city}, ` : ''}{startup.country || '—'}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Work Mode</span>
              <span className="ob-review-val">{startup.workMode ? startup.workMode.toUpperCase() : '—'}</span>
            </div>
            {startup.websiteUrl && (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Website</span>
                <span className="ob-review-val">{startup.websiteUrl}</span>
              </div>
            )}
            <div className="ob-review-item ob-review-item-full">
              <span className="ob-review-label">Description</span>
              <span className="ob-review-val">{startup.description || '—'}</span>
            </div>
          </div>
        </section>

        {/* Section C: Business Goals */}
        <section className="ob-review-card" aria-labelledby="rev-goals-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Target size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-goals-title">Business Goals</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('goals')}
              aria-label="Edit business goals"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          <div className="ob-review-grid">
            <div className="ob-review-item">
              <span className="ob-review-label">Primary Goal</span>
              <span className="ob-review-val ob-review-val-highlight">{primaryGoalDisplay}</span>
            </div>
            <div className="ob-review-item">
              <span className="ob-review-label">Project Category</span>
              <span className="ob-review-val">{goals.projectCategory || '—'}</span>
            </div>
            <div className="ob-review-item ob-review-item-full">
              <span className="ob-review-label">Scope Description</span>
              <span className="ob-review-val">{goals.projectDescription || '—'}</span>
            </div>
            {goals.projectLink && (
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Project Link</span>
                <span className="ob-review-val">{goals.projectLink}</span>
              </div>
            )}
          </div>
        </section>

        {/* Section D: Talent Requirements */}
        <section className="ob-review-card" aria-labelledby="rev-talent-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Users size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-talent-title">
                Talent Requirements ({talentRequirements.length})
              </h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('talent')}
              aria-label="Edit talent requirements"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          {talentRequirements.length === 0 ? (
            <p className="ob-review-val-muted">No specific talent requirements configured yet.</p>
          ) : (
            <div className="founder-reqs-grid" style={{ marginTop: '8px' }}>
              {talentRequirements.map((req) => (
                <div key={req.id} className="founder-req-card">
                  <div className="founder-req-header">
                    <div>
                      <h3 className="founder-req-role">{req.roleTitle}</h3>
                      <p className="founder-req-meta">
                        {req.contributorsCount} {parseInt(req.contributorsCount, 10) > 1 ? 'contributors' : 'contributor'} · {req.workArrangement} · {req.engagementType}
                      </p>
                    </div>
                    <span className={`founder-comp-badge comp-${req.compensation}`}>
                      {req.compensation === 'paid' && 'Paid'}
                      {req.compensation === 'unpaid' && 'Unpaid'}
                      {req.compensation === 'to-be-discussed' && 'TBD'}
                    </span>
                  </div>
                  {req.requiredSkills.length > 0 && (
                    <div className="founder-req-skills" style={{ marginTop: '6px' }}>
                      {req.requiredSkills.map((s) => (
                        <span key={s} className="ob-review-tag">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section E: Task Draft */}
        <section className="ob-review-card" aria-labelledby="rev-task-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <FileCode2 size={18} aria-hidden="true" className="ob-review-icon" />
              <h2 className="ob-review-card-title" id="rev-task-title">Project Task Draft</h2>
            </div>
            <button
              type="button"
              className="ob-review-edit-btn"
              onClick={() => onEdit('task')}
              aria-label="Edit project task"
            >
              <Edit3 size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
          {taskDraft.isSkipped || !taskDraft.taskTitle ? (
            <p className="ob-review-val-muted">No task created yet (skipped during onboarding).</p>
          ) : (
            <div className="ob-review-grid">
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Draft Status</span>
                <span className="ob-dev-badge" style={{ background: '#21845A', width: 'fit-content', marginTop: '4px' }}>
                  TASK DRAFT PREPARED
                </span>
              </div>
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Task Title</span>
                <span className="ob-review-val ob-review-val-highlight">{taskDraft.taskTitle}</span>
              </div>
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Problem Statement</span>
                <span className="ob-review-val">{taskDraft.problemStatement}</span>
              </div>
              <div className="ob-review-item ob-review-item-full">
                <span className="ob-review-label">Required Skills</span>
                <div className="ob-review-tags-wrap">
                  {taskDraft.requiredSkills.map((s) => (
                    <span key={s} className="ob-review-tag">{s}</span>
                  ))}
                </div>
              </div>
              <div className="ob-review-item">
                <span className="ob-review-label">Expected Deliverable</span>
                <span className="ob-review-val">{taskDraft.expectedDeliverable}</span>
              </div>
              <div className="ob-review-item">
                <span className="ob-review-label">Evaluation Criteria</span>
                <span className="ob-review-val">{taskDraft.evaluationCriteria}</span>
              </div>
            </div>
          )}
        </section>

        {/* Section F: Privacy and Visibility */}
        <section className="ob-review-card ob-privacy-card" aria-labelledby="rev-privacy-title">
          <div className="ob-review-card-header">
            <div className="ob-review-card-title-group">
              <Shield size={18} aria-hidden="true" className="ob-review-icon ob-review-icon-shield" />
              <h2 className="ob-review-card-title" id="rev-privacy-title">Your venture. Your choice.</h2>
            </div>
          </div>

          <p className="ob-privacy-desc">
            You retain full ownership of your venture details. Choose how contributors and ecosystem partners discover your venture.
          </p>

          <div className="ob-privacy-options">
            <label className={`ob-privacy-opt ${privacy.profileVisibility === 'private' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="founder-profile-visibility"
                value="private"
                checked={privacy.profileVisibility === 'private'}
                onChange={() => setPrivacyField('profileVisibility', 'private')}
                className="ob-radio-input"
              />
              <div className="ob-privacy-opt-body">
                <div className="ob-privacy-opt-title">
                  <Lock size={15} aria-hidden="true" />
                  <strong>Private Venture Profile (Stealth Mode)</strong>
                </div>
                <p className="ob-privacy-opt-sub">
                  Only contributors you directly invite or accept can view your project scope and company details.
                </p>
              </div>
            </label>

            <label className={`ob-privacy-opt ${privacy.profileVisibility === 'discoverable' ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="founder-profile-visibility"
                value="discoverable"
                checked={privacy.profileVisibility === 'discoverable'}
                onChange={() => setPrivacyField('profileVisibility', 'discoverable')}
                className="ob-radio-input"
              />
              <div className="ob-privacy-opt-body">
                <div className="ob-privacy-opt-title">
                  <Eye size={15} aria-hidden="true" />
                  <strong>Discoverable within YOGYATA</strong>
                </div>
                <p className="ob-privacy-opt-sub">
                  Talented job seekers with matching skills can discover your venture and submit proof challenges.
                </p>
              </div>
            </label>
          </div>

          <div className="ob-privacy-consents">
            <CheckboxField
              id="founder-contact-sharing"
              checked={privacy.allowContactSharing}
              onChange={(v) => setPrivacyField('allowContactSharing', v)}
              label="Allow verified talent to see professional contact information upon challenge acceptance"
            />
            <CheckboxField
              id="founder-contributor-expressions"
              checked={privacy.receiveContributorExpressions}
              onChange={(v) => setPrivacyField('receiveContributorExpressions', v)}
              label="Receive expressions of interest from contributors matching my required skills"
            />
          </div>
        </section>
      </div>

      <FormNav
        onBack={onBack}
        onNext={onComplete}
        nextLabel="Complete Founder Profile"
        nextId="founder-review-complete-btn"
      />
    </StepWrapper>
  );
};
