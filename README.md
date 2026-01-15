# Cloudex Protocol — Draft Specification

**name:** cloudex  
**version:** 1.0.0  
**status:** draft  
**editedAt:** 2026-01-15  
**authorship:** ai-assisted  
**contributors:** Jori Lehtinen, GPT-5.2

---

## 1. Purpose

Cloudex defines a **reliable, stateful byte-transport channel** established via an **HMAC-based handshake**.  
After verification, the channel supports **encrypted full-snapshot sync and delta forwarding** between peers, both online and offline.

Cloudex transports **bytes only** and does **not** define data semantics. To achieve convergence and offline correctness, **CRDTs MUST be used**, but their implementation is the developer’s responsibility.

---

## 2. Core Principles

- **Client state is authoritative.**
- The server is **not authoritative**; it is a **relay** and MAY be a **replica store** (opaque bytes).
- The **CODE meanings are peer-level semantics**. Online servers primarily **forward/relay** codes between verified peers.
- The server MUST be able to route by reading **only the first byte (CODE)**; it MUST NOT need to decode payloads to forward.

---

## 3. Operating Modes

### 3.1 Online

- Transport: `WebSocket`
- Server/Proxy/Hub/Gateway: **relay**; MAY also persist an opaque replica snapshot per resource
- Fan-out: server forwards messages from a verified sender to other verified peers (except sender)

### 3.2 Offline

- Transport: `BroadcastChannel`
- Scope: same-origin tabs only
- Semantics and wire format are identical to online mode (no authority)

---

## 4. Security Model

### 4.1 Handshake

- Authentication is **HMAC challenge–response**
- Server is stateful during verification
- No connection is trusted until verification succeeds
- Any non-handshake protocol message received from an unverified connection MUST be rejected

### 4.2 Encryption

Cloudex enforces encryption for all stateful payloads.

**In-memory envelope shape**

```ts
type Envelope = { iv: Uint8Array; ciphertext: ArrayBuffer };
```

````

Wire/storage rules:

- All snapshots and deltas MUST be carried as **opaque envelope bytes**
- Server MUST NOT be required to decode envelope bytes to store/forward
- Raw (non-envelope) state bytes outside the envelope are non-compliant

Key management and algorithm selection are out of scope.

---

## 5. Wire Format (Buffer-first)

### 5.1 Message Layout (normative)

All messages are a single buffer:

```
[ 1 byte CODE ][ N bytes PAYLOAD ]
```

- `CODE` identifies protocol intent.
- `PAYLOAD` is interpreted based on CODE.
- Implementations MAY encode PAYLOAD internally (e.g., MsgPack), but forwarding MUST preserve bytes losslessly.
- Relay nodes MUST be able to route by reading only `CODE`.

### 5.2 Payload Categories

- **Raw bytes**: challenge + signature
- **Opaque blob**: envelope bytes (snapshot/delta). Relay may store/forward without decoding.

---

## 6. Message Codes (Normative)

| Code | Name                 | Initiator (peer) | Payload category | Peer-level meaning                                    |
| ---: | -------------------- | ---------------- | ---------------- | ----------------------------------------------------- |
|    1 | AssertChallenge      | server           | Raw bytes        | server → client challenge                             |
|    5 | SignChallenge        | client           | Raw bytes        | client → server signature                             |
|    2 | DownstreamDelta      | peer             | Opaque blob      | “apply this delta”                                    |
|    6 | UpstreamDelta        | peer             | Opaque blob      | “forward this delta”                                  |
|    3 | RequestStateSync     | peer             | Opaque blob      | “here’s my snapshot offer / sync context” (see flows) |
|    4 | ResolveBackup        | peer             | Opaque blob      | “commit snapshot / update replica”                    |
|    7 | RequestPeerStateSync | peer             | Opaque blob      | “please send me your snapshot”                        |
|    8 | ResolvePeerStateSync | peer             | Opaque blob      | “here is my snapshot”                                 |

Notes:

- Codes 2/3/4/6/7/8 are **peer semantics**.
- Online relay forwards them between verified peers; it does not need to decode payloads.
- Offline mode broadcasts them between tabs.

---

## 7. Roles and Responsibilities

### 7.1 Server / Proxy / Hub / Gateway (online relay)

The server MUST:

- perform handshake (CODE 1 and 5)
- maintain verified/unverified connection state
- forward peer semantic codes (2/3/4/6/7/8) from a verified sender to other verified peers (except sender)
- never decrypt payloads
- never require decoding to forward

The server MAY:

- store a per-resource opaque replica snapshot (written only from verified peer traffic)

### 7.2 Peer / Client / Agent / Actor / Node

A peer MUST:

- be capable of decoding envelope bytes into `{ iv, ciphertext }` locally
- decrypt/merge/apply only locally (server never merges)
- decide authoritative outcomes locally (CRDT merge rules are peer-defined)

---

## 8. Handshake (Online)

### 8.1 AssertChallenge (CODE = 1)

Sent immediately on connection.

