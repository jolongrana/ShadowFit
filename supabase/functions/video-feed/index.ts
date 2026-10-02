import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

type VideoRow = {
  id: string;
  video_url: string;
  title: string;
  description: string;
  category: string;
  creator_username: string;
  creator_display_name: string;
  duration_seconds: number;
  like_count: number;
  save_count: number;
  created_at: string;
};

export type Category = "HIIT" | "Strength" | "Yoga" | "Cardio" | "Mobility" | "10-Min Quick";

const VALID_CATEGORIES: Category[] = ["HIIT", "Strength", "Yoga", "Cardio", "Mobility", "10-Min Quick"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/video-feed/, "") || "/";
    const method = req.method;

    // GET /videos — list all videos, optionally filtered by category
    if (method === "GET" && path === "/videos") {
      const category = url.searchParams.get("category");
      let query = supabase
        .from("shadowfit_videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (category && VALID_CATEGORIES.includes(category as Category)) {
        query = query.eq("category", category);
      }
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /videos/:id — get single video with user's like/save status
    if (method === "GET" && path.startsWith("/videos/")) {
      const videoId = path.split("/")[2];
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token || null);
      const userId = userData.user?.id ?? null;

      const { data: video, error } = await supabase
        .from("shadowfit_videos")
        .select("*")
        .eq("id", videoId)
        .maybeSingle();
      if (error) throw error;
      if (!video) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let liked = false;
      let saved = false;
      if (userId) {
        const [{ data: likeRow }, { data: saveRow }] = await Promise.all([
          supabase.from("shadowfit_video_likes").select("video_id").eq("user_id", userId).eq("video_id", videoId).maybeSingle(),
          supabase.from("shadowfit_video_favorites").select("video_id").eq("user_id", userId).eq("video_id", videoId).maybeSingle(),
        ]);
        liked = !!likeRow;
        saved = !!saveRow;
      }

      return new Response(JSON.stringify({ ...video, liked, saved }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /favorites — list user's saved videos
    if (method === "GET" && path === "/favorites") {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token || null);
      const userId = userData.user?.id ?? null;
      if (!userId) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("shadowfit_video_favorites")
        .select("video_id")
        .eq("user_id", userId);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.video_id);
      return new Response(JSON.stringify(ids), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /videos — create a new video (trainer upload)
    if (method === "POST" && path === "/videos") {
      const body = await req.json();
      const { video_url, title, description, category, creator_username, creator_display_name, duration_seconds } = body;

      if (!video_url || !title || !description || !category || !creator_username) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!VALID_CATEGORIES.includes(category)) {
        return new Response(JSON.stringify({ error: "Invalid category" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("shadowfit_videos")
        .insert({
          video_url,
          title,
          description,
          category,
          creator_username: creator_username.toLowerCase().replace(/[^a-z0-9_]/g, ""),
          creator_display_name: creator_display_name || creator_username,
          duration_seconds: duration_seconds || 30,
        })
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /like — toggle like
    if (method === "POST" && path === "/like") {
      const body = await req.json();
      const { video_id, user_id } = body;
      if (!video_id || !user_id) {
        return new Response(JSON.stringify({ error: "Missing video_id or user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("shadowfit_video_likes")
        .select("video_id")
        .eq("user_id", user_id)
        .eq("video_id", video_id)
        .maybeSingle();

      if (existing) {
        await supabase.from("shadowfit_video_likes").delete().eq("user_id", user_id).eq("video_id", video_id);
        await supabase.rpc("decrement_like_count", { p_video_id: video_id });
        return new Response(JSON.stringify({ liked: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await supabase.from("shadowfit_video_likes").insert({ user_id, video_id });
        await supabase.rpc("increment_like_count", { p_video_id: video_id });
        return new Response(JSON.stringify({ liked: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // POST /save — toggle favorite
    if (method === "POST" && path === "/save") {
      const body = await req.json();
      const { video_id, user_id } = body;
      if (!video_id || !user_id) {
        return new Response(JSON.stringify({ error: "Missing video_id or user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabase
        .from("shadowfit_video_favorites")
        .select("video_id")
        .eq("user_id", user_id)
        .eq("video_id", video_id)
        .maybeSingle();

      if (existing) {
        await supabase.from("shadowfit_video_favorites").delete().eq("user_id", user_id).eq("video_id", video_id);
        await supabase.rpc("decrement_save_count", { p_video_id: video_id });
        return new Response(JSON.stringify({ saved: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await supabase.from("shadowfit_video_favorites").insert({ user_id, video_id });
        await supabase.rpc("increment_save_count", { p_video_id: video_id });
        return new Response(JSON.stringify({ saved: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
