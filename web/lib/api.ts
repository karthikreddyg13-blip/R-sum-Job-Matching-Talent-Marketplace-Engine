/**
 * API client — thin fetch wrapper with JWT handling.
 * Uses Next.js rewrites (/api -> http://localhost:4000/api) in dev.
 */

const BASE = '/api';

export interface AuthUser {
  id: string;
  email: string;
  role: 'candidate' | 'recruiter';
  name: string;
  profileId?: string;
}

export interface SkillReq {
  name: string;
  weight: number;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  workMode: string;
  salaryMin?: number;
  salaryMax?: number;
  requiredSkills: SkillReq[];
  minEducation: string;
  minExperienceYears: number;
  postedAt: string;
  recruiterId: string;
  companyName?: string;
}

export interface MatchBreakdown {
  requiredSkillMatch: number;
  preferredSkillMatch: number;
  educationMatch: number;
  experienceMatch: number;
}

export interface JobRecommendation {
  job: Job;
  score: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingRequired: string[];
  missingPreferred: string[];
}

export interface CandidateCard {
  id: string;
  name: string;
  headline: string;
  location: string;
  education: string;
  experienceYears: number;
  skills: string[];
}

export interface CandidateRecommendation {
  candidate: CandidateCard;
  score: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  missingRequired: string[];
}

export interface SkillGapReport {
  jobId: string;
  jobTitle: string;
  matchScore: number;
  matchedSkills: string[];
  missingRequired: string[];
  missingPreferred: string[];
  gapCount: number;
  gapSeverity: string;
}

export interface Roadmap {
  targetJobTitle: string;
  currentMatchScore: number;
  targetMatchScore: number;
  totalMonths: number;
  skills: Array<{ skill: string; difficulty: string; weeks: number; category: string }>;
  courses: Array<{ skill: string; name: string; platform: string; duration: string; free: boolean }>;
  projects: Array<{ name: string; description: string; skills: string[]; difficulty: string; estimatedDays: number }>;
  milestones: Array<{ month: string; title: string; description: string; skills: string[] }>;
}

export interface RankedJobItem extends JobRecommendation {
  matchScore: number;
  skillCount: number;
}

function token(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tm_token') ?? '';
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('tm_user');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function saveSession(tokenValue: string, user: AuthUser): void {
  localStorage.setItem('tm_token', tokenValue);
  localStorage.setItem('tm_user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('tm_token');
  localStorage.removeItem('tm_user');
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------- auth

export function login(email: string, password: string) {
  return request<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string, role: string, name: string) {
  return request<{ token: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, role, name }),
  });
}

// ---------------------------------------------------------------- jobs

export function listJobs(q = '') {
  return request<{ items: Job[]; count: number }>(`/jobs?q=${encodeURIComponent(q)}`);
}

export function jobRecommendations(limit = 10) {
  return request<{ items: JobRecommendation[]; algorithm: string }>(`/jobs/recommendations?limit=${limit}`);
}

export function rankedJobs(q: string, sort: string) {
  return request<{ items: JobRecommendation[]; sortMetrics: { comparisons: number; swaps: number; timeMs: number } }>(
    `/jobs/ranked?q=${encodeURIComponent(q)}&sort=${sort}`
  );
}

export function jobDetail(id: string) {
  return request<{ job: Job; similar: Array<{ jobId: string; title: string; sharedSkills: number }> }>(`/jobs/${id}`);
}

export function postJob(payload: Record<string, unknown>) {
  return request<Job>('/jobs', { method: 'POST', body: JSON.stringify(payload) });
}

export function applyToJob(id: string, note = '') {
  return request<Record<string, unknown>>(`/jobs/${id}/apply`, { method: 'POST', body: JSON.stringify({ note }) });
}

export function saveJob(id: string) {
  return request<{ ok: boolean }>(`/jobs/${id}/save`, { method: 'POST' });
}

export function unsaveJob(id: string) {
  return request<{ ok: boolean }>(`/jobs/${id}/save`, { method: 'DELETE' });
}

export function savedJobs() {
  return request<{ items: Array<{ savedAt: string; job: Job }> }>('/jobs/saved');
}

export function updateJob(id: string, payload: Record<string, unknown>) {
  return request<Job>(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteJob(id: string) {
  return request<{ ok: boolean }>(`/jobs/${id}`, { method: 'DELETE' });
}

export function jobApplicants(jobId: string) {
  return request<{ items: Array<{ application: { id: string; matchScore: number; status: string; appliedAt: string; note?: string }; candidate: CandidateCard & { resumeFileName?: string; githubUrl?: string; linkedinUrl?: string; phone?: string } }>; job: { id: string; title: string } }>(
    `/jobs/${jobId}/applicants`
  );
}

export function updateApplicationStatus(jobId: string, appId: string, status: string) {
  return request<Record<string, unknown>>(`/jobs/${jobId}/applicants/${appId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function skillGap(jobId: string) {
  return request<SkillGapReport>(`/jobs/${jobId}/skill-gap`);
}

export function reverseResume(jobId: string) {
  return request<Roadmap>(`/jobs/${jobId}/reverse-resume`);
}

// ---------------------------------------------------------------- candidates

export function candidateSearch(params: { q?: string; skill?: string; sort?: string; jobId?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.skill) sp.set('skill', params.skill);
  if (params.sort) sp.set('sort', params.sort);
  if (params.jobId) sp.set('jobId', params.jobId);
  return request<{
    items: CandidateRecommendation[];
    sortMetrics: { comparisons: number; swaps: number; timeMs: number };
    benchmarkJob?: { id: string; title: string };
    note?: string;
  }>(`/candidates?${sp.toString()}`);
}

export function myCandidateProfile() {
  return request<CandidateCard & {
    userId: string; githubUrl?: string; linkedinUrl?: string; phone?: string;
    resumeText?: string; resumeFileName?: string; resumeUrl?: string; resumeUpdatedAt?: string;
  }>('/candidates/me');
}

export function updateCandidateProfile(payload: Record<string, unknown>) {
  return request<Record<string, unknown>>('/candidates/me', { method: 'PUT', body: JSON.stringify(payload) });
}

export function getMyJobsWithCounts() {
  return request<{ items: Array<Job & { applicantCount: number }> }>('/candidates/company/me/jobs');
}

export function myCompanyProfile() {
  return request<Record<string, unknown>>('/candidates/company/me');
}

export function updateCompanyProfile(payload: Record<string, unknown>) {
  return request<Record<string, unknown>>('/candidates/company/me', { method: 'PUT', body: JSON.stringify(payload) });
}

export function myJobs() {
  return request<{ items: Job[] }>('/candidates/company/me/jobs');
}

// ---------------------------------------------------------------- misc

export function autocomplete(kind: 'skill' | 'job' | 'company', q: string) {
  return request<{ suggestions: string[]; meta: { timeMs: number; structure: string } }>(
    `/autocomplete?kind=${kind}&q=${encodeURIComponent(q)}`
  );
}

export function analyticsOverview() {
  return request<Record<string, unknown>>('/analytics/overview');
}

export function analyticsDsa(n: number) {
  return request<Record<string, unknown>>(`/analytics/dsa?n=${n}`);
}

export function myApplications() {
  return request<{ items: Array<{ id: string; jobId: string; matchScore: number; status: string; appliedAt: string; job: Job | null }> }>(
    '/applications'
  );
}

export function candidatesForJob(jobId: string, sort = 'matchScore') {
  return request<{ items: CandidateRecommendation[]; sortMetrics: { comparisons: number; swaps: number; timeMs: number } }>(
    `/jobs/${jobId}/candidates?sort=${sort}`
  );
}
