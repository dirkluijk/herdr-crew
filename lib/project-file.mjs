import { realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

// Real path of a file inside the project. realpath keeps symlinks from pointing outside the project.
export function projectFile(project, file) {
  const path = realpathSync(resolve(project, String(file)));
  if (!path.startsWith(realpathSync(project) + sep) || !statSync(path).isFile()) throw new Error("outside the project or not a file");
  return path;
}
