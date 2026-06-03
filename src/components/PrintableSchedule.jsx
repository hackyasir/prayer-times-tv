// ── PrintableSchedule ────────────────────────────────────────────────────
//
// Standalone view that renders an entire month of prayer times in a
// table optimized for printing (A4/Letter, black-on-white, print CSS in
// styles/print.css).
//
// User journey:
//   1. Open Settings → Display tab → "Print Monthly Schedule" button
//   2. App switches to this view (no nav bar, no widgets — just the table)
//   3. User uses browser's File → Print (or Cmd/Ctrl+P) to print or save PDF
//   4. "Back to Dashboard" link returns to the live display
//
// What it renders:
//   - Header: masjid name (or "Prayer Times"), city, Gregorian + Hijri month
//   - Table: 31 rows × 8 columns (Date, Day, Hijri, Fajr, Sunrise, Dhuhr,
//     Asr, Maghrib, Isha) — actually 28-31 rows depending on month length
//   - Each prayer cell: "Adhan / Iqamah" stacked vertically
//   - Footer notes: calculation method, location, any active Jumu'ah /
//     Eid schedules that fall within this month
//
// Why this matters:
//   Mosques print these monthly bulletins for the entrance wall, the
//   newsletter, the website. Most competing apps either lack this entirely
//   or paywall it. Cheap to add, high practical value.

