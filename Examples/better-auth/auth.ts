import { typeormAdapter } from "@hedystia/better-auth-typeorm";
import { betterAuth } from "better-auth";
import { dataSource } from "./typeorm";

export const auth = betterAuth({
  database: typeormAdapter(dataSource),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: false,
  },
  advanced: {
    cookies: {
      session_token: {
        name: "better_auth_session",
      },
    },
  },
});
