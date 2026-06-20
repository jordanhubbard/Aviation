---
id: Aviation-yb6
status: closed
deps: []
links: []
created: 2026-01-17T22:28:18.961354-08:00
type: feature
priority: 1
mac-task-id: task_80843cd16a8c417584024f5044c59d64
---
# Allow users to suggest edits to mission fields for admin review

## Feature Request: Mission Edit Suggestions

**Application:** aviation-missions-app  
**Priority:** P1 - Important Enhancement  
**Category:** Community Moderation

### Feature Overview
Enable users to suggest edits to any field in a mission card, which are then submitted to admins for review and approval before being applied to the live mission.

### User Story
As a pilot using the aviation missions app, I want to suggest corrections or improvements to mission details (route, objectives, descriptions, challenges, notes) so that the community can help maintain accurate and high-quality mission content.

### Current Behavior
- Mission cards are static and read-only for regular users
- Only admins can edit mission content
- No way for users to contribute corrections or improvements
- Community knowledge cannot be leveraged

### Proposed Behavior
Add an "Suggest Edit" button or icon to each mission card that:
1. Opens a modal/form with all mission fields pre-populated
2. Allows users to edit any field they want to improve
3. Shows a diff/comparison of changes
4. Submits the suggestion to an admin moderation queue
5. Sends notification to admins for review

### Fields That Should Be Editable
- **Title** - Mission name
- **Route** - Flight path description
- **Objective** - Mission goals
- **Description** - Detailed mission information
- **Flight Challenges** - Specific challenges pilots should expect
- **Notes** - Additional tips and guidance
- **Category** - Mission type classification
- **Difficulty** - Easy/Medium/Hard rating
- **Min Experience** - Student/Private/Commercial requirement

### Admin Review Workflow
1. User submits edit suggestion
2. Suggestion appears in admin dashboard with:
   - Original content vs. proposed changes (diff view)
   - User who suggested the edit
   - Timestamp
   - Accept/Reject/Request Changes buttons
3. Admin can:
   - **Accept**: Apply changes immediately to mission
   - **Reject**: Dismiss with optional reason
   - **Request Changes**: Ask user for clarification
4. User receives notification of admin decision

### Technical Implementation Suggestions

**Frontend (JavaScript):**
- Add "✏️ Suggest Edit" button to each mission card
- Create edit modal with form fields
- Show diff view before submission
- API call to submit suggestion

**Backend (Clojure):**
- New endpoint: 
- Store suggestions in database table:
  
- Admin endpoints:
  -  - List pending suggestions
  - 
  - 

**Database Schema:**


### Benefits
- **Improved Content Quality**: Community can help fix errors
- **Reduced Admin Burden**: Users do the initial work
- **Engagement**: Users feel invested in the platform
- **Accuracy**: Pilots with local knowledge can contribute
- **Scalability**: Content maintenance becomes collaborative

### Edge Cases to Handle
- Multiple suggestions for same mission
- Conflicting suggestions
- Spam/abuse prevention (rate limiting)
- Edit history tracking
- Notification preferences for admins

### Acceptance Criteria
- [ ] "Suggest Edit" button visible on all mission cards
- [ ] Modal form allows editing all mission fields
- [ ] Changes are highlighted with diff view
- [ ] Submission creates record in database
- [ ] Admin dashboard shows pending suggestions
- [ ] Admins can approve/reject with one click
- [ ] User receives notification of decision
- [ ] Approved edits update mission immediately
- [ ] Edit history is logged for audit trail

### Related Issues
- Depends on fixing: Aviation-emx (buttons need to work first)
- Could integrate with comments system for discussion

### Future Enhancements
- Reputation system for trusted contributors
- Auto-approve edits from verified CFIs
- Public edit history visible to all users
- Collaborative editing with multiple reviewers

## Close Reason

Add mission edit suggestion queue with admin review
