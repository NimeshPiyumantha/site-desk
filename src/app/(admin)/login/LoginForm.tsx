"use client";
import { useActionState, useRef } from "react";
import { loginAction } from "@/server/actions";

export default function LoginForm({ users }: { users: Array<{ email: string; name: string; title: string }> }) {
  const [state, action, pending] = useActionState(loginAction, {});
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="mt-4 space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input ref={emailRef} id="email" name="email" type="email" required className="input" defaultValue="amara@sitedesk.demo" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input ref={passRef} id="password" name="password" type="password" required className="input" defaultValue="demo1234" />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <div className="border-t border-surface-line pt-5">
        <p className="section-title">Demo team – click to sign in as</p>
        <ul className="mt-3 space-y-1.5">
          {users.map((u) => (
            <li key={u.email}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-sm transition-colors hover:border-surface-line hover:bg-surface-sunken"
                onClick={() => {
                  emailRef.current!.value = u.email;
                  passRef.current!.value = "demo1234";
                  formRef.current!.requestSubmit();
                }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-light text-xs font-semibold text-brand-dark" aria-hidden>
                  {u.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-ink-soft">{u.title}</span>
                </span>
                <span className="ml-auto text-ink-faint" aria-hidden>→</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="hint">All demo accounts use the password <code className="rounded bg-surface-sunken px-1 py-0.5">demo1234</code>.</p>
      </div>
    </form>
  );
}
