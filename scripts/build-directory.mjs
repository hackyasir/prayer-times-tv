#!/usr/bin/env node
// ── build-directory — publish the list of masjids people can follow ──────────
//
// Run by .github/workflows/deploy.yml after `npm run build` (and every
// 6 hours): writes dist/masjids.json from public/masjids.json plus the
// self-serve masjids approved in the shared registration sheet, each under
// the name and city in its newest signed settings (only rows signed with
// the key you approved count). Masjids you list with their own sheet get
// the name and city saved in that sheet. See docs/remote-settings.md.
//
//   node scripts/build-directory.mjs [--registry public/masjids.json] [--out dist/masjids.json]
//
// Environment:
//   REGISTRATIONS_SHEET_ID  the registration form's responses sheet (shared
//                           "Anyone with the link: Viewer"); without it only
//                           public/masjids.json is listed
//   SETTINGS_SOURCE         sheets are read only when this is "sheet"
//
// It never fails the deploy: anything it can't read is logged and left out
// (or keeps its current name), and the registry is still written.

import fs from 'node:fs';
import path from 'node:path';
import {
  parseCsv,
  sheetCsvUrl,
  sheetIdFrom,
  sheetQueryUrl,
  sheetReplyKind,
} from '../src/lib/sheetFormat.js';
import {
  allRowsQuery,
  buildDirectory,
  mosqueInfoFromRows,
  sharedMasjids,
  sheetColumns,
} from '../src/lib/registrations.js';
import { verifyUpdate } from '../src/lib/signatures.js';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const registryPath = arg('--registry', 'public/masjids.json');
const outPath = arg('--out', 'dist/masjids.json');
const readSheets = (process.env.SETTINGS_SOURCE || '').toLowerCase() === 'sheet';
// The ID, or a whole link to the sheet.
const registrationsId = readSheets ? sheetIdFrom(process.env.REGISTRATIONS_SHEET_ID) : '';

const warn = (msg) => console.warn(`::warning::${msg}`);

async function fetchRows(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const kind = sheetReplyKind(text);
  if (kind === 'signIn') throw new Error('not shared "Anyone with the link: Viewer"');
  if (kind === 'queryError') throw new Error("its columns aren't the ones the guide lists");
  return parseCsv(text);
}

/** Approved self-serve masjids from the shared registration sheet. */
async function readShared() {
  const header = await fetchRows(sheetQueryUrl(registrationsId, 'select * limit 0'));
  const cols = sheetColumns(header[0]);
  if (!cols.ready) {
    throw new Error('it needs the columns Timestamp, Masjid code, Settings and Publish key');
  }
  if (!cols.approved) warn('The registration sheet has no "Approved" column yet.');
  return sharedMasjids(
    await fetchRows(sheetQueryUrl(registrationsId, allRowsQuery(cols))),
    verifyUpdate
  );
}

async function main() {
  let registry = {};
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (err) {
    warn(`Couldn't read ${registryPath} (${err.message}); starting from an empty list.`);
  }

  let shared = [];
  if (registrationsId) {
    try {
      shared = await readShared();
    } catch (err) {
      warn(`Couldn't read the registration sheet (${err.message}); listing only ${registryPath}.`);
    }
  }

  // Masjids listed with their own sheet: the name and city saved in it.
  const sheetIds = new Set();
  if (readSheets) {
    for (const [code, entry] of Object.entries(registry)) {
      if (!code.startsWith('_') && entry?.sheetId) sheetIds.add(entry.sheetId);
    }
  }
  const infoBySheet = new Map();
  const queue = [...sheetIds];
  await Promise.all(
    Array.from({ length: Math.min(5, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          infoBySheet.set(id, mosqueInfoFromRows(await fetchRows(sheetCsvUrl(id))));
        } catch (err) {
          warn(`Masjid sheet ${id}: ${err.message}`);
        }
      }
    })
  );

  const { registry: out, added, skipped } = buildDirectory(registry, shared, infoBySheet);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  for (const s of skipped) warn(`Not added: ${s}`);
  const listed = Object.keys(out).filter((k) => !k.startsWith('_')).length;
  console.log(
    `masjids.json: ${listed} masjid(s) — ${added.length} self-serve` +
      (added.length ? ` (${added.join(', ')})` : '') +
      `; ${infoBySheet.size} name(s) read from masjids' own sheets → ${outPath}`
  );
}

main().catch((err) => {
  // Never fail the deploy over the list.
  warn(`Masjid list not rebuilt: ${err.message}`);
});
