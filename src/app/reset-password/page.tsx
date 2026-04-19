"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8 || !/[\d\W]/.test(password)) {
      setError("Salasanan on oltava vähintään 8 merkkiä ja sisällettävä vähintään yksi numero tai erikoismerkki.");
      return;
    }
    if (password !== confirm) {
      setError("Salasanat eivät täsmää.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } else {
      const err = await res.json();
      setError(err.error ?? "Salasanan vaihto epäonnistui.");
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Virheellinen tai puuttuva linkki.</p>
        <Link href="/login">
          <Button variant="outline" className="w-full">Takaisin kirjautumiseen</Button>
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-green-600 font-medium">Salasana vaihdettu onnistuneesti.</p>
        <p className="text-sm text-muted-foreground">Sinut ohjataan kirjautumissivulle...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">Uusi salasana</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Toista salasana</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Vaihdetaan..." : "Vaihda salasana"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Vaihda salasana</CardTitle>
          <CardDescription>Anna uusi salasana tilillesi</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <ResetForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
