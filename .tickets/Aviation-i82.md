---
id: Aviation-i82
status: closed
deps: []
links: []
created: 2026-01-17T22:39:18.034345-08:00
type: bug
priority: 1
mac-task-id: task_9229dda36cc54b389bff6699021e324d
---
# Validation logic incorrectly rejects PIC + Dual for certificated pilots

## Bug Report: Overly Restrictive Validation Logic

**Application:** foreflight-dashboard  
**Priority:** P1 - High (Incorrect Aviation Regulations)  
**Environment:** Production (foreflight-dashboard-production.up.railway.app)

### Problem Summary
The validation logic incorrectly flags flights where a certificated pilot logs both PIC time and dual received time as errors. This is a **valid and legal scenario** under FAR 61.51 and should only be flagged for student pilots.

### Specific Example from Screenshot

**Flight:** 2025-11-08  
**Aircraft:** N726SA (C182)  
**Route:** KPAO -> KPAO  
**Total Time:** 2.7 hrs  
**PIC Time:** 2.7 hrs  
**Dual Received:** 2.7 hrs  
**Role:** DUAL  

**Current Validation Error:**
```
Total time (2.7) should equal sum of PIC time (2.7) and dual received time (2.7); 
Student pilot cannot log PIC time
```

**Why This Is Wrong:**
This is a **perfectly valid flight** for a certificated pilot receiving instruction (e.g., flight review, IPC, checkout in new aircraft, or advanced training).

### FAA Regulations (FAR 61.51)

Under 14 CFR § 61.51 (Pilot logbooks), a **certificated pilot** may log PIC time when:

1. **Sole manipulator of controls** - Rated in the aircraft (even if receiving dual)
2. **Acting as PIC** - When they are the PIC and hold appropriate ratings
3. **Flight review or proficiency check** - Common scenario for dual + PIC

**Example Scenarios (All Legal):**

#### Scenario 1: Flight Review
- Certificated private pilot gets Flight Review (BFR)
- CFI is giving dual instruction
- Pilot logs: PIC=2.0, Dual Received=2.0 ✅ VALID
- CFI logs: PIC=2.0, Dual Given=2.0 ✅ VALID

#### Scenario 2: Complex Aircraft Checkout  
- Certificated pilot getting checkout in new aircraft type
- Both pilots rated in the aircraft
- Pilot logs: PIC=1.5, Dual Received=1.5 ✅ VALID
- CFI logs: PIC=1.5, Dual Given=1.5 ✅ VALID

#### Scenario 3: Instrument Proficiency Check (IPC)
- Instrument-rated pilot getting IPC
- CFII providing instruction
- Pilot logs: PIC=2.0, Dual Received=2.0, Actual Instrument=2.0 ✅ VALID

### When It SHOULD Be an Error

The validation should **only** fail for **student pilots**:

**Student Pilot Scenario:**
- Student pilot (no certificate yet)
- Receiving dual instruction
- Student logs: PIC=0.0, Dual Received=1.5 ✅ VALID
- Student logs: PIC=1.5, Dual Received=1.5 ❌ INVALID (student cannot log PIC)

### Current Validation Logic (Incorrect)

```python
# WRONG: Assumes PIC + Dual Received is always invalid
def validate_time(flight):
    if flight.pic > 0 and flight.dual_received > 0:
        return "Total time should equal sum of PIC and dual received"
```

### Corrected Validation Logic

```python
def validate_time(flight, pilot_certificates):
    """
    Validate flight time accounting based on pilot certification status.
    """
    total = flight.total_time
    pic = flight.pic
    dual_received = flight.dual_received
    is_student_pilot = 'Student' in pilot_certificates
    
    # For certificated pilots: PIC and Dual can overlap
    if not is_student_pilot:
        if pic > 0 and dual_received > 0:
            # Both can be logged - they should be equal
            if abs(total - pic) > 0.01:  # tolerance for floating point
                return f"Total time ({total}) should equal PIC time ({pic})"
            if abs(pic - dual_received) > 0.01:
                return f"PIC ({pic}) and Dual Received ({dual_received}) should be equal when both are logged"
        elif pic > 0:
            # Solo PIC flight
            if abs(total - pic) > 0.01:
                return f"Total time ({total}) should equal PIC time ({pic})"
        elif dual_received > 0:
            # Dual received only (not acting as PIC)
            if abs(total - dual_received) > 0.01:
                return f"Total time ({total}) should equal Dual Received ({dual_received})"
    
    # For student pilots: PIC and Dual are mutually exclusive
    else:
        if pic > 0 and dual_received > 0:
            return "Student pilot cannot log PIC time when receiving dual instruction"
        elif pic > 0:
            # Solo flight
            if abs(total - pic) > 0.01:
                return f"Total time ({total}) should equal PIC time ({pic})"
        elif dual_received > 0:
            # Dual instruction
            if abs(total - dual_received) > 0.01:
                return f"Total time ({total}) should equal Dual Received ({dual_received})"
    
    return None  # Valid
```

