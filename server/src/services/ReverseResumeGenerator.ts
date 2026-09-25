/**
 * ============================================================================
 *  REVERSE RESUME ROADMAP GENERATOR  (signature module)
 * ============================================================================
 *  After a skill gap analysis the candidate asks: "How do I close this gap?"
 *  The generator answers with:
 *
 *    - ordered skills to learn (dependency-aware topological sort)
 *    - recommended courses per skill
 *    - suggested portfolio projects that exercise the new skills
 *    - a month-by-month timeline (BFS on the skill dependency DAG)
 *
 *  The skill DAG is built from a curated prerequisite map, then Kahn's
 *  algorithm orders skills so prerequisites always precede dependents.
 *  Timeline months are assigned by dividing the ordered list into equal
 *  monthly buckets weighted by skill difficulty.
 * ============================================================================
 */

import { SkillGapReport } from './SkillGapAnalyzer';

export interface RoadmapSkill {
  skill: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  weeks: number;
  category: string;
}

export interface RoadmapCourse {
  skill: string;
  name: string;
  platform: string;
  duration: string;
  free: boolean;
}

export interface RoadmapProject {
  name: string;
  description: string;
  skills: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDays: number;
}

export interface RoadmapMilestone {
  month: string;
  title: string;
  description: string;
  skills: string[];
}

export interface ReverseResumeRoadmap {
  targetJobId: string;
  targetJobTitle: string;
  candidateId: string;
  currentMatchScore: number;
  targetMatchScore: number;
  skills: RoadmapSkill[];
  courses: RoadmapCourse[];
  projects: RoadmapProject[];
  milestones: RoadmapMilestone[];
  totalWeeks: number;
  totalMonths: number;
}

/** Curated prerequisite DAG (skill -> list of prerequisites). */
const PREREQUISITES: Record<string, string[]> = {
  'react': ['javascript', 'html', 'css'],
  'next.js': ['react'],
  'node.js': ['javascript'],
  'express.js': ['node.js'],
  'typescript': ['javascript'],
  'spring boot': ['java'],
  'docker': ['linux'],
  'kubernetes': ['docker'],
  'aws': ['linux'],
  'tensorflow': ['python', 'machine learning'],
  'pytorch': ['python', 'machine learning'],
  'machine learning': ['python', 'statistics'],
  'deep learning': ['machine learning'],
  'nlp': ['machine learning'],
  'computer vision': ['machine learning'],
  'data analysis': ['python', 'sql'],
  'pandas': ['python'],
  'pandas/numpy': ['python'],
  'flask': ['python'],
  'fastapi': ['python'],
  'django': ['python'],
  'mongodb': ['sql'],
  'postgresql': ['sql'],
  'redis': ['sql'],
  'graphql': ['rest apis'],
  'terraform': ['linux', 'aws'],
  'jenkins': ['git'],
  'kafka': ['java'],
  'microservices': ['rest apis'],
  'figma': ['ui design'],
  'adobe xd': ['ui design'],
  'cybersecurity': ['networking'],
  'penetration testing': ['cybersecurity', 'linux'],
  'siem tools': ['cybersecurity'],
  'go': ['programming fundamentals'],
  'rust': ['programming fundamentals'],
  'scala': ['programming fundamentals'],
  'spark': ['scala', 'sql'],
};

/** Difficulty -> weeks estimate (for a working professional, ~10h/week). */
const DIFFICULTY_WEEKS: Record<RoadmapSkill['difficulty'], number> = {
  beginner: 3,
  intermediate: 5,
  advanced: 8,
};

