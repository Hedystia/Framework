import type { ClientInfo, EmitPayload, EmitterConfig, EventMap, IterableSource } from "./types";

type InferItemType<D> = D extends Iterable<infer U> ? U : D extends AsyncIterable<infer V> ? V : D;

export class SSEEmitter<T extends EventMap> {
  private config: EmitterConfig;
  private clients: Map<string, ClientInfo> = new Map();
  private eventDefinitions: T;

  constructor(events: T, config: EmitterConfig = { headers: {} }) {
    this.eventDefinitions = events;
    this.config = config;
  }

  public static init<T extends EventMap>(events: T, config?: EmitterConfig): SSEEmitter<T> {
    return new SSEEmitter<T>(events, config);
  }

  private isAsyncIterable<Item = unknown>(value: unknown): value is AsyncIterable<Item> {
    return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
  }

  private isIterable<Item = unknown>(value: unknown): value is Iterable<Item> {
    return typeof value === "object" && value !== null && Symbol.iterator in value;
  }

  private ensureIterable<D>(data: D): IterableSource<InferItemType<D>> {
    type Item = InferItemType<D>;

    if (this.isIterable<Item>(data)) {
      return data;
    }
    if (this.isAsyncIterable<Item>(data)) {
      return data;
    }

    async function* singleItemGenerator(): AsyncIterable<Item> {
      yield data as Item;
    }
    return singleItemGenerator();
  }

  private async writeChunk(
    writer: WritableStreamDefaultWriter,
    chunkString: string,
  ): Promise<boolean> {
    try {
      await writer.write(chunkString);
      return true;
    } catch {
      return false;
    }
  }

  private async emitStreamEvent<K extends keyof T>(
    writer: WritableStreamDefaultWriter,
    event_type: K,
    payload: EmitPayload<T, K>,
  ): Promise<void> {
    const event_config = this.eventDefinitions[event_type];
    const chunk_size = event_config?.chunkSize ?? 1024;

    const data = (payload as any).data;
    if (data === undefined) {
      throw new Error(`Stream event ${String(event_type)} requires a 'data' property`);
    }

    type Item = InferItemType<T[K]["data"]>;
    const iterable = this.ensureIterable<T[K]["data"]>(data);

    let chunk: Item[] = [];
    let writeSuccess = true;

    try {
      for await (const item of iterable) {
        chunk.push(item);
        if (chunk.length >= chunk_size) {
          const chunkPayload = { ...payload, data: chunk } as any;
          const event_data = `event: ${String(event_type)}\ndata: ${JSON.stringify(chunkPayload)}\n\n`;
          writeSuccess = await this.writeChunk(writer, event_data);
          if (!writeSuccess) {
            break;
          }
          chunk = [];
        }
      }
      if (writeSuccess && chunk.length > 0) {
        const finalPayload = { ...payload, data: chunk } as any;
        const event_data = `event: ${String(event_type)}\ndata: ${JSON.stringify(finalPayload)}\n\n`;
        await this.writeChunk(writer, event_data);
      }
    } catch {}
  }

  private async emitSingleEvent<K extends keyof T>(
    writer: WritableStreamDefaultWriter,
    event_type: K,
    payload: EmitPayload<T, K>,
  ): Promise<void> {
    const event_data = `event: ${String(event_type)}\ndata: ${JSON.stringify(payload)}\n\n`;
    await this.writeChunk(writer, event_data);
  }

  private async emitEventInternal<K extends keyof T>(
    writer: WritableStreamDefaultWriter,
    event_type: K,
    payload: EmitPayload<T, K>,
  ): Promise<void> {
    const event_config = this.eventDefinitions[event_type];

    if (event_config?.stream) {
      await this.emitStreamEvent(writer, event_type, payload);
    } else {
      await this.emitSingleEvent(writer, event_type, payload);
    }
  }

  public headers(headers_override?: Record<string, string>): Headers {
    const defaultHeaders = {
      "Content-Type": "text/event-stream",
      "Content-Encoding": "none",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
    };

    return new Headers({
      ...defaultHeaders,
      ...this.config.headers,
      ...headers_override,
    });
  }

