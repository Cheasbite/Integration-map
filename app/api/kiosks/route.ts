import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { db } from "@/lib/db";
import { nodesTable, kiosksTable } from "@/lib/db/schema";

// ---- validation ----
const createKioskSchema = z.object({
  name: z.string().min(1, "name is required"),
  floorId: z.string().uuid("floorId must be a valid uuid"),
  px: z.number(),
  py: z.number(),
});

// GET /api/kiosks
// GET /api/kiosks?floorId=<uuid>  (optional filter)
export async function GET(req: NextRequest) {
  try {
    const floorId = req.nextUrl.searchParams.get("floorId");

    const kiosk = await db.query.nodesTable.findMany({
      where: floorId ? eq(nodesTable.floorId, floorId) : undefined,
      with: {
        kiosk: true,
      },
    });

    // nodesTable also matches kiosks, so filter to kiosks only
    // and flatten node + kiosk fields into one object per kiosk.
    const result = kiosk
      .filter((node) => node.type === "kiosk" && node.kiosk !== null)
      .map((node) => ({
        id: node.id,
        name: node.kiosk!.name,
        floorId: node.floorId,
        px: node.px,
        py: node.py,
      }));

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    console.error("GET /api/kiosks failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch kiosks" },
      { status: 500 }
    );
  }
}

// POST /api/kiosks
// body: { name: string, floorId: string, px: number, py: number }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createKioskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, floorId, px, py } = parsed.data;
    const id = uuidv7();

    // nodesTable + kioskTable share the same id, so both inserts
    // must succeed together or not at all.
    const created = await db.transaction(async (tx) => {
      await tx.insert(nodesTable).values({
        id,
        type: "kiosk",
        floorId,
        px,
        py,
      });

      const [kiosk] = await tx
        .insert(kiosksTable)
        .values({
          id,
          name,
        })
        .returning();

      return kiosk;
    });

    return NextResponse.json(
      { data: { id, name: created.name, floorId, px, py } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/kiosks failed:", err);
    return NextResponse.json(
      { error: "Failed to create kiosk" },
      { status: 500 }
    );
  }
}

