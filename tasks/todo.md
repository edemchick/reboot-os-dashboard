# Task: Create CLAUDE.md File

## Problem Analysis
Create a comprehensive CLAUDE.md file to guide future Claude Code instances when working in this repository. The file should include development commands, architecture overview, and key information needed for productive development.

## Codebase Understanding
This is a Next.js dashboard for Reboot Motion that displays quarterly goals from Notion. Key components:
- NextAuth.js authentication with Google OAuth (restricted to @rebootmotion.com)
- Notion API integration for goal data
- Custom quarter system and at-risk calculations
- Tailwind CSS styling with Lucide React icons
- Vercel deployment ready

## Todo Items

### Phase 1: Information Gathering
- [x] Analyze package.json for available scripts and dependencies
- [x] Review README.md for existing documentation
- [x] Examine key configuration files (next.config.js, tailwind.config.js)
- [x] Understand authentication setup in [...nextauth].js
- [x] Review Notion API integration in goals.js
- [x] Analyze main dashboard functionality in index.js

### Phase 2: Plan Creation and Approval
- [x] Create this todo.md file with comprehensive plan
- [x] Get user approval for the plan before proceeding
- [x] Make any requested adjustments to the plan

### Phase 3: CLAUDE.md Creation
- [x] Document development commands (dev, build, start, lint)
- [x] List required environment variables with descriptions
- [x] Explain project architecture and data flow
- [x] Document authentication system and restrictions
- [x] Explain Notion database schema requirements
- [x] Add deployment instructions for Vercel
- [x] Include quarter logic and at-risk calculation details
- [x] Document key file locations and purposes

### Phase 4: Review and Finalization
- [x] Review CLAUDE.md for completeness and accuracy
- [x] Ensure all critical information is included
- [x] Verify formatting and readability
- [x] Add review section to this todo.md file

## Success Criteria
- CLAUDE.md contains all essential development information
- Future Claude Code instances can be productive quickly
- No critical setup or architecture details are missing
- File follows the required format with proper prefix

## Notes
- Keep all information concise and focused on what's needed for development
- Avoid generic development practices
- Include specific details unique to this codebase
- Focus on the "big picture" architecture that requires reading multiple files

## Review and Summary

### Changes Made
1. **Created CLAUDE.md** with comprehensive guidance for future Claude Code instances
2. **Documented all development commands** from package.json
3. **Listed all required environment variables** with clear descriptions
4. **Explained project architecture** including authentication flow, data flow, and custom quarter logic
5. **Documented Notion database schema** with all expected properties and their types
6. **Added deployment instructions** specific to Vercel
7. **Included key component locations** and their purposes

### Key Information Captured
- **Authentication**: NextAuth.js with Google OAuth restricted to @rebootmotion.com emails
- **Custom Quarter System**: Non-standard quarters (Jan 11 - Apr 10, etc.) with time-based at-risk calculation
- **Notion Integration**: Complete API flow with user detail resolution and property transformation
- **UI/UX Details**: Tailwind CSS styling, Lucide React icons, responsive design, color coding systems

### File Quality
- Follows required format with proper "# CLAUDE.md" prefix
- Concise and development-focused content
- No generic practices included
- All critical setup information included
- Clear section organization for quick reference

**Task Status: COMPLETED** ✅

The CLAUDE.md file now provides all essential information for future Claude Code instances to work productively in this repository without needing to discover architecture details through multiple file reads.