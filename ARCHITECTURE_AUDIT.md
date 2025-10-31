# Architecture Audit - Phase 2 Foundation

**Date:** October 31, 2025  
**Status:** ✅ Audit Complete

---

## Database Schema (Inferred from Codebase)

### Tables & Relationships

```
users
├── id (PK)
├── name
├── email
├── avatar_url
└── preferences (JSONB)

projects
├── id (PK)
├── user_id (FK → users.id)
├── name
├── vision_statement
└── project_chat_history (JSONB)

rooms
├── id (PK)
├── project_id (FK → projects.id)
├── name
├── photos (JSONB array)
└── ai_summary

tasks
├── id (PK)
├── project_id (FK → projects.id)
├── room_id (FK → rooms.id)
├── title
├── room
├── status
├── priority
├── chat_history (JSONB)
├── guide (JSONB)
├── safety (JSONB)
├── materials (JSONB)
├── tools (JSONB)
├── cost
├── time
├── hiring_info (JSONB)
└── has_been_opened

friends (many-to-many)
├── user_id_1 (FK → users.id)
└── user_id_2 (FK → users.id)

feed_posts
├── id (PK)
├── project_id (FK → projects.id)
├── user_id (FK → users.id)
├── timestamp
├── text
├── image_url
├── project_name
└── room_name

post_comments
├── id (PK)
├── post_id (FK → feed_posts.id)
├── user_id (FK → users.id)
├── text
└── timestamp

post_likes
├── post_id (FK → feed_posts.id)
└── user_id (FK → users.id)
```

---

## Current Client-Side Database Operations

### Authentication Operations (authService.ts)
- ✅ `getCurrentUser()` - Get session + user profile + friends
- ✅ `signUp()` - User registration
- ✅ `signIn()` - User login
- ✅ `signOut()` - User logout
- ✅ `getSession()` - Get current session
- ✅ `updateUserProfile()` - Update user profile
- ✅ `onAuthStateChange()` - Listen for auth changes

**Risk:** 🟡 MEDIUM - Auth operations are generally safe client-side with Supabase

### Project Operations (projectService.ts)
- ⚠️ `getProjectsForUser()` - Fetch all projects for user
- ⚠️ `getProjectById()` - Fetch single project with rooms/tasks
- ⚠️ `createProject()` - Create new project + rooms
- ⚠️ `deleteProject()` - Delete project
- ⚠️ `updateProperty()` - Update project metadata
- ⚠️ `addTask()` - Create new task
- ⚠️ `updateTask()` - Update task details
- ⚠️ `deleteTask()` - Delete task
- ⚠️ `markTaskComplete()` - Toggle task completion
- ⚠️ `addRoom()` - Create new room
- ⚠️ `deleteRoom()` - Delete room
- ⚠️ `addPhotoToRoom()` - Add photo to room
- ⚠️ `addMessageToTaskChat()` - Append message to task chat
- ⚠️ `addMessageToProjectChat()` - Append message to project chat

**Risk:** 🔴 HIGH - All operations run client-side with no server validation

### Storage Operations (projectService.ts)
- ⚠️ `uploadImage()` - Direct upload to Supabase Storage

**Risk:** 🔴 HIGH - Client can upload any file, no server-side validation

### User & Friend Operations (projectService.ts)
- ⚠️ `getAllUsers()` - Fetch all users (potential privacy issue)
- ⚠️ `getUserById()` - Fetch specific user
- ⚠️ `addFriend()` - Create friendship
- ⚠️ `removeFriend()` - Delete friendship

**Risk:** 🔴 HIGH - No privacy controls, any user can see all users

### Feed Operations (projectService.ts)
- ⚠️ `getFeedForUser()` - Fetch feed posts + comments + likes
- ⚠️ `createFeedPost()` - Create new feed post
- ⚠️ `likeFeedPost()` - Like a post
- ⚠️ `unlikeFeedPost()` - Unlike a post
- ⚠️ `addComment()` - Add comment to post
- ⚠️ `deleteComment()` - Delete comment

**Risk:** 🟡 MEDIUM - Friends-only feed logic handled client-side (can be bypassed)

---

## Environment Variables Audit

### ✅ Available Secrets
- `GEMINI_API_KEY` - Server-side only ✅
- `VITE_SUPABASE_URL` - Client-safe (public URL) ✅
- `VITE_SUPABASE_ANON_KEY` - Client-safe (public key) ✅
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only ✅ (newly added)

### 🔒 Security Status
- API keys properly segregated (client vs server)
- Service role key will enable server-side Supabase operations
- RLS policies needed to protect data access

---

## Migration Strategy

### Phase 2A: Auth Infrastructure (4-5 hours)
1. Create server-side Supabase client with service role key
2. Implement JWT validation middleware
3. Create auth utilities (extractUserId, verifyToken)
4. Add session management

### Phase 2B: API Endpoints (6-7 hours)
1. Project CRUD: GET, POST, PUT, DELETE /api/projects
2. Task operations: POST, PUT, DELETE /api/tasks
3. Room operations: POST, PUT, DELETE /api/rooms
4. Image upload: POST /api/upload
5. Feed operations: GET, POST /api/feed
6. User operations: GET /api/users (with privacy)

### Phase 2C: RLS Policies (5-6 hours)
1. Enable RLS on all tables
2. Define policies:
   - Users can only read/update their own profile
   - Users can only access their own projects
   - Users can only see friends' feed posts
   - Storage policies for image uploads

### Phase 2D: Client Migration (5-6 hours)
1. Create API client wrapper (apiClient.ts)
2. Replace all Supabase calls with API calls
3. Update type definitions
4. Test all operations

### Phase 2E: Testing & Rollout (2 hours)
1. Integration tests for all endpoints
2. RLS policy tests
3. Feature flag for gradual rollout
4. Monitoring and logging

**Total Estimated Time:** 22-26 hours (3-4 days)

---

## Risk Mitigation

### Critical Risks
1. **Data loss during migration**
   - Mitigation: Feature flags, zero-downtime deployment
   - Rollback: Keep client-side code behind toggle

2. **RLS policies too restrictive**
   - Mitigation: Test policies with simulation
   - Rollback: Disable RLS if issues occur

3. **Session/JWT authentication drift**
   - Mitigation: Centralize auth helpers, integration tests
   - Rollback: Revert to client-side auth

### Testing Strategy
- Unit tests for auth middleware
- Integration tests for API endpoints
- RLS policy tests via pgTAP
- E2E smoke tests for critical flows

---

## Success Criteria

- [ ] All database operations run server-side
- [ ] RLS policies enforced on all tables
- [ ] JWT authentication validates all requests
- [ ] Image uploads handled server-side
- [ ] Zero data loss during migration
- [ ] All tests passing (60%+ coverage)
- [ ] Performance maintained (<2s API response)
- [ ] Security audit passes (no client-side DB access)

---

## Next Steps

1. ✅ Architecture audit complete
2. 🔄 Implement auth infrastructure (in progress)
3. ⏳ Create API endpoints
4. ⏳ Enable RLS policies
5. ⏳ Migrate client code
6. ⏳ Testing & rollout
