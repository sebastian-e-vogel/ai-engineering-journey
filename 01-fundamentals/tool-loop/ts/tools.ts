import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR, getEnvNumber } from "@journey/shared";

export const MAX_STEPS = getEnvNumber("MAX_STEPS") ?? 5;

export const INSTRUCTIONS = `You answer questions about a fixed set of AI engineering job posts. You only know what the tools return.
- Use only data returned by the tools: never invent jobs, ids, fields or numbers.
- Cite the id of every job you mention, e.g. "Applied AI Engineer (id 08)".
- If a search returns no results, say so.
- If the data doesn't cover what is asked (e.g. salary), say you don't know.
- If the question is not about these job posts, say so without calling any tool.`;

export function readQuestion(command: string): string {
  const question = process.argv[2]?.trim();
  if (!question) {
    console.error(`Usage: ${command} "<question>"`);
    process.exit(1);
  }
  return question;
}

const POSTS_DIR = path.join(ROOT_DIR, "data/job-posts");
const EXTRACTIONS_FILE = path.join(ROOT_DIR, "data/extractions/openai-ts.json");
const MAX_RESULTS = 10;
const TEXT_CHARS = 1500;
const SENIORITIES = ["junior", "mid", "senior", "staff", "unknown"];

const ALIASES: Record<string, string> = {
  huggingface: "hugging face",
  "claude api": "claude",
  "claude platform": "claude",
  "claude developer platform": "claude",
  node: "node.js",
  nodejs: "node.js",
  postgres: "postgresql",
  k8s: "kubernetes",
  golang: "go",
  gcp: "google cloud",
  "google cloud platform": "google cloud",
};

type Extraction = {
  seniority: string;
  remote: boolean | null;
  stack: string[];
  required_skills: string[];
};

type Job = Extraction & {
  id: string;
  file: string;
  title: string;
  company: string;
  location: string;
  url: string;
};

type IndexEntry = {
  title: string;
  company: string;
  location: string;
  url: string;
  file: string;
};

const index: IndexEntry[] = JSON.parse(
  fs.readFileSync(path.join(POSTS_DIR, "index.json"), "utf8"),
);
const extractions: { file: string; extracted: Extraction | null }[] =
  JSON.parse(fs.readFileSync(EXTRACTIONS_FILE, "utf8"));

const JOBS: Job[] = index.flatMap((post) => {
  const extracted = extractions.find((e) => e.file === post.file)?.extracted;
  if (!extracted) return [];
  return [
    {
      id: post.file.split("-")[0],
      file: post.file,
      title: post.title.trim(),
      company: post.company,
      location: post.location,
      url: post.url,
      ...extracted,
    },
  ];
});

function normalize(tech: string): string {
  const key = tech.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

const techsOf = (job: Job) => new Set(job.stack.map(normalize));

const findJob = (id: string) =>
  JOBS.find((job) => job.id === id.trim().padStart(2, "0"));

const summary = (job: Job) => ({
  id: job.id,
  title: job.title,
  company: job.company,
  seniority: job.seniority,
  remote: job.remote,
  location: job.location,
});

type SearchJobsArgs = {
  seniority: string | null;
  remote: boolean | null;
  technologies: string[] | null;
  company: string | null;
};

function searchJobs({
  seniority,
  remote,
  technologies,
  company,
}: SearchJobsArgs) {
  const matches = JOBS.filter(
    (job) =>
      (seniority === null || job.seniority === seniority) &&
      (remote === null || job.remote === remote) &&
      (company === null ||
        job.company.toLowerCase().includes(company.toLowerCase())) &&
      (technologies ?? []).every((tech) => techsOf(job).has(normalize(tech))),
  );
  return {
    total: matches.length,
    jobs: matches.slice(0, MAX_RESULTS).map(summary),
  };
}

function getJobDetails({ id }: { id: string }) {
  const job = findJob(id);
  if (!job) return { error: `job ${id} not found` };

  const raw = fs.readFileSync(path.join(POSTS_DIR, job.file), "utf8");
  const headerEnd = raw.indexOf("\n---\n");
  const body = (headerEnd === -1 ? raw : raw.slice(headerEnd + 5)).trim();
  const { file, ...details } = job;
  return { ...details, text: body.slice(0, TEXT_CHARS) };
}

function countTechnologies({
  seniority,
  top_n,
}: {
  seniority: string | null;
  top_n: number;
}) {
  const jobs = JOBS.filter(
    (job) => seniority === null || job.seniority === seniority,
  );
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const tech of techsOf(job))
      counts.set(tech, (counts.get(tech) ?? 0) + 1);
  }
  const technologies = [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(1, top_n));
  return { jobs: jobs.length, technologies };
}

