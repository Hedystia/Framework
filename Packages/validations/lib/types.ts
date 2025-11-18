import type { StandardSchemaV1 } from "@standard-schema/spec";
import { HSchema } from "../pkg/validations";

type SchemaPrimitive = "string" | "number" | "boolean" | "any";
type Simplify<T> = T extends any ? { [K in keyof T]: T[K] } : never;
type RequiredKeys<S> = {
  [K in keyof S]: S[K] extends OptionalSchema<any, any> ? never : K;
}[keyof S];
type OptionalKeys<S> = {
  [K in keyof S]: S[K] extends OptionalSchema<any, any> ? K : never;
}[keyof S];
type SchemaPrimitiveMap = { string: string; number: number; boolean: boolean; any: unknown };
type SchemaType<S> = S extends BaseSchema<any, infer O>
  ? O
  : S extends keyof SchemaPrimitiveMap
    ? SchemaPrimitiveMap[S]
    : S extends Record<string, any>
      ? InferSchema<S>
      : unknown;
type InferObject<S extends SchemaDefinition> = Simplify<
  { [K in RequiredKeys<S>]: SchemaType<S[K]> } & { [K in OptionalKeys<S>]?: SchemaType<S[K]> }
>;
type InferSchema<S> = S extends BaseSchema<any, infer O>
  ? O
  : S extends "string"
    ? string
    : S extends "number"
      ? number
      : S extends "boolean"
        ? boolean
        : S extends { [key: string]: any }
          ? {
              [K in keyof S as undefined extends InferSchema<S[K]> ? K : never]?: InferSchema<S[K]>;
            } & {
              [K in keyof S as undefined extends InferSchema<S[K]> ? never : K]: InferSchema<S[K]>;
            }
          : unknown;
type SchemaDefinition = { [key: string]: SchemaPrimitive | SchemaLike | BaseSchema<any, any> };
interface SchemaLike {
  [key: string]: SchemaPrimitive | SchemaLike | BaseSchema<any, any>;
}

interface Schema<I, O> extends StandardSchemaV1<I, O> {
  optional(): OptionalSchema<I, O | undefined>;
  enum<V extends O & (string | number | boolean), Values extends readonly [V, ...V[]]>(
    values: Values,
  ): UnionSchema<I, Values[number]>;
  array(): ArraySchema<I, O[]>;
  instanceOf<C extends new (...args: any[]) => any>(
    constructor: C,
  ): InstanceOfSchema<I, InstanceType<C>>;
  jsonSchema: any;
  readonly inferred: O;
}

export abstract class BaseSchema<I, O> implements Schema<I, O> {
  protected wasmSchema: HSchema;

  constructor(wasmSchema: HSchema) {
    this.wasmSchema = wasmSchema;
  }

  get "~standard"(): StandardSchemaV1.Props<I, O> {
    return {
      version: 1,
      vendor: "h-schema-rs",
      validate: (value: unknown) => {
        const result = this.wasmSchema.validate(value);
        return result as StandardSchemaV1.Result<O>;
      },
    };
  }

  get jsonSchema(): any {
    return this.wasmSchema.get_json_schema();
  }
  get inferred(): O {
    return null as unknown as O;
  }

  coerce(): this {
    this.wasmSchema = this.wasmSchema.coerce();
    return this;
  }

  optional(): OptionalSchema<I, O | undefined> {
    return new OptionalSchema<I, O>(this.wasmSchema.optional(), this);
  }

  array(): ArraySchema<I, O[]> {
    return new ArraySchema<I, O[]>(HSchema.array(this.wasmSchema), this);
  }

  enum<V extends O & (string | number | boolean), Values extends readonly [V, ...V[]]>(
    values: Values,
  ): UnionSchema<I, Values[number]> {
    const literalSchemas = values.map((value) => h.literal(value));
    return h.options(...literalSchemas) as unknown as UnionSchema<I, Values[number]>;
  }

  instanceOf<C extends new (...args: any[]) => any>(
    constructor: C,
  ): InstanceOfSchema<I, InstanceType<C>> {
    return new InstanceOfSchema<I, InstanceType<C>>(this.wasmSchema, constructor);
  }
}

