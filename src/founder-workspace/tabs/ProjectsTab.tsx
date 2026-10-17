import React, { useState, useMemo } from 'react';
import type {
  Project,
  WorkspaceTask,
  ProjectStatus,
  WorkspaceTab,
} from '../types';

interface ProjectsTabProps {
  projects: Project[];
  tasks: WorkspaceTask[];
  onAddProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onNavigateTab: (tab: WorkspaceTab, filterProjectId?: string) => void;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  projects,
  tasks,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Software / Web');
  const [projectUrl, setProjectUrl] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [formError, setFormError] = useState('');

  // Count tasks per project
  const taskCountByProject = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      map.set(t.projectId, (map.get(t.projectId) || 0) + 1);
    });
    return map;
  }, [tasks]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [projects, statusFilter, searchQuery]);

  const openCreateModal = () => {
    setTitle('');
    setDescription('');
    setCategory('Software / Web');
    setProjectUrl('');
    setStatus('active');
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setTitle(project.title);
    setDescription(project.description);
    setCategory(project.category);
    setProjectUrl(project.projectUrl || '');
    setStatus(project.status);
    setFormError('');
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Project title is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Project description is required.');
      return;
    }

    onAddProject({
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || 'General',
      projectUrl: projectUrl.trim() || undefined,
      status,
    });
    setIsCreateModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!title.trim()) {
      setFormError('Project title is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Project description is required.');
      return;
    }

    onEditProject({
      ...editingProject,
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || 'General',
      projectUrl: projectUrl.trim() || undefined,
      status,
      updatedAt: new Date().toISOString(),
    });
    setEditingProject(null);
  };

  const handleConfirmDelete = () => {
    if (!projectToDelete) return;
    onDeleteProject(projectToDelete.id);
    setProjectToDelete(null);
  };

  const renderStatusBadge = (s: ProjectStatus) => {
    switch (s) {
      case 'active':
        return <span className="yw-badge yw-badge-green">Active</span>;
      case 'draft':
        return <span className="yw-badge yw-badge-neutral">Draft</span>;
      case 'on-hold':
        return <span className="yw-badge yw-badge-amber">On Hold</span>;
      case 'completed':
        return <span className="yw-badge yw-badge-blue">Completed</span>;
    }
  };

  return (
    <div className="yw-content">
      {/* Top Filter and Search Bar */}
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
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                className="yw-form-input"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                id="input-search-projects"
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

            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
              {(['all', 'active', 'draft', 'on-hold', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`yw-btn yw-btn-sm ${
                    statusFilter === s ? 'yw-btn-primary' : 'yw-btn-secondary'
                  }`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : s.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="yw-btn yw-btn-primary"
            onClick={openCreateModal}
            id="btn-create-project"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Create Project
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="yw-card">
          <div className="yw-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <p className="yw-empty-state-title">
              {searchQuery || statusFilter !== 'all' ? 'No matching projects found' : 'No projects yet'}
            </p>
            <p className="yw-empty-state-desc">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or resetting the status filter.'
                : 'Projects organize your startup deliverables, milestones, and challenges into structured roadmaps.'}
            </p>
            <button
              type="button"
              className="yw-btn yw-btn-primary"
              onClick={openCreateModal}
            >
              + Create First Project
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filteredProjects.map((project) => {
            const count = taskCountByProject.get(project.id) || 0;
            return (
              <div key={project.id} className="yw-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#1B2A4E', fontWeight: 600 }}>
                    {project.title}
                  </h3>
                  {renderStatusBadge(project.status)}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span className="yw-badge yw-badge-neutral">{project.category}</span>
                  {project.projectUrl && (
                    <a
                      href={project.projectUrl.startsWith('http') ? project.projectUrl : `https://${project.projectUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.75rem', color: '#D97706', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      Spec Link ↗
                    </a>
                  )}
                </div>

                <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: 1.5, flex: 1, margin: 0 }}>
                  {project.description}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '1.25rem',
                    paddingTop: '0.875rem',
                    borderTop: '1px solid #F1F5F9',
                    fontSize: '0.8125rem',
                    color: '#64748B',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onNavigateTab('tasks', project.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#1B2A4E',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}
                    title="View linked challenges"
                  >
                    <span style={{ color: '#D97706', fontWeight: 700 }}>{count}</span>{' '}
                    {count === 1 ? 'Task Challenge' : 'Task Challenges'} →
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="yw-btn yw-btn-secondary yw-btn-sm"
                      onClick={() => openEditModal(project)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="yw-btn yw-btn-danger yw-btn-sm"
                      onClick={() => setProjectToDelete(project)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CREATE PROJECT MODAL ─── */}
      {isCreateModalOpen && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-create-proj-title">
          <div className="yw-modal-box">
            <div className="yw-modal-header">
              <h3 id="modal-create-proj-title" className="yw-modal-title">
                Create New Project
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
                  <label className="yw-form-label" htmlFor="new-proj-title">
                    Project Title *
                  </label>
                  <input
                    id="new-proj-title"
                    type="text"
                    className="yw-form-input"
                    placeholder="e.g. Core SaaS MVP Release"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="new-proj-desc">
                    Description *
                  </label>
                  <textarea
                    id="new-proj-desc"
                    rows={3}
                    className="yw-form-textarea"
                    placeholder="Outline the goals and deliverables expected under this project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="new-proj-category">
                      Category
                    </label>
                    <input
                      id="new-proj-category"
                      type="text"
                      className="yw-form-input"
                      placeholder="e.g. Software, Growth, Design"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="new-proj-status">
                      Initial Status
                    </label>
                    <select
                      id="new-proj-status"
                      className="yw-form-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="on-hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="new-proj-url">
                    Specification / Repository URL (Optional)
                  </label>
                  <input
                    id="new-proj-url"
                    type="url"
                    className="yw-form-input"
                    placeholder="https://github.com/..."
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                  />
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
                <button type="submit" className="yw-btn yw-btn-primary" id="btn-submit-create-proj">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PROJECT MODAL ─── */}
      {editingProject && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-edit-proj-title">
          <div className="yw-modal-box">
            <div className="yw-modal-header">
              <h3 id="modal-edit-proj-title" className="yw-modal-title">
                Edit Project
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setEditingProject(null)}
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
                  <label className="yw-form-label" htmlFor="edit-proj-title">
                    Project Title *
                  </label>
                  <input
                    id="edit-proj-title"
                    type="text"
                    className="yw-form-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="edit-proj-desc">
                    Description *
                  </label>
                  <textarea
                    id="edit-proj-desc"
                    rows={3}
                    className="yw-form-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="edit-proj-category">
                      Category
                    </label>
                    <input
                      id="edit-proj-category"
                      type="text"
                      className="yw-form-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="edit-proj-status">
                      Status
                    </label>
                    <select
                      id="edit-proj-status"
                      className="yw-form-select"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="on-hold">On Hold</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="edit-proj-url">
                    Specification / Repository URL
                  </label>
                  <input
                    id="edit-proj-url"
                    type="url"
                    className="yw-form-input"
                    value={projectUrl}
                    onChange={(e) => setProjectUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="yw-modal-footer">
                <button
                  type="button"
                  className="yw-btn yw-btn-secondary"
                  onClick={() => setEditingProject(null)}
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

      {/* ─── DELETE PROJECT CONFIRMATION MODAL ─── */}
      {projectToDelete && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-del-proj-title">
          <div className="yw-modal-box">
            <div className="yw-modal-header">
              <h3 id="modal-del-proj-title" className="yw-modal-title" style={{ color: '#DC2626' }}>
                Delete Project: {projectToDelete.title}
              </h3>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setProjectToDelete(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="yw-modal-body">
              <p style={{ color: '#334155', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this project?
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
                <strong>Task association impact:</strong> This project currently has{' '}
                <strong>{taskCountByProject.get(projectToDelete.id) || 0}</strong> associated task
                challenge(s). Deleting this project will automatically unassign these tasks, moving
                them to unassigned drafts so you do not lose any challenge data.
              </div>
            </div>

            <div className="yw-modal-footer">
              <button
                type="button"
                className="yw-btn yw-btn-secondary"
                onClick={() => setProjectToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="yw-btn yw-btn-danger"
                onClick={handleConfirmDelete}
                id="btn-confirm-delete-proj"
              >
                Yes, Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
