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
    // Path-traversal hardening: reject any segment that could escape the
    // uploads directory (relative paths, drive letters, NUL bytes).
    if (
      filePathSegments.some((seg) =>
        /(^|[\\/])\.\.([\\/]|$)/.test(seg) ||
        seg.includes("\0") ||
        /^[a-zA-Z]:/.test(seg)
      )
    ) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadsRoot, ...filePathSegments);

    // Confirm the resolved path is still inside the uploads root.
    const resolved = path.resolve(filePath);
    const root = path.resolve(uploadsRoot);
    if (
      resolved !== root &&
      !resolved.startsWith(root + path.sep)
    ) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const data = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
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