export class StringSchemaType extends BaseSchema<unknown, string> {
  constructor(s = HSchema.string()) {
    super(s);
  }
  minLength(n: number) {
    return new StringSchemaType(this.wasmSchema.min_length(n));
  }
  maxLength(n: number) {
    return new StringSchemaType(this.wasmSchema.max_length(n));
  }
  uuid() {
    return new StringSchemaType(this.wasmSchema.uuid());
  }
  email() {
    return new StringSchemaType(this.wasmSchema.email());
  }
  regex(r: RegExp) {
    return new StringSchemaType(this.wasmSchema.regex(r.source));
  }
  phone() {
    return new StringSchemaType(this.wasmSchema.phone());
  }
  domain(r = true) {
    return new StringSchemaType(this.wasmSchema.domain(r));
  }
}
export class NumberSchemaType extends BaseSchema<unknown, number> {
  constructor(s = HSchema.number()) {
    super(s);
  }
  min(n: number) {
    return new NumberSchemaType(this.wasmSchema.min(n));
  }
  max(n: number) {
    return new NumberSchemaType(this.wasmSchema.max(n));
  }
}
export class BooleanSchemaType extends BaseSchema<unknown, boolean> {
  constructor() {
    super(HSchema.boolean());
  }
}
export class NullSchemaType extends BaseSchema<unknown, null> {
  constructor() {
    super(HSchema.null_type());
  }
}
export class AnySchemaType extends BaseSchema<unknown, any> {
  constructor() {
    super(HSchema.any());
  }
}

export class LiteralSchema<I, T extends string | number | boolean> extends BaseSchema<I, T> {
  readonly value: T;
  constructor(value: T) {
    super(HSchema.literal(value));
    this.value = value;
  }
}

export class OptionalSchema<I, O> extends BaseSchema<I, O | undefined> {
  readonly innerSchema: BaseSchema<any, any>;
  constructor(ws: HSchema, originalSchema?: BaseSchema<any, any>) {
    super(ws);
    this.innerSchema = originalSchema as BaseSchema<any, any>;
  }
}

export class ArraySchema<I, O extends any[]> extends BaseSchema<I, O> {
  readonly innerSchema: BaseSchema<any, any>;
  constructor(ws: HSchema, originalSchema?: BaseSchema<any, any>) {
    super(ws);
    this.innerSchema = originalSchema as BaseSchema<any, any>;
  }
}

export class ObjectSchemaType<T extends Record<string, unknown>> extends BaseSchema<unknown, T> {
  readonly definition: SchemaDefinition;
  constructor(definition: SchemaDefinition) {
    const rustObject = HSchema.object();
    for (const key in definition) {
      const item = definition[key];
      let schemaToAdd: HSchema;
      if (item instanceof BaseSchema) {
        schemaToAdd = (item as any).wasmSchema;
      } else if (typeof item === "string") {
        if (item === "string") {
          schemaToAdd = HSchema.string();
        } else if (item === "number") {
          schemaToAdd = HSchema.number();
        } else if (item === "boolean") {
          schemaToAdd = HSchema.boolean();
        } else {
          schemaToAdd = HSchema.any();
        }
      } else {
        schemaToAdd = HSchema.any();
      }
      rustObject.add_prop(key, schemaToAdd);
    }
    super(rustObject);
    this.definition = definition;
  }
}

export class UnionSchema<I, O> extends BaseSchema<I, O> {
  readonly schemas: BaseSchema<any, any>[];
  constructor(schemas: BaseSchema<any, any>[]) {
    // @ts-ignore
    const rustSchemas = schemas.map((s) => s.wasmSchema);
    super(HSchema.union(rustSchemas));
    this.schemas = schemas;
  }
}

export class InstanceOfSchema<I, O> extends BaseSchema<I, O> {
  readonly classConstructor: new (
    ...args: any[]
  ) => any;
  constructor(_baseWasm: HSchema, constructor: new (...args: any[]) => any) {
    super(HSchema.instance_of(constructor, constructor.name));
    this.classConstructor = constructor;
  }
}

export type AnySchema = SchemaPrimitive | BaseSchema<any, any> | SchemaDefinition;

function toStandardRaw(schema: AnySchema): BaseSchema<any, any> {
  if (schema instanceof BaseSchema) {
    return schema;
  }
  if (schema === "string") {
    return new StringSchemaType();
  }
  if (schema === "number") {
    return new NumberSchemaType();
  }
  if (schema === "boolean") {
    return new BooleanSchemaType();
  }
  if (typeof schema === "object" && schema !== null) {
    return new ObjectSchemaType(schema);
  }
  return new AnySchemaType();
}

/**
 * Collection of helper functions for creating schema types.
 * @returns {typeof h} Schema type helpers
 */
