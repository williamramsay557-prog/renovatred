-- ============================================================================
-- Renovatr Row Level Security (RLS) Policies
-- ============================================================================
-- This file contains all RLS policies to secure the Supabase database
-- Run these in your Supabase SQL Editor to enable security

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USERS TABLE POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 3. PROJECTS TABLE POLICIES
-- ============================================================================

-- Users can view their own projects
CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);

-- Users can create projects
CREATE POLICY "Users can create own projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
ON projects FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
ON projects FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 4. ROOMS TABLE POLICIES
-- ============================================================================

-- Users can view rooms for their own projects
CREATE POLICY "Users can view own project rooms"
ON rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can create rooms for their own projects
CREATE POLICY "Users can create rooms for own projects"
ON rooms FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can update rooms in their own projects
CREATE POLICY "Users can update own project rooms"
ON rooms FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete rooms from their own projects
CREATE POLICY "Users can delete own project rooms"
ON rooms FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rooms.project_id
    AND projects.user_id = auth.uid()
  )
);

-- ============================================================================
-- 5. TASKS TABLE POLICIES
-- ============================================================================

-- Users can view tasks for their own projects
CREATE POLICY "Users can view own project tasks"
ON tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can create tasks for their own projects
CREATE POLICY "Users can create tasks for own projects"
ON tasks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can update tasks in their own projects
CREATE POLICY "Users can update own project tasks"
ON tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can delete tasks from their own projects
CREATE POLICY "Users can delete own project tasks"
ON tasks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = tasks.project_id
    AND projects.user_id = auth.uid()
  )
);

-- ============================================================================
-- 6. FRIENDS TABLE POLICIES
-- ============================================================================

-- Users can view their own friendships
CREATE POLICY "Users can view own friendships"
ON friends FOR SELECT
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Users can create friendships involving themselves
CREATE POLICY "Users can create friendships"
ON friends FOR INSERT
WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- Users can delete their own friendships
CREATE POLICY "Users can delete own friendships"
ON friends FOR DELETE
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- ============================================================================
-- 7. FEED_POSTS TABLE POLICIES
-- ============================================================================

-- Users can view their own posts and posts from friends
CREATE POLICY "Users can view own and friends' feed posts"
ON feed_posts FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM friends
    WHERE (friends.user_id_1 = auth.uid() AND friends.user_id_2 = feed_posts.user_id)
    OR (friends.user_id_2 = auth.uid() AND friends.user_id_1 = feed_posts.user_id)
  )
);

-- Users can create their own posts
CREATE POLICY "Users can create own feed posts"
ON feed_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own feed posts"
ON feed_posts FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own feed posts"
ON feed_posts FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 8. POST_COMMENTS TABLE POLICIES
-- ============================================================================

-- Users can view comments on posts they can see
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

-- Users can create comments on posts they can see
CREATE POLICY "Users can comment on visible posts"
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

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON post_comments FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 9. POST_LIKES TABLE POLICIES
-- ============================================================================

-- Users can view likes on posts they can see
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

-- Users can like posts they can see
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

-- Users can unlike posts
CREATE POLICY "Users can unlike posts"
ON post_likes FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 10. STORAGE POLICIES (for 'images' bucket)
-- ============================================================================

-- Users can upload images to their own folder
-- Run this in Supabase Storage settings or via SQL
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

-- Users can view all public images
CREATE POLICY "Anyone can view public images"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Users can update their own images
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

-- Users can delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify RLS is enabled:
/*
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show 'true' for all tables
*/

-- View all policies:
/*
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
*/
