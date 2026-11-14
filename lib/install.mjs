// Links the skills and commands of this checkout into the OpenCode config dir. Never replaces a real file or
// directory without --force, and uninstall only removes links that point into this checkout.
import { lstat, readlink, readdir, symlink, unlink, mkdir, rename } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve, dirname, relative, sep } from "node:path";
import { homedir } from "node:os";

export const BACKUP_DIR = "herdr-crew-backup";
const KINDS = { skill: "skills", command: "commands" };

export function opencodeConfigDir(env = process.env, home = homedir()) {
  if (env.OPENCODE_CONFIG_DIR) return resolve(env.OPENCODE_CONFIG_DIR);
  return join(env.XDG_CONFIG_HOME ? resolve(env.XDG_CONFIG_HOME) : join(home, ".config"), "opencode");
}

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
const inside = (p, dir) => p === dir || p.startsWith(dir + sep);

export async function sources(app) {
  const list = (d) => (existsSync(d) ? readdir(d, { withFileTypes: true }) : []);
  const skills = (await list(join(app, "skills")))
    .filter((e) => e.isDirectory() && existsSync(join(app, "skills", e.name, "SKILL.md")))
    .map((e) => ({ kind: "skill", name: e.name, source: join(app, "skills", e.name) }));
  const commands = (await list(join(app, "commands")))
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => ({ kind: "command", name: e.name, source: join(app, "commands", e.name) }));
  return [...skills, ...commands].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

// state: "create" (nothing there), "ok" (links here already), "link" (a link to somewhere else) or "file" (a real
// file or directory).
export async function installPlan({ app, dir }) {
  return Promise.all((await sources(app)).map(async (s) => {
    const rel = join(KINDS[s.kind], s.name);
    const target = join(dir, rel);
    let st = null;
    try { st = await lstat(target); } catch {}
    if (!st) return { ...s, rel, target, state: "create" };
    if (!st.isSymbolicLink()) return { ...s, rel, target, state: "file", isDir: st.isDirectory() };
    const to = resolve(dirname(target), await readlink(target));
    return { ...s, rel, target, to, state: real(to) === real(s.source) ? "ok" : "link" };
  }));
}

export async function applyInstall(plan, { dir, force = false, now = new Date() }) {
  const conflicts = plan.filter((p) => p.state === "file" || p.state === "link");
  if (conflicts.length && !force) throw new Error(`not replaced without --force: ${conflicts.map((p) => p.rel).join(", ")}`);
  const backup = join(dir, BACKUP_DIR, now.toISOString().replace(/[:.]/g, "-"));
  const done = { created: [], backedUp: [], backup: null };
  for (const p of plan) {
    if (p.state === "ok") continue;
    if (p.state === "file" || p.state === "link") {
      const to = join(backup, p.rel);
      await mkdir(dirname(to), { recursive: true });
      await rename(p.target, to);
      done.backedUp.push(p.rel);
      done.backup = backup;
    }
    await mkdir(dirname(p.target), { recursive: true });
    await symlink(p.source, p.target);
    done.created.push(p.rel);
  }
  return done;
}

// Every link in skills/ and commands/ that points into this checkout, also broken ones.
export async function uninstallPlan({ app, dir }) {
  const roots = [resolve(app), real(app)];
  const out = [];
  for (const sub of Object.values(KINDS)) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    for (const e of await readdir(d, { withFileTypes: true })) {
      if (!e.isSymbolicLink()) continue;
      const target = join(d, e.name);
      const to = resolve(d, await readlink(target));
      if (roots.some((r) => inside(to, r) || inside(real(to), r))) out.push({ rel: join(sub, e.name), target, to });
    }
  }
  return out;
}

const LABEL = { create: "create", ok: "ok", link: "other link", file: "exists" };

export function describePlan(plan, { force = false } = {}) {
  return plan.map((p) => {
    const head = `  ${LABEL[p.state].padEnd(10)} ${p.rel}`;
    if (p.state === "create") return `${head} -> ${p.source}`;
    if (p.state === "ok") return `${head} (already linked)`;
    const what = p.state === "link" ? `is a link to ${p.to}` : `is a real ${p.isDir ? "directory" : "file"}`;
    return `${head} ${what}; ${force ? `moved to ${BACKUP_DIR}/ and replaced by a link to ${p.source}` : "not replaced"}`;
  }).join("\n");
}

// The CLI flow for install and uninstall. ask(question) returns true for yes; it is only called without --yes.
export async function runInstall({ app, dir, uninstall = false, yes = false, force = false, dryRun = false, ask, log = console.log, error = console.error }) {
  if (uninstall) {
    const links = await uninstallPlan({ app, dir });
    if (!links.length) return log(`No links into ${app} in ${dir}. Nothing to remove.`), 0;
    log(`herdr-crew uninstall removes these links from ${dir}:\n${links.map((l) => `  remove     ${l.rel} -> ${l.to}`).join("\n")}`);
    if (dryRun) return 0;
    if (!yes && !(await ask("Remove these links? [y/N] "))) return log("Nothing removed."), 1;
    for (const l of links) await unlink(l.target);
    log(`Removed ${links.length} link${links.length === 1 ? "" : "s"}. OpenCode drops them on its own; run /reload in a session that still lists them.`);
    return 0;
  }

  const plan = await installPlan({ app, dir });
  log(`herdr-crew install links this checkout into the OpenCode config dir ${dir}:\n${describePlan(plan, { force })}`);
  const conflicts = plan.filter((p) => p.state === "file" || p.state === "link");
  if (conflicts.length && !force) {
    error(`\nNothing changed: ${conflicts.length} path${conflicts.length === 1 ? " is" : "s are"} taken. Remove ${conflicts.length === 1 ? "it" : "them"} yourself, or run again with --force to move ${conflicts.length === 1 ? "it" : "them"} to ${join(dir, BACKUP_DIR)}/.`);
    return 1;
  }
  if (plan.every((p) => p.state === "ok")) return log("Everything is linked already. Nothing to do."), 0;
  if (dryRun) return 0;
  if (!yes && !(await ask("Create these links? [y/N] "))) return log("Nothing changed."), 1;
  const r = await applyInstall(plan, { dir, force });
  if (r.backup) log(`Moved ${r.backedUp.join(", ")} to ${r.backup}.`);
  log(`Linked ${r.created.length} path${r.created.length === 1 ? "" : "s"}. OpenCode picks them up on its own (or run /reload in an open session). Check the setup with: node ${join(app, "server.mjs")} doctor`);
  return 0;
}
