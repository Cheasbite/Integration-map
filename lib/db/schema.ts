import { pgTable, uuid, varchar, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const nodeTypeEnum = pgEnum("node_type", ["room", "kiosk", "waypoint"]);

export const floorsTable = pgTable("floors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  floorNumber: integer("floor_number").notNull(),
  mapData: varchar("map_data", { length: 2048 }),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// shared identity: anything that can sit on the map and be connected
export const nodesTable = pgTable("nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: nodeTypeEnum("type").notNull(),
  floorId: uuid("floor_id")
    .notNull()
    .references(() => floorsTable.id, { onDelete: "cascade" }),
  px: real("px").notNull(),
  py: real("py").notNull(),
});

// rooms: its own real table, just keyed off the shared node id
export const roomsTable = pgTable("rooms", {
  id: uuid("id")
    .primaryKey()
    .references(() => nodesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  // room-specific fields go here later, e.g. capacity, roomType, etc.
});

// kiosks: same idea
export const kiosksTable = pgTable("kiosks", {
  id: uuid("id")
    .primaryKey()
    .references(() => nodesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  // kiosk-specific fields go here later, e.g. screenResolution, kioskModel
});

export const edgesTable = pgTable("edges", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromNodeId: uuid("from_node_id")
    .notNull()
    .references(() => nodesTable.id, { onDelete: "cascade" }),
  toNodeId: uuid("to_node_id")
    .notNull()
    .references(() => nodesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// relations.ts
export const floorsRelations = relations(floorsTable, ({ many }) => ({
  nodes: many(nodesTable),
}));

export const nodesRelations = relations(nodesTable, ({ one, many }) => ({
  floor: one(floorsTable, {
    fields: [nodesTable.floorId],
    references: [floorsTable.id],
  }),
  room: one(roomsTable, {
    fields: [nodesTable.id],
    references: [roomsTable.id],
  }),
  kiosk: one(kiosksTable, {
    fields: [nodesTable.id],
    references: [kiosksTable.id],
  }),
  outgoingEdges: many(edgesTable, { relationName: "from" }),
  incomingEdges: many(edgesTable, { relationName: "to" }),
}));

export const roomsRelations = relations(roomsTable, ({ one }) => ({
  node: one(nodesTable, {
    fields: [roomsTable.id],
    references: [nodesTable.id],
  }),
}));

export const kiosksRelations = relations(kiosksTable, ({ one }) => ({
  node: one(nodesTable, {
    fields: [kiosksTable.id],
    references: [nodesTable.id],
  }),
}));

export const edgesRelations = relations(edgesTable, ({ one }) => ({
  fromNode: one(nodesTable, {
    fields: [edgesTable.fromNodeId],
    references: [nodesTable.id],
    relationName: "from",
  }),
  toNode: one(nodesTable, {
    fields: [edgesTable.toNodeId],
    references: [nodesTable.id],
    relationName: "to",
  }),
}));

