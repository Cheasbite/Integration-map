import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { db } from "@/lib/db";
import { floorsTable } from "@/lib/db/schema";

// ---- validation ----
const createFloorSchema = z.object({
  name: z.string().min(1, "name is required"),
  floorNumber: z.number().min(0),
  mapData: z.string(),
  height: z.number(),
  width: z.number(),
});

// GET /api/floors
// GET /api/floors?floorId=<uuid>  (optional single-floor lookup)
export async function GET(req: NextRequest) {
  try {
    const floorId = req.nextUrl.searchParams.get("floorId");

    // Floors are the parent table, not a node — query it directly.
    // Pull in its rooms/kiosks (via nodesTable) so the map can render
    // everything on the floor in one request.
    const floors = await db.query.floorsTable.findMany({
      where: floorId ? eq(floorsTable.id, floorId) : undefined,
      with: {
        nodes: {
          with: { room: true, kiosk: true },
        },
      },
    });

    return NextResponse.json({ data: floors }, { status: 200 });
  } catch (err) {
    console.error("GET /api/floors failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch floors" },
      { status: 500 }
    );
  }
}

// POST /api/floors
// body: { name: string, floorNumber: number, mapData: string, width: number, height: number }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createFloorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, floorNumber, mapData, width, height } = parsed.data;
    const id = uuidv7();

    // No transaction needed here — floors don't share an id with
    // nodesTable the way rooms/kiosks do. It's a single insert.
    const [floor] = await db
      .insert(floorsTable)
      .values({
        id,
        name,
        floorNumber,
        mapData,
        width,
        height,
      })
      .returning();

    return NextResponse.json({ data: floor }, { status: 201 });
  } catch (err) {
    console.error("POST /api/floors failed:", err);
    return NextResponse.json(
      { error: "Failed to create floor" },
      { status: 500 }
    );
  }
}

