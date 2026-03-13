import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationSchema = StandardSchemaV1<any, any>;

export interface Assertion {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toContain(item: any): void;
  toHaveLength(length: number): void;
  toHaveProperty(key: string): void;
  toMatch(pattern: RegExp | string): void;
  toThrow(): void;
  toBeGreaterThan(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeCloseTo(expected: number, decimals?: number): void;
  toBeInstanceOf(expected: any): void;
  toHaveBeenCalled(): void;
  toHaveBeenCalledWith(...args: any[]): void;
  toHaveBeenCalledTimes(expected: number): void;
  toHaveReturnedWith(expected: any): void;
  toHaveReturnedTimes(expected: number): void;
  toBeNaN(): void;
  toBeFinite(): void;
  toBeInfinite(): void;
  toStrictEqual(expected: any): void;
  not: Assertion;
}

export type TestContext<
  ParamsSchema extends ValidationSchema | undefined = undefined,
  QuerySchema extends ValidationSchema | undefined = undefined,
  BodySchema extends ValidationSchema | undefined = undefined,
  HeadersSchema extends ValidationSchema | undefined = undefined,
  ResponseSchema extends ValidationSchema | undefined = undefined,
> = {
  createRequest: (data: {
    params?: ParamsSchema extends ValidationSchema
      ? StandardSchemaV1.InferInput<ParamsSchema>
      : undefined;
    query?: QuerySchema extends ValidationSchema
      ? StandardSchemaV1.InferInput<QuerySchema>
      : undefined;
    body?: BodySchema extends ValidationSchema
      ? StandardSchemaV1.InferInput<BodySchema>
      : undefined;
    headers?: HeadersSchema extends ValidationSchema
      ? StandardSchemaV1.InferInput<HeadersSchema>
      : undefined;
  }) => Promise<{
    response: ResponseSchema extends ValidationSchema
      ? StandardSchemaV1.InferOutput<ResponseSchema>
      : any;
    statusCode: number;
    ok: boolean;
  }>;
  expect: (value: any) => Assertion;
  assert: (condition: boolean, message?: string) => void;
  assertEqual: (actual: any, expected: any, message?: string) => void;
  assertThrows: (fn: () => Promise<void>) => Promise<void>;
  path: string;
  method: string;
};

export type RouteDefinition = {
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
  test?: (context: TestContext<any, any, any, any, any>) => Promise<void> | void;
};
