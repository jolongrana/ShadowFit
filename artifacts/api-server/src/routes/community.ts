import { createHash } from "node:crypto";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateFriendRequestBody,
  CreateFriendRequestResponse,
  GetCommunityFriendsResponse,
  GetCommunityLeaderboardResponse,
  GetCommunityMeQueryParams,
  GetCommunityMeResponse,
  RemoveCommunityFriendParams,
  RespondFriendRequestBody,
  RespondFriendRequestParams,
  RespondFriendRequestResponse,
  SetCommunitySharingBody,
  SetCommunitySharingResponse,
  SyncCommunityWorkoutsBody,
  SyncCommunityWorkoutsResponse,
  UpdateCommunityMeBody,
  UpdateCommunityMeResponse,
} from "@workspace/api-zod";
import {
  calculateShadowScore,
  currentLocalDay,
  isValidTimeZone,
  rankForShadowScore,
  SHADOW_RANKS,
} from "@workspace/api-zod/shadowfit-score";
import { db } from "@workspace/db";
import {
  communityFriendRequests,
  communityFriendships,
  communityProfiles,
  communityWorkoutSessions,
  type CommunityProfile,
} from "@workspace/db/schema";
import { authUserId, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function ensureProfile(userId: string): Promise<CommunityProfile> {
  const usernameSuffix = createHash("sha256").update(userId).digest("hex").slice(0, 10);
  await db
    .insert(communityProfiles)
    .values({
      userId,
      username: `athlete_${usernameSuffix}`,
      displayName: "ShadowFit Athlete",
    })
    .onConflictDoNothing({ target: communityProfiles.userId });

  const [profile] = await db
    .select()
    .from(communityProfiles)
    .where(eq(communityProfiles.userId, userId))
    .limit(1);
  if (!profile) throw new Error("Could not create the community profile.");
  return profile;
}

async function getScoresForProfiles(profiles: CommunityProfile[]) {
  if (!profiles.length) return new Map<string, ReturnType<typeof calculateShadowScore>>();

  const ids = profiles.map((profile) => profile.userId);
  const sessions = await db
    .select({
      userId: communityWorkoutSessions.userId,
      sets: communityWorkoutSessions.sets,
      localDay: communityWorkoutSessions.localDay,
    })
    .from(communityWorkoutSessions)
    .where(inArray(communityWorkoutSessions.userId, ids));

  const sessionsByUser = new Map<string, { sets: number; localDay: string }[]>();
  for (const session of sessions) {
    const userSessions = sessionsByUser.get(session.userId) ?? [];
    userSessions.push({ sets: session.sets, localDay: session.localDay });
    sessionsByUser.set(session.userId, userSessions);
  }

  return new Map(
    profiles.map((profile) => [
      profile.userId,
      calculateShadowScore(
        sessionsByUser.get(profile.userId) ?? [],
        currentLocalDay(profile.timeZone),
      ),
    ]),
  );
}

async function getProfileResponse(profile: CommunityProfile) {
  const [scores, friendCount] = await Promise.all([
    getScoresForProfiles([profile]),
    db
      .select({ count: count() })
      .from(communityFriendships)
      .where(eq(communityFriendships.userId, profile.userId)),
  ]);
  const score = scores.get(profile.userId);
  if (!score) throw new Error("Could not calculate the Shadow Score.");
  const rank = rankForShadowScore(score.total);
  const nextRank = SHADOW_RANKS.find((candidate) => candidate.level === rank.level + 1);

  return GetCommunityMeResponse.parse({
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    score: score.total,
    rank: rank.title,
    rankLevel: rank.level,
    friendCount: Number(friendCount[0]?.count ?? 0),
    nextRankScore: nextRank?.minimumScore ?? null,
    sharingEnabled: profile.sharingEnabled,
  });
}

function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

router.get("/community/me", requireAuth, async (req, res) => {
  const params = GetCommunityMeQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Invalid profile query." });
    return;
  }

  const userId = authUserId(req);
  let profile = await ensureProfile(userId);
  const requestedTimeZone = params.data.timeZone;
  if (requestedTimeZone && !isValidTimeZone(requestedTimeZone)) {
    res.status(400).json({ error: "A valid time zone is required." });
    return;
  }
  if (requestedTimeZone && requestedTimeZone !== profile.timeZone) {
    const [updated] = await db
      .update(communityProfiles)
      .set({ timeZone: requestedTimeZone, updatedAt: new Date() })
      .where(eq(communityProfiles.userId, userId))
      .returning();
    if (updated) profile = updated;
  }

  res.json(await getProfileResponse(profile));
});

