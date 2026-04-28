export interface TeamData {
  evaluation_id: string;
  team_name: string;
  student_name: string;
  idea: string;
  idea_source?: 'detailed_submission' | 'project_title' | 'problem_statement' | 'theme' | 'fallback';
  submission_id?: string;
  team_id?: string;
  project_title?: string;
  theme?: string;
  problem_statement?: string;
  github?: string;
  github_profile_summary?: string;
  github_username?: string;
  linkedin?: string;
  source_row?: number;
  [key: string]: any; // Catchall for extra columns
}

export interface EvaluationScores {
  innovation: number;
  technical: number;
  feasibility: number;
  commercial: number;
  impact: number;
  design: number;
  pitch: number;
  summary: string;
}

export interface EvaluatedTeam extends TeamData {
  scores: EvaluationScores;
  total_score: number;
  rank?: number;
  is_shortlisted?: boolean;
}

export interface AppConfig {
  shortlistCount: number;
  weights: {
    innovation: number;
    technical: number;
    feasibility: number;
    commercial: number;
    impact: number;
    design: number;
    pitch: number;
    [key: string]: number;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warn' | 'error';
}
