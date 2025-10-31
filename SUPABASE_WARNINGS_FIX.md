# Supabase Security & Performance Warnings - Fix Guide

## Overview
Supabase's automated linter has identified 2 security warnings and multiple performance warnings in your database. This guide provides fixes for all issues.

---

## 🔴 Security Warnings (2 Issues)

### 1. Function Search Path Mutable ⚠️ SECURITY

**Issue**: The `handle_new_user()` trigger function doesn't have an explicit `search_path` set, which could allow search path attacks.

**Impact**: Medium - Could allow malicious users to hijack function execution  
**Priority**: Should fix before launch

**Fix**: Add `SET search_path = public` to the function definition

```sql
-- Run this in Supabase SQL Editor
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url, email, preferences)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    '{}'::jsonb
  );
  RETURN new;
END;
$$;
```

**What it does**: Explicitly sets the search path to `public` schema, preventing search path hijacking attacks.

---

### 2. Leaked Password Protection Disabled ⚠️ SECURITY

**Issue**: Supabase Auth is not checking passwords against the HaveIBeenPwned database of compromised passwords.

**Impact**: Low - Users could use known compromised passwords  
**Priority**: Nice to have

**Fix**: Enable in Supabase Dashboard

1. Go to **Authentication → Policies** in your Supabase Dashboard
2. Find **"Password Strength"** section
3. Enable **"Check against HaveIBeenPwned"**
4. Save settings

**No code changes needed** - this is a simple toggle in the dashboard.

---

## ⚡ Performance Warnings (Multiple Issues)

### RLS Policy Optimization ⚠️ PERFORMANCE

**Issue**: All RLS policies call `auth.uid()` repeatedly for each row, which is inefficient for queries with many rows.

**Impact**: Medium - Queries slow down with large datasets (100+ rows)  
**Priority**: Post-launch optimization (not critical for MVP)

**Current Performance**: 
- Works fine for small datasets (< 100 rows per query)
- May slow down as your user base grows

**Why it's happening**: 
```sql
-- Current policy (called for EACH row)
CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);  -- auth.uid() called per row!
```

**Optimized version** (for later):
```sql
-- Drop old policy
DROP POLICY IF EXISTS "Users can view own projects" ON projects;

-- Create optimized policy with security definer function
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    (current_setting('request.jwt.claim.sub', true))::text
  )::uuid;
$$;

-- Create policy using the optimized function
CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
USING (auth.user_id() = user_id);
```

**⚠️ Important**: Don't apply these optimizations until after launch. The current policies work fine for your expected load, and optimization introduces complexity.

---

## 📊 Priority Summary

| Issue | Severity | Priority | Fix Time | When to Fix |
|-------|----------|----------|----------|-------------|
| Function search path | SECURITY | High | 2 min | Before launch |
| Password protection | SECURITY | Low | 1 min | Nice to have |
| RLS performance | PERFORMANCE | Low | 30 min | Post-launch |

---

## ✅ Recommended Action Plan

### Before Launch (Required)
1. ✅ **Fix function search path** (2 min)
   - Run the SQL command above
   - Verify in Supabase Dashboard → Database → Functions

### Before Launch (Optional)
2. ⚡ **Enable password protection** (1 min)
   - Toggle in Supabase Dashboard
   - Zero risk, good security practice

### After Launch (When You Have Traffic)
3. 📈 **Monitor RLS performance** 
   - Watch query times in Supabase Dashboard
   - If queries > 500ms, apply RLS optimizations
   - Not urgent for MVP with < 100 concurrent users

---

## 🎯 Current Status: Production-Ready

**Your database is secure enough for launch!** These warnings are:
- ✅ Standard for new Supabase projects
- ✅ Non-critical for MVP scale
- ✅ Easy to fix incrementally

**Why you're safe:**
1. RLS policies ARE active (all tables protected)
2. Server API uses service role key (bypasses RLS for performance)
3. Client-side queries protected by RLS (even with performance warnings)
4. Your expected traffic won't hit performance limits

---

## 📖 Additional Resources

- [Supabase RLS Performance Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Function Security Best Practices](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Auth Security Settings](https://supabase.com/docs/guides/auth/password-security)

---

## 🚀 Quick Fix Script

Run this in your **Supabase SQL Editor** to fix the critical security issue:

```sql
-- Fix 1: Secure handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url, email, preferences)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    '{}'::jsonb
  );
  RETURN new;
END;
$$;

-- Verify it worked
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as search_path_setting
FROM pg_proc 
WHERE proname = 'handle_new_user';
-- Should show: is_security_definer = true, search_path_setting = {search_path=public}
```

**Expected output**: Security definer = `true`, Search path = `{search_path=public}`

---

## Summary

**Critical**: Fix function search path (2 min SQL command)  
**Optional**: Enable password protection (1 min dashboard toggle)  
**Later**: RLS performance optimization (post-launch when needed)

Your app is **production-ready** with just the critical fix! 🚀
