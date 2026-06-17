"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authHandler = void 0;
const express_1 = require("@auth/express");
const prisma_adapter_1 = require("@auth/prisma-adapter");
const google_1 = __importDefault(require("@auth/core/providers/google"));
const github_1 = __importDefault(require("@auth/core/providers/github"));
const prisma_1 = require("../lib/prisma");
exports.authHandler = (0, express_1.ExpressAuth)({
    adapter: (0, prisma_adapter_1.PrismaAdapter)(prisma_1.prisma),
    providers: [
        (0, google_1.default)({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        (0, github_1.default)({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    session: { strategy: "jwt" },
    callbacks: {
        async signIn({ user }) {
            if (user.email === process.env.ADMIN_EMAIL) {
                await prisma_1.prisma.user.updateMany({
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
            session.user.id = token.id;
            session.user.role = token.role;
            return session;
        },
    },
    pages: {
        signIn: `${process.env.FRONTEND_URL}/login`,
    },
    trustHost: true,
});