router.put("/community/me", requireAuth, async (req, res) => {
  const parsed = UpdateCommunityMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid username and display name." });
    return;
  }

  const userId = authUserId(req);
  await ensureProfile(userId);
  try {
    const [profile] = await db
      .update(communityProfiles)
      .set({
        username: parsed.data.username.toLowerCase(),
        displayName: parsed.data.displayName.trim(),
        updatedAt: new Date(),
      })
      .where(eq(communityProfiles.userId, userId))
      .returning();
    if (!profile) {
      res.status(404).json({ error: "Community profile not found." });
      return;
    }
    res.json(await UpdateCommunityMeResponse.parseAsync(await getProfileResponse(profile)));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That username is already in use." });
      return;
    }
    throw error;
  }
});

router.put("/community/sharing", requireAuth, async (req, res) => {
  const parsed = SetCommunitySharingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid score sharing preference." });
    return;
  }
  const userId = authUserId(req);
  await ensureProfile(userId);
  await db
    .update(communityProfiles)
    .set({ sharingEnabled: parsed.data.enabled, updatedAt: new Date() })
    .where(eq(communityProfiles.userId, userId));
  res.json(SetCommunitySharingResponse.parse({ enabled: parsed.data.enabled }));
});

router.post("/community/workouts/sync", requireAuth, async (req, res) => {
  const parsed = SyncCommunityWorkoutsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Workout history could not be synced." });
    return;
  }
  if (!isValidTimeZone(parsed.data.timeZone)) {
    res.status(400).json({ error: "A valid time zone is required." });
    return;
  }
  if (parsed.data.sessions.some((session) => !validDay(session.localDay))) {
    res.status(400).json({ error: "Workout dates must be valid calendar days." });
    return;
  }
  const userId = authUserId(req);
  const profile = await ensureProfile(userId);
  if (!profile.sharingEnabled) {
    res.status(403).json({ error: "Enable score sharing before syncing workout history." });
    return;
  }
  await db
    .update(communityProfiles)
    .set({ timeZone: parsed.data.timeZone, updatedAt: new Date() })
    .where(eq(communityProfiles.userId, userId));
  const beforeScores = await getScoresForProfiles([
    { ...profile, timeZone: parsed.data.timeZone },
  ]);
  const beforeScore = beforeScores.get(userId)?.total ?? 0;

  const inserted = await db
    .insert(communityWorkoutSessions)
    .values(
      parsed.data.sessions.map((session) => ({
        userId,
        clientSessionId: session.clientSessionId,
        workoutId: session.workoutId,
        sets: session.sets,
        minutes: session.minutes,
        completedAt: session.completedAt,
        localDay: session.localDay,
      })),
    )
    .onConflictDoNothing({
      target: [communityWorkoutSessions.userId, communityWorkoutSessions.clientSessionId],
    })
    .returning({ id: communityWorkoutSessions.id });

  const updatedProfile = await ensureProfile(userId);
  const scores = await getScoresForProfiles([updatedProfile]);
  const score = scores.get(userId);
  if (!score) throw new Error("Could not calculate the Shadow Score.");
  const rank = rankForShadowScore(score.total);
  const previousRank = rankForShadowScore(beforeScore);
  res.json(
    SyncCommunityWorkoutsResponse.parse({
      synced: inserted.length,
      score: score.total,
      scoreGained: Math.max(0, score.total - beforeScore),
      rank: rank.title,
      rankLevel: rank.level,
      rankedUp: rank.level > previousRank.level,
    }),
  );
});

