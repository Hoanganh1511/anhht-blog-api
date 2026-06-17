import { ExpressAuth } from "@auth/express";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "@auth/core/providers/google";
import GitHub from "@auth/core/providers/github";
import { prisma } from "../lib/prisma";

export const authHandler = ExpressAuth({
  basePath: "/auth",
  secret: process.env.AUTH_SECRET,
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
    async redirect({ url }) {
      const frontendUrl = process.env.FRONTEND_URL!;
      if (url.startsWith("/")) return `${frontendUrl}${url}`;
      if (url.startsWith(frontendUrl)) return url;
      return frontendUrl;
    },
    async signIn({ user }) {
      if (user.email === process.env.ADMIN_EMAIL) {
        await prisma.user.updateMany({
          where: { email: user.email },
          data: { role: "ADMIN" },
        });
        (user as Record<string, unknown>).role = "ADMIN";
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = (user as Record<string, unknown>).role as string ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as unknown as Record<string, unknown>).id = token.id as string;
      (session.user as unknown as Record<string, unknown>).role = token.role as "USER" | "ADMIN";
      return session;
    },
  },
  pages: {
    signIn: `${process.env.FRONTEND_URL}/login`,
  },
  trustHost: true,
});
