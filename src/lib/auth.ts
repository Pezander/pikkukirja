import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
        if (!user) {
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
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
