import { afterAll, describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

const app = new Framework()
  .get(
    "/json",
    () => {
      return Response.json({
        message: "This is a JSON response",
        success: true,
        data: [1, 2, 3],
      });
    },
    {
      response: h.object({
        message: h.string(),
        success: h.boolean(),
        data: h.array(h.number()),
      }),
    },
  )
  .post(
    "/json",
    (context) => {
      return Response.json({
        message: "Received JSON data",
        receivedData: context.body,
      });
    },
    {
      body: h.object({
        name: h.string(),
        age: h.number(),
      }),
      response: h.object({
        message: h.optional(h.string()),
        receivedData: h.object({
          name: h.optional(h.string()),
          age: h.optional(h.number()),
        }),
      }),
    },
  )

  .get(
    "/text",
    () => {
      return new Response("This is a plain text response", {
        headers: { "Content-Type": "text/plain" },
      });
    },
    {
      response: h.optional(h.string()),
    },
  )
  .post(
    "/text",
    (context) => {
      return new Response(`Received: ${context.body.message}`, {
        headers: { "Content-Type": "text/plain" },
      });
    },
    {
      body: h.object({
        message: h.string(),
      }),
      response: h.optional(h.string()),
    },
  )

  .get(
    "/form-data",
    () => {
      const formData = new FormData();
      formData.append("field1", "value1");
      formData.append("field2", "value2");
      formData.append("field3", "value3");
      return new Response(formData);
    },
    {
      response: h.optional(h.instanceOf(FormData)),
    },
  )
  .post(
    "/form-data",
    (context) => {
      const formData = new FormData();
      formData.append("received", "true");
      formData.append("originalValue", context.body.message);
      return new Response(formData);
    },
    {
      body: h.object({
        message: h.string(),
      }),
      response: h.optional(h.instanceOf(FormData)),
    },
  )

  .get(
    "/bytes",
    () => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode("This is binary data as Uint8Array");
      return new Response(bytes);
    },
    {
      response: h.optional(h.instanceOf(Uint8Array)),
    },
  )
  .post(
    "/bytes",
    (context) => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(`Received message: ${context.body.message}`);
      return new Response(bytes);
    },
    {
      body: h.object({
        message: h.string(),
      }),
      response: h.optional(h.instanceOf(Uint8Array)),
    },
  )

  .get(
    "/array-buffer",
    () => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode("This is binary data as ArrayBuffer").buffer;
      return new Response(buffer);
    },
    {
      response: h.optional(h.instanceOf(ArrayBuffer)),
    },
  )
  .post(
    "/array-buffer",
    (context) => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(`Received message: ${context.body.message}`).buffer;
      return new Response(buffer);
    },
    {
      body: h.object({
        message: h.string(),
      }),
      response: h.optional(h.instanceOf(ArrayBuffer)),
    },
  )

  .get(
    "/blob",
    () => {
      const blob = new Blob(["This is blob data"], { type: "text/plain" });
      return new Response(blob);
    },
    {
      response: h.optional(h.instanceOf(Blob)),
    },
  )
  .post(
    "/blob",
    (context) => {
      const blob = new Blob([`Received message: ${context.body.message}`], { type: "text/plain" });
      return new Response(blob);
    },
    {
      body: h.object({
        message: h.string(),
      }),
      response: h.optional(h.instanceOf(Blob)),
    },
  )

  .delete(
    "/resource/:id",
    (context) => {
      return new Response(`Deleted resource ${context.params.id}`, {
        headers: { "Content-Type": "text/plain" },
      });
    },
    {
      params: h.object({
        id: h.number().coerce(),
      }),
      response: h.optional(h.string()),
    },
  )

  .patch(
    "/resource/:id",
    (context) => {
      return Response.json({
        message: `Updated resource ${context.params.id}`,
        updatedFields: context.body,
      });
    },
    {
      params: h.object({
        id: h.number().coerce(),
      }),
      body: h.object({
        name: h.optional(h.string()),
        status: h.optional(h.string()),
      }),
      response: h.object({
        message: h.optional(h.string()),
        updatedFields: h.object({
          name: h.optional(h.string()),
          status: h.optional(h.string()),
        }),
      }),
    },
  )

  .put(
    "/resource/:id",
    (context) => {
      return Response.json({
        message: `Replaced resource ${context.params.id}`,
        notify: context.query.notify || "no",
        data: context.body,
      });
    },
    {
      params: h.object({
        id: h.number().coerce(),
      }),
      query: h.object({
        notify: h.optional(h.enum(["yes", "no"])),
      }),
      body: h.object({
        name: h.string(),
        description: h.optional(h.string()),
      }),
      response: h.object({
        message: h.optional(h.string()),
        notify: h.optional(h.enum(["yes", "no"])),
        data: h.object({
          name: h.optional(h.string()),
          description: h.optional(h.string()),
        }),
      }),
    },
  )
  .listen(3007);

const client = createClient<typeof app>("http://localhost:3007");

