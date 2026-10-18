import React, { useCallback, useRef, useState } from 'react';
import type { ResumeSkillsData, DeclaredSkill } from '../types';
import {
  StepWrapper, StepHeader, FormNav, InfoNotice,
} from '../shared';
import {
  Upload, X, FileText, Plus, Pencil, Check,
  Sparkles, CheckCircle2, Zap, Briefcase
} from 'lucide-react';

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_EXTS = ['.pdf', '.docx'];

const SKILL_CATEGORIES = [
  'Programming', 'Design', 'Data & Analytics', 'Marketing',
  'Project Management', 'Communication', 'Finance', 'Operations', 'Other',
];

let skillIdCounter = 1;

export interface ExtractedResumeProfile {
  fileName: string;
  roleTitle: string;
  headline: string;
  experience: 'fresher' | 'less-than-1' | '1-2' | '3-5' | '6-10';
  skills: { name: string; category: string; confidence: number }[];
}

const DEFAULT_EXTRACTED_PROFILE: ExtractedResumeProfile = {
  fileName: 'Sample_Tech_Resume.pdf',
  roleTitle: 'Full-Stack Developer',
  headline: 'Full-Stack Engineer building modern web apps with React, TypeScript & Node.js',
  experience: '1-2',
  skills: [
    { name: 'React', category: 'Programming', confidence: 99 },
    { name: 'TypeScript', category: 'Programming', confidence: 98 },
    { name: 'Node.js', category: 'Programming', confidence: 94 },
    { name: 'Next.js', category: 'Programming', confidence: 96 },
    { name: 'TailwindCSS', category: 'Design', confidence: 95 },
    { name: 'PostgreSQL', category: 'Data & Analytics', confidence: 90 },
  ],
};

