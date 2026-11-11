// ── lib/autoAnnouncements.js — the automatic ticker lines ─────────────────────
//
// Builds the lines the ticker shows when "automatic announcements" is on,
// phrased the way a mosque would post them. Pure: App.jsx gathers the
// inputs, tests call this directly.
//
// Principles:
//   - Times, not live countdowns. The big clock already counts down; a
//     ticker line that changes every minute makes a scrolling ticker jump
//     and restarts a rotating one. These lines change only at prayer
//     changes.
//   - Calculated Hijri dates can be a day out, so Ramadan and Eid are
//     "expected … subject to moon sighting", never stated as fact.
//   - Only well-established practices, with references for any virtue
//     quoted (see lib/sunnahFasts.js for the fasting rules).
//
// Line order: what's happening now, what's next, the season, then reminders.
// A leading "! " marks a line as urgent (the ticker highlights it).

import { fastReasonsFor, buildFastLine } from './sunnahFasts.js';

const URGENT_IQAMAH_MINUTES = 10;

/** "a", "a and b", "a, b and c" — with translated separators. */
export function joinList(items, t) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(t('auto.list.sep'))}${t('auto.list.and')}${items[items.length - 1]}`;
}

/**
 * @param {object} c
 * @param {(key: string) => string} c.t        translator
 * @param {(s: string, vars: object) => string} c.fmt  {placeholder} formatter
 * @param {(d: Date) => string} c.time         clock time in the city, e.g. "1:00 PM"
 * @param {Date}   c.now
 * @param {number} c.weekday                   city weekday, 0 = Sunday
 * @param {{m:number,d:number}} c.hijriToday   with the masjid's Hijri adjustment
 * @param {{m:number,d:number}} c.hijriTomorrow
 * @param {number|null} c.daysToRamadan        days until 1 Ramadan, if within reach
 * @param {object} c.times                     today's adhan Dates (fajr … isha)
 * @param {{key:string,time:Date}|null} c.next the next adhan (or sunrise)
 * @param {Array<{key:string,time:Date}>} c.congregations  today's, sorted
 * @param {{key:string,time:Date}|null} c.pendingIqamah    adhan given, iqamah to come
 * @param {boolean} c.blackoutActive
 * @param {boolean} c.isFriday                 (includes the Test Jumu'ah preview)
 * @param {Date[]}  c.jumuahTimes              enabled Jumu'ah slots, as times today
 * @param {{kind:'fitr'|'adha'|null, daysUntil:number|null, times:Date[], venue:string}} c.eid
 *   the Eid within the lead-up window, with its prayer times
 * @returns {string[]}
 */
export function buildAutoAnnouncements(c) {
  const { t, fmt, time, now } = c;
  const lines = [];
  const seen = new Set();
  const push = (line) => {
    const text = (line || '').trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      lines.push(text);
    }
  };
  const prayer = (key) => t(`prayer.${key}`);
  const timesText = (dates) => joinList(dates.map(time), t);
  const maghrib = c.times?.maghrib;
  const afterMaghrib = maghrib instanceof Date && now >= maghrib;

  // ── Now ──
  if (c.blackoutActive) push(`! ${t('auto.prayerInProgress')}`);
  if (c.pendingIqamah) {
    const mins = (c.pendingIqamah.time - now) / 60000;
    const line = fmt(t('auto.iqamah.pending'), {
      prayer: prayer(c.pendingIqamah.key),
      time: time(c.pendingIqamah.time),
    });
    push(mins <= URGENT_IQAMAH_MINUTES ? `! ${line}` : line);
  }

  // ── Jumu'ah (Friday) — upcoming slots only ──
  const jumuahLeft = c.isFriday ? (c.jumuahTimes || []).filter((d) => d > now) : [];
  if (jumuahLeft.length) push(fmt(t('auto.jumuah.today'), { times: timesText(jumuahLeft) }));

  // ── Next prayer ──
  const next = c.next;
  const jumuahReplacesDhuhr = c.isFriday && (c.jumuahTimes || []).length > 0;
  if (next?.time && !(next.key === 'dhuhr' && jumuahReplacesDhuhr)) {
    if (next.key === 'sunrise') {
      push(fmt(t('auto.next.sunrise'), { time: time(next.time) }));
    } else {
      const iq = (c.congregations || []).find((x) => x.key === next.key && x.time >= next.time);
      push(
        iq
          ? fmt(t('auto.next.prayer'), {
              prayer: prayer(next.key),
              adhan: time(next.time),
              iqamah: time(iq.time),
            })
          : fmt(t('auto.next.adhan'), { prayer: prayer(next.key), adhan: time(next.time) })
      );
    }
  }

  // ── Eid ──
  const eid = c.eid;
  if (eid?.kind) {
    const name = t(eid.kind === 'fitr' ? 'auto.eid.fitr' : 'auto.eid.adha');
    const venue = eid.venue ? ` — ${eid.venue}` : '';
    const slots = eid.times || [];
    if (eid.daysUntil > 0) {
      let line =
        eid.daysUntil === 1
          ? fmt(t('auto.eid.expectedTomorrow'), { eid: name })
          : fmt(t('auto.eid.expectedIn'), { eid: name, days: String(eid.daysUntil) });
      if (slots.length) line += ` — ${fmt(t('auto.eid.prayers'), { times: timesText(slots) })}`;
      push(line + venue);
    } else if (eid.daysUntil === 0) {
      push(t('auto.eid.greeting'));
      const left = slots.filter((d) => d > now);
      if (left.length) push(fmt(t('auto.eid.today'), { times: timesText(left) }) + venue);
    }
  }

  // ── Ramadan and the season ──
  const h = c.hijriToday;
  if (h?.m === 9 && h.d === 1) push(t('auto.ramadan.greeting'));
  if (h?.m === 9 && (h.d >= 21 || (h.d === 20 && afterMaghrib))) push(t('auto.ramadan.lastTen'));
  if (Number.isFinite(c.daysToRamadan) && c.daysToRamadan > 0) {
    push(
      c.daysToRamadan === 1
        ? t('auto.ramadan.expectedTomorrow')
        : fmt(t('auto.ramadan.expectedIn'), { days: String(c.daysToRamadan) })
    );
  }
  if (h?.m === 12 && h.d >= 1 && h.d <= 9) push(t('auto.dhulhijjah.ten'));

  // ── Sunnah fasts ── Today's until Maghrib (when the fast ends), then
  // tomorrow's.
  const tag = (r) => t(`auto.fast.tag.${r.key}`);
  const phrases = {
    lead: (when, fast) => fmt(t(`auto.fast.${when}`), { fast }),
    also: (list) => fmt(t('auto.fast.also'), { list }),
    sep: t('auto.fast.alsoSep'),
  };
  const today = afterMaghrib ? [] : fastReasonsFor(c.hijriToday, c.weekday);
  const tomorrow = fastReasonsFor(c.hijriTomorrow, (c.weekday + 1) % 7);
  const [reasons, when] = today.length ? [today, 'today'] : [tomorrow, 'tomorrow'];
  let fastLine = buildFastLine(reasons, when, tag, phrases);
  if (fastLine) {
    const lead = reasons[0].key;
    if (['arafah', 'ashura', 'tasua'].includes(lead)) {
      // The virtue as its own sentence, so it is not read as belonging to an
      // "also …" day.
      fastLine += `${t('auto.sentenceSep')}${t(`auto.fast.virtue.${lead}`)}`;
    }
    push(fastLine);
  }

  // ── Friday reminders ── Jumu'ah tomorrow (Thursday); Surah al-Kahf and
  // salawat from Thursday's Maghrib to Friday's Maghrib.
  if (c.weekday === 4 && (c.jumuahTimes || []).length) {
    push(fmt(t('auto.jumuah.tomorrow'), { times: timesText(c.jumuahTimes) }));
  }
  if ((c.weekday === 4 && afterMaghrib) || (c.weekday === 5 && !afterMaghrib)) {
    push(t('auto.friday.sunnah'));
  }

  return lines;
}
