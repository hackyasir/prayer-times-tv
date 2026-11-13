// The part of docs/registration-sheet.gs built from the app's own code
// (scripts/build-sheet-script.mjs bundles it for Google Apps Script): the
// same rules and signature checks the screens use.

import { isApproved, sheetColumns, tidyPlan } from '../../src/lib/registrations.js';
import { normalizeCode } from '../../src/lib/sheetFormat.js';
import { verifyUpdate } from '../../src/lib/signatures.js';

/**
 * The sheet's values (header first) → what to change: for every masjid, or
 * with `code` just for that one (and empty rows). `budgetMs`: stop checking
 * signatures after this long and leave the rest for the next run.
 */
export function plan(values, code, { budgetMs } = {}) {
  return tidyPlan(values, verifyUpdate, {
    ...(code === undefined ? {} : { only: code }),
    ...(budgetMs ? { budgetMs } : {}),
  });
}

/** Each question's title → its answers (the form-submit trigger's e.namedValues). */
function answer(namedValues, key) {
  const titles = Object.keys(namedValues || {});
  const at = sheetColumns(titles).at[key];
  const value = at >= 0 ? namedValues[titles[at]] : null;
  return Array.isArray(value) ? value[0] : value;
}

/** The masjid code answered in a form response, or null. */
export function responseCode(namedValues) {
  return normalizeCode(answer(namedValues, 'code'));
}

/**
 * The 0-based row (in `values`, header first) holding a form response, found
 * by its Settings answer (it carries a signature, so it's unique), if that
 * row is ticked; otherwise -1. A response can't have been ticked by you
 * yet: one that is went into a row ticked by mistake, and approves nothing.
 * @returns {{ row: number, col: number }}
 */
export function tickedResponse(values, namedValues) {
  const settings = String(answer(namedValues, 'settings') ?? '');
  const cols = sheetColumns(values?.[0]);
  const col = cols.at.approved;
  if (!settings || col < 0 || cols.at.settings < 0) return { row: -1, col };
  for (let r = values.length - 1; r > 0; r--) {
    if (String(values[r][cols.at.settings] ?? '') === settings) {
      return { row: isApproved(values[r][col]) ? r : -1, col };
    }
  }
  return { row: -1, col };
}