/** Difficulty -> category guess used when we have no curated category. */
function guessCategory(skill: string): string {
  const s = skill.toLowerCase();
  if (/python|java|javascript|typescript|go|rust|scala|c\+\+|c#/.test(s)) return 'Programming';
  if (/react|angular|vue|next|html|css|frontend|tailwind/.test(s)) return 'Frontend';
  if (/node|express|django|flask|fastapi|spring|rest|graphql|microservices/.test(s)) return 'Backend';
  if (/sql|mongodb|postgresql|redis|database|mysql/.test(s)) return 'Database';
  if (/aws|azure|gcp|docker|kubernetes|linux|terraform|jenkins|devops|ci\/cd/.test(s)) return 'DevOps/Cloud';
  if (/machine learning|deep learning|nlp|tensorflow|pytorch|computer vision|ai|data science/.test(s)) return 'AI/ML';
  if (/figma|ui|ux|design|prototype|wireframe/.test(s)) return 'Design';
  if (/security|cyber|penetration|siem|encryption/.test(s)) return 'Security';
  return 'General';
}

function difficultyFor(skill: string): RoadmapSkill['difficulty'] {
  const prereqs = PREREQUISITES[skill.toLowerCase()];
  if (prereqs && prereqs.length >= 2) return 'advanced';
  if (prereqs && prereqs.length === 1) return 'intermediate';
  return 'beginner';
}

/**
 * Curated course catalog consulted before the generic fallback.
 * Keys are canonical (lowercase) skill names.
 */
const COURSE_CATALOG: Record<string, RoadmapCourse[]> = {
  'python': [
    { skill: 'Python', name: 'Python for Everybody', platform: 'Coursera', duration: '8 weeks', free: true },
    { skill: 'Python', name: 'Complete Python Bootcamp', platform: 'Udemy', duration: '22 hours', free: false },
  ],
  'java': [
    { skill: 'Java', name: 'Java Programming Masterclass', platform: 'Udemy', duration: '80 hours', free: false },
    { skill: 'Java', name: 'Java Basics', platform: 'Codecademy', duration: '10 weeks', free: true },
  ],
  'sql': [
    { skill: 'SQL', name: 'SQL for Data Analysis', platform: 'Udacity', duration: '20 hours', free: true },
    { skill: 'SQL', name: 'Complete SQL + Databases Bootcamp', platform: 'Udemy', duration: '25 hours', free: false },
  ],
  'javascript': [
    { skill: 'JavaScript', name: 'JavaScript Algorithms & DOM', platform: 'freeCodeCamp', duration: '40 hours', free: true },
    { skill: 'JavaScript', name: 'The Modern JavaScript Tutorial', platform: 'javascript.info', duration: 'Self-paced', free: true },
  ],
  'react': [
    { skill: 'React', name: 'React - The Complete Guide', platform: 'Udemy', duration: '50 hours', free: false },
    { skill: 'React', name: 'Official React Tutorial', platform: 'react.dev', duration: 'Self-paced', free: true },
  ],
  'node.js': [
    { skill: 'Node.js', name: 'Node.js - The Complete Guide', platform: 'Udemy', duration: '40 hours', free: false },
  ],
  'docker': [
    { skill: 'Docker', name: 'Docker & Kubernetes: The Complete Guide', platform: 'Udemy', duration: '22 hours', free: false },
  ],
  'kubernetes': [
    { skill: 'Kubernetes', name: 'Certified Kubernetes Administrator (CKA)', platform: 'Udemy', duration: '30 hours', free: false },
  ],
  'aws': [
    { skill: 'AWS', name: 'AWS Certified Solutions Architect', platform: 'A Cloud Guru', duration: '30 hours', free: false },
  ],
  'machine learning': [
    { skill: 'Machine Learning', name: 'Machine Learning Specialization (Andrew Ng)', platform: 'Coursera', duration: '11 weeks', free: true },
  ],
  'deep learning': [
    { skill: 'Deep Learning', name: 'Deep Learning Specialization', platform: 'Coursera', duration: '4 months', free: true },
  ],
  'tensorflow': [
    { skill: 'TensorFlow', name: 'TensorFlow Developer Certificate', platform: 'TensorFlow', duration: '8 weeks', free: false },
  ],
  'pytorch': [
    { skill: 'PyTorch', name: 'PyTorch Fundamentals', platform: 'Udacity', duration: '6 weeks', free: true },
  ],
  'nlp': [
    { skill: 'NLP', name: 'NLP Specialization', platform: 'Coursera', duration: '4 months', free: true },
  ],
  'typescript': [
    { skill: 'TypeScript', name: 'Understanding TypeScript', platform: 'Udemy', duration: '15 hours', free: false },
  ],
  'mongodb': [
    { skill: 'MongoDB', name: 'MongoDB University M001', platform: 'MongoDB', duration: '20 hours', free: true },
  ],
  'postgresql': [
    { skill: 'PostgreSQL', name: 'PostgreSQL for Beginners', platform: 'Udemy', duration: '12 hours', free: false },
  ],
  'figma': [
    { skill: 'Figma', name: 'Figma Masterclass', platform: 'Udemy', duration: '20 hours', free: false },
  ],
  'linux': [
    { skill: 'Linux', name: 'Linux Fundamentals', platform: 'IBM SkillsBuild', duration: '20 hours', free: true },
  ],
  'git': [
    { skill: 'Git', name: 'Git Complete', platform: 'Udemy', duration: '8 hours', free: false },
  ],
  'networking': [
    { skill: 'Networking', name: 'Networking Essentials', platform: 'Cisco NetAcad', duration: '40 hours', free: true },
  ],
  'cybersecurity': [
    { skill: 'Cybersecurity', name: 'CompTIA Security+', platform: 'Udemy', duration: '40 hours', free: false },
  ],
};

function genericCourse(skill: string): RoadmapCourse {
  const pretty = skill.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    skill: pretty,
    name: `${pretty} Crash Course`,
    platform: 'YouTube / freeCodeCamp',
    duration: 'Self-paced',
    free: true,
  };
}

