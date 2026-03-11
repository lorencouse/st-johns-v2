import { SettingsNav } from "@/components/workspace/settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <div className="flex h-full">
      <SettingsNav workspaceSlug={workspaceSlug} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
