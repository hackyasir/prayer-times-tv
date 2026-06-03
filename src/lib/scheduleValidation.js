function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  const rem = n % 10;
  if (rem === 1) return `${n}st`;
  if (rem === 2) return `${n}nd`;
  if (rem === 3) return `${n}rd`;
  return `${n}th`;
}

export function parseHHMMToMinutes(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

// Returns the first ordering error among enabled slots with non-empty times.
// Ordering is based on slot index (1st, 2nd, 3rd...).
export function findNonAscendingSlot(slots) {
  if (!Array.isArray(slots)) return null;

  let prev = null;
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i] || {};
    const enabled = slot.enabled !== false;
    const time = typeof slot.time === 'string' ? slot.time.trim() : '';
    if (!enabled || !time) continue;

    const mins = parseHHMMToMinutes(time);
    if (mins == null) continue;

    if (prev && mins <= prev.mins) {
      return {
        previousIndex: prev.index,
        previousTime: prev.time,
        currentIndex: i,
        currentTime: time,
      };
    }

    prev = { index: i, time, mins };
  }

  return null;
}

export function buildOrderErrorMessage(label, detail) {
  if (!detail) return '';
  const prevOrd = ordinal(detail.previousIndex + 1);
  const currOrd = ordinal(detail.currentIndex + 1);
  return `${label} times must be increasing. ${currOrd} (${detail.currentTime}) must be after ${prevOrd} (${detail.previousTime}).`;
}
