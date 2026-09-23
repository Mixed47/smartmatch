export interface Skill { name: string; grade: string; type: string; source: string; }
export interface ParsedSkill { skill: string; weight: 'STANDARD' | 'IMPORTANT' | 'CRITICAL'; }
export interface JobMatch { job_title: string; company: string; required_skills?: any[]; match_percentage: number; matched_skills: string[]; missing_skills: string[]; critical_skills?: string[]; }
export interface Application { id: string; student_id: number; name: string; job_title: string; company: string; match_percentage: number; skills: string[]; resume_url: string; status: string; }
export interface CancelRequest { id: number; application_id: string; student_name: string; company_name: string; reason: string; status: string; }
export interface Evaluation { application_id: string; score: number; comment: string; }
export type UserRole = 'student' | 'company' | 'teacher';
export interface InboxContact {
  user_id: number;
  name: string;
  email: string;
  role: UserRole;
  last_message: string;
  last_at: string;
  unread_count: number;
}
export interface InboxMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  sender_name: string;
  sender_role: UserRole;
  body: string;
  mine: boolean;
  is_read: boolean;
  created_at: string;
}
export interface Petition {
  id: number;
  user_id: number;
  student_name?: string;
  student_email?: string;
  type: string;
  payload?: { reason?: string } | Record<string, unknown>;
  reason?: string;
  status: string;
  created_at: string;
}