router.get("/community/leaderboard", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  const profile = await ensureProfile(userId);
  const friendshipRows = await db
    .select({ userId: communityFriendships.friendUserId })
    .from(communityFriendships)
    .where(eq(communityFriendships.userId, userId));
  const friendIds = friendshipRows.map((row) => row.userId);
  const visibleFriends =
    friendIds.length > 0
      ? await db
          .select()
          .from(communityProfiles)
          .where(
            and(
              inArray(communityProfiles.userId, friendIds),
              eq(communityProfiles.sharingEnabled, true),
            ),
          )
      : [];
  const profiles = [profile, ...visibleFriends];
  const scores = await getScoresForProfiles(profiles);
  const entries = profiles
    .map((item) => {
      const score = scores.get(item.userId);
      if (!score) return null;
      const rank = rankForShadowScore(score.total);
      return {
        userId: item.userId,
        username: item.username,
        displayName: item.displayName,
        score: score.total,
        rank: rank.title,
        rankLevel: rank.level,
        isYou: item.userId === userId,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  const yourPosition = Math.max(1, entries.findIndex((entry) => entry.isYou) + 1);
  res.json(GetCommunityLeaderboardResponse.parse({ entries, yourPosition }));
});

router.get("/community/friends", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  await ensureProfile(userId);
  const friendshipRows = await db
    .select({ userId: communityFriendships.friendUserId })
    .from(communityFriendships)
    .where(eq(communityFriendships.userId, userId));
  const friendIds = friendshipRows.map((row) => row.userId);
  const friendProfiles =
    friendIds.length > 0
      ? await db
          .select()
          .from(communityProfiles)
          .where(inArray(communityProfiles.userId, friendIds))
      : [];
  const friendScores = await getScoresForProfiles(friendProfiles.filter((item) => item.sharingEnabled));
  const friends = friendProfiles
    .map((profile) => {
      const score = friendScores.get(profile.userId);
      const rank = score ? rankForShadowScore(score.total) : null;
      return {
        userId: profile.userId,
        username: profile.username,
        displayName: profile.displayName,
        score: score?.total ?? 0,
        rank: rank?.title ?? "Private",
        rankLevel: rank?.level ?? 0,
        sharingEnabled: profile.sharingEnabled,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const [incoming, outgoing] = await Promise.all([
    db
      .select({
        id: communityFriendRequests.id,
        userId: communityProfiles.userId,
        username: communityProfiles.username,
        displayName: communityProfiles.displayName,
        createdAt: communityFriendRequests.createdAt,
      })
      .from(communityFriendRequests)
      .innerJoin(
        communityProfiles,
        eq(communityProfiles.userId, communityFriendRequests.requesterId),
      )
      .where(
        and(
          eq(communityFriendRequests.recipientId, userId),
          eq(communityFriendRequests.status, "pending"),
        ),
      )
      .orderBy(desc(communityFriendRequests.createdAt)),
    db
      .select({
        id: communityFriendRequests.id,
        userId: communityProfiles.userId,
        username: communityProfiles.username,
        displayName: communityProfiles.displayName,
        createdAt: communityFriendRequests.createdAt,
      })
      .from(communityFriendRequests)
      .innerJoin(
        communityProfiles,
        eq(communityProfiles.userId, communityFriendRequests.recipientId),
      )
      .where(
        and(
          eq(communityFriendRequests.requesterId, userId),
          eq(communityFriendRequests.status, "pending"),
        ),
      )
      .orderBy(desc(communityFriendRequests.createdAt)),
  ]);

  res.json(GetCommunityFriendsResponse.parse({ friends, incoming, outgoing }));
});

router.post("/community/friend-requests", requireAuth, async (req, res) => {
  const parsed = CreateFriendRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid username." });
    return;
  }
  const userId = authUserId(req);
  const ownProfile = await ensureProfile(userId);
  if (!ownProfile.sharingEnabled) {
    res.status(403).json({ error: "Enable score sharing before sending friend requests." });
    return;
  }
  const [target] = await db
    .select()
    .from(communityProfiles)
    .where(eq(communityProfiles.username, parsed.data.username.toLowerCase()))
    .limit(1);
  if (!target || !target.sharingEnabled) {
    res.status(404).json({ error: "No ShadowFit profile matches that username." });
    return;
  }
  if (target.userId === userId) {
    res.status(409).json({ error: "You cannot send a friend request to yourself." });
    return;
  }
  const [friendship] = await db
    .select({ userId: communityFriendships.friendUserId })
    .from(communityFriendships)
    .where(
      and(
        eq(communityFriendships.userId, userId),
        eq(communityFriendships.friendUserId, target.userId),
      ),
    )
    .limit(1);
  if (friendship) {
    res.status(409).json({ error: "You are already friends." });
    return;
  }
  const [pending] = await db
    .select({ id: communityFriendRequests.id })
    .from(communityFriendRequests)
    .where(
      and(
        eq(communityFriendRequests.status, "pending"),
        or(
          and(
            eq(communityFriendRequests.requesterId, userId),
            eq(communityFriendRequests.recipientId, target.userId),
          ),
          and(
            eq(communityFriendRequests.requesterId, target.userId),
            eq(communityFriendRequests.recipientId, userId),
          ),
        ),
      ),
    )
    .limit(1);
  if (pending) {
    res.status(409).json({ error: "A request is already waiting between these accounts." });
    return;
  }

  const [previousRequest] = await db
    .select()
    .from(communityFriendRequests)
    .where(
      and(
        eq(communityFriendRequests.requesterId, userId),
        eq(communityFriendRequests.recipientId, target.userId),
      ),
    )
    .limit(1);
  const [request] = previousRequest
    ? await db
        .update(communityFriendRequests)
        .set({ status: "pending", createdAt: new Date(), updatedAt: new Date() })
        .where(eq(communityFriendRequests.id, previousRequest.id))
        .returning()
    : await db
        .insert(communityFriendRequests)
        .values({ requesterId: userId, recipientId: target.userId })
        .returning();

  res.status(201).json(
    CreateFriendRequestResponse.parse({
      id: request.id,
      userId: target.userId,
      username: target.username,
      displayName: target.displayName,
      createdAt: request.createdAt,
    }),
  );
});

router.patch("/community/friend-requests/:requestId", requireAuth, async (req, res) => {
  const params = RespondFriendRequestParams.safeParse(req.params);
  const body = RespondFriendRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid friend request action." });
    return;
  }

  const userId = authUserId(req);
  await ensureProfile(userId);
  const [request] = await db
    .select()
    .from(communityFriendRequests)
    .where(eq(communityFriendRequests.id, params.data.requestId))
    .limit(1);
  if (!request || request.status !== "pending") {
    res.status(404).json({ error: "Pending friend request not found." });
    return;
  }

  const { decision } = body.data;
  const canAcceptOrDecline = request.recipientId === userId;
  const canCancel = request.requesterId === userId;
  if (
    (decision === "accept" && (!canAcceptOrDecline || request.recipientId === request.requesterId)) ||
    (decision === "decline" && !canAcceptOrDecline) ||
    (decision === "cancel" && !canCancel)
  ) {
    res.status(403).json({ error: "You cannot change this friend request." });
    return;
  }

  if (decision === "accept") {
    await db.transaction(async (tx) => {
      await tx
        .update(communityFriendRequests)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(communityFriendRequests.id, request.id));
      await tx
        .insert(communityFriendships)
        .values([
          { userId: request.requesterId, friendUserId: request.recipientId },
          { userId: request.recipientId, friendUserId: request.requesterId },
        ])
        .onConflictDoNothing();
    });
  } else {
    await db
      .update(communityFriendRequests)
      .set({
        status: decision === "decline" ? "declined" : "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(communityFriendRequests.id, request.id));
  }

  const status =
    decision === "accept" ? "accepted" : decision === "decline" ? "declined" : "cancelled";
  res.json(RespondFriendRequestResponse.parse({ status }));
});

router.delete("/community/friends/:friendUserId", requireAuth, async (req, res) => {
  const params = RemoveCommunityFriendParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid friend account." });
    return;
  }
  const userId = authUserId(req);
  const friendUserId = params.data.friendUserId;
  await ensureProfile(userId);
  const removed = await db
    .delete(communityFriendships)
    .where(
      or(
        and(
          eq(communityFriendships.userId, userId),
          eq(communityFriendships.friendUserId, friendUserId),
        ),
        and(
          eq(communityFriendships.userId, friendUserId),
          eq(communityFriendships.friendUserId, userId),
        ),
      ),
    )
    .returning({ userId: communityFriendships.userId });
  if (!removed.length) {
    res.status(404).json({ error: "Friendship not found." });
    return;
  }
  res.status(204).end();
});

export default router;