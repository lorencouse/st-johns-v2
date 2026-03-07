import { requireWorkspaceMember } from "@/lib/workspace";

export default async function SettingsGeneralPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">General Settings</h1>
      <div className="mt-6 max-w-lg space-y-4">
        <div>
          <label className="text-sm font-medium">Workspace name</label>
          <p className="mt-1 text-sm">{workspace.name}</p>
        </div>
        <div>
          <label className="text-sm font-medium">Slug</label>
          <p className="mt-1 font-mono text-sm">{workspace.slug}</p>
        </div>
        <div>
          <label className="text-sm font-medium">Timezone</label>
          <p className="mt-1 text-sm">{workspace.timezone}</p>
        </div>
      </div>
    </div>
  );
}
