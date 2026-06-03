// ── sunnahFasts.js — single source of truth for recommended-fast logic ───────
//
// Shared by the on-screen auto-announcements (App.jsx) and the printable
// monthly calendar (PrintableSchedule.jsx) so the two NEVER drift apart.
//
// Fiqh basis (authentic sources):
//   - Monday & Thursday: the Prophet ﷺ regularly fasted these (Muslim 1162).
//   - White Days (al-ayyam al-beed): 13/14/15 of every Hijri month.
//   - Arafah (9 Dhul-Hijjah): expiates two years — highest reward here.
//   - Ashura (10 Muharram) + Tasu'a (9 Muharram).
//   - Six of Shawwal: any six days of Shawwal (day 2+; Eid day excluded).
//   - Overlaps combine into ONE fast with a combined intention (tashreek) —
//     they are not separate fasts, so callers should present them as one.
//
// SAFETY: fasting is PROHIBITED on Eid al-Fitr (1 Shawwal), Eid al-Adha
// (10 Dhul-Hijjah) and the days of Tashreeq (11–13 Dhul-Hijjah). On those days
// fastReasonsFor returns [] — no fast is ever suggested.
//
// `hp` is a Hijri-parts object { m, d } already adjusted for the user's
// hijriOffset by the caller. `weekday` is JS getDay(): 0=Sun .. 6=Sat.

// Reward/significance ranking. Lower index = higher reward = leads the line.
export const FAST_RANK = ['arafah', 'ashura', 'tasua', 'shawwal', 'white', 'monday', 'thursday'];

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
  if (!hp || isForbiddenFastDay(hp)) return [];
  const reasons = [];
  // Specific annual days (highest reward) — mutually exclusive by date.
  if (hp.m === 12 && hp.d === 9) reasons.push({ key: 'arafah', urgent: true });
  else if (hp.m === 1 && hp.d === 10) reasons.push({ key: 'ashura', urgent: true });
  else if (hp.m === 1 && hp.d === 9) reasons.push({ key: 'tasua', urgent: false });
  // Six of Shawwal — flexible across the month (days 2–29; Eid day excluded).
  if (hp.m === 10 && hp.d >= 2 && hp.d <= 29) reasons.push({ key: 'shawwal', urgent: false });
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
