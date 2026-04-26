import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyTotp, verifyBackupCode, decryptTotpSecret } from "@/lib/totp";
import { isRateLimited, recordFailure, clearAttempts } from "@/lib/rate-limiter";

class OtpRequiredError extends CredentialsSignin {
  code = "OTP_REQUIRED";
}

class OtpInvalidError extends CredentialsSignin {
  code = "OTP_INVALID";
}

class RateLimitError extends CredentialsSignin {
  code = "RATE_LIMIT";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Sähköposti", type: "email" },
        password: { label: "Salasana", type: "password" },
        totpCode: { label: "Koodi", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;

        const rl = isRateLimited(email);
        if (rl.limited) throw new RateLimitError();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          recordFailure(email);
          return null;
        }

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) {
          recordFailure(email);
          return null;
        }

        if (user.role === "admin" && user.totpEnabled) {
          const code = (credentials.totpCode as string | undefined)?.trim();
          if (!code) throw new OtpRequiredError();

          const secret = decryptTotpSecret(user.totpSecret!);
          const totpOk = verifyTotp(secret, code);
          if (!totpOk) {
            const hashedCodes = JSON.parse(user.backupCodes) as string[];
            const { valid: backupOk, remaining } = verifyBackupCode(hashedCodes, code);
            if (!backupOk) {
              recordFailure(email);
              throw new OtpInvalidError();
            }
            await prisma.user.update({
              where: { id: user.id },
              data: { backupCodes: JSON.stringify(remaining) },
            });
          }
        }

        clearAttempts(email);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const email = user.email!;
      const now = new Date();

      const invite = await prisma.invite.findUnique({ where: { email } });
      if (!invite || invite.usedAt || invite.expiresAt < now) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        const newUser = await prisma.user.create({
          data: {
            name: user.name ?? email,
            email,
            passwordHash: null,
            role: invite.role,
            googleId: user.id,
            authProvider: "google",
          },
        });
        await prisma.associationAccess.create({
          data: { userId: newUser.id, associationId: invite.associationId },
        });
      } else if (!existing.googleId) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { googleId: user.id, authProvider: "google" },
        });
      }

      await prisma.invite.update({ where: { email }, data: { usedAt: now } });
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({ where: { email: token.email! } });
          token.id = dbUser!.id;
          token.role = dbUser!.role;
        } else {
          token.id = user.id;
          token.role = (user as { role: string }).role;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
