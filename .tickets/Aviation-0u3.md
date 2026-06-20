---
id: Aviation-0u3
status: closed
deps: []
links: []
created: 2026-01-17T22:30:44.443977-08:00
type: bug
priority: 1
mac-task-id: task_9520205da04a4a10a6f0e8556d9ebb81
---
# Create Mission button fails - implement admin submission queue

## Bug Report: Create Mission Fails Without Submitting to Admin Queue

**Application:** aviation-missions-app  
**Priority:** P1 - High (Production Feature Broken)  
**Environment:** Production (aviation-missions-production.up.railway.app)

### Current Behavior
When a user fills out the "Create Mission" form and clicks the "CREATE MISSION" button, the operation fails with a generic error dialog:

```
Failed to create mission: Failed to create mission:
```

**Screenshot Evidence:** User encountered this error in production when attempting to create a mission from KPAO to KSFO with waypoints and additional information filled out.

### Expected Behavior
When a user submits the "Create Mission" form:
1. Validate all required fields (route, objectives, description, etc.)
2. Submit the mission to an **admin review queue** (not directly publish)
3. Show success message: "Mission submitted for admin review"
4. Send notification to admins
5. Clear the form or redirect user to their submissions page
6. Store submission in database with status='pending'

### Form Fields Involved
The Create Mission form includes:
- **Route** - Departure/Arrival airports (e.g., KPAO -> KSFO)
- **Suggested Waypoints** - ICAO codes separated by spaces
- **Difficulty** - Dropdown selection
- **Pilot Experience** - Minimum experience level
- **Special Challenges** - Text description
- **Notes & Tips** - Additional guidance for pilots

### Root Cause Analysis Needed
Investigate why the submission fails:
1. **Backend endpoint missing?** - Check if `POST /api/missions` exists
2. **Validation errors?** - Are required fields not being sent?
3. **Database constraints?** - Schema issues preventing insert?
4. **Authentication required?** - Does it need admin-only access?
5. **Error handling broken?** - Generic error suggests poor error propagation

### Technical Implementation

#### Backend (Clojure)
Create or fix the mission submission endpoint:

```clojure
(POST "/api/missions" request
  (let [mission-data (get-in request [:body])
        user-email (get-session-user request)]
    (try
      (db/create-mission-submission
        (assoc mission-data
          :submitted_by user-email
          :status "pending"
          :submitted_at (now)))
      {:status 201
       :body {:success true
              :message "Mission submitted for admin review"}}
      (catch Exception e
        (log/error e "Failed to create mission")
        {:status 400
         :body {:success false
                :error (.getMessage e)}}))))
```

#### Database Schema
Ensure missions table supports pending submissions:

```sql
CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  route TEXT NOT NULL,
  waypoints TEXT,
  objective TEXT,
  description TEXT,
  challenges TEXT,
  notes TEXT,
  difficulty TEXT,
  min_experience TEXT,
  category TEXT,
  status TEXT DEFAULT 'pending', -- pending/approved/rejected
  submitted_by TEXT,
  submitted_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_at TEXT
);
```

#### Frontend (JavaScript)
Fix the form submission handler:

```javascript
async function handleCreateMission(formData) {
  try {
    const response = await fetch('/api/missions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create mission');
    }
    
    // Success!
    showSuccessDialog('Mission submitted for admin review');
    clearForm();
    
  } catch (error) {
    console.error('Create mission error:', error);
    showErrorDialog(`Failed to create mission: ${error.message}`);
  }
}
```

### Admin Workflow Integration
This should integrate with the admin dashboard:
1. New missions appear in "Pending Review" queue
2. Admins can preview the mission
3. Approve button publishes the mission (sets status='approved', published_at=now)
4. Reject button dismisses with optional feedback
5. Edit button allows admin to modify before publishing

### Validation Requirements
Before submission, validate:
- [ ] Route has valid format (ICAO -> ICAO)
- [ ] At least one of: objectives, description, or challenges is filled
- [ ] Difficulty is selected
- [ ] Experience level is selected
- [ ] Waypoints are valid ICAO codes (if provided)
- [ ] User is authenticated (has session)

### Error Messages
Provide specific error messages instead of generic failure:
- "Route is required (format: KPAO -> KSFO)"
- "Please provide at least mission objectives or description"
- "Invalid waypoint code: XYZ (must be 4-letter ICAO codes)"
- "You must be logged in to submit missions"

### Testing Checklist
- [ ] Form validation works for all required fields
- [ ] Successful submission creates pending mission in database
- [ ] Error messages are specific and helpful
- [ ] Admin dashboard shows pending missions
- [ ] Admins can approve/reject submissions
- [ ] Form clears after successful submission
- [ ] User receives confirmation message

### Related Issues
- Related to: Aviation-yb6 (edit suggestions) - similar moderation workflow
- Blocks: Community mission contributions
- Impacts: User engagement and content growth

### Priority Justification
**P1 (High)** because:
- Breaks a key user-facing feature (mission creation)
- Prevents community contributions
- Generic error provides no guidance to users
- Affects production environment
- Not P0 because existing missions still work for viewing

### Acceptance Criteria
- [ ] Create Mission form successfully submits to backend
- [ ] Submission creates record with status='pending'
- [ ] User sees success message after submission
- [ ] Admin dashboard shows pending missions
- [ ] Specific validation errors guide users
- [ ] No more generic "Failed to create mission" errors

## Close Reason

Route mission submissions through admin review
