import 'dotenv/config';
import { Store } from './models/Store';
import path from 'path';
import bcrypt from 'bcryptjs';
import { SupabaseService } from './services/SupabaseService';

const DATA_DIR = path.join(process.cwd(), 'data');
const store = new Store(DATA_DIR);

// reset collections
store.db.users = [];
store.db.companies = [];
store.db.skills = [];
store.db.candidates = [];
store.db.recruiters = [];
store.db.jobs = [];
store.db.applications = [];
store.db.savedJobs = [];
store.db.recommendations = [];
store.db.roadmaps = [];
store.db.seq = {};

// ---------------------------------------------------------------- skills catalog (100)

const SKILL_CATALOG: Array<[string, string]> = [
  // Programming (14)
  ['Python', 'Programming'], ['Java', 'Programming'], ['JavaScript', 'Programming'], ['TypeScript', 'Programming'],
  ['C', 'Programming'], ['C++', 'Programming'], ['C#', 'Programming'], ['Go', 'Programming'],
  ['Rust', 'Programming'], ['Kotlin', 'Programming'], ['Swift', 'Programming'], ['Ruby', 'Programming'],
  ['PHP', 'Programming'], ['Scala', 'Programming'],
  // Frontend (12)
  ['HTML', 'Frontend'], ['CSS', 'Frontend'], ['React', 'Frontend'], ['Next.js', 'Frontend'], ['Angular', 'Frontend'],
  ['Vue.js', 'Frontend'], ['Svelte', 'Frontend'], ['Tailwind CSS', 'Frontend'], ['Redux', 'Frontend'],
  ['UI Design', 'Frontend'], ['Responsive Design', 'Frontend'], ['Web Accessibility', 'Frontend'],
  // Backend (12)
  ['Node.js', 'Backend'], ['Express.js', 'Backend'], ['NestJS', 'Backend'], ['Django', 'Backend'], ['Flask', 'Backend'],
  ['FastAPI', 'Backend'], ['Spring Boot', 'Backend'], ['Rails', 'Backend'], ['Laravel', 'Backend'],
  ['REST APIs', 'Backend'], ['GraphQL', 'Backend'], ['Microservices', 'Backend'],
  // Databases (10)
  ['SQL', 'Database'], ['PostgreSQL', 'Database'], ['MySQL', 'Database'], ['MongoDB', 'Database'], ['Redis', 'Database'],
  ['Elasticsearch', 'Database'], ['Cassandra', 'Database'], ['DynamoDB', 'Database'], ['SQLite', 'Database'], ['Supabase', 'Database'],
  // Cloud & DevOps (12)
  ['AWS', 'Cloud/DevOps'], ['Azure', 'Cloud/DevOps'], ['GCP', 'Cloud/DevOps'], ['Docker', 'Cloud/DevOps'],
  ['Kubernetes', 'Cloud/DevOps'], ['Terraform', 'Cloud/DevOps'], ['Jenkins', 'Cloud/DevOps'], ['CI/CD', 'Cloud/DevOps'],
  ['Linux', 'Cloud/DevOps'], ['Bash', 'Cloud/DevOps'], ['Monitoring', 'Cloud/DevOps'], ['Git', 'Cloud/DevOps'],
  // Data & AI (14)
  ['Machine Learning', 'Data/AI'], ['Deep Learning', 'Data/AI'], ['NLP', 'Data/AI'], ['Computer Vision', 'Data/AI'],
  ['TensorFlow', 'Data/AI'], ['PyTorch', 'Data/AI'], ['Pandas/Numpy', 'Data/AI'], ['Statistics', 'Data/AI'],
  ['Data Analysis', 'Data/AI'], ['Data Visualization', 'Data/AI'], ['Tableau', 'Data/AI'], ['Kafka', 'Data/AI'],
  ['Spark', 'Data/AI'], ['Big Data', 'Data/AI'],
  // Security (6)
  ['Cybersecurity', 'Security'], ['Penetration Testing', 'Security'], ['Network Security', 'Security'],
  ['SIEM Tools', 'Security'], ['Cryptography', 'Security'], ['IAM', 'Security'],
  // Mobile (5)
  ['React Native', 'Mobile'], ['Flutter', 'Mobile'], ['Android', 'Mobile'], ['iOS', 'Mobile'], ['Mobile UI', 'Mobile'],
  // Design & Product (9)
  ['Figma', 'Design'], ['Adobe XD', 'Design'], ['User Research', 'Design'], ['Prototyping', 'Design'],
  ['Wireframing', 'Design'], ['Design Systems', 'Design'], ['UX Writing', 'Design'], ['Product Management', 'Design'], ['Agile', 'Design'],
  // Networking & Other (6)
  ['Networking', 'Infrastructure'], ['Load Balancing', 'Infrastructure'], ['DNS', 'Infrastructure'],
  ['Testing', 'Quality'], ['Selenium', 'Quality'], ['Cypress', 'Quality'],
];

