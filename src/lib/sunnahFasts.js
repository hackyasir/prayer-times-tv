// ── sunnahFasts.js — single source of truth for recommended-fast logic ───────
//
// Shared by the on-screen auto-announcements (App.jsx) and the printable
// monthly calendar (PrintableSchedule.jsx) so the two NEVER drift apart.
//
// Fiqh basis (references as numbered on sunnah.com):
//   - Monday & Thursday: Sahih Muslim 1162b (Monday, the day he ﷺ was born);
//     Jami' at-Tirmidhi 747 (deeds are presented on Monday and Thursday).
//   - White Days (al-ayyam al-beed), 13/14/15 of each Hijri month: Sunan
//     an-Nasa'i 2420, Jami' at-Tirmidhi 761.
//   - Arafah (9 Dhul-Hijjah): hoped to expiate two years — Sahih Muslim 1162a.
//   - Ashura (10 Muharram): hoped to expiate the past year — Sahih Muslim
//     1162a; Tasu'a (9 Muharram) fasted with it — Sahih Muslim 1134b. (The
//     11th is weakly based, so it is not suggested.)
//   - Six of Shawwal: any six days after Eid, not necessarily in a row —
//     Sahih Muslim 1164a.
//   - Overlaps combine into ONE fast with a combined intention (tashreek) —
//     they are not separate fasts, so callers should present them as one.
//
// SAFETY — no voluntary fast is ever suggested on:
//   - Eid al-Fitr (1 Shawwal), Eid al-Adha (10 Dhul-Hijjah) and the days of
//     Tashreeq (11–13 Dhul-Hijjah): fasting is prohibited (Sahih al-Bukhari
//     1990, Sahih Muslim 1137, Sahih Muslim 1141a).
//   - Ramadan: the fast is obligatory, so Monday / Thursday / White Day
//     prompts would be wrong.
//   - 29–30 Sha'ban: "do not precede Ramadan by a day or two" (Sahih
//     al-Bukhari 1914, Sahih Muslim 1082a) and the "day of doubt" (Sunan Abi
//     Dawud 2334). Calculated dates can be a day out, so both days are skipped.
// On those days fastReasonsFor returns [].
//
// `hp` is a Hijri-parts object { m, d } already adjusted for the user's
// hijriOffset by the caller. `weekday` is JS getDay(): 0=Sun .. 6=Sat.

// Reward/significance ranking. Lower index = higher reward = leads the line.
export const FAST_RANK = ['arafah', 'ashura', 'tasua', 'shawwal', 'white', 'monday', 'thursday'];

/** Ramadan, or the last two days of Sha'ban before it. */
export function isRamadanOrEve(hp) {
  if (!hp) return false;
  return hp.m === 9 || (hp.m === 8 && hp.d >= 29);
}

export function isForbiddenFastDay(hp) {
  if (!hp) return false;
  if (hp.m === 10 && hp.d === 1) return true; // Eid al-Fitr
  if (hp.m === 12 && hp.d >= 10 && hp.d <= 13) return true; // Eid al-Adha + Tashreeq
  return false;
}

/**
 * Ranked list of recommended-fast reasons for a day.
 * Returns [] if the day is forbidden or has no recommended fast.
 * Each reason: { key, urgent, day? }.
 */
export function fastReasonsFor(hp, weekday) {
  if (!hp || isForbiddenFastDay(hp) || isRamadanOrEve(hp)) return [];
  const reasons = [];
  // Specific annual days (highest reward) — mutually exclusive by date.
  if (hp.m === 12 && hp.d === 9) reasons.push({ key: 'arafah', urgent: true });
  else if (hp.m === 1 && hp.d === 10) reasons.push({ key: 'ashura', urgent: true });
  else if (hp.m === 1 && hp.d === 9) reasons.push({ key: 'tasua', urgent: false });
  // Six of Shawwal — any day of the month after Eid (2–30).
  if (hp.m === 10 && hp.d >= 2) reasons.push({ key: 'shawwal', urgent: false });
  // White days — 13/14/15 of any month.
  if (hp.d >= 13 && hp.d <= 15) reasons.push({ key: 'white', urgent: false, day: hp.d });
  // Weekly Monday / Thursday.
  if (weekday === 1) reasons.push({ key: 'monday', urgent: false });
  else if (weekday === 4) reasons.push({ key: 'thursday', urgent: false });
  return reasons;
}

/**
 * Compose a single announcement line: lead reason + "also …" qualifiers.
 * Presentation-only; kept here so screen + (future) callers phrase overlaps
 * identically. Takes a `tag(reason) -> string` fn and a `t(key, vars?)`-style
 * translator so this stays i18n-agnostic.
 *
 * @param {Array} reasons   from fastReasonsFor
 * @param {'today'|'tomorrow'} when
 * @param {(reason:object)=>string} tagFn
 * @param {{ lead:(name)=>string, also:(list)=>string, sep:string }} phrases
 * @returns {string|null}  e.g. "! Sunnah fast today (Day of Arafah) — also Monday"
 */
export function buildFastLine(reasons, when, tagFn, phrases) {
  if (!reasons || reasons.length === 0) return null;
  const [lead, ...rest] = reasons;
  let line = phrases.lead(when, tagFn(lead));
  if (rest.length > 0) {
    const list = rest.map(tagFn).join(phrases.sep);
    line += ' ' + phrases.also(list);
  }
  return lead.urgent ? `! ${line}` : line;
}
