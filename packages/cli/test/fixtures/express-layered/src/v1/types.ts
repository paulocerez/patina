import { z } from "zod";
// The public API's snake_case shape: a decoy the scan must not pick for /api/calls.
export const callResponse = z.object({
  id: z.string(),
  from_number: z.string(),
  call_topic: z.string(),
});
