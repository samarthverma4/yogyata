import { useState, useEffect } from 'react';
import {
  X, Check, ArrowRight, ArrowLeft,
  Clock, Sparkles, AlertCircle, CheckCircle2,
  Calendar, Video, Globe, ShieldCheck,
  CreditCard, Trophy, Copy,
  MessageSquare, Briefcase
} from 'lucide-react';
import type { ShowcaseItem } from './unstopData';
import type { PassportSkill } from '../lib/database.types';

interface Props {
  item: ShowcaseItem | null;
  isOpen: boolean;
  onClose: () => void;
  userFullName: string;
  userSkills: PassportSkill[];
}

export function UnstopApplyModal({ item, isOpen, onClose, userFullName, userSkills }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // ── Mentor Paid Flow States ──
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [mentorNotes, setMentorNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('');

  // ── Competition Flow States ──
  const [participationMode, setParticipationMode] = useState<'solo' | 'team'>('solo');
  const [teamName, setTeamName] = useState('');
  const [teammateEmails, setTeammateEmails] = useState('');
  const [compGithubUrl, setCompGithubUrl] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [ideaPitch, setIdeaPitch] = useState('');
  const [agreeRules, setAgreeRules] = useState(true);

  // ── Job Flow States ──
  const [noticePeriod, setNoticePeriod] = useState('immediate');
  const [currentCtc, setCurrentCtc] = useState('12');
  const [expectedCtc, setExpectedCtc] = useState('26');
  const [jobPortfolioUrl, setJobPortfolioUrl] = useState('');
  const [screeningAnswer, setScreeningAnswer] = useState('');
  const [shareConsent, setShareConsent] = useState(true);

  // Reset or initialize when modal opens or item changes
  useEffect(() => {
    if (item) {
      setStep(1);
      setError('');
      setSubmitting(false);
      setCopiedLink(false);

      // Mentor defaults
      if (item.category === 'mentors' && item.mentorAvailableSlots && item.mentorAvailableSlots.length > 0) {
        setSelectedSlot(item.mentorAvailableSlots[0]);
      } else {
        setSelectedSlot('Tomorrow, 6:00 PM – 6:45 PM');
      }
      setMentorNotes('');
      setUpiId('');
      setPaymentMethod('upi');

      // Competition defaults
      setParticipationMode('solo');
      setTeamName('');
      setTeammateEmails('');
      setCompGithubUrl('');
      setSelectedTrack(item.competitionTrack || 'Core Challenge Track');
      setIdeaPitch('');
      setAgreeRules(true);

      // Job defaults
      setNoticePeriod('immediate');
      setJobPortfolioUrl('');
      setScreeningAnswer('');
      setShareConsent(true);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const userSkillNames = new Set(userSkills.map((s) => s.skill_name.toLowerCase()));

  const handleNext = () => {
    setError('');
    setStep(2);
  };

  const handleBack = () => {
    setError('');
    setStep(1);
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Submission handler for Mentor Paid Booking
  const handleMentorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select a preferred session slot.');
      return;
    }
    if (paymentMethod === 'upi' && !upiId.trim()) {
      setError('Please enter your UPI ID (e.g. yourname@okhdfcbank).');
      return;
    }
    setError('');
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setStep(3);
    }, 700);
  };

  // Submission handler for Competition Registration
  const handleCompetitionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (participationMode === 'team' && !teamName.trim()) {
      setError('Please provide a Team Name for your entry.');
      return;
    }
    if (!agreeRules) {
      setError('Please agree to the submission guidelines and anti-plagiarism pledge.');
      return;
    }
    setError('');
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setStep(3);
    }, 700);
  };

  // Submission handler for Job Application
  const handleJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!screeningAnswer.trim()) {
      setError('Please answer the role screening question before submitting.');
      return;
    }
    if (!shareConsent) {
      setError('Please check the box to authorize sharing your verified Skill Passport credentials.');
      return;
    }
    setError('');
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setStep(3);
    }, 700);
  };

  const handleResetAndClose = () => {
    setStep(1);
    setError('');
    setSubmitting(false);
    onClose();
  };

  const categoryBadge =
    item.category === 'mentors'
      ? 'Paid 1:1 Mentorship'
      : item.category === 'competitions'
      ? 'Hackathon Registration'
      : item.category === 'internships'
      ? 'Startup Paid Internship'
      : 'Verified Startup Job';

  /* ══════════════════════════════════════════════════════════════════════════
     FLOW A: MENTORS (PAID 1:1 BOOKING FLOW)
     ══════════════════════════════════════════════════════════════════════════ */
  const renderMentorFlow = () => {
    if (step === 1) {
      return (
        <div className="unstop-modal-step">
          {/* Mentor Profile Hero */}
          <div className="sk-modal-mentor-hero">
            <div
              className="sk-mentor-avatar"
              style={{
                background: item.mentorAvatarGradient || item.logoBg,
                width: 60,
                height: 60,
                fontSize: '1.3rem',
                flexShrink: 0,
              }}
            >
              <span>{item.mentorInitials || (item.mentorName ? item.mentorName.slice(0, 2).toUpperCase() : 'ME')}</span>
              <span className="sk-mentor-online-badge" />
            </div>
            <div className="unstop-modal-hero-info">
              <div className="sk-modal-mentor-title-row">
                <h3 id="showcase-modal-title" className="sk-modal-mentor-name">
                  {item.mentorName || item.organization}
                </h3>
                <span className="sk-mentor-company-chip" style={{ background: item.logoBg, color: item.logoColor }}>
                  {item.mentorCompany || item.organization}
                </span>
              </div>
              <span className="sk-mentor-role-subtitle">{item.mentorRole}</span>
              <p className="sk-modal-session-topic">
                🎯 <strong>{item.title}</strong>
              </p>
              <div className="unstop-modal-meta-pills">
                <span className="unstop-pill unstop-pill-yellow">
                  ⭐ {item.mentorRating || '4.98'} ({item.mentorReviewsCount || 80}+ reviews)
                </span>
                <span className="unstop-pill unstop-pill-blue">
                  <Video size={12} /> {item.sessionDuration || '45 mins · 1:1 Video'}
                </span>
              </div>
            </div>
          </div>

          {/* Costing / Fee Card */}
          <div className="sk-booking-cost-box">
            <div className="sk-booking-cost-header">
              <div>
                <span className="sk-booking-cost-label">Session Fee (1:1 Video Call)</span>
                <div className="sk-booking-cost-amount-row">
                  <span className="sk-booking-cost-val">{item.mentorPrice || '₹1,499'}</span>
                  <span className="sk-booking-cost-orig">{item.mentorOriginalPrice || '₹2,999'}</span>
                  <span className="sk-mentor-discount-pill">{item.mentorDiscount || '50% OFF'}</span>
                </div>
              </div>
              <span className="sk-booking-guarantee-pill">
                <ShieldCheck size={14} /> 100% Refundable
              </span>
            </div>
            <p className="sk-booking-cost-sub">
              Includes 45 minutes of direct 1-on-1 whiteboarding, personalized architecture critique, and follow-up resources.
            </p>
          </div>

          {/* Date & Time Slot Picker */}
          <div className="unstop-modal-section">
            <div className="sk-section-header-row">
              <h4 className="unstop-section-heading">
                <Calendar size={15} className="sk-inline-icon" /> Select Date & Time Slot
              </h4>
              <span className="sk-section-badge-info">All times in IST</span>
            </div>
            <div className="sk-slots-radio-grid">
              {(item.mentorAvailableSlots || [
                'Tomorrow, 6:00 PM – 6:45 PM',
                'Monday, 7:30 PM – 8:15 PM',
                'Wednesday, 6:00 PM – 6:45 PM',
                'Saturday, 11:00 AM – 11:45 AM',
              ]).map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <label
                    key={slot}
                    className={`sk-slot-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <input
                      type="radio"
                      name="mentor-slot"
                      value={slot}
                      checked={isSelected}
                      onChange={() => setSelectedSlot(slot)}
                      className="sk-hidden-radio"
                    />
                    <div className="sk-slot-card-content">
                      <div className="sk-slot-radio-circle">
                        {isSelected && <span className="sk-slot-radio-dot" />}
                      </div>
                      <div className="sk-slot-info">
                        <span className="sk-slot-time-text">{slot}</span>
                        <span className="sk-slot-status-text">⚡ Instant Confirmation</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Agenda & What's Covered */}
          <div className="unstop-modal-section">
            <h4 className="unstop-section-heading">What you will get from this session</h4>
            <ul className="unstop-perks-list">
              {(item.mentorSessionTopics || item.perks).map((topic, i) => (
                <li key={i}>
                  <Check size={14} className="unstop-check-icon" />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="unstop-modal-footer">
            <div className="unstop-modal-footer-note">
              <Clock size={14} />
              <span>{item.timeline}</span>
            </div>
            <button
              type="button"
              className="ob-btn-primary unstop-modal-cta"
              onClick={handleNext}
            >
              <span>Proceed to Booking ({item.mentorPrice || '₹1,499'})</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <form onSubmit={handleMentorSubmit} className="unstop-modal-step">
          <div className="unstop-form-intro">
            <h3 className="unstop-step2-title">
              Complete Booking with {item.mentorName}
            </h3>
            <p className="unstop-step2-sub">
              Confirm your agenda questions and complete checkout to lock in your slot.
            </p>
          </div>

          {/* Slot Confirmation Banner */}
          <div className="sk-selected-slot-banner">
            <Calendar size={18} className="sk-icon-blue" />
            <div>
              <span className="sk-selected-slot-label">Reserved Time Slot:</span>
              <strong className="sk-selected-slot-val">{selectedSlot}</strong>
            </div>
          </div>

          {error && (
            <div className="yw-alert yw-alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Agenda Notes / Pitch */}
          <div className="ob-field-group">
            <label className="ob-label" htmlFor="mentor-notes">
              What specific topics, doubts, or project links would you like to review?
              <span className="ob-required-star"> *</span>
            </label>
            <textarea
              id="mentor-notes"
              className="ob-input"
              rows={3}
              placeholder="e.g. I want to simulate an L5 System Design interview for ride matching, plus review my GitHub project architecture."
              value={mentorNotes}
              onChange={(e) => setMentorNotes(e.target.value)}
              style={{ height: 'auto', minHeight: '80px', padding: '12px' }}
            />
            <div className="unstop-pitch-chips">
              <span className="unstop-pitch-chip-label">Quick topics:</span>
              {[
                'System Design Whiteboard Mock',
                'Code review on my GitHub repo',
                'Resume & portfolio critique',
                'Offer & equity negotiation tips',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="ob-preset-pill"
                  onClick={() => setMentorNotes((prev) => (prev ? `${prev} · ${preset}` : preset))}
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Order Summary Breakdown */}
          <div className="sk-order-summary-card">
            <h4 className="sk-order-summary-title">Payment Summary</h4>
            <div className="sk-order-row">
              <span>1:1 Mentorship Session (45 Mins)</span>
              <span>{item.mentorPrice || '₹1,499'}</span>
            </div>
            <div className="sk-order-row sk-order-discount">
              <span>Yogyata Subsidy / Platform Fee</span>
              <span>₹0 (Waived)</span>
            </div>
            <div className="sk-order-row sk-order-total">
              <strong>Total Payable</strong>
              <strong className="sk-total-price">{item.mentorPrice || '₹1,499'}</strong>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="ob-field-group">
            <label className="ob-label">Choose Payment Method</label>
            <div className="sk-payment-tabs">
              <button
                type="button"
                className={`sk-pay-tab ${paymentMethod === 'upi' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('upi')}
              >
                <span>⚡ UPI (GPay/PhonePe/Paytm)</span>
              </button>
              <button
                type="button"
                className={`sk-pay-tab ${paymentMethod === 'card' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard size={14} />
                <span>Credit / Debit Card</span>
              </button>
              <button
                type="button"
                className={`sk-pay-tab ${paymentMethod === 'netbanking' ? 'is-active' : ''}`}
                onClick={() => setPaymentMethod('netbanking')}
              >
                <span>🏦 NetBanking</span>
              </button>
            </div>

            {paymentMethod === 'upi' && (
              <div className="sk-upi-input-box">
                <input
                  type="text"
                  className="ob-input"
                  placeholder="Enter UPI ID (e.g. username@okhdfcbank)"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
                <div className="sk-quick-upi-chips">
                  {['@okhdfcbank', '@oksbi', '@ybl', '@paytm'].map((handle) => (
                    <button
                      key={handle}
                      type="button"
                      className="sk-upi-chip"
                      onClick={() => setUpiId((prev) => (prev ? prev.split('@')[0] + handle : `user${handle}`))}
                    >
                      {handle}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="sk-simulated-card-box">
                <input type="text" className="ob-input" placeholder="Card Number (4111 2222 3333 4444)" defaultValue="4111 •••• •••• 9081" />
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <input type="text" className="ob-input" placeholder="MM/YY" defaultValue="08/28" style={{ flex: 1 }} />
                  <input type="text" className="ob-input" placeholder="CVV" defaultValue="•••" style={{ width: '80px' }} />
                </div>
              </div>
            )}

            {paymentMethod === 'netbanking' && (
              <select className="ob-select" style={{ marginTop: '8px' }}>
                <option>HDFC Bank (Instant Approval)</option>
                <option>ICICI Bank</option>
                <option>State Bank of India (SBI)</option>
                <option>Axis Bank</option>
              </select>
            )}
          </div>

          <div className="unstop-consent-box">
            <span className="sk-security-guarantee">
              <ShieldCheck size={16} className="sk-icon-green" />
              <span>
                100% Money-Back Guarantee: If {item.mentorName || 'the mentor'} is unable to attend, your {item.mentorPrice || '₹1,499'} is refunded automatically to source.
              </span>
            </span>
          </div>

          <div className="unstop-modal-footer">
            <button
              type="button"
              className="ob-btn-secondary"
              onClick={handleBack}
              disabled={submitting}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="submit"
              className="ob-btn-primary unstop-modal-cta"
              disabled={submitting}
            >
              {submitting ? (
                <span>Authorizing Payment…</span>
              ) : (
                <>
                  <span>Pay {item.mentorPrice || '₹1,499'} & Confirm Slot</span>
                  <Sparkles size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      );
    }

    // Step 3: Confirmed Booking Pass
    return (
      <div className="unstop-modal-step unstop-modal-success">
        <div className="unstop-success-icon-wrap">
          <CheckCircle2 size={54} className="unstop-success-icon" />
        </div>
        <h3 className="unstop-success-title">1:1 Session Confirmed!</h3>
        <p className="unstop-success-sub">
          Your payment of <strong>{item.mentorPrice || '₹1,499'}</strong> was successful. Calendar invitation dispatched.
        </p>

        {/* Digital Booking Pass */}
        <div className="sk-booking-pass-card">
          <div className="sk-pass-header">
            <div>
              <span className="sk-pass-type-badge">TOPMATE 1:1 PASS</span>
              <h4 className="sk-pass-mentor-name">{item.mentorName}</h4>
              <span className="sk-pass-mentor-title">{item.mentorRole} @ {item.mentorCompany}</span>
            </div>
            <div className="sk-pass-price-stamp">{item.mentorPrice || '₹1,499'} PAID</div>
          </div>

          <div className="sk-pass-body">
            <div className="sk-pass-grid">
              <div className="sk-pass-field">
                <span className="sk-pass-label">CONFIRMED TIME</span>
                <strong className="sk-pass-val">{selectedSlot}</strong>
              </div>
              <div className="sk-pass-field">
                <span className="sk-pass-label">BOOKING ID</span>
                <strong className="sk-pass-val">BK-{item.organization.toUpperCase()}-89241</strong>
              </div>
            </div>

            <div className="sk-pass-meet-box">
              <div className="sk-pass-meet-left">
                <Video size={16} className="sk-icon-blue" />
                <span className="sk-meet-url">meet.google.com/ygy-uber-748</span>
              </div>
              <button
                type="button"
                className="sk-copy-btn"
                onClick={() => handleCopyLink('https://meet.google.com/ygy-uber-748')}
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="unstop-modal-footer" style={{ justifyContent: 'center', gap: '12px' }}>
          <button
            type="button"
            className="ob-btn-secondary"
            onClick={() => alert('Calendar invite (.ics) downloaded to your device!')}
          >
            <Calendar size={15} />
            <span>Add to Calendar</span>
          </button>
          <button
            type="button"
            className="ob-btn-primary"
            onClick={handleResetAndClose}
            style={{ minWidth: '140px' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     FLOW B: COMPETITIONS (REAL HACKATHON REGISTRATION FLOW)
     ══════════════════════════════════════════════════════════════════════════ */
  const renderCompetitionFlow = () => {
    if (step === 1) {
      return (
        <div className="unstop-modal-step">
          {/* Hackathon Hero Banner */}
          <div className="unstop-modal-hero">
            <div
              className="unstop-modal-logo"
              style={{ background: item.logoBg, color: item.logoColor }}
            >
              {item.logoText}
            </div>
            <div className="unstop-modal-hero-info">
              <span className="unstop-modal-org">{item.organization}</span>
              <h3 id="showcase-modal-title" className="unstop-modal-title">{item.title}</h3>
              <div className="unstop-modal-meta-pills">
                <span className="unstop-pill unstop-pill-green">
                  🏆 {item.prizePool || item.compensation}
                </span>
                <span className="unstop-pill unstop-pill-blue">
                  ⚡ {item.urgencyDays || item.timeline}
                </span>
                <span className="unstop-pill unstop-pill-gray">
                  👥 {item.registeredCount || '300+ Teams'}
                </span>
              </div>
            </div>
          </div>

          {/* Track and Problem Statement */}
          <div className="unstop-modal-section">
            <div className="sk-section-header-row">
              <h4 className="unstop-section-heading">Challenge Track & Problem Brief</h4>
              <span className="sk-comp-track-badge">{item.competitionTrack || 'Open Innovation'}</span>
            </div>
            <p className="unstop-modal-desc">{item.description}</p>
          </div>

          {/* Evaluation Rubric */}
          <div className="unstop-modal-section">
            <h4 className="unstop-section-heading">Evaluation Rubric & Judging Criteria</h4>
            <div className="sk-rubric-grid">
              <div className="sk-rubric-item">
                <span className="sk-rubric-percent">40%</span>
                <div className="sk-rubric-text">
                  <strong>Code Quality & Architecture</strong>
                  <p>Clean structure, test coverage, and documentation.</p>
                </div>
              </div>
              <div className="sk-rubric-item">
                <span className="sk-rubric-percent">35%</span>
                <div className="sk-rubric-text">
                  <strong>Execution & Polish</strong>
                  <p>Responsiveness, error handling, and visual micro-interactions.</p>
                </div>
              </div>
              <div className="sk-rubric-item">
                <span className="sk-rubric-percent">25%</span>
                <div className="sk-rubric-text">
                  <strong>Scalability & Concurrency</strong>
                  <p>System throughput, caching, and database hygiene.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Perks & Awards */}
          <div className="unstop-modal-section">
            <h4 className="unstop-section-heading">Prizes & Pre-Placement Perks</h4>
            <ul className="unstop-perks-list">
              {item.perks.map((perk, i) => (
                <li key={i}>
                  <Check size={14} className="unstop-check-icon" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="unstop-modal-footer">
            <div className="unstop-modal-footer-note">
              <Clock size={14} />
              <span>{item.timeline}</span>
            </div>
            <button
              type="button"
              className="ob-btn-primary unstop-modal-cta"
              onClick={handleNext}
            >
              <span>Register for Challenge</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <form onSubmit={handleCompetitionSubmit} className="unstop-modal-step">
          <div className="unstop-form-intro">
            <h3 className="unstop-step2-title">
              Register for {item.title}
            </h3>
            <p className="unstop-step2-sub">
              Enter your team participation mode, GitHub handle, and initial idea direction.
            </p>
          </div>

          {error && (
            <div className="yw-alert yw-alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Participation Mode: Solo vs Team */}
          <div className="ob-field-group">
            <label className="ob-label">Participation Mode</label>
            <div className="sk-mode-selector-row">
              <label
                className={`sk-mode-card ${participationMode === 'solo' ? 'is-selected' : ''}`}
                onClick={() => setParticipationMode('solo')}
              >
                <input
                  type="radio"
                  name="comp-mode"
                  checked={participationMode === 'solo'}
                  onChange={() => setParticipationMode('solo')}
                  className="sk-hidden-radio"
                />
                <div className="sk-mode-card-content">
                  <span className="sk-mode-icon">👤</span>
                  <div>
                    <strong className="sk-mode-title">Solo Hacker</strong>
                    <p className="sk-mode-desc">Build and submit individually as a single contributor.</p>
                  </div>
                </div>
              </label>

              <label
                className={`sk-mode-card ${participationMode === 'team' ? 'is-selected' : ''}`}
                onClick={() => setParticipationMode('team')}
              >
                <input
                  type="radio"
                  name="comp-mode"
                  checked={participationMode === 'team'}
                  onChange={() => setParticipationMode('team')}
                  className="sk-hidden-radio"
                />
                <div className="sk-mode-card-content">
                  <span className="sk-mode-icon">👥</span>
                  <div>
                    <strong className="sk-mode-title">Team Entry (2–4 Members)</strong>
                    <p className="sk-mode-desc">Collaborate with peers. Share project repository & prizes.</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Team Fields (if team selected) */}
          {participationMode === 'team' && (
            <div className="sk-team-inputs-box">
              <div className="ob-field-group">
                <label className="ob-label" htmlFor="comp-team-name">
                  Team Name <span className="ob-required-star">*</span>
                </label>
                <input
                  id="comp-team-name"
                  type="text"
                  className="ob-input"
                  placeholder="e.g. ByteCrafters Labs"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>

              <div className="ob-field-group" style={{ marginTop: '10px' }}>
                <label className="ob-label" htmlFor="comp-teammates">
                  Teammate Emails / Yogyata Handles (Optional)
                </label>
                <input
                  id="comp-teammates"
                  type="text"
                  className="ob-input"
                  placeholder="e.g. aman@gmail.com, priya@yogyata.io"
                  value={teammateEmails}
                  onChange={(e) => setTeammateEmails(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Challenge Track */}
          <div className="ob-field-group">
            <label className="ob-label" htmlFor="comp-track-input">
              Confirmed Challenge Track
            </label>
            <input
              id="comp-track-input"
              type="text"
              className="ob-input"
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
            />
          </div>

          {/* GitHub Profile */}
          <div className="ob-field-group">
            <label className="ob-label" htmlFor="comp-github">
              GitHub Profile or Primary Repository URL <span className="ob-required-star">*</span>
            </label>
            <div className="ob-input-icon-left">
              <span className="ob-field-left-icon">
                <Globe size={16} />
              </span>
              <input
                id="comp-github"
                type="url"
                className="ob-input"
                placeholder="https://github.com/your-username"
                value={compGithubUrl}
                onChange={(e) => setCompGithubUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Preliminary Technical Approach Pitch */}
          <div className="ob-field-group">
            <label className="ob-label" htmlFor="comp-idea">
              Preliminary Technical Approach & Proposed Stack
            </label>
            <textarea
              id="comp-idea"
              className="ob-input"
              rows={3}
              placeholder="Briefly describe the architectural approach you plan to implement (e.g. state machines, concurrency primitives, caching layer)..."
              value={ideaPitch}
              onChange={(e) => setIdeaPitch(e.target.value)}
              style={{ height: 'auto', minHeight: '75px', padding: '12px' }}
            />
            <div className="unstop-pitch-chips">
              <span className="unstop-pitch-chip-label">Smart fill:</span>
              {[
                'React 19 + Framer Motion 60fps physics',
                'Go channels + distributed double-entry ledger',
                'FastAPI + vector embeddings with Redis caching',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="ob-preset-pill"
                  onClick={() => setIdeaPitch((prev) => (prev ? `${prev} · ${preset}` : preset))}
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Rules Checkbox */}
          <div className="unstop-consent-box">
            <label className="ob-checkbox-label">
              <input
                type="checkbox"
                checked={agreeRules}
                onChange={(e) => setAgreeRules(e.target.checked)}
                className="ob-checkbox-input"
              />
              <span className="ob-checkbox-box" />
              <span className="ob-checkbox-text">
                I agree to the challenge rules, pledge original code submission, and accept anti-plagiarism guidelines.
              </span>
            </label>
          </div>

          <div className="unstop-modal-footer">
            <button
              type="button"
              className="ob-btn-secondary"
              onClick={handleBack}
              disabled={submitting}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="submit"
              className="ob-btn-primary unstop-modal-cta"
              disabled={submitting}
            >
              {submitting ? (
                <span>Generating Ticket…</span>
              ) : (
                <>
                  <span>Submit & Claim Hacker Ticket</span>
                  <Trophy size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      );
    }

    // Step 3: Official Hackathon Pass
    return (
      <div className="unstop-modal-step unstop-modal-success">
        <div className="unstop-success-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
          <Trophy size={50} />
        </div>
        <h3 className="unstop-success-title">You're Officially Registered!</h3>
        <p className="unstop-success-sub">
          Your entry for <strong>{item.title}</strong> is locked in. Welcome to the challenge sprint!
        </p>

        {/* Digital Hackathon Ticket */}
        <div className="sk-hackathon-ticket-box">
          <div className="sk-ticket-header">
            <div>
              <span className="sk-ticket-badge">OFFICIAL HACKER PASS</span>
              <h4 className="sk-ticket-title">{item.title}</h4>
              <span className="sk-ticket-org">Organized by {item.organization}</span>
            </div>
            <div className="sk-ticket-badge-pill">ACTIVE PASS</div>
          </div>

          <div className="sk-ticket-body">
            <div className="sk-ticket-grid">
              <div className="sk-ticket-col">
                <span className="sk-ticket-label">PARTICIPANT</span>
                <strong className="sk-ticket-val">
                  {participationMode === 'team' ? `${teamName || 'Team'} (${userFullName})` : userFullName}
                </strong>
              </div>
              <div className="sk-ticket-col">
                <span className="sk-ticket-label">TICKET ID</span>
                <strong className="sk-ticket-val">HACK-{item.organization.toUpperCase()}-5829</strong>
              </div>
              <div className="sk-ticket-col">
                <span className="sk-ticket-label">TRACK</span>
                <strong className="sk-ticket-val">{item.competitionTrack || 'Open Tech'}</strong>
              </div>
              <div className="sk-ticket-col">
                <span className="sk-ticket-label">PHASE 1 START</span>
                <strong className="sk-ticket-val" style={{ color: '#059669' }}>Tomorrow, 10:00 AM IST</strong>
              </div>
            </div>

            <div className="sk-ticket-actions-row">
              <a
                href="#discord"
                className="sk-ticket-btn sk-ticket-discord"
                onClick={(e) => {
                  e.preventDefault();
                  alert(`Joined Discord Channel: ${item.discordChannel || '#hackathon-sprint'}`);
                }}
              >
                <MessageSquare size={14} />
                <span>Join Discord ({item.discordChannel || '#hackathon'})</span>
              </a>
              <a
                href="#repo"
                className="sk-ticket-btn sk-ticket-repo"
                onClick={(e) => {
                  e.preventDefault();
                  alert(`Starter Kit repository link copied: https://${item.starterRepoUrl}`);
                }}
              >
                <Globe size={14} />
                <span>Starter Kit Repo</span>
              </a>
            </div>
          </div>
        </div>

        <div className="unstop-modal-footer" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="ob-btn-primary"
            onClick={handleResetAndClose}
            style={{ minWidth: '160px' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════════════════════
     FLOW C: JOBS (REAL STARTUP JOB APPLICATION FLOW WITH 48H SLA)
     ══════════════════════════════════════════════════════════════════════════ */
  const renderJobFlow = () => {
    if (step === 1) {
      return (
        <div className="unstop-modal-step">
          {/* Job Hero Header */}
          <div className="unstop-modal-hero">
            <div
              className="unstop-modal-logo"
              style={{ background: item.logoBg, color: item.logoColor }}
            >
              {item.logoText}
            </div>
            <div className="unstop-modal-hero-info">
              <span className="unstop-modal-org">{item.organization}</span>
              <h3 id="showcase-modal-title" className="unstop-modal-title">{item.title}</h3>
              <div className="unstop-modal-meta-pills">
                <span className="unstop-pill unstop-pill-green">
                  {item.category === 'internships'
                    ? `💰 Stipend: ${item.stipendAmount || item.compensation}`
                    : `💰 ${item.salaryRange || item.compensation}`}
                </span>
                <span className="unstop-pill unstop-pill-blue">
                  {item.category === 'internships'
                    ? `🎓 ${item.durationMonths || '6 Months'} (${item.batchEligibility || 'Eligible Batch'})`
                    : `📍 ${item.workMode || item.location}`}
                </span>
                <span className="unstop-pill unstop-pill-purple">
                  ⚡ {item.hiringStatus || 'Actively Hiring'}
                </span>
              </div>
            </div>
          </div>

          {/* Skill Passport Fit Score Highlight */}
          <div className="sk-passport-match-card">
            <div className="sk-passport-match-left">
              <div className="sk-match-circle">
                <span className="sk-match-number">{item.matchScorePercent || 92}%</span>
                <span className="sk-match-label">Fit</span>
              </div>
              <div>
                <strong className="sk-passport-match-title">Strong Skill Passport Alignment</strong>
                <p className="sk-passport-match-sub">
                  Your verified test benchmark scores match {item.organization}’s engineering standards.
                </p>
              </div>
            </div>
            <span className="sk-fast-track-pill">⚡ Fast-Track Pipeline</span>
          </div>

          {/* Required Competencies with Live Verification Status */}
          <div className="unstop-modal-section">
            <div className="unstop-skills-header">
              <h4 className="unstop-section-heading">Required Competencies</h4>
              <span className="unstop-skills-passport-note">Checked with Skill Passport</span>
            </div>
            <div className="unstop-skills-grid">
              {item.skills.map((skill) => {
                const hasSkill = userSkillNames.has(skill.toLowerCase());
                return (
                  <span
                    key={skill}
                    className={`unstop-skill-badge ${hasSkill ? 'is-matched' : ''}`}
                  >
                    {hasSkill ? '✓ Verified' : '+ Required'} : {skill}
                  </span>
                );
              })}
            </div>
          </div>

          {/* About Role & Responsibilities */}
          <div className="unstop-modal-section">
            <h4 className="unstop-section-heading">Role Scope & Engineering Impact</h4>
            <p className="unstop-modal-desc">{item.description}</p>
          </div>

          {/* Perks */}
          <div className="unstop-modal-section">
            <h4 className="unstop-section-heading">Company Perks & Benefits</h4>
            <ul className="unstop-perks-list">
              {item.perks.map((perk, i) => (
                <li key={i}>
                  <Check size={14} className="unstop-check-icon" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="unstop-modal-footer">
            <div className="unstop-modal-footer-note">
              <Clock size={14} />
              <span>{item.timeline}</span>
            </div>
            <button
              type="button"
              className="ob-btn-primary unstop-modal-cta"
              onClick={handleNext}
            >
              <span>Apply with Skill Passport</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <form onSubmit={handleJobSubmit} className="unstop-modal-step">
          <div className="unstop-form-intro">
            <h3 className="unstop-step2-title">
              Apply to {item.organization}
            </h3>
            <p className="unstop-step2-sub">
              Your verified Skill Passport credentials will be directly transmitted to the hiring lead.
            </p>
          </div>

          {error && (
            <div className="yw-alert yw-alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Applicant & Notice Period Row */}
          <div className="ob-form-row">
            <div className="ob-field-group" style={{ flex: 1 }}>
              <label className="ob-label" htmlFor="job-applicant-name">Applicant Name</label>
              <input
                id="job-applicant-name"
                type="text"
                className="ob-input"
                value={userFullName || 'Yogyata Candidate'}
                disabled
                style={{ background: '#F1F5F9', color: '#475569' }}
              />
            </div>
            <div className="ob-field-group" style={{ flex: 1 }}>
              <label className="ob-label" htmlFor="job-notice-period">
                Notice Period / Earliest Join Date <span className="ob-required-star">*</span>
              </label>
              <select
                id="job-notice-period"
                className="ob-select"
                value={noticePeriod}
                onChange={(e) => setNoticePeriod(e.target.value)}
              >
                <option value="immediate">⚡ Immediate (Within 7 Days)</option>
                <option value="15-days">📅 15 Days</option>
                <option value="30-days">🗓 30 Days (Standard Notice)</option>
                <option value="60-days">60 Days Notice</option>
                <option value="flexible">✨ Flexible / Serving Notice</option>
              </select>
            </div>
          </div>

          {/* Compensation or College Info Row */}
          {item.category === 'internships' ? (
            <div className="ob-form-row">
              <div className="ob-field-group" style={{ flex: 1 }}>
                <label className="ob-label" htmlFor="intern-college">College / University</label>
                <input
                  id="intern-college"
                  type="text"
                  className="ob-input"
                  placeholder="e.g. IIT Delhi, BITS Pilani, NIT Trichy, Delhi University"
                  defaultValue="National Institute of Technology"
                />
              </div>
              <div className="ob-field-group" style={{ flex: 1 }}>
                <label className="ob-label" htmlFor="intern-batch">
                  Graduation Batch <span className="ob-required-star">*</span>
                </label>
                <select id="intern-batch" className="ob-select" defaultValue="2025">
                  <option value="2024">2024 (Immediate Full-Time / PPO)</option>
                  <option value="2025">2025 (Pre-final / Final Year)</option>
                  <option value="2026">2026 (Undergrad Internship)</option>
                  <option value="2027">2027 (Summer Internship)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="ob-form-row">
              <div className="ob-field-group" style={{ flex: 1 }}>
                <label className="ob-label" htmlFor="job-current-ctc">Current CTC (in ₹ LPA)</label>
                <input
                  id="job-current-ctc"
                  type="number"
                  className="ob-input"
                  placeholder="e.g. 14"
                  value={currentCtc}
                  onChange={(e) => setCurrentCtc(e.target.value)}
                />
              </div>
              <div className="ob-field-group" style={{ flex: 1 }}>
                <label className="ob-label" htmlFor="job-expected-ctc">
                  Expected CTC (in ₹ LPA) <span className="ob-required-star">*</span>
                </label>
                <input
                  id="job-expected-ctc"
                  type="number"
                  className="ob-input"
                  placeholder="e.g. 26"
                  value={expectedCtc}
                  onChange={(e) => setExpectedCtc(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Portfolio or GitHub URL */}
          <div className="ob-field-group">
            <label className="ob-label" htmlFor="job-portfolio-link">
              GitHub Profile / Live Project Portfolio URL <span className="ob-required-star">*</span>
            </label>
            <div className="ob-input-icon-left">
              <span className="ob-field-left-icon">
                <Globe size={16} />
              </span>
              <input
                id="job-portfolio-link"
                type="url"
                className="ob-input"
                placeholder="https://github.com/your-username or portfolio.dev"
                value={jobPortfolioUrl}
                onChange={(e) => setJobPortfolioUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Role Screening Question */}
          <div className="ob-field-group">
            <label className="ob-label" htmlFor="job-screening">
              {item.jobScreeningQuestion || 'Why are you a great fit for this position and team?'}
              <span className="ob-required-star"> *</span>
            </label>
            <textarea
              id="job-screening"
              className="ob-input"
              rows={3}
              placeholder="Highlight relevant production systems you have shipped, optimization metrics, or key architectural decisions..."
              value={screeningAnswer}
              onChange={(e) => setScreeningAnswer(e.target.value)}
              style={{ height: 'auto', minHeight: '80px', padding: '12px' }}
            />
            <div className="unstop-pitch-chips">
              <span className="unstop-pitch-chip-label">Smart fill:</span>
              {[
                'Optimized web vitals resulting in 40% lower LCP',
                'Built idempotent transaction flows with 99.99% uptime',
                'Architected microservices handling 50k requests/sec',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="ob-preset-pill"
                  onClick={() => setScreeningAnswer((prev) => (prev ? `${prev} ${preset}.` : `${preset}.`))}
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Verification Consent */}
          <div className="unstop-consent-box">
            <label className="ob-checkbox-label">
              <input
                type="checkbox"
                checked={shareConsent}
                onChange={(e) => setShareConsent(e.target.checked)}
                className="ob-checkbox-input"
              />
              <span className="ob-checkbox-box" />
              <span className="ob-checkbox-text">
                Authorize <strong>{item.organization}</strong> to inspect my verified Yogyata Skill Passport benchmark scores and code hygiene metrics.
              </span>
            </label>
          </div>

          <div className="unstop-modal-footer">
            <button
              type="button"
              className="ob-btn-secondary"
              onClick={handleBack}
              disabled={submitting}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="submit"
              className="ob-btn-primary unstop-modal-cta"
              disabled={submitting}
            >
              {submitting ? (
                <span>Submitting to Hiring Lead…</span>
              ) : (
                <>
                  <span>
                    {item.category === 'internships'
                      ? 'Submit Internship Application'
                      : 'Submit Official Application'}
                  </span>
                  <Briefcase size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      );
    }

    // Step 3: Recruiter SLA Tracker Receipt
    return (
      <div className="unstop-modal-step unstop-modal-success">
        <div className="unstop-success-icon-wrap">
          <CheckCircle2 size={54} className="unstop-success-icon" />
        </div>
        <h3 className="unstop-success-title">
          {item.category === 'internships'
            ? 'Internship Application Transmitted!'
            : 'Application Submitted!'}
        </h3>
        <p className="unstop-success-sub">
          Your profile and verified Skill Passport have been queued directly for the <strong>{item.organization}</strong> hiring lead.
        </p>

        {/* Real Application Tracker Receipt */}
        <div className="unstop-success-receipt">
          <div className="unstop-receipt-row">
            <span className="unstop-receipt-label">APPLICATION REF</span>
            <span className="unstop-receipt-val">APP-{item.organization.toUpperCase()}-94812</span>
          </div>
          <div className="unstop-receipt-row">
            <span className="unstop-receipt-label">ROLE APPLIED</span>
            <span className="unstop-receipt-val">{item.title}</span>
          </div>
          <div className="unstop-receipt-row">
            <span className="unstop-receipt-label">STATUS</span>
            <span className="unstop-receipt-val" style={{ color: '#059669', fontWeight: 800 }}>
              ● Under Recruiter Review (48h SLA)
            </span>
          </div>
          <div className="unstop-receipt-row">
            <span className="unstop-receipt-label">
              {item.category === 'internships' ? 'STIPEND' : 'EXPECTED CTC'}
            </span>
            <span className="unstop-receipt-val">
              {item.category === 'internships'
                ? item.stipendAmount || item.compensation
                : `₹${expectedCtc || '26'} LPA`}
            </span>
          </div>
        </div>

        {/* 4-Stage Hiring Tracker */}
        <div className="sk-job-pipeline-tracker">
          <div className="sk-pipeline-step is-complete">
            <div className="sk-pipeline-dot">✓</div>
            <div className="sk-pipeline-info">
              <strong>Application & Passport Dispatched</strong>
              <p>Verified profile & test rubric sent to hiring team.</p>
            </div>
          </div>
          <div className="sk-pipeline-step is-current">
            <div className="sk-pipeline-dot">●</div>
            <div className="sk-pipeline-info">
              <strong>Recruiter Review (48h SLA)</strong>
              <p>Staff engineering manager is reviewing your code evidence.</p>
            </div>
          </div>
          <div className="sk-pipeline-step">
            <div className="sk-pipeline-dot">3</div>
            <div className="sk-pipeline-info">
              <strong>Technical Interview / Architecture Round</strong>
              <p>Direct Google Meet invite upon scorecard clearance.</p>
            </div>
          </div>
          <div className="sk-pipeline-step">
            <div className="sk-pipeline-dot">4</div>
            <div className="sk-pipeline-info">
              <strong>Offer & Equity Discussion</strong>
              <p>Final salary & ESOP breakdown with founders.</p>
            </div>
          </div>
        </div>

        <div className="unstop-modal-footer" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="ob-btn-primary"
            onClick={handleResetAndClose}
            style={{ minWidth: '160px' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="showcase-modal-title">
      <div className="yw-modal-box unstop-modal-box">
        {/* Top Header */}
        <div className="unstop-modal-header">
          <div className="unstop-modal-step-indicator">
            <span className="unstop-modal-type-badge">{categoryBadge}</span>
            <div className="unstop-step-dots">
              <span className={`unstop-step-dot ${step >= 1 ? 'is-active' : ''}`}>1</span>
              <span className="unstop-step-line" />
              <span className={`unstop-step-dot ${step >= 2 ? 'is-active' : ''}`}>2</span>
              <span className="unstop-step-line" />
              <span className={`unstop-step-dot ${step >= 3 ? 'is-active' : ''}`}>3</span>
            </div>
          </div>
          <button
            type="button"
            className="yw-modal-close-btn"
            onClick={handleResetAndClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Dynamic Body */}
        <div className="unstop-modal-body">
          {item.category === 'mentors' && renderMentorFlow()}
          {item.category === 'competitions' && renderCompetitionFlow()}
          {(item.category === 'jobs' || item.category === 'internships') && renderJobFlow()}
        </div>
      </div>
    </div>
  );
}
