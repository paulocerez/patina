import type { PatinaContext } from "@patina-ui/server";

export interface DemoContext extends PatinaContext {
  name: string;
  permissions: string[];
  /** The clinic's subscription. Free clinics can customize, but not build new data views. */
  plan: "pro" | "free";
  /** Stand-in for a feature flag service (LaunchDarkly, PostHog, Unleash, …). */
  flags: { patina: boolean };
}

/** Demo users. A real host derives these from its own session. */
export const USERS: Record<string, DemoContext> = {
  alice: {
    userId: "alice",
    tenantId: "happy-paws",
    name: "Alice (practice manager)",
    permissions: ["finance.read"],
    plan: "pro",
    flags: { patina: true },
  },
  bob: {
    userId: "bob",
    tenantId: "happy-paws",
    name: "Bob (receptionist)",
    permissions: [],
    plan: "pro",
    flags: { patina: true },
  },
  carol: {
    userId: "carol",
    tenantId: "sunny-vets",
    name: "Carol (clinic on the free plan)",
    permissions: ["finance.read"],
    plan: "free",
    flags: { patina: true },
  },
  dan: {
    userId: "dan",
    tenantId: "sunny-vets",
    name: "Dan (feature flag off)",
    permissions: ["finance.read"],
    plan: "free",
    flags: { patina: false },
  },
};

export function userFromCookie(cookieHeader: string | null | undefined): DemoContext {
  const id = /(?:^|;\s*)demo_user=([a-z]+)/.exec(cookieHeader ?? "")?.[1] ?? "alice";
  return USERS[id] ?? (USERS.alice as DemoContext);
}
