# Renovatr Phase 2 Deployment Checklist
**Current Status:** 70% Complete - **NOT READY FOR PRODUCTION**  
**Updated:** October 31, 2025

---

## ⚠️ CRITICAL: Architect Review Findings

### 🔴 Blocking Issues (Must Fix Before Deploy)

#### 1. RLS Policies Not Deployed
**Status:** SQL created but not run in Supabase  
**Impact:** Database completely exposed - any actor with anon key can read/write all data  
**File:** `supabase_rls_policies.sql`

**Action Required:**
```bash
# 1. Go to Supabase Dashboard → SQL Editor
# 2. Copy entire content from supabase_rls_policies.sql
# 3. Run the SQL
# 4. Verify with these queries:

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
-- All should show rowsecurity = TRUE

-- Count policies  
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
-- Should show 56 total policies across 8 tables
```

#### 2. Request Validation Incomplete
**Status:** Zod schemas created but not applied to endpoints  
**Impact:** Malformed payloads could bypass ownership checks  
**File:** `server.js` (lines 145-204)

**Remaining Work:**
- Apply `validateRequest()` middleware to all 14 API endpoints
- Example pattern:
```javascript
// BEFORE
app.post('/api/projects', verifyAuth, async (req, res) => {
    const { property } = req.body; // Unvalidated!

// AFTER  
app.post('/api/projects', verifyAuth, 
    validateRequest(z.object({ property: propertySchema })), 
    async (req, res) => {
        const { property } = req.validated; // Validated!
```

#### 3. Client Migration Incomplete
**Status:** 2/30+ functions migrated (7% complete)  
**Impact:** Legacy client calls will break once RLS is enabled  
**File:** `src/services/projectService.ts`

**Current State:**
- ✅ `getProjectsForUser()` - Migrated
- ✅ `getProjectById()` - Migrated
- ❌ `createProject()` - Not migrated
- ❌ `deleteProject()` - Not migrated
- ❌ `updateProperty()` - Not migrated
- ❌ All task operations (7 functions)
- ❌ All room operations (3 functions)
- ❌ All feed operations (8 functions)
- ❌ User/friend operations (4 functions)

**Why This Matters:**
```javascript
// Current state:
const USE_SERVER_API = false; // Legacy mode

// When RLS is enabled, ALL direct Supabase calls fail
// because anon key no longer has access
// This breaks the entire app
```

---

## ✅ What's Complete

### 1. Infrastructure
- [x] JWT authentication middleware
- [x] Server-side Supabase client with service role key
- [x] 14 authenticated API endpoints
- [x] Ownership verification on all endpoints
- [x] Zod validation schemas (not yet applied)

### 2. Documentation
- [x] Architecture audit (`ARCHITECTURE_AUDIT.md`)
- [x] RLS policy SQL (`supabase_rls_policies.sql`)
- [x] API client wrapper (`src/services/apiClient.ts`)
- [x] Phase 2/3 implementation guide
- [x] This deployment checklist

### 3. Security Features
- [x] JWT token verification
- [x] User ownership checks on all queries
- [x] Image upload validation (MIME type, size)
- [x] Rate limiting on Gemini API

---

## 📋 Complete Implementation Steps

### Step 1: Apply Validation to Endpoints (2-3 hours)

**Pattern:**
```javascript
// For each POST/PUT endpoint, add validateRequest() middleware

app.post('/api/projects', 
    verifyAuth, 
    validateRequest(z.object({ property: propertySchema })),
    async (req, res) => {
        const { property } = req.validated; // Use req.validated, not req.body
        // ... rest of handler
    }
);
```

**Endpoints to Update:**
1. `POST /api/projects` - Use `propertySchema`
2. `PUT /api/projects/:id` - Use `propertySchema`
3. `POST /api/projects/:projectId/tasks` - Use `taskSchema`
4. `PUT /api/tasks/:taskId` - Use `taskSchema`
5. `POST /api/projects/:projectId/rooms` - Use `z.object({ roomName: z.string() })`
6. `POST /api/rooms/:roomId/photos` - Use `z.object({ photoUrl: z.string().url() })`
7. `POST /api/upload` - Use `imageUploadSchema`

### Step 2: Complete Client Migration (4-5 hours)

**Functions to Migrate in projectService.ts:**

```typescript
// Template for each function:
export const functionName = async (...args) => {
    if (USE_SERVER_API) {
        return await apiFunctionName(...args);
    }
    // Legacy Supabase code remains for rollback
    ...
};
```

**Priority Order:**
1. **High Priority (Project CRUD):**
   - `createProject()`
   - `deleteProject()`
   - `updateProperty()`

