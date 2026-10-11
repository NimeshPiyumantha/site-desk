import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { DEMO_USERS } from "@/server/seed";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/app");
  return (
    <main className="min-h-screen bg-surface-sunken">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 md:min-h-screen md:grid-cols-2 md:py-10">
        <div>
          <p className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-brand">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-sm">S</span>
            SiteDesk
          </p>
          <h1 className="mt-5 font-serif text-4xl leading-tight tracking-tight sm:text-[2.75rem]">
            Launch and look after client websites – without waiting for a developer.
          </h1>
          <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
            Copy a website for a new campaign, add languages, update offers on many websites at once, check before publishing, and go back if something goes wrong.
          </p>
          <ul className="mt-7 grid gap-2.5 text-sm text-ink-soft">
            {[
              "Nothing reaches visitors until someone publishes it",
              "Every change is recorded, with who made it",
              "A failed launch never takes the live website down",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-live-light text-[10px] font-bold text-live" aria-hidden>✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="card-raised p-7">
          <h2>Sign in</h2>
          <LoginForm users={DEMO_USERS.map((u) => ({ email: u.email, name: u.name, title: u.title }))} />
        </div>
      </div>
    </main>
  );
}
