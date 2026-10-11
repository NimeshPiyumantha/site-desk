/**
 * Who can do what. People are given a role per client; admins can do everything everywhere.
 * Every server action checks `can(...)` before doing anything – the screens only hide buttons
 * for convenience.
 */
export type Role = "editor" | "publisher";

export type Action =
  | "site.view"
  | "site.edit" // change the draft, import translations
  | "site.requestReview"
  | "site.publish" // make changes live, bulk publish
  | "site.restore" // go back to an earlier version, restore a backup
  | "site.backup"
  | "site.settings" // analytics IDs, web address, notes
  | "site.create" // copy a website for a new campaign
  | "leads.view"
  | "site.transfer" // export/import between workspaces
  | "team.manage" // add people and decide which clients they work on
  | "admin.demo"; // demo controls (e.g. simulate a failed launch)

const ROLE_ACTIONS: Record<Role, Action[]> = {
  editor: ["site.view", "site.edit", "site.requestReview"],
  publisher: ["site.view", "site.edit", "site.requestReview", "site.publish", "site.restore", "site.backup", "site.settings", "site.create", "leads.view"],
};

export const ROLE_LABELS: Record<Role | "admin", { name: string; summary: string }> = {
  editor: { name: "Content editor", summary: "Prepares changes and sends them for review. Cannot make anything live." },
  publisher: { name: "Reviewer / publisher", summary: "Reviews changes and decides when they go live. Can restore earlier versions." },
  admin: { name: "Operations admin", summary: "Everything, for every client, including transfers between workspaces." },
};

export interface Actor {
  id: string;
  isAdmin: boolean;
  /** clientId → role */
  roles: Record<string, Role>;
}

export function can(actor: Actor | null, action: Action, clientId?: string): boolean {
  if (!actor) return false;
  if (actor.isAdmin) return true;
  if (action === "site.transfer" || action === "team.manage" || action === "admin.demo") return false;
  if (!clientId) return false;
  const role = actor.roles[clientId];
  return role ? ROLE_ACTIONS[role].includes(action) : false;
}

export function visibleClientIds(actor: Actor, allClientIds: string[]): string[] {
  return actor.isAdmin ? allClientIds : allClientIds.filter((id) => actor.roles[id]);
}

export class PermissionError extends Error {
  constructor(message = "You don't have permission to do this for this client. Ask an operations admin if you need access.") {
    super(message);
  }
}