  public stream({
    callback,
    clientId: customClientId,
    ondisconnect,
    signal,
  }: {
    callback: (
      emit: <K extends keyof T>(event_type: K, payload: EmitPayload<T, K>) => Promise<void>,
      clientId: string,
    ) => void | Promise<void>;
    clientId?: string;
    ondisconnect?: (clientId: string) => void;
    signal?: AbortSignal;
  }): ReadableStream<Uint8Array> {
    const emitterInstance = this;
    let writerRef: WritableStreamDefaultWriter | null = null;
    let clientIdRef: string | null = null;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream<string, Uint8Array>({
          transform(chunk, ctl) {
            ctl.enqueue(encoder.encode(chunk));
          },
        });

        writerRef = writable.getWriter();
        const writer = writerRef;

        clientIdRef = customClientId || Math.random().toString(36).slice(2, 9);
        const clientId = clientIdRef;

        const cleanup = async (reason?: unknown) => {
          if (!emitterInstance.clients.has(clientId)) {
            return;
          }

          emitterInstance.clients.delete(clientId);

          if (ondisconnect) {
            try {
              ondisconnect(clientId);
            } catch {}
          }

          if (writer) {
            writer.abort(reason).catch(() => {});
          }

          try {
            if (controller.desiredSize !== null) {
              controller.close();
            }
          } catch {}
        };

        emitterInstance.clients.set(clientId, {
          writer,
          cleanup,
          subscriptions: new Map(),
        });

        const emit = async <K extends keyof T>(
          event_type: K,
          payload: EmitPayload<T, K>,
        ): Promise<void> => {
          if (emitterInstance.clients.has(clientId)) {
            await emitterInstance.emitEventInternal(writer, event_type, payload);
          }
        };

        const externalAbortHandler = () => {
          cleanup("External Signal Abort");
        };
        signal?.addEventListener("abort", externalAbortHandler, { once: true });

        const removeSignalListener = () => {
          signal?.removeEventListener("abort", externalAbortHandler);
        };

        readable
          .pipeTo(
            new WritableStream({
              write(chunk) {
                try {
                  if (controller.desiredSize !== null) {
                    controller.enqueue(chunk);
                  }
                } catch {
                  cleanup("Enqueue Error");
                }
              },
              close() {
                removeSignalListener();
                try {
                  if (controller.desiredSize !== null) {
                    controller.close();
                  }
                } catch {}
              },
              abort(reason) {
                removeSignalListener();
                cleanup(reason ?? "Internal Pipe Abort");
                try {
                  if (controller.desiredSize !== null) {
                    controller.error(reason);
                  }
                } catch {}
              },
            }),
          )
          .catch((error) => {
            cleanup(error ?? "Pipe Error");
            removeSignalListener();
          });

        writer.closed
          .catch((error) => {
            cleanup(error ?? "Writer Closed Error");
          })
          .finally(() => {
            removeSignalListener();
          });

        try {
          await callback(emit, clientId);
        } catch (error) {
          if (controller.desiredSize !== null) {
            controller.error(error);
          }
          await cleanup(error);
        }
      },

      async cancel(reason) {
        const clientId = clientIdRef;
        if (clientId) {
          const clientInfo = emitterInstance.clients.get(clientId);
          if (clientInfo) {
            await clientInfo.cleanup(reason ?? "Cancel");
          }
        }
      },
    });

    return stream;
  }

  public async broadcast<K extends keyof T>(
    event_type: K,
    payload: EmitPayload<T, K>,
  ): Promise<void> {
    const clientEntries = Array.from(this.clients.entries());
    if (clientEntries.length === 0) {
      return;
    }

    const promises = clientEntries.map(([, { writer }]) =>
      this.emitEventInternal(writer, event_type, payload),
    );

    await Promise.allSettled(promises);
  }

  public async disconnectClient(clientId: string): Promise<void> {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      await clientInfo.cleanup("Server Disconnect Request");
    }
  }

  public async sendToClient<K extends keyof T>(
    clientId: string,
    event_type: K,
    payload: EmitPayload<T, K>,
  ): Promise<void> {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      try {
        await this.emitEventInternal(clientInfo.writer, event_type, payload);
      } catch {}
    }
  }

  public getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  public getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  public hasClient(clientId: string): boolean {
    return this.clients.has(clientId);
  }
}