for (const [name, category] of SKILL_CATALOG) {
  store.db.skills.push({ name, category });
}

const DEMO_PASSWORD = bcrypt.hashSync('password123', 10);
let uSeq = 0;
let cSeq = 0;
let rSeq = 0;
let jSeq = 0;
const uid = () => `u${++uSeq}`;
const cid = () => `c${++cSeq}`;
const rid = () => `r${++rSeq}`;
const jid = () => `j${++jSeq}`;

// ---------------------------------------------------------------- admin account

store.db.users.push({
  id: uid(), email: 'admin@talentmatch.dev', passwordHash: DEMO_PASSWORD,
  role: 'admin', name: 'Platform Admin', createdAt: new Date().toISOString(),
});

// ---------------------------------------------------------------- companies (10)

const companyDefs = [
  { name: 'Nimbus Soft', industry: 'Software', location: 'Hyderabad, IN', about: 'Product engineering studio for SaaS startups.' },
  { name: 'Vertex Analytics', industry: 'Data & AI', location: 'Bengaluru, IN', about: 'Decision intelligence for retail and banking.' },
  { name: 'CloudForge Labs', industry: 'Cloud & DevOps', location: 'Remote (IN)', about: 'Cloud-native infrastructure consulting.' },
  { name: 'SecureSphere', industry: 'Cybersecurity', location: 'Pune, IN', about: 'Managed security operations and pentesting.' },
  { name: 'Pixelforge Studio', industry: 'Design', location: 'Mumbai, IN', about: 'Product design partner for fintech apps.' },
  { name: 'DataNest Systems', industry: 'Big Data', location: 'Chennai, IN', about: 'Streaming data platforms at petabyte scale.' },
  { name: 'Helios Fintech', industry: 'Fintech', location: 'Mumbai, IN', about: 'Payments and lending infrastructure for Bharat.' },
  { name: 'Quantum Health', industry: 'HealthTech', location: 'Bengaluru, IN', about: 'Telemedicine and diagnostics platform.' },
  { name: 'Orbit Commerce', industry: 'E-commerce', location: 'Gurugram, IN', about: 'Marketplace and fulfillment technology.' },
  { name: 'Solaris EdTech', industry: 'EdTech', location: 'Delhi, IN', about: 'Adaptive learning for K-12 and test prep.' },
];

