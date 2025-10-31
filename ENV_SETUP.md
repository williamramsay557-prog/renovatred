# Environment Variables Setup Guide

This document describes all required and optional environment variables for Renovatr.

## Required Environment Variables

### 1. Google Gemini API Key
```bash
GEMINI_API_KEY=your-gemini-api-key-here
```
**Where to get it:** https://aistudio.google.com/app/apikey
**Used for:** All AI-powered features (task planning, chat, summaries)

### 2. Supabase Configuration

#### Frontend (Client-Side)
```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
**Where to find:** Supabase Dashboard > Project Settings > API
**Note:** These are safe to expose in client-side code

#### Backend (Server-Side Only)
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
**Where to find:** Supabase Dashboard > Project Settings > API > service_role key
**⚠️ SECURITY WARNING:** This key bypasses Row Level Security. Never expose it to client-side code!

## Optional Environment Variables

### Production Configuration
```bash
# Comma-separated list of allowed origins for CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Node environment
NODE_ENV=production
```

## Setup Instructions

### Local Development
1. Create a `.env` file in the root directory
2. Copy the variables above and fill in your actual values
3. For Vite to access variables, they must be prefixed with `VITE_`

### Production Deployment
Set these as environment variables in your hosting platform:
- **Vercel:** Project Settings > Environment Variables
- **Replit:** Secrets tab
- **Heroku:** Config Vars
- **Other:** Platform-specific environment variable configuration

## Verifying Setup

The application will validate required environment variables at startup:
- Server will exit with an error if `GEMINI_API_KEY` is missing
- Server will exit with an error if Supabase credentials are missing
- Client will throw an error if Supabase URL/anon key are missing

## Security Best Practices

1. ✅ Never commit `.env` files to version control (already in `.gitignore`)
2. ✅ Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code
3. ✅ Use different Supabase projects for development and production
4. ✅ Rotate API keys if they're ever exposed
5. ✅ Use environment-specific configurations (dev/staging/prod)

