# WireControl

WireControl is the wire-level codec for WCP frames. It only turns typed
messages into frames and back, enforces the envelope and version, and
validates payload shape. It does not handle transport, authorization,
storage, or CRDT semantics.

## Frame envelope

```
[ 1 byte VERSION ][ 1 byte FRAME_CODE ][ N bytes PAYLOAD ]
```

- VERSION: `wcpVersion` (0x01)
- FRAME_CODE: client or server frame code (see `messages.ts`)
- PAYLOAD: MsgPack-encoded message, or empty for signal frames

## Directory layout

Actor-Authoritative Synchronization Architecture

- `index.ts`: shared constants and the wire controller facade.
- `Client/`: client-produced frames and server-consumed frames.
  - `messages.ts`: client message shapes and validators.
  - `ClientFrameProducer/`: encodes client messages into frames.
  - `ServerFrameConsumer/`: decodes server frames into messages.
- `Server/`: server-produced frames and client-consumed frames.
  - `messages.ts`: server message shapes and validators.
  - `ServerFrameProducer/`: encodes server messages into frames.
  - `ClientFrameConsumer/`: decodes client frames into messages.
- `wire-control.test.js`: Node unit tests.
- `wire-control.bench.js`: benchmark harness.

## Public API

- `wcpVersion`
- `ClientWireController.produceFrame(type, message)`
- `ClientWireController.consumeFrame(frame)`
- `ServerWireController.produceFrame(type, message)`
- `ServerWireController.consumeFrame(frame)`

Lower-level helpers are re-exported from `src/WireControl/Client/index.ts` and
`src/WireControl/Server/index.ts`.

## Usage

```ts
import { ClientWireController, ServerWireController } from "./WireControl";

const requestFrame = ClientWireController.produceFrame("submit-request", {
  token: "request-token",
});

const decoded = ServerWireController.consumeFrame(requestFrame);
// decoded.type === "submit-request"
// decoded.message.token === "request-token"
```

```ts
import { ClientWireController } from "./WireControl";

const serverFrame = new Uint8Array([0x01, 0x00]); // example only
ClientWireController.consumeFrame(serverFrame);
```

## Errors

All validation issues throw `CloudexError` with a `code`:

- `wire-control/invalid-frame-length`
- `wire-control/invalid-version`
- `wire-control/unknown-frame-code`
- `wire-control/invalid-payload`
- `wire-control/invalid-message`

## Tests and benchmarks

WireControl tests and benchmarks run directly against the TypeScript sources
using `tsx`.

```bash
npm run wire:test
npm run wire:bench
```

To change the benchmark iteration count:

```bash
WIRE_BENCH_ITERATIONS=100000 npm run wire:bench
```

## Results

Unit tests: PASS (28 tests, last run: 2026-01-19 23.00.14)

Benchmarks (last run: 2026-01-19 22.54.59, iterations: 50000)

Average ops/sec:

- frame produce: 1,347,526 (12 runs)
- frame consume: 1,825,795 (12 runs)

Frame produce ops/sec:
| Path | Ops/sec |
| --- | ---: |
| client submit-verification | 314,254 |
| client submit-config | 272,813 |
| client submit-snapshot | 471,077 |
| client submit-delta | 487,913 |
| client submit-request | 483,437 |
| server require-verification | 5,622,589 |
| server require-config | 5,824,926 |
| server offer-config | 573,040 |
| server offer-snapshot | 544,212 |
| server forward-delta | 505,361 |
| server forward-request | 640,025 |
| server forward-response | 430,666 |

Frame consume ops/sec:
| Path | Ops/sec |
| --- | ---: |
| server submit-verification | 408,383 |
| server submit-config | 314,258 |
| server submit-snapshot | 421,390 |
| server submit-delta | 505,270 |
| server submit-request | 884,989 |
| client require-verification | 6,279,041 |
| client require-config | 9,134,756 |
| client offer-config | 1,290,776 |
| client offer-snapshot | 526,881 |
| client forward-delta | 623,445 |
| client forward-request | 1,032,026 |
| client forward-response | 488,329 |
