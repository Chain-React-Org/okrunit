// ---------------------------------------------------------------------------
// OKRunit CLI -- Configuration loading
// Priority: environment variables > config file > defaults
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_FILE_NAME = ".okrunitrc";
const DEFAULT_BASE_URL = "https://app.okrunit.com";

export interface CliConfig {
  apiKey: string;
  baseUrl: string;
}

interface ConfigFile {
  apiKey?: string;
  baseUrl?: string;
}

function getConfigPath(): string {
  return path.join(os.homedir(), CONFIG_FILE_NAME);
}

/**
 * Read the config file from ~/.okrunitrc. Returns an empty object if the
 * file does not exist or cannot be parsed.
 */
function readConfigFile(): ConfigFile {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as ConfigFile;
  } catch {
    return {};
  }
}

/**
 * Write a config object to ~/.okrunitrc.
 */
export function writeConfigFile(config: ConfigFile): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600, // owner read/write only
  });
}

/**
 * Load the effective configuration by merging sources in priority order:
 *   1. Environment variables (OKRUNIT_API_KEY, OKRUNIT_BASE_URL)
 *   2. Config file (~/.okrunitrc)
 *   3. Defaults
 */
export function loadConfig(): CliConfig {
  const file = readConfigFile();

  const apiKey = process.env.OKRUNIT_API_KEY ?? file.apiKey ?? "";
  const baseUrl =
    process.env.OKRUNIT_BASE_URL ?? file.baseUrl ?? DEFAULT_BASE_URL;

  return { apiKey, baseUrl };
}

/**
 * Load config and verify an API key is available. Exits with an error
 * message if no API key is configured.
 */
export function requireConfig(): CliConfig {
  const config = loadConfig();

  if (!config.apiKey) {
    console.error(
      "Error: No API key configured.\n\n" +
        "Set one with:\n" +
        "  okrunit config\n" +
        "  export OKRUNIT_API_KEY=ok_...\n",
    );
    process.exit(1);
  }

  return config;
}
