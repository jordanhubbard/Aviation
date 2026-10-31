/** Portable pilot-logbook duration validation owned by aviation.logbook. */

export const LOGBOOK_PILOT_ROLES = [
  'PIC',
  'SIC',
  'STUDENT',
  'INSTRUCTOR',
  'SPLIT',
  'DUAL',
  'SOLO',
] as const;

export type LogbookPilotRole = typeof LOGBOOK_PILOT_ROLES[number];
export type LogbookValidationSeverity = 'error' | 'warning';

export interface LogbookTimeInput {
  totalTime: number;
  picTime?: number;
  dualReceivedTime?: number;
  soloTime?: number;
  dayTime?: number;
  nightTime?: number;
  actualInstrumentTime?: number;
  simulatedInstrumentTime?: number;
  crossCountryTime?: number;
  nightLandings?: number;
  pilotRole: string;
  studentPilot?: boolean;
}

export interface LogbookValidationIssue {
  code: string;
  severity: LogbookValidationSeverity;
  message: string;
  fields: string[];
}

export interface LogbookTimeValidationResult {
  valid: boolean;
  normalizedPilotRole: string;
  normalizedPicTime: number;
  accountedTime: number | null;
  issues: LogbookValidationIssue[];
}

const DURATION_FIELDS = [
  'totalTime',
  'picTime',
  'dualReceivedTime',
  'soloTime',
  'dayTime',
  'nightTime',
  'actualInstrumentTime',
  'simulatedInstrumentTime',
  'crossCountryTime',
] as const;

type DurationField = typeof DURATION_FIELDS[number];

const issue = (code: string, message: string, fields: string[]): LogbookValidationIssue => ({
  code,
  severity: 'error',
  message,
  fields,
});

const numericValue = (input: LogbookTimeInput, field: DurationField): unknown =>
  field === 'totalTime' ? input.totalTime : input[field] ?? 0;

const duration = (input: LogbookTimeInput, field: DurationField): number =>
  numericValue(input, field) as number;

