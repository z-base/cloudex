import { encode } from "@msgpack/msgpack";
import { wcpVersion } from "../..";
import { CloudexError } from "../../../Errors";
import {
  serverFrameMap,
  type CloudexServerFrameType,
  type MessageFor,
  validateOfferConfigMessage,
  validateRequestMessage,
  validateSignalMessage,
  validateStateMessage,
} from "../messages";

export function produceServerFrame<T extends CloudexServerFrameType>(
  type: T,
  message: MessageFor<T>,
): Uint8Array<ArrayBuffer> {
  const payload = processMessage(type, message);
  return buildFrame(type, payload);
}

function processMessage<T extends CloudexServerFrameType>(
  type: T,
  message: MessageFor<T>,
): Uint8Array<ArrayBuffer> {
  switch (type) {
    case "require-verification":
    case "require-config": {
      validateSignalMessage(message, type);
      return new Uint8Array(0);
    }
    case "offer-config": {
      const valid = validateOfferConfigMessage(message, type);
      return encode(valid);
    }
    case "offer-snapshot":
    case "forward-delta":
    case "forward-response": {
      const valid = validateStateMessage(message, type);
      return encode(normalizeStateForWire(valid));
    }
    case "forward-request": {
      const valid = validateRequestMessage(message, type);
      return encode(valid);
    }
  }
}

function buildFrame(
  type: CloudexServerFrameType,
  payload: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const frame = new Uint8Array(2 + payload.length);
  frame[0] = wcpVersion;
  frame[1] = serverFrameMap[type];
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