import { useMemo, useState } from 'react';
import { PRAYERS, METHOD_LABELS } from '../lib/constants.js';
import { calcTimes } from '../lib/prayerCalc.js';
import { fmt12 } from '../lib/formatters.js';
import { toHijriParts, findUpcomingEid } from '../lib/hijri.js';
import { computeIqamah } from '../lib/iqamah.js';
import { fastReasonsFor } from '../lib/sunnahFasts.js';

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qidah',
  'Dhu al-Hijjah',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PrintableSchedule({
  // Settings needed to compute the month's times.
  // Drilled in from App.jsx so this component stays a pure renderer.
  lat,
  lng,
  cityTz,
  method,
  shadow,
  highLatRule,
  iqamah,
  iqamahAutoCalc,
  iqamahAutoBuffers,
  hijriOffset,
  masjidName,
  locName,
  logoDataUrl,
  jumuah,
  eidFitr,
  eidAdha,
  // Lifecycle
  onClose,
}) {
  // Month selector — defaults to the current calendar month. Two arrow
  // buttons let the user step through months without leaving the view
  // (useful when prepping next month's bulletin ahead of time).
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0..11

  // Compute the table data: one row per day of the selected month.
  // useMemo so changing month doesn't re-recompute on unrelated re-renders.
  const rows = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // First enabled Jumu'ah slot — used to substitute the Dhuhr cell on
    // Fridays. Multi-slot mosques get all their slots listed in the
    // footer; the table cell shows just the first to keep it scannable.
    const firstJumuah = (jumuah || []).find((j) => j.enabled && j.time);

    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      // Probe at local noon to keep things in the middle of the day,
      // regardless of any DST edge effects near midnight.
      const probe = new Date(year, month, d, 12, 0, 0);
      const times = calcTimes(probe, lat, lng, method, shadow, undefined, highLatRule);
      const hijri = toHijriParts(probe);
      // Apply Hijri offset — the user's calendar reading lives `hijriOffset`
      // days ahead of the tabular calendar (positive = user ahead).
      // Just adjust the displayed day; month/year shifts are rare enough
      // that we accept the small inaccuracy near month boundaries.
      const userHijriDay = hijri.d + (hijriOffset || 0);
      const isFriday = probe.getDay() === 5;

      // Apply iqamah (auto-buffer mode or manual offsets). Delegated
      // to lib/iqamah.js so the printed schedule uses the EXACT same
      // logic as the live dashboard — no risk of drift.
      const iqamahFor = (key) =>
        computeIqamah(times[key], {
          autoCalc: !!iqamahAutoCalc,
          bufferMinutes: iqamahAutoBuffers?.[key] ?? 0,
          offsetMinutes: iqamah?.[key] ?? 0,
        });

      // ── Jumu'ah substitution on Friday rows ───────────────────────────
      // Mosques replace Dhuhr with Jumu'ah on Fridays. The table cell
      // should show the actual Jumu'ah time, not the regular Dhuhr time
      // (which is what the live dashboard does). Parses "HH:MM" from
      // settings and builds a Date at noon to anchor it to this calendar
      // day. Jumu'ah uses one congregation time only (adhan-time display).
      const buildJumuahDate = () => {
        if (!isFriday || !firstJumuah) return null;
        const [hh, mm] = firstJumuah.time.split(':').map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
        const jt = new Date(probe);
        jt.setHours(hh, mm, 0, 0);
        return jt;
      };
      const jumuahCell = buildJumuahDate();

      result.push({
        date: d,
        weekday: WEEKDAYS[probe.getDay()],
        hijri: `${userHijriDay} ${HIJRI_MONTHS[hijri.m - 1]}`,
        hijriYear: hijri.y,
        // For each prayer key, store adhan + iqamah times. Sunrise has
        // no iqamah (observational only). On Fridays, the Dhuhr cell is
        // swapped for the Jumu'ah time and flagged so the
        // renderer can label it visually.
        prayers: PRAYERS.map((p) => {
          if (p.key === 'dhuhr' && jumuahCell) {
            return {
              key: 'dhuhr',
              adhan: jumuahCell,
              iqamah: null,
              isJumuah: true,
            };
          }
          return {
            key: p.key,
            adhan: times[p.key],
            iqamah: p.key === 'sunrise' ? null : iqamahFor(p.key),
          };
        }),
        isFriday,
        // ── Sunnah-fasting day markers (single source of truth) ──────────
        // Derived from the SAME lib the on-screen announcements use, so the
        // calendar and the live display can never disagree. fastReasonsFor
        // already applies the forbidden-day gate (Eid + Tashreeq → no fast).
        ...(() => {
          const reasons = fastReasonsFor({ m: hijri.m, d: userHijriDay }, probe.getDay());
          const has = (k) => reasons.some((r) => r.key === k);
          const special = has('arafah')
            ? 'arafah'
            : has('ashura')
              ? 'ashura'
              : has('tasua')
                ? 'tasua'
                : null;
          return {
            isSunnahFast: has('monday') || has('thursday'),
            isWhiteDay: has('white'),
            fastSpecial: special,
            isShawwalFast: has('shawwal'),
          };
        })(),
      });
    }
    return result;
    // cityTz intentionally omitted — used only by fmt12 during render,
    // not in the row computation itself; including it would cause needless
    // recomputes on timezone-related state changes that don't affect data.
  }, [
    year,
    month,
    lat,
    lng,
    method,
    shadow,
    highLatRule,
    iqamah,
    iqamahAutoCalc,
    iqamahAutoBuffers,
    hijriOffset,
    jumuah,
  ]);

  // Month display string e.g. "May 2026"
  const monthName = new Date(year, month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Hijri month span — usually one Gregorian month covers 1-2 Hijri months.
  // Include the Hijri YEAR; if the span crosses a year boundary, show both.
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const firstHijriMonth = firstRow?.hijri.split(' ').slice(1).join(' ');
  const lastHijriMonth = lastRow?.hijri.split(' ').slice(1).join(' ');
  const firstYear = firstRow?.hijriYear;
  const lastYear = lastRow?.hijriYear;
  const hijriRange = (() => {
    if (!firstRow || !lastRow) return '';
    if (firstHijriMonth === lastHijriMonth && firstYear === lastYear) {
      return `${firstHijriMonth} ${firstYear}`;
    }
    if (firstYear === lastYear) {
      return `${firstHijriMonth} – ${lastHijriMonth} ${lastYear}`;
    }
    return `${firstHijriMonth} ${firstYear} – ${lastHijriMonth} ${lastYear}`;
  })();

  // Which fast-legend rows are relevant THIS month (so we don't show the
  // Shawwal/special legend in months that have none).
  const monthHasSpecialFast = rows.some((r) => r.fastSpecial);
  const monthHasShawwal = rows.some((r) => r.isShawwalFast);
  const monthHasWhite = rows.some((r) => r.isWhiteDay);

  // Active Jumu'ah slots — listed in the footer as a quick reference.
  const activeJumuah = (jumuah || []).filter((j) => j.enabled && j.time);

  // ── Eid auto-detection within the displayed month ────────────────────
  // findUpcomingEid scans forward from a given date looking for the next
  // 1 Shawwal (Fitr) or 10 Dhu al-Hijjah (Adha). We probe from the FIRST
  // day of the displayed month with a 31-day window — anything found
  // lands inside the month if its `daysUntil` ≤ days-in-month.
  // Returns one of:
  //   - { kind: 'fitr'|'adha', date: Date, slots: [...] } when an Eid is
  //     found within the displayed month
  //   - null otherwise
  //
  // The Hijri tabular calendar can disagree with sighting-based calendars
  // by a day or two, which is why we display the date as computed +
  // accept that the actual celebration may be a day off (mosque admins
  // already factor this in via the Hijri offset setting elsewhere).
  const eidInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1, 12, 0, 0);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const found = findUpcomingEid(firstDay, hijriOffset || 0, daysInMonth + 1);
    if (!found || !found.kind || !found.eidDate) return null;
    // findUpcomingEid normalizes eidDate to midnight; check it's actually
    // within this calendar month before accepting.
    if (found.eidDate.getMonth() !== month || found.eidDate.getFullYear() !== year) {
      return null;
    }
    const slots = found.kind === 'fitr' ? eidFitr || [] : eidAdha || [];
    const enabledSlots = slots.filter((s) => s.enabled && s.time);
    return {
      kind: found.kind,
      date: found.eidDate,
      slots: enabledSlots,
    };
  }, [year, month, hijriOffset, eidFitr, eidAdha]);

  const navMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="printable-schedule">
      {/* On-screen controls (hidden in print) */}
      <div className="ps-controls no-print">
        <button onClick={onClose} className="ps-back-btn">
          ← Back to Dashboard
        </button>
        <div className="ps-month-nav">
          <button onClick={() => navMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <span className="ps-month-label">{monthName}</span>
          <button onClick={() => navMonth(1)} aria-label="Next month">
            ›
          </button>
        </div>
        <button onClick={() => window.print()} className="ps-print-btn">
          🖨 Print / Save PDF
        </button>
      </div>

      {/* Printable content */}
      <div className="ps-page">
        {/* Subtle ornamental background — the real arabesque image, faded via
            CSS opacity so it sits behind the calendar without hurting the
            prayer-time legibility. The ornate top of the image lands in the
            header zone; it fades into white over the table area. Decorative
            only (aria-hidden). */}
        <div className="ps-bg-ornament" aria-hidden="true" />

        {/* Header */}
        <div className="ps-header">
          {logoDataUrl && <img src={logoDataUrl} alt="" className="ps-logo" />}
          <div className="ps-header-text">
            <h1 className="ps-title">{masjidName || 'Prayer Times'}</h1>
            <div className="ps-subtitle">{locName}</div>
            <div className="ps-month">
              {monthName} · {hijriRange} AH
            </div>
          </div>
        </div>

        {/* Schedule table */}
        <table className="ps-table">
          <thead>
            <tr>
              {/* Single "Day" column = weekday + date together, e.g. "Fri 1".
               * Saves horizontal space and removes the redundant standalone
               * "Date" label that just showed a number column. */}
              <th>Day</th>
              <th>Hijri</th>
              {PRAYERS.map((p) => {
                // Fajr and Maghrib have meaningful Ramadan-context aliases:
                // - Fajr = the end-of-Suhoor cutoff (last moment to eat).
                // - Maghrib = Iftaar time (first moment to break fast).
                // Stacked label so the secondary name sits below the primary
                // without widening the column.
                const alias = p.key === 'fajr' ? 'Suhoor' : p.key === 'maghrib' ? 'Iftaar' : null;
                return (
                  <th key={p.key} className={`ps-prayer-col ps-${p.key}`}>
                    <span className="ps-col-primary">{p.en}</span>
                    {alias && <span className="ps-col-alias">({alias})</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Row background priority: Friday wins (yellow), then Mon/Thu
              // (green). Both are visible because they're different colors;
              // we never need to merge. White days are NOT a row color —
              // they get the ✦ icon attached to the Hijri date instead.
              const rowClasses = [
                row.isFriday && 'ps-friday',
                row.isSunnahFast && 'ps-sunnah',
                row.fastSpecial && 'ps-special-fast',
              ]
                .filter(Boolean)
                .join(' ');
              // Marker glyphs next to the Hijri date. ✦ = White day,
              // ★ = special annual fast (Arafah/Ashura/Tasu'a), ◦ = Shawwal.
              const specialTitle =
                row.fastSpecial === 'arafah'
                  ? 'Day of Arafah (highest reward)'
                  : row.fastSpecial === 'ashura'
                    ? 'Ashura (10 Muharram)'
                    : row.fastSpecial === 'tasua'
                      ? "Tasu'a (9 Muharram)"
                      : '';
              return (
                <tr key={row.date} className={rowClasses}>
                  <td className="ps-day-cell">
                    <span className="ps-weekday">{row.weekday}</span>
                    <span className="ps-date">{row.date}</span>
                  </td>
                  <td className="ps-hijri">
                    {row.hijri}
                    {row.fastSpecial && (
                      <span className="ps-special-day" title={specialTitle}>
                        {' ★'}
                      </span>
                    )}
                    {row.isWhiteDay && (
                      <span className="ps-white-day" title="White day (al-ayyam al-beed)">
                        {' ✦'}
                      </span>
                    )}
                    {row.isShawwalFast && (
                      <span className="ps-shawwal-day" title="Six of Shawwal (any six days this month)">
                        {' ◦'}
                      </span>
                    )}
                  </td>
                  {row.prayers.map((p) => (
                    <td
                      key={p.key}
                      className={`ps-time-cell${p.isJumuah ? ' ps-jumuah-cell' : ''}`}
                    >
                      {/* On Friday rows, the Dhuhr column shows the Jumu'ah
                       * time instead. A small "JUMU'AH" caption above the
                       * times makes the substitution explicit on print so
                       * readers don't think there's a typo in the column. */}
                      {p.isJumuah && <div className="ps-jumuah-label">Jumu&apos;ah</div>}
                      <div className="ps-adhan">{fmt12(p.adhan, cityTz)}</div>
                      {p.iqamah && <div className="ps-iqamah">{fmt12(p.iqamah, cityTz)}</div>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer notes — 2-column layout to use full page width.
         * Left: configuration (calculation method, Eid dates if any).
         * Right: recurring info (Jumu'ah times) + legend keys.
         * Saves vertical space → more room for the table on the page. */}
        <div className="ps-footer">
          <div className="ps-footer-col">
            <div className="ps-footer-row">
              <strong>Calculation:</strong> {METHOD_LABELS[method] || method}
              {shadow === 2 ? ' · Hanafi Asr' : ' · Shafi Asr'}
              {iqamahAutoCalc ? ' · Auto iqamah (smart)' : ' · Manual iqamah offsets'}
            </div>
            {/* Eid line — auto-shown when the printed month contains an
             * Eid (Fitr or Adha). Hidden in the other 10–11 months of the
             * year so it doesn't visually clutter normal months. */}
            {eidInMonth && eidInMonth.slots.length > 0 && (
              <div className="ps-footer-row">
                <strong>{eidInMonth.kind === 'fitr' ? 'Eid ul-Fitr' : 'Eid ul-Adha'}:</strong>{' '}
                {eidInMonth.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' · '}
                {eidInMonth.slots.map((s, i) => (
                  <span key={i} className="ps-footer-jumuah">
                    {i > 0 && ' · '}
                    {s.time}
                  </span>
                ))}
              </div>
            )}
            <div className="ps-footer-row ps-footer-note">
              Each daily prayer cell shows <em>Adhan</em> above and <em>Iqamah</em> below.
              Jumu&apos;ah shows one congregation time.
            </div>
          </div>

          <div className="ps-footer-col">
            {activeJumuah.length > 0 && (
              <div className="ps-footer-row">
                <strong>Jumu&apos;ah:</strong>{' '}
                {activeJumuah.map((j, i) => (
                  <span key={i} className="ps-footer-jumuah">
                    {i > 0 && ' · '}
                    {j.time}
                  </span>
                ))}
              </div>
            )}
            {/* Legend for the sunnah-fasting highlights. Tells viewers
             * what the green rows and ✦ icons mean — important when this
             * is the FIRST thing they see on the wall poster. */}
            <div className="ps-footer-row ps-footer-legend">
              <span className="ps-legend-item">
                <span className="ps-legend-swatch ps-legend-friday" />
                Friday (Jumu&apos;ah)
              </span>
              <span className="ps-legend-item">
                <span className="ps-legend-swatch ps-legend-sunnah" />
                Mon/Thu (recommended fasting)
              </span>
              {monthHasWhite && (
                <span className="ps-legend-item">
                  <span className="ps-legend-icon">✦</span>
                  White days, 13–15 Hijri (recommended fasting)
                </span>
              )}
              {monthHasSpecialFast && (
                <span className="ps-legend-item">
                  <span className="ps-legend-icon">★</span>
                  Arafah / Ashura / Tasu&apos;a (highest-reward fasts)
                </span>
              )}
              {monthHasShawwal && (
                <span className="ps-legend-item">
                  <span className="ps-legend-icon">◦</span>
                  Six of Shawwal (any six days that month)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
