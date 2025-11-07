-- Database Schema Reference
-- This is a visual representation of the Supabase database schema
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.feed_posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  text text,
  image_url text,
  project_name text,
  room_name text,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feed_posts_pkey PRIMARY KEY (id),
  CONSTRAINT feed_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT feed_posts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

CREATE TABLE public.friends (
  user_id_1 uuid NOT NULL,
  user_id_2 uuid NOT NULL,
  CONSTRAINT friends_pkey PRIMARY KEY (user_id_1, user_id_2),
  CONSTRAINT friends_user_id_1_fkey FOREIGN KEY (user_id_1) REFERENCES auth.users(id),
  CONSTRAINT friends_user_id_2_fkey FOREIGN KEY (user_id_2) REFERENCES auth.users(id)
);

CREATE TABLE public.post_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  text text NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_pkey PRIMARY KEY (id),
  CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id),
  CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.post_likes (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id),
  CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  vision_statement text,
  project_chat_history jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  photos jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  room_id uuid,
  room text,
  title text NOT NULL,
  status text NOT NULL,
  priority integer DEFAULT 0,
  chat_history jsonb,
  guide jsonb,
  safety jsonb,
  materials jsonb,
  tools jsonb,
  cost text,
  time text,
  hiring_info text,
  has_been_opened boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT tasks_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id)
);

CREATE TABLE public.users (
  id uuid NOT NULL,
  name text NOT NULL,
  avatar_url text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

