import { CloudexError } from "../../Errors";

export type CloudexServerFrameType =
  | "require-verification"
  | "require-config"
  | "offer-config"
  | "offer-snapshot"
  | "forward-delta"
  | "forward-request"
  | "forward-response";

export type CloudexServerFrameHexCodes =
  | 0x00
  | 0x01
  | 0x02
  | 0x04
  | 0x05
  | 0x06
  | 0x07;

export type CloudexState = {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
};

export type CloudexRequest = {
  token: Base64URLString;
};

export type CloudexConfigOffer = {
  id: Base64URLString;
};

export type CloudexServerSignal = null;

export type CloudexServerMessageType =
  | CloudexServerSignal
  | CloudexConfigOffer
  | CloudexState
  | CloudexRequest;

export const serverFrameMap: Record<CloudexServerFrameType, number> = {
  "require-verification": 0x00,
  "require-config": 0x01,
  "offer-config": 0x02,
  "offer-snapshot": 0x04,
  "forward-delta": 0x05,
  "forward-request": 0x06,
  "forward-response": 0x07,
};

export const serverFrameCodeMap: Record<number, CloudexServerFrameType> = {
  0x00: "require-verification",
  0x01: "require-config",
  0x02: "offer-config",
  0x04: "offer-snapshot",
  0x05: "forward-delta",
  0x06: "forward-request",
  0x07: "forward-response",
};

function normalizeUint8Array(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return;
}

function normalizeArrayBuffer(value: unknown): ArrayBuffer | undefined {
  if (value instanceof ArrayBuffer) return value;
  if (value instanceof Uint8Array) {
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    ) as ArrayBuffer;
  }
  return;
}

export function validateSignalMessage(
  message: unknown,
  context = "server-signal",
): CloudexServerSignal {
  if (message !== null && message !== undefined) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  return null;
}

export function validateOfferConfigMessage(
  message: unknown,
  context = "server-offer-config",
): CloudexConfigOffer {
  if (typeof message !== "object" || message === null) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  const candidate = message as Partial<CloudexConfigOffer>;
  if (typeof candidate.id !== "string") {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  return { id: candidate.id };
}

export function validateStateMessage(
  message: unknown,
  context = "server-state",
): CloudexState {
  if (typeof message !== "object" || message === null) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  const candidate = message as Partial<CloudexState>;
  const iv = normalizeUint8Array(candidate.iv);
  if (!iv) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  const ciphertext = normalizeArrayBuffer(candidate.ciphertext);
  if (!ciphertext) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  return {
    iv,
    ciphertext,
  };
}

export function validateRequestMessage(
  message: unknown,
  context = "server-request",
): CloudexRequest {
  if (typeof message !== "object" || message === null) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  const candidate = message as Partial<CloudexRequest>;
  if (typeof candidate.token !== "string") {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  return { token: candidate.token };
}

export type MessageFor<T extends CloudexServerFrameType> =
  T extends "require-verification" ? CloudexServerSignal
  : T extends "require-config" ? CloudexServerSignal
  : T extends "offer-config" ? CloudexConfigOffer
  : T extends "offer-snapshot" ? CloudexState
  : T extends "forward-delta" ? CloudexState
  : T extends "forward-request" ? CloudexRequest
  : T extends "forward-response" ? CloudexState
  : never;

export type CloudexServerWireMessage<
  T extends CloudexServerFrameType = CloudexServerFrameType,
> = {
  type: T;
  message: MessageFor<T>;
};