function compareJobs({ ids }: { ids: string[] }) {
  if (ids.length < 2) return { error: "compare_jobs needs at least 2 ids" };
  const missing = ids.filter((id) => !findJob(id));
  if (missing.length) return { error: `job ${missing.join(", ")} not found` };

  const jobs = ids.map((id) => findJob(id)!);
  const shared = [...techsOf(jobs[0])].filter((tech) =>
    jobs.every((job) => techsOf(job).has(tech)),
  );
  return {
    jobs: jobs.map((job) => ({ ...summary(job), stack: job.stack })),
    shared_technologies: shared,
  };
}

const nullableSeniority = {
  anyOf: [{ type: "string", enum: SENIORITIES }, { type: "null" }],
  description:
    "junior, mid, senior, staff or unknown (not stated). null = any.",
};

export type JobTool = {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: any) => object;
  summarize: (output: any) => string;
};

export const TOOLS: Record<string, JobTool> = {
  search_jobs: {
    description:
      "Search the job posts. Every filter is optional: pass null to skip it. Returns the total number of matches and up to 10 jobs (id, title, company, seniority, remote, location).",
    parameters: {
      type: "object",
      properties: {
        seniority: nullableSeniority,
        remote: {
          type: ["boolean", "null"],
          description:
            "true = remote, false = on-site or hybrid. null = any, including posts that don't say.",
        },
        technologies: {
          type: ["array", "null"],
          items: { type: "string" },
          description:
            'The job must list all of them, e.g. ["python", "mcp"]. Case-insensitive. null = any.',
        },
        company: {
          type: ["string", "null"],
          description:
            "Company name or part of it, case-insensitive. null = any.",
        },
      },
      required: ["seniority", "remote", "technologies", "company"],
      additionalProperties: false,
    },
    execute: searchJobs,
    summarize: (output: ReturnType<typeof searchJobs>) =>
      `${output.total} results`,
  },

  get_job_details: {
    description:
      "Get everything about one job post: seniority, remote, stack, required skills, URL and the first 1,500 characters of the post.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: 'Job id, e.g. "08".' },
      },
      required: ["id"],
      additionalProperties: false,
    },
    execute: getJobDetails,
    summarize: (output: { id: string }) => `job ${output.id}`,
  },

  count_technologies: {
    description:
      "Count how many job posts mention each technology and return the most frequent ones.",
    parameters: {
      type: "object",
      properties: {
        seniority: nullableSeniority,
        top_n: {
          type: "integer",
          description: "How many technologies to return.",
        },
      },
      required: ["seniority", "top_n"],
      additionalProperties: false,
    },
    execute: countTechnologies,
    summarize: (output: ReturnType<typeof countTechnologies>) =>
      `${output.technologies.length} technologies`,
  },

  compare_jobs: {
    description:
      "Compare two or more job posts side by side: seniority, remote, location, stack and the technologies they share.",
    parameters: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: 'Job ids to compare, e.g. ["01", "08"].',
        },
      },
      required: ["ids"],
      additionalProperties: false,
    },
    execute: compareJobs,
    summarize: (output: { jobs: unknown[] }) => `${output.jobs.length} jobs`,
  },
};
