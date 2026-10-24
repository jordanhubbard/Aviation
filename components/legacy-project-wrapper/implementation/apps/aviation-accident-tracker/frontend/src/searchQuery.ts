const states: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia', PR:'Puerto Rico', GU:'Guam', VI:'U.S. Virgin Islands', AS:'American Samoa', MP:'Northern Mariana Islands',
};

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
export function countryLabel(code: string): string {
  if (code === 'USA') return 'United States (USA)';
  try { return `${countryNames.of(code) ?? code} (${code})`; } catch { return code; }
}
export function regionLabel(code: string): string {
  return states[code] ? `${states[code]} (${code})` : code;
}

export function parseSearchQuery(query: string, countries: string[], regions: string[], today = new Date()) {
  let remaining = query.trim();
  const result: { search?: string; category?: 'general' | 'commercial' | 'unknown'; country?: string; region?: string; from?: string; to?: string; cause?: string } = {};
  const consume = (pattern: RegExp, key: keyof typeof result, value: string) => {
    if (pattern.test(remaining)) {
      (result as Record<string, string>)[key] = value;
      remaining = remaining.replace(pattern, ' ');
    }
  };
  consume(/\b(?:commercial|airline)\b/i, 'category', 'commercial');
  consume(/\b(?:general aviation|private aviation)\b/i, 'category', 'general');
  consume(/\bunknown category\b/i, 'category', 'unknown');
  for (const [pattern, cause] of [
    [/\b(?:cfit|controlled flight into terrain)\b/i, 'CFIT'],
    [/\b(?:loss of control|lost control)\b/i, 'Loss of control'],
    [/\b(?:engine failure|engine failed)\b/i, 'Engine failure'],
    [/\bfuel exhaustion\b/i, 'Fuel exhaustion'],
    [/\bmidair collision\b/i, 'Midair collision'],
  ] as const) consume(pattern, 'cause', cause);
  const range = remaining.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/i);
  if (range) {
    const days = Number(range[1]);
    if (days >= 1 && days <= 365) {
      const start = new Date(today);
      start.setDate(start.getDate() - days + 1);
      result.from = start.toISOString().slice(0, 10);
      result.to = today.toISOString().slice(0, 10);
      remaining = remaining.replace(range[0], ' ');
    }
  }
  const year = remaining.match(/\b(?:since|after)\s+(20\d\d)\b/i);
  if (year) { result.from = `${year[1]}-01-01`; remaining = remaining.replace(year[0], ' '); }
  for (const code of regions) {
    const name = states[code];
    if (name && new RegExp(`\\b${name}\\b`, 'i').test(remaining)) {
      result.region = code;
      remaining = remaining.replace(new RegExp(`\\b${name}\\b`, 'i'), ' ');
      break;
    }
  }
  for (const code of countries) {
    const name = code === 'USA' ? 'United States' : countryLabel(code).replace(/ \([^)]*\)$/, '');
    if (name && new RegExp(`\\b${name}\\b`, 'i').test(remaining)) {
      result.country = code;
      remaining = remaining.replace(new RegExp(`\\b${name}\\b`, 'i'), ' ');
      break;
    }
  }
  remaining = remaining.replace(/\b(?:accidents?|incidents?|in|with|for|during|show|find|me|the|and)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  if (remaining) result.search = remaining;
  return result;
}
