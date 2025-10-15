# Admin Panel Guide - Petualangan Puncak TUNA

## Overview
The admin panel provides comprehensive monitoring and analytics for the Tuna Adventure Game. Administrators can view participant data, analyze team performance, and export results.

## Access
- **URL**: `http://localhost:3000/admin`
- **Username**: `admin`
- **Password**: `tuna_admin_2024`

## Features

### 1. Overview Dashboard
- **Total Teams**: Number of registered teams
- **Active Teams**: Teams currently playing
- **Completed Teams**: Teams that finished all scenarios
- **Average Score**: Overall performance metric
- **Scenario Completion Rates**: Success rates for each scenario

### 2. Teams Management
- View all participating teams
- Search teams by name
- Filter by status (All, Active, Completed, Inactive)
- View detailed team information including:
  - Team members
  - Current position
  - Total score
  - All decisions made
  - Standard answers for comparison

### 3. Scenario Analysis
- Performance analysis for each of the 7 scenarios
- View all team decisions for specific scenarios
- Compare team answers with standard answers
- Analyze scoring patterns

### 4. Leaderboard
- Real-time team rankings
- Filter by completion status
- View detailed performance metrics
- Track team progress over time

### 5. Analytics
- Score distribution charts
- Completion timeline
- Performance insights
- Statistical analysis

### 6. Data Export
- Export team data to CSV
- Export decision data to CSV
- Download comprehensive reports

## API Endpoints

### Authentication
- `POST /api/admin/login` - Admin login

### Data Retrieval
- `GET /api/admin/teams` - Get all teams
- `GET /api/admin/teams/:id` - Get specific team details
- `GET /api/admin/scenarios/:position/decisions` - Get decisions for a scenario
- `GET /api/admin/leaderboard` - Get leaderboard data
- `GET /api/admin/stats` - Get game statistics

### Data Export
- `GET /api/admin/export/teams` - Export teams data
- `GET /api/admin/export/decisions` - Export decisions data

## Security Features
- JWT-based authentication
- Admin-only access tokens
- Rate limiting on all endpoints
- Session management
- Secure credential validation

## Usage Instructions

### 1. Accessing the Admin Panel
1. Navigate to `http://localhost:3000/admin`
2. Enter admin credentials
3. Click "Login to Admin Panel"

### 2. Viewing Team Data
1. Go to "Teams" section
2. Use search and filters to find specific teams
3. Click "View" button to see detailed team information
4. Review team decisions and scores

### 3. Analyzing Scenarios
1. Go to "Scenarios" section
2. View completion rates and average scores
3. Click "View Decisions" to see all team responses
4. Compare team answers with standard answers

### 4. Monitoring Progress
1. Use "Overview" for quick statistics
2. Check "Leaderboard" for current rankings
3. Monitor "Analytics" for detailed insights

### 5. Exporting Data
1. Click "Export Data" button
2. Download CSV files with team and decision data
3. Use data for further analysis or reporting

## Data Structure

### Team Information
- Team ID and name
- Player list
- Current position (1-7)
- Total score
- Registration date
- Last activity

### Decision Data
- Team decision text
- Team reasoning
- Score received
- Standard answer
- Standard reasoning
- Submission timestamp

### Scenario Data
- Scenario title and description
- Completion count
- Average score
- Maximum score
- Minimum score

## Troubleshooting

### Common Issues
1. **Login Failed**: Check credentials and ensure server is running
2. **Data Not Loading**: Refresh the page or check server logs
3. **Export Issues**: Ensure proper permissions and server connectivity

### Error Messages
- "Access denied": Invalid or expired token
- "Too many requests": Rate limit exceeded
- "Internal server error": Check server logs for details

## Security Notes
- Change default admin credentials in production
- Use environment variables for sensitive data
- Implement proper admin user management
- Regular security audits recommended

## Technical Details
- Built with Express.js backend
- React-like vanilla JavaScript frontend
- MySQL database integration
- JWT authentication
- Responsive design
- Real-time data updates

## Support
For technical support or feature requests, contact the development team.
