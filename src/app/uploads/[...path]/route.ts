import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Fallback handler to serve uploaded files even when Next static serving misses.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: filePathSegments } = await params;
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      ...filePathSegments
    );

    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ({
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      } as Record<string, string>)[ext] || "application/octet-stream";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.warn("[uploads-route] File not found", filePathSegments, error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
