import { supabase } from './supabase';
import type { Database } from './database.types';
import type { FounderWorkspaceState } from '../founder-workspace/types';

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mirrors the founder workspace's tasks into Supabase so seekers can browse the published ones.
 * The workspace keeps its own ids; `client_id` links each row back to them.
 */
export async function syncFounderTasks(workspace: FounderWorkspaceState): Promise<{ error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const founderId = auth.user?.id;
  if (!founderId) return { error: 'Not signed in' };

  const projectTitle = new Map(workspace.projects.map((p) => [p.id, p.title]));
  const rows: TaskInsert[] = workspace.tasks
    .filter((t) => t.title.trim())
    .map((t) => ({
      founder_id: founderId,
      client_id: t.id,
      org_name: workspace.startup.startupName || '',
      project_title: projectTitle.get(t.projectId) ?? '',
      title: t.title.trim(),
      problem_statement: t.problemStatement,
      required_skills: t.requiredSkills,
      expected_deliverable: t.expectedDeliverable,
      evaluation_criteria: t.evaluationCriteria,
      deadline: t.deadline && ISO_DATE.test(t.deadline) ? t.deadline : null,
      compensation: t.compensationType,
      reward_details: t.rewardDetails ?? null,
      status: t.status,
    }));

  if (rows.length) {
    const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'founder_id,client_id' });
    if (error) return { error: error.message };
  }

  // remove rows for tasks the founder deleted locally (submissions to them are removed with them)
  const keep = rows.map((r) => r.client_id);
  let del = supabase.from('tasks').delete().eq('founder_id', founderId);
  if (keep.length) del = del.not('client_id', 'in', `(${keep.map((id) => `"${id.replace(/"/g, '')}"`).join(',')})`);
  const { error: delError } = await del;
  return delError ? { error: delError.message } : {};
}
