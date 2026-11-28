export type CallStatus = "new" | "completed" | "missed";

export interface CallResponse {
  id: string;
  startedAt: Date | null;
  duration: number | null;
  status: CallStatus;
  transcriptStatus: string | null;
  fromNumber: string;
  mainTask: string | null;
}
