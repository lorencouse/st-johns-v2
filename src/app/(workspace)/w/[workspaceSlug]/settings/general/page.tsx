import { requireWorkspaceMember } from "@/lib/workspace";
import { GeneralSettingsForm } from "@/components/workspace/general-settings-form";

export default async function SettingsGeneralPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace, role } = await requireWorkspaceMember(workspaceSlug);

  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">General</h1>
      <div className="mt-6 max-w-lg">
        <GeneralSettingsForm
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          name={workspace.name}
          timezone={workspace.timezone}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
