import React, { useState } from 'react';
import type {
  MentorWorkspaceState,
} from '../types';
import type {
  SessionFormat,
  SessionFrequency,
} from '../../mentor-onboarding/types';
import { AVAILABLE_MENTORSHIP_TRACKS } from '../../mentor-onboarding/types';
import { sanitizeUrl } from '../storage';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  RotateCcw,
} from 'lucide-react';

interface ProfileTabProps {
  workspace: MentorWorkspaceState;
  onUpdateWorkspace: (updater: (prev: MentorWorkspaceState) => MentorWorkspaceState) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ workspace, onUpdateWorkspace }) => {
  const { mentor, expertise, preferences } = workspace;

  // Form State
  const [fullName, setFullName] = useState(mentor.fullName || '');
  const [headline, setHeadline] = useState(mentor.headline || '');
  const [currentRole, setCurrentRole] = useState(mentor.currentRole || '');
  const [organization, setOrganization] = useState(mentor.organization || '');
  const [yearsOfExperience, setYearsOfExperience] = useState<number | ''>(
    mentor.yearsOfExperience || 5
  );
  const [bio, setBio] = useState(mentor.bio || '');
  const [linkedInUrl, setLinkedInUrl] = useState(
    mentor.linkedInUrl || ''
  );

  // Chips
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>(expertise.expertiseAreas || []);
  const [technicalSkills, setTechnicalSkills] = useState<string[]>(expertise.technicalSkills || []);
  const [languages, setLanguages] = useState<string[]>(expertise.languages || ['English']);

  // Preferences
  const [selectedTracks, setSelectedTracks] = useState<string[]>(
    preferences.selectedTracks || ['Technical Interview Preparation']
  );
  const [sessionFormat, setSessionFormat] = useState<SessionFormat>(
    preferences.sessionFormat || 'online'
  );
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(
    preferences.sessionDurationMinutes || 45
  );
  const [sessionFrequency, setSessionFrequency] = useState<SessionFrequency>(
    preferences.sessionFrequency || 'weekly'
  );

  // Custom chip inputs
  const [customExpertise, setCustomExpertise] = useState('');
  const [customSkill, setCustomSkill] = useState('');

  // UI state
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const handleAddChip = (
    value: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setInput('');
      return;
    }
    setList([...list, trimmed]);
    setInput('');
  };

  const handleRemoveChip = (
    itemToRemove: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.filter((i) => i !== itemToRemove));
  };

  const handleToggleTrack = (trackTitle: string) => {
    if (selectedTracks.includes(trackTitle)) {
      if (selectedTracks.length <= 1) {
        setErrorMsg('Please keep at least one mentorship track selected.');
        return;
      }
      setSelectedTracks(selectedTracks.filter((t) => t !== trackTitle));
    } else {
      setSelectedTracks([...selectedTracks, trackTitle]);
    }
  };

  const handleResetForm = () => {
    setFullName(mentor.fullName || '');
    setHeadline(mentor.headline || '');
    setCurrentRole(mentor.currentRole || '');
    setOrganization(mentor.organization || '');
    setYearsOfExperience(mentor.yearsOfExperience || 5);
    setBio(mentor.bio || '');
    setLinkedInUrl(mentor.linkedInUrl || '');
    setExpertiseAreas(expertise.expertiseAreas || []);
    setTechnicalSkills(expertise.technicalSkills || []);
    setLanguages(expertise.languages || ['English']);
    setSelectedTracks(preferences.selectedTracks || ['Technical Interview Preparation']);
    setSessionFormat(preferences.sessionFormat || 'online');
    setSessionDurationMinutes(preferences.sessionDurationMinutes || 45);
    setSessionFrequency(preferences.sessionFrequency || 'weekly');
    setErrorMsg('');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }
    if (!headline.trim()) {
      setErrorMsg('Professional Headline is required.');
      return;
    }
    if (!currentRole.trim()) {
      setErrorMsg('Current Role is required.');
      return;
    }
    if (!bio.trim() || bio.trim().length < 30) {
      setErrorMsg('Professional Biography must be at least 30 characters.');
      return;
    }
    if (expertiseAreas.length === 0) {
      setErrorMsg('Please specify at least one area of expertise.');
      return;
    }
    if (technicalSkills.length === 0) {
      setErrorMsg('Please specify at least one technical skill.');
      return;
    }
    if (selectedTracks.length === 0) {
      setErrorMsg('Please select at least one mentorship track.');
      return;
    }

    onUpdateWorkspace((prev) => ({
      ...prev,
      mentor: {
        ...prev.mentor,
        fullName: fullName.trim(),
        headline: headline.trim(),
        currentRole: currentRole.trim(),
        organization: organization.trim() || undefined,
        yearsOfExperience: Number(yearsOfExperience) || 1,
        bio: bio.trim(),
        linkedInUrl: linkedInUrl.trim() || undefined,
      },
      expertise: {
        ...prev.expertise,
        expertiseAreas,
        technicalSkills,
        languages,
      },
      preferences: {
        ...prev.preferences,
        selectedTracks,
        sessionFormat,
        sessionDurationMinutes,
        sessionFrequency,
      },
    }));

    setToastMsg('Mentor profile updated successfully.');
    setTimeout(() => setToastMsg(''), 4000);
  };

  return (
    <div className="tab-pane-content" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1B2A4E', margin: '0 0 6px 0' }}>
            Mentor Profile & Public Persona
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.88rem' }}>
            Update your professional biography, mentorship tracks, and how learners view your guidance offerings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPreviewMode(!isPreviewMode)}
          style={{
            padding: '8px 16px',
            background: isPreviewMode ? '#EFF6FF' : '#FFFFFF',
            border: isPreviewMode ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
            color: isPreviewMode ? '#1D4ED8' : '#475569',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Eye size={15} /> {isPreviewMode ? 'Return to Edit Form' : 'Preview Mentee View'}
        </button>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            padding: '10px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.84rem',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* View Switch: Edit Form vs Live Mentee Preview */}
      {isPreviewMode ? (
        /* LIVE MENTEE VIEW PREVIEW CARD */
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '720px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              background: '#F1F5F9',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'inline-block',
              marginBottom: '18px',
            }}
          >
            Mentee Perspective Preview
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '18px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.4rem',
                border: '2px solid #E0E7FF',
              }}
            >
              {fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'M'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1B2A4E', margin: '0 0 4px 0' }}>
                {fullName || 'Mentor Name'}
              </h2>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#2563EB', fontWeight: 600 }}>
                {headline || 'Professional Headline'}
              </p>
              <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                {currentRole} {organization ? `@ ${organization}` : ''} • {yearsOfExperience} Years Experience
              </span>
            </div>
          </div>

          {/* Bio */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 6px 0' }}>
              About Mentor
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>{bio}</p>
          </div>

          {/* Tracks Offered */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 8px 0' }}>
              Mentorship Tracks Offered
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedTracks.map((trk) => (
                <span
                  key={trk}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #BFDBFE',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {trk}
                </span>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: '#94A3B8', margin: '0 0 8px 0' }}>
              Skills & Expertise
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {technicalSkills.map((sk) => (
                <span
                  key={sk}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: '#F1F5F9',
                    color: '#334155',
                    fontSize: '0.78rem',
                  }}
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>

          {/* Session Format Info */}
          <div
            style={{
              padding: '12px 16px',
              background: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: '#475569',
            }}
          >
            <span>
              <strong>Format:</strong> {sessionFormat === 'online' ? '1:1 Video Calls' : 'Flexible Async & Video'}
            </span>
            <span>
              <strong>Duration:</strong> {sessionDurationMinutes} mins / session
            </span>
            <span>
              <strong>Cadence:</strong> {sessionFrequency}
            </span>
          </div>

          {linkedInUrl && (
            <div style={{ marginTop: '16px' }}>
              <a
                href={sanitizeUrl(linkedInUrl)}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.82rem',
                  color: '#2563EB',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                View LinkedIn / Portfolio &rarr;
              </a>
            </div>
          )}
        </div>
      ) : (
        /* EDIT PROFILE FORM */
        <form onSubmit={handleSaveProfile} style={{ maxWidth: '840px' }}>
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            {/* Basic Info */}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', margin: '0 0 -6px 0' }}>
              1. Professional Identity
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Years of Experience *
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Professional Headline *
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Principal Engineer @ CloudScale | Distributed Systems & Architecture"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Current Role *
                </label>
                <input
                  type="text"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Organization (Optional)
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                Biography * ({bio.length}/500 chars)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                LinkedIn or Portfolio URL
              </label>
              <input
                type="text"
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Expertise & Skills */}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', margin: '14px 0 -6px 0' }}>
              2. Skills & Domain Expertise
            </h3>

            {/* Areas of Expertise */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Areas of Expertise
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {expertiseAreas.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      background: '#EFF6FF',
                      color: '#1D4ED8',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveChip(item, expertiseAreas, setExpertiseAreas)}
                      style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Add custom expertise..."
                  value={customExpertise}
                  onChange={(e) => setCustomExpertise(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddChip(customExpertise, expertiseAreas, setExpertiseAreas, setCustomExpertise)
                  }
                  style={{
                    padding: '6px 12px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Technical skills */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Technical Skills
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {technicalSkills.map((item) => (
                  <span
                    key={item}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      background: '#F1F5F9',
                      color: '#334155',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                    }}
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveChip(item, technicalSkills, setTechnicalSkills)}
                      style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Add technical skill (e.g. Docker, Go)..."
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAddChip(customSkill, technicalSkills, setTechnicalSkills, setCustomSkill)
                  }
                  style={{
                    padding: '6px 12px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Mentorship Tracks */}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1B2A4E', margin: '14px 0 -6px 0' }}>
              3. Active Mentorship Tracks
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
              {AVAILABLE_MENTORSHIP_TRACKS.map((track) => {
                const isSelected = selectedTracks.includes(track.title);
                return (
                  <div
                    key={track.id}
                    onClick={() => handleToggleTrack(track.title)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                      background: isSelected ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>
                        {track.title}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div onClick
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.76rem', color: '#64748B' }}>{track.description}</span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '18px',
                marginTop: '10px',
              }}
            >
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCcw size={14} /> Revert Changes
              </button>
              <button
                type="submit"
                style={{
                  padding: '9px 22px',
                  borderRadius: '6px',
                  background: '#2563EB',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Save size={15} /> Save Profile Changes
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
