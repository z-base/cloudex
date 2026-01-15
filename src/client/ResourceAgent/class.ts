import { Bytes } from "bytecodec";
import type { ResourceIdentifier } from "../../helpers/ensureCloudexCompatibleIdentifier";
import {
  packMessage,
  unpackMessage,
  type ResourceAgentMessage,
} from "../../helpers/message";
import { validateIdentifier } from "../../helpers/ensureCloudexCompatibleIdentifier";
import { UUID } from "crypto";
import { HmacAgent, HmacCluster } from "zeyra";

type ResourceAgentChallenge = {
  challengeId: UUID;
  challengePayload: Base64URLString;
};

type ResourceAgentEventMap = {
  "connection-challenged": Set<ResourceAgentChallenge>;
  "connection-verified": Set<ResourceAgentMessage>;
  "broadcast-recieved": Set<ResourceAgentMessage>;
  "peer-state-recieved": Set<ResourceAgentMessage>;
};

export class ResourceAgent {
  private readonly url: `/api/v1/resource/${ResourceIdentifier}`;
  private readonly hmacJwk: JsonWebKey;
  private broadcastChannel: BroadcastChannel | null = null;
  private webSocket: WebSocket | null = null;
  private isLeader: boolean = false;
  private eventListeners: {
    [key in keyof ResourceAgentEventMap]?: Set<
      (data: ResourceAgentEventMap[key]) => void
    >;
  } = {};

  constructor(identifier: string, hmacJwk: JsonWebKey) {
    const validatedIdentifier = validateIdentifier(identifier);

    this.url = `/api/v1/resource/${validatedIdentifier}`;
    this.hmacJwk = hmacJwk;

    const channelName = ResourceAgent.channelName(this.url);
    const lockName = ResourceAgent.lockName(this.url);

    this.broadcastChannel = new BroadcastChannel(channelName);

    this.broadcastChannel.onmessage = (
      event: MessageEvent<ResourceAgentMessage>
    ) => {
      const message = event.data;
      if (!message) return;

      const eventListeners = this.eventListeners["broadcast-recieved"];

      for (const eventListener of eventListeners) {
        if (typeof eventListener === "function") {
          eventListener(this, message);
        }
      }

      if (!this.isLeader) return;
      const webSocket = this.webSocket;
      if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;

      ResourceAgent.sendWebSocket(webSocket, message);
    };

    /** if navigator online, and on "online" event,  */
    void (async () => {
      while (true) {
        await navigator.locks.request(
          lockName,
          { ifAvailable: true },
          async (lockHandle) => {
            if (!lockHandle) return;

            this.isLeader = true;
            const webSocket = new WebSocket(this.url);
            this.webSocket = webSocket;

            webSocket.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
              const deliver = async () => {
                const message = unpackMessage(event.data);
                if (!message) return;

                if (message.code === 1) {
                  const signer = new HmacAgent(this.hmacJwk);
                  const signature = await signer.sign(
                    Bytes.toBufferSource(
                      Bytes.fromBase64UrlString(message.payload.challenge)
                    )
                  );
                  const upstream = packMessage({
                    code: 5,
                    payload: { signature },
                  });
                  this.webSocket.send(upstream);
                }
                // this.eventlistheners
                this.broadcastChannel.postMessage(message);
              };
              void deliver();
            };

            webSocket.onclose = () => {
              if (this.webSocket === webSocket) this.webSocket = null;
            };

            await new Promise<void>((resolve) => {
              webSocket.addEventListener("close", () => resolve(), {
                once: true,
              });
            });

            this.isLeader = false;
            if (this.webSocket === webSocket) this.webSocket = null;
          }
        );

        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    })();
  }

  requestStateSync() {}

  broadcast(message: ResourceAgentMessage): void {
    const eventListeners = this.eventListeners["broadcast-recieved"];
    for (const eventListener of eventListeners) {
      if (typeof eventListener === "function") {
        eventListener(message);
      }
    }

    this.broadcastChannel.postMessage(message);

    if (!this.isLeader) return;
    const webSocket = this.webSocket;
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;

    ResourceAgent.sendWebSocket(webSocket, message);
  }

  backup(snapshot: unknown) {
    this.broadcastChannel.postMessage(message);

    if (!this.isLeader) return;
    const webSocket = this.webSocket;
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return;

    ResourceAgent.sendWebSocket(webSocket, message);
  }

  private async sign(challenge: Base64URLString) {
    const buffer = await HmacCluster.sign(this.hmacJwk, challenge);
  }

  close(): void {
    try {
      this.broadcastChannel.close();
    } catch {}
    try {
      this.webSocket?.close(1000, "closed");
    } catch {}
    this.webSocket = null;
    this.isLeader = false;
  }

  private static channelName(webSocketUrl: ResourceAgent["url"]): string {
    return `origin-channel::${webSocketUrl}`;
  }

  private static lockName(webSocketUrl: ResourceAgent["url"]): string {
    return `origin-channel-lock::${webSocketUrl}`;
  }

  private static sendWebSocket(
    webSocket: WebSocket,
    message: ResourceAgentMessage
  ): void {
    if (
      !Object.hasOwn(message, "identifier") ||
      !Object.hasOwn(message, "envelope")
    )
      return;
    const buffer = packMessage(message);
    webSocket.send(buffer);
  }

  public addEventListener(
    type: keyof ResourceAgentEventMap,
    listener: (this: ResourceAgent, data: ResourceAgentMessage) => void
  ) {}

  public removeEventListener() {}
}
