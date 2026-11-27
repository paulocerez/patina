import type { CallResponse } from "./types";

class CallService {
  async listCalls(
    accountId: string,
    options: { limit: number; offset: number },
  ): Promise<{ items: CallResponse[]; total: number }> {
    return { items: [], total: 0 };
  }

  async findCall(id: string): Promise<CallResponse | null> {
    return null;
  }
}

export const callService = new CallService();
