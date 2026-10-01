import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const communityProfiles = pgTable(
  "shadowfit_profiles",
  {
    userId: text("user_id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    sharingEnabled: boolean("sharing_enabled").notNull().default(false),
    timeZone: text("time_zone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("shadowfit_profiles_username_idx").on(table.username)],
);

export const communityWorkoutSessions = pgTable(
  "shadowfit_workout_sessions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    clientSessionId: text("client_session_id").notNull(),
    workoutId: text("workout_id").notNull(),
    sets: integer("sets").notNull(),
    minutes: integer("minutes").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    localDay: date("local_day", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shadowfit_workout_user_client_idx").on(table.userId, table.clientSessionId),
    index("shadowfit_workout_user_day_idx").on(table.userId, table.localDay),
  ],
);

export const communityFriendRequests = pgTable(
  "shadowfit_friend_requests",
  {
    id: serial("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shadowfit_friend_request_pair_idx").on(table.requesterId, table.recipientId),
    index("shadowfit_friend_request_recipient_status_idx").on(table.recipientId, table.status),
  ],
);

export const communityFriendships = pgTable(
  "shadowfit_friendships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    friendUserId: text("friend_user_id")
      .notNull()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.friendUserId] }),
    index("shadowfit_friendships_friend_idx").on(table.friendUserId),
  ],
);

export type CommunityProfile = typeof communityProfiles.$inferSelect;
export type NewCommunityProfile = typeof communityProfiles.$inferInsert;
export type CommunityWorkoutSession = typeof communityWorkoutSessions.$inferSelect;
export type CommunityFriendRequest = typeof communityFriendRequests.$inferSelect;
export type CommunityFriendship = typeof communityFriendships.$inferSelect;