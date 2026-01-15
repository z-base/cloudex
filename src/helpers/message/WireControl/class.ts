import { generateNonce } from "bytecodec";
type BytePayload = BufferSource;
type Envelope = { iv: Uint8Array; ciphertext: ArrayBuffer };

type ChallengeMessage = { code: 1; payload: { challenge: Base64URLString } };
type PatchMessage = {
  code: 2;
  payload: Envelope;
};
type MergeMessage = {
  code: 3;
  payload: Envelope;
};
type BackupMessage = {
  code: 4;
  payload: {
    identifier: Base64URLString;
    envelope: Envelope;
  };
};
type SignatureMessage = { code: 5; payload: { signature: BytePayload } };

export type ResourceAgentMessage =
  | ChallengeMessage
  | PatchMessage
  | MergeMessage
  | BackupMessage
  | SignatureMessage;

export class ChallengeMessage {
  constructor() {
    this.code = 1;
    this.payload = {
      challenge: generateNonce(),
    };
  }
}

export class MergeMessage {
  constructor(envelope: Envelope) {
    this.code = 3;
    this.payload = {
      envelope,
    };
  }
}
