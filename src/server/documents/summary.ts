import { serviceDocuments } from "@/server/db/schema";

/** The fields the documents step shows. Extracted text stays server-side. */
export const documentSummary = {
  id: serviceDocuments.id,
  kind: serviceDocuments.kind,
  fileName: serviceDocuments.fileName,
  sizeBytes: serviceDocuments.sizeBytes,
  textStatus: serviceDocuments.textStatus,
  createdAt: serviceDocuments.createdAt,
};
