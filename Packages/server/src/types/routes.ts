import type { ValidationSchema } from "@hedystia/types";
import type { InferOutput } from "./index";

export type { RouteDefinition } from "@hedystia/types";

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
    params?: ParamsSchema extends ValidationSchema ? InferOutput<ParamsSchema> : undefined;
    query?: QuerySchema extends ValidationSchema ? InferOutput<QuerySchema> : undefined;
    body?: BodySchema extends ValidationSchema ? InferOutput<BodySchema> : undefined;
    headers?: HeadersSchema extends ValidationSchema ? InferOutput<HeadersSchema> : undefined;
  }) => Promise<{
    response: ResponseSchema extends ValidationSchema ? InferOutput<ResponseSchema> : any;
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
