// Helpers for the database rules tests.
//
// Two different clients are used on purpose:
//
//   * seeding and rule swapping go over the emulator's REST interface with the
//     `owner` bearer token, which bypasses rules entirely;
//   * the assertions go through the real Firebase JS SDK, because that is what
//     the application uses. This matters: the SDK does not send `equalTo` on
//     the wire, it sends a range whose bounds are equal, and a REST-only test
//     would pass while the real app breaks.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp, deleteApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const RULES_FILE = fileURLToPath(new URL('../../database.rules.json', import.meta.url));

export const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
export const NS = process.env.GCLOUD_PROJECT || 'demo-shishi';

const [HOSTNAME, PORT] = HOST.split(':');
const REST = `http://${HOST}`;

let appCounter = 0;

/**
 * A database handle that the rules see as the given user.
 * Pass no uid for a visitor who is not signed in at all.
 */
export function clientAs(uid) {
  const app = initializeApp({ databaseURL: `https://${NS}.firebaseio.com` }, `t${appCounter++}`);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, HOSTNAME, Number(PORT), {
    mockUserToken: uid ? { sub: uid, user_id: uid } : undefined,
  });
  return { db, close: () => deleteApp(app) };
}

function restUrl(path) {
  const u = new URL(`${REST}/${path}.json`);
  u.searchParams.set('ns', NS);
  return u;
}

/** Writes straight past the rules, for building up test fixtures. */
export async function seed(path, value) {
  const res = await fetch(restUrl(path), {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`seed ${path} failed: ${res.status} ${await res.text()}`);
}

/** Strips whole-line // comments so the rules file can be parsed as JSON. */
export function loadRules() {
  const text = readFileSync(RULES_FILE, 'utf8');
  const stripped = text
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return JSON.parse(stripped);
}

export async function applyRules(rules) {
  const u = new URL(`${REST}/.settings/rules.json`);
  u.searchParams.set('ns', NS);
  const res = await fetch(u, {
    method: 'PUT',
    headers: { Authorization: 'Bearer owner' },
    body: JSON.stringify(rules),
  });
  if (!res.ok) throw new Error(`applying rules failed: ${res.status} ${await res.text()}`);
}

/** Resolves to true when the operation was refused by the rules. */
export async function denied(promise) {
  try {
    await promise;
    return false;
  } catch (err) {
    if (String(err?.code || err?.message).toLowerCase().includes('permission')) return true;
    throw err;
  }
}
