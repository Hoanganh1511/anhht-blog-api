import type { DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
  interface User {
    role?: "USER" | "ADMIN";
  }

  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: "USER" | "ADMIN";
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "ADMIN";
  }
}
