import Hedystia from "hedystia";

export const client = new Hedystia()
  .get("/login", () => {
    return new Response(
      `
      <html>
        <body>
          <h1>Login</h1>
          <form method="POST">
            <input type="email" name="email" id="email" placeholder="Email">
            <input type="password" name="password" id="password" placeholder="Password">
            <button type="submit">Login</button>
          </form>
        </body>
        <script>
          const form = document.querySelector("form");
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const dataFromForm = {
              email,
              password,
            };
            const res = await fetch("/api/login", {
              method: "POST",
              body: JSON.stringify(dataFromForm),
              headers: {
                "Content-Type": "application/json",
              },
            }).catch((err) => {
              alert(err.message);
            });
            const data = await res.json();
            if (data.error) {
              alert(data.error);
            } else if (data.token) {
              window.location.href = "/protected";
            }
          });
        </script>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  })
  .get("/signup", () => {
    return new Response(
      `
      <html>
        <body>
          <h1>Signup</h1>
          <form method="POST">
            <input type="email" name="email" id="email" placeholder="Email">
            <input type="password" name="password" id="password" placeholder="Password">
            <input type="text" name="name" id="name" placeholder="Name">
            <button type="submit">Signup</button>
          </form>
        </body>
        <script>
          const form = document.querySelector("form");
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const name = document.getElementById("name").value;
            const dataFromForm = {
              email,
              password,
              name,
            };
            const res = await fetch("/api/signup", {
              method: "POST",
              body: JSON.stringify(dataFromForm),
              headers: {
                "Content-Type": "application/json",
              },
            }).catch((err) => {
              alert(err.message);
            });
            const data = await res.json();
            if (data.error) {
              alert(data.error);
            } else if (data.token) {
              window.location.href = "/protected";
            }
          });
        </script>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  });
