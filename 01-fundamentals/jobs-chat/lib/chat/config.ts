import { INSTRUCTIONS } from "@journey/job-tools";

export const CHAT_INSTRUCTIONS = `${INSTRUCTIONS}
- Answer in the language of the question, in plain text (no Markdown).`;

export const CHAT_TOOL_NAMES = [
  "search_jobs",
  "get_job_details",
  "count_technologies",
];
