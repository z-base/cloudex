import test from "node:test";
import assert from "node:assert/strict";

import {
  wcpVersion,
  ClientWireController,
  ServerWireController,
} from "./index.ts";
import { CloudexError } from "../Errors/index.ts";

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(0);
}

function bytesEqual(a, b) {
  const left = toBytes(a);
  const right = toBytes(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function expectCloudexError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof CloudexError);
    assert.equal(error.code, code);
    return true;
  });
}

const sampleState = {
  iv: new Uint8Array([1, 2, 3, 4]),
  ciphertext: new Uint8Array([5, 6, 7, 8]),
};

const sampleConfig = {
  id: "resource-alpha",
  jwk: { kty: "oct", k: "alpha", alg: "HS256", ext: true },
  state: sampleState,
};

const sampleSignature = new Uint8Array([9, 10, 11, 12]);

test("client submit-verification roundtrip", () => {
  const frame = ClientWireController.produceFrame(
    "submit-verification",
    { signature: sampleSignature },
  );
  const parsed = ServerWireController.consumeFrame(frame);

  assert.equal(parsed.type, "submit-verification");
  assert.ok(bytesEqual(parsed.message.signature, sampleSignature));
});

test("client submit-config roundtrip", () => {
  const frame = ClientWireController.produceFrame("submit-config", sampleConfig);
  const parsed = ServerWireController.consumeFrame(frame);

  assert.equal(parsed.type, "submit-config");
  assert.equal(parsed.message.id, sampleConfig.id);
  assert.deepEqual(parsed.message.jwk, sampleConfig.jwk);
  assert.ok(bytesEqual(parsed.message.state.iv, sampleState.iv));
  assert.ok(
    bytesEqual(parsed.message.state.ciphertext, sampleState.ciphertext),
  );
});

test("client submit-snapshot roundtrip", () => {
  const frame = ClientWireController.produceFrame(
    "submit-snapshot",
    sampleState,
  );
  const parsed = ServerWireController.consumeFrame(frame);

  assert.equal(parsed.type, "submit-snapshot");
  assert.ok(bytesEqual(parsed.message.iv, sampleState.iv));
  assert.ok(bytesEqual(parsed.message.ciphertext, sampleState.ciphertext));
});

test("client submit-delta roundtrip", () => {
  const frame = ClientWireController.produceFrame("submit-delta", sampleState);
  const parsed = ServerWireController.consumeFrame(frame);

  assert.equal(parsed.type, "submit-delta");
  assert.ok(bytesEqual(parsed.message.iv, sampleState.iv));
  assert.ok(bytesEqual(parsed.message.ciphertext, sampleState.ciphertext));
});

test("client submit-request roundtrip", () => {
  const message = { token: "request-token" };
  const frame = ClientWireController.produceFrame("submit-request", message);
  const parsed = ServerWireController.consumeFrame(frame);

  assert.equal(parsed.type, "submit-request");
  assert.equal(parsed.message.token, message.token);
});

test("server require-verification roundtrip", () => {
  const frame = ServerWireController.produceFrame(
    "require-verification",
    null,
  );
  const parsed = ClientWireController.consumeFrame(frame);

  assert.equal(parsed.type, "require-verification");
  assert.equal(parsed.message, null);
});

test("server require-config roundtrip", () => {
  const frame = ServerWireController.produceFrame("require-config", null);
  const parsed = ClientWireController.consumeFrame(frame);

  assert.equal(parsed.type, "require-config");
  assert.equal(parsed.message, null);
});

test("server offer-config roundtrip", () => {
  const message = { id: "resource-beta" };
  const frame = ServerWireController.produceFrame("offer-config", message);
  const parsed = ClientWireController.consumeFrame(frame);

  assert.equal(parsed.type, "offer-config");
  assert.equal(parsed.message.id, message.id);
});

test("server offer-snapshot roundtrip", () => {
  const frame = ServerWireController.produceFrame(
    "offer-snapshot",
    sampleState,
  );
  const parsed = ClientWireController.consumeFrame(frame);

  assert.equal(parsed.type, "offer-snapshot");
  assert.ok(bytesEqual(parsed.message.iv, sampleState.iv));
  assert.ok(bytesEqual(parsed.message.ciphertext, sampleState.ciphertext));
});

test("server forward-delta roundtrip", () => {
  const frame = ServerWireController.produceFrame(
    "forward-delta",
    sampleState,
  );
  const parsed = ClientWireController.consumeFrame(frame);

  assert.equal(parsed.type, "forward-delta");
  assert.ok(bytesEqual(parsed.message.iv, sampleState.iv));
  assert.ok(bytesEqual(parsed.message.ciphertext, sampleState.ciphertext));
});

