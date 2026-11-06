import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import { auditEvents, serviceDocuments } from "@/server/db/schema";
import { deleteObject, getObject, isStorageConfigured } from "@/server/storage/r2";

type Params = {
  params: Promise<{ workspaceId: string; videoId: string; documentId: string }>;
};

async function findDocument(workspaceId: string, videoId: string, documentId: string) {
  // Ids come from the URL; a malformed one simply matches nothing.
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return null;
  const [doc] = await db
    .select()
    .from(serviceDocuments)
    .where(
      and(
        eq(serviceDocuments.id, documentId),
        eq(serviceDocuments.workspaceId, workspaceId),
        eq(serviceDocuments.sourceVideoId, videoId)
      )
    )
    .limit(1);
  return doc ?? null;
}

/** Opens the original file, for anyone in the workspace. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { workspaceId, videoId, documentId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Document storage isn't set up." }, { status: 503 });
  }

  const doc = await findDocument(workspaceId, videoId, documentId);
  if (!doc) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const res = await getObject(doc.storageKey).catch(() => null);
  if (!res?.ok || !res.body) {
    return NextResponse.json({ error: "We couldn't open that file." }, { status: 502 });
  }
  const asciiName = doc.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { workspaceId, videoId, documentId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;
  if (!["owner", "admin", "editor"].includes(ctx.role)) {
    return NextResponse.json(
      { error: "You need editing access to remove documents." },
      { status: 403 }
    );
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Document storage isn't set up." }, { status: 503 });
  }

  const doc = await findDocument(workspaceId, videoId, documentId);
  if (!doc) return NextResponse.json({ error: "File not found" }, { status: 404 });

  try {
    await deleteObject(doc.storageKey);
  } catch (err) {
    console.error("[documents] delete from storage failed", err);
    return NextResponse.json(
      { error: "We couldn't remove that file. Try again in a moment." },
      { status: 502 }
    );
  }

  await db.delete(serviceDocuments).where(eq(serviceDocuments.id, doc.id));
  await db.insert(auditEvents).values({
    workspaceId,
    actorUserId: ctx.userId,
    eventKey: "document.removed",
    entityType: "service_document",
    entityId: doc.id,
    summary: `Removed ${doc.kind} document "${doc.fileName}"`,
  });

  return NextResponse.json({ ok: true });
}
