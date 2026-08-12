import type { MeetingStatus } from "@/lib/types/database";

export const MEETING_NOT_LIVE_ERROR =
  "La reunión todavía no está en vivo. Esperá a que la anfitriona la inicie.";

export const MEETING_ENDED_ERROR = "Esta reunión ya finalizó.";

export type MeetingTokenAccessInput = {
  status: MeetingStatus | string;
  hostId: string;
  userId: string;
  isAdmin: boolean;
};

export type MeetingTokenAccessDecision =
  | { ok: true; shouldStart: boolean; isHost: boolean }
  | { ok: false; httpStatus: 409 | 410; error: string };

export function decideMeetingTokenAccess(
  input: MeetingTokenAccessInput
): MeetingTokenAccessDecision {
  const isHost = input.hostId === input.userId || input.isAdmin;

  if (input.status === "ended") {
    return { ok: false, httpStatus: 410, error: MEETING_ENDED_ERROR };
  }

  if (input.status === "live") {
    return { ok: true, shouldStart: false, isHost };
  }

  if (isHost) {
    return { ok: true, shouldStart: true, isHost };
  }

  return { ok: false, httpStatus: 409, error: MEETING_NOT_LIVE_ERROR };
}
