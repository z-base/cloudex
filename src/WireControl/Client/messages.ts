import { CloudexError } from "../../Errors";

export type CloudexClientFrameType =
  | "submit-verification"
  | "submit-config"
  | "submit-snapshot"
  | "submit-delta"
  | "submit-request";

export type CloudexClientFrameHexCodes = 0x50 | 0x51 | 0x52 | 0x53 | 0x54;

export type CloudexState = {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
};

export type CloudexVerification = {
  signature: ArrayBuffer;
};

export type CloudexConfig = {
  id: Base64URLString;
  jwk: JsonWebKey;
  state: {
    iv: Uint8Array;
    ciphertext: ArrayBuffer;
  };
};

export type CloudexRequest = {
  token: Base64URLString;
};

export type CloudexClientMessageType =
  | CloudexState
  | CloudexVerification
  | CloudexConfig
  | CloudexRequest;

export const clientFrameMap: Record<CloudexClientFrameType, number> = {
  "submit-verification": 0x50,
  "submit-config": 0x51,
  "submit-snapshot": 0x52,
  "submit-delta": 0x53,
  "submit-request": 0x54,
};

export const clientFrameCodeMap: Record<number, CloudexClientFrameType> = {
  0x50: "submit-verification",
  0x51: "submit-config",
  0x52: "submit-snapshot",
  0x53: "submit-delta",
  0x54: "submit-request",
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

export function validateStateMessage(
  message: unknown,
  context = "client-state",
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

export function validateVerificationMessage(
  message: unknown,
  context = "client-verification",
): CloudexVerification {
  if (typeof message !== "object" || message === null) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  const candidate = message as Partial<CloudexVerification>;
  const signature = normalizeArrayBuffer(candidate.signature);
  if (!signature) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  return { signature };
}

export function validateConfigMessage(
  message: unknown,
  context = "client-config",
): CloudexConfig {
  if (typeof message !== "object" || message === null) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  const candidate = message as Partial<CloudexConfig>;
  if (typeof candidate.id !== "string") {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }
  if (typeof candidate.jwk !== "object" || candidate.jwk === null) {
    throw new CloudexError(
      `Wire control invalid message for ${context}`,
      "wire-control/invalid-message",
    );
  }

  const state = validateStateMessage(candidate.state, `${context}.state`);

  return {
    id: candidate.id,
    jwk: candidate.jwk,
    state,
  };
}

export function validateRequestMessage(
  message: unknown,
  context = "client-request",
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

export type MessageFor<T extends CloudexClientFrameType> =
  T extends "submit-verification" ? CloudexVerification
  : T extends "submit-config" ? CloudexConfig
  : T extends "submit-snapshot" ? CloudexState
  : T extends "submit-delta" ? CloudexState
  : T extends "submit-request" ? CloudexRequest
  : never;

export type CloudexClientWireMessage<
  T extends CloudexClientFrameType = CloudexClientFrameType,
> = {
  type: T;
  message: MessageFor<T>;
};
