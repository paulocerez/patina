import { z } from "zod";
export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  plan: z.enum(["free", "pro", "enterprise"]),
  createdAt: z.string().datetime(),
  lifetimeSpend: z.number().optional(),
});
