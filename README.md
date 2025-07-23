# Reboot OS Dashboard

A Next.js dashboard for tracking Reboot Motion's quarterly goals and progress.

## Quick Setup

1. **Clone/Download** these files
2. **Install dependencies**: `npm install`
3. **Set up environment variables**:
   - Copy `.env.local` 
   - Add your Notion token: `NOTION_TOKEN=ntn_your_token_here`
4. **Run locally**: `npm run dev`
5. **Deploy to Vercel**: Connect GitHub repo to Vercel, add environment variables

## Environment Variables

- `NOTION_TOKEN`: Your Notion integration token (starts with `ntn_` or `secret_`)
- `NOTION_DATABASE_ID`: Your Goals Tracker database ID (already set)

## Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

Your dashboard will be live at `https://your-app.vercel.app`
