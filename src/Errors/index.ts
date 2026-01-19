export type CloudexErrorCode =
  | "wire-control/invalid-frame-length"
  | "wire-control/invalid-version"
  | "wire-control/unknown-frame-code"
  | "wire-control/invalid-payload"
  | "wire-control/invalid-message";

export class CloudexError extends Error {
  readonly code: CloudexErrorCode;

  constructor(message: string, code: CloudexErrorCode) {
    super(message);
    this.code = code;
  }
}
