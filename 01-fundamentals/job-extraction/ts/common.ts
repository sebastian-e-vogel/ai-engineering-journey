import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  MODEL,
  ROOT_DIR,
  costOf,
  getEnvNumber,
  usd,
  type TokenUsage,
} from "@journey/shared";

const POSTS_DIR = path.join(ROOT_DIR, "data/job-posts");
const MAX_ATTEMPTS = 2; // first try + one retry

export const JobExtraction = z.object({
  seniority: z.enum(["junior", "mid", "senior", "staff", "unknown"]),
  remote: z.boolean().nullable(),
  stack: z.array(z.string()),
  required_skills: z.array(z.string()),
});

export type JobExtraction = z.infer<typeof JobExtraction>;

export const INSTRUCTIONS = `Extract structured data from the job post.
- seniority: "check the title for seniority first", "junior" (0-2 yrs), "mid" (3-5), "senior" (5+), "staff" (staff/principal), "unknown".
- remote: true only if remote work is stated, false if on-site/hybrid is stated, null if not mentioned.
- stack: concrete technologies mentioned anywhere (languages, frameworks, platforms, tools).
- required_skills: only from the required qualifications section, not the preferred ones.
Do not infer: if something is not in the text, use null or "unknown".`;

type IndexEntry = {
  title: string;
  company: string;
  source: string;
  file: string;
};

export type UserMessage = { role: "user"; content: string };

/** One attempt with a specific library: returns the data or throws. */
export type ExtractOnce = (
  messages: UserMessage[],
) => Promise<{ data: JobExtraction; usage: TokenUsage }>;

/** A failed attempt that still used tokens, so its cost is counted. */
export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly usage: TokenUsage,
  ) {
    super(message);
  }
}

type ExtractionResult = {
  file: string;
  source: string;
  extracted: JobExtraction | null;
  attempts: number;
  error: string | null;
  costUsd: string | null;
};

/** Bad API key, no permission or no credit: retrying won't help. */
function isFatal(err: unknown): boolean {
  const e = err as {
    status?: number;
    statusCode?: number;
    code?: string;
    responseBody?: string;
  };
  const status = e.status ?? e.statusCode; // OpenAI SDK: status · AI SDK: statusCode
  return (
    status === 401 ||
    status === 403 ||
    e.code === "insufficient_quota" ||
    /insufficient_quota/.test(e.responseBody ?? "")
  );
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/\s+/g, " ").slice(0, 400);
}

function addUsage(total: TokenUsage, usage: TokenUsage) {
  total.inputTokens += usage.inputTokens;
  total.outputTokens += usage.outputTokens;
  total.reasoningTokens += usage.reasoningTokens;
}

export async function runExtraction(outName: string, extractOnce: ExtractOnce) {
  const outFile = path.join(ROOT_DIR, "data/extractions", `${outName}.json`);
  const index: IndexEntry[] = JSON.parse(
    fs.readFileSync(path.join(POSTS_DIR, "index.json"), "utf8"),
  );
  // LIMIT=5 pnpm extract → only the first 5 posts (cheaper while testing)
  const limit = getEnvNumber("LIMIT");
  const posts = limit ? index.slice(0, limit) : index;
  const results: ExtractionResult[] = [];
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  for (const [i, jobPost] of posts.entries()) {
    console.log(`${i + 1}/${posts.length} ${jobPost.file}`);
    const text = fs.readFileSync(path.join(POSTS_DIR, jobPost.file), "utf8");

    let extracted: JobExtraction | null = null;
    let lastError: string | null = null;
    let attempts = 0;
    const tokens: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    };

    while (!extracted && attempts < MAX_ATTEMPTS) {
      attempts++;

      const messages: UserMessage[] = [{ role: "user", content: text }];
      if (lastError) {
        messages.push({
          role: "user",
          content: `Your previous answer was rejected: ${lastError}\nAnswer again, following the schema exactly.`,
        });
      }

      try {
        const result = await extractOnce(messages);
        addUsage(tokens, result.usage);
        extracted = result.data;
      } catch (err) {
        if (isFatal(err)) {
          console.error(
            `\nStopped: ${errorMessage(err)}. Check your OPENAI_API_KEY and your credit.`,
          );
          process.exit(1);
        }
        if (err instanceof ExtractionError) addUsage(tokens, err.usage);
        lastError = errorMessage(err);
        console.warn(`   ⚠ attempt ${attempts} failed: ${lastError}`);
      }
    }

    results.push({
      file: jobPost.file,
      source: jobPost.source,
      extracted,
      attempts,
      error: extracted ? null : lastError,
      costUsd: usd(costOf(MODEL, tokens)),
    });

    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  }

  const failed = results.filter((r) => r.error);
  const retried = results.filter((r) => r.attempts > 1 && !r.error);
  console.log(
    `\nDone: ${results.length - failed.length}/${results.length} ok · ${retried.length} needed a retry · ${failed.length} failed`,
  );
  for (const r of failed) console.log(`   ✗ ${r.file}: ${r.error}`);
  console.log(`Saved to data/extractions/${outName}.json`);
}
