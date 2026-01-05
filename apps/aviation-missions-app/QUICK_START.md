# Quick Start Guide - Admin System

## Default Admin Credentials

**Email:** `admin@aviation-missions.app`  
**Password:** Set on first login (use any password initially, you'll be prompted to create a new one)

## Starting the Application

```bash
# Build and start the application
make build
make start

# View logs
make logs

# Stop the application
make stop
```

## First-Time Setup

1. **Start the Application**
   ```bash
   make start
   ```

2. **Access the Application**
   - Open browser to: `http://localhost:8080`
   - You'll see the aviation missions grid

3. **Admin Login (First Time)**
   - Click the "🔐 Admin Login" button in the top-right
   - Enter email: `admin@aviation-missions.app`
   - Enter any password (will be rejected but triggers first-login flow)
   - System will prompt you to set a new password
   - Set a secure password (minimum 8 characters)
   - Click "Set Password"
   - You'll be automatically logged in and see the Admin Dashboard

4. **Admin Dashboard Features**
   - **Pending Mission Submissions**: Review and approve/reject user-submitted missions
   - **Admin Users**: Manage admin accounts (add/delete)

## Admin Tasks

### View Pending Submissions
1. Log in as admin
2. Dashboard shows all pending mission submissions
3. Review mission details
4. Click "Approve" to publish or "Reject" to decline

### Add New Admin
1. Log in as admin
2. In "Admin Users" section, click "Add Admin"
3. Enter name and email
4. Click "Add Admin"
5. New admin will set their password on first login

### Delete Admin
1. Log in as admin
2. In "Admin Users" section, find the admin to delete
3. Click "Delete" button
4. Confirm deletion
5. Note: Cannot delete the last admin

## Guest User Features (No Login Required)

- **Browse Missions**: View all approved missions
- **Filter Missions**: By category, difficulty, experience level
- **Search Missions**: Full-text search across missions
- **Rate Missions**: Thumbs up/down
- **Comment**: Add comments to missions
- **Submit Missions**: Submit new missions for admin approval (hidden until approved)

## Testing the Workflow

### Test Mission Submission & Approval

1. **As Guest**: Submit a test mission
   - Click "✈️" FAB button (bottom right)
   - Fill in mission details
   - Submit (mission is now pending)
   
2. **As Admin**: Approve the mission
   - Log in as admin
   - See the submission in dashboard
   - Click "Approve"
   - Mission now visible to all users

3. **As Guest**: View the approved mission
   - Return to missions view
   - See the newly approved mission in the grid

## File Locations

- **Admin Data**: `./data/admins.json` (backup this file!)
- **Database**: `./data/aviation-missions.mv.db`
- **Logs**: Use `make logs` to view application logs

## Security Notes

1. **Change Default Admin Email**: Edit `data/admins.json` before production deployment
2. **Backup**: Regularly backup `data/admins.json` and database files
3. **HTTPS**: Use HTTPS in production (passwords sent over network)
4. **File Permissions**: Ensure `data/admins.json` has restricted permissions (chmod 600)

## Troubleshooting

### "Admin Login" button not appearing
- Check browser console for JavaScript errors
- Ensure `admin-styles.css` is loaded
- Clear browser cache and reload

### Can't log in as admin
- Check `data/admins.json` file exists
- Verify backend logs: `make logs`
- Try first-time login flow with default email

### Submissions not showing in dashboard
- Verify you're logged in as admin (check token in localStorage)
- Check backend logs for API errors
- Ensure database is accessible

### Session expired
- Log out and log back in
- Sessions last 8 hours by default

## API Endpoints

### Public Endpoints
- `GET /api/missions` - List all missions
- `POST /api/submissions` - Submit mission for approval (no auth required)
- `POST /api/missions/:id/comments` - Add comment
- `POST /api/missions/:id/rating` - Rate mission

### Admin Endpoints (Require Authentication)
- `POST /api/admin/login` - Admin login
- `POST /api/admin/setup-password` - First-time password setup
- `GET /api/admin/status` - Check admin session
- `GET /api/admin/users` - List admin users
- `POST /api/admin/users` - Create admin user
- `DELETE /api/admin/users/:email` - Delete admin user
- `GET /api/submissions` - List pending submissions
- `PUT /api/submissions/:id/approve` - Approve submission
- `PUT /api/submissions/:id/reject` - Reject submission

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Aviation Missions App                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (Pure JavaScript)                                 │
│  ├── Public View (No Auth)                                  │
│  │   ├── Mission Grid                                       │
│  │   ├── Search & Filters                                   │
│  │   ├── Rate & Comment                                     │
│  │   └── Submit Mission                                     │
│  │                                                           │
│  └── Admin View (Auth Required)                             │
│      ├── Login Modal                                        │
│      ├── Admin Dashboard                                     │
│      │   ├── Pending Submissions                            │
│      │   └── Admin Management                               │
│      └── Session Management                                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Backend (Clojure)                                          │
│  ├── Public API                                             │
│  │   ├── Mission CRUD                                       │
│  │   ├── Comments & Ratings                                 │
│  │   └── Guest Submissions                                  │
│  │                                                           │
│  ├── Admin API (Protected)                                  │
│  │   ├── Authentication                                     │
│  │   ├── Submission Approval                                │
│  │   └── Admin Management                                   │
│  │                                                           │
│  └── Storage                                                │
│      ├── H2 Database (missions, submissions)                │
│      └── JSON File (admins)                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

1. Start the application: `make start`
2. Set up your admin password
3. Explore the admin dashboard
4. Test the mission approval workflow
5. Add additional admin users as needed
6. Customize the admin list in `data/admins.json`

## Support

For issues or questions, check:
- `IMPLEMENTATION.md` - Detailed technical documentation
- `MEMORY.md` - Project context and history
- Backend logs: `make logs`
- Browser console: F12 Developer Tools
