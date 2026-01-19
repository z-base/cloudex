import { ClientWireController, ServerWireController } from "./index.ts";

const iterations = Number.parseInt(
  process.env.WIRE_BENCH_ITERATIONS ?? "50000",
  10,
);

if (!Number.isFinite(iterations) || iterations <= 0) {
  throw new Error("WIRE_BENCH_ITERATIONS must be a positive integer.");
}

const request = { token: "benchmark-token" };
const verification = { signature: new Uint8Array([9, 10, 11, 12]) };
const state = {
  iv: new Uint8Array([1, 2, 3, 4]),
  ciphertext: new Uint8Array([5, 6, 7, 8]).buffer,
};
const config = {
  id: "resource-alpha",
  jwk: { kty: "oct", k: "alpha", alg: "HS256", ext: true },
  state,
};
const offerConfig = { id: "resource-beta" };

const submitVerificationFrame = ClientWireController.produceFrame(
  "submit-verification",
  verification,
);
const submitConfigFrame = ClientWireController.produceFrame(
  "submit-config",
  config,
);
const submitSnapshotFrame = ClientWireController.produceFrame(
  "submit-snapshot",
  state,
);
const submitDeltaFrame = ClientWireController.produceFrame(
  "submit-delta",
  state,
);
const submitRequestFrame = ClientWireController.produceFrame(
  "submit-request",
  request,
);

const requireVerificationFrame = ServerWireController.produceFrame(
  "require-verification",
  null,
);
const requireConfigFrame = ServerWireController.produceFrame(
  "require-config",
  null,
);
const offerConfigFrame = ServerWireController.produceFrame(
  "offer-config",
  offerConfig,
);
const offerSnapshotFrame = ServerWireController.produceFrame(
  "offer-snapshot",
  state,
);
const forwardDeltaFrame = ServerWireController.produceFrame(
  "forward-delta",
  state,
);
const forwardRequestFrame = ServerWireController.produceFrame(
  "forward-request",
  request,
);
const forwardResponseFrame = ServerWireController.produceFrame(
  "forward-response",
  state,
);

console.log("WireControl benchmark");
console.log(`Iterations: ${iterations}`);

runBench("client produce submit-verification", () => {
  ClientWireController.produceFrame("submit-verification", verification);
});

runBench("server consume submit-verification", () => {
  ServerWireController.consumeFrame(submitVerificationFrame);
});

runBench("client produce submit-config", () => {
  ClientWireController.produceFrame("submit-config", config);
});

runBench("server consume submit-config", () => {
  ServerWireController.consumeFrame(submitConfigFrame);
});

runBench("client produce submit-snapshot", () => {
  ClientWireController.produceFrame("submit-snapshot", state);
});

runBench("server consume submit-snapshot", () => {
  ServerWireController.consumeFrame(submitSnapshotFrame);
});

runBench("client produce submit-delta", () => {
  ClientWireController.produceFrame("submit-delta", state);
});

runBench("server consume submit-delta", () => {
  ServerWireController.consumeFrame(submitDeltaFrame);
});

runBench("client produce submit-request", () => {
  ClientWireController.produceFrame("submit-request", request);
});

runBench("server consume submit-request", () => {
  ServerWireController.consumeFrame(submitRequestFrame);
});

runBench("server produce require-verification", () => {
  ServerWireController.produceFrame("require-verification", null);
});

runBench("client consume require-verification", () => {
  ClientWireController.consumeFrame(requireVerificationFrame);
});

runBench("server produce require-config", () => {
  ServerWireController.produceFrame("require-config", null);
});

runBench("client consume require-config", () => {
  ClientWireController.consumeFrame(requireConfigFrame);
});

runBench("server produce offer-config", () => {
  ServerWireController.produceFrame("offer-config", offerConfig);
});

runBench("client consume offer-config", () => {
  ClientWireController.consumeFrame(offerConfigFrame);
});

runBench("server produce offer-snapshot", () => {
  ServerWireController.produceFrame("offer-snapshot", state);
});

runBench("client consume offer-snapshot", () => {
  ClientWireController.consumeFrame(offerSnapshotFrame);
});

runBench("server produce forward-delta", () => {
  ServerWireController.produceFrame("forward-delta", state);
});

runBench("client consume forward-delta", () => {
  ClientWireController.consumeFrame(forwardDeltaFrame);
});

runBench("server produce forward-request", () => {
  ServerWireController.produceFrame("forward-request", request);
});

runBench("client consume forward-request", () => {
  ClientWireController.consumeFrame(forwardRequestFrame);
});

runBench("server produce forward-response", () => {
  ServerWireController.produceFrame("forward-response", state);
});

runBench("client consume forward-response", () => {
  ClientWireController.consumeFrame(forwardResponseFrame);
});

function runBench(label, fn) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) {
    fn();
  }
  const end = process.hrtime.bigint();
  const durationNs = Number(end - start);
  const seconds = durationNs / 1e9;
  const ops = iterations / seconds;
  console.log(`${label}: ${ops.toFixed(0)} ops/sec (${seconds.toFixed(3)}s)`);
}
