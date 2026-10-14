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
    <div className="flex flex-col md:h-full md:flex-row">
      <SettingsNav workspaceSlug={workspaceSlug} />
      <div className="min-w-0 flex-1 md:overflow-y-auto">{children}</div>
    </div>
  );
}
