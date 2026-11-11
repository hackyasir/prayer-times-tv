// ── settingDescriptions.js — plain-English help for the settings sheet ───────
//
// The sheet template (Settings → Masjid → Download sheet template) has a
// third column explaining each row, so someone editing the masjid's Google
// Sheet knows what a value means and which values are allowed. The app
// reads only the first two columns.

const PRAYER = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
  jumuah: "Jumu'ah",
  eid: 'Eid',
};

const TOP = {
  lat: 'Latitude of the masjid in decimal degrees (north is positive), e.g. 43.4675',
  lng: 'Longitude in decimal degrees (east is positive; Canada and the US are negative), e.g. -79.6877',
  locName: 'Place name shown on screen, e.g. Oakville, Ontario, Canada',
  cityTz: 'Timezone, e.g. America/Toronto',
  masjidName: "The masjid's name, shown at the top of the screen",
  method:
    'Calculation method: MWL, ISNA, Moonsighting, Egypt, Dubai, Makkah, Qatar, Kuwait, Karachi, Singapore, Turkey or Tehran',
  shadow: "Asr: 1 = Standard (Shafi'i, Maliki, Hanbali), 2 = Hanafi",
  highLatRule:
    'For places above about 48° latitude: middleOfNight, seventhOfNight or twilightAngle',
  hijriOffset: 'Hijri date adjustment in days, from -3 to 3, to match local moon sighting',
  iqamahAutoCalc:
    'TRUE = work out iqamah from the minimum waits (iqamahAutoBuffers); FALSE = fixed minutes after each adhan (iqamah)',
  iqamahRoundTo: 'Automatic iqamah is rounded up to 15, 5 or 1 minute(s)',
  iqamahFajrBeforeSunrise:
    'Automatic Fajr iqamah no earlier than this many minutes before sunrise (0 = off)',
  iqamahRule: 'Internal version number; leave it as it is',
  eidDaysBefore: 'Show the Eid banner this many days before Eid',
  eidLocation: 'Where the Eid prayer is held (optional), e.g. Community Centre, Hall B',
  theme: 'Colours: Classic Gold, Emerald Night, Royal Blue, Midnight Teal, Warm Sand or Pure White',
  ecoMode: 'TRUE = calmer, dimmer screen for displays that are on all day',
  chimeAdhan: 'TRUE = beep at each adhan',
  chimeIqamah: 'TRUE = beep at each iqamah',
  fontScale: 'Text size in per cent, 70 to 130',
  viewingMode: 'Text sizing: manual, distance or calibrate',
  progressStyle: 'Countdown style: hero, ring, daybar, moon, line or orbit',
  lang: 'Language: en (English), ar (Arabic) or ur (Urdu)',
  autoAnnouncements: "TRUE = add automatic notices (next prayer, Jumu'ah, Eid, Sunnah fasts)",
  announcements:
    'Ticker lines, one per line. Start a line with ! to make it urgent; add @2026-12-31 to hide it after that date',
  tickerMode: 'Ticker: scroll, or static (one line at a time)',
  tickerStaticSeconds: 'Seconds per line when the ticker is static, 3 to 30',
  blackoutEnabled: 'TRUE = dim the screen while each prayer is being prayed',
  blackoutLeadSeconds: 'Start dimming this many seconds before the iqamah',
  blackoutOpacity: 'How dark the dimming is, in per cent (0 to 100)',
};

/**
 * Help text for a sheet row's key (dotted for groups and lists), or ''.
 *   iqamah.fajr       → "Fajr iqamah: minutes after the adhan …"
 *   jumuah.2.enabled  → "Jumu'ah 2: TRUE to show, FALSE to hide"
 */
export function describeSetting(key) {
  if (TOP[key]) return TOP[key];
  const [top, a, b] = String(key).split('.');
  const prayer = PRAYER[a] || a;
  if (top === 'iqamah')
    return `${prayer} iqamah: minutes after the adhan (when iqamahAutoCalc is FALSE)`;
  if (top === 'iqamahAutoBuffers') {
    return `${prayer} iqamah: at least this many minutes after the adhan (when iqamahAutoCalc is TRUE)`;
  }
  if (top === 'blackoutDurations') return `${prayer}: dim the screen for this many minutes`;
  const slots = { jumuah: "Jumu'ah", eidFitr: 'Eid al-Fitr prayer', eidAdha: 'Eid al-Adha prayer' };
  if (slots[top]) {
    if (b === 'time') return `${slots[top]} ${a}: time, 24-hour (e.g. 13:15)`;
    if (b === 'enabled') return `${slots[top]} ${a}: TRUE to show, FALSE to hide`;
  }
  return '';
}
