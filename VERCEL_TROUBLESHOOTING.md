# Vercel Timeout Troubleshooting Guide

## Issue: 504 Gateway Timeout on `/api/projects`

The endpoint times out after 30 seconds even with auth bypassed, indicating the issue is with Supabase database queries, not authentication.

## Since it worked on Replit but not Vercel:

### 1. Check Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Required Variables:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (NOT anon key)
- `GEMINI_API_KEY` - For AI features

**Important:** 
- Make sure these are set for **Production** environment
- The service role key should start with `eyJ...` (JWT format)
- Double-check there are no extra spaces or quotes

### 2. Verify Supabase Connection

The Supabase client might be hanging on connection. Check:

1. **Supabase Dashboard** → Settings → API
   - Verify your project URL is correct
   - Verify service role key matches what's in Vercel

2. **Network Connectivity**
   - Vercel serverless functions might have different network paths
   - Check if Supabase has IP restrictions that might block Vercel

3. **Database Connection Pooling**
   - Supabase might need connection pooling enabled for serverless
   - Check Supabase Dashboard → Database → Connection Pooling

### 3. Test Direct Supabase Connection

Create a simple test endpoint to verify Supabase works:

```javascript
app.get('/api/test-supabase', async (req, res) => {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client.from('projects').select('id').limit(1);
        res.json({ success: true, data, error });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
```

### 4. Check Vercel Logs

Look for these log messages in Vercel:
- `=== Lazy initializing Supabase client ===`
- `=== Supabase client initialized successfully ===`
- `[GET /api/projects] Starting projects query...`

If you don't see these, the function isn't reaching the query.

### 5. Possible Solutions

**Option A: Use Supabase Connection Pooler**
If your Supabase project has connection pooling enabled, use the pooler URL:
- Instead of: `https://xxxxx.supabase.co`
- Use: `https://xxxxx.pooler.supabase.com:6543`

**Option B: Check RLS Policies**
Even with service role key, verify RLS policies aren't blocking:
- Service role key should bypass RLS, but verify in Supabase Dashboard

**Option C: Increase Timeout**
Vercel Pro plan allows 30s, but you can try:
- Check if queries are actually slow (check Supabase Dashboard → Database → Query Performance)
- Consider using Supabase Edge Functions instead

### 6. Quick Diagnostic Test

After deploying, test these endpoints in order:

1. `/api/test` - Should work (minimal endpoint)
2. `/api/test-express` - Should work (Express route)
3. `/api/test-supabase` - Tests Supabase connection
4. `/api/projects` - The failing endpoint

This will help identify where the issue occurs.