test("server forward-request roundtrip", () => {
  const message = { token: "forward-token" };
  const frame = ServerWireController.produceFrame("forward-request", message);
  const parsed = ClientWireController.consumeFrame(frame);

  assert.equal(parsed.type, "forward-request");
  assert.equal(parsed.message.token, message.token);
});

test("server forward-response roundtrip", () => {
  const frame = ServerWireController.produceFrame(
    "forward-response",
    sampleState,
  );
  const parsed = ClientWireController.consumeFrame(frame);

  assert.equal(parsed.type, "forward-response");
  assert.ok(bytesEqual(parsed.message.iv, sampleState.iv));
  assert.ok(bytesEqual(parsed.message.ciphertext, sampleState.ciphertext));
});

test("reject invalid frame length (client consume)", () => {
  const frame = new Uint8Array([wcpVersion]);
  expectCloudexError(
    () => ClientWireController.consumeFrame(frame),
    "wire-control/invalid-frame-length",
  );
});

test("reject invalid frame length (server consume)", () => {
  const frame = new Uint8Array([wcpVersion]);
  expectCloudexError(
    () => ServerWireController.consumeFrame(frame),
    "wire-control/invalid-frame-length",
  );
});

test("reject invalid version (client consume)", () => {
  const frame = new Uint8Array([0x02, 0x00]);
  expectCloudexError(
    () => ClientWireController.consumeFrame(frame),
    "wire-control/invalid-version",
  );
});

test("reject invalid version (server consume)", () => {
  const frame = new Uint8Array([0x02, 0x50]);
  expectCloudexError(
    () => ServerWireController.consumeFrame(frame),
    "wire-control/invalid-version",
  );
});

test("reject unknown frame code (client consume)", () => {
  const frame = new Uint8Array([wcpVersion, 0x03]);
  expectCloudexError(
    () => ClientWireController.consumeFrame(frame),
    "wire-control/unknown-frame-code",
  );
});

test("reject unknown frame code (server consume)", () => {
  const frame = new Uint8Array([wcpVersion, 0x10]);
  expectCloudexError(
    () => ServerWireController.consumeFrame(frame),
    "wire-control/unknown-frame-code",
  );
});

test("reject server signal with payload (require-verification)", () => {
  const frame = new Uint8Array([wcpVersion, 0x00, 0x00]);
  expectCloudexError(
    () => ClientWireController.consumeFrame(frame),
    "wire-control/invalid-payload",
  );
});

test("reject server signal with payload (require-config)", () => {
  const frame = new Uint8Array([wcpVersion, 0x01, 0x00]);
  expectCloudexError(
    () => ClientWireController.consumeFrame(frame),
    "wire-control/invalid-payload",
  );
});

test("reject client frame with empty payload (submit-request)", () => {
  const frame = new Uint8Array([wcpVersion, 0x54]);
  expectCloudexError(
    () => ServerWireController.consumeFrame(frame),
    "wire-control/invalid-payload",
  );
});

test("reject client frame with empty payload (submit-verification)", () => {
  const frame = new Uint8Array([wcpVersion, 0x50]);
  expectCloudexError(
    () => ServerWireController.consumeFrame(frame),
    "wire-control/invalid-payload",
  );
});

test("reject server payload invalid msgpack", () => {
  const frame = new Uint8Array([wcpVersion, 0x02, 0xc1]);
  expectCloudexError(
    () => ClientWireController.consumeFrame(frame),
    "wire-control/invalid-payload",
  );
});

test("reject client payload invalid msgpack", () => {
  const frame = new Uint8Array([wcpVersion, 0x54, 0xc1]);
  expectCloudexError(
    () => ServerWireController.consumeFrame(frame),
    "wire-control/invalid-payload",
  );
});

test("reject client submit-request invalid message", () => {
  expectCloudexError(
    () =>
      ClientWireController.produceFrame("submit-request", {
        token: 123,
      }),
    "wire-control/invalid-message",
  );
});

test("reject client submit-config invalid message", () => {
  expectCloudexError(
    () =>
      ClientWireController.produceFrame("submit-config", {
        id: "resource-alpha",
        jwk: null,
        state: sampleState,
      }),
    "wire-control/invalid-message",
  );
});

test("reject server offer-config invalid message", () => {
  expectCloudexError(
    () => ServerWireController.produceFrame("offer-config", { id: 123 }),
    "wire-control/invalid-message",
  );
});

test("reject server signal invalid message", () => {
  expectCloudexError(
    () =>
      ServerWireController.produceFrame("require-config", {
        extra: true,
      }),
    "wire-control/invalid-message",
  );
});
