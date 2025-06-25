import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";

const app = new Hedystia()
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
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client["form-data"].post({
  body: { message: "Form data test" },
  responseFormat: "formData",
});

console.log(`Error: ${error}`);
console.log(`Data: ${data?.get("received")}`);

app.close();
