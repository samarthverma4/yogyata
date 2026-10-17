import React, { useState, useMemo } from 'react';
import type {
  WorkspaceTask,
  Project,
  TaskSubmission,
  TaskStatus,
  TaskCompensation,
  WorkspaceTab,
} from '../types';

interface TasksTabProps {
  tasks: WorkspaceTask[];
  projects: Project[];
  submissions: TaskSubmission[];
  selectedProjectId?: string; // Optional filter passed from other tabs
  onAddTask: (task: Omit<WorkspaceTask, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onEditTask: (task: WorkspaceTask) => void;
  onDeleteTask: (taskId: string) => void;
  onNavigateTab: (tab: WorkspaceTab, filterTaskId?: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  projects,
  submissions,
  selectedProjectId,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [projectFilter, setProjectFilter] = useState<string>(selectedProjectId || 'all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkspaceTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<WorkspaceTask | null>(null);
  const [viewingTask, setViewingTask] = useState<WorkspaceTask | null>(null);

  // Form states
  const [formProjectId, setFormProjectId] = useState(projects[0]?.id || '');
  const [formTitle, setFormTitle] = useState('');
  const [formProblem, setFormProblem] = useState('');
  const [formSkills, setFormSkills] = useState<string[]>(['React', 'TypeScript']);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [formDeliverable, setFormDeliverable] = useState('');
  const [formCriteria, setFormCriteria] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formCompType, setFormCompType] = useState<TaskCompensation>('paid');
  const [formReward, setFormReward] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('published');
  const [formError, setFormError] = useState('');

  // Map submissions to tasks
  const submissionsCountByTask = useMemo(() => {
    const map = new Map<string, number>();
    submissions.forEach((s) => {
      map.set(s.taskId, (map.get(s.taskId) || 0) + 1);
    });
    return map;
  }, [submissions]);

  // Project map for quick title lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.title));
    map.set('proj-unassigned', 'Unassigned / Standalone');
    return map;
  }, [projects]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesProj = projectFilter === 'all' || t.projectId === projectFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.problemStatement.toLowerCase().includes(q) ||
        t.requiredSkills.some((s) => s.toLowerCase().includes(q));
      return matchesStatus && matchesProj && matchesQuery;
    });
  }, [tasks, statusFilter, projectFilter, searchQuery]);

  const openCreateModal = () => {
    setFormProjectId(projects[0]?.id || '');
    setFormTitle('');
    setFormProblem('');
    setFormSkills(['React', 'TypeScript']);
    setNewSkillInput('');
    setFormDeliverable('');
    setFormCriteria('');
    setFormDeadline('');
    setFormCompType('paid');
    setFormReward('');
    setFormStatus('published');
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (task: WorkspaceTask) => {
    setEditingTask(task);
    setFormProjectId(task.projectId);
    setFormTitle(task.title);
    setFormProblem(task.problemStatement);
    setFormSkills([...task.requiredSkills]);
    setNewSkillInput('');
    setFormDeliverable(task.expectedDeliverable);
    setFormCriteria(task.evaluationCriteria);
    setFormDeadline(task.deadline || '');
    setFormCompType(task.compensationType);
    setFormReward(task.rewardDetails || '');
    setFormStatus(task.status);
    setFormError('');
  };

  const handleAddSkill = () => {
    const sk = newSkillInput.trim();
    if (!sk) return;
    if (!formSkills.includes(sk)) {
      setFormSkills([...formSkills, sk]);
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormSkills(formSkills.filter((s) => s !== skillToRemove));
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!formProblem.trim()) {
      setFormError('Problem statement is required.');
      return;
    }
    if (!formDeliverable.trim()) {
      setFormError('Expected deliverable is required.');
      return;
    }

    onAddTask({
      projectId: formProjectId || projects[0]?.id || 'proj-unassigned',
      title: formTitle.trim(),
      problemStatement: formProblem.trim(),
      requiredSkills: formSkills.length > 0 ? formSkills : ['General'],
      expectedDeliverable: formDeliverable.trim(),
      evaluationCriteria: formCriteria.trim() || 'Functional correctness, test coverage, and documentation',
      deadline: formDeadline || undefined,
      compensationType: formCompType,
      rewardDetails: formReward.trim() || undefined,
      status: formStatus,
    });
    setIsCreateModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!formTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!formProblem.trim()) {
      setFormError('Problem statement is required.');
      return;
    }

    onEditTask({
      ...editingTask,
      projectId: formProjectId,
      title: formTitle.trim(),
      problemStatement: formProblem.trim(),
      requiredSkills: formSkills,
      expectedDeliverable: formDeliverable.trim(),
      evaluationCriteria: formCriteria.trim(),
      deadline: formDeadline || undefined,
      compensationType: formCompType,
      rewardDetails: formReward.trim() || undefined,
      status: formStatus,
      updatedAt: new Date().toISOString(),
    });
    setEditingTask(null);
  };

  const handleToggleStatus = (task: WorkspaceTask) => {
    let nextStatus: TaskStatus = 'published';
    if (task.status === 'draft') nextStatus = 'published';
    else if (task.status === 'published') nextStatus = 'closed';
    else if (task.status === 'closed') nextStatus = 'published';

    onEditTask({
      ...task,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleConfirmDelete = () => {
    if (!taskToDelete) return;
    onDeleteTask(taskToDelete.id);
    setTaskToDelete(null);
  };

  const renderStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'published':
        return <span className="yw-badge yw-badge-green">Published</span>;
      case 'draft':
        return <span className="yw-badge yw-badge-neutral">Draft</span>;
      case 'closed':
        return <span className="yw-badge yw-badge-amber">Closed</span>;
    }
  };

  return (
    <div className="yw-content">
      {/* Notice about prototype task publishing */}
      <div className="yw-alert yw-alert-info" style={{ marginBottom: '1.25rem' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <strong>Frontend Prototype Mode:</strong> Publishing tasks changes their state in this
          workspace. Tasks are not yet dispatched to an external live server or candidate email
          network.
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="yw-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <input
                type="text"
                className="yw-form-input"
                placeholder="Search challenges..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                id="input-search-tasks"
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="#94A3B8"
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Filter by Project */}
            <select
              className="yw-form-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
              {tasks.some((t) => t.projectId === 'proj-unassigned') && (
                <option value="proj-unassigned">Unassigned Challenges</option>
              )}
            </select>

            {/* Status pills */}
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {(['all', 'published', 'draft', 'closed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`yw-btn yw-btn-sm ${
                    statusFilter === st ? 'yw-btn-primary' : 'yw-btn-secondary'
                  }`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="yw-btn yw-btn-primary"
            onClick={openCreateModal}
            id="btn-create-task"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Create Task Challenge
          </button>
        </div>
      </div>

      {/* Task List / Grid */}
      {filteredTasks.length === 0 ? (
        <div className="yw-card">
          <div className="yw-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="yw-empty-state-title">
              {searchQuery || statusFilter !== 'all' || projectFilter !== 'all'
                ? 'No matching task challenges found'
                : 'No task challenges created yet'}
            </p>
            <p className="yw-empty-state-desc">
              {searchQuery || statusFilter !== 'all' || projectFilter !== 'all'
                ? 'Try resetting your filter or search keywords.'
                : 'Define practical problems, assessment benchmarks, or paid micro-deliverables for contributors.'}
            </p>
            <button
              type="button"
              className="yw-btn yw-btn-primary"
              onClick={openCreateModal}
            >
              + Create First Challenge
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredTasks.map((task) => {
            const subCount = submissionsCountByTask.get(task.id) || 0;
            const projectName = projectMap.get(task.projectId) || 'Unassigned Project';

            return (
              <div key={task.id} className="yw-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.125rem',
                          color: '#1B2A4E',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={() => setViewingTask(task)}
                      >
                        {task.title}
                      </h3>
                      {renderStatusBadge(task.status)}
                      <span className="yw-badge yw-badge-neutral">{projectName}</span>
                      {task.compensationType === 'paid' && (
                        <span className="yw-badge yw-badge-amber">
                          Paid {task.rewardDetails ? `(${task.rewardDetails})` : ''}
                        </span>
                      )}
                    </div>

                    <p style={{ margin: '0.25rem 0 0.5rem 0', color: '#475569', fontSize: '0.875rem', lineHeight: 1.5 }}>
                      {task.problemStatement}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                      {task.requiredSkills.map((sk) => (
                        <span key={sk} className="yw-skill-pill yw-skill-assessed">
                          {sk}
                        </span>
                      ))}
                      {task.deadline && (
                        <span style={{ fontSize: '0.8125rem', color: '#64748B', display: 'inline-flex', alignItems: 'center', marginLeft: '0.5rem' }}>
                          ⏰ Due: {task.deadline}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {subCount > 0 ? (
                        <button
                          type="button"
                          className="yw-btn yw-btn-secondary yw-btn-sm"
                          onClick={() => onNavigateTab('submissions', task.id)}
                          style={{ color: '#D97706', fontWeight: 600 }}
                        >
                          {subCount} {subCount === 1 ? 'Submission' : 'Submissions'} →
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>0 submissions</span>
                      )}

                      <button
                        type="button"
                        className="yw-btn yw-btn-secondary yw-btn-sm"
                        onClick={() => handleToggleStatus(task)}
                        title={
                          task.status === 'draft'
                            ? 'Publish challenge'
                            : task.status === 'published'
                            ? 'Close challenge'
                            : 'Reopen challenge'
                        }
                      >
                        {task.status === 'draft' && 'Publish'}
                        {task.status === 'published' && 'Close'}
                        {task.status === 'closed' && 'Reopen'}
                      </button>

                      <button
                        type="button"
                        className="yw-btn yw-btn-secondary yw-btn-sm"
                        onClick={() => openEditModal(task)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="yw-btn yw-btn-danger yw-btn-sm"
                        onClick={() => setTaskToDelete(task)}
                      >
                        Delete
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingTask(task)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        fontSize: '0.8125rem',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      View Full Details & Criteria ↓
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── VIEW FULL TASK DETAILS MODAL ─── */}
      {viewingTask && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-view-task-title">
          <div className="yw-modal-box" style={{ maxWidth: '640px' }}>
            <div className="yw-modal-header">
              <div>
                <span className="yw-badge yw-badge-neutral">
                  {projectMap.get(viewingTask.projectId) || 'Project'}
                </span>
                <h3 id="modal-view-task-title" className="yw-modal-title" style={{ marginTop: '0.25rem' }}>
                  {viewingTask.title}
                </h3>
              </div>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setViewingTask(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="yw-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', textTransform: 'uppercase', color: '#64748B' }}>
                  Problem Statement
                </h4>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                  {viewingTask.problemStatement}
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', textTransform: 'uppercase', color: '#64748B' }}>
                  Expected Deliverable
                </h4>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                  {viewingTask.expectedDeliverable}
                </p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', textTransform: 'uppercase', color: '#64748B' }}>
                  Evaluation Criteria
                </h4>
                <p style={{ margin: 0, color: '#334155', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                  {viewingTask.evaluationCriteria}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #E2E8F0' }}>
                <div>
                  <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>Compensation:</span>
                  <div style={{ fontWeight: 600, color: '#1B2A4E' }}>
                    {viewingTask.compensationType} {viewingTask.rewardDetails ? `— ${viewingTask.rewardDetails}` : ''}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B', fontSize: '0.8125rem' }}>Target Deadline:</span>
                  <div style={{ fontWeight: 600, color: '#1B2A4E' }}>
                    {viewingTask.deadline || 'No firm deadline'}
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.375rem 0', fontSize: '0.875rem', textTransform: 'uppercase', color: '#64748B' }}>
                  Target Skills Tested
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {viewingTask.requiredSkills.map((sk) => (
                    <span key={sk} className="yw-skill-pill yw-skill-assessed">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="yw-modal-footer">
              <button
                type="button"
                className="yw-btn yw-btn-secondary"
                onClick={() => setViewingTask(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="yw-btn yw-btn-primary"
                onClick={() => {
                  const t = viewingTask;
                  setViewingTask(null);
                  openEditModal(t);
                }}
              >
                Edit Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE TASK MODAL ─── */}
      {isCreateModalOpen && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-create-task-title">
          <div className="yw-modal-box" style={{ maxWidth: '640px' }}>
            <div className="yw-modal-header">
              <h3 id="modal-create-task-title" className="yw-modal-title">
                Create New Task Challenge
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCreate}>
              <div className="yw-modal-body">
                {formError && (
                  <div className="yw-alert yw-alert-danger" style={{ marginBottom: '1rem' }}>
                    {formError}
                  </div>
                )}

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="new-task-project">
                    Associate with Project *
                  </label>
                  <select
                    id="new-task-project"
                    className="yw-form-select"
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="new-task-title">
                    Challenge Title *
                  </label>
                  <input
                    id="new-task-title"
                    type="text"
                    className="yw-form-input"
                    placeholder="e.g. Build an Accessible Combobox Dropdown"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="new-task-problem">
                    Problem Statement / Scope *
                  </label>
                  <textarea
                    id="new-task-problem"
                    rows={3}
                    className="yw-form-textarea"
                    placeholder="Describe the challenge context, requirements, and constraints..."
                    value={formProblem}
                    onChange={(e) => setFormProblem(e.target.value)}
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="new-task-deliverable">
                    Expected Deliverable *
                  </label>
                  <textarea
                    id="new-task-deliverable"
                    rows={2}
                    className="yw-form-textarea"
                    placeholder="e.g. GitHub Pull Request with clean unit tests and Figma token integration"
                    value={formDeliverable}
                    onChange={(e) => setFormDeliverable(e.target.value)}
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="new-task-criteria">
                    Evaluation Criteria
                  </label>
                  <textarea
                    id="new-task-criteria"
                    rows={2}
                    className="yw-form-textarea"
                    placeholder="e.g. WCAG 2.1 AA compliance, zero console warnings, TypeScript strict mode"
                    value={formCriteria}
                    onChange={(e) => setFormCriteria(e.target.value)}
                  />
                </div>

                {/* Skills tags */}
                <div className="yw-form-group">
                  <label className="yw-form-label">Required Skills</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                    {formSkills.map((sk) => (
                      <span
                        key={sk}
                        className="yw-skill-pill yw-skill-assessed"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        {sk}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(sk)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1E40AF',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="yw-form-input"
                      placeholder="Add required skill (e.g. PostgreSQL)..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="yw-btn yw-btn-secondary"
                      onClick={handleAddSkill}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="new-task-comp">
                      Compensation Model
                    </label>
                    <select
                      id="new-task-comp"
                      className="yw-form-select"
                      value={formCompType}
                      onChange={(e) => setFormCompType(e.target.value as TaskCompensation)}
                    >
                      <option value="paid">Paid Bounty / Stipend</option>
                      <option value="unpaid">Unpaid / Learning Challenge</option>
                      <option value="unspecified">Unspecified / Discuss Later</option>
                    </select>
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="new-task-reward">
                      Reward Details
                    </label>
                    <input
                      id="new-task-reward"
                      type="text"
                      className="yw-form-input"
                      placeholder="e.g. USD $250 or Equity"
                      value={formReward}
                      onChange={(e) => setFormReward(e.target.value)}
                    />
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="new-task-deadline">
                      Deadline (Optional)
                    </label>
                    <input
                      id="new-task-deadline"
                      type="date"
                      className="yw-form-input"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                    />
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="new-task-status">
                      Initial Status
                    </label>
                    <select
                      id="new-task-status"
                      className="yw-form-select"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                    >
                      <option value="published">Published (Prototype)</option>
                      <option value="draft">Save as Draft</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="yw-modal-footer">
                <button
                  type="button"
                  className="yw-btn yw-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="yw-btn yw-btn-primary" id="btn-submit-create-task">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT TASK MODAL ─── */}
      {editingTask && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-edit-task-title">
          <div className="yw-modal-box" style={{ maxWidth: '640px' }}>
            <div className="yw-modal-header">
              <h3 id="modal-edit-task-title" className="yw-modal-title">
                Edit Task Challenge
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setEditingTask(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="yw-modal-body">
                {formError && (
                  <div className="yw-alert yw-alert-danger" style={{ marginBottom: '1rem' }}>
                    {formError}
                  </div>
                )}

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="edit-task-project">
                    Associate with Project *
                  </label>
                  <select
                    id="edit-task-project"
                    className="yw-form-select"
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="edit-task-title">
                    Challenge Title *
                  </label>
                  <input
                    id="edit-task-title"
                    type="text"
                    className="yw-form-input"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="edit-task-problem">
                    Problem Statement / Scope *
                  </label>
                  <textarea
                    id="edit-task-problem"
                    rows={3}
                    className="yw-form-textarea"
                    value={formProblem}
                    onChange={(e) => setFormProblem(e.target.value)}
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="edit-task-deliverable">
                    Expected Deliverable *
                  </label>
                  <textarea
                    id="edit-task-deliverable"
                    rows={2}
                    className="yw-form-textarea"
                    value={formDeliverable}
                    onChange={(e) => setFormDeliverable(e.target.value)}
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="edit-task-criteria">
                    Evaluation Criteria
                  </label>
                  <textarea
                    id="edit-task-criteria"
                    rows={2}
                    className="yw-form-textarea"
                    value={formCriteria}
                    onChange={(e) => setFormCriteria(e.target.value)}
                  />
                </div>

                {/* Skills tags */}
                <div className="yw-form-group">
                  <label className="yw-form-label">Required Skills</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                    {formSkills.map((sk) => (
                      <span
                        key={sk}
                        className="yw-skill-pill yw-skill-assessed"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        {sk}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(sk)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1E40AF',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="yw-form-input"
                      placeholder="Add skill..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="yw-btn yw-btn-secondary"
                      onClick={handleAddSkill}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="edit-task-comp">
                      Compensation Model
                    </label>
                    <select
                      id="edit-task-comp"
                      className="yw-form-select"
                      value={formCompType}
                      onChange={(e) => setFormCompType(e.target.value as TaskCompensation)}
                    >
                      <option value="paid">Paid Bounty / Stipend</option>
                      <option value="unpaid">Unpaid / Learning Challenge</option>
                      <option value="unspecified">Unspecified / Discuss Later</option>
                    </select>
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="edit-task-reward">
                      Reward Details
                    </label>
                    <input
                      id="edit-task-reward"
                      type="text"
                      className="yw-form-input"
                      value={formReward}
                      onChange={(e) => setFormReward(e.target.value)}
                    />
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="edit-task-status">
                      Status
                    </label>
                    <select
                      id="edit-task-status"
                      className="yw-form-select"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="yw-modal-footer">
                <button
                  type="button"
                  className="yw-btn yw-btn-secondary"
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="yw-btn yw-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE TASK CONFIRMATION MODAL ─── */}
      {taskToDelete && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-del-task-title">
          <div className="yw-modal-box">
            <div className="yw-modal-header">
              <h3 id="modal-del-task-title" className="yw-modal-title" style={{ color: '#DC2626' }}>
                Delete Challenge: {taskToDelete.title}
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setTaskToDelete(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="yw-modal-body">
              <p style={{ color: '#334155', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this task challenge?
              </p>
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '6px',
                  padding: '0.875rem',
                  fontSize: '0.875rem',
                  color: '#991B1B',
                  marginTop: '0.75rem',
                }}
              >
                <strong>Warning:</strong> Any associated submission records ({submissionsCountByTask.get(taskToDelete.id) || 0})
                will be permanently unlinked from this challenge.
              </div>
            </div>

            <div className="yw-modal-footer">
              <button
                type="button"
                className="yw-btn yw-btn-secondary"
                onClick={() => setTaskToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="yw-btn yw-btn-danger"
                onClick={handleConfirmDelete}
                id="btn-confirm-delete-task"
              >
                Yes, Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
