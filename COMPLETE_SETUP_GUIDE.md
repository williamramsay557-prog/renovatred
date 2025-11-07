# Complete Setup Guide: Vercel + Supabase

This guide walks you through setting up both Vercel and Supabase for your Renovatr application.

---

## Part 1: Supabase Setup

### Step 1: Get Your Supabase Credentials

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Sign in to your account

2. **Select Your Project**
   - Click on your project (or create a new one if needed)

3. **Get Your API Credentials**
   - Click on **Settings** (gear icon) in the left sidebar
   - Click on **API** in the settings menu

4. **Copy These Values:**
   
   **Project URL:**
   - Look for "Project URL" section
   - Copy the URL (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - This is your `VITE_SUPABASE_URL`
   
   **API Keys:**
   - Find the "Project API keys" section
   - You'll see two keys:
     - **`anon` `public`** key - This is your `VITE_SUPABASE_ANON_KEY` (for frontend)
     - **`service_role` `secret`** key - This is your `SUPABASE_SERVICE_ROLE_KEY` (for backend)
   
   ⚠️ **IMPORTANT:** 
   - The `service_role` key is SECRET - never expose it in client-side code
   - It bypasses Row Level Security (RLS)
   - Keep it secure!

5. **Verify Your Database Schema**
   - Go to **Table Editor** in the left sidebar
   - Verify you have these tables:
     - `users`
     - `projects`
     - `rooms`
     - `tasks`
     - `feed_posts`
     - `friends`
     - `post_comments`
     - `post_likes`
   
   If tables are missing, you may need to run migrations or create them.

6. **Check Row Level Security (RLS)**
   - Go to **Authentication** → **Policies**
   - Verify RLS is enabled on your tables
   - The service role key bypasses RLS, so this is fine

---

## Part 2: Vercel Setup

### Step 1: Access Your Vercel Project

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Sign in to your account

2. **Select Your Project**
   - Click on `renovatred` (or your project name)

### Step 2: Set Environment Variables

1. **Navigate to Settings**
   - Click on **Settings** tab at the top
   - Click on **Environment Variables** in the left sidebar

2. **Add Environment Variables**
   
   Click **Add New** for each of these:

   **Variable 1: VITE_SUPABASE_URL**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** Your Supabase Project URL (from Part 1, Step 4)
     - Example: `https://xxxxxxxxxxxxx.supabase.co`
   - **Environment:** Select all three:
     - ☑ Production
     - ☑ Preview  
     - ☑ Development
   - Click **Save**

   **Variable 2: SUPABASE_URL** (Backup - in case VITE_ prefix doesn't work)
   - **Key:** `SUPABASE_URL`
   - **Value:** Same as VITE_SUPABASE_URL
     - Example: `https://xxxxxxxxxxxxx.supabase.co`
   - **Environment:** Select all three
   - Click **Save**

   **Variable 3: VITE_SUPABASE_ANON_KEY**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Your Supabase `anon` `public` key (from Part 1, Step 4)
     - This is a long string starting with `eyJ...`
   - **Environment:** Select all three
   - Click **Save**

   **Variable 4: SUPABASE_SERVICE_ROLE_KEY** ⚠️ CRITICAL
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Your Supabase `service_role` `secret` key (from Part 1, Step 4)
     - This is a long string starting with `eyJ...`
     - ⚠️ This is different from the anon key!
   - **Environment:** Select all three
   - Click **Save**

   **Variable 5: GEMINI_API_KEY**
   - **Key:** `GEMINI_API_KEY`
   - **Value:** Your Google Gemini API key
     - Get it from: https://aistudio.google.com/app/apikey
   - **Environment:** Select all three
   - Click **Save**

   **Variable 6: NODE_ENV** (Optional but recommended)
   - **Key:** `NODE_ENV`
   - **Value:** `production`
   - **Environment:** Production only
   - Click **Save**

### Step 3: Verify Environment Variables

After adding all variables, you should see a list like this:

```
✅ VITE_SUPABASE_URL          [Production, Preview, Development]
✅ SUPABASE_URL                [Production, Preview, Development]
✅ VITE_SUPABASE_ANON_KEY      [Production, Preview, Development]
✅ SUPABASE_SERVICE_ROLE_KEY   [Production, Preview, Development]
✅ GEMINI_API_KEY              [Production, Preview, Development]
✅ NODE_ENV                    [Production]
```

### Step 4: Redeploy Your Application

**IMPORTANT:** Environment variables only take effect after redeployment!

1. **Go to Deployments Tab**
   - Click on **Deployments** at the top
   - Find your latest deployment

2. **Redeploy**
   - Click the **three dots (⋯)** on the latest deployment
   - Click **Redeploy**
   - **IMPORTANT:** Uncheck "Use existing Build Cache"
   - Click **Redeploy**

3. **Wait for Deployment**
   - Wait for the deployment to complete (usually 1-2 minutes)
   - Check the build logs for any errors

---

## Part 3: Verification

### Step 1: Test the Endpoints

After redeployment, test these endpoints in order:

1. **Minimal Test** (Should work immediately)
   ```
   https://renovatred.vercel.app/api/test
   ```
   Expected: `{"message":"Minimal serverless function works!",...}`

2. **Express Test** (Tests Express app)
   ```
   https://renovatred.vercel.app/api/test-express
   ```
   Expected: `{"message":"Express app is working!",...}`

3. **Supabase Test** (Tests database connection)
   ```
   https://renovatred.vercel.app/api/test-supabase
   ```
   Expected: `{"success":true,"queryTime":"...ms",...}`
   
   ⚠️ If this times out, check Vercel logs for:
   - `[TEST] Step 1: Getting Supabase client...`
   - `[TEST] Step 2: Supabase client obtained successfully`
   - If it stops at Step 1, environment variables are missing
   - If it stops at Step 5, the query is hanging

4. **Projects Endpoint** (Requires authentication)
   ```
   https://renovatred.vercel.app/api/projects
   ```
   This requires a valid auth token, so test from your app.

### Step 2: Check Vercel Logs

1. **Go to Vercel Dashboard** → Your Project
2. **Click on "Logs" tab**
3. **Make a request** to `/api/test-supabase`
4. **Look for these log messages:**
   - `=== Lazy initializing Supabase client ===`
   - `Supabase URL: https://...`
   - `Service Key present: true`
   - `=== Supabase client initialized successfully ===`
   - `[TEST] Step 1: Getting Supabase client...`
   - `[TEST] Step 2: Supabase client obtained successfully`
   - `[TEST] Step 5: Racing query against timeout...`

### Step 3: Common Issues

**Issue: "MISSING SUPABASE CREDENTIALS" in logs**
- **Solution:** Environment variables aren't set or aren't visible to serverless functions
- **Fix:** 
  1. Double-check variable names (case-sensitive!)
  2. Make sure they're set for Production environment
  3. Redeploy after adding variables

**Issue: Query times out at Step 5**
- **Solution:** Supabase connection is hanging
- **Possible causes:**
  1. Wrong Supabase URL
  2. Wrong service role key
  3. Network connectivity issue
  4. Supabase project paused or deleted

**Issue: "Auth verification timeout"**
- **Solution:** `auth.getUser()` is hanging
- **Possible causes:**
  1. Wrong Supabase URL
  2. Network issue between Vercel and Supabase
  3. Supabase auth service is slow

---

## Part 4: Supabase Connection Pooling (Optional but Recommended)

For better performance with serverless functions:

1. **Go to Supabase Dashboard** → Your Project
2. **Click on Settings** → **Database**
3. **Find "Connection Pooling"** section
4. **Enable Connection Pooling** (if available)
5. **Note the Pooler URL** (if different from main URL)
   - If you get a pooler URL, you can use it instead of the main URL
   - Format: `https://xxxxx.pooler.supabase.com:6543`

---

## Quick Checklist

Before testing, verify:

- [ ] Supabase project is active (not paused)
- [ ] All tables exist in Supabase (users, projects, rooms, tasks, etc.)
- [ ] `VITE_SUPABASE_URL` is set in Vercel
- [ ] `SUPABASE_URL` is set in Vercel (backup)
- [ ] `VITE_SUPABASE_ANON_KEY` is set in Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (⚠️ service_role, not anon!)
- [ ] `GEMINI_API_KEY` is set in Vercel
- [ ] All variables are set for Production environment
- [ ] You've redeployed after adding variables
- [ ] Build cache was cleared during redeploy

---

## Still Having Issues?

If `/api/test-supabase` still times out:

1. **Check Vercel Logs** - Look for the step-by-step `[TEST]` messages
2. **Verify Supabase Project** - Make sure it's not paused
3. **Test Supabase Directly** - Try querying from Supabase Dashboard → SQL Editor
4. **Check Network** - Vercel might have network restrictions

Share the Vercel logs from `/api/test-supabase` and I can help diagnose further!

