#!/usr/bin/env node
// Local development Postgres, no Docker or system install required.
//
// Uses the real PostgreSQL server binaries shipped by the `embedded-postgres`
// npm package, driven directly with initdb/pg_ctl so the server keeps running
// between commands. Usage: node scripts/dev-db.mjs start|stop|status|reset
//
// Postgres refuses to run as root. When this script runs as root (as in some
// sandboxes/CI containers) it copies the binaries to a world-readable dir and
// runs the server as the unprivileged `postgres` OS user (created if missing).

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.DEV_DB_PORT ?? 5441);
const USER = 'postgres';
const PASSWORD = process.env.DEV_DB_PASSWORD ?? 'postgres';
const DB_NAME = process.env.DEV_DB_NAME ?? 'vyralink';
const isRoot = process.getuid?.() === 0;

const platformDir = path.join(repoRoot, 'node_modules', '@embedded-postgres', `${os.platform() === 'win32' ? 'windows' : os.platform()}-${os.arch()}`, 'native');
const binDir = isRoot ? '/opt/vyralink-pg/bin' : path.join(platformDir, 'bin');
const baseDir = process.env.DEV_DB_DIR ?? (isRoot ? '/var/lib/vyralink-dev-db' : path.join(repoRoot, '.dev-db'));
const dataDir = path.join(baseDir, 'data');
const logFile = path.join(baseDir, 'postgres.log');

export const DEV_DATABASE_URL = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}`;

function ensureBinaries() {
  if (!fs.existsSync(platformDir)) {
    throw new Error(`Postgres binaries not found at ${platformDir}. Run \`npm install\` first.`);
  }
  if (!isRoot) return;
  const installDir = path.dirname(binDir);
  if (!fs.existsSync(path.join(binDir, 'postgres'))) {
    fs.cpSync(platformDir, installDir, { recursive: true, verbatimSymlinks: true });
    execFileSync('chmod', ['-R', 'a+rX', installDir]);
  }
  if (spawnSync('id', ['postgres']).status !== 0) {
    execFileSync('useradd', ['--system', '--no-create-home', 'postgres']);
  }
}

function run(bin, args, opts = {}) {
  const full = path.join(binDir, bin);
  const [cmd, cmdArgs] = isRoot ? ['runuser', ['-u', 'postgres', '--', full, ...args]] : [full, args];
  return spawnSync(cmd, cmdArgs, { encoding: 'utf8', ...opts });
}

function isRunning() {
  return fs.existsSync(dataDir) && run('pg_ctl', ['-D', dataDir, 'status']).status === 0;
}

function init() {
  fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  if (isRoot) execFileSync('chown', ['postgres', baseDir]);
  const pwFile = path.join(baseDir, '.pwfile');
  fs.writeFileSync(pwFile, PASSWORD, { mode: 0o600 });
  if (isRoot) execFileSync('chown', ['postgres', pwFile]);
  const res = run('initdb', ['-D', dataDir, '-U', USER, '--auth=scram-sha-256', `--pwfile=${pwFile}`, '-E', 'UTF8', '--locale=C']);
  fs.rmSync(pwFile);
  if (res.status !== 0) throw new Error(`initdb failed:\n${res.stdout}\n${res.stderr}`);
}

async function ensureDatabase() {
  const admin = new pg.Client({ connectionString: DEV_DATABASE_URL.replace(`/${DB_NAME}`, '/postgres') });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  await admin.end();
}

async function start() {
  ensureBinaries();
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) init();
  if (!isRunning()) {
    const opts = `-p ${PORT} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${os.platform() === 'win32' ? '' : "''"}`;
    // stdio ignored: on Windows the server inherits our pipes and spawnSync never returns
    const res = run('pg_ctl', ['-D', dataDir, '-o', opts, '-l', logFile, '-w', 'start'], { stdio: 'ignore' });
    if (res.status !== 0) throw new Error(`pg_ctl start failed. See ${logFile}`);
  }
  await ensureDatabase();
  console.log(`Postgres running on 127.0.0.1:${PORT}\nDATABASE_URL=${DEV_DATABASE_URL}`);
}

function stop() {
  if (!isRunning()) return console.log('Postgres is not running');
  run('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
  console.log('Postgres stopped');
}

const cmd = process.argv[2] ?? 'status';
try {
  if (cmd === 'start') await start();
  else if (cmd === 'stop') stop();
  else if (cmd === 'status') console.log(isRunning() ? `running on 127.0.0.1:${PORT} (data: ${dataDir})` : 'not running');
  else if (cmd === 'reset') {
    stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    await start();
  } else {
    console.error('usage: dev-db.mjs start|stop|status|reset');
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
