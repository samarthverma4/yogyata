// Generated from the Supabase project "yogyata" (uusdczvfaklszlkxqpgs), then compacted
// (Update = Partial<Insert>). Regenerate after schema changes:
// npx supabase gen types typescript --project-id uusdczvfaklszlkxqpgs

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Enums = Database['public']['Enums'];
type Rel<Name extends string, Col extends string, To extends string, One extends boolean = false> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: One;
  referencedRelation: To;
  referencedColumns: ['id'];
};
type Table<Row, Insert, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Relationships;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' };
  public: {
    Tables: {
      assessment_attempts: Table<
        {
          answers: Json;
          assessment_id: string;
          correct: number;
          created_at: string;
          id: string;
          passed: boolean;
          review: Json;
          score_percent: number;
          seeker_id: string;
          total: number;
        },
        {
          answers: Json;
          assessment_id: string;
          correct: number;
          created_at?: string;
          id?: string;
          passed: boolean;
          review: Json;
          score_percent: number;
          seeker_id: string;
          total: number;
        },
        [
          Rel<'assessment_attempts_assessment_id_fkey', 'assessment_id', 'assessments'>,
          Rel<'assessment_attempts_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      assessments: Table<
        {
          active: boolean;
          category: string;
          description: string;
          difficulty: string;
          duration_minutes: number;
          id: string;
          instructions: string[];
          pass_percent: number;
          questions: Json;
          skill: string;
          title: string;
        },
        {
          active?: boolean;
          category?: string;
          description?: string;
          difficulty: string;
          duration_minutes: number;
          id: string;
          instructions?: string[];
          pass_percent?: number;
          questions: Json;
          skill: string;
          title: string;
        }
      >;
      interviews: Table<
        {
          agenda: string;
          cancellation_reason: string | null;
          created_at: string;
          duration_minutes: number;
          format: string;
          id: string;
          interviewers: string[];
          location_or_link: string;
          pipeline_id: string | null;
          recruiter_id: string;
          round: string;
          seeker_id: string;
          starts_at: string;
          status: Enums['interview_status'];
          target_role: string;
        },
        {
          agenda?: string;
          cancellation_reason?: string | null;
          created_at?: string;
          duration_minutes?: number;
          format?: string;
          id?: string;
          interviewers?: string[];
          location_or_link?: string;
          pipeline_id?: string | null;
          recruiter_id?: string;
          round?: string;
          seeker_id: string;
          starts_at: string;
          status?: Enums['interview_status'];
          target_role: string;
        },
        [
          Rel<'interviews_pipeline_id_fkey', 'pipeline_id', 'pipeline_entries'>,
          Rel<'interviews_recruiter_id_fkey', 'recruiter_id', 'profiles'>,
          Rel<'interviews_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      invitations: Table<
        {
          created_at: string;
          id: string;
          message: string;
          recruiter_id: string;
          responded_at: string | null;
          role_title: string;
          seeker_id: string;
          status: Enums['invitation_status'];
        },
        {
          created_at?: string;
          id?: string;
          message?: string;
          recruiter_id: string;
          responded_at?: string | null;
          role_title: string;
          seeker_id: string;
          status?: Enums['invitation_status'];
        },
        [
          Rel<'invitations_recruiter_id_fkey', 'recruiter_id', 'profiles'>,
          Rel<'invitations_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      job_applications: Table<
        {
          cover_note: string;
          created_at: string;
          id: string;
          posting_id: string;
          seeker_id: string;
          status: Enums['application_status'];
          updated_at: string;
        },
        {
          cover_note?: string;
          created_at?: string;
          id?: string;
          posting_id: string;
          seeker_id: string;
          status?: Enums['application_status'];
          updated_at?: string;
        },
        [
          Rel<'job_applications_posting_id_fkey', 'posting_id', 'job_postings'>,
          Rel<'job_applications_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      job_postings: Table<
        {
          category: string;
          compensation: string;
          created_at: string;
          deadline: string | null;
          description: string;
          experience: string;
          id: string;
          location: string;
          recruiter_id: string;
          required_skills: string[];
          status: Enums['posting_status'];
          title: string;
          updated_at: string;
          work_arrangement: string;
        },
        {
          category?: string;
          compensation?: string;
          created_at?: string;
          deadline?: string | null;
          description?: string;
          experience?: string;
          id?: string;
          location?: string;
          recruiter_id: string;
          required_skills?: string[];
          status?: Enums['posting_status'];
          title: string;
          updated_at?: string;
          work_arrangement?: string;
        },
        [Rel<'job_postings_recruiter_id_fkey', 'recruiter_id', 'profiles'>]
      >;
      mentor_feedback: Table<
        {
          created_at: string;
          id: string;
          improvements: string;
          mentorship_id: string;
          next_steps: string;
          session_id: string | null;
          shared: boolean;
          strengths: string;
        },
        {
          created_at?: string;
          id?: string;
          improvements?: string;
          mentorship_id: string;
          next_steps?: string;
          session_id?: string | null;
          shared?: boolean;
          strengths?: string;
        },
        [
          Rel<'mentor_feedback_mentorship_id_fkey', 'mentorship_id', 'mentorships'>,
          Rel<'mentor_feedback_session_id_fkey', 'session_id', 'mentorship_sessions'>,
        ]
      >;
      mentor_feedback_reflections: Table<
        { body: string; feedback_id: string; mentorship_id: string },
        { body?: string; feedback_id: string; mentorship_id: string },
        [
          Rel<'mentor_feedback_reflections_feedback_id_fkey', 'feedback_id', 'mentor_feedback', true>,
          Rel<'mentor_feedback_reflections_mentorship_id_fkey', 'mentorship_id', 'mentorships'>,
        ]
      >;
      mentor_profiles: Table<
        {
          accepting: boolean;
          bio: string;
          completed_at: string;
          experience_level: string;
          expertise_areas: string[];
          headline: string;
          hourly_rate: string;
          id: string;
          industries: string[];
          languages: string[];
          linkedin_url: string | null;
          listed: boolean;
          max_mentees: number;
          mentee_levels: string[];
          notify: Json;
          portfolio_url: string | null;
          pricing: string;
          role_title: string;
          session_format: string;
          session_frequency: string;
          session_minutes: number;
          technical_skills: string[];
          tracks: string[];
          updated_at: string;
          weekly_hours: number;
          years_experience: number | null;
        },
        {
          accepting?: boolean;
          bio?: string;
          completed_at?: string;
          experience_level?: string;
          expertise_areas?: string[];
          headline?: string;
          hourly_rate?: string;
          id: string;
          industries?: string[];
          languages?: string[];
          linkedin_url?: string | null;
          listed?: boolean;
          max_mentees?: number;
          mentee_levels?: string[];
          notify?: Json;
          portfolio_url?: string | null;
          pricing?: string;
          role_title?: string;
          session_format?: string;
          session_frequency?: string;
          session_minutes?: number;
          technical_skills?: string[];
          tracks?: string[];
          updated_at?: string;
          weekly_hours?: number;
          years_experience?: number | null;
        },
        [Rel<'mentor_profiles_id_fkey', 'id', 'profiles', true>]
      >;
      mentorship_action_items: Table<
        {
          completed: boolean;
          created_at: string;
          created_by: string;
          due_date: string | null;
          id: string;
          mentorship_id: string;
          text: string;
        },
        {
          completed?: boolean;
          created_at?: string;
          created_by?: string;
          due_date?: string | null;
          id?: string;
          mentorship_id: string;
          text: string;
        },
        [
          Rel<'mentorship_action_items_created_by_fkey', 'created_by', 'profiles'>,
          Rel<'mentorship_action_items_mentorship_id_fkey', 'mentorship_id', 'mentorships'>,
        ]
      >;
      mentorship_notes: Table<
        { body: string; mentor_id: string; mentorship_id: string; updated_at: string },
        { body?: string; mentor_id?: string; mentorship_id: string; updated_at?: string },
        [
          Rel<'mentorship_notes_mentor_id_fkey', 'mentor_id', 'profiles'>,
          Rel<'mentorship_notes_mentorship_id_fkey', 'mentorship_id', 'mentorships', true>,
        ]
      >;
      mentorship_requests: Table<
        {
          career_goal: string;
          created_at: string;
          id: string;
          mentor_id: string;
          message: string;
          preferred_time: string;
          responded_at: string | null;
          response_note: string | null;
          seeker_id: string;
          skills: string[];
          status: Enums['mentorship_request_status'];
          track: string;
        },
        {
          career_goal?: string;
          created_at?: string;
          id?: string;
          mentor_id: string;
          message: string;
          preferred_time?: string;
          responded_at?: string | null;
          response_note?: string | null;
          seeker_id: string;
          skills?: string[];
          status?: Enums['mentorship_request_status'];
          track: string;
        },
        [
          Rel<'mentorship_requests_mentor_id_fkey', 'mentor_id', 'profiles'>,
          Rel<'mentorship_requests_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      mentorship_sessions: Table<
        {
          agenda: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          meeting_link: string | null;
          mentorship_id: string;
          starts_at: string;
          status: Enums['session_status'];
          summary: string | null;
          title: string;
        },
        {
          agenda?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          meeting_link?: string | null;
          mentorship_id: string;
          starts_at: string;
          status?: Enums['session_status'];
          summary?: string | null;
          title: string;
        },
        [Rel<'mentorship_sessions_mentorship_id_fkey', 'mentorship_id', 'mentorships'>]
      >;
      mentorships: Table<
        {
          career_goal: string;
          goals: string[];
          id: string;
          mentor_id: string;
          request_id: string | null;
          seeker_id: string;
          started_at: string;
          status: Enums['mentorship_status'];
          track: string;
          updated_at: string;
        },
        {
          career_goal?: string;
          goals?: string[];
          id?: string;
          mentor_id: string;
          request_id?: string | null;
          seeker_id: string;
          started_at?: string;
          status?: Enums['mentorship_status'];
          track: string;
          updated_at?: string;
        },
        [
          Rel<'mentorships_mentor_id_fkey', 'mentor_id', 'profiles'>,
          Rel<'mentorships_request_id_fkey', 'request_id', 'mentorship_requests', true>,
          Rel<'mentorships_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      passport_skills: Table<
        {
          category: string;
          created_at: string;
          evidence: string;
          id: string;
          level: Enums['skill_level'];
          seeker_id: string;
          skill_name: string;
          source_submission_id: string | null;
          updated_at: string;
        },
        {
          category?: string;
          created_at?: string;
          evidence?: string;
          id?: string;
          level?: Enums['skill_level'];
          seeker_id: string;
          skill_name: string;
          source_submission_id?: string | null;
          updated_at?: string;
        },
        [
          Rel<'passport_skills_seeker_id_fkey', 'seeker_id', 'profiles'>,
          Rel<'passport_skills_source_submission_id_fkey', 'source_submission_id', 'submissions'>,
        ]
      >;
      pipeline_entries: Table<
        {
          created_at: string;
          id: string;
          next_action: string;
          notes: string;
          priority: string;
          recruiter_id: string;
          seeker_id: string;
          stage: Enums['pipeline_stage'];
          tags: string[];
          target_role: string;
          updated_at: string;
        },
        {
          created_at?: string;
          id?: string;
          next_action?: string;
          notes?: string;
          priority?: string;
          recruiter_id?: string;
          seeker_id: string;
          stage?: Enums['pipeline_stage'];
          tags?: string[];
          target_role: string;
          updated_at?: string;
        },
        [
          Rel<'pipeline_entries_recruiter_id_fkey', 'recruiter_id', 'profiles'>,
          Rel<'pipeline_entries_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      profiles: Table<
        {
          approval: Enums['approval_status'];
          approved_at: string | null;
          created_at: string;
          // not readable from the browser (column grant); listed here because it exists
          email_key: string;
          full_name: string;
          id: string;
          organization: string | null;
          role: Enums['user_role'];
          updated_at: string;
        },
        {
          approval?: Enums['approval_status'];
          approved_at?: string | null;
          created_at?: string;
          email_key: string;
          full_name: string;
          id: string;
          organization?: string | null;
          role: Enums['user_role'];
          updated_at?: string;
        }
      >;
      recruiter_profiles: Table<
        {
          bio: string;
          company_description: string;
          company_name: string;
          company_size: string;
          company_stage: string;
          completed_at: string;
          culture: string;
          employment_types: string[];
          experience_ranges: string[];
          hiring_domains: string[];
          id: string;
          industry: string;
          job_title: string;
          linkedin_url: string | null;
          location: string;
          preferred_locations: string[];
          priorities: string[];
          recruiting_experience: string;
          roles_hired: string[];
          settings: Json;
          skills_sought: string[];
          specialization: string;
          updated_at: string;
          website: string | null;
          work_arrangements: string[];
        },
        {
          bio?: string;
          company_description?: string;
          company_name?: string;
          company_size?: string;
          company_stage?: string;
          completed_at?: string;
          culture?: string;
          employment_types?: string[];
          experience_ranges?: string[];
          hiring_domains?: string[];
          id: string;
          industry?: string;
          job_title?: string;
          linkedin_url?: string | null;
          location?: string;
          preferred_locations?: string[];
          priorities?: string[];
          recruiting_experience?: string;
          roles_hired?: string[];
          settings?: Json;
          skills_sought?: string[];
          specialization?: string;
          updated_at?: string;
          website?: string | null;
          work_arrangements?: string[];
        },
        [Rel<'recruiter_profiles_id_fkey', 'id', 'profiles', true>]
      >;
      roadmap_milestones: Table<
        {
          category: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          description: string;
          id: string;
          personal: boolean;
          position: number;
          seeker_id: string;
          target_date: string | null;
          title: string;
        },
        {
          category?: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          personal?: boolean;
          position?: number;
          seeker_id?: string;
          target_date?: string | null;
          title: string;
        },
        [Rel<'roadmap_milestones_seeker_id_fkey', 'seeker_id', 'profiles'>]
      >;
      scorecards: Table<
        {
          communication: number;
          concerns: string;
          created_at: string;
          id: string;
          interview_id: string | null;
          interviewer_name: string;
          notes: string;
          problem_solving: number;
          recommendation: string;
          recruiter_id: string;
          role_alignment: number;
          round: string;
          seeker_id: string;
          strengths: string;
          target_role: string;
          technical: number;
        },
        {
          communication: number;
          concerns?: string;
          created_at?: string;
          id?: string;
          interview_id?: string | null;
          interviewer_name: string;
          notes?: string;
          problem_solving: number;
          recommendation: string;
          recruiter_id?: string;
          role_alignment: number;
          round: string;
          seeker_id: string;
          strengths?: string;
          target_role: string;
          technical: number;
        },
        [
          Rel<'scorecards_interview_id_fkey', 'interview_id', 'interviews'>,
          Rel<'scorecards_recruiter_id_fkey', 'recruiter_id', 'profiles'>,
          Rel<'scorecards_seeker_id_fkey', 'seeker_id', 'profiles'>,
        ]
      >;
      seeker_details: Table<
        { answers: Json; completed_at: string; headline: string; id: string; location: string; updated_at: string },
        { answers?: Json; completed_at?: string; headline?: string; id: string; location?: string; updated_at?: string },
        [Rel<'seeker_details_id_fkey', 'id', 'profiles', true>]
      >;
      skill_reviews: Table<
        {
          created_at: string;
          evidence_url: string;
          feedback: string | null;
          id: string;
          mentor_id: string | null;
          note: string;
          reviewed_at: string | null;
          seeker_id: string;
          skill_id: string;
          skill_name: string;
          status: Enums['skill_review_status'];
        },
        {
          created_at?: string;
          evidence_url: string;
          feedback?: string | null;
          id?: string;
          mentor_id?: string | null;
          note?: string;
          reviewed_at?: string | null;
          seeker_id: string;
          skill_id: string;
          skill_name: string;
          status?: Enums['skill_review_status'];
        },
        [
          Rel<'skill_reviews_mentor_id_fkey', 'mentor_id', 'profiles'>,
          Rel<'skill_reviews_seeker_id_fkey', 'seeker_id', 'profiles'>,
          Rel<'skill_reviews_skill_id_fkey', 'skill_id', 'passport_skills'>,
        ]
      >;
      submissions: Table<
        {
          created_at: string;
          deliverable_url: string;
          feedback: string | null;
          id: string;
          notes: string;
          rating: number | null;
          reviewed_at: string | null;
          seeker_id: string;
          status: Enums['submission_status'];
          task_id: string;
          updated_at: string;
        },
        {
          created_at?: string;
          deliverable_url: string;
          feedback?: string | null;
          id?: string;
          notes?: string;
          rating?: number | null;
          reviewed_at?: string | null;
          seeker_id: string;
          status?: Enums['submission_status'];
          task_id: string;
          updated_at?: string;
        },
        [
          Rel<'submissions_seeker_id_fkey', 'seeker_id', 'profiles'>,
          Rel<'submissions_task_id_fkey', 'task_id', 'tasks'>,
        ]
      >;
      tasks: Table<
        {
          client_id: string;
          compensation: Enums['task_compensation'];
          created_at: string;
          deadline: string | null;
          evaluation_criteria: string;
          expected_deliverable: string;
          founder_id: string;
          id: string;
          org_name: string;
          problem_statement: string;
          project_title: string;
          required_skills: string[];
          reward_details: string | null;
          status: Enums['task_status'];
          title: string;
          updated_at: string;
        },
        {
          client_id: string;
          compensation?: Enums['task_compensation'];
          created_at?: string;
          deadline?: string | null;
          evaluation_criteria?: string;
          expected_deliverable?: string;
          founder_id: string;
          id?: string;
          org_name?: string;
          problem_statement?: string;
          project_title?: string;
          required_skills?: string[];
          reward_details?: string | null;
          status?: Enums['task_status'];
          title: string;
          updated_at?: string;
        },
        [Rel<'tasks_founder_id_fkey', 'founder_id', 'profiles'>]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      current_user_role: { Args: never; Returns: Enums['user_role'] };
      endorse_submission_skill: { Args: { p_skill: string; p_submission: string }; Returns: undefined };
      mentor_review_skill: {
        Args: { p_decision: Enums['skill_review_status']; p_feedback: string; p_review: string };
        Returns: undefined;
      };
      respond_mentorship_request: { Args: { p_accept: boolean; p_note?: string; p_request: string }; Returns: string };
      search_talent: {
        Args: { p_query?: string; p_verified_only?: boolean };
        Returns: {
          assessed_count: number;
          full_name: string;
          headline: string;
          location: string;
          seeker_id: string;
          skills: Json;
          verified_count: number;
        }[];
      };
      submit_assessment: {
        Args: { p_answers: Json; p_assessment: string };
        Returns: Database['public']['Tables']['assessment_attempts']['Row'];
        SetofOptions: { from: '*'; to: 'assessment_attempts'; isOneToOne: true; isSetofReturn: false };
      };
    };
    Enums: {
      application_status: 'applied' | 'in_review' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
      approval_status: 'pending' | 'approved' | 'rejected';
      interview_status: 'scheduled' | 'completed' | 'cancelled';
      invitation_status: 'pending' | 'accepted' | 'declined';
      mentorship_request_status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
      mentorship_status: 'active' | 'on_hold' | 'completed';
      pipeline_stage: 'sourced' | 'screening' | 'interview' | 'offer' | 'hired' | 'archived';
      posting_status: 'draft' | 'open' | 'closed';
      session_status: 'scheduled' | 'completed' | 'cancelled';
      skill_level: 'declared' | 'assessed' | 'verified';
      skill_review_status: 'requested' | 'assessed' | 'declined';
      submission_status: 'submitted' | 'under_review' | 'accepted' | 'revision_requested' | 'rejected';
      task_compensation: 'paid' | 'unpaid' | 'unspecified';
      task_status: 'draft' | 'published' | 'closed';
      user_role: 'entrepreneur' | 'seeker' | 'mentor' | 'recruiter';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type Tables = Database['public']['Tables'];
type Row<T extends keyof Tables> = Tables[T]['Row'];

/** The signed-in user's own profile. `email_key` is never sent to the browser. */
export type Profile = Omit<Row<'profiles'>, 'email_key'>;
export type UserRole = Enums['user_role'];
export type ApprovalStatus = Enums['approval_status'];
export type TaskRow = Row<'tasks'>;
export type SubmissionRow = Row<'submissions'>;
export type PassportSkill = Row<'passport_skills'>;
export type SkillLevel = Enums['skill_level'];
export type SubmissionStatus = Enums['submission_status'];
export type SkillReview = Row<'skill_reviews'>;
export type Invitation = Row<'invitations'>;
export type SkillReviewStatus = Enums['skill_review_status'];
export type InvitationStatus = Enums['invitation_status'];

export type MentorProfileRow = Row<'mentor_profiles'>;
export type MentorshipRequest = Row<'mentorship_requests'>;
export type MentorshipRequestStatus = Enums['mentorship_request_status'];
export type Mentorship = Row<'mentorships'>;
export type MentorshipStatus = Enums['mentorship_status'];
export type ActionItem = Row<'mentorship_action_items'>;
export type MentorshipSession = Row<'mentorship_sessions'>;
export type SessionStatus = Enums['session_status'];
export type MentorFeedback = Row<'mentor_feedback'>;

export type RecruiterProfileRow = Row<'recruiter_profiles'>;
export type JobPosting = Row<'job_postings'>;
export type PostingStatus = Enums['posting_status'];
export type JobApplication = Row<'job_applications'>;
export type ApplicationStatus = Enums['application_status'];
export type PipelineEntry = Row<'pipeline_entries'>;
export type PipelineStage = Enums['pipeline_stage'];
export type InterviewRow = Row<'interviews'>;
export type InterviewStatus = Enums['interview_status'];
export type ScorecardRow = Row<'scorecards'>;

export type AssessmentRow = Row<'assessments'>;
export type AssessmentAttempt = Row<'assessment_attempts'>;
export type RoadmapMilestone = Row<'roadmap_milestones'>;

/** Questions as stored in `assessments.questions` (no answers: those stay in the database). */
export interface AssessmentQuestion {
  id: string;
  text: string;
  options: string[];
}
/** One entry of `assessment_attempts.review`, available only after submitting. */
export interface AttemptReview {
  questionId: string;
  chosen: number | null;
  correct: number;
  explanation: string;
}

export interface TalentResult {
  seeker_id: string;
  full_name: string;
  headline: string;
  location: string;
  skills: { name: string; level: SkillLevel }[];
  verified_count: number;
  assessed_count: number;
}