/** Portfolio project templates keyed by skill family. */
const PROJECT_TEMPLATES: Array<{
  match: RegExp;
  project: (skills: string[]) => RoadmapProject;
}> = [
  {
    match: /react|next|frontend|javascript|typescript/i,
    project: (skills) => ({
      name: 'Full-Stack Task Dashboard',
      description: 'Build a task management dashboard with authentication, role-based views and a REST API.',
      skills: skills.slice(0, 4),
      difficulty: 'intermediate',
      estimatedDays: 14,
    }),
  },
  {
    match: /machine learning|tensorflow|pytorch|deep learning/i,
    project: (skills) => ({
      name: 'End-to-End ML Pipeline',
      description: 'Train, evaluate and deploy a classifier behind a REST API with monitoring.',
      skills: skills.slice(0, 4),
      difficulty: 'advanced',
      estimatedDays: 21,
    }),
  },
  {
    match: /docker|kubernetes|terraform|jenkins|ci\/cd/i,
    project: (skills) => ({
      name: 'Self-Hosted CI/CD Lab',
      description: 'Containerize an app, provision infra with IaC and automate deploys with a pipeline.',
      skills: skills.slice(0, 4),
      difficulty: 'advanced',
      estimatedDays: 18,
    }),
  },
  {
    match: /sql|mongodb|postgresql|redis|database/i,
    project: (skills) => ({
      name: 'Analytics Warehouse Mini-Project',
      description: 'Design a schema, load a real dataset and answer 10 business questions with queries.',
      skills: skills.slice(0, 4),
      difficulty: 'intermediate',
      estimatedDays: 12,
    }),
  },
  {
    match: /security|cyber|penetration|siem/i,
    project: (skills) => ({
      name: 'Home Lab Security Audit',
      description: 'Stand up a small network, run a vulnerability assessment and write a professional report.',
      skills: skills.slice(0, 4),
      difficulty: 'advanced',
      estimatedDays: 16,
    }),
  },
  {
    match: /figma|ui|ux|design/i,
    project: (skills) => ({
      name: 'Mobile App Redesign Case Study',
      description: 'Run a mini UX research cycle and deliver a full Figma prototype with handoff notes.',
      skills: skills.slice(0, 4),
      difficulty: 'intermediate',
      estimatedDays: 14,
    }),
  },
];

function fallbackProject(skills: string[]): RoadmapProject {
  return {
    name: `${skills[0] ? skills[0].replace(/\b\w/g, (c) => c.toUpperCase()) : 'New Skill'} Practice Project`,
    description: `Apply ${skills.slice(0, 3).join(', ')} in a small end-to-end project and document it on GitHub.`,
    skills: skills.slice(0, 4),
    difficulty: 'intermediate',
    estimatedDays: 12,
  };
}