describe("Response Format Tests", () => {
  describe("JSON Format", () => {
    it("should get JSON response", async () => {
      const { data, error } = await client.json.get();

      expect(error).toBeNull();
      expect(data).toEqual({
        message: "This is a JSON response",
        success: true,
        data: [1, 2, 3],
      });
    });

    it("should post and receive JSON response", async () => {
      const { data, error } = await client.json.post({
        body: { name: "John Doe", age: 30 },
      });

      expect(error).toBeNull();
      expect(data).toEqual({
        message: "Received JSON data",
        receivedData: {
          name: "John Doe",
          age: 30,
        },
      });
    });
  });

  describe("Text Format", () => {
    it("should get text response", async () => {
      const { data, error } = await client.text.get({ responseFormat: "text" });

      expect(error).toBeNull();
      expect(data).toBe("This is a plain text response");
    });

    it("should post and receive text response", async () => {
      const { data, error } = await client.text.post({
        body: { message: "Hello, server!" },
        responseFormat: "text",
      });

      expect(error).toBeNull();
      expect(data).toBe("Received: Hello, server!");
    });
  });

  describe("FormData Format", () => {
    it("should get FormData response", async () => {
      const { data, error } = await client["form-data"].get({
        responseFormat: "formData",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(FormData);
      expect(data?.get("field1")).toBe("value1");
      expect(data?.get("field2")).toBe("value2");
      expect(data?.get("field3")).toBe("value3");
    });

    it("should post and receive FormData response", async () => {
      const { data, error } = await client["form-data"].post({
        body: { message: "Form data test" },
        responseFormat: "formData",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(FormData);
      expect(data?.get("received")).toBe("true");
      expect(data?.get("originalValue")).toBe("Form data test");
    });
  });

  describe("Bytes Format", () => {
    it("should get Uint8Array response", async () => {
      const { data, error } = await client.bytes.get({ responseFormat: "bytes" });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Uint8Array);

      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      expect(text).toBe("This is binary data as Uint8Array");
    });

    it("should post and receive Uint8Array response", async () => {
      const { data, error } = await client.bytes.post({
        body: { message: "Binary data test" },
        responseFormat: "bytes",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Uint8Array);

      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      expect(text).toBe("Received message: Binary data test");
    });
  });

  describe("ArrayBuffer Format", () => {
    it("should get ArrayBuffer response", async () => {
      const { data, error } = await client["array-buffer"].get({
        responseFormat: "arrayBuffer",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(ArrayBuffer);

      const decoder = new TextDecoder();
      const text = decoder.decode(new Uint8Array(data as ArrayBuffer));
      expect(text).toBe("This is binary data as ArrayBuffer");
    });

    it("should post and receive ArrayBuffer response", async () => {
      const { data, error } = await client["array-buffer"].post({
        body: { message: "ArrayBuffer test" },
        responseFormat: "arrayBuffer",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(ArrayBuffer);

      const decoder = new TextDecoder();
      const text = decoder.decode(new Uint8Array(data as ArrayBuffer));
      expect(text).toBe("Received message: ArrayBuffer test");
    });
  });

  describe("Blob Format", () => {
    it("should get Blob response", async () => {
      const { data, error } = await client.blob.get({ responseFormat: "blob" });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Blob);

      const text = await data?.text();
      expect(text).toBe("This is blob data");
    });

    it("should post and receive Blob response", async () => {
      const { data, error } = await client.blob.post({
        body: { message: "Blob test" },
        responseFormat: "blob",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Blob);

      const text = await data?.text();
      expect(text).toBe("Received message: Blob test");
    });
  });

  describe("Other HTTP Methods", () => {
    it("should handle DELETE with text response", async () => {
      const { data, error } = await client.resource.id(123).delete({ responseFormat: "text" });

      expect(error).toBeNull();
      expect(data).toBe("Deleted resource 123");
    });

    it("should handle PATCH with JSON response", async () => {
      const { data, error } = await client.resource.id(456).patch({
        body: { name: "Updated Name", status: "active" },
      });

      expect(error).toBeNull();
      expect(data).toEqual({
        message: "Updated resource 456",
        updatedFields: {
          name: "Updated Name",
          status: "active",
        },
      });
    });

    it("should handle PUT with query params and JSON response", async () => {
      const { data, error } = await client.resource.id(789).put({
        body: { name: "New Resource", description: "This is a new resource" },
        query: { notify: "yes" },
      });

      expect(error).toBeNull();
      expect(data).toEqual({
        message: "Replaced resource 789",
        notify: "yes",
        data: {
          name: "New Resource",
          description: "This is a new resource",
        },
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle response format fallback to JSON if no format specified", async () => {
      const { data, error } = await client.json.get();

      expect(error).toBeNull();
      expect(data).toEqual({
        message: "This is a JSON response",
        success: true,
        data: [1, 2, 3],
      });
    });

    it("should handle validation errors", async () => {
      try {
        await client.json.post({
          body: { name: "John Doe", age: "thirty" as any },
        });

        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  afterAll(() => {
    app.close();
  });
});