Server MUST:

- generate cryptographically secure challenge bytes
- store them in `WeakMap` keyed by the unverified WebSocket instance
- send them downstream

Wire:

```
[0x01][challenge bytes]
```

### 8.2 SignChallenge (CODE = 5)

Client responds with signature bytes.

Client MUST:

- compute HMAC signature over the received challenge bytes
- send signature as raw bytes

Wire:

```
[0x05][signature bytes]
```

### 8.3 VerifyChallenge (server-local)

Server MUST:

- lookup challenge by WebSocket identity
- verify signature
- close connection on failure
- mark verified on success

No success message is required by this spec.

---

## 9. Relay Rules (Online)

For any verified sender message with CODE ∈ {2,3,4,6,7,8}:

- Server MUST forward the message bytes unchanged to all other verified connections for the same resource
- Server MUST NOT forward back to sender
- Server MUST NOT decode payload bytes to forward

For unverified senders:

- Server MUST reject/close on any CODE other than 5 (SignChallenge)

---

## 10. Encrypted Payload Semantics (Peer-level)

All envelopes are opaque on the wire:

- **Delta envelope**: ciphertext contains an encrypted “operation/patch snapshot”
- **Snapshot envelope**: ciphertext contains an encrypted “full snapshot”

Cloudex does not define these plaintext formats.

---

## 11. Peer Flows (Two-of-Operations, T2O)

This protocol intentionally provides two-of-operation flows for full snapshot sync:

### 11.1 Flow A — Server ↔ Newly Verified Client (Replica reconciliation)

Goal: a just-verified client reconciles with the server-stored replica snapshot.

**Step A1 (server relay or server-origin): RequestStateSync (CODE=3)**

- Server sends its current stored replica snapshot as opaque envelope bytes (if it has one).
- If server has no stored replica snapshot, it MAY omit this step.

Wire:

```
[0x03][snapshot envelope bytes]
```

**Client action (local): ResolveStateSync**

- Client decrypts local authoritative snapshot and server replica snapshot
- Client merges via CRDT logic
- If different, client encrypts merged authoritative snapshot

**Step A2 (client): ResolveBackup (CODE=4)**

- Client uploads the merged authoritative snapshot to update the server replica.

Wire:

```
[0x04][snapshot envelope bytes]
```

Server action (optional store):

- Server MAY replace its stored replica snapshot bytes with the received bytes.

Authority rule:

- Client’s merge result is authoritative; server never decides winners.

---

### 11.2 Flow B — Verified Peer ↔ Verified Peer (Full snapshot sync)

Goal: one peer requests another peer’s snapshot; server only relays.

**Step B1 (peer): RequestPeerStateSync (CODE=7)**

- Sender requests a snapshot from peers.
- Payload is opaque envelope bytes (implementation-defined “request context”):

  - MAY be empty
  - MAY include encrypted request metadata for the target peer(s)

Wire:

```
[0x07][opaque blob bytes]
```

**Relay:**

- Server forwards to other verified peers.

**Step B2 (peer): ResolvePeerStateSync (CODE=8)**

- A peer responds with a full snapshot envelope.

Wire:

```
[0x08][snapshot envelope bytes]
```

**Receiver action (local):**

- Decode/decrypt received snapshot
- Merge into local authoritative state using CRDT logic
- If receiver decides state changed materially, it MAY:

  - emit deltas to peers, and/or
  - publish a new snapshot via ResolveBackup (CODE=4) to refresh server replica

Authority rule:

- Each peer remains authoritative over its own local state; merges are local.

---

## 12. Delta Forwarding (Peer-to-Peer via Relay)

### 12.1 UpstreamDelta (CODE = 6)

Peer sends an encrypted delta envelope intended for other peers.

Wire:

```
[0x06][delta envelope bytes]
```

### 12.2 DownstreamDelta (CODE = 2)

Peers receive a forwarded delta envelope.

Wire:

```
[0x02][delta envelope bytes]
```

Peer local action:

- decode envelope
- decrypt delta
- apply/merge via CRDT logic
- emit via developer listener (“EmitDelta”)

---

## 13. Offline Operation

In offline mode (BroadcastChannel):

- Peers broadcast the same buffers with the same CODE meanings
- No handshake is required (no server), but encryption rules still apply
- RequestPeerStateSync/ResolvePeerStateSync enables tab-to-tab resync

---

## 14. Non-Goals

- No schema definition
- No CRDT implementation
- No encryption negotiation or algorithm selection
- No key management
- No identity/authorization model beyond the HMAC handshake gate

Cloudex is a **transport + handshake + relay** protocol for opaque encrypted bytes.

---

## 15. Invariants

- No verified channel without successful HMAC challenge–response (online)
- All snapshot/delta payloads MUST be carried as opaque encrypted blobs
- Relay nodes route by reading only the 1-byte CODE
- Relay nodes are not required to decode payloads to store/forward
- Client state is authoritative; server state is a replica (optional store)
- Offline and online modes share identical wire format and semantics

````
