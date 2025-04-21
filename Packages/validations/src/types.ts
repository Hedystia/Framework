import type { StandardSchemaV1 } from "@standard-schema/spec";

type SchemaPrimitive = "string" | "number" | "boolean" | "any";

interface SchemaLike {
  [key: string]: SchemaPrimitive | SchemaLike | BaseSchema<any, any>;
}

type Simplify<T> = T extends any ? { [K in keyof T]: T[K] } : never;

type RequiredKeys<S> = {
  [K in keyof S]: S[K] extends OptionalSchema<any, any> ? never : K;
}[keyof S];

type OptionalKeys<S> = {
  [K in keyof S]: S[K] extends OptionalSchema<any, any> ? K : never;
}[keyof S];

type SchemaPrimitiveMap = {
  string: string;
  number: number;
  boolean: boolean;
  any: unknown;
};

type SchemaType<S> = S extends BaseSchema<any, infer O>
  ? O
  : S extends keyof SchemaPrimitiveMap
    ? SchemaPrimitiveMap[S]
    : S extends Record<string, any>
      ? InferSchema<S>
      : unknown;

type InferObject<S extends SchemaDefinition> = Simplify<
  {
    [K in RequiredKeys<S>]: SchemaType<S[K]>;
  } & {
    [K in OptionalKeys<S>]?: SchemaType<S[K]>;
  }
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

type SchemaDefinition = SchemaLike;

interface Schema<I, O> extends StandardSchemaV1<I, O> {
  optional(): OptionalSchema<I, O | undefined>;
  enum<Values extends readonly [O, ...O[]]>(values: Values): EnumSchema<I, Values[number]>;
  array(): ArraySchema<I, O[]>;
  instanceOf<C extends new (...args: any[]) => any>(
    constructor: C,
  ): InstanceOfSchema<I, InstanceType<C>>;
  jsonSchema: any;
  readonly inferred: O;
  schema: Schema<I, O>;
}

abstract class BaseSchema<I, O> implements Schema<I, O> {
  abstract readonly "~standard": StandardSchemaV1.Props<I, O>;
  jsonSchema: any = {};
  get inferred(): O {
    return null as unknown as O;
  }
  schema: Schema<I, O> = this;
  protected _coerce: boolean = false;

  coerce(): this {
    this._coerce = true;
    return this;
  }

  optional(): OptionalSchema<I, O | undefined> {
    return new OptionalSchema<I, O>(this);
  }

  enum<Values extends readonly [O, ...O[]]>(values: Values): EnumSchema<I, Values[number]> {
    return new EnumSchema<I, Values[number]>(this, values);
  }

  array(): ArraySchema<I, O[]> {
    return new ArraySchema<I, O[]>(this);
  }

  instanceOf<C extends new (...args: any[]) => any>(
    constructor: C,
  ): InstanceOfSchema<I, InstanceType<C>> {
    return new InstanceOfSchema<I, InstanceType<C>>(this, constructor);
  }
}

function validatePrimitive(schema: SchemaPrimitive, value: unknown): boolean {
  if (typeof value === "string" && schema === "string") return true;
  if (typeof value === "number" && schema === "number" && !Number.isNaN(value)) return true;
  if (typeof value === "boolean" && schema === "boolean") return true;
  return false;
}

class StringSchemaType extends BaseSchema<unknown, string> {
  readonly type: SchemaPrimitive = "string";
  private _validateEmail: boolean = false;
  private _validatePhone: boolean = false;

  constructor() {
    super();
    this.jsonSchema = { type: "string" };
  }

  primitive(): SchemaPrimitive {
    return this.type;
  }

  email(): StringSchemaType {
    const schema = new StringSchemaType();
    schema._validateEmail = true;
    schema.jsonSchema = { ...this.jsonSchema, format: "email" };
    return schema;
  }

  phone(): StringSchemaType {
    const schema = new StringSchemaType();
    schema._validatePhone = true;
    schema.jsonSchema = { ...this.jsonSchema, format: "phone" };
    return schema;
  }

