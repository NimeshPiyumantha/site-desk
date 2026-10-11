import { notFound } from "next/navigation";
import TeamPanel from "@/components/admin/TeamPanel";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";
import { listTeam } from "@/server/services";

export default async function TeamPage() {
  const u = await requireUser();
  if (!can(u.actor, "team.manage")) notFound();
  const { members, clients } = listTeam(u.actor, u.workspaceId);
  const ws = repo.getWorkspace(u.workspaceId)!;
  return <TeamPanel members={members} clients={clients.map((c) => ({ id: c.id, name: c.name }))} workspaceName={ws.name} />;
}
