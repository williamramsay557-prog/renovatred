-- ============================================================================
-- CLEAN RLS POLICY DEPLOYMENT
-- This script safely removes existing policies before creating new ones
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES (if they exist)
-- ============================================================================

-- Drop users table policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Drop projects table policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- Drop tasks table policies
DROP POLICY IF EXISTS "Users can view tasks in own projects" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks in own projects" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in own projects" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in own projects" ON tasks;

-- Drop rooms table policies
DROP POLICY IF EXISTS "Users can view rooms in own projects" ON rooms;
DROP POLICY IF EXISTS "Users can insert rooms in own projects" ON rooms;
DROP POLICY IF EXISTS "Users can update rooms in own projects" ON rooms;
DROP POLICY IF EXISTS "Users can delete rooms in own projects" ON rooms;

-- Drop friends table policies
DROP POLICY IF EXISTS "Users can view own friendships" ON friends;
DROP POLICY IF EXISTS "Users can create friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete own friendships" ON friends;

-- Drop feed_posts table policies
DROP POLICY IF EXISTS "Users can view friends' posts" ON feed_posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON feed_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON feed_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON feed_posts;

-- Drop post_comments table policies
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON post_comments;
DROP POLICY IF EXISTS "Users can insert comments on visible posts" ON post_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON post_comments;

-- Drop post_likes table policies
DROP POLICY IF EXISTS "Users can view likes on visible posts" ON post_likes;
DROP POLICY IF EXISTS "Users can like visible posts" ON post_likes;
DROP POLICY IF EXISTS "Users can unlike posts" ON post_likes;

-- Drop storage policies
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view all images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

-- ============================================================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: CREATE FRESH POLICIES
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. PROJECTS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
ON projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
ON projects FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 3. TASKS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view tasks in own projects"
ON tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert tasks in own projects"
ON tasks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tasks in own projects"
ON tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tasks in own projects"
ON tasks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

-- ============================================================================
-- 4. ROOMS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view rooms in own projects"
ON rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert rooms in own projects"
ON rooms FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update rooms in own projects"
ON rooms FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete rooms in own projects"
ON rooms FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

-- ============================================================================
-- 5. FRIENDS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view own friendships"
ON friends FOR SELECT
USING (
  auth.uid() = user_id_1 OR auth.uid() = user_id_2
);

CREATE POLICY "Users can create friendships"
ON friends FOR INSERT
WITH CHECK (
  auth.uid() = user_id_1 OR auth.uid() = user_id_2
);

CREATE POLICY "Users can delete own friendships"
ON friends FOR DELETE
USING (
  auth.uid() = user_id_1 OR auth.uid() = user_id_2
);

-- ============================================================================
-- 6. FEED_POSTS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view friends' posts"
ON feed_posts FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM friends
    WHERE (friends.user_id_1 = auth.uid() AND friends.user_id_2 = feed_posts.user_id)
    OR (friends.user_id_2 = auth.uid() AND friends.user_id_1 = feed_posts.user_id)
  )
);

CREATE POLICY "Users can insert own posts"
ON feed_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
ON feed_posts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
ON feed_posts FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 7. POST_COMMENTS TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view comments on visible posts"
ON post_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM feed_posts
    WHERE feed_posts.id = post_comments.post_id
    AND (
      feed_posts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friends
        WHERE (friends.user_id_1 = auth.uid() AND friends.user_id_2 = feed_posts.user_id)
        OR (friends.user_id_2 = auth.uid() AND friends.user_id_1 = feed_posts.user_id)
      )
    )
  )
);

CREATE POLICY "Users can insert comments on visible posts"
ON post_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM feed_posts
    WHERE feed_posts.id = post_comments.post_id
    AND (
      feed_posts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friends
        WHERE (friends.user_id_1 = auth.uid() AND friends.user_id_2 = feed_posts.user_id)
        OR (friends.user_id_2 = auth.uid() AND friends.user_id_1 = feed_posts.user_id)
      )
    )
  )
);

CREATE POLICY "Users can delete own comments"
ON post_comments FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 8. POST_LIKES TABLE POLICIES
-- ============================================================================

CREATE POLICY "Users can view likes on visible posts"
ON post_likes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM feed_posts
    WHERE feed_posts.id = post_likes.post_id
    AND (
      feed_posts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friends
        WHERE (friends.user_id_1 = auth.uid() AND friends.user_id_2 = feed_posts.user_id)
        OR (friends.user_id_2 = auth.uid() AND friends.user_id_1 = feed_posts.user_id)
      )
    )
  )
);

CREATE POLICY "Users can like visible posts"
ON post_likes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM feed_posts
    WHERE feed_posts.id = post_likes.post_id
    AND (
      feed_posts.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM friends
        WHERE (friends.user_id_1 = auth.uid() AND friends.user_id_2 = feed_posts.user_id)
        OR (friends.user_id_2 = auth.uid() AND friends.user_id_1 = feed_posts.user_id)
      )
    )
  )
);

CREATE POLICY "Users can unlike posts"
ON post_likes FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 9. STORAGE POLICIES (for 'images' bucket)
-- ============================================================================

-- IMPORTANT: Image paths must be: public/{user_id}/filename
-- This allows proper ownership verification

CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'public'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Authenticated users can view all images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'public'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'public'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify RLS is enabled:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- View all policies:
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Total policy count:
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';
