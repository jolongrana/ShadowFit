/*
# Create like/save count RPC functions

## Summary
Creates SECURITY DEFINER functions to safely increment and decrement
the like_count and save_count columns on shadowfit_videos. These are
called by the video-feed edge function when users like/unlike or
save/unsave videos.

## Functions
1. increment_like_count(p_video_id uuid) — like_count + 1
2. decrement_like_count(p_video_id uuid) — like_count - 1 (min 0)
3. increment_save_count(p_video_id uuid) — save_count + 1
4. decrement_save_count(p_video_id uuid) — save_count - 1 (min 0)

All functions are SECURITY DEFINER so the service role can execute them.
*/

CREATE OR REPLACE FUNCTION increment_like_count(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shadowfit_videos SET like_count = like_count + 1 WHERE id = p_video_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_like_count(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shadowfit_videos SET like_count = GREATEST(0, like_count - 1) WHERE id = p_video_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_save_count(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shadowfit_videos SET save_count = save_count + 1 WHERE id = p_video_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_save_count(p_video_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shadowfit_videos SET save_count = GREATEST(0, save_count - 1) WHERE id = p_video_id;
END;
$$;