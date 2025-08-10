import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { RouteDefinition } from "./routes";

export type ValidationSchema = StandardSchemaV1<any, any>;

export type InferOutput<T extends ValidationSchema> = StandardSchemaV1.InferOutput<T>;

export type RouteSchema = {
  params?: ValidationSchema;
  query?: ValidationSchema;
  body?: ValidationSchema;
  headers?: ValidationSchema;
  response?: ValidationSchema & { _type?: any };
  data?: ValidationSchema & { _type?: any };
  error?: ValidationSchema & { _type?: any };
  description?: string;
  tags?: string[];
};

export type InferRouteContext<
  T extends RouteSchema,
  M extends MacroData = {},
  EnabledMacros extends keyof M = never,
> = {
  req: Request;
  params: T["params"] extends ValidationSchema ? InferOutput<T["params"]> : {};
  query: T["query"] extends ValidationSchema ? InferOutput<T["query"]> : {};
  body: T["body"] extends ValidationSchema ? InferOutput<T["body"]> : unknown;
  headers: T["headers"] extends ValidationSchema
    ? InferOutput<T["headers"]>
    : Record<string, string | null>;
  error: (statusCode: number, message?: string) => never;
} & Pick<M, EnabledMacros>;

export type CorsOptions = {
  origin?:
    | string
    | string[]
    | boolean
    | ((origin: string | undefined) => boolean | Promise<boolean>);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
};

export type PrefixRoutes<Prefix extends string, T extends RouteDefinition[]> = {
  [K in keyof T]: T[K] extends RouteDefinition
    ? {
        method: T[K]["method"];
        path: `${Prefix}${T[K]["path"]}`;
        params: T[K]["params"];
        query: T[K]["query"];
        headers: T[K]["headers"];
        body: T[K] extends { body: infer B } ? B : undefined;
        response: T[K] extends { response: infer R } ? R : undefined;
      }
    : never;
};

export type ContextTypes<T extends RouteSchema = {}> = {
  req: Request;
  params: T["params"] extends ValidationSchema ? InferOutput<T["params"]> : Record<string, any>;
  query: T["query"] extends ValidationSchema ? InferOutput<T["query"]> : Record<string, any>;
  body: T["body"] extends ValidationSchema ? InferOutput<T["body"]> : any;
  headers: T["headers"] extends ValidationSchema
    ? InferOutput<T["headers"]>
    : Record<string, string | null>;
  route?: string;
  method?: string;
  error: (statusCode: number, message?: string) => never;
};

export type RequestHandler = (ctx: ContextTypes) => Response | Promise<Response>;
export type GenericRequestHandler = (request: Request) => Response | Promise<Response>;

export type MacroResolveFunction<T extends RouteSchema = {}> = (
  ctx: ContextTypes<T>,
) => T | Promise<T>;
export type MacroErrorFunction = (statusCode: number, message?: string) => never;

export type MacroData = Record<string, any>;

export type WebSocketHandler = {
  message: (ws: ServerWebSocket, message: string | ArrayBuffer | Uint8Array) => void;
  open?: (ws: ServerWebSocket) => void;
  close?: (ws: ServerWebSocket, code: number, reason: string) => void;
  error?: (ws: ServerWebSocket, error: Error) => void;
  drain?: (ws: ServerWebSocket) => void;
};

type Compressor =
  | "disable"
  | "shared"
  | "dedicated"
  | "3KB"
  | "4KB"
  | "8KB"
  | "16KB"
  | "32KB"
  | "64KB"
  | "128KB"
  | "256KB";

export type WebSocketOptions = {
  maxPayloadLength?: number;
  idleTimeout?: number;
  backpressureLimit?: number;
  closeOnBackpressureLimit?: boolean;
  sendPings?: boolean;
  publishToSelf?: boolean;
  perMessageDeflate?:
    | boolean
    | {
        compress?: boolean | Compressor;
        decompress?: boolean | Compressor;
      };
};

export interface ServerWebSocket {
  readonly data: any;
  readonly readyState: number;
  readonly remoteAddress: string;
  send(message: string | ArrayBuffer | Uint8Array, compress?: boolean): number;
  close(code?: number, reason?: string): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, message: string | ArrayBuffer | Uint8Array): void;
  isSubscribed(topic: string): boolean;
  cork(cb: (ws: ServerWebSocket) => void): void;
}

export type SubscriptionContext<T extends RouteSchema = {}> = ContextTypes<T> & {
  ws: ServerWebSocket;
  data: T["data"] extends ValidationSchema ? InferOutput<T["data"]> : any;
  errorData: T["error"] extends ValidationSchema ? InferOutput<T["error"]> : undefined;
  sendData: (data: T["data"] extends ValidationSchema ? InferOutput<T["data"]> : any) => void;
  sendError: (error: T["error"] extends ValidationSchema ? InferOutput<T["error"]> : any) => void;
};
export type SubscriptionHandler = (ctx: SubscriptionContext) => any | Promise<any>;

type ResolveParams<Path extends string, Params = any> = Params extends Record<string, any>
  ? ResolveParamsWithTypes<Path, Params>
  : ResolveParamsWithoutTypes<Path>;

type ResolveParamsWithTypes<
  T extends string,
  Params extends Record<string, any>,
> = T extends `${infer Before}:${infer ParamName}/${infer After}`
  ? ParamName extends keyof Params
    ? `${Before}${Params[ParamName] extends number ? number : string}/${ResolveParamsWithTypes<After, Params>}`
    : `${Before}:${ParamName}/${ResolveParamsWithTypes<After, Params>}`
  : T extends `${infer Before}:${infer ParamName}`
    ? ParamName extends keyof Params
      ? `${Before}${Params[ParamName] extends number ? number : string}`
      : `${Before}:${ParamName}`
    : T;

type ResolveParamsWithoutTypes<T extends string> = T extends `${infer Before}:${infer ParamAndRest}`
  ? ParamAndRest extends `${infer _Param}/${infer After}`
    ? `${Before}${string}/${ResolveParamsWithoutTypes<After>}`
    : `${Before}${string}`
  : T;

export type ExtractSubscriptionRoutes<Routes extends RouteDefinition[]> = {
  [K in keyof Routes]: Routes[K] extends {
    method: "SUB";
    path: infer P;
    params: infer Params;
    data: infer D;
    error: infer E;
  }
    ? { path: ResolveParams<P & string, Params>; data: D; error: E }
    : never;
}[number];

export type PublishOptions<Data = any, Error = any> = {
  data?: Data;
  error?: Error;
  compress?: boolean;
};

export type PublishMethod<Routes extends RouteDefinition[]> = <
  T extends ExtractSubscriptionRoutes<Routes>,
>(
  topic: T["path"],
  options: T extends { data: infer D; error: infer E }
    ? PublishOptions<D, E> & ({ data: D; error?: never } | { data?: never; error: E })
    : PublishOptions,
) => void;
