---
id: Aviation-wg3
status: closed
deps: []
links: []
created: 2026-01-17T22:34:40.479639-08:00
type: bug
priority: 0
mac-task-id: task_d8544860b1074ed8adcc4662d0490cc6
---
# PROD: Logbook import incorrectly classifies solo PIC flights as INSTRUCTOR role

## Critical Bug: Flight Role Misclassification

**Application:** foreflight-dashboard  
**Priority:** P0 - Critical (Data Integrity Issue)  
**Environment:** Production (foreflight-dashboard-production.up.railway.app)

### Problem Summary
The logbook import is incorrectly classifying solo PIC flights as INSTRUCTOR role, corrupting the flight data and triggering false validation errors.

### Specific Example
**Flight Date:** 2025-11-13  
**Aircraft:** N378AC (CH7B)  
**Route:** KPAO -> KPAO (Local)  
**Actual Flight Type:** Solo night currency (3 takeoffs/landings to full stop)  
**Expected Role:** PIC  
**Actual Role (System):** INSTRUCTOR ❌

### Screenshot Evidence
The production dashboard shows:
- Status: Red validation error badge
- Role: "INSTRUCTOR" (incorrect)
- Validation Error: "Total time (0.6) should equal sum of PIC time (0.6) and dual received time (0.6)"

This validation error is itself incorrect - the system is double-counting the time.

### Root Cause Analysis

Looking at the CSV data (line 42):

```csv
Date: 2025-11-13
Aircraft: N378AC
TotalTime: 0.6
PIC: 0.6
Night: 0.6
DualGiven: 0.6    ← PROBLEM: Should be 0.0
DualReceived: 0.6 ← PROBLEM: Should be 0.0
InstructorName: (empty)
PilotComments: "night currency 3 takeoffs landings to full stop"
```

**The Bug:**
1. Both `DualGiven` (0.6) AND `DualReceived` (0.6) are populated
2. This is impossible - you cannot give AND receive dual instruction simultaneously
3. The system prioritizes `DualGiven` over other fields, incorrectly setting Role=INSTRUCTOR
4. No instructor name is listed, confirming this was a solo flight

### Expected Behavior

When importing this flight, the system should:
1. **Validate CSV data:** Reject rows where both DualGiven and DualReceived are non-zero
2. **Determine role correctly:**
   - If PIC > 0 and no InstructorName: Role = "PIC"
   - If DualReceived > 0 and InstructorName exists: Role = "DUAL"
   - If DualGiven > 0: Role = "INSTRUCTOR"
3. **Show specific error:** "Flight 2025-11-13: DualGiven (0.6) and DualReceived (0.6) cannot both be non-zero"

### Impact Assessment

**Severity: CRITICAL** because:
- ✈️ Corrupts pilot logbook data (FAA legal record)
- 📊 Invalidates currency calculations (night, landings)
- 🧮 Double-counts flight time in statistics
- ⚖️ Could affect pilot currency for flight reviews, insurance
- 🚫 Breaks validation system with false positives
- 📉 Undermines trust in the entire dashboard

**Affected Data:**
- At minimum: 1 flight (2025-11-13)
- Potentially: ALL flights where ForeFlight CSV has dual time populated incorrectly
- Need to audit entire logbook for similar issues

### Technical Implementation

#### 1. CSV Validation (Pre-Import)

```python
def validate_flight_row(row: pd.Series) -> List[str]:
    errors = []
    
    dual_given = float(row.get('DualGiven', 0) or 0)
    dual_received = float(row.get('DualReceived', 0) or 0)
    
    # CRITICAL: Cannot have both dual given and dual received
    if dual_given > 0 and dual_received > 0:
        errors.append(
            f"Flight {row['Date']}: DualGiven ({dual_given}) and "
            f"DualReceived ({dual_received}) cannot both be non-zero. "
            f"This flight needs manual review."
        )
    
    return errors
```

#### 2. Role Determination Logic

