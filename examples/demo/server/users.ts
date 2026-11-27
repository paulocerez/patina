import type { PatinaContext } from "@patina-ui/server";

export interface DemoContext extends PatinaContext {
  name: string;
  permissions: string[];
}

/** Demo users. A real host derives these from its own session. */
export const USERS: Record<string, DemoContext> = {
  alice: {
    userId: "alice",
    tenantId: "happy-paws",
    name: "Alice (practice manager)",
    permissions: ["finance.read"],
  },
  bob: { userId: "bob", tenantId: "happy-paws", name: "Bob (receptionist)", permissions: [] },
};

export function userFromCookie(cookieHeader: string | null | undefined): DemoContext {
  const id = /(?:^|;\s*)demo_user=([a-z]+)/.exec(cookieHeader ?? "")?.[1] ?? "alice";
  return USERS[id] ?? (USERS.alice as DemoContext);
}