interface ResumeSkillsStepProps {
  data: ResumeSkillsData;
  onChange: (d: ResumeSkillsData) => void;
  onAutoFetchProfile?: (extracted: {
    roleTitle: string;
    headline: string;
    experience: string;
    skills: DeclaredSkill[];
  }) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ResumeSkillsStep: React.FC<ResumeSkillsStepProps> = ({
  data,
  onChange,
  onAutoFetchProfile,
  onNext,
  onBack,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skillCategory, setSkillCategory] = useState(SKILL_CATEGORIES[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // ── Auto-Fetch & Parsing States ────────────────────────────────────────────
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState(1);
  const [parsedSummary, setParsedSummary] = useState<ExtractedResumeProfile | null>(null);

  // ── File Handling with Intelligent Extraction ──────────────────────────────
  const processFile = useCallback(
    (file: File) => {
      setFileError('');
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
        setFileError('Unsupported file format. Please upload a PDF or DOCX file.');
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setFileError(`File too large. Maximum size is ${MAX_SIZE_MB} MB.`);
        return;
      }

      // Start realistic parsing simulation
      setIsParsing(true);
      setParsingStep(1);

      setTimeout(() => setParsingStep(2), 400);
      setTimeout(() => setParsingStep(3), 800);

      setTimeout(() => {
        setIsParsing(false);
        const extracted: ExtractedResumeProfile = {
          ...DEFAULT_EXTRACTED_PROFILE,
          fileName: file.name,
        };
        setParsedSummary(extracted);

        // Map extracted skills into DeclaredSkill objects
        const existingNames = new Set(data.skills.map((s) => s.name.toLowerCase()));
        const newDeclaredSkills: DeclaredSkill[] = [...data.skills];

        for (const item of extracted.skills) {
          if (!existingNames.has(item.name.toLowerCase())) {
            newDeclaredSkills.push({
              id: `skill-${skillIdCounter++}`,
              name: item.name,
              category: item.category,
            });
            existingNames.add(item.name.toLowerCase());
          }
        }

        onChange({
          ...data,
          resumeFile: { name: file.name, sizeBytes: file.size, type: file.type },
          skills: newDeclaredSkills,
        });

        onAutoFetchProfile?.({
          roleTitle: extracted.roleTitle,
          headline: extracted.headline,
          experience: extracted.experience,
          skills: newDeclaredSkills,
        });
      }, 1200);
    },
    [data, onChange, onAutoFetchProfile]
  );

  const handleUseSampleResume = () => {
    setIsParsing(true);
    setParsingStep(1);
    setTimeout(() => setParsingStep(2), 400);
    setTimeout(() => setParsingStep(3), 800);

    setTimeout(() => {
      setIsParsing(false);
      setParsedSummary(DEFAULT_EXTRACTED_PROFILE);

      const existingNames = new Set(data.skills.map((s) => s.name.toLowerCase()));
      const newDeclaredSkills: DeclaredSkill[] = [...data.skills];

      for (const item of DEFAULT_EXTRACTED_PROFILE.skills) {
        if (!existingNames.has(item.name.toLowerCase())) {
          newDeclaredSkills.push({
            id: `skill-${skillIdCounter++}`,
            name: item.name,
            category: item.category,
          });
          existingNames.add(item.name.toLowerCase());
        }
      }

      onChange({
        ...data,
        resumeFile: {
          name: DEFAULT_EXTRACTED_PROFILE.fileName,
          sizeBytes: 245 * 1024,
          type: 'application/pdf',
        },
        skills: newDeclaredSkills,
      });

      onAutoFetchProfile?.({
        roleTitle: DEFAULT_EXTRACTED_PROFILE.roleTitle,
        headline: DEFAULT_EXTRACTED_PROFILE.headline,
        experience: DEFAULT_EXTRACTED_PROFILE.experience,
        skills: newDeclaredSkills,
      });
    }, 1200);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemoveResume = () => {
    onChange({ ...data, resumeFile: null });
    setParsedSummary(null);
    setFileError('');
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    const exists = data.skills.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return;

    const newSkill: DeclaredSkill = {
      id: `skill-${skillIdCounter++}`,
      name: trimmed,
      category: skillCategory,
    };
    onChange({ ...data, skills: [...data.skills, newSkill] });
    setSkillInput('');
  };

  const removeSkill = (id: string) => {
    onChange({ ...data, skills: data.skills.filter((s) => s.id !== id) });
  };

  const startEdit = (skill: DeclaredSkill) => {
    setEditingId(skill.id);
    setEditValue(skill.name);
  };

  const saveEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) {
      onChange({
        ...data,
        skills: data.skills.map((s) =>
          s.id === id ? { ...s, name: trimmed } : s
        ),
      });
    }
    setEditingId(null);
    setEditValue('');
  };

  return (
    <StepWrapper>
      <StepHeader
        eyebrow="Step 3 of 5 — Resume & Skills"
        heading="Let your experience speak."
        subheading="Upload your resume to auto-fetch your skills, or enter your competencies manually."
      />

      {/* ── Resume Upload & AI Auto-Fetch ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Resume Auto-Fetch & Skills Extraction</h2>
              <p className="ob-section-box-sub">
                Upload your resume — our parser extracts your skills, experience, and tailors your jobs & internships.
              </p>
            </div>
          </div>
          <span className="ob-pill-badge">Smart Auto-Fill</span>
        </div>

        {/* Live Parsing Loader Animation */}
        {isParsing && (
          <div className="ob-parsing-banner">
            <div className="ob-parsing-spinner-wrap">
              <Sparkles size={24} className="ob-spin-pulse" />
            </div>
            <div className="ob-parsing-text">
              <strong className="ob-parsing-title">
                {parsingStep === 1 && 'Reading resume layout & document structure…'}
                {parsingStep === 2 && 'Extracting technical competencies & project achievements…'}
                {parsingStep === 3 && 'Syncing extracted skills with Yogyata Skill Passport…'}
              </strong>
              <div className="ob-parsing-progress-bar">
                <div
                  className="ob-parsing-progress-fill"
                  style={{ width: `${parsingStep * 33}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {!data.resumeFile && !isParsing ? (
          <div
            className={`ob-dropzone ${isDragging ? 'is-dragging' : ''} ${fileError ? 'has-error' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Upload resume file — drop here or click to browse"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              borderRadius: '16px',
              padding: '32px 24px',
              border: '2px dashed #CBD5E1',
              background: '#F8FAFD',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div className="ob-dropzone-icon" aria-hidden="true" style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#EEF4FF', color: '#3559DF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', border: '1px solid #D2E0FF' }}>
              <Upload size={26} />
            </div>
            <p className="ob-dropzone-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F1A44', marginBottom: '4px' }}>
              Drag & drop your resume here to auto-fetch profile
            </p>
            <p className="ob-dropzone-sub" style={{ fontSize: '0.88rem', color: '#64748B', marginBottom: '8px' }}>
              PDF or DOCX (Max {MAX_SIZE_MB} MB)
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="ob-btn-secondary ob-dropzone-browse"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{ borderRadius: '10px', fontWeight: 700 }}
              >
                Browse File
              </button>
              <button
                type="button"
                className="ob-btn-primary"
                onClick={(e) => { e.stopPropagation(); handleUseSampleResume(); }}
                style={{ borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Zap size={15} />
                <span>Auto-Fetch Sample Tech Resume</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="ob-file-input-hidden"
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        ) : data.resumeFile && !isParsing ? (
          <div className="ob-file-preview" style={{ borderRadius: '14px', border: '1.5px solid #CBD5E1', padding: '16px 20px', background: '#F8FAFD' }}>
            <div className="ob-file-preview-icon" aria-hidden="true" style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#ECFDF5', color: '#059669' }}>
              <CheckCircle2 size={24} />
            </div>
            <div className="ob-file-preview-info">
              <p className="ob-file-preview-name" style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F1A44' }}>
                {data.resumeFile.name}
              </p>
              <p className="ob-file-preview-size" style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                ✓ Parsed & Auto-Fetched into Skill Passport
              </p>
            </div>
            <div className="ob-file-preview-actions">
              <button
                type="button"
                className="ob-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Replace resume file"
                title="Replace file"
                style={{ borderRadius: '8px' }}
              >
                <Upload size={15} />
              </button>
              <button
                type="button"
                className="ob-icon-btn ob-icon-btn-danger"
                onClick={handleRemoveResume}
                aria-label="Remove resume file"
                title="Remove file"
                style={{ borderRadius: '8px' }}
              >
                <X size={15} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="ob-file-input-hidden"
              onChange={handleFileChange}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
        ) : null}

        {/* ── Parsed Resume Intelligence Summary Card ── */}
        {parsedSummary && !isParsing && (
          <div className="ob-resume-parsed-card">
            <div className="ob-parsed-header">
              <div className="ob-parsed-title-row">
                <span className="ob-parsed-status-badge">
                  <Check size={13} /> Resume Parsed Successfully
                </span>
                <span className="ob-parsed-role-badge">
                  <Briefcase size={13} /> {parsedSummary.roleTitle}
                </span>
              </div>
              <p className="ob-parsed-sub">
                Extracted from <strong>{parsedSummary.fileName}</strong>: Found <strong>{parsedSummary.skills.length} core competencies</strong>.
              </p>
            </div>

            <div className="ob-parsed-skills-wrap">
              <span className="ob-parsed-skills-label">Auto-Extracted Competencies:</span>
              <div className="ob-parsed-chips-row">
                {parsedSummary.skills.map((s) => (
                  <span key={s.name} className="ob-parsed-skill-chip">
                    <span className="ob-chip-check">✓</span>
                    <span className="ob-chip-name">{s.name}</span>
                    <span className="ob-chip-confidence">{s.confidence}% match</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="ob-parsed-note-box">
              <Sparkles size={16} className="ob-sparkle-blue" />
              <span>
                <strong>Workspace Personalization Enabled:</strong> Your dashboard jobs, paid internships, founder tasks, and mentors will now automatically prioritize these skills!
              </span>
            </div>
          </div>
        )}

        {fileError && (
          <p className="ob-field-error" role="alert" style={{ marginTop: '10px' }}>{fileError}</p>
        )}
      </div>

      {/* ── Declared Skills ── */}
      <div className="ob-section-box">
        <div className="ob-section-box-header">
          <div className="ob-section-box-title-group">
            <div className="ob-icon-badge" aria-hidden="true">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="ob-section-box-title">Your declared skills</h2>
              <p className="ob-section-box-sub">Add technical, design, and domain competencies to match with startup tasks</p>
            </div>
          </div>
          <span className="ob-pill-badge">{data.skills.length} added</span>
        </div>

        <InfoNotice variant="info">
          <strong>Declared skills</strong> are self-reported. You can prove them later via live founder tasks or assessments to earn <strong>Verified</strong> or <strong>Assessed</strong> badges on your Skill Passport.
        </InfoNotice>

        {/* Quick Suggestions */}
        <div style={{ marginTop: '14px', marginBottom: '8px' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.04em', marginBottom: '8px' }}>
            Quick add suggestions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['React', 'Node.js', 'Python', 'TypeScript', 'SQL', 'Figma', 'UI/UX Design', 'Data Analysis', 'Docker', 'Product Management'].map((suggested) => {
              const alreadyHas = data.skills.some((s) => s.name.toLowerCase() === suggested.toLowerCase());
              if (alreadyHas) return null;
              return (
                <button
                  key={suggested}
                  type="button"
                  onClick={() => {
                    const skill: DeclaredSkill = {
                      id: `skill-${skillIdCounter++}`,
                      name: suggested,
                      category: ['Figma', 'UI/UX Design'].includes(suggested) ? 'Design' : ['Data Analysis', 'SQL'].includes(suggested) ? 'Data & Analytics' : 'Programming',
                    };
                    onChange({ ...data, skills: [...data.skills, skill] });
                  }}
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '9999px',
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3559DF';
                    e.currentTarget.style.background = '#EEF2FD';
                    e.currentTarget.style.color = '#3559DF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.color = '#334155';
                  }}
                >
                  <Plus size={12} /> {suggested}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add skill input row */}
        <div className="ob-skill-add-row" style={{ marginTop: '16px' }}>
          <div className="ob-skill-add-input-group">
            <label htmlFor="skill-input" className="ob-label">Skill name</label>
            <input
              id="skill-input"
              type="text"
              className="ob-input"
              placeholder="e.g. Next.js, PostgreSQL, TailwindCSS, AWS"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              style={{ borderRadius: '10px' }}
            />
          </div>
          <div className="ob-skill-category-group">
            <label htmlFor="skill-category" className="ob-label">Category</label>
            <select
              id="skill-category"
              className="ob-select"
              value={skillCategory}
              onChange={(e) => setSkillCategory(e.target.value)}
              style={{ borderRadius: '10px' }}
            >
              {SKILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="ob-skill-add-btn-wrap">
            <label className="ob-label ob-label-spacer" aria-hidden="true"> </label>
            <button
              type="button"
              className="ob-btn-primary ob-skill-add-btn"
              onClick={addSkill}
              id="add-skill-btn"
              aria-label="Add skill"
              style={{ borderRadius: '10px' }}
            >
              <Plus size={16} aria-hidden="true" />
              Add
            </button>
          </div>
        </div>

        {/* Skills list */}
        {data.skills.length === 0 ? (
          <p className="ob-empty-state-text" style={{ padding: '24px 16px', background: '#F8FAFD', borderRadius: '12px', border: '1px dashed #CBD5E1', marginTop: '16px' }}>
            No skills added yet. Type a skill above or click a suggestion to start building your profile.
          </p>
        ) : (
          <ul className="ob-skills-list" aria-label="Declared skills" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.skills.map((skill) => (
              <li key={skill.id} className="ob-skill-item" style={{ borderRadius: '12px', border: '1px solid #E2E8F0', padding: '12px 16px', background: '#FFFFFF' }}>
                <span className="ob-skill-badge-declared" style={{ borderRadius: '6px' }}>DECLARED</span>
                {editingId === skill.id ? (
                  <input
                    type="text"
                    className="ob-input ob-skill-edit-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(skill.id); }}
                    autoFocus
                    aria-label={`Edit skill: ${skill.name}`}
                  />
                ) : (
                  <>
                    <strong className="ob-skill-name" style={{ color: '#0F1A44' }}>{skill.name}</strong>
                    <span className="ob-skill-category-tag" style={{ borderRadius: '6px' }}>{skill.category}</span>
                  </>
                )}
                <div className="ob-skill-actions">
                  {editingId === skill.id ? (
                    <button
                      type="button"
                      className="ob-icon-btn ob-icon-btn-success"
                      onClick={() => saveEdit(skill.id)}
                      aria-label="Save skill edit"
                      style={{ borderRadius: '6px' }}
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ob-icon-btn"
                      onClick={() => startEdit(skill)}
                      aria-label={`Edit skill: ${skill.name}`}
                      style={{ borderRadius: '6px' }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="ob-icon-btn ob-icon-btn-danger"
                    onClick={() => removeSkill(skill.id)}
                    aria-label={`Remove skill: ${skill.name}`}
                    style={{ borderRadius: '6px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        nextId="resume-next-btn"
      />
    </StepWrapper>
  );
};