```python
def determine_flight_role(row: pd.Series) -> str:
    """
    Determine pilot role with strict precedence rules.
    """
    dual_given = float(row.get('DualGiven', 0) or 0)
    dual_received = float(row.get('DualReceived', 0) or 0)
    pic_time = float(row.get('PIC', 0) or 0)
    instructor_name = row.get('InstructorName', '').strip()
    
    # Rule 1: If giving dual instruction -> INSTRUCTOR
    if dual_given > 0:
        return 'INSTRUCTOR'
    
    # Rule 2: If receiving dual instruction -> DUAL
    if dual_received > 0 and instructor_name:
        return 'DUAL'
    
    # Rule 3: If PIC time logged -> PIC
    if pic_time > 0:
        return 'PIC'
    
    # Rule 4: Default to DUAL if instructor present
    if instructor_name:
        return 'DUAL'
    
    # Rule 5: Fallback
    return 'UNKNOWN'
```

#### 3. Data Integrity Check

```python
def audit_logbook_roles():
    """
    Audit all flights for role misclassification.
    """
    suspicious_flights = db.execute("""
        SELECT * FROM flights
        WHERE role = 'INSTRUCTOR'
          AND (instructor_name IS NULL OR instructor_name = '')
    """).fetchall()
    
    for flight in suspicious_flights:
        log.warning(
            f"Suspicious INSTRUCTOR role on {flight.date}: "
            f"No instructor name listed. PIC={flight.pic}, "
            f"DualGiven={flight.dual_given}"
        )
    
    return suspicious_flights
```

### Validation Error Fix

The validation error message is also incorrect:

**Current (Wrong):**
```
Total time (0.6) should equal sum of PIC time (0.6) and dual received time (0.6)
```

This incorrectly assumes time should be summed when it should be mutually exclusive.

**Corrected Logic:**
```python
def validate_time_accounting(flight):
    total = flight.total_time
    pic = flight.pic
    dual_received = flight.dual_received
    
    # Time should be ONE of these, not a sum
    expected_time = max(pic, dual_received)
    
    if abs(total - expected_time) > 0.01:  # floating point tolerance
        return f"Total time ({total}) should equal PIC ({pic}) OR dual received ({dual_received}), not both"
```

### Immediate Action Items

- [ ] **URGENT:** Audit production database for flights with Role=INSTRUCTOR and no InstructorName
- [ ] Fix CSV import validation to reject DualGiven + DualReceived conflicts
- [ ] Correct role determination logic with strict precedence
- [ ] Fix validation error message logic
- [ ] Re-import affected flights with corrected logic
- [ ] Add database constraint: CHECK (NOT (dual_given > 0 AND dual_received > 0))

### Data Corruption Assessment

Need to check:
```sql
-- Find all potentially corrupted INSTRUCTOR flights
SELECT date, aircraft_id, pic, dual_given, dual_received, instructor_name, role
FROM flights
WHERE role = 'INSTRUCTOR' 
  AND (instructor_name IS NULL OR instructor_name = '');

-- Find flights with impossible dual time
SELECT date, aircraft_id, dual_given, dual_received
FROM flights
WHERE dual_given > 0 AND dual_received > 0;
```

### Acceptance Criteria

- [ ] CSV validation rejects rows with both DualGiven and DualReceived > 0
- [ ] Role determination correctly identifies PIC flights as "PIC", not "INSTRUCTOR"
- [ ] Validation errors show correct logic (not sum of PIC + Dual)
- [ ] Flight 2025-11-13 shows Role="PIC" instead of "INSTRUCTOR"
- [ ] No validation error for flight 2025-11-13
- [ ] All logbook statistics recalculate correctly
- [ ] Database audit finds zero INSTRUCTOR flights without instructor names
- [ ] Regression tests added for role classification edge cases

### Related Issues
- May affect other flights in the logbook
- Could impact FAA currency calculations
- Insurance and flight review requirements depend on accurate PIC time

### Priority Justification
**P0 (Critical)** because this corrupts legal aviation records required by the FAA. Incorrect logbook data could:
- Invalidate pilot currency for flights
- Cause insurance issues
- Result in FAA violations if currencies are miscalculated
- Undermine trust in the entire application

## Close Reason

Implemented intelligent auto-correction for dual time corruption in CSV imports
