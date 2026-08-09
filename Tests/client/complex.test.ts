import { createClient } from "@hedystia/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const routes = [] as any;

describe("client request pipeline", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds nested paths, query parameters, merged headers, and JSON bodies", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createClient<typeof routes>("https://api.example.test/v2", {
      headers: { "X-Client": "web" },
      credentials: "include",
    });

    const result = await (client as any).teams.teamId("team-42").members.post({
      query: { notify: true, page: 2 },
      headers: { "X-Request": "req-9" },
      body: { name: "Ada" },
    });

    expect(result).toMatchObject({ status: 201, ok: true, data: { accepted: true }, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const request = url instanceof Request ? url : new Request(String(url), init);
    expect(request.url).toBe("https://api.example.test/teams/team-42/members?notify=true&page=2");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    expect(Object.fromEntries(request.headers)).toEqual({
      "content-type": "application/json",
      "x-client": "web",
      "x-request": "req-9",
    });
    expect(await request.text()).toBe(JSON.stringify({ name: "Ada" }));
  });

  it("supports text, bytes, array buffers, blobs, and streams through responseFormat", async () => {
    const payloads = [
      new Response("ready", { headers: { "Content-Type": "text/plain" } }),
      new Response(Uint8Array.from([1, 2, 3])),
      new Response(Uint8Array.from([4, 5])),
      new Response("blob-value"),
      new Response("stream-value"),
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockImplementation(async () => payloads.shift()!);
    const client = createClient<typeof routes>("https://api.example.test");

    expect((await (client as any).health.get({ responseFormat: "text" })).data).toBe("ready");
    expect(
      Array.from((await (client as any).health.get({ responseFormat: "bytes" })).data),
    ).toEqual([1, 2, 3]);
    expect(
      Array.from(
        new Uint8Array(
          (await (client as any).health.get({ responseFormat: "arrayBuffer" })).data as ArrayBuffer,
        ),
      ),
    ).toEqual([4, 5]);
    expect(await (await (client as any).health.get({ responseFormat: "blob" })).data.text()).toBe(
      "blob-value",
    );
    const streamResult = await (client as any).health.get({ responseFormat: "stream" });
    expect(streamResult.data).toBeInstanceOf(ReadableStream);
    expect(await new Response(streamResult.data).text()).toBe("stream-value");
  });

  it("returns structured HTTP and transport failures without throwing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "invalid" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const client = createClient<typeof routes>("https://api.example.test");

    const httpFailure = await (client as any).submit.post({ body: { value: 1 } });
    expect(httpFailure).toMatchObject({
      status: 422,
      ok: false,
      data: null,
      error: { message: "invalid" },
    });

    const transportFailure = await (client as any).submit.post({ body: { value: 1 } });
    expect(transportFailure).toMatchObject({ status: 0, ok: false, data: null });
    expect(transportFailure.error).toBeInstanceOf(Error);
  });
});
