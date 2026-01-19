import { encode } from "@msgpack/msgpack";
import { wcpVersion } from "../..";

import {
  clientFrameMap,
  type CloudexClientFrameType,
  type MessageFor,
  validateConfigMessage,
  validateStateMessage,
  validateVerificationMessage,
  validateRequestMessage,
} from "../messages";
import { CloudexError } from "../../../Errors";

export function produceClientFrame<T extends CloudexClientFrameType>(
  type: T,
  message: MessageFor<T>,
): Uint8Array<ArrayBuffer> {
  const payload = processMessage(type, message);
  return buildFrame(type, payload);
}

function processMessage<T extends CloudexClientFrameType>(
  type: T,
  message: MessageFor<T>,
): Uint8Array<ArrayBuffer> {
  switch (type) {
    case "submit-verification": {
      const valid = validateVerificationMessage(message, type);
      return encode({
        signature: toUint8Array(valid.signature),
      });
    }
    case "submit-config": {
      const valid = validateConfigMessage(message, type);
      return encode({
        id: valid.id,
        jwk: valid.jwk,
        state: normalizeStateForWire(valid.state),
      });
    }
    case "submit-snapshot": {
      const valid = validateStateMessage(message, type);
      return encode(normalizeStateForWire(valid));
    }
    case "submit-delta": {
      const valid = validateStateMessage(message, type);
      return encode(normalizeStateForWire(valid));
    }
    case "submit-request": {
      const valid = validateRequestMessage(message, type);
      return encode(valid);
    }
  }

  throw new CloudexError(
    `Wire control message invalid for ${String(type)}`,
    "wire-control/invalid-message",
  );
}

function buildFrame(
  type: CloudexClientFrameType,
  payload: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const frame = new Uint8Array(2 + payload.length);
  frame[0] = wcpVersion;
  frame[1] = clientFrameMap[type];
  frame.set(payload, 2);
  return frame;
}

function toUint8Array(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function normalizeStateForWire(state: {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}): { iv: Uint8Array; ciphertext: Uint8Array } {
  return {
    iv: state.iv,
    ciphertext: toUint8Array(state.ciphertext),
  };
}
