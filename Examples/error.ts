import createClient from "@hedystia/client";
import Hedystia, { h } from "hedystia";

const app = new Hedystia()
  .get(
    "/user/:id",
    ({ params, error }) => {
      if (params.id === "invalid") {
        error(404, "User not found");
      }
      return { id: params.id, name: "John Doe" };
    },
    {
      params: h.object({
        id: h.string(),
      }),
      response: h.object({
        id: h.string(),
        name: h.string(),
      }),
      error: h.object({
        message: h.string(),
        code: h.number(),
      }),
    },
  )
  .subscription(
    "/notifications/:userId",
    async ({ params, sendData, sendError }) => {
      if (params.userId === "banned") {
        sendError({ reason: "User is banned", severity: "high" });
        return;
      }
      sendData({ message: "Welcome", timestamp: Date.now() });
    },
    {
      params: h.object({
        userId: h.string(),
      }),
      data: h.object({
        message: h.string(),
        timestamp: h.number(),
      }),
      error: h.object({
        reason: h.string(),
        severity: h.options(h.literal("low"), h.literal("high")),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

// HTTP error handling
const { data, error } = await client.user.id("invalid").get();
if (error) {
  console.log("Error:", error.message, error.code);
} else {
  console.log("User:", data?.name);
}

// Subscription with data and error
client.notifications.userId("active").subscribe(({ data, error }) => {
  if (data) {
    console.log("Notification:", data.message, data.timestamp);
  }
  if (error) {
    console.log("Error:", error.reason, error.severity);
  }
});