export class ReverseResumeGenerator {
  /**
   * Build a full roadmap from a skill gap report.
   * Pipeline: pick skills -> topological sort -> assign durations -> bucket into months.
   */
  generate(report: SkillGapReport): ReverseResumeRoadmap {
    const missing = [...report.missingRequired, ...report.missingPreferred];

    // 1. Expand with prerequisites that the candidate doesn't have yet.
    const candidateLower = new Set<string>();
    for (const s of report.matchedSkills) candidateLower.add(s.toLowerCase());
    const toLearn = new Set<string>(missing.map((m) => m.toLowerCase()));
    const queue = [...toLearn];
    while (queue.length) {
      const skill = queue.shift()!;
      for (const pre of PREREQUISITES[skill] ?? []) {
        if (!candidateLower.has(pre) && !toLearn.has(pre)) {
          toLearn.add(pre);
          queue.push(pre);
        }
      }
    }

    // 2. Topological sort (Kahn) over the missing-skills sub-DAG.
    const ordered = this.topoSort([...toLearn]);

    // 3. Build skill cards with difficulty + duration.
    const skills: RoadmapSkill[] = ordered.map((s) => ({
      skill: this.pretty(s),
      difficulty: difficultyFor(s),
      weeks: DIFFICULTY_WEEKS[difficultyFor(s)],
      category: guessCategory(s),
    }));

    // 4. Courses: curated catalog first, generic fallback after.
    const courses: RoadmapCourse[] = ordered.flatMap((s) => {
      const found = COURSE_CATALOG[s];
      return found ? found : [genericCourse(s)];
    });

    // 5. Projects: pick 2-3 templates matching the skill families.
    const projects: RoadmapProject[] = [];
    const seenTemplates = new Set<string>();
    for (const tpl of PROJECT_TEMPLATES) {
      const hits = ordered.filter((s) => tpl.match.test(s));
      if (hits.length >= 1 && !seenTemplates.has(tpl.project.name)) {
        seenTemplates.add(tpl.project.name);
        projects.push(tpl.project(hits.map((h) => this.pretty(h))));
      }
      if (projects.length >= 3) break;
    }
    if (projects.length === 0) projects.push(fallbackProject(ordered));

    // 6. Timeline: bucket skills into months by cumulative weeks (≈4.3 weeks/month).
    const totalWeeks = skills.reduce((a, s) => a + s.weeks, 0);
    const milestones = this.buildTimeline(skills);

    return {
      targetJobId: report.jobId,
      targetJobTitle: report.jobTitle,
      candidateId: report.candidateId,
      currentMatchScore: report.matchScore,
      targetMatchScore: Math.min(100, Math.round((report.matchScore + (100 - report.matchScore) * 0.85) * 10) / 10),
      skills,
      courses,
      projects,
      milestones,
      totalWeeks,
      totalMonths: Math.max(1, Math.ceil(totalWeeks / 4.33)),
    };
  }

  /** Kahn's algorithm — O(V + E). Prerequisites come before dependents. */
  private topoSort(skills: string[]): string[] {
    const set = new Set(skills);
    const indegree: Map<string, number> = new Map();
    const adj: Map<string, string[]> = new Map();
    for (const s of skills) {
      indegree.set(s, 0);
      adj.set(s, []);
    }
    for (const s of skills) {
      for (const pre of PREREQUISITES[s] ?? []) {
        if (set.has(pre)) {
          adj.get(pre)!.push(s);
          indegree.set(s, (indegree.get(s) ?? 0) + 1);
        }
      }
    }

    const queue = skills.filter((s) => (indegree.get(s) ?? 0) === 0);
    // stable: process queue alphabetically so output is deterministic
    queue.sort();
    const out: string[] = [];
    while (queue.length) {
      const s = queue.shift()!;
      out.push(s);
      for (const dep of adj.get(s) ?? []) {
        const d = (indegree.get(dep) ?? 1) - 1;
        indegree.set(dep, d);
        if (d === 0) {
          queue.push(dep);
          queue.sort();
        }
      }
    }
    // cycle fallback (shouldn't happen with curated data) — append leftovers
    for (const s of skills) if (!out.includes(s)) out.push(s);
    return out;
  }

  /** Group ordered skills into month buckets for the timeline UI. */
  private buildTimeline(skills: RoadmapSkill[]): RoadmapMilestone[] {
    const milestones: RoadmapMilestone[] = [];
    let week = 0;
    const WEEKS_PER_MONTH = 4.33;

    for (const s of skills) {
      const month = Math.floor(week / WEEKS_PER_MONTH) + 1;
      const label = `Month ${month}`;
      let m = milestones.find((x) => x.month === label);
      if (!m) {
        m = { month: label, title: '', description: '', skills: [] };
        milestones.push(m);
      }
      m.skills.push(s.skill);
      week += s.weeks;
    }

    milestones.forEach((m) => {
      m.title = `${m.skills.length} skill${m.skills.length > 1 ? 's' : ''}: ${m.skills.slice(0, 3).join(', ')}${m.skills.length > 3 ? '…' : ''}`;
      m.description = `Focus this month on ${m.skills.join(', ')}. Finish the linked course, then apply the skill in a mini-project commit on GitHub.`;
    });
    return milestones;
  }

  private pretty(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
