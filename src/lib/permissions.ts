/**
 * Who may do what in a workspace. This is the only place roles are listed, and
 * it has no server imports, so the screens and the API routes share it.
 */
const PERMISSIONS = {
  /** Change posts, transcripts and documents, and start processing. */
  edit: ["owner", "admin", "editor"],
  /** Approve a post or ask for changes. */
  review: ["owner", "admin", "reviewer"],
  /** Manage the workspace, its channels and its members. */
  admin: ["owner", "admin"],
} as const satisfies Record<string, readonly string[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
