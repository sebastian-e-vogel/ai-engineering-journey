import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = fileURLToPath(new URL("../../../", import.meta.url));

const envPath = `${ROOT_DIR}.env`;
if (existsSync(envPath)) process.loadEnvFile(envPath);
