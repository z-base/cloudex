# cloudex Wire Control Protocol (WCP)

## Status

This document defines the **cloudex Wire Control Protocol (WCP)**.

WCP is a **binary, versioned, role-aware wire protocol** governing how Actors and Base Servers exchange **opaque byte sequences**.

This specification is **normative for wire behavior only**. It defines framing, delivery obligations, verification and configuration handshakes, resource bootstrap, identifier authority, and migration rules. It is **not authoritative over semantic meaning, authorization, merge logic, attribution, or lifecycle semantics**, which exist strictly above the wire.

This document is the **single shared wire contract** referenced by:

- Base Server Core
- Actor Server Client

RFC 2119 and RFC 8174 keywords apply.

---

## Design Goals

The Wire Control Protocol is designed to:

- support **fully asynchronous Actors**, including offline-first execution,
- allow **resource creation without prior coordination**,
- preserve **semantic opacity** at the Base Server,
- scale across Resources with strict isolation guarantees,
- enable **mechanical validation without payload inspection**,
- remain forward-compatible without invalidating existing implementations.

The protocol defines **how bytes move**, never **what they mean**.

---

## Core Invariants

- Payloads are opaque at all times.
- Delivery may be duplicated, reordered, or lossy.
- **Pre-verification, the Client MUST NOT emit any frame other than the one explicitly required by the Server.**
- **Verification gates all non-configuration byte exchange.**
- **Resource existence and identifier allocation are Server-authoritative.**
- All invalid or unexpected wire behavior **MUST result in connection termination**.
- Authority, correctness, attribution, and merge semantics exist strictly above the wire.
- Every connection is scoped to **exactly one Resource**.

---

## Transport Assumptions

- Reliable, message-framed transport (e.g. WebSocket).
- Message boundaries are preserved.
- Transport-level security (e.g. TLS) is assumed but not specified.

---

## Frame Envelope

Every frame **MUST** use the following envelope:

```

[ 1 byte VERSION ][ 1 byte FRAME_CODE ][ N bytes PAYLOAD ]

```

### VERSION

- Indicates the Wire Control Protocol version.
- This specification defines `VERSION = 0x01`.
- Frames with unknown VERSION values **MUST** be rejected via connection termination.

### FRAME_CODE

- Defines **wire-level obligation only**.
- Determines which party may emit the frame and how the Server must process it.
- Payload interpretation is undefined at the wire level.

---

## Frame Code Space Law _(Normative)_

Frame codes are allocated strictly by **emitter role**.

| Range     | Class           | Emitted By | Obligation                        |
| --------- | --------------- | ---------- | --------------------------------- |
| 0x00–0x4F | Server Produced | Server     | Gating, verification, relay       |
| 0x50–0xFF | Client Produced | Client     | Verification, configuration, data |

Any violation of emitter role or frame code range **MUST** result in immediate connection termination.

---

## Defined Frame Codes (VERSION = 0x01)

### Server Produced Frames (0x00–0x4F)

| Code | Name                 | Direction          | Description                                               |
| ---- | -------------------- | ------------------ | --------------------------------------------------------- |
| 0x00 | require-verification | Server → Client    | Verification required                                     |
| 0x01 | require-config       | Server → Client    | Resource does not exist; configuration required           |
| 0x02 | offer-config         | Server → Client    | Configuration accepted; authoritative identifier assigned |
| 0x04 | offer-snapshot       | Server → Client    | Send persisted Snapshot                                   |
| 0x05 | forward-delta        | Server → Client(s) | Forward Delta                                             |
| 0x06 | forward-request      | Server → Client(s) | Snapshot request                                          |
| 0x07 | forward-response     | Server → Client    | Requested Snapshot                                        |

---

### Client Produced Frames (0x50–0xFF)

| Code | Name                | Direction       | Persisted | Description                        |
| ---- | ------------------- | --------------- | --------- | ---------------------------------- |
| 0x50 | submit-verification | Client → Server | No        | Verification response payload      |
| 0x51 | submit-config       | Client → Server | No        | Propose new Resource configuration |
| 0x52 | submit-snapshot     | Client → Server | Yes       | Persist opaque Snapshot            |
| 0x53 | submit-delta        | Client → Server | No        | Submit opaque Delta                |
| 0x54 | submit-request      | Client → Server | No        | Request latest Snapshot            |