2. **High Priority (Task CRUD):**
   - `addTask()`
   - `updateTask()`
   - `deleteTask()`
   - `markTaskComplete()`
   - `addMessageToTaskChat()`

3. **Medium Priority (Room Operations):**
   - `addRoom()`
   - `deleteRoom()`
   - `addPhotoToRoom()`

4. **Low Priority (Feed/Social):**
   - `getFeedForUser()`
   - `addFeedPost()`
   - `addComment()`
   - `toggleLike()`
   - (4 more feed functions)

5. **Low Priority (User/Friends):**
   - `getAllUsers()`
   - `addFriend()`
   - `removeFriend()`
   - `getUserById()`

### Step 3: Deploy RLS Policies (30 minutes)

**Deployment Process:**
```bash
1. Backup current database (Supabase Dashboard → Database → Backups)
2. Go to SQL Editor
3. Paste supabase_rls_policies.sql content
4. Run the SQL
5. Verify all tables show rowsecurity = TRUE
6. Test with a test user account
```

**Verification Tests:**
```sql
-- Test 1: Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Test 2: Count policies
SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename;

-- Test 3: Try to query as anon user (should fail or return empty)
-- Use Supabase Dashboard → API → Test API with anon key
```

### Step 4: Integration Testing (2-3 hours)

**Test Matrix:**

| Operation | Legacy Mode (USE_SERVER_API=false) | Server Mode (USE_SERVER_API=true) | Expected Result |
|-----------|-----------------------------------|----------------------------------|-----------------|
| Sign up | ✅ Should work | ✅ Should work | User created |
| Create project | ✅ Should work | ✅ Should work | Project created with rooms |
| View projects | ✅ Should work | ✅ Should work | Only own projects shown |
| Add task | ✅ Should work | ✅ Should work | Task added to project |
| Upload image | ✅ Should work | ✅ Should work | Image stored securely |
| View other user's projects | ❌ Should fail (after RLS) | ❌ Should fail | 403 Forbidden |

**Test Script:**
```bash
# 1. Test legacy mode
# Set USE_SERVER_API = false
npm run dev
# Complete full user journey (signup → project → task)

# 2. Deploy RLS policies
# Run SQL in Supabase

# 3. Test server mode  
# Set USE_SERVER_API = true
npm run dev
# Repeat full user journey

# 4. Test security
# Try to access another user's data
# Should get 401/403 errors
```

### Step 5: Production Rollout (1 hour)

**Rollout Plan:**
```
1. Deploy code with USE_SERVER_API = false (no user impact)
2. Monitor for 24 hours
3. Deploy RLS policies in off-peak hours
4. Enable USE_SERVER_API = true
5. Monitor logs for errors
6. If issues arise, toggle USE_SERVER_API = false immediately
```

---

## 🚨 Emergency Rollback Procedure

If production breaks after deployment:

### Quick Rollback (2 minutes)
```typescript
// In src/services/projectService.ts
const USE_SERVER_API = false; // Switch back to legacy mode
```

### Database Rollback (if RLS causes issues)
```sql
-- ONLY if absolutely necessary - this re-exposes data
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- etc for all tables
```

**⚠️ Never disable RLS in production without a plan to re-enable**

---

## 📊 Time Estimates

| Task | Estimated Time | Completion |
|------|----------------|------------|
| Apply validation middleware | 2-3 hours | 0% |
| Complete client migration | 4-5 hours | 7% |
| Deploy RLS policies | 30 minutes | 0% |
| Integration testing | 2-3 hours | 0% |
| Production rollout | 1 hour | 0% |
| **Total Remaining** | **9-12 hours** | **5%** |

---

## 🎯 Success Criteria

Before marking Phase 2 complete:

- [ ] All 56 RLS policies deployed and verified
- [ ] All 14 API endpoints have validation middleware
- [ ] All 30+ projectService functions migrated
- [ ] USE_SERVER_API = true in production
- [ ] All integration tests passing
- [ ] No security vulnerabilities in audit
- [ ] Architect review approved
- [ ] Zero data exposure to unauthorized users

---

## 📞 Next Actions

**Immediate (This Session):**
1. Apply validation middleware to all endpoints (2-3 hours)
2. Complete high-priority client migrations (2-3 hours)
3. Request second architect review

**Short-Term (Next Session):**
1. Deploy RLS policies to Supabase
2. Complete remaining client migrations
3. Full integration testing
4. Production rollout

**Validation Command:**
```bash
# Test all endpoints with auth
npm run server &
npm run dev &

# Check for LSP errors
npm run lint

# Run tests
npm test
```

---

**IMPORTANT:** Do not deploy to production until ALL checklist items are complete.
