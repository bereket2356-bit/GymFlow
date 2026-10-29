export const SEED_SESSIONS = [
  { id: "S-1", time: "05:30", end: "06:30", title: "Strength & conditioning", coach: "Bereket K.", status: "Completed", cap: 14, booked: 11 },
  { id: "S-2", time: "07:00", end: "08:00", title: "Boxing fundamentals", coach: "Hana G.", status: "Completed", cap: 16, booked: 9 },
  { id: "S-3", time: "17:30", end: "18:30", title: "Fight camp", coach: "Bereket K.", status: "Planned", cap: 12, booked: 6 },
  { id: "S-4", time: "19:00", end: "20:00", title: "Open ring", coach: "Dawit M.", status: "Planned", cap: 20, booked: 8 },
  { id: "S-5", time: "20:00", end: "21:00", title: "Sparring", coach: "Bereket K.", status: "Cancelled", cap: 10, booked: 0 },
];

export const ROSTERS = {
  "S-1": ["CUS-1043", "CUS-1045", "CUS-1042"],
  "S-2": ["CUS-1043", "CUS-1046", "CUS-1044", "CUS-1050"],
  "S-3": ["CUS-1042", "CUS-1043", "CUS-1045", "CUS-1046", "CUS-1047", "CUS-1050"],
  "S-4": ["CUS-1045", "CUS-1050", "CUS-1042", "CUS-1044"],
  "S-5": [],
};

export const SEED_MARKS = {
  "S-1": { "CUS-1043": "P", "CUS-1045": "P", "CUS-1042": "P" },
  "S-2": { "CUS-1043": "P", "CUS-1046": "P", "CUS-1044": "A", "CUS-1050": "P" },
  "S-3": { "CUS-1042": "", "CUS-1043": "", "CUS-1045": "P", "CUS-1046": "L", "CUS-1047": "A", "CUS-1050": "" },
  "S-4": { "CUS-1045": "", "CUS-1050": "", "CUS-1042": "", "CUS-1044": "" },
  "S-5": {},
};

export const MARK_OPTIONS = [
  ["P", "Present"],
  ["L", "Late"],
  ["A", "Absent"],
  ["E", "Excused"],
];

/** Completed sessions start locked, so their saved marks are unchanged. */
export function seedSavedMarks() {
  const saved = JSON.parse(JSON.stringify(SEED_MARKS));
  SEED_SESSIONS.forEach((s) => {
    if (s.status !== "Completed") saved[s.id] = {};
  });
  return saved;
}

/** Same session name by weekday, used for visit lists. */
export function sessionNameFor(dateISO) {
  const day = new Date(dateISO + "T00:00:00").getDay();
  if (day === 1 || day === 3 || day === 5) return "Fight camp · 17:30";
  if (day === 2 || day === 4) return "Boxing fundamentals · 07:00";
  if (day === 6) return "Open ring · 19:00";
  return "Sparring · 20:00";
}