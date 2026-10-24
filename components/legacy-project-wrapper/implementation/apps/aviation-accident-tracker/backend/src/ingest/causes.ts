import type { CauseAttribution } from '../types.js';

// These are explicit mechanisms, not a prediction of the investigation's outcome.
const PATTERNS: [string, RegExp][] = [
  ['CFIT', /\b(?:controlled flight into terrain|cfit)\b/i],
  ['Loss of control', /\b(?:loss of (?:aircraft )?control|lost control|uncontrolled (?:descent|flight)|failure to maintain (?:aircraft )?control)\b/i],
  ['Engine failure', /\b(?:engine (?:failure|failed|quit|stoppage)|powerplant failure|loss of (?:engine )?power|failed engine)\b/i],
  ['Fuel exhaustion', /\b(?:fuel exhaustion|ran out of fuel|fuel starvation)\b/i],
  ['Midair collision', /\b(?:midair|mid-air) collision\b/i],
  ['Weather', /\b(?:weather|icing|wind shear|microburst|thunderstorm)\b.{0,35}\b(?:caused|contributed|factor|loss of control)\b|\b(?:caused|contributed|factor)\b.{0,35}\b(?:weather|icing|wind shear|microburst|thunderstorm)\b/i],
];

export function classifyCauses(text: string, sourceName: string, url: string,
  basis: CauseAttribution['basis']): CauseAttribution[] {
  const found = new Set<string>();
  for (const sentence of text.split(/[.!?\n]+/)) {
    for (const [label, pattern] of PATTERNS) {
      const match = pattern.exec(sentence);
      if (!match) continue;
      const before = sentence.slice(Math.max(0, match.index - 32), match.index);
      const after = sentence.slice(match.index + match[0].length, match.index + match[0].length + 32);
      // Headlines often discuss a theory or explicitly rule a mechanism out.
      if (/\b(?:no|not|without|denied|ruled out|unconfirmed|possible|suspected|investigating|whether)\b|non[- ]$/i.test(before)
          || /\b(?:ruled out|not confirmed|unlikely|unconfirmed|suspected)\b/i.test(after)) continue;
      found.add(label);
    }
  }
  return [...found].map(label => ({ label, sourceName, url, basis }));
}