  readonly "~standard": StandardSchemaV1.Props<unknown, string> = {
    version: 1,
    vendor: "h-schema",
    validate: (value: unknown) => {
      if (this._coerce && typeof value !== "string") {
        value = String(value);
      }

      if (typeof value !== "string") {
        return {
          issues: [{ message: "Expected string, received " + typeof value }],
        };
      }

      if (this._validateEmail && !this._isValidEmail(value)) {
        return {
          issues: [{ message: "Invalid email format" }],
        };
      }

      if (this._validatePhone && !this._isValidPhone(value)) {
        return {
          issues: [{ message: "Invalid phone number format" }],
        };
      }

      return { value };
    },
    types: {
      input: {} as unknown,
      output: {} as string,
    },
  };

  private _isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private _isValidPhone(value: string): boolean {
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    return phoneRegex.test(value);
  }
}

class NumberSchemaType extends BaseSchema<unknown, number> {
  readonly type: SchemaPrimitive = "number";

  constructor() {
    super();
    this.jsonSchema = { type: "number" };
  }

  primitive(): SchemaPrimitive {
    return this.type;
  }

  readonly "~standard": StandardSchemaV1.Props<unknown, number> = {
    version: 1,
    vendor: "h-schema",
    validate: (value: unknown) => {
      if (this._coerce && typeof value !== "number") {
        const coerced = Number(value);
        if (!Number.isNaN(coerced)) value = coerced;
      }
      if (typeof value !== "number" || Number.isNaN(value)) {
        return {
          issues: [{ message: "Expected number, received " + typeof value }],
        };
      }
      return { value };
    },
    types: {
      input: {} as unknown,
      output: {} as number,
    },
  };
}

class BooleanSchemaType extends BaseSchema<unknown, boolean> {
  readonly type: SchemaPrimitive = "boolean";

  constructor() {
    super();
    this.jsonSchema = { type: "boolean" };
  }

  primitive(): SchemaPrimitive {
    return this.type;
  }

  readonly "~standard": StandardSchemaV1.Props<unknown, boolean> = {
    version: 1,
    vendor: "h-schema",
    validate: (value: unknown) => {
      if (this._coerce && typeof value !== "boolean") {
        if (value === "true" || value === 1 || value === "1") value = true;
        else if (value === "false" || value === 0 || value === "0") value = false;
      }
      if (typeof value !== "boolean") {
        return {
          issues: [{ message: "Expected boolean, received " + typeof value }],
        };
      }
      return { value };
    },
    types: {
      input: {} as unknown,
      output: {} as boolean,
    },
  };
}

class AnySchemaType extends BaseSchema<unknown, any> {
  readonly type: SchemaPrimitive = "any";
  readonly "~standard": StandardSchemaV1.Props<unknown, any> = {
    version: 1,
    vendor: "h-schema",
    validate: (value: unknown) => {
      return { value };
    },
    types: {
      input: {} as unknown,
      output: {} as any,
    },
  };
}

class LiteralSchema<T extends string | number | boolean> extends BaseSchema<unknown, T> {
  private readonly value: T;

  constructor(value: T) {
    super();
    this.value = value;
    this.jsonSchema = {
      const: value,
      type: typeof value as "string" | "number" | "boolean",
    };
  }

  readonly "~standard": StandardSchemaV1.Props<unknown, T> = {
    version: 1,
    vendor: "h-schema",
    validate: (value: unknown) => {
      if (value !== this.value) {
        return {
          issues: [{ message: `Expected literal value ${this.value}, received ${value}` }],
        };
      }
      return { value: value as T };
    },
    types: {
      input: {} as unknown,
      output: {} as T,
    },
  };
}

class OptionalSchema<I, O> extends BaseSchema<I, O | undefined> {
  private readonly innerSchema: Schema<I, O>;

  constructor(schema: Schema<I, O>) {
    super();
    this.innerSchema = schema;
    this.jsonSchema = { ...schema.jsonSchema };
  }

