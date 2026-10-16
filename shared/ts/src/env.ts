import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Not `new URL("../../../", import.meta.url)`: bundlers like Turbopack read that
// pattern as an asset import and try to resolve the folder as a module.
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(HERE, "../../..") + path.sep;

const envPath = `${ROOT_DIR}.env`;
if (existsSync(envPath)) process.loadEnvFile(envPath);