---

## Connection Phases _(Normative)_

### Phase 0 — Unverified (Handshake Gate)

Immediately after connection establishment, the Server **MUST assert exactly one required handshake path**.

At this phase:

- The Client **MUST NOT** send any frame **unless explicitly required by the Server**.
- The Client **MAY queue internal operations locally**, but **MUST NOT emit them on the wire**.
- Any unsolicited or invalid frame **MUST** result in immediate connection termination.

---

### Phase 0A — Verification Required (Resource Exists)

- The Server **MUST** send `require-verification (0x00)`.
- The Client **MUST** respond with `submit-verification (0x50)`.
- No other frames are permitted.

---

### Phase 0B — Configuration Required (Resource Does Not Exist)

- The Server **MUST** send `require-config (0x01)`.
- The Client **MUST** respond with `submit-config (0x51)`.
- No verification, snapshot, or delta frames are permitted.

---

## Phase 1 — Configuration (Resource Bootstrap)

Upon receiving `submit-config (0x51)`:

1. The Server **MUST treat any client-provided identifier as advisory only**.
2. The Server **MUST determine an authoritative identifier**.
3. If the proposed identifier already exists, the Server **MUST generate a new 43-character, no-padding, high-entropy identifier**.
4. Identifier generation **MUST repeat until uniqueness is confirmed**.
5. The Server **MUST** persist:
   - encrypted resource state under `${identifier}`,
   - verification key under `${identifier}:jwk`.
6. The verification key:
   - **MUST NOT** unlock resource state,
   - **MUST NOT** be a single point of failure,
   - **MUST** function solely as a connection firewall.
7. The Server **MUST** send `offer-config (0x02)` with the **authoritative identifier** in the payload.

Any malformed configuration payload or protocol violation **MUST** result in immediate connection termination.

---

## Identifier Adoption and Migration _(Normative)_

- The payload of `offer-config (0x02)` **MUST contain the authoritative Resource identifier**.
- Upon receipt, the Client **MUST compare the received identifier with its current local identifier**.
- If the identifiers differ, the Client **MUST migrate all local Resource state** to the new identifier.
- Migration **MUST be atomic from the Client’s perspective**.
- All subsequent behavior **MUST treat the adopted identifier as canonical**.
- Any attempt to continue using a stale identifier on the wire **MUST** result in connection termination.

---

## Verified Session

After successful verification:

1. The connection is added to the verified peer set.
2. If a Snapshot exists, the Server **MUST immediately send** `offer-snapshot (0x04)`.
3. Delta relay **MAY** begin concurrently.
4. No ordering guarantees exist between snapshot delivery and delta relay.

---

## Snapshot Rules _(Wire-Level)_

### submit-snapshot (0x52)

- Payload is an opaque Snapshot.
- The Server **MUST** persist verbatim.
- Any previously persisted Snapshot **MUST** be replaced.
- No inspection or validation is permitted.

### offer-snapshot (0x04)

- Sent automatically after verification if available.
- Sent in response to `submit-request (0x54)`.

---

## Delta Rules _(Wire-Level)_

### submit-delta (0x53)

- Payload is opaque.
- The Server **MUST NOT** persist Delta payloads.
- The Server **MUST** relay the payload to all verified peers except the sender.

### forward-delta (0x05)

- Payload forwarded verbatim.
- Delivery may be duplicated or reordered.
- No acknowledgment guarantees are provided.

---

## Resource Isolation

- Each connection is scoped to exactly one Resource.
- Frames **MUST NOT** cross Resource boundaries.
- Resource multiplexing within a session is forbidden.

---

## Failure Model

The protocol tolerates:

- connection churn,
- Server restarts,
- duplicate frames,
- reordering,
- partial delivery.

Recovery is entirely Actor-side.

---

## Conformance

An implementation conforms **iff** it:

- enforces VERSION and frame code space law exactly,
- enforces strict pre-verification silence,
- applies configuration and verification handshakes correctly,
- enforces authoritative identifier adoption and migration,
- terminates on all invalid wire behavior,
- preserves payload opacity and byte integrity.

---

## Closing Statement

This protocol defines **byte movement discipline only**.  
All semantic authority exists **above the wire**.
