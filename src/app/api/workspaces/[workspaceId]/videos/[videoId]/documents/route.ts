import { NextRequest, NextResponse } from "next/server";
import { and, asc, count, eq } from "drizzle-orm";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import {
  MAX_DOCUMENTS_PER_SERVICE,
  documentFormat,
  documentProblem,
  documentStorageKey,
  isDocumentKind,
  storedContentType,
} from "@/lib/documents";
import { db } from "@/server/db";
import { auditEvents, serviceDocuments, workspaceVideos } from "@/server/db/schema";
import { extractDocumentText } from "@/server/documents/extract";
import { documentSummary } from "@/server/documents/summary";
import { deleteObject, isStorageConfigured, putObject } from "@/server/storage/r2";

type Params = { params: Promise<{ workspaceId: string; videoId: string }> };

async function videoInWorkspace(workspaceId: string, videoId: string) {
  const [row] = await db
    .select({ videoId: workspaceVideos.videoId })
    .from(workspaceVideos)
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspaceId),
        eq(workspaceVideos.videoId, videoId)
      )
    )
    .limit(1);
  return !!row;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const documents = await db
    .select(documentSummary)
    .from(serviceDocuments)
    .where(
      and(
        eq(serviceDocuments.workspaceId, workspaceId),
        eq(serviceDocuments.sourceVideoId, videoId)
      )
    )
    .orderBy(asc(serviceDocuments.createdAt));

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { workspaceId, videoId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  if (!["owner", "admin", "editor"].includes(ctx.role)) {
    return NextResponse.json(
      { error: "You need editing access to add documents." },
      { status: 403 }
    );
  }
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Document upload isn't set up yet. Ask your administrator." },
      { status: 503 }
    );
  }
  if (!(await videoInWorkspace(workspaceId, videoId))) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (!isDocumentKind(kind)) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  }
  const problem = documentProblem(file);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(serviceDocuments)
    .where(
      and(
        eq(serviceDocuments.workspaceId, workspaceId),
        eq(serviceDocuments.sourceVideoId, videoId)
      )
    );
  if (existing >= MAX_DOCUMENTS_PER_SERVICE) {
    return NextResponse.json(
      { error: `A service can have up to ${MAX_DOCUMENTS_PER_SERVICE} files. Remove one first.` },
      { status: 400 }
    );
  }

  const format = documentFormat(file.type, file.name)!;
  const contentType = storedContentType(format, file.name);
  const bytes = await file.arrayBuffer();
  const id = crypto.randomUUID();
  const storageKey = documentStorageKey(workspaceId, videoId, id, file.name);

  try {
    await putObject(storageKey, bytes, contentType);
  } catch (err) {
    console.error("[documents] upload to storage failed", err);
    return NextResponse.json(
      { error: "We couldn't save that file. Try again in a moment." },
      { status: 502 }
    );
  }

  // Reading the text is best effort: the file is kept even when it can't be
  // read, and the page says so.
  let extractedText: string | null = null;
  try {
    extractedText = await extractDocumentText(bytes, format, contentType);
  } catch (err) {
    console.error("[documents] text extraction failed", err);
  }

  try {
    const [saved] = await db
      .insert(serviceDocuments)
      .values({
        id,
        workspaceId,
        sourceVideoId: videoId,
        kind,
        fileName: file.name.slice(0, 255),
        contentType,
        sizeBytes: file.size,
        storageKey,
        textStatus: extractedText ? "done" : "failed",
        extractedText,
        uploadedByUserId: ctx.userId,
      })
      .returning(documentSummary);

    await db.insert(auditEvents).values({
      workspaceId,
      actorUserId: ctx.userId,
      eventKey: "document.uploaded",
      entityType: "service_document",
      entityId: id,
      summary: `Added ${kind} document "${saved.fileName}"`,
    });

    return NextResponse.json({ document: saved }, { status: 201 });
  } catch (err) {
    // Don't leave an orphaned file in storage when the record didn't save.
    await deleteObject(storageKey).catch(() => {});
    console.error("[documents] saving the record failed", err);
    return NextResponse.json(
      { error: "We couldn't save that file. Try again in a moment." },
      { status: 500 }
    );
  }
}
