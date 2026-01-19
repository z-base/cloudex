export const wcpVersion = 0x01 as const;

import {
  consumeClientFrame,
  produceServerFrame,
  type CloudexServerFrameType,
  type CloudexServerWireMessage,
} from "./Server";
import type { MessageFor as ServerMessageFor } from "./Server/messages";

import {
  consumeServerFrame,
  produceClientFrame,
  type CloudexClientFrameType,
  type CloudexClientWireMessage,
} from "./Client";
import type { MessageFor as ClientMessageFor } from "./Client/messages";

export class ServerWireController {
  static produceFrame<T extends CloudexServerFrameType>(
    type: T,
    message: ServerMessageFor<T>,
  ): Uint8Array<ArrayBuffer> {
    return produceServerFrame(type, message);
  }

  static consumeFrame(
    frame: Uint8Array<ArrayBuffer>,
  ): CloudexClientWireMessage {
    return consumeClientFrame(frame);
  }
}

export class ClientWireController {
  static consumeFrame(
    frame: Uint8Array<ArrayBuffer>,
  ): CloudexServerWireMessage {
    return consumeServerFrame(frame);
  }

  static produceFrame<T extends CloudexClientFrameType>(
    type: T,
    message: ClientMessageFor<T>,
  ): Uint8Array<ArrayBuffer> {
    return produceClientFrame(type, message);
  }
}
