// Loads the project's data files. They are YAML rather than JSON so Jay can
// read and edit them by hand; nothing here runs in the browser, and every
// page that uses the data is rendered on the server or at build time.
//
// When the move to Postgres happens, this file and the YAML go away: only
// lib/data.ts changes, and no page has to.
import { readFileSync } from "fs";
import path from "path";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

export function loadYaml<T>(...parts: string[]): T {
  return yamlLoad(readFileSync(path.join(process.cwd(), "data", ...parts), "utf8")) as T;
}