  readonly "~standard": StandardSchemaV1.Props<I, O | undefined> = {
    version: 1,
    vendor: "h-schema",
    validate: async (value: unknown) => {
      if (value === undefined || value === null) {
        return { value: undefined };
      }

      const result = await this.innerSchema["~standard"].validate(value);
      return result;
    },
    types: {
      input: {} as I,
      output: {} as O | undefined,
    },
  };
}

class NullSchemaType extends BaseSchema<unknown, null> {
  readonly type: "null" = "null";
  constructor() {
    super();
    this.jsonSchema = { type: "null" };
  }

  readonly "~standard": StandardSchemaV1.Props<unknown, null> = {
    version: 1,
    vendor: "h-schema",
    validate: (value: unknown) => {
      if (value !== null) {
        return {
          issues: [
            {
              message: `Expected null, received ${value === undefined ? "undefined" : typeof value}`,
            },
          ],
        };
      }
      return { value: null };
    },
    types: {
      input: {} as unknown,
      output: {} as unknown as null,
    },
  };
}

class UnionSchema<I, O> extends BaseSchema<I, O> {
  private readonly schemas: Schema<I, any>[];
  constructor(...schemas: Schema<I, any>[]) {
    super();
    this.schemas = schemas;
    this.jsonSchema = { anyOf: schemas.map((s) => s.jsonSchema) };
  }

  readonly "~standard": StandardSchemaV1.Props<I, O> = {
    version: 1,
    vendor: "h-schema",
    validate: async (value: unknown) => {
      const issuesAccum: StandardSchemaV1.Issue[] = [];
      for (const schema of this.schemas) {
        const result = await schema["~standard"].validate(value);
        if (!("issues" in result)) {
          return { value: result.value };
        }
        issuesAccum.push(...result.issues!);
      }
      return { issues: issuesAccum };
    },
    types: {
      input: {} as I,
      output: {} as O,
    },
  };
}

class EnumSchema<I, O> extends BaseSchema<I, O> {
  private readonly innerSchema: Schema<I, any>;
  private readonly values: readonly O[];

  constructor(schema: Schema<I, any>, values: readonly O[]) {
    super();
    this.innerSchema = schema;
    this.values = values;
    this.jsonSchema = { ...schema.jsonSchema, enum: values };
  }

  readonly "~standard": StandardSchemaV1.Props<I, O> = {
    version: 1,
    vendor: "h-schema",
    validate: async (value: unknown) => {
      const result = await this.innerSchema["~standard"].validate(value);

      if ("issues" in result) {
        return result;
      }

      if (!this.values.includes(result.value)) {
        return {
          issues: [
            {
              message: `Invalid enum value. Expected one of: ${this.values.join(", ")}`,
            },
          ],
        };
      }

      return { value: result.value as O };
    },
    types: {
      input: {} as I,
      output: {} as O,
    },
  };
}

class ArraySchema<I, O extends any[]> extends BaseSchema<I, O> {
  private readonly innerSchema: Schema<I, O[number]>;

  constructor(schema: Schema<I, O[number]>) {
    super();
    this.innerSchema = schema;
    this.jsonSchema = { type: "array", items: schema.jsonSchema };
  }

  readonly "~standard": StandardSchemaV1.Props<I, O> = {
    version: 1,
    vendor: "h-schema",
    validate: async (value: unknown) => {
      if (!Array.isArray(value)) {
        return {
          issues: [{ message: "Expected array, received " + typeof value }],
        };
      }

      const results = await Promise.all(
        value.map(async (item, index) => {
          const result = await this.innerSchema["~standard"].validate(item);
          if ("issues" in result) {
            return {
              index,
              issues: result.issues?.map((issue) => ({
                ...issue,
                path: issue.path ? [index, ...issue.path] : [index],
              })),
            };
          }
          return { index, value: result.value };
        }),
      );

      const errors = results.filter((r) => "issues" in r) as {
        index: number;
        issues: StandardSchemaV1.Issue[];
      }[];

      if (errors.length > 0) {
        return {
          issues: errors.flatMap((e) => e.issues),
        };
      }

      return { value: results.map((r) => ("value" in r ? r.value : null)) as O };
    },
    types: {
      input: {} as I,
      output: {} as O,
    },
  };
}

