#!/usr/bin/env node
// Entry point for agents: node <skill base directory>/crew.mjs <command>. OpenCode prints the symlink path as the
// skill base directory, so <base>/../../server.mjs does not resolve. Node does resolve the symlink for the main
// module, so this relative import reaches the checkout. Needs the skill installed as a symlink to this directory
// (a copy has no server.mjs two levels up) and breaks under --preserve-symlinks-main.
await import(new URL("../../server.mjs", import.meta.url));
