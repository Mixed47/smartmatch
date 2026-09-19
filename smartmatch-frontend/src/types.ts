export interface Skill { name: string; grade: string; type: string; source: string; }
export interface ParsedSkill { skill: string; weight: 'STANDARD' | 'IMPORTANT' | 'CRITICAL'; }
export interface JobMatch { job_title: string; company: string; required_skills?: any[]; match_percentage: number; matched_skills: string[]; missing_skills: string[]; }
export interface Application { id: string; name: string; job_title: string; company: string; match_percentage: number; skills: string[]; resume_url: string; status: string; }
export interface CancelRequest { id: number; application_id: string; student_name: string; company_name: string; reason: string; status: string; }
export interface Evaluation { application_id: string; score: number; comment: string; }