class InstanceOfSchema<I, O> extends BaseSchema<I, O> {
  private readonly innerSchema: Schema<I, any>;
  private readonly classConstructor: new (
    ...args: any[]
  ) => any;

  constructor(schema: Schema<I, any>, classConstructor: new (...args: any[]) => any) {
    super();
    this.innerSchema = schema;
    this.classConstructor = classConstructor;
    this.jsonSchema = { ...schema.jsonSchema, instanceOf: classConstructor.name };
  }

  readonly "~standard": StandardSchemaV1.Props<I, O> = {
    version: 1,
    vendor: "h-schema",
    validate: async (value: unknown) => {
      if (!(value instanceof this.classConstructor)) {
        return {
          issues: [
            {
              message: `Expected instance of ${this.classConstructor.name}`,
            },
          ],
        };
      }

      const result = await this.innerSchema["~standard"].validate(value);
      return result as StandardSchemaV1.Result<O>;
    },
    types: {
      input: {} as I,
      output: {} as O,
    },
  };
}

class ObjectSchemaType<T extends Record<string, unknown>> extends BaseSchema<unknown, T> {
  readonly definition: SchemaDefinition;

  constructor(definition: SchemaDefinition) {
    super();
    this.definition = definition;

    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const key in definition) {
      const schemaItem = definition[key];
      const isOptional = schemaItem instanceof OptionalSchema;

      if (!isOptional) {
        required.push(key);
      }

      if (typeof schemaItem === "string") {
        properties[key] = { type: schemaItem };
      } else if (schemaItem instanceof BaseSchema) {
        properties[key] = schemaItem.jsonSchema;
      } else if (typeof schemaItem === "object" && schemaItem !== null) {
        properties[key] = { type: "object", properties: {} };
      }
    }

    this.jsonSchema = {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  readonly "~standard": StandardSchemaV1.Props<unknown, T> = {
    version: 1,
    vendor: "h-schema",
    validate: async (value: unknown): Promise<StandardSchemaV1.Result<T>> => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {
          issues: [
            {
              message:
                "Expected object, received " +
                (value === null ? "null" : Array.isArray(value) ? "array" : typeof value),
            },
          ],
        };
      }

      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      const issues: StandardSchemaV1.Issue[] = [];

      for (const key in this.definition) {
        const schemaItem = this.definition[key];
        const isOptional = schemaItem instanceof OptionalSchema;

        if (!(key in obj) && !isOptional) {
          issues.push({
            message: `Missing required property: ${key}`,
            path: [key],
          });
          continue;
        }

        if (key in obj) {
          if (typeof schemaItem === "string" && schemaItem in ["string", "number", "boolean"]) {
            const schemaPrimitive = schemaItem as SchemaPrimitive;
            if (!validatePrimitive(schemaPrimitive, obj[key])) {
              issues.push({
                message: `Invalid type for property ${key}: expected ${schemaPrimitive}`,
                path: [key],
              });
            } else {
              result[key] = obj[key];
            }
          } else if (schemaItem instanceof BaseSchema) {
            const validationResult = await schemaItem["~standard"].validate(obj[key]);
            if ("issues" in validationResult) {
              if (validationResult.issues) {
                issues.push(
                  ...validationResult.issues.map((issue) => ({
                    ...issue,
                    path: issue.path ? [key, ...issue.path] : [key],
                  })),
                );
              }
            } else {
              result[key] = validationResult.value;
            }
          }
        }
      }

      if (issues.length > 0) {
        return { issues };
      }

      return { value: result as T };
    },
    types: {
      input: {} as unknown,
      output: {} as T,
    },
  };
}

