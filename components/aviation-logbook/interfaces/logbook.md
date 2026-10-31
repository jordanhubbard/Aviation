# `aviation.logbook` interface

## Records

- `LogbookTimeInput` carries `totalTime`, `picTime`, `dualReceivedTime`, `soloTime`,
  `dayTime`, `nightTime`, `actualInstrumentTime`, `simulatedInstrumentTime`,
  `crossCountryTime`, `nightLandings`, `pilotRole`, and `studentPilot`. Durations are
  decimal hours. Optional numeric fields default to zero; `studentPilot` defaults to
  false.
- `LogbookValidationIssue` carries a stable `code`, `severity`, human-readable
  `message`, and ordered `fields` list. Version 0.1 emits errors; the severity field is
  retained so compatible warnings can be added later.
- `LogbookTimeValidationResult` carries `valid`, `normalizedPilotRole`,
  `normalizedPicTime`, `accountedTime`, and ordered `issues`. `accountedTime` is absent
  when invalid primitive inputs prevent meaningful arithmetic.

## Operations

- `validateLogbookTime(input, tolerance = 0.1) -> LogbookTimeValidationResult`
  validates primitive fields, normalizes the pilot role, applies qualified common
  overlap/accounting semantics, and returns structured issues without mutating input.
- Python exposes `LogbookTimeInput`, `LogbookValidationIssue`,
  `LogbookTimeValidationResult`, and `validate_logbook_time` with snake-case fields.

Supported roles are `PIC`, `SIC`, `STUDENT`, `INSTRUCTOR`, `SPLIT`, `DUAL`, and
`SOLO`. Student status is true when either `studentPilot` is true or the normalized
role is `STUDENT`.

The default tolerance is 0.1 hour. A caller may provide another finite, non-negative
tolerance. Passing an invalid tolerance fails closed.

Adding an optional input field or a new issue code is backward compatible. Removing or
renaming a field, changing decimal-hour units, changing a stable issue code, mutating
the input, or weakening primitive validation is a breaking interface change.

