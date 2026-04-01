import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ATTACHMENTS_DIR = path.join(process.cwd(), "app", "attachments");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".sql": "application/sql; charset=utf-8",
};

function getContentType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function isValidFileName(fileName: string) {
  return Boolean(fileName) && fileName === path.basename(fileName) && !fileName.includes("\0");
}

type RouteParams = {
  filename?: string | string[];
};

type RouteContext = {
  params: RouteParams | Promise<RouteParams>;
};

async function getRequestedFileName(context: RouteContext) {
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

  if (!isValidFileName(fileName)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  try {
    const filePath = path.join(ATTACHMENTS_DIR, fileName);
    const buffer = await fs.readFile(filePath);

    return new Response(buffer, {
      headers: {
        "Content-Type": getContentType(fileName),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
