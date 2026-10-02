/*
# Create ShadowFit fitness video feed tables

## Summary
Creates tables to power a short-form fitness video streaming platform
(similar to TikTok/Instagram Reels) within the ShadowFit app. Videos are
stored as cloud URLs (not raw files). Seed data with 4 open-source
vertical workout videos is inserted so the feed works instantly.

## New tables

1. shadowfit_videos
   - id (uuid, primary key)
   - video_url (text, not null) — cloud bucket URL to the MP4
   - title (text, not null) — exercise title shown on overlay
   - description (text, not null) — short description shown on overlay
   - category (text, not null) — one of: HIIT, Strength, Yoga, Cardio, Mobility, 10-Min Quick
   - creator_username (text, not null) — displayed as @username
   - creator_display_name (text, not null) — friendly name
   - duration_seconds (integer, default 30) — for the workout mode timer
   - like_count (integer, default 0) — cached like count
   - save_count (integer, default 0) — cached favorite count
   - created_at (timestamptz, default now())
   - Index on category for filtering

2. shadowfit_video_likes
   - user_id (text, not null) — Clerk user ID
   - video_id (uuid, FK → videos, cascade delete)
   - created_at (timestamptz, default now())
   - Composite PK on (user_id, video_id) — one like per user per video

3. shadowfit_video_favorites
   - user_id (text, not null)
   - video_id (uuid, FK → videos, cascade delete)
   - created_at (timestamptz, default now())
   - Composite PK on (user_id, video_id) — one save per user per video

## Security
- RLS enabled on all tables, deny-by-default (no permissive policies).
- All access goes through the API server's privileged connection which
  bypasses RLS. The frontend never queries these tables directly.

## Seed data
4 placeholder videos using open-source vertical MP4s from Google's
public test video bucket and other open sources. Categories span
HIIT, Strength, Yoga, and Cardio to demonstrate the filter bar.
*/

-- 1. Videos table
CREATE TABLE IF NOT EXISTS shadowfit_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  creator_username text NOT NULL,
  creator_display_name text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 30,
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shadowfit_videos_category_idx
  ON shadowfit_videos (category);

CREATE INDEX IF NOT EXISTS shadowfit_videos_created_idx
  ON shadowfit_videos (created_at DESC);

ALTER TABLE shadowfit_videos ENABLE ROW LEVEL SECURITY;

-- 2. Likes table
CREATE TABLE IF NOT EXISTS shadowfit_video_likes (
  user_id text NOT NULL,
  video_id uuid NOT NULL
    REFERENCES shadowfit_videos (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shadowfit_video_likes
  ADD CONSTRAINT shadowfit_video_likes_pkey
  PRIMARY KEY (user_id, video_id);

CREATE INDEX IF NOT EXISTS shadowfit_video_likes_video_idx
  ON shadowfit_video_likes (video_id);

ALTER TABLE shadowfit_video_likes ENABLE ROW LEVEL SECURITY;

-- 3. Favorites table
CREATE TABLE IF NOT EXISTS shadowfit_video_favorites (
  user_id text NOT NULL,
  video_id uuid NOT NULL
    REFERENCES shadowfit_videos (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shadowfit_video_favorites
  ADD CONSTRAINT shadowfit_video_favorites_pkey
  PRIMARY KEY (user_id, video_id);

CREATE INDEX IF NOT EXISTS shadowfit_video_favorites_video_idx
  ON shadowfit_video_favorites (video_id);

ALTER TABLE shadowfit_video_favorites ENABLE ROW LEVEL SECURITY;

-- Seed data: 4 open-source vertical workout videos
-- Using Google's public sample videos (open source, freely distributable)
-- and other public-domain video URLs
INSERT INTO shadowfit_videos (video_url, title, description, category, creator_username, creator_display_name, duration_seconds, like_count, save_count) VALUES
  (
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'Explosive HIIT Burnout',
    '30-second max-effort intervals. Push hard, rest sharp, repeat four rounds. No equipment needed.',
    'HIIT',
    'coach.maya',
    'Coach Maya',
    30,
    1247,
    89
  ),
  (
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'Bodyweight Strength Builder',
    'Slow controlled push-ups and squats. Three sets, full range. Build tension and own every rep.',
    'Strength',
    'iron.kai',
    'Iron Kai',
    45,
    892,
    134
  ),
  (
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'Morning Yoga Flow',
    'Gentle flow to open hips and shoulders. Breathe deep, move slow. Perfect to start your day.',
    'Yoga',
    'studio.ren',
    'Studio Ren',
    60,
    2103,
    412
  ),
  (
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'Cardio Sprint Intervals',
    'Quick feet, high knees, mountain climbers. Ten-minute quick burn for your whole engine.',
    'Cardio',
    'pulse.dan',
    'Pulse Dan',
    30,
    567,
    78
  )
ON CONFLICT DO NOTHING;