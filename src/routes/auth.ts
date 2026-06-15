import { ExpressAuth } from "@auth/express";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/core/providers/google";
import GitHub from "@auth/core/providers/github";
import { prisma } from "../lib/prisma";

export const authHandler = ExpressAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (user.email === process.env.ADMIN_EMAIL) {
        await prisma.user.updateMany({
          where: { email: user.email },
          data: { role: "ADMIN" },
        });
        user.role = "ADMIN";
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "USER" | "ADMIN";
      return session;
    },
  },
  pages: {
    signIn: `${process.env.FRONTEND_URL}/login`,
  },
  trustHost: true,
});
