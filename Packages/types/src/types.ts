import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";

export type ValidationSchema = StandardSchemaV1<any, any>;
export type JSONValidationSchema = StandardJSONSchemaV1<any, any>;

export type InferInput<T> = T extends { readonly inferred: any }
  ? T extends StandardSchemaV1<infer I, any>
    ? I
    : unknown
  : T extends StandardSchemaV1<infer I, any>
    ? I
    : T extends StandardJSONSchemaV1<infer I, any>
      ? I
      : unknown;

export type InferOutput<T> = T extends { readonly inferred: infer O }
  ? O
  : T extends StandardSchemaV1<any, infer O>
    ? O
    : T extends StandardJSONSchemaV1<any, infer O>
      ? O
      : unknown;

export type Infer<T> = InferOutput<T>;

export interface RouteDefinition {
  method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE" | "WS" | "SUB";
  path: string;
  params?: unknown;
  query?: unknown;
  headers?: unknown;
  body?: unknown;
  response?: unknown;
  data?: unknown;
  error?: unknown;
  message?: unknown;
}

export interface RouteInfo {
  method: string;
  path: string;
  params?: unknown;
  query?: unknown;
  headers?: unknown;
  body?: unknown;
  response?: unknown;
  data?: unknown;
  error?: unknown;
}

export type TypeGeneratorOptions = {
  includeSubscriptions?: boolean;
  includeWebSocket?: boolean;
};
