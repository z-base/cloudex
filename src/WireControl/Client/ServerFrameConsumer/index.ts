import { decode } from "@msgpack/msgpack";
import { wcpVersion } from "../..";
import { CloudexError } from "../../../Errors";
import {
  serverFrameCodeMap,
  type CloudexServerFrameType,
  type CloudexServerWireMessage,
  type MessageFor as ServerMessageFor,
  validateOfferConfigMessage,
  validateRequestMessage,
  validateSignalMessage,
  validateStateMessage,
} from "../../Server/messages";

export function consumeServerFrame(
  frame: Uint8Array<ArrayBuffer>,
): CloudexServerWireMessage {
  assertFrameHeader(frame);

  const code = frame[1];
  const type = serverFrameCodeMap[code];
  if (!type) {
    throw new CloudexError(
      `Wire control unknown frame code: 0x${toHexByte(code)}`,
      "wire-control/unknown-frame-code",
    );
  }

  const payload = frame.subarray(2);
  const message = parsePayload(type, payload);

  return { type, message };
}

function assertFrameHeader(frame: Uint8Array<ArrayBuffer>): void {
  if (frame.length < 2) {
    throw new CloudexError(
      `Wire control frame too short: ${frame.length} bytes`,
      "wire-control/invalid-frame-length",
    );
  }

  const version = frame[0];
  if (version !== wcpVersion) {
    throw new CloudexError(
      `Wire control version mismatch: expected 0x${toHexByte(
        wcpVersion,
      )}, received 0x${toHexByte(version)}`,
      "wire-control/invalid-version",
    );
  }
}

function parsePayload(
  type: CloudexServerFrameType,
  payload: Uint8Array<ArrayBuffer>,
): ServerMessageFor<CloudexServerFrameType> {
  switch (type) {
    case "require-verification":
    case "require-config": {
      if (payload.length !== 0) {
        throw new CloudexError(
          `Wire control payload invalid for ${type}`,
          "wire-control/invalid-payload",
        );
      }
      return validateSignalMessage(null, type);
    }
    case "offer-config": {
      const decoded = decodePayload(type, payload);
      return validateOfferConfigMessage(decoded, type);
    }
    case "offer-snapshot":
    case "forward-delta":
    case "forward-response": {
      const decoded = decodePayload(type, payload);
      return validateStateMessage(decoded, type);
    }
    case "forward-request": {
      const decoded = decodePayload(type, payload);
      return validateRequestMessage(decoded, type);
    }
  }
}

function decodePayload(
  type: CloudexServerFrameType,
  payload: Uint8Array<ArrayBuffer>,
): unknown {
  if (payload.length === 0) {
    throw new CloudexError(
      `Wire control payload invalid for ${type}`,
      "wire-control/invalid-payload",
    );
  }

  try {
    return decode(payload);
  } catch {
    throw new CloudexError(
      `Wire control payload invalid for ${type}`,
      "wire-control/invalid-payload",
    );
  }
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}
