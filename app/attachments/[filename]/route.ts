import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Files are stored OUTSIDE the web root in the 'uploads' directory
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Allowlist of permitted file extensions (case-insensitive)
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".sql",
]);

// Map extensions to safe Content-Types
const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".sql": "application/sql; charset=utf-8",
};

// Extensions that should ALWAYS be served as download (attachment), never inline
// This prevents HTML/JS execution even if the file somehow contains HTML
const ALWAYS_DOWNLOAD_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".sql", ".txt", ".csv"]);

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Validate filename to prevent path traversal attacks
 */
function isValidFileName(fileName: string): { valid: boolean; error?: string } {
  // Check for empty filename
  if (!fileName || fileName.trim() === "") {
    return { valid: false, error: "Invalid file name" };
  }

  // Check for path traversal (prevent ../ or ..\\)
  if (fileName.includes("..") || fileName.includes("/../") || fileName.includes("\\..\\")) {
    return { valid: false, error: "Invalid file name: path traversal detected" };
  }

  // Use path.basename to ensure no directory separators
  const baseName = path.basename(fileName);
  if (baseName !== fileName) {
    return { valid: false, error: "Invalid file name" };
  }

  // Check for null bytes
  if (fileName.includes("\0")) {
    return { valid: false, error: "Invalid file name" };
  }

  // Check for forbidden patterns
  if (fileName.includes("%00")) {
    return { valid: false, error: "Invalid file name" };
  }

  // Validate extension
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: "File type not allowed" };
  }

  // Check file exists
  const filePath = path.join(UPLOADS_DIR, fileName);
  return { valid: true, filePath };
}

type RouteParams = {
  filename?: string | string[];
};

type RouteContext = {
  params: RouteParams | Promise<RouteParams>;
};

async function getRequestedFileName(context: RouteContext): Promise<string> {
  const params = await context.params;
  const rawFileName = Array.isArray(params.filename)
    ? params.filename[0]
    : params.filename;

  return decodeURIComponent(String(rawFileName ?? ""));
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const fileName = await getRequestedFileName(context);

  // Validate filename
  const validation = isValidFileName(fileName);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || "Invalid file name" },
      { status: 400 },
    );
  }

  const filePath = validation.filePath;

  try {
    // Verify file exists
    if (!fs.access(filePath).then(() => true, () => false)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file stats to verify it's a regular file (not symlink to dangerous location)
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check file size (max 10MB to prevent memory exhaustion)
    if (stats.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const buffer = await fs.readFile(filePath);

    // Get content type
    const contentType = getContentType(fileName);
    const extension = path.extname(fileName).toLowerCase();

    // Build security headers
    const headers = new Headers();

    // Always add X-Content-Type-Options: nosniff
    headers.set("X-Content-Type-Options", "nosniff");

    // Always add X-Frame-Options to prevent clickjacking
    headers.set("X-Frame-Options", "DENY");

    // Set Content-Security-Policy
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'self' data:; script-src 'none'; style-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none';",
    );

    // Set Content-Type
    headers.set("Content-Type", contentType);

    // Determine Content-Disposition
    // Always use 'attachment' for potentially dangerous types
    // For images, we allow 'inline' but still with strict CSP
    const shouldForceDownload = ALWAYS_DOWNLOAD_EXTENSIONS.has(extension);
    const contentDisposition = shouldForceDownload
      ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;

    headers.set("Content-Disposition", contentDisposition);

    // Add Referrer-Policy
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Add Cache-Control for sensitive files
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("FILE DOWNLOAD ERROR:", error);

    if (error instanceof Error && "code" in error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT" || nodeError.code === "ENOTDIR") {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