const companyIds: string[] = [];
for (const co of companyDefs) {
  const id = `co${companyIds.length + 1}`;
  companyIds.push(id);
  store.db.companies.push({
    id, name: co.name, industry: co.industry, location: co.location, about: co.about,
    website: `https://example.com/${co.name.toLowerCase().replace(/[^a-z]/g, '')}`,
    createdAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------- recruiters (6, linked to companies)

const recruiters = [
  { email: 'hr@nimbussoft.com', companyIdx: 0, contact: 'HR Team' },
  { email: 'talent@vertexanalytics.com', companyIdx: 1, contact: 'Talent Team' },
  { email: 'jobs@cloudforgelabs.com', companyIdx: 2, contact: 'People Ops' },
  { email: 'careers@securesphere.io', companyIdx: 3, contact: 'Recruiting' },
  { email: 'hello@pixelforge.studio', companyIdx: 4, contact: 'Studio Lead' },
  { email: 'people@datanest.systems', companyIdx: 5, contact: 'People Team' },
];

const recruiterIds: string[] = [];
for (const rc of recruiters) {
  const co = companyDefs[rc.companyIdx];
  const u = { id: uid(), email: rc.email, passwordHash: DEMO_PASSWORD, role: 'recruiter' as const, name: co.name, createdAt: new Date().toISOString() };
  store.db.users.push(u);
  const r = rid();
  recruiterIds.push(r);
  store.db.recruiters.push({
    id: r, userId: u.id, companyId: companyIds[rc.companyIdx], companyName: co.name, industry: co.industry,
    location: co.location, about: co.about,
    website: `https://example.com/${co.name.toLowerCase().replace(/[^a-z]/g, '')}`,
    createdAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------- jobs (exactly 20)

function job(
  recruiterIdx: number, title: string, description: string, location: string,
  workMode: 'onsite' | 'remote' | 'hybrid',
  skills: Array<[string, number]>,
  minEducation: 'none' | 'diploma' | 'bachelors' | 'masters' | 'phd',
  minExp: number, salaryMin: number, salaryMax: number
): void {
  store.db.jobs.push({
    id: jid(), recruiterId: recruiterIds[recruiterIdx], title, description, location, workMode,
    salaryMin, salaryMax,
    requiredSkills: skills.map(([name, weight]) => ({ name, weight: weight as 1 | 2 | 3 | 4 | 5 })),
    minEducation, minExperienceYears: minExp,
    postedAt: new Date(Date.now() - Math.floor(Math.random() * 28) * 86400000).toISOString(),
    active: true,
  });
}

// Nimbus Soft (idx 0) — 4 jobs
job(0, 'Full Stack Developer', 'Build SaaS features end-to-end with React and Node.js.', 'Hyderabad, IN', 'hybrid',
  [['JavaScript', 5], ['React', 5], ['Node.js', 4], ['SQL', 3], ['TypeScript', 2], ['Docker', 2]], 'bachelors', 2, 900000, 1600000);
job(0, 'Frontend Engineer', 'Craft responsive interfaces and design systems.', 'Hyderabad, IN', 'hybrid',
  [['JavaScript', 5], ['React', 5], ['CSS', 4], ['TypeScript', 3], ['UI Design', 1]], 'bachelors', 1, 800000, 1400000);
job(0, 'Backend Engineer (Node)', 'Design REST APIs and data models at scale.', 'Remote (IN)', 'remote',
  [['Node.js', 5], ['Express.js', 4], ['MongoDB', 4], ['REST APIs', 3], ['Redis', 2]], 'bachelors', 2, 1000000, 1800000);
job(0, 'Python Developer', 'Automate internal tooling and integrations.', 'Hyderabad, IN', 'onsite',
  [['Python', 5], ['Flask', 4], ['SQL', 3], ['Pandas/Numpy', 2]], 'bachelors', 1, 700000, 1200000);

// Vertex Analytics (idx 1) — 4 jobs
job(1, 'Data Scientist', 'Own predictive models for retail clients from data to deployment.', 'Bengaluru, IN', 'hybrid',
  [['Python', 5], ['Machine Learning', 5], ['SQL', 4], ['Pandas/Numpy', 3], ['Statistics', 2]], 'bachelors', 2, 1200000, 2200000);
job(1, 'AI Engineer', 'Productionize LLM and CV features for enterprise apps.', 'Bengaluru, IN', 'hybrid',
  [['Python', 5], ['Machine Learning', 5], ['TensorFlow', 4], ['Docker', 3], ['NLP', 2]], 'masters', 2, 1500000, 2800000);
job(1, 'ML Intern', 'Assist the ML team with experiments and data cleaning.', 'Bengaluru, IN', 'onsite',
  [['Python', 4], ['Statistics', 3], ['Machine Learning', 2]], 'bachelors', 0, 300000, 500000);
job(1, 'Analytics Engineer', 'Build semantic layers and dashboards.', 'Bengaluru, IN', 'remote',
  [['SQL', 5], ['Data Analysis', 4], ['Python', 3], ['Tableau', 2]], 'bachelors', 1, 900000, 1500000);

// CloudForge Labs (idx 2) — 3 jobs
job(2, 'DevOps Engineer', 'Automate cloud infrastructure and CI/CD for clients.', 'Remote (IN)', 'remote',
  [['AWS', 5], ['Docker', 5], ['Kubernetes', 4], ['Terraform', 3], ['Linux', 4], ['Jenkins', 2]], 'bachelors', 3, 1400000, 2600000);
job(2, 'Cloud Support Engineer', 'Triage and resolve customer cloud issues.', 'Remote (IN)', 'remote',
  [['Linux', 5], ['AWS', 4], ['Networking', 3]], 'diploma', 1, 600000, 1100000);
job(2, 'Site Reliability Engineer', 'Keep the platform fast and reliable.', 'Bengaluru, IN', 'hybrid',
  [['Kubernetes', 5], ['AWS', 5], ['Monitoring', 4], ['Linux', 3]], 'bachelors', 3, 1600000, 3000000);

// SecureSphere (idx 3) — 3 jobs
job(3, 'Cybersecurity Analyst', 'Monitor SOC alerts and run incident response.', 'Pune, IN', 'onsite',
  [['Cybersecurity', 5], ['Networking', 4], ['Linux', 4], ['SIEM Tools', 3]], 'bachelors', 1, 700000, 1300000);
job(3, 'Penetration Tester', 'Perform VAPT for enterprise clients.', 'Pune, IN', 'hybrid',
  [['Penetration Testing', 5], ['Networking', 4], ['Linux', 3], ['Cybersecurity', 4]], 'bachelors', 2, 900000, 1700000);
job(3, 'Security Engineer', 'Harden cloud workloads and build detection tooling.', 'Remote (IN)', 'remote',
  [['Cybersecurity', 5], ['AWS', 4], ['Python', 3], ['Linux', 3]], 'bachelors', 2, 1200000, 2100000);

// Pixelforge (idx 4) — 3 jobs
job(4, 'UI/UX Designer', 'Design fintech interfaces from research to handoff.', 'Mumbai, IN', 'hybrid',
  [['Figma', 5], ['UI Design', 5], ['User Research', 3], ['Prototyping', 4]], 'diploma', 1, 600000, 1200000);
job(4, 'Product Designer', 'Own end-to-end product design for a payments app.', 'Remote (IN)', 'remote',
  [['Figma', 5], ['UI Design', 4], ['User Research', 4], ['HTML', 2]], 'bachelors', 2, 900000, 1600000);
job(4, 'Design Intern', 'Support the design team with research and mockups.', 'Mumbai, IN', 'onsite',
  [['Figma', 4], ['UI Design', 3]], 'none', 0, 250000, 400000);

// DataNest (idx 5) — 3 jobs
job(5, 'Big Data Engineer', 'Build streaming pipelines with Kafka and Spark.', 'Chennai, IN', 'onsite',
  [['Java', 5], ['Kafka', 5], ['Spark', 4], ['SQL', 4], ['Scala', 2]], 'bachelors', 3, 1500000, 2800000);
job(5, 'Data Engineer', 'Model warehouses and batch pipelines.', 'Chennai, IN', 'hybrid',
  [['SQL', 5], ['Python', 4], ['Spark', 3], ['PostgreSQL', 3]], 'bachelors', 2, 1100000, 1900000);
job(5, 'Java Backend Developer', 'Maintain high-throughput ingestion services.', 'Chennai, IN', 'onsite',
  [['Java', 5], ['Spring Boot', 4], ['PostgreSQL', 3], ['Docker', 2]], 'bachelors', 2, 1000000, 1800000);

// ---------------------------------------------------------------- candidates (exactly 20)

interface SeedCandidate {
  name: string; email: string; headline: string; location: string;
  education: 'none' | 'diploma' | 'bachelors' | 'masters' | 'phd';
  experienceYears: number; skills: string[];
  githubUrl?: string; linkedinUrl?: string; phone?: string; resumeText?: string;
}

const people: SeedCandidate[] = [
  { name: 'Aarav Sharma', email: 'aarav@example.com', headline: 'Full stack developer, 3 yrs in SaaS', location: 'Hyderabad, IN', education: 'bachelors', experienceYears: 3, skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express.js', 'MongoDB', 'SQL', 'Docker'], githubUrl: 'https://github.com/aarav', linkedinUrl: 'https://linkedin.com/in/aarav', phone: '+91 90000 00001', resumeText: 'Full stack engineer. React, Node.js, MongoDB, SQL, Docker. Built SaaS dashboards and payment integrations.' },
  { name: 'Diya Patel', email: 'diya@example.com', headline: 'Frontend specialist, design-minded', location: 'Ahmedabad, IN', education: 'bachelors', experienceYears: 2, skills: ['JavaScript', 'React', 'CSS', 'HTML', 'UI Design', 'Figma'], resumeText: 'Frontend developer focused on design systems and accessibility.' },
  { name: 'Rohan Verma', email: 'rohan@example.com', headline: 'Backend engineer — APIs & data', location: 'Pune, IN', education: 'bachelors', experienceYears: 4, skills: ['Node.js', 'Express.js', 'MongoDB', 'Redis', 'REST APIs', 'Docker', 'PostgreSQL'], resumeText: 'Backend engineer. REST APIs, queues, caching, MongoDB and PostgreSQL.' },
  { name: 'Ananya Iyer', email: 'ananya@example.com', headline: 'Data scientist, retail analytics', location: 'Bengaluru, IN', education: 'masters', experienceYears: 3, skills: ['Python', 'Machine Learning', 'SQL', 'Pandas/Numpy', 'Statistics', 'TensorFlow'], resumeText: 'Data scientist. Churn models, uplift models, A/B testing at scale.' },
  { name: 'Karthik Reddy', email: 'karthik@example.com', headline: 'AI engineer in the making', location: 'Hyderabad, IN', education: 'bachelors', experienceYears: 1, skills: ['Python', 'SQL', 'Machine Learning', 'Statistics'], resumeText: 'Aspiring AI engineer. Python, SQL, ML fundamentals, statistics.' },
  { name: 'Sneha Nair', email: 'sneha@example.com', headline: 'DevOps engineer, AWS certified', location: 'Kochi, IN', education: 'bachelors', experienceYears: 4, skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Linux', 'Jenkins'], resumeText: 'DevOps engineer. AWS, EKS, Terraform, CI/CD pipelines.' },
  { name: 'Vikram Singh', email: 'vikram@example.com', headline: 'Cloud support → SRE track', location: 'Jaipur, IN', education: 'diploma', experienceYears: 2, skills: ['Linux', 'AWS', 'Networking', 'Bash'], resumeText: 'Cloud support engineer moving to SRE. Linux, AWS, networking.' },
  { name: 'Priya Menon', email: 'priya@example.com', headline: 'Security analyst (SOC)', location: 'Pune, IN', education: 'bachelors', experienceYears: 2, skills: ['Cybersecurity', 'Networking', 'Linux', 'SIEM Tools', 'Python'], resumeText: 'SOC analyst. SIEM tuning, incident response, threat hunting.' },
  { name: 'Arjun Das', email: 'arjun@example.com', headline: 'Pentester, OSCP in progress', location: 'Kolkata, IN', education: 'bachelors', experienceYears: 3, skills: ['Penetration Testing', 'Cybersecurity', 'Linux', 'Networking'], resumeText: 'Penetration tester. Web, API and network VAPT.' },
  { name: 'Meera Krishnan', email: 'meera@example.com', headline: 'Product designer, fintech focus', location: 'Chennai, IN', education: 'bachelors', experienceYears: 3, skills: ['Figma', 'UI Design', 'User Research', 'Prototyping', 'HTML'], resumeText: 'Product designer. Research-led, fintech and payments.' },
  { name: 'Ishaan Gupta', email: 'ishaan@example.com', headline: 'Big data engineer, Kafka & Spark', location: 'Noida, IN', education: 'bachelors', experienceYears: 4, skills: ['Java', 'Kafka', 'Spark', 'SQL', 'Scala'], resumeText: 'Big data engineer. Kafka pipelines, Spark jobs, data modeling.' },
  { name: 'Tara Joshi', email: 'tara@example.com', headline: 'Data engineer, warehouse modeling', location: 'Bengaluru, IN', education: 'masters', experienceYears: 2, skills: ['SQL', 'Python', 'PostgreSQL', 'Data Analysis'], resumeText: 'Data engineer. Warehouse modeling, ELT, dbt-style transforms.' },
  { name: 'Aditya Rao', email: 'aditya@example.com', headline: 'Final-year CS student, full stack track', location: 'Bengaluru, IN', education: 'bachelors', experienceYears: 0, skills: ['JavaScript', 'React', 'HTML', 'CSS', 'Python'], resumeText: 'Final-year CS student. React projects, DSA practice.' },
  { name: 'Nisha Agarwal', email: 'nisha@example.com', headline: 'Mobile developer, React Native', location: 'Mumbai, IN', education: 'bachelors', experienceYears: 2, skills: ['JavaScript', 'React', 'React Native', 'REST APIs'], resumeText: 'Mobile developer. React Native apps in production.' },
  { name: 'Farhan Khan', email: 'farhan@example.com', headline: 'Python developer, automation', location: 'Lucknow, IN', education: 'bachelors', experienceYears: 1, skills: ['Python', 'Flask', 'SQL', 'Pandas/Numpy'], resumeText: 'Python developer. Automation, scraping, small APIs.' },
  { name: 'Kavya Shetty', email: 'kavya@example.com', headline: 'Analytics engineer', location: 'Bengaluru, IN', education: 'bachelors', experienceYears: 2, skills: ['SQL', 'Data Analysis', 'Python', 'Tableau'], resumeText: 'Analytics engineer. Semantic layers, dashboards, experimentation support.' },
  { name: 'Nikhil Bansal', email: 'nikhil@example.com', headline: 'SRE, observability nerd', location: 'Gurugram, IN', education: 'bachelors', experienceYears: 5, skills: ['Kubernetes', 'AWS', 'Monitoring', 'Linux', 'Go'], resumeText: 'SRE. Kubernetes, observability stacks, incident command.' },
  { name: 'Riya Kapoor', email: 'riya@example.com', headline: 'UX researcher + designer', location: 'Delhi, IN', education: 'masters', experienceYears: 2, skills: ['User Research', 'Figma', 'Prototyping', 'UI Design'], resumeText: 'UX researcher and designer. Mixed methods, usability testing.' },
  { name: 'Suresh Kumar', email: 'suresh@example.com', headline: 'Java developer, enterprise systems', location: 'Coimbatore, IN', education: 'bachelors', experienceYears: 3, skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker'], resumeText: 'Java developer. Spring Boot microservices, PostgreSQL.' },
  { name: 'Lakshmi Prasad', email: 'lakshmi@example.com', headline: 'ML fresher, Kaggle enthusiast', location: 'Vijayawada, IN', education: 'bachelors', experienceYears: 0, skills: ['Python', 'Statistics', 'Machine Learning'], resumeText: 'ML fresher. Kaggle competitions, statistical learning.' },
];

for (const p of people) {
  const u = { id: uid(), email: p.email, passwordHash: DEMO_PASSWORD, role: 'candidate' as const, name: p.name, createdAt: new Date().toISOString() };
  store.db.users.push(u);
  store.db.candidates.push({
    id: cid(), userId: u.id, name: p.name, headline: p.headline, location: p.location,
    education: p.education, experienceYears: p.experienceYears, skills: p.skills,
    githubUrl: p.githubUrl, linkedinUrl: p.linkedinUrl, phone: p.phone, resumeText: p.resumeText,
    resumeFileName: undefined, resumeUrl: undefined, resumeUpdatedAt: undefined,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------- applications (9)

function apply(candidateEmail: string, jobIdx: number, status: 'applied' | 'review' | 'interview' | 'offer' | 'rejected'): void {
  const cand = store.db.candidates.find((c) => store.db.users.find((u) => u.id === c.userId)?.email === candidateEmail);
  const j = store.db.jobs[jobIdx];
  if (!cand || !j) return;
  if (store.db.applications.some((a) => a.jobId === j.id && a.candidateId === cand.id)) return;
  store.db.applications.push({
    id: `a${store.db.applications.length + 1}`,
    jobId: j.id, candidateId: cand.id, matchScore: 0, status,
    appliedAt: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString(),
  });
}

apply('aarav@example.com', 0, 'interview');
apply('diya@example.com', 1, 'review');
apply('rohan@example.com', 2, 'applied');
apply('ananya@example.com', 4, 'offer');
apply('sneha@example.com', 8, 'interview');
apply('priya@example.com', 12, 'review');
apply('meera@example.com', 14, 'applied');
apply('ishaan@example.com', 16, 'applied');
apply('aditya@example.com', 6, 'applied');

// ---------------------------------------------------------------- saved jobs (6)

const savedPairs: Array<[string, number]> = [
  ['karthik@example.com', 4], ['karthik@example.com', 5], ['karthik@example.com', 17],
  ['aarav@example.com', 2], ['aditya@example.com', 0], ['lakshmi@example.com', 6],
];
for (const [email, jobIdx] of savedPairs) {
  const cand = store.db.candidates.find((c) => store.db.users.find((u) => u.id === c.userId)?.email === email);
  const j = store.db.jobs[jobIdx];
  if (!cand || !j) continue;
  if (store.db.savedJobs.some((s) => s.jobId === j.id && s.candidateId === cand.id)) continue;
  store.db.savedJobs.push({ id: `s${store.db.savedJobs.length + 1}`, candidateId: cand.id, jobId: j.id, savedAt: new Date().toISOString() });
}

store.saveNow();

// sync monotonic id counters so the API never mints duplicate ids
store.db.seq = { u: uSeq, c: cSeq, r: rSeq, j: jSeq, a: store.db.applications.length, s: store.db.savedJobs.length, co: companyIds.length };
store.saveNow();

// real scores for applications via the matching engine
import('./score-apps').then(async (m) => {
  await m.scoreExistingApplications(store);
  store.saveNow();
  console.log('Seeded:', {
    users: store.db.users.length, candidates: store.db.candidates.length,
    companies: store.db.companies.length, skills: store.db.skills.length,
    recruiters: store.db.recruiters.length, jobs: store.db.jobs.length,
    applications: store.db.applications.length, savedJobs: store.db.savedJobs.length,
  });

  // Optional Supabase push: when configured, mirror the same seed data up.
  const supabase = new SupabaseService(store);
  if (supabase.enabled) {
    const pushed = await supabase.pushAll();
    console.log(pushed.ok ? 'Supabase: seed data pushed ✔' : `Supabase push failed: ${pushed.error}`);
  }

  console.log('Demo logins (password123):');
  console.log('  candidate: karthik@example.com | aarav@example.com');
  console.log('  recruiter: hr@nimbussoft.com   | talent@vertexanalytics.com');
}).catch((err) => { console.error('Post-seed scoring failed:', err); process.exit(1); });
