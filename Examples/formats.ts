import Hedystia, { z } from "hedystia";
import { createClient } from "@hedystia/client";

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
      body: z.object({
        message: z.string(),
      }),
      response: z.optional(z.instanceof(FormData)),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client["form-data"].post({ message: "Form data test" }, undefined, {
  responseFormat: "formData",
});

console.log(`Error: ${error}`);
console.log(`Data: ${data?.get("received")}`);

app.close();
