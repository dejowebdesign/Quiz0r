import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateThemeJson } from "@/lib/theme";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/themes - List themes (admin only)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const themes = await prisma.theme.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ themes });
  } catch (error) {
    console.error("Failed to fetch themes:", error);
    return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 });
  }
}

// POST /api/themes - Create theme (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const theme = body.theme as string | undefined;
    const description = (body.description as string | undefined)?.trim() || null;

    if (!theme) {
      return NextResponse.json({ error: "Theme JSON is required" }, { status: 400 });
    }

    const validationError = validateThemeJson(theme);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const parsed = JSON.parse(theme);
    const name = parsed.name as string;

    const created = await prisma.theme.create({
      data: {
        name,
        description,
        theme,
      },
    });

    return NextResponse.json({ theme: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create theme:", error);

    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "A theme with this name already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create theme" }, { status: 500 });
  }
}
