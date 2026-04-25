"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PikkukirjaLogo } from "@/components/PikkukirjaLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP step
  const [step, setStep] = useState<"password" | "otp">("password");
  const [totpCode, setTotpCode] = useState("");

  // Password reset state
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      totpCode: step === "otp" ? totpCode : "",
      redirect: false,
    });

    if (!result?.error) {
      router.push(callbackUrl);
      router.refresh();
    } else if (result.code === "OTP_REQUIRED") {
      setStep("otp");
    } else if (result.code === "OTP_INVALID") {
      setError("Virheellinen koodi. Tarkista sovelluksesta tai käytä varakoodia.");
    } else if (result.code === "RATE_LIMIT") {
      setError("Liian monta epäonnistunutta yritystä. Yritä uudelleen 15 minuutin kuluttua.");
    } else {
      if (step === "otp") {
        setError("Kirjautuminen epäonnistui. Yritä uudelleen.");
        setStep("password");
        setTotpCode("");
      } else {
        setError("Väärä sähköposti tai salasana.");
      }
    }
    setLoading(false);
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    await fetch("/api/auth/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail }),
    });
    setResetSent(true);
    setResetLoading(false);
  }

  const inputClass = "h-[35px] border border-input bg-muted rounded-[calc(var(--radius)-2px)] px-3 font-mono text-[13px]";

  if (showReset) {
    return (
      <div className="space-y-4">
        {resetSent ? (
          <>
            <p className="text-sm text-muted-foreground">
              Jos sähköpostiosoitteella on tili, salasanan palautuslinkki on lähetetty.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setShowReset(false); setResetSent(false); setResetEmail(""); }}
            >
              Takaisin kirjautumiseen
            </Button>
          </>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anna sähköpostiosoitteesi. Lähetämme sinulle linkin salasanan vaihtamiseen.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Sähköposti</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <Button type="submit" className="w-full" disabled={resetLoading}>
              {resetLoading ? "Lähetetään..." : "Lähetä palautuslinkki"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowReset(false)}
            >
              Peruuta
            </button>
          </form>
        )}
      </div>
    );
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Syötä kaksivaiheinen koodi todentajasovelluksestasi tai yksi varakoodeistasi.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="totp">Koodi</Label>
          <Input
            id="totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={11}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            autoFocus
            required
            className={inputClass}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full mt-1.5" disabled={loading}>
          {loading ? "Tarkistetaan..." : "Vahvista"}
        </Button>
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground"
          onClick={() => { setStep("password"); setTotpCode(""); setError(""); }}
        >
          Takaisin
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Sähköposti</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Salasana</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full mt-1.5" disabled={loading}>
        {loading ? "Kirjaudutaan..." : "Kirjaudu sisään"}
      </Button>
      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground"
        onClick={() => setShowReset(true)}
      >
        Unohditko salasanan?
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full" style={{ maxWidth: 320 }}>
        {/* Logo block */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-2.5">
            <PikkukirjaLogo size={42} />
          </div>
          <p className="text-[19px] font-bold tracking-tight mt-2.5">Pikkukirja</p>
          <p className="text-[12.5px] text-muted-foreground">
            Kirjanpito-ohjelma pienille yhdistyksille
          </p>
        </div>

        <Card>
          <CardContent className="p-[20px_22px]">
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