/** Validate common duration relationships without mutating the supplied input. */
export function validateLogbookTime(
  input: LogbookTimeInput,
  tolerance = 0.1,
): LogbookTimeValidationResult {
  const issues: LogbookValidationIssue[] = [];
  const normalizedPilotRole = typeof input.pilotRole === 'string'
    ? input.pilotRole.trim().toUpperCase()
    : '';
  const rawPicTime = numericValue(input, 'picTime');
  let normalizedPicTime = typeof rawPicTime === 'number' && Number.isFinite(rawPicTime)
    ? rawPicTime
    : 0;

  for (const field of DURATION_FIELDS) {
    const value = numericValue(input, field);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      issues.push(issue(
        'invalid-duration',
        `${field} must be a finite, non-negative duration in decimal hours`,
        [field],
      ));
    }
  }

  const nightLandings = input.nightLandings ?? 0;
  if (typeof nightLandings !== 'number'
      || !Number.isFinite(nightLandings)
      || !Number.isInteger(nightLandings)
      || nightLandings < 0) {
    issues.push(issue(
      'invalid-landing-count',
      'nightLandings must be a finite, non-negative integer',
      ['nightLandings'],
    ));
  }

  if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0) {
    issues.push(issue(
      'invalid-tolerance',
      'tolerance must be finite and non-negative',
      ['tolerance'],
    ));
  }

  const supportedRole = (LOGBOOK_PILOT_ROLES as readonly string[]).includes(
    normalizedPilotRole,
  );
  if (!supportedRole) {
    issues.push(issue(
      'invalid-pilot-role',
      `Invalid pilot role (must be one of: ${LOGBOOK_PILOT_ROLES.join(', ')})`,
      ['pilotRole'],
    ));
  }

  if (issues.length > 0) {
    return {
      valid: false,
      normalizedPilotRole,
      normalizedPicTime,
      accountedTime: null,
      issues,
    };
  }

  const totalTime = duration(input, 'totalTime');
  const dualReceivedTime = duration(input, 'dualReceivedTime');
  const soloTime = duration(input, 'soloTime');
  const dayTime = duration(input, 'dayTime');
  const nightTime = duration(input, 'nightTime');
  const actualInstrumentTime = duration(input, 'actualInstrumentTime');
  const simulatedInstrumentTime = duration(input, 'simulatedInstrumentTime');
  const studentPilot = input.studentPilot === true || normalizedPilotRole === 'STUDENT';

  if (totalTime > 0
      && normalizedPilotRole === 'PIC'
      && normalizedPicTime === 0
      && dualReceivedTime === 0) {
    normalizedPicTime = totalTime;
  }

  const conditionTime = dayTime + nightTime;
  if (conditionTime > 0 && dayTime > 0 && nightTime > 0
      && Math.abs(conditionTime - totalTime) > tolerance) {
    issues.push(issue(
      'day-night-total-mismatch',
      `Day (${dayTime}) + night (${nightTime}) time (${conditionTime}) does not match total time (${totalTime})`,
      ['dayTime', 'nightTime', 'totalTime'],
    ));
  }

  const instrumentTime = actualInstrumentTime + simulatedInstrumentTime;
  if (instrumentTime > totalTime) {
    issues.push(issue(
      'instrument-time-exceeds-total',
      `Total instrument time (${instrumentTime}) exceeds flight time (${totalTime})`,
      ['actualInstrumentTime', 'simulatedInstrumentTime', 'totalTime'],
    ));
  }

  if (dualReceivedTime > totalTime) {
    issues.push(issue(
      'dual-received-exceeds-total',
      `Dual received time (${dualReceivedTime}) exceeds flight time (${totalTime})`,
      ['dualReceivedTime', 'totalTime'],
    ));
  }

  let accountedTime: number | null = null;
  if (totalTime === 0) {
    accountedTime = 0;
  } else if (normalizedPicTime > 0 && dualReceivedTime > 0 && !studentPilot) {
    const picEqualsTotal = Math.abs(normalizedPicTime - totalTime) <= tolerance;
    const dualEqualsTotal = Math.abs(dualReceivedTime - totalTime) <= tolerance;
    accountedTime = picEqualsTotal && dualEqualsTotal
      ? totalTime
      : dualReceivedTime + normalizedPicTime + Math.max(0, soloTime - normalizedPicTime);
  } else if (studentPilot
      || (normalizedPicTime > 0 && dualReceivedTime === 0)
      || (normalizedPicTime === 0 && dualReceivedTime > 0)) {
    const soloOutsidePic = studentPilot ? soloTime : Math.max(0, soloTime - normalizedPicTime);
    accountedTime = dualReceivedTime + normalizedPicTime + soloOutsidePic;
  }

  if (accountedTime !== null && totalTime > 0
      && Math.abs(accountedTime - totalTime) > tolerance) {
    issues.push(issue(
      'time-accounting-mismatch',
      `Total time (${totalTime.toFixed(1)}) does not match PIC (${normalizedPicTime.toFixed(1)}), dual received (${dualReceivedTime.toFixed(1)}), and solo (${soloTime.toFixed(1)}) time (solo can overlap PIC)`,
      ['totalTime', 'picTime', 'dualReceivedTime', 'soloTime'],
    ));
  }

  if (studentPilot && normalizedPicTime > 0) {
    issues.push(issue(
      'student-pic-conflict',
      'Student pilot cannot log PIC time',
      ['studentPilot', 'pilotRole', 'picTime'],
    ));
  }

  if (studentPilot && dualReceivedTime === 0 && soloTime === 0 && totalTime > 0) {
    issues.push(issue(
      'student-time-missing',
      'Student pilot flights should typically log dual received time',
      ['studentPilot', 'pilotRole', 'dualReceivedTime', 'soloTime'],
    ));
  }

  if (nightLandings > 0 && nightTime === 0) {
    issues.push(issue(
      'night-landings-without-night-time',
      'Night landings logged without night flight time',
      ['nightLandings', 'nightTime'],
    ));
  }

  if (soloTime > 0 && dualReceivedTime > 0) {
    issues.push(issue(
      'solo-dual-conflict',
      'Solo time cannot be logged with dual received time',
      ['soloTime', 'dualReceivedTime'],
    ));
  }

  if (soloTime > 0 && normalizedPilotRole !== 'PIC' && normalizedPilotRole !== 'STUDENT') {
    issues.push(issue(
      'solo-role-conflict',
      'Solo time can only be logged by PIC or student pilots',
      ['soloTime', 'pilotRole'],
    ));
  }

  return {
    valid: issues.every((candidate) => candidate.severity !== 'error'),
    normalizedPilotRole,
    normalizedPicTime,
    accountedTime,
    issues,
  };
}

