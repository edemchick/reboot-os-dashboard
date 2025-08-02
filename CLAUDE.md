# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm run dev` (runs on http://localhost:3000)
- **Restart development server**: Stop with `Ctrl+C`, then `npm run dev`
- **Build production**: `npm run build` 
- **Start production server**: `npm start`
- **Lint code**: `npm run lint`

## Required Environment Variables

Create a `.env.local` file with:
- `NOTION_TOKEN`: Notion integration token (starts with `ntn_` or `secret_`)
- `NOTION_DATABASE_ID`: Notion database ID (default: `238ee4a677df80c18e68d094de3fd6d6`)
- `NOTION_LONGTERM_DATABASE_ID`: Long term goals database ID
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `NEXTAUTH_URL`: Base URL for authentication (e.g., `http://localhost:3000` for dev)
- `NEXTAUTH_SECRET`: Secret for NextAuth.js session encryption
- `SLACK_BOT_TOKEN`: Slack bot OAuth token (starts with `xoxb-`)
- `SLACK_CHANNEL_ID`: Slack channel name for posting summaries (e.g., `reboot_os`)
- `OPENAI_API_KEY`: OpenAI API key for goal grading functionality

## Project Architecture

This is a Next.js dashboard that displays quarterly goals from a Notion database for Reboot Motion team members.

### Authentication Flow
- Uses NextAuth.js with Google OAuth provider (`/pages/api/auth/[...nextauth].js`)
- Restricts access to `@rebootmotion.com` email addresses only
- Protected routes redirect unauthenticated users to `/login`
- Session management handled by NextAuth SessionProvider in `_app.js`

### Data Flow
1. **Notion Integration**: `/api/goals.js` fetches data from Notion database using Notion API
2. **Goal Processing**: Transforms Notion page properties into structured goal objects with user details
3. **Dashboard Display**: Main dashboard at `/pages/index.js` shows current quarter goals with progress tracking

### Custom Quarter Logic
- Non-standard quarter system: Jan 11 - Apr 10 (Q1), Apr 11 - Jul 10 (Q2), Jul 11 - Oct 10 (Q3), Oct 11 - Jan 10 (Q4)
- Goals are automatically filtered by current quarter
- At-risk calculation: goals >15 percentage points behind expected time-based progress
- Quarter progress calculated as percentage of time elapsed in current quarter

### Key Components
- **Dashboard (`/pages/index.js`)**: Main interface with goal cards, progress stats, quarter info, and at-risk indicators
- **Goals API (`/pages/api/goals.js`)**: Fetches and transforms Notion data, includes user detail resolution
- **Auth Config (`/pages/api/auth/[...nextauth].js`)**: NextAuth configuration with Google provider and email restrictions
- **Login Page (`/pages/login.js`)**: Custom login interface

### Styling and UI
- Uses Tailwind CSS for styling with custom color schemes for different focus areas
- Lucide React for icons (Target, TrendingUp, AlertCircle, etc.)
- Responsive design with grid layouts
- Progress bars with color coding based on completion percentage

### Slack Integration
- **Weekly Check-ins**: Send automated DMs to goal owners for progress updates
- **Interactive Forms**: Modal forms for collecting "what went well", "challenges", and progress estimates
- **Thread Responses**: Encourages users to respond in threads to keep multiple goals organized
- **Team Updates**: Posts progress summaries to #reboot_os channel
- **Progress Sync**: Automatically updates goal progress in Notion database from Slack responses

#### Slack Setup Requirements:
1. **Bot Token**: Add `SLACK_BOT_TOKEN` to environment variables
2. **Channel ID**: Add `SLACK_CHANNEL_ID` for team updates
3. **User ID Mapping**: Update the `lookupSlackUserId` function in `/api/slack/send-checkins.js` with actual Slack user IDs
4. **Interactive Endpoint**: Configure Slack app's interactivity URL to point to `/api/slack/interactive`

## Notion Database Schema

The dashboard expects these properties in the Notion database:
- `Project` (Title): Goal title
- `Quarter` (Select): Current quarter (Q1, Q2, Q3, Q4) - excludes "Non Priorities", "Not Prioritized", "Backlog"
- `Status` (Status/Select): Goal status (Achieved, In Progress, Carried Forward, At Risk)
- `Owner` (People): Goal owner - resolves user details via Notion Users API
- `Progress` (Number): Completion percentage (0-100)
- `Focus` (Multi-select): Focus areas with predefined color coding (MLB Teams, NBA Teams, Product, etc.)
- `Open KRs` (Rich text): Open key results
- `Completed KRs` (Rich text): Completed key results

## Deployment

Designed for Vercel deployment:
1. Connect GitHub repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy automatically on push to main branch
4. Dashboard will be live at assigned Vercel URL