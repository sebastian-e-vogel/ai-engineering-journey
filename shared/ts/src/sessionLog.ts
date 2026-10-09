import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path relative to the calling file: fromHere(import.meta.url, "sessions"). */
export function fromHere(metaUrl: string, relative: string): string {
  return fileURLToPath(new URL(relative, metaUrl));
}

/**
 * One JSON file per run. The name is built ONCE when this is called:
 *  - same run → every save() overwrites the same file
 *  - new run  → new name, previous sessions stay untouched
 */
export function createSessionLog({ dir, label }: { dir: string; label: string }) {
  fs.mkdirSync(dir, { recursive: true });
  const startedAt = new Date().toISOString(); // "2026-10-09T20:24:05.123Z"
  const safeDate = startedAt.replace(/[:.]/g, "-"); // ":" is not allowed in file names on Windows
  const file = path.join(dir, `${safeDate}_${label}.json`);

  return {
    file,
    startedAt,
    save(data: unknown) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    },
  };
}