type AnySchema = SchemaPrimitive | BaseSchema<any, any> | SchemaDefinition;

function toStandard<T>(schema: AnySchema): Schema<unknown, T> {
  let standardSchema: Schema<unknown, T>;

  if (schema instanceof BaseSchema) {
    standardSchema = schema as Schema<unknown, T>;
  } else if (typeof schema === "string") {
    if (schema === "string")
      standardSchema = new StringSchemaType() as unknown as Schema<unknown, T>;
    else if (schema === "number")
      standardSchema = new NumberSchemaType() as unknown as Schema<unknown, T>;
    else if (schema === "boolean")
      standardSchema = new BooleanSchemaType() as unknown as Schema<unknown, T>;
    else throw new Error("Invalid schema type provided to toStandard");
  } else if (typeof schema === "object" && schema !== null && !Array.isArray(schema)) {
    standardSchema = new ObjectSchemaType<any>(schema as SchemaDefinition) as Schema<unknown, T>;
  } else {
    throw new Error("Invalid schema type provided to toStandard");
  }

  const z = {
    toJSONSchema: (schema: any) => schema.jsonSchema,
  };

  return {
    ...standardSchema,
    inferred: null as unknown as T,
    "~standard": standardSchema["~standard"],
    jsonSchema: z.toJSONSchema(standardSchema),
    schema: standardSchema,
    optional: () => new OptionalSchema<unknown, T>(standardSchema),
    enum: standardSchema.enum.bind(standardSchema),
    array: standardSchema.array.bind(standardSchema),
    instanceOf: standardSchema.instanceOf.bind(standardSchema),
  };
}

export const h = {
  string: (): StringSchemaType => new StringSchemaType(),
  number: (): NumberSchemaType => new NumberSchemaType(),
  boolean: (): BooleanSchemaType => new BooleanSchemaType(),
  null: (): NullSchemaType => new NullSchemaType(),

  any: (): AnySchemaType => new AnySchemaType(),

  literal: <T extends string | number | boolean>(value: T): LiteralSchema<T> =>
    new LiteralSchema<T>(value),

  object: <S extends SchemaDefinition>(schemaDef?: S): ObjectSchemaType<InferObject<S>> => {
    return new ObjectSchemaType(schemaDef || {}) as ObjectSchemaType<InferObject<S>>;
  },

  array: <S extends AnySchema>(schema: S): ArraySchema<unknown, InferSchema<S>[]> => {
    const base = toStandard<InferSchema<S>>(schema);
    return base.array();
  },

  enum: <T extends readonly [any, ...any[]]>(values: T): EnumSchema<unknown, T[number]> => {
    const firstValue = values[0];
    let baseSchema: Schema<unknown, any>;

    if (typeof firstValue === "string") {
      baseSchema = h.string();
    } else if (typeof firstValue === "number") {
      baseSchema = h.number();
    } else if (typeof firstValue === "boolean") {
      baseSchema = h.boolean();
    } else {
      throw new Error("Enum values must be primitives");
    }

    return baseSchema.enum(values);
  },

  optional: <S extends AnySchema>(
    schema: S,
  ): OptionalSchema<unknown, InferSchema<S> | undefined> => {
    return toStandard<InferSchema<S>>(schema).optional();
  },

  options: <S extends AnySchema[]>(...schemas: S): UnionSchema<unknown, InferSchema<S[number]>> => {
    const stdSchemas = schemas.map((s) => toStandard<InferSchema<S[number]>>(s).schema);
    return new UnionSchema<unknown, InferSchema<S[number]>>(...stdSchemas);
  },

  instanceOf: <C extends new (...args: any[]) => any>(
    constructor: C,
  ): InstanceOfSchema<unknown, InstanceType<C>> => {
    const baseSchema = h.object({});
    return baseSchema.instanceOf(constructor);
  },

  email: (): StringSchemaType => h.string().email(),

  phone: (): StringSchemaType => h.string().phone(),

  toStandard: toStandard,
};