export const h = {
  /**
   * Create a string schema type.
   * @returns {StringSchemaType} String schema type
   */
  string: (): StringSchemaType => new StringSchemaType(),

  /**
   * Create a number schema type.
   * @returns {NumberSchemaType} Number schema type
   */
  number: (): NumberSchemaType => new NumberSchemaType(),

  /**
   * Create a boolean schema type.
   * @returns {BooleanSchemaType} Boolean schema type
   */
  boolean: (): BooleanSchemaType => new BooleanSchemaType(),

  /**
   * Create a null schema type.
   * @returns {NullSchemaType} Null schema type
   */
  null: (): NullSchemaType => new NullSchemaType(),

  /**
   * Create an "any" schema type.
   * @returns {AnySchemaType} Any schema type
   */
  any: (): AnySchemaType => new AnySchemaType(),

  /**
   * Create a literal schema type.
   * @template T
   * @param {T} val - Literal value
   * @returns {LiteralSchema<T>} Literal schema type
   */
  literal: <T extends string | number | boolean>(val: T) => new LiteralSchema(val),

  /**
   * Create an object schema type.
   * @template S
   * @param {S} [schemaDef] - Optional schema definition
   * @returns {ObjectSchemaType<InferObject<S>>} Object schema type
   */
  object: <S extends SchemaDefinition>(schemaDef?: S) =>
    new ObjectSchemaType(schemaDef || {}) as ObjectSchemaType<InferObject<S>>,

  /**
   * Create an array schema type.
   * @template S
   * @param {S} schema - Schema definition for array items
   * @returns {ArraySchema<unknown, InferSchema<S>>} Array schema type
   */
  array: <S extends AnySchema>(schema: S) => {
    const std = toStandardRaw(schema);
    return std.array();
  },

  /**
   * Create an optional schema type.
   * @template S
   * @param {S} schema - Schema to mark as optional
   * @returns {OptionalSchema<unknown, InferSchema<S>>} Optional schema type
   */
  optional: <S extends AnySchema>(schema: S) => {
    const std = toStandardRaw(schema);
    return std.optional();
  },

  /**
   * Create a union schema from multiple schemas.
   * @template S
   * @param {...S} schemas - Schemas to combine
   * @returns {UnionSchema<unknown, InferSchema<S[number]>>} Union schema type
   */
  options: <S extends AnySchema[]>(...schemas: S): UnionSchema<unknown, InferSchema<S[number]>> => {
    const stdSchemas = schemas.map((s) => toStandardRaw(s));
    return new UnionSchema<unknown, InferSchema<S[number]>>(stdSchemas);
  },

  /**
   * Create an enum schema from a list of primitive values.
   * @template T
   * @template Values
   * @param {Values} values - Array of allowed literal values
   * @returns {UnionSchema<unknown, Values[number]>} Enum schema type
   * @throws {Error} If the array is empty
   */
  enum: <T extends string | number | boolean, Values extends readonly [T, ...T[]]>(
    values: Values,
  ) => {
    if (!values || values.length === 0) {
      throw new Error("h.enum() requires non-empty array");
    }
    const literals = values.map((v) => h.literal(v));
    return h.options(...literals) as UnionSchema<unknown, Values[number]>;
  },

  /**
   * Create a schema that validates instances of a specific class.
   * @template C
   * @param {C} constructor - Constructor function or class
   * @returns {InstanceOfSchema<unknown, InstanceType<C>>} InstanceOf schema type
   */
  instanceOf: <C extends new (...args: any[]) => any>(constructor: C) => {
    return new ObjectSchemaType({}).instanceOf(constructor);
  },

  /**
   * Create a UUID schema type.
   * @returns {StringSchemaType} UUID schema type
   */
  uuid: (): StringSchemaType => h.string().uuid(),

  /**
   * Create an email schema type.
   * @returns {StringSchemaType} Email schema type
   */
  email: (): StringSchemaType => h.string().email(),

  /**
   * Create a regex-validated string schema type.
   * @param {RegExp} r - Regular expression
   * @returns {StringSchemaType} Regex schema type
   */
  regex: (r: RegExp): StringSchemaType => h.string().regex(r),

  /**
   * Create a phone schema type.
   * @returns {StringSchemaType} Phone schema type
   */
  phone: (): StringSchemaType => h.string().phone(),

  /**
   * Create a domain schema type.
   * @param {boolean} [req=true] - Whether domain must include http/https
   * @returns {StringSchemaType} Domain schema type
   */
  domain: (req = true): StringSchemaType => h.string().domain(req),

  /**
   * Convert any schema into a standard schema.
   * @template T
   * @param {AnySchema} schema - Schema to convert
   * @returns {Schema<unknown, T>} Standardized schema
   */
  toStandard: <T>(schema: AnySchema): Schema<unknown, T> =>
    toStandardRaw(schema) as unknown as Schema<unknown, T>,
};
