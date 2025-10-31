# Vercel Environment Variables Setup

## ⚠️ CRITICAL: Your Server is Crashing Due to Missing Environment Variables

The Vercel logs show:
```
ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
Node.js process exited with exit status: 1
```

## Quick Fix - Set These Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Click on your `renovatred` project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add These Variables

Add **all** of these environment variables:

```
GEMINI_API_KEY=your-gemini-api-key-here
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important Notes:**
- ✅ Set them for **Production**, **Preview**, and **Development** environments
- ✅ Make sure there are **no spaces** around the `=` sign
- ✅ **Copy the exact values** from your Supabase dashboard

### Step 3: Redeploy

After adding the variables:
1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Make sure "Use existing Build Cache" is **unchecked**

## Where to Find the Values

### Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Create or copy your API key

### Supabase Credentials
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep this secret!

## Verification

After redeploying, check the Vercel logs:
- Should **NOT** see "ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
- API requests should work (status 200, 400, 401 - but NOT 500 from startup)

## Troubleshooting

**Still getting 500 errors?**
1. Check Vercel logs for the actual error message
2. Verify all 4 environment variables are set correctly
3. Make sure you redeployed after adding variables
4. Check that variable names match exactly (case-sensitive)

**Getting 404 errors?**
- This means the serverless function isn't working
- Check that `api/index.js` exists
- Check that `serverless-http` is installed: `npm install serverless-http`

