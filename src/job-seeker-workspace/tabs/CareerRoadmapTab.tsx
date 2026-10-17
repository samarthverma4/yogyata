import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  X,
  Edit2,
} from 'lucide-react';
import type { RoadmapMilestone, RoadmapCategory } from '../types';

interface CareerRoadmapTabProps {
  primaryRole: string;
  roadmap: RoadmapMilestone[];
  onToggleMilestone: (id: string) => void;
  onAddPersonalGoal: (goal: Omit<RoadmapMilestone, 'id' | 'completed' | 'completedDate' | 'isPersonalGoal'>) => void;
  onUpdateGoal: (id: string, updated: Partial<RoadmapMilestone>) => void;
  onDeleteGoal: (id: string) => void;
}

export const CareerRoadmapTab: React.FC<CareerRoadmapTabProps> = ({
  primaryRole,
  roadmap,
  onToggleMilestone,
  onAddPersonalGoal,
  onUpdateGoal,
  onDeleteGoal,
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'pending' | 'completed'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  // New goal form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RoadmapCategory>('core-skills');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState('');

  // Edit goal state
  const [editingGoal, setEditingGoal] = useState<RoadmapMilestone | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const completedCount = roadmap.filter((r) => r.completed).length;
  const totalCount = roadmap.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredRoadmap = roadmap.filter((item) => {
    if (filterCategory === 'completed') return item.completed;
    if (filterCategory === 'pending') return !item.completed;
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Goal title is required');
      return;
    }

    onAddPersonalGoal({
      title: title.trim(),
      description: description.trim() || 'Personal learning milestone.',
      category,
      targetDate: targetDate || undefined,
    });

    setTitle('');
    setDescription('');
    setTargetDate('');
    setError('');
    setShowAddModal(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editTitle.trim()) return;

    onUpdateGoal(editingGoal.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
    });
    setEditingGoal(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>
            Career Roadmap: {primaryRole}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Structured learning trajectory and verified milestones curated for target engineering positions.
          </p>
        </div>

        <button
          type="button"
          className="jsw-btn jsw-btn-primary"
          onClick={() => setShowAddModal(true)}
          id="btn-add-roadmap-goal"
        >
          <Plus size={16} />
          <span>Add Custom Goal</span>
        </button>
      </div>

      {/* ── Progress Card ── */}
      <div className="jsw-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
              Trajectory Readiness
            </span>
            <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.125rem', color: '#0F172A' }}>
              {completedCount} of {totalCount} Milestones Completed ({progressPercent}%)
            </h3>
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706' }}>
            {progressPercent}%
          </span>
        </div>

        <div style={{ width: '100%', height: '10px', background: '#F1F5F9', borderRadius: '5px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #D97706 0%, #F59E0B 100%)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* ── Curated Guidance Notice ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1.25rem',
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '8px',
          color: '#92400E',
          fontSize: '0.8125rem',
        }}
      >
        <Sparkles size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Curated Trajectory:</strong> Roadmap steps represent industry-standard competency benchmarks for {primaryRole} roles. You can check off items as you complete them or add personal goals.
        </div>
      </div>

      {/* ── Filter Buttons ── */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['all', 'pending', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            className={`jsw-btn jsw-btn-sm ${filterCategory === filter ? 'jsw-btn-primary' : 'jsw-btn-secondary'}`}
            onClick={() => setFilterCategory(filter)}
          >
            {filter === 'all' ? 'All Milestones' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Milestones List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {filteredRoadmap.length === 0 ? (
          <div className="jsw-card" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
            No milestones match this filter.
          </div>
        ) : (
          filteredRoadmap.map((item) => (
            <div
              key={item.id}
              className="jsw-card"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '1.25rem',
                borderLeft: `4px solid ${item.completed ? '#059669' : '#CBD5E1'}`,
                background: item.completed ? '#FBFDFB' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', flex: 1 }}>
                <button
                  type="button"
                  onClick={() => onToggleMilestone(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    marginTop: '2px',
                    color: item.completed ? '#059669' : '#94A3B8',
                  }}
                  title={item.completed ? 'Mark pending' : 'Mark completed'}
                >
                  {item.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '0.975rem',
                        fontWeight: 700,
                        color: item.completed ? '#475569' : '#0F172A',
                        textDecoration: item.completed ? 'line-through' : 'none',
                      }}
                    >
                      {item.title}
                    </h3>

                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: '#F1F5F9',
                        color: '#475569',
                      }}
                    >
                      {item.category}
                    </span>

                    {item.isPersonalGoal && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: '#EFF6FF',
                          color: '#2563EB',
                        }}
                      >
                        Personal Goal
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.45 }}>
                    {item.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                    {item.completed && item.completedDate && (
                      <span style={{ color: '#059669', fontWeight: 600 }}>
                        ✓ Completed on {item.completedDate}
                      </span>
                    )}
                    {item.targetDate && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} /> Target: {item.targetDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {item.isPersonalGoal && (
                <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.75rem' }}>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                    onClick={() => {
                      setEditingGoal(item);
                      setEditTitle(item.title);
                      setEditDesc(item.description);
                    }}
                    title="Edit Goal"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                    style={{ color: '#DC2626' }}
                    onClick={() => setGoalToDelete(item.id)}
                    title="Delete Goal"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Add Personal Goal Modal ── */}
      {showAddModal && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A' }}>
                Add Custom Learning Goal
              </h3>
              <button type="button" className="btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="goal-title">Goal Title *</label>
                <input
                  id="goal-title"
                  type="text"
                  className={`form-input ${error ? 'has-error' : ''}`}
                  placeholder="e.g. Master React Server Components & Streaming"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError('');
                  }}
                />
                {error && <span className="form-error-msg">{error}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="goal-cat">Milestone Category</label>
                <select
                  id="goal-cat"
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RoadmapCategory)}
                >
                  <option value="core-skills">Core Technical Skills</option>
                  <option value="practical-project">Practical Projects</option>
                  <option value="assessment">Assessment Preparation</option>
                  <option value="career">Job Applications &amp; Career</option>
                  <option value="foundation">Foundational Concepts</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="goal-desc">Description</label>
                <textarea
                  id="goal-desc"
                  className="form-textarea"
                  rows={3}
                  placeholder="Steps or key concepts to master..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="goal-date">Target Completion Date</label>
                <input
                  id="goal-date"
                  type="date"
                  className="form-input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="jsw-btn jsw-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jsw-btn jsw-btn-primary"
                  id="btn-confirm-add-goal"
                >
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingGoal && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#0F172A' }}>
              Edit Milestone
            </h3>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="jsw-btn jsw-btn-secondary"
                  onClick={() => setEditingGoal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jsw-btn jsw-btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {goalToDelete && (
        <div
          className="yw-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            className="yw-modal-box"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '1.75rem',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', color: '#0F172A' }}>
              Remove Custom Goal?
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#64748B' }}>
              Are you sure you want to delete this custom learning goal? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="jsw-btn jsw-btn-secondary jsw-btn-sm"
                onClick={() => setGoalToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="jsw-btn jsw-btn-primary jsw-btn-sm"
                style={{ background: '#DC2626' }}
                onClick={() => {
                  onDeleteGoal(goalToDelete);
                  setGoalToDelete(null);
                }}
              >
                Delete Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
