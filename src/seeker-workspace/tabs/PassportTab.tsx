import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, X, BadgeCheck, GraduationCap } from 'lucide-react';
import type { PassportSkill, SkillLevel, SkillReview } from '../../lib/database.types';
import { declareSkill, removeDeclaredSkill } from '../../lib/seekerData';
import { cancelReviewRequest, requestMentorReview } from '../../lib/reviewData';
import { LEVEL_HELP, LEVEL_LABEL, formatDate } from '../shared';

const LEVELS: SkillLevel[] = ['verified', 'assessed', 'declared'];
const CATEGORIES = ['Engineering', 'Design', 'Data', 'Product', 'Marketing', 'Business', 'Other'];
const URL_OK = /^https?:\/\/\S+\.\S+/i;

interface Props {
  userId: string;
  skills: PassportSkill[];
  reviews: SkillReview[];
  onChanged: () => Promise<void>;
}

export function PassportTab({ userId, skills, reviews, onChanged }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);

  // newest request per skill (reviews arrive newest first)
  const latestReview = new Map<string, SkillReview>();
  for (const r of reviews) if (!latestReview.has(r.skill_id)) latestReview.set(r.skill_id, r);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await declareSkill(userId, name, category, 'Self-declared');
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError('');
    setName('');
    await onChanged();
  }

  async function remove(skill: PassportSkill) {
    const res = await removeDeclaredSkill(skill.id);
    if (res.error) setError(res.error);
    else await onChanged();
  }

  async function cancel(review: SkillReview) {
    const res = await cancelReviewRequest(review.id);
    if (res.error) setError(res.error);
    else await onChanged();
  }

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card">
        <h3 className="ws-card-title">How your passport is built</h3>
        <p className="ws-card-subtitle">
          Every skill shows how it was proven. Founders and recruiters see the level, so reviewed work counts for more than a claim.
        </p>
        <div className="sk-tier-grid">
          <div className="sk-tier-card tier-declared">
            <div className="sk-tier-head">
              <span className="sk-tier-badge">Level 1 · Declared</span>
            </div>
            <p className="sk-tier-desc">{LEVEL_HELP.declared}</p>
          </div>
          <div className="sk-tier-card tier-assessed">
            <div className="sk-tier-head">
              <span className="sk-tier-badge">Level 2 · Assessed</span>
            </div>
            <p className="sk-tier-desc">{LEVEL_HELP.assessed}</p>
          </div>
          <div className="sk-tier-card tier-verified">
            <div className="sk-tier-head">
              <span className="sk-tier-badge">Level 3 · Verified</span>
            </div>
            <p className="sk-tier-desc">{LEVEL_HELP.verified}</p>
          </div>
        </div>
      </div>

      <form className="ws-card sk-declare-form" onSubmit={add} noValidate>
        <h3 className="ws-card-title">Declare a new skill</h3>
        <p className="ws-card-subtitle">Add skills you know to immediately match with live founder tasks.</p>
        <div className="sk-declare-grid">
          <div className="sk-input-group">
            <label className="sk-input-label" htmlFor="declare-name">
              Skill name
            </label>
            <input
              id="declare-name"
              className="sk-input-field"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. React, Next.js, Figma, Python, SQL"
            />
          </div>
          <div className="sk-input-group">
            <label className="sk-input-label" htmlFor="declare-category">
              Category
            </label>
            <select id="declare-category" className="sk-input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Choose category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="sk-hero-cta" disabled={busy || !name.trim()} style={{ height: '46px' }}>
            <Plus size={16} aria-hidden="true" />
            <span>{busy ? 'Adding…' : 'Add to Passport'}</span>
          </button>
        </div>
        {error && (
          <p className="yw-form-error" role="alert" style={{ marginTop: '12px' }}>
            {error}
          </p>
        )}
      </form>

      {LEVELS.map((level) => {
        const list = skills.filter((s) => s.level === level);
        return (
          <section className="ws-card" key={level} aria-labelledby={`passport-${level}`}>
            <div className="sk-section-header">
              <h3 className="ws-card-title" id={`passport-${level}`}>
                <span>{LEVEL_LABEL[level]} Skills</span>
                <span className="sk-match-tag" style={{ marginLeft: '8px' }}>{list.length}</span>
              </h3>
            </div>
            {list.length === 0 ? (
              <div className="ws-empty-state" style={{ padding: '24px 16px' }}>
                <p className="ws-empty-desc" style={{ marginBottom: 0 }}>
                  {level === 'verified'
                    ? 'Submit work for a founder task. Skills confirmed by reviewers move to Verified.'
                    : level === 'assessed'
                      ? 'Pass an interactive assessment or ask a mentor to evaluate a declared skill.'
                      : 'Add the skills you already know to get matched with active startup problems.'}
                </p>
              </div>
            ) : (
              <div className="sk-skill-chip-grid">
                {list.map((s) => {
                  const review = latestReview.get(s.id);
                  const pending = review?.status === 'requested';
                  return (
                    <div key={s.id} className="sk-skill-card-item">
                      <div className="sk-skill-card-main">
                        <div className="sk-skill-name-badge">
                          {level === 'verified' ? (
                            <BadgeCheck size={18} color="#059669" aria-hidden="true" />
                          ) : level === 'assessed' ? (
                            <span style={{ color: '#2545C6', fontWeight: 800 }}>⚡</span>
                          ) : (
                            <span style={{ color: '#D97706', fontWeight: 800 }}>💡</span>
                          )}
                          <span>{s.skill_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {s.category && <span className="sk-category-pill">{s.category}</span>}
                          {s.level === 'declared' && !pending && (
                            <button
                              type="button"
                              className="sk-delete-skill-btn"
                              onClick={() => remove(s)}
                              aria-label={`Remove ${s.skill_name}`}
                              title="Delete skill"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="sk-skill-meta-tags">
                        <span>{[s.evidence || 'Self-declared', formatDate(s.created_at)].filter(Boolean).join(' · ')}</span>
                      </div>

                      {s.level === 'declared' && review?.status === 'declined' && review.feedback && (
                        <div className="yg-feedback" style={{ fontSize: '0.8rem', borderRadius: '8px', padding: '8px 10px' }}>
                          Mentor feedback: “{review.feedback}”
                        </div>
                      )}

                      {s.level === 'declared' && (
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          {pending ? (
                            <span className="sk-status-badge status-under_review">
                              <span className="sk-status-dot" aria-hidden="true" />
                              Mentor review pending
                            </span>
                          ) : (
                            asking !== s.id && (
                              <button
                                type="button"
                                className="ob-inline-link-btn"
                                onClick={() => setAsking(s.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}
                              >
                                <GraduationCap size={14} aria-hidden="true" /> {review ? 'Re-request mentor' : 'Request mentor review'}
                              </button>
                            )
                          )}
                          {pending && (
                            <button type="button" className="ob-inline-link-btn" onClick={() => cancel(review)} style={{ fontSize: '0.8rem' }}>
                              Cancel request
                            </button>
                          )}
                        </div>
                      )}

                      {asking === s.id && (
                        <AskMentorForm
                          skill={s}
                          onCancel={() => setAsking(null)}
                          onSubmit={async (url, note) => {
                            const res = await requestMentorReview(userId, s, url, note);
                            if (res.error) return res.error;
                            setAsking(null);
                            await onChanged();
                            return '';
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function AskMentorForm({
  skill,
  onCancel,
  onSubmit,
}: {
  skill: PassportSkill;
  onCancel: () => void;
  onSubmit: (url: string, note: string) => Promise<string>;
}) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = `ask-${skill.id}`;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!URL_OK.test(url.trim())) {
      setError('Add a link that shows this skill, starting with https://.');
      return;
    }
    setBusy(true);
    const err = await onSubmit(url, note);
    setBusy(false);
    setError(err);
  }

  return (
    <form className="yg-ask-form" onSubmit={send} noValidate>
      <p className="ws-card-subtitle">
        Share work that shows <strong>{skill.skill_name}</strong>. A mentor reviews it and can mark the skill Assessed.
      </p>
      <div className="yw-form-group">
        <label className="yw-form-label" htmlFor={`${id}-url`}>
          Evidence link
        </label>
        <input
          id={`${id}-url`}
          className="yw-form-input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/you/project"
        />
      </div>
      <div className="yw-form-group">
        <label className="yw-form-label" htmlFor={`${id}-note`}>
          Note for the mentor (optional)
        </label>
        <textarea
          id={`${id}-note`}
          className="yw-form-textarea"
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What to look at, and what you built yourself"
        />
      </div>
      {error && (
        <p className="yw-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="yg-form-actions">
        <button type="button" className="ob-btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="ob-btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Request review'}
        </button>
      </div>
    </form>
  );
}
