import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateThemeJson } from "@/lib/theme";
import { requireAdmin } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ themeId: string }>;
}

// GET /api/themes/[themeId] - Fetch a theme (admin only)
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { themeId } = await context.params;

    const theme = await prisma.theme.findUnique({
      where: { id: themeId },
    });

    if (!theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    return NextResponse.json({ theme });
  } catch (error) {
    console.error("Failed to fetch theme:", error);
    return NextResponse.json({ error: "Failed to fetch theme" }, { status: 500 });
  }
}

// PUT /api/themes/[themeId] - Update a theme (admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { themeId } = await context.params;
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

    const updated = await prisma.theme.update({
      where: { id: themeId },
      data: {
        name,
        description,
        theme,
      },
    });

    return NextResponse.json({ theme: updated });
  } catch (error) {
    console.error("Failed to update theme:", error);

    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "A theme with this name already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update theme" }, { status: 500 });
  }
}

// DELETE /api/themes/[themeId] - Delete a theme (admin only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { themeId } = await context.params;

    await prisma.theme.delete({
      where: { id: themeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete theme:", error);
    return NextResponse.json({ error: "Failed to delete theme" }, { status: 500 });
  }
}
