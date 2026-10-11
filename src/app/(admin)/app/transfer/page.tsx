import { notFound } from "next/navigation";
import ImportPackage from "@/components/admin/ImportPackage";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import * as repo from "@/server/repo";

const STEPS = [
  { n: 1, title: "Export it", text: "In the workspace that has the website: open it › Settings › “Download website package”. Tick whether contact details and analytics IDs should travel with it." },
  { n: 2, title: "Switch workspace", text: "Use the Workspace box at the top of the screen to move to the workspace that should receive the website." },
  { n: 3, title: "Import it here", text: "Upload the file below and choose which client it belongs to. It arrives as a private draft – publish it when you are ready." },
];

export default async function TransferPage() {
  const u = await requireUser();
  if (!can(u.actor, "site.transfer")) notFound();
  const ws = repo.getWorkspace(u.workspaceId)!;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Transfer websites between workspaces</h1>
        <p className="page-lead">
          Move a finished website to another team or agency without rebuilding any of its pages. Enquiries, team access and internal notes never travel with it.
        </p>
      </div>

      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="card p-5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-light text-xs font-semibold text-brand-dark" aria-hidden>{s.n}</span>
            <p className="mt-3 font-medium">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.text}</p>
          </li>
        ))}
      </ol>

      <ImportPackage clients={repo.listClients(u.workspaceId).map((c) => ({ id: c.id, name: c.name }))} workspaceName={ws.name} />
    </div>
  );
}
