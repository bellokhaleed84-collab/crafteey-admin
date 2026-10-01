import AuditLog from "@/models/AuditLog";
import type { AdminContext } from "@/middleware/adminAuth";

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
}

/** Record what an admin did. A failure to log is reported but never breaks the action itself. */
export async function logAudit(admin: AdminContext, entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      actorUid: admin.uid,
      actorEmail: admin.email,
      actorName: admin.name,
      actorRole: admin.role,
      ...entry,
    });
  } catch (err) {
    console.error("[audit] failed to write entry", entry.action, err);
  }
}