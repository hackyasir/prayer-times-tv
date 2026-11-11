// ── autoAnnouncements.test.js ────────────────────────────────────────────
// The automatic ticker lines: stated as times (no live countdowns), the
// right fast at the right time of day, Friday and Ramadan/Eid notices
// worded as a mosque would post them, and nothing suggested on days when
// a voluntary fast would be wrong.

import { describe, it, expect } from 'vitest';
import en from '../../i18n/en.json';
import ar from '../../i18n/ar.json';
import ur from '../../i18n/ur.json';
import { fmtStr } from '../../i18n/I18nContext.jsx';
import { buildAutoAnnouncements, joinList } from '../autoAnnouncements.js';

const t = (key) => en[key] ?? key;
const at = (h, m = 0) => new Date(Date.UTC(2026, 10, 12, h, m)); // a Thursday
const time = (d) => `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

const times = {
  fajr: at(5, 44),
  sunrise: at(7, 5),
  dhuhr: at(12, 4),
  asr: at(14, 36),
  maghrib: at(16, 59),
  isha: at(18, 20),
};
const congregations = [
  { key: 'fajr', time: at(6, 15) },
  { key: 'dhuhr', time: at(12, 15) },
  { key: 'asr', time: at(15, 0) },
  { key: 'maghrib', time: at(17, 4) },
  { key: 'isha', time: at(18, 30) },
];

function build(over = {}) {
  return buildAutoAnnouncements({
    t,
    fmt: fmtStr,
    time,
    now: at(13, 0),
    weekday: 3, // Wednesday
    hijriToday: { m: 5, d: 20 },
    hijriTomorrow: { m: 5, d: 21 },
    daysToRamadan: null,
    times,
    next: { key: 'asr', time: times.asr },
    congregations,
    pendingIqamah: null,
    blackoutActive: false,
    isFriday: false,
    jumuahTimes: [at(13, 0)],
    eid: { kind: null, daysUntil: null, times: [], venue: '' },
    ...over,
  });
}

describe('prayer times', () => {
  it('states the next adhan and iqamah as times', () => {
    // (Wednesday: the second line is tomorrow's Thursday fast.)
    expect(build()).toEqual(['Asr: adhan 14:36, iqamah 15:00', 'Sunnah fast tomorrow (Thursday)']);
  });

  it('does not change from minute to minute (no countdowns)', () => {
    expect(build({ now: at(13, 1) })).toEqual(build({ now: at(13, 2) }));
  });

  it('marks a pending iqamah urgent in its last 10 minutes', () => {
    const pendingIqamah = { key: 'asr', time: at(15, 0) };
    const next = { key: 'maghrib', time: times.maghrib };
    expect(build({ now: at(14, 40), pendingIqamah, next })[0]).toBe('Asr iqamah at 15:00');
    expect(build({ now: at(14, 52), pendingIqamah, next })[0]).toBe('! Asr iqamah at 15:00');
  });

  it('says Fajr time ends at sunrise, rather than calling sunrise a prayer', () => {
    const lines = build({ now: at(6, 30), next: { key: 'sunrise', time: times.sunrise } });
    expect(lines[0]).toBe('Sunrise at 7:05 — Fajr time ends');
  });

  it('asks for phones to be silenced while the prayer is on', () => {
    expect(build({ blackoutActive: true })[0]).toBe(
      '! Prayer in progress — please silence your phone'
    );
  });
});

describe("Jumu'ah and Friday", () => {
  const friday = {
    weekday: 5,
    isFriday: true,
    hijriToday: { m: 5, d: 22 },
    hijriTomorrow: { m: 5, d: 23 },
  };

  it("lists the remaining Jumu'ah times instead of Dhuhr", () => {
    const lines = build({
      ...friday,
      now: at(11, 0),
      next: { key: 'dhuhr', time: times.dhuhr },
      jumuahTimes: [at(13, 0), at(14, 30)],
    });
    expect(lines).toContain("Jumu'ah today at 13:00 and 14:30");
    expect(lines.some((l) => l.startsWith('Dhuhr'))).toBe(false);
    const later = build({ ...friday, now: at(13, 30), jumuahTimes: [at(13, 0), at(14, 30)] });
    expect(later).toContain("Jumu'ah today at 14:30");
  });

  it('reminds on Thursday about tomorrow, and about al-Kahf from Maghrib', () => {
    const thursday = { weekday: 4 };
    expect(build({ ...thursday, now: at(13, 0) })).toContain("Jumu'ah tomorrow at 13:00");
    expect(build({ ...thursday, now: at(13, 0) })).not.toContain(en['auto.friday.sunnah']);
    expect(build({ ...thursday, now: at(17, 30) })).toContain(en['auto.friday.sunnah']);
    expect(build({ ...friday, now: at(16, 0) })).toContain(en['auto.friday.sunnah']);
    expect(build({ ...friday, now: at(17, 30) })).not.toContain(en['auto.friday.sunnah']);
  });
});

describe('Sunnah fasts', () => {
  it("shows today's fast until Maghrib, then tomorrow's", () => {
    const monday = { weekday: 1, hijriToday: { m: 5, d: 5 }, hijriTomorrow: { m: 5, d: 6 } };
    expect(build({ ...monday, now: at(12, 0) })).toContain('Sunnah fast today (Monday)');
    // After Maghrib on Monday nothing is due tomorrow (Tuesday).
    const evening = build({ ...monday, now: at(17, 30), next: { key: 'isha', time: times.isha } });
    expect(evening.some((l) => l.includes('Sunnah fast'))).toBe(false);
    // Wednesday evening → Thursday's fast.
    expect(build({ now: at(17, 30) })).toContain('Sunnah fast tomorrow (Thursday)');
  });

  it('adds the virtue of Arafah as its own sentence', () => {
    const lines = build({
      weekday: 3,
      hijriToday: { m: 12, d: 8 },
      hijriTomorrow: { m: 12, d: 9 },
    });
    expect(lines).toContain(
      '! Sunnah fast tomorrow (Day of Arafah) — also Thursday. Fasting the Day of Arafah is hoped to expiate the sins of the past and the coming year (Sahih Muslim)'
    );
  });

  it('never suggests a voluntary fast in Ramadan or on the eve of it', () => {
    const ramadan = build({
      weekday: 0,
      hijriToday: { m: 9, d: 12 },
      hijriTomorrow: { m: 9, d: 13 },
    });
    expect(ramadan.some((l) => l.includes('Sunnah fast'))).toBe(false);
    const eve = build({ weekday: 0, hijriToday: { m: 8, d: 28 }, hijriTomorrow: { m: 8, d: 29 } });
    expect(eve.some((l) => l.includes('Sunnah fast'))).toBe(false); // 29 Sha'ban, a Monday
  });
});

describe('Ramadan, Dhul-Hijjah and Eid', () => {
  it('gives the expected start of Ramadan, subject to moon sighting', () => {
    expect(build({ daysToRamadan: 5 })).toContain(
      'Ramadan expected to begin in 5 days, subject to moon sighting'
    );
    expect(build({ daysToRamadan: 1 })).toContain(
      'Ramadan expected to begin tomorrow, subject to moon sighting'
    );
  });

  it('greets on 1 Ramadan and marks the last ten nights from the 21st night', () => {
    expect(build({ hijriToday: { m: 9, d: 1 }, hijriTomorrow: { m: 9, d: 2 } })).toContain(
      'Ramadan Mubarak'
    );
    const lastTen = en['auto.ramadan.lastTen'];
    expect(build({ hijriToday: { m: 9, d: 20 }, hijriTomorrow: { m: 9, d: 21 } })).not.toContain(
      lastTen
    );
    expect(
      build({ now: at(17, 30), hijriToday: { m: 9, d: 20 }, hijriTomorrow: { m: 9, d: 21 } })
    ).toContain(lastTen);
    expect(build({ hijriToday: { m: 9, d: 27 }, hijriTomorrow: { m: 9, d: 28 } })).toContain(
      lastTen
    );
  });

  it('marks the first ten days of Dhul-Hijjah', () => {
    expect(build({ hijriToday: { m: 12, d: 3 }, hijriTomorrow: { m: 12, d: 4 } })).toContain(
      en['auto.dhulhijjah.ten']
    );
    expect(build({ hijriToday: { m: 12, d: 10 }, hijriTomorrow: { m: 12, d: 11 } })).not.toContain(
      en['auto.dhulhijjah.ten']
    );
  });

  it('words Eid as expected, with the prayer times and venue', () => {
    const eid = { kind: 'fitr', daysUntil: 3, times: [at(8, 0), at(9, 30)], venue: 'Main hall' };
    expect(build({ eid })).toContain(
      'Eid al-Fitr expected in 3 days, subject to moon sighting — Eid prayer at 8:00 and 9:30 — Main hall'
    );
    expect(build({ eid: { ...eid, daysUntil: 1, times: [] } })).toContain(
      'Eid al-Fitr expected tomorrow, subject to moon sighting — Main hall'
    );
  });

  it('greets on Eid day and lists only the Eid prayers still to come', () => {
    const eid = { kind: 'adha', daysUntil: 0, times: [at(8, 0), at(9, 30)], venue: '' };
    const morning = build({
      eid,
      now: at(8, 30),
      hijriToday: { m: 12, d: 10 },
      hijriTomorrow: { m: 12, d: 11 },
    });
    expect(morning).toContain('Eid Mubarak! May Allah accept from us and from you');
    expect(morning).toContain('Eid prayer today at 9:30');
    expect(morning.some((l) => l.includes('Sunnah fast'))).toBe(false);
  });
});

describe('translations', () => {
  it('joins lists with translated words', () => {
    expect(joinList(['a'], t)).toBe('a');
    expect(joinList(['a', 'b', 'c'], t)).toBe('a, b and c');
  });

  it('has every automatic-announcement string in Arabic and Urdu, with the same placeholders', () => {
    const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    for (const key of Object.keys(en).filter((k) => k.startsWith('auto.'))) {
      for (const dict of [ar, ur]) {
        expect(dict[key], key).toBeTypeOf('string');
        expect(vars(dict[key]), key).toBe(vars(en[key]));
      }
    }
  });
});
