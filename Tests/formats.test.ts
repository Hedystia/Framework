import { Framework, createClient } from "../Package/src";
import { z } from "zod";

import { describe, expect, it } from "bun:test";

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
      response: z.object({
        message: z.string(),
        success: z.boolean(),
        data: z.array(z.number()),
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
      body: z.object({
        name: z.string(),
        age: z.number(),
      }),
      response: z.object({
        message: z.string().optional(),
        receivedData: z.object({
          name: z.string().optional(),
          age: z.number().optional(),
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
      response: z.string().optional(),
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
      body: z.object({
        message: z.string(),
      }),
      response: z.string().optional(),
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
      response: z.instanceof(FormData).optional(),
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
      body: z.object({
        message: z.string(),
      }),
      response: z.instanceof(FormData).optional(),
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
      response: z.instanceof(Uint8Array).optional(),
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
      body: z.object({
        message: z.string(),
      }),
      response: z.instanceof(Uint8Array).optional(),
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
      response: z.instanceof(ArrayBuffer).optional(),
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
      body: z.object({
        message: z.string(),
      }),
      response: z.instanceof(ArrayBuffer).optional(),
    },
  )

  .get(
    "/blob",
    () => {
      const blob = new Blob(["This is blob data"], { type: "text/plain" });
      return new Response(blob);
    },
    {
      response: z.instanceof(Blob).optional(),
    },
  )
  .post(
    "/blob",
    (context) => {
      const blob = new Blob([`Received message: ${context.body.message}`], { type: "text/plain" });
      return new Response(blob);
    },
    {
      body: z.object({
        message: z.string(),
      }),
      response: z.instanceof(Blob).optional(),
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
      params: z.object({
        id: z.coerce.number(),
      }),
      response: z.string().optional(),
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
      params: z.object({
        id: z.coerce.number(),
      }),
      body: z.object({
        name: z.string().optional(),
        status: z.string().optional(),
      }),
      response: z.object({
        message: z.string().optional(),
        updatedFields: z.object({
          name: z.string().optional(),
          status: z.string().optional(),
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
      params: z.object({
        id: z.coerce.number(),
      }),
      query: z.object({
        notify: z.enum(["yes", "no"]).optional(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
      response: z.object({
        message: z.string().optional(),
        notify: z.enum(["yes", "no"]).optional(),
        data: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
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
        name: "John Doe",
        age: 30,
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
      const { data, error } = await client.text.get(undefined, { responseFormat: "text" });

      expect(error).toBeNull();
      expect(data).toBe("This is a plain text response");
    });

    it("should post and receive text response", async () => {
      const { data, error } = await client.text.post({ message: "Hello, server!" }, undefined, {
        responseFormat: "text",
      });

      expect(error).toBeNull();
      expect(data).toBe("Received: Hello, server!");
    });
  });

  describe("FormData Format", () => {
    it("should get FormData response", async () => {
      const { data, error } = await client["form-data"].get(undefined, {
        responseFormat: "formData",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(FormData);
      expect(data?.get("field1")).toBe("value1");
      expect(data?.get("field2")).toBe("value2");
      expect(data?.get("field3")).toBe("value3");
    });

    it("should post and receive FormData response", async () => {
      const { data, error } = await client["form-data"].post(
        { message: "Form data test" },
        undefined,
        { responseFormat: "formData" },
      );

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(FormData);
      expect(data?.get("received")).toBe("true");
      expect(data?.get("originalValue")).toBe("Form data test");
    });
  });

  describe("Bytes Format", () => {
    it("should get Uint8Array response", async () => {
      const { data, error } = await client.bytes.get(undefined, { responseFormat: "bytes" });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Uint8Array);

      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      expect(text).toBe("This is binary data as Uint8Array");
    });

    it("should post and receive Uint8Array response", async () => {
      const { data, error } = await client.bytes.post({ message: "Binary data test" }, undefined, {
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
      const { data, error } = await client["array-buffer"].get(undefined, {
        responseFormat: "arrayBuffer",
      });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(ArrayBuffer);

      const decoder = new TextDecoder();
      const text = decoder.decode(new Uint8Array(data as ArrayBuffer));
      expect(text).toBe("This is binary data as ArrayBuffer");
    });

    it("should post and receive ArrayBuffer response", async () => {
      const { data, error } = await client["array-buffer"].post(
        { message: "ArrayBuffer test" },
        undefined,
        { responseFormat: "arrayBuffer" },
      );

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(ArrayBuffer);

      const decoder = new TextDecoder();
      const text = decoder.decode(new Uint8Array(data as ArrayBuffer));
      expect(text).toBe("Received message: ArrayBuffer test");
    });
  });

  describe("Blob Format", () => {
    it("should get Blob response", async () => {
      const { data, error } = await client.blob.get(undefined, { responseFormat: "blob" });

      expect(error).toBeNull();
      expect(data).toBeInstanceOf(Blob);

      const text = await data?.text();
      expect(text).toBe("This is blob data");
    });

    it("should post and receive Blob response", async () => {
      const { data, error } = await client.blob.post({ message: "Blob test" }, undefined, {
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
      const { data, error } = await client.resource
        .id(123)
        .delete(undefined, undefined, { responseFormat: "text" });

      expect(error).toBeNull();
      expect(data).toBe("Deleted resource 123");
    });

    it("should handle PATCH with JSON response", async () => {
      const { data, error } = await client.resource.id(456).patch({
        name: "Updated Name",
        status: "active",
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
      const { data, error } = await client.resource.id(789).put(
        {
          name: "New Resource",
          description: "This is a new resource",
        },
        { notify: "yes" },
      );

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
          name: "John Doe",
          age: "thirty" as any,
        });

        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
