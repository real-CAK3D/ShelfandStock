// US holidays and food-centric occasions, computed per year so the calendar never runs out.

const nthWeekday = (y, m, wd, n) => { // n-th weekday (0=Sun) of month m (0-based); n=-1 → last
  if (n > 0) { const d = new Date(y, m, 1); const off = (wd - d.getDay() + 7) % 7; return new Date(y, m, 1 + off + (n - 1) * 7); }
  const d = new Date(y, m + 1, 0); const off = (d.getDay() - wd + 7) % 7; return new Date(y, m, d.getDate() - off);
};

function easter(y) { // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// tag links a holiday to recipe tags and to holiday-storage items
export function holidaysFor(y) {
  return [
    { date: new Date(y, 0, 1), name: "New Year's Day", emoji: '🎆', tag: 'party' },
    { date: nthWeekday(y, 1, 0, 2), name: 'Big Game Sunday', emoji: '🏈', tag: 'game day' },
    { date: new Date(y, 1, 14), name: "Valentine's Day", emoji: '💝', tag: 'date night' },
    { date: new Date(y, 2, 17), name: "St. Patrick's Day", emoji: '☘️', tag: 'party' },
    { date: easter(y), name: 'Easter', emoji: '🐣', tag: 'easter' },
    { date: nthWeekday(y, 4, 0, 2), name: "Mother's Day", emoji: '💐', tag: 'breakfast' },
    { date: nthWeekday(y, 4, 1, -1), name: 'Memorial Day', emoji: '🇺🇸', tag: 'gathering' },
    { date: nthWeekday(y, 5, 0, 3), name: "Father's Day", emoji: '👔', tag: 'date night' },
    { date: new Date(y, 6, 4), name: 'Independence Day', emoji: '🎇', tag: 'gathering' },
    { date: nthWeekday(y, 8, 1, 1), name: 'Labor Day', emoji: '🌭', tag: 'gathering' },
    { date: new Date(y, 9, 31), name: 'Halloween', emoji: '🎃', tag: 'party' },
    { date: nthWeekday(y, 10, 4, 4), name: 'Thanksgiving', emoji: '🦃', tag: 'thanksgiving' },
    { date: new Date(y, 11, 24), name: 'Christmas Eve', emoji: '🕯️', tag: 'christmas' },
    { date: new Date(y, 11, 25), name: 'Christmas', emoji: '🎄', tag: 'christmas' },
    { date: new Date(y, 11, 31), name: "New Year's Eve", emoji: '🥂', tag: 'party' },
  ].map(h => ({ ...h, iso: iso(h.date), holiday: true }));
}

export function holidayMap(years) {
  const m = {};
  for (const y of years) for (const h of holidaysFor(y)) (m[h.iso] ||= []).push(h);
  return m;
}