### Database Schema Addition

Need to track pilot certificate status:

```sql
ALTER TABLE pilots ADD COLUMN certificates TEXT;
-- Values: 'Student', 'Sport', 'Recreational', 'Private', 'Commercial', 'ATP'
-- Can be comma-separated for multiple certificates

ALTER TABLE pilots ADD COLUMN ratings TEXT;
-- Values: 'Airplane SEL', 'Airplane MEL', 'Instrument', 'CFI', 'CFII', 'MEI'
```

### UI Enhancements

1. **Pilot Profile:**
   - Add "Certificate Level" dropdown (Student, Private, Commercial, ATP)
   - Add "Ratings" checklist (SEL, MEL, Instrument, CFI, etc.)

2. **Import Configuration:**
   - Ask pilot certificate level on first import
   - Store in user profile
   - Apply appropriate validation rules

3. **Validation Display:**
   - Show **info badge** (not error) for PIC+Dual when valid
   - Info text: "ℹ️ Flight Review or Training (PIC+Dual is valid for certificated pilots)"
   - Only show error badge for actual violations

### Affected Flights

Looking at the screenshot, these flights are **incorrectly flagged**:

1. **2025-11-08** - N726SA - 2.7 hrs PIC+Dual (VALID for certificated pilot)
2. Other flights showing red validation errors for PIC+Dual combinations

These should show **green (valid)** or **blue (info)**, not **red (error)**.

### Testing Scenarios

#### Test Case 1: Certificated Pilot Flight Review
```
Input:
  - Certificate: Private Pilot
  - Total: 1.5
  - PIC: 1.5
  - Dual Received: 1.5
  - Instructor: John Doe, CFI

Expected: ✅ VALID
Actual: ❌ ERROR (incorrect)
```

#### Test Case 2: Student Pilot with Instructor
```
Input:
  - Certificate: Student Pilot
  - Total: 1.5
  - PIC: 0.0
  - Dual Received: 1.5
  - Instructor: John Doe, CFI

Expected: ✅ VALID
Actual: (need to verify)
```

#### Test Case 3: Student Pilot Incorrectly Logs PIC
```
Input:
  - Certificate: Student Pilot
  - Total: 1.5
  - PIC: 1.5
  - Dual Received: 1.5
  - Instructor: John Doe, CFI

Expected: ❌ ERROR (student cannot log PIC with instructor)
Actual: (need to verify)
```

#### Test Case 4: Solo PIC Flight (Certificated)
```
Input:
  - Certificate: Private Pilot
  - Total: 1.2
  - PIC: 1.2
  - Dual Received: 0.0
  - Instructor: (none)

Expected: ✅ VALID
Actual: ✅ VALID (probably correct)
```

### References

- **14 CFR § 61.51** - Pilot logbooks
- **FAA Advisory Circular 61-65H** - Certification: Pilots and Flight and Ground Instructors
- **FAA Legal Interpretation: Speranza (2009)** - Clarifies logging PIC while receiving dual

### Impact Assessment

**Severity: P1 (High)** because:
- Incorrectly flags **legal and valid flights** as errors
- Causes confusion about proper logging procedures
- Undermines trust in validation system
- Could lead pilots to incorrectly modify their logbooks
- Not P0 because data isn't corrupted, just incorrectly validated

**User Experience:**
- Certificated pilots see false error badges on valid flights
- May think they logged incorrectly when they didn't
- May incorrectly change logbook to avoid false errors

### Acceptance Criteria

- [ ] Add pilot certificate level to user profile
- [ ] Validation logic checks certificate level before flagging PIC+Dual
- [ ] Student pilots: PIC+Dual = ERROR ❌
- [ ] Certificated pilots: PIC+Dual = VALID ✅ (or INFO ℹ️)
- [ ] Flight 2025-11-08 shows no validation error
- [ ] Regression tests for all certificate levels
- [ ] Documentation updated with FAR 61.51 references

### Priority Justification

**P1 (High)** because:
- Affects multiple flights in production
- Misrepresents FAA regulations
- Causes user confusion about proper logging
- Not P0 because it's validation-only (doesn't corrupt data)
- Should be fixed soon to restore user confidence

## Close Reason

Respect student pilot flag when assigning dual-received roles
