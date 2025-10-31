# Vercel Deployment Guide

Your app is deployed on Vercel, but the backend API routes aren't working because Express needs to be configured as serverless functions.

## Quick Fix

I've set up the configuration, but you need to:

1. **Install the serverless dependency:**
   ```bash
   npm install serverless-http
   ```

2. **Commit and push the changes:**
   ```bash
   git add .
   git commit -m "Configure Vercel serverless functions for API"
   git push
   ```

3. **Set environment variables in Vercel:**
   - Go to your Vercel project dashboard
   - Settings → Environment Variables
   - Add all required variables:
     - `GEMINI_API_KEY`
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NODE_ENV=production`

4. **Redeploy** - Vercel should auto-deploy after you push

## Alternative: Separate Backend Hosting

If serverless functions don't work well (cold starts, timeout issues), consider:

### Option A: Deploy Backend to Railway/Render
- Deploy `server.js` to Railway (railway.app) or Render (render.com)
- Update `API_BASE_URL` in `apiClient.ts` to point to your backend URL
- Update CORS settings in `server.js` to allow your Vercel domain

### Option B: Use Vercel Edge Functions
- Convert API routes to Vercel Edge Functions
- More complex but better performance

## Current Setup

- ✅ Created `api/index.js` - Serverless function wrapper
- ✅ Updated `server.js` - Exports app for serverless
- ✅ Updated `vercel.json` - Routes API requests to serverless function

## Testing Locally

To test the serverless function locally:
```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev
```

This will simulate the Vercel environment and test the serverless functions.

