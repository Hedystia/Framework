import { afterAll, describe, expect, it } from "bun:test";
import Framework from "hedystia";

const appWithSpecificOrigin = new Framework({
  cors: {
    origin: "http://allowed-client.com",
    methods: ["GET", "POST"],
    credentials: true,
    maxAge: 86400,
  },
}).get("/", () => "CORS OK");

appWithSpecificOrigin.listen(3025);

const appWithWildcardOrigin = new Framework({
  cors: { origin: "*" },
}).post("/", () => "Wildcard CORS OK");

appWithWildcardOrigin.listen(3026);

const appWithFunctionOrigin = new Framework({
  cors: {
    origin: (origin) => {
      return origin?.endsWith(".approved.org") ?? false;
    },
  },
}).get("/", () => "Dynamic CORS OK");

appWithFunctionOrigin.listen(3027);

describe("CORS Tests", () => {
  describe("Specific Origin Configuration", () => {
    it("should handle OPTIONS pre-flight request from an allowed origin", async () => {
      const response = await fetch("http://localhost:3025/", {
        method: "OPTIONS",
        headers: {
          Origin: "http://allowed-client.com",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://allowed-client.com");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,POST");
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("should handle actual GET request from an allowed origin", async () => {
      const response = await fetch("http://localhost:3025/", {
        headers: { Origin: "http://allowed-client.com" },
      });
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toBe("CORS OK");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://allowed-client.com");
      expect(response.headers.get("Vary")).toContain("Origin");
    });

    it("should not add CORS headers for a request from a disallowed origin", async () => {
      const response = await fetch("http://localhost:3025/", {
        headers: { Origin: "http://disallowed-client.com" },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("Wildcard Origin Configuration", () => {
    it("should allow any origin with '*'", async () => {
      const response = await fetch("http://localhost:3026/", {
        method: "POST",
        headers: { Origin: "http://any-random-client.net" },
        body: "test",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("Function Origin Configuration", () => {
    it("should allow a dynamically approved origin", async () => {
      const response = await fetch("http://localhost:3027/", {
        headers: { Origin: "https://frontend.approved.org" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://frontend.approved.org",
      );
    });

    it("should block a dynamically disapproved origin", async () => {
      const response = await fetch("http://localhost:3027/", {
        headers: { Origin: "https://frontend.unapproved.com" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  afterAll(() => {
    appWithSpecificOrigin.close();
    appWithWildcardOrigin.close();
    appWithFunctionOrigin.close();
  });
});
