import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { serviceDocuments } from "@/server/db/schema";
import { buildReferenceText } from "./reference-text";

/** The service's readable documents as one reference block, or null. */
export async function loadReferenceText(
  workspaceId: string,
  videoId: string
): Promise<{ text: string | null; documentCount: number }> {
  const docs = await db
    .select({
      kind: serviceDocuments.kind,
      fileName: serviceDocuments.fileName,
      extractedText: serviceDocuments.extractedText,
    })
    .from(serviceDocuments)
    .where(
      and(
        eq(serviceDocuments.workspaceId, workspaceId),
        eq(serviceDocuments.sourceVideoId, videoId),
        eq(serviceDocuments.textStatus, "done")
      )
    )
    .orderBy(asc(serviceDocuments.createdAt));
  return { text: buildReferenceText(docs), documentCount: docs.length };
}
