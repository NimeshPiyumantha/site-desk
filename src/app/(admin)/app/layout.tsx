import Shell from "@/components/admin/Shell";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  return (
    <Shell userName={u.user.name} userTitle={u.user.title} isAdmin={u.actor.isAdmin} workspaceId={u.workspaceId} workspaces={u.workspaces}>
      {children}
    </Shell>
  );
}
