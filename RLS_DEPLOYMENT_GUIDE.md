# RLS Deployment Guide - Option 2: Gradual Rollout
**Ready to Deploy:** October 31, 2025  
**Estimated Time:** 45 minutes  
**Risk Level:** LOW

---

## 🎯 What We're Deploying

### Security Architecture
```
┌──────────────────────────────────────────────────────┐
│         CURRENT STATE (Before RLS)                   │
├──────────────────────────────────────────────────────┤
│ Client → Direct Supabase (anon key) → Database      │
│ ❌ No security                                       │
│ ❌ Any user can access any data                     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│         AFTER RLS DEPLOYMENT (Hybrid Secure)         │
├──────────────────────────────────────────────────────┤
│ Client → Supabase (anon key) → RLS → Database       │
│ ✅ Row-level security enforced                      │
│ ✅ Users can only access their own data             │
│                                                       │
│ Server API ready (not yet enabled):                  │
│ Client → Server API → JWT → RLS → Database          │
│ ✅ Double security (JWT + RLS)                      │
└──────────────────────────────────────────────────────┘
```

### What Changes:
- **Database:** Protected by 56 RLS policies
- **Storage:** User-scoped folders (public/{userId}/)
- **App Behavior:** No change (USE_SERVER_API still false)
- **User Experience:** Identical

---

## 📋 Pre-Deployment Checklist

### Required:
- [ ] Access to Supabase Dashboard
- [ ] Project admin permissions
- [ ] ~30 minutes of time
- [ ] Backup plan ready (we'll test before enabling)

### Files Ready:
- ✅ `supabase_rls_policies.sql` - 56 policies ready
- ✅ Server running with secure endpoints
- ✅ Feature flag at false (safe hybrid state)

---

## 🚀 Deployment Steps

### Step 1: Access Supabase SQL Editor (2 minutes)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Deploy RLS Policies (10 minutes)

1. **Open the file:** `supabase_rls_policies.sql`
2. **Copy ALL content** (from line 1 to end)
3. **Paste into SQL Editor**
4. **Click "Run"** (green play button)

**Expected Output:**
```
Success. No rows returned
```

This is normal! The SQL creates policies, it doesn't return data.

### Step 3: Verify RLS is Enabled (5 minutes)

Run this verification query in SQL Editor:

```sql
-- Check that RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Result:**
All tables should show `rowsecurity = true`:
- ✅ feed_posts: true
- ✅ friends: true
- ✅ post_comments: true
- ✅ post_likes: true
- ✅ projects: true
- ✅ rooms: true
- ✅ tasks: true
- ✅ users: true

### Step 4: Verify Policy Count (2 minutes)

```sql
-- Count policies per table
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Expected Result:**
| Table | Policy Count |
|-------|--------------|
| feed_posts | 4 |
| friends | 3 |
| post_comments | 3 |
| post_likes | 3 |
| projects | 4 |
| rooms | 4 |
| tasks | 4 |
| users | 3 |

**Total: 28 table policies** (56 total with storage)

### Step 5: Test with Your Current App (15 minutes)

**Important:** Do NOT change `USE_SERVER_API` yet!

1. **Open your Renovatr app** in the browser
2. **Sign in** with your account
3. **Test these operations:**

**Project Operations:**
- [ ] Create a new project
- [ ] View your projects list
- [ ] Add a room to the project
- [ ] View project details

**Task Operations:**
- [ ] Create a new task
- [ ] View task list
- [ ] Update a task
- [ ] Mark task as complete

**Room Operations:**
- [ ] Add a room photo (upload image)
- [ ] View room photos
- [ ] Delete a room

**Security Test (CRITICAL):**
- [ ] Try to access another user's project URL directly
  - Should fail or show empty
- [ ] Verify you can ONLY see your own data

**Expected Behavior:**
✅ Everything should work EXACTLY as before  
✅ You can only access your own data  
✅ No errors in browser console  

**If you see errors:** DO NOT PROCEED - contact support

### Step 6: Monitor for Issues (10 minutes)

**Check Browser Console:**
```javascript
// Open DevTools (F12)
// Look for errors related to:
// - "permission denied"
// - "RLS policy"
// - Failed database queries
```

**Check Supabase Logs:**
1. Go to Supabase Dashboard
2. Click **Logs** → **Database**
3. Look for any RLS-related errors

**Expected:** No errors, all operations successful

---

## ✅ Success Criteria

RLS deployment is successful when:

- [x] All tables show `rowsecurity = true`
- [x] 28+ policies are active
- [x] App functions normally
- [x] You can only access your own data
- [x] No errors in console or logs
- [x] Security test passes (can't access other users' data)

---

## 🎉 Post-Deployment

### What Just Happened:
✅ **Database is now secure** - RLS policies enforced  
✅ **User data isolated** - Each user can only access their own data  
✅ **Storage secured** - Images in user-scoped folders  
✅ **Zero downtime** - App continues working normally  

### What's Next (Future Sessions):

**Option A: Enable Server API for Better Performance**
```typescript
// In src/services/projectService.ts
const USE_SERVER_API = true; // Enable secure server-side API
```
- 11 critical functions ready
- Better security (JWT + RLS)
- Improved performance

**Option B: Keep Current State**
- RLS provides excellent security
- No urgency to migrate to server API
- Can enable incrementally per function

### Monitoring Recommendations:
- Watch for performance changes
- Monitor database query times
- Check for any RLS policy violations in logs

---

## 🔴 Rollback Procedure (If Needed)

**IF** you encounter critical issues:

### Emergency Rollback (2 minutes)

Run this SQL to disable RLS:

```sql
-- EMERGENCY ONLY - Disables all security
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE friends DISABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes DISABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING:** This re-exposes all data. Only use in emergency.

### Investigate Issues:
1. Check Supabase logs for specific RLS errors
2. Review which operations are failing
3. Contact support with error details

### Re-Enable After Fix:
```sql
-- After identifying and fixing the issue
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- etc...
```

---

## 📊 Expected Performance Impact

### Database Query Performance:
- **Minimal impact** - RLS policies add ~1-5ms per query
- **Overall:** Imperceptible to users
- **Benefit:** Secure data isolation

### App Performance:
- **No change** in app speed
- **No change** in user experience
- **Improved:** Security posture

---

## 🎯 Summary

**What You're Deploying:**
- 56 RLS policies for complete data isolation
- User-scoped storage folders
- Secure hybrid architecture

**Time Required:**
- Deployment: 15 minutes
- Testing: 15 minutes
- Monitoring: 15 minutes
- **Total: ~45 minutes**

**Risk Level:** LOW
- Feature flag provides safety net
- Rollback is instant
- No code changes in app
- Database-level security

**Next Steps After This:**
1. Deploy RLS (this guide)
2. Monitor for 24-48 hours
3. (Optional) Enable server API gradually
4. (Optional) Migrate remaining functions

---

## 📞 Support

**If you encounter issues:**

1. **Check Logs:**
   - Browser DevTools Console (F12)
   - Supabase Dashboard → Logs

2. **Common Issues:**
   - "Permission denied" → RLS policy blocking legitimate access
   - "Policy not found" → Policy didn't deploy correctly
   - "Auth required" → User not properly authenticated

3. **Quick Fixes:**
   - Refresh browser (clear cache)
   - Sign out and sign in again
   - Check network requests in DevTools

---

**Ready to deploy?** Follow the steps above carefully and test thoroughly!
