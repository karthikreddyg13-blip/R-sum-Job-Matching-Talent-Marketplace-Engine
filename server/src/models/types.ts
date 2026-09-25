/**
 * Domain entities shared across routes, services and the persistence layer.
 * Mirrors the PostgreSQL schema in server/schema.sql (DB_MODE=json is the
 * default zero-setup mode; the SQL schema documents the production design).
 */

import { SkillRequirement, EducationLevel } from '../services/MatchingEngine';

export type { SkillRequirement, EducationLevel };

export type Role = 'candidate' | 'recruiter' | 'admin';

export interface User {
  id: string;
  email: string; // unique, lowercased
  passwordHash: string;
  role: Role;
  name: string;
  createdAt: string;
}

export interface Candidate extends CandidateProfileLiteShape {
  userId: string;
  headline: string;
  location: string;
  education: EducationLevel;
  experienceYears: number;
  skills: string[];
  resumeText?: string;
  resumeFileName?: string;   // uploaded résumé metadata
  resumeUrl?: string;        // storage URL when a file was uploaded
  resumeUpdatedAt?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

// keep the shape compatible with MatchingEngine.CandidateProfileLite
interface CandidateProfileLiteShape {
  id: string;
  name: string;
  skills: string[];
  education: EducationLevel;
  experienceYears: number;
  [k: string]: unknown;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  location: string;
  about: string;
  website?: string;
  createdAt: string;
}

export interface SkillCatalogItem {
  name: string;
  category: string;
}

export interface Recruiter {
  id: string;
  userId: string;
  companyId?: string; // FK into companies (Supabase schema)
  companyName: string;
  industry: string;
  location: string;
  about: string;
  website?: string;
  createdAt: string;
}

export interface Job {
  id: string;
  recruiterId: string;
  title: string;
  description: string;
  location: string;
  workMode: 'onsite' | 'remote' | 'hybrid';
  salaryMin?: number;
  salaryMax?: number;
  requiredSkills: SkillRequirement[];
  minEducation: EducationLevel;
  minExperienceYears: number;
  postedAt: string;
  active: boolean;
}

export type ApplicationStatus = 'applied' | 'review' | 'interview' | 'offer' | 'rejected';

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  matchScore: number; // snapshot of score at apply time
  status: ApplicationStatus;
  appliedAt: string;
  note?: string;
}

export interface RecommendationLog {
  id: string;
  forUserId: string;
  kind: 'jobs-for-candidate' | 'candidates-for-job' | 'similar-jobs';
  refId: string;
  topScore: number;
  generatedAt: string;
  algorithm: string; // e.g. "weighted-score + maxheap top-k"
}

export interface SavedJob {
  id: string;
  candidateId: string;
  jobId: string;
  savedAt: string;
}

export interface RoadmapRecord {
  id: string;
  candidateId: string;
  jobId: string;
  targetJobTitle: string;
  currentMatchScore: number;
  totalMonths: number;
  payload: unknown;          // full ReverseResumeRoadmap
  generatedAt: string;
}

export interface DatabaseShape {
  users: User[];
  companies: Company[];
  skills: SkillCatalogItem[];
  candidates: Candidate[];
  recruiters: Recruiter[];
  jobs: Job[];
  applications: Application[];
  savedJobs: SavedJob[];
  roadmaps: RoadmapRecord[];
  recommendations: RecommendationLog[];
  seq: Record<string, number>;
}
