import { useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ArrowRight, Clock,
  Star, Trophy, Calendar, Users, CheckCircle2,
  Video
} from 'lucide-react';
import { SHOWCASE_SECTIONS, type ShowcaseItem, type ShowcaseCategory } from './unstopData';
import { UnstopApplyModal } from './UnstopApplyModal';
import type { PassportSkill } from '../lib/database.types';
import type { SeekerTab } from './shared';

interface Props {
  userFullName: string;
  userSkills: PassportSkill[];
  onNavigate: (tab: SeekerTab) => void;
}

export function UnstopShowcase({ userFullName, userSkills, onNavigate }: Props) {
  const [selectedItem, setSelectedItem] = useState<ShowcaseItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reference map for scrolling horizontal lists
  const scrollContainers = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleScroll = (key: string, direction: 'left' | 'right') => {
    const el = scrollContainers.current[key];
    if (el) {
      const scrollAmount = 380;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleOpenApply = (item: ShowcaseItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const getSectionTargetTab = (category: ShowcaseCategory): SeekerTab => {
    switch (category) {
      case 'competitions':
        return 'tasks';
      case 'mentors':
        return 'mentors';
      case 'jobs':
        return 'opportunities';
      default:
        return 'overview';
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────
     1. MENTOR CARD RENDERER (Focused on Person, Avatar, Company, Bio, 1:1)
     ────────────────────────────────────────────────────────────────────────── */
  const renderMentorCard = (item: ShowcaseItem) => (
    <article
      key={item.id}
      className="unstop-card sk-mentor-card"
      onClick={() => handleOpenApply(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenApply(item);
        }
      }}
      aria-label={`Book 1-on-1 session with ${item.mentorName || item.organization}`}
    >
      {/* Top Bar: Avatar + Name + Role + Rating */}
      <div className="sk-mentor-header">
        <div className="sk-mentor-profile-group">
          <div
            className="sk-mentor-avatar"
            style={{ background: item.mentorAvatarGradient || item.logoBg }}
            aria-hidden="true"
          >
            <span>{item.mentorInitials || (item.mentorName ? item.mentorName.slice(0, 2).toUpperCase() : 'ME')}</span>
            <span className="sk-mentor-online-badge" title="Available for 1:1 sessions" />
          </div>
          <div className="sk-mentor-identity">
            <h4 className="sk-mentor-name">{item.mentorName || item.organization}</h4>
            <div className="sk-mentor-role-pill-row">
              <span className="sk-mentor-role-text">{item.mentorRole || item.roleType}</span>
              <span
                className="sk-mentor-company-chip"
                style={{ background: item.logoBg, color: item.logoColor }}
              >
                {item.mentorCompany || item.organization}
              </span>
            </div>
          </div>
        </div>

        <div className="sk-mentor-rating-box">
          <div className="sk-mentor-rating-score">
            <Star size={13} fill="#F59E0B" color="#F59E0B" />
            <span>{item.mentorRating || '4.98'}</span>
          </div>
          <span className="sk-mentor-reviews-count">({item.mentorReviewsCount || 80}+ reviews)</span>
        </div>
      </div>

      {/* Session Title & Bio */}
      <div className="sk-mentor-body">
        <div className="sk-mentor-session-title">
          <span className="sk-mentor-target-icon">🎯</span>
          <span className="sk-mentor-session-heading">{item.title}</span>
        </div>
        <p className="sk-mentor-bio">{item.mentorBio || item.description}</p>

        {/* Mentor Fee / Costing Highlight */}
        <div className="sk-mentor-price-banner">
          <div className="sk-mentor-price-left">
            <span className="sk-mentor-price-val">{item.mentorPrice || '₹1,499'}</span>
            <span className="sk-mentor-price-orig">{item.mentorOriginalPrice || '₹2,999'}</span>
            <span className="sk-mentor-discount-pill">{item.mentorDiscount || '50% OFF'}</span>
          </div>
          <span className="sk-mentor-session-fee-tag">1:1 Call Fee</span>
        </div>
      </div>

      {/* Skills / Topics */}
      <div className="unstop-card-skills">
        {item.skills.slice(0, 3).map((skill) => (
          <span key={skill} className="unstop-skill-chip sk-mentor-skill-chip">
            {skill}
          </span>
        ))}
        {item.skills.length > 3 && (
          <span className="unstop-skill-chip unstop-chip-more">
            +{item.skills.length - 3}
          </span>
        )}
      </div>

      {/* Bottom Row: Duration & Action */}
      <div className="unstop-card-bottom sk-mentor-bottom">
        <div className="sk-mentor-duration-pill">
          <Video size={13} className="sk-icon-blue" />
          <span>{item.sessionDuration || '45 mins · 1:1 Video'}</span>
        </div>
        <button
          type="button"
          className="unstop-apply-btn sk-mentor-cta"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenApply(item);
          }}
        >
          <span>Join for {item.mentorPrice || '₹1,499'}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );

  /* ──────────────────────────────────────────────────────────────────────────
     2. COMPETITION CARD RENDERER (Hackathons, Prizes, Deadlines)
     ────────────────────────────────────────────────────────────────────────── */
  const renderCompetitionCard = (item: ShowcaseItem) => (
    <article
      key={item.id}
      className="unstop-card sk-comp-card"
      onClick={() => handleOpenApply(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenApply(item);
        }
      }}
      aria-label={`View competition details for ${item.title}`}
    >
      {/* Top row: Brand & Urgency */}
      <div className="sk-comp-header">
        <div className="sk-comp-brand">
          <div
            className="unstop-card-logo"
            style={{ background: item.logoBg, color: item.logoColor }}
            aria-hidden="true"
          >
            {item.logoText}
          </div>
          <div>
            <span className="sk-comp-org">{item.organization}</span>
            <span className="sk-comp-badge-type">{item.roleType}</span>
          </div>
        </div>
        <span className="sk-comp-urgency-pill">
          ⚡ {item.urgencyDays || item.timeline}
        </span>
      </div>

      {/* Title */}
      <div className="sk-comp-body">
        <h4 className="unstop-card-title sk-comp-title" title={item.title}>
          {item.title}
        </h4>

        {/* Prize Pool Banner Ribbon */}
        <div className="sk-comp-prize-banner">
          <Trophy size={14} className="sk-trophy-icon" />
          <span className="sk-comp-prize-text">{item.prizePool || item.compensation}</span>
        </div>

        <div className="sk-comp-meta-row">
          <span className="sk-comp-stat">
            <Users size={12} /> {item.registeredCount || item.metaInfo}
          </span>
          <span className="sk-comp-stat">
            📍 {item.location}
          </span>
        </div>
      </div>

      {/* Skills tags */}
      <div className="unstop-card-skills">
        {item.skills.slice(0, 3).map((skill) => (
          <span key={skill} className="unstop-skill-chip">
            {skill}
          </span>
        ))}
        {item.skills.length > 3 && (
          <span className="unstop-skill-chip unstop-chip-more">
            +{item.skills.length - 3}
          </span>
        )}
      </div>

      {/* Bottom row: Timeline + Action Button */}
      <div className="unstop-card-bottom">
        <div className="unstop-card-timeline">
          <Calendar size={13} aria-hidden="true" />
          <span>{item.timeline}</span>
        </div>
        <button
          type="button"
          className="unstop-apply-btn sk-comp-cta"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenApply(item);
          }}
        >
          <span>Register Now</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );

  /* ──────────────────────────────────────────────────────────────────────────
     3. JOB OPENING CARD RENDERER (Role, Salary, Experience, Verified badge)
     ────────────────────────────────────────────────────────────────────────── */
  const renderJobCard = (item: ShowcaseItem) => (
    <article
      key={item.id}
      className="unstop-card sk-job-card"
      onClick={() => handleOpenApply(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenApply(item);
        }
      }}
      aria-label={`Apply for job ${item.title} at ${item.organization}`}
    >
      {/* Top row: Company Logo & Hiring status */}
      <div className="sk-job-header">
        <div className="sk-job-brand">
          <div
            className="unstop-card-logo"
            style={{ background: item.logoBg, color: item.logoColor }}
            aria-hidden="true"
          >
            {item.logoText}
          </div>
          <div>
            <div className="sk-job-company-name">
              <span>{item.organization}</span>
              <span title="Verified Employer" style={{ display: 'inline-flex' }}>
                <CheckCircle2 size={13} className="sk-verified-check" aria-hidden="true" />
              </span>
            </div>
            <span className="sk-job-location-text">{item.workMode || item.location}</span>
          </div>
        </div>
        <span className="sk-job-status-pill">
          {item.hiringStatus || item.metaInfo}
        </span>
      </div>

      {/* Title & Salary highlight */}
      <div className="sk-job-body">
        <h4 className="unstop-card-title sk-job-title" title={item.title}>
          {item.title}
        </h4>

        {/* Salary Banner */}
        <div className="sk-job-salary-banner">
          <span className="sk-job-salary-val">💰 {item.salaryRange || item.compensation}</span>
          <span className="sk-job-exp-pill">{item.experienceLevel || '2-4 yrs exp'}</span>
        </div>

        <p className="sk-job-desc-preview">{item.description}</p>
      </div>

      {/* Skills tags */}
      <div className="unstop-card-skills">
        {item.skills.slice(0, 3).map((skill) => (
          <span key={skill} className="unstop-skill-chip">
            {skill}
          </span>
        ))}
        {item.skills.length > 3 && (
          <span className="unstop-skill-chip unstop-chip-more">
            +{item.skills.length - 3}
          </span>
        )}
      </div>

      {/* Bottom row: Direct Founder / 48h SLA & Apply CTA */}
      <div className="unstop-card-bottom">
        <div className="unstop-card-timeline">
          <Clock size={13} aria-hidden="true" />
          <span>{item.timeline}</span>
        </div>
        <button
          type="button"
          className="unstop-apply-btn sk-job-cta"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenApply(item);
          }}
        >
          <span>Apply Now</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );

  return (
    <div className="unstop-showcase-container">
      {SHOWCASE_SECTIONS.map((section) => (
        <section key={section.key} className="unstop-section">
          {/* Section Header with vertical bar & View All button */}
          <div className="unstop-section-header">
            <div className="unstop-section-title-wrap">
              <div className="unstop-blue-bar" aria-hidden="true" />
              <div>
                <h3 className="unstop-section-title">{section.heading}</h3>
                <p className="unstop-section-subtitle">{section.subheading}</p>
              </div>
            </div>
            <div className="unstop-section-actions">
              <button
                type="button"
                className="unstop-view-all-pill"
                onClick={() => onNavigate(getSectionTargetTab(section.key))}
              >
                <span>View All</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
              <div className="unstop-nav-arrows">
                <button
                  type="button"
                  className="unstop-arrow-btn"
                  onClick={() => handleScroll(section.key, 'left')}
                  aria-label={`Scroll ${section.heading} left`}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="unstop-arrow-btn"
                  onClick={() => handleScroll(section.key, 'right')}
                  aria-label={`Scroll ${section.heading} right`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal scroll cards track */}
          <div
            className="unstop-cards-scroll-track"
            ref={(el) => {
              scrollContainers.current[section.key] = el;
            }}
          >
            {section.items.map((item) => {
              if (item.category === 'mentors') {
                return renderMentorCard(item);
              }
              if (item.category === 'competitions') {
                return renderCompetitionCard(item);
              }
              return renderJobCard(item);
            })}
          </div>
        </section>
      ))}

      {/* Interactive Application Modal */}
      <UnstopApplyModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userFullName={userFullName}
        userSkills={userSkills}
      />
    </div>
  );
}
