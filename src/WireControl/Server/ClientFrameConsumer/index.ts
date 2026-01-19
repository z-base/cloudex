import { decode } from "@msgpack/msgpack";
import { wcpVersion } from "../..";
import { CloudexError } from "../../../Errors";
import {
  clientFrameCodeMap,
  type CloudexClientFrameType,
  type CloudexClientWireMessage,
  type MessageFor as ClientMessageFor,
  validateConfigMessage,
  validateStateMessage,
  validateVerificationMessage,
  validateRequestMessage,
} from "../../Client/messages";

export function consumeClientFrame(
  frame: Uint8Array<ArrayBuffer>,
): CloudexClientWireMessage {
  assertFrameHeader(frame);

  const code = frame[1];
  const type = clientFrameCodeMap[code];
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
  type: CloudexClientFrameType,
  payload: Uint8Array<ArrayBuffer>,
): ClientMessageFor<CloudexClientFrameType> {
  switch (type) {
    case "submit-verification": {
      const decoded = decodePayload(type, payload);
      return validateVerificationMessage(decoded, type);
    }
    case "submit-config": {
      const decoded = decodePayload(type, payload);
      return validateConfigMessage(decoded, type);
    }
    case "submit-snapshot":
    case "submit-delta": {
      const decoded = decodePayload(type, payload);
      return validateStateMessage(decoded, type);
    }
    case "submit-request": {
      const decoded = decodePayload(type, payload);
      return validateRequestMessage(decoded, type);
    }
  }
}

function decodePayload(
  type: CloudexClientFrameType,
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
