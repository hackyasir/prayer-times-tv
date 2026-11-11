// The part of docs/registration-sheet.gs built from the app's own code
// (scripts/build-sheet-script.mjs bundles it for Google Apps Script): the
// same rules and signature checks the screens use.

import { tidyPlan } from '../../src/lib/registrations.js';
import { verifyUpdate } from '../../src/lib/signatures.js';

/** The sheet's values (header first) → what to change. */
export function plan(values) {
  return tidyPlan(values, verifyUpdate);
}
