import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Actor } from "@/lib/permissions";
import { DATA_DIR, db } from "./db";
import * as repo from "./repo";

const COOKIE = "sd_session";
const WS_COOKIE = "sd_workspace";

function secret(): string {
  if (process.env.SITEDESK_SECRET) return process.env.SITEDESK_SECRET;
  // Fixed at build time on a serverless host, where the file below would differ per instance
  // and every instance would reject the others' sessions. See next.config.mjs.
  if (process.env.SITEDESK_SESSION_SECRET) return process.env.SITEDESK_SESSION_SECRET;
  const file = path.join(DATA_DIR, ".secret");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"));
  return fs.readFileSync(file, "utf8").trim();
}

const sign = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("hex");

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${userId}.${sign(userId)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export interface CurrentUser {
  user: repo.UserRow;
  actor: Actor;
  workspaceId: string;
  workspaces: Array<{ id: string; name: string }>;
}

export async function currentUser(): Promise<CurrentUser | null> {
  db();
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  const userId = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (!userId || !sig || sig.length !== 64 || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(userId)))) return null;
  const user = repo.getUser(userId);
  const actor = repo.getActor(userId);
  if (!user || !actor) return null;
  // Workspaces this person can see: all for admins, otherwise those containing their clients.
  const all = repo.listWorkspaces();
  const clientWs = new Set(repo.listAllClients().filter((c) => actor.isAdmin || actor.roles[c.id]).map((c) => c.workspace_id));
  const workspaces = actor.isAdmin ? all : all.filter((w) => clientWs.has(w.id));
  const wanted = jar.get(WS_COOKIE)?.value;
  const workspaceId = workspaces.find((w) => w.id === wanted)?.id ?? workspaces[0]?.id ?? "ws_main";
  return { user, actor, workspaceId, workspaces };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function setWorkspace(id: string) {
  (await cookies()).set(WS_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
}
