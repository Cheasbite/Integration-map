import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { db } from "@/lib/db";
import { nodesTable, roomsTable } from "@/lib/db/schema";

// ---- validation ----
const createRoomSchema = z.object({
  name: z.string().min(1, "name is required"),
  floorId: z.string().uuid("floorId must be a valid uuid"),
  px: z.number(),
  py: z.number(),
});

// GET /api/rooms
// GET /api/rooms?floorId=<uuid>  (optional filter)
export async function GET(req: NextRequest) {
  try {
    const floorId = req.nextUrl.searchParams.get("floorId");

    const rooms = await db.query.nodesTable.findMany({
      where: floorId ? eq(nodesTable.floorId, floorId) : undefined,
      with: {
        room: true,
      },
    });

    // nodesTable also matches kiosks, so filter to rooms only
    // and flatten node + room fields into one object per room.
    const result = rooms
      .filter((node) => node.type === "room" && node.room !== null)
      .map((node) => ({
        id: node.id,
        name: node.room!.name,
        floorId: node.floorId,
        px: node.px,
        py: node.py,
      }));

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    console.error("GET /api/rooms failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    );
  }
}

// POST /api/rooms
// body: { name: string, floorId: string, px: number, py: number }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, floorId, px, py } = parsed.data;
    const id = uuidv7();

    // nodesTable + roomsTable share the same id, so both inserts
    // must succeed together or not at all.
    const created = await db.transaction(async (tx) => {
      await tx.insert(nodesTable).values({
        id,
        type: "room",
        floorId,
        px,
        py,
      });

      const [room] = await tx
        .insert(roomsTable)
        .values({
          id,
          name,
        })
        .returning();

      return room;
    });

    return NextResponse.json(
      { data: { id, name: created.name, floorId, px, py } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/rooms failed:", err);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}

