import crypto from "node:crypto";

/**
 * Sessions are signed with a secret that every running copy of the app has to agree on.
 *
 * A serverless host runs many isolated instances, each with its own temporary disk, so the
 * per-instance secret that auth.ts writes to the data directory makes instances disagree and
 * signs people straight back out. On such a host the secret is generated once here, during the
 * build, and inlined into the output, so every instance of one deployment shares it. Sessions
 * end when a new deployment replaces it, which is the right trade for a demo.
 *
 * Set SITEDESK_SECRET to pin it instead – the proper answer for anything long-lived. Running
 * locally there is only one copy of the app, so it keeps using the file in the data directory
 * and sessions survive a restart.
 */
const buildSecret = process.env.VERCEL && !process.env.SITEDESK_SECRET
  ? crypto.randomBytes(32).toString("hex")
  : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(buildSecret ? { env: { SITEDESK_SESSION_SECRET: buildSecret } } : {}),
  serverExternalPackages: ["better-sqlite3"],
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};
export default nextConfig;
