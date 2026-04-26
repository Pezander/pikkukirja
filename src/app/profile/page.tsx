"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, KeyRound, ShieldCheck, ShieldOff, History, Download, LogOut } from "lucide-react";
import Link from "next/link";

// ─── Password change ──────────────────────────────────────────────────────────

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword.length < 8 || !/[\d\W]/.test(newPassword)) {
      setError("Salasanan on oltava vähintään 8 merkkiä ja sisällettävä vähintään yksi numero tai erikoismerkki.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Uudet salasanat eivät täsmää.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } else {
      const err = await res.json();
      setError(err.error ?? "Salasanan vaihto epäonnistui.");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <CardTitle>Vaihda salasana</CardTitle>
        </div>
        <CardDescription>Salasanan on oltava vähintään 8 merkkiä ja sisällettävä vähintään yksi numero tai erikoismerkki.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Nykyinen salasana</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">Uusi salasana</Label>
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Vahvista uusi salasana</Label>
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
          {success && <p className="text-sm text-green-600">Salasana vaihdettu onnistuneesti.</p>}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Vaihdetaan..." : "Vaihda salasana"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── 2FA management ───────────────────────────────────────────────────────────

type TwoFAView = "status" | "setup" | "backup-codes" | "disable";

function TwoFACard() {
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [view, setView] = useState<TwoFAView>("status");

  // Setup state
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable state
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  // Regenerate backup codes state
  const [regenCode, setRegenCode] = useState("");
  const [regenError, setRegenError] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/2fa/status").then((r) => r.json()).then((d) => setTotpEnabled(d.totpEnabled));
  }, []);

  async function startSetup() {
    setSetupError("");
    setSetupLoading(true);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setSetupError(data.error); setSetupLoading(false); return; }
    setQrDataUrl(data.qrDataUrl);
    setSecret(data.secret);
    setView("setup");
    setSetupLoading(false);
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupError("");
    setSetupLoading(true);
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totpCode: setupCode }),
    });
    const data = await res.json();
    if (!res.ok) { setSetupError(data.error); setSetupLoading(false); return; }
    setBackupCodes(data.backupCodes);
    setTotpEnabled(true);
    setView("backup-codes");
    setSetupLoading(false);
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableError("");
    setDisableLoading(true);
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePassword }),
    });
    const data = await res.json();
    if (!res.ok) { setDisableError(data.error); setDisableLoading(false); return; }
    setTotpEnabled(false);
    setDisablePassword("");
    setView("status");
    setDisableLoading(false);
  }

  async function handleRegen(e: React.FormEvent) {
    e.preventDefault();
    setRegenError("");
    setRegenLoading(true);
    const res = await fetch("/api/auth/2fa/backup-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totpCode: regenCode }),
    });
    const data = await res.json();
    if (!res.ok) { setRegenError(data.error); setRegenLoading(false); return; }
    setBackupCodes(data.backupCodes);
    setRegenCode("");
    setView("backup-codes");
    setRegenLoading(false);
  }

  if (totpEnabled === null) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Kaksivaiheinen tunnistautuminen</CardTitle>
        </div>
        <CardDescription>
          {totpEnabled
            ? "2FA on käytössä. Kirjautuminen vaatii koodin todentajasovelluksesta."
            : "Suojaa tilisi vaatimalla koodin jokaisella kirjautumisella."}
        </CardDescription>
      </CardHeader>
      <CardContent>

        {/* ── Show backup codes (after enable or regen) ── */}
        {view === "backup-codes" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-amber-600">
              Tallenna varakoodit turvalliseen paikkaan. Ne näytetään vain kerran.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((c) => (
                <code key={c} className="text-sm bg-muted px-2 py-1 rounded text-center font-mono">{c}</code>
              ))}
            </div>
            <Button className="w-full" onClick={() => { setBackupCodes([]); setView("status"); }}>
              Olen tallentanut varakoodit
            </Button>
          </div>
        )}

        {/* ── Status view ── */}
        {view === "status" && totpEnabled && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <ShieldCheck className="h-4 w-4" />
              <span>2FA on aktiivinen</span>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => { setRegenCode(""); setRegenError(""); setView("regen" as TwoFAView); }}>
                Luo uudet varakoodit
              </Button>
              <Button variant="outline" onClick={() => { setDisablePassword(""); setDisableError(""); setView("disable"); }}>
                <ShieldOff className="mr-2 h-4 w-4" />
                Poista 2FA käytöstä
              </Button>
            </div>
          </div>
        )}

        {view === "status" && !totpEnabled && (
          <div className="space-y-3">
            {setupError && <p className="text-sm text-destructive">{setupError}</p>}
            <Button className="w-full" onClick={startSetup} disabled={setupLoading}>
              {setupLoading ? "Ladataan..." : "Ota 2FA käyttöön"}
            </Button>
          </div>
        )}

        {/* ── QR setup ── */}
        {view === "setup" && (
          <form onSubmit={confirmSetup} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Skannaa QR-koodi todentajasovelluksella (esim. Google Authenticator tai Authy).
            </p>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR-koodi" className="mx-auto rounded border" width={200} height={200} />
            )}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Syötä koodi manuaalisesti</summary>
              <code className="block mt-1 break-all bg-muted px-2 py-1 rounded font-mono">{secret}</code>
            </details>
            <div className="space-y-1.5">
              <Label htmlFor="setup-code">Vahvistuskoodi sovelluksesta</Label>
              <Input
                id="setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                required
              />
            </div>
            {setupError && <p className="text-sm text-destructive">{setupError}</p>}
            <Button type="submit" className="w-full" disabled={setupLoading}>
              {setupLoading ? "Vahvistetaan..." : "Ota käyttöön"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => { setView("status"); setSetupCode(""); setSetupError(""); }}
            >
              Peruuta
            </button>
          </form>
        )}

        {/* ── Regenerate backup codes ── */}
        {(view as string) === "regen" && (
          <form onSubmit={handleRegen} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vanhat varakoodit mitätöidään. Vahvista toiminto todentajasovelluksen koodilla.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="regen-code">Koodi todentajasovelluksesta</Label>
              <Input
                id="regen-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value)}
                required
              />
            </div>
            {regenError && <p className="text-sm text-destructive">{regenError}</p>}
            <Button type="submit" className="w-full" disabled={regenLoading}>
              {regenLoading ? "Luodaan..." : "Luo uudet varakoodit"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setView("status")}
            >
              Peruuta
            </button>
          </form>
        )}

        {/* ── Disable ── */}
        {view === "disable" && (
          <form onSubmit={handleDisable} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vahvista salasanallasi, että haluat poistaa 2FA:n käytöstä.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="disable-pw">Salasana</Label>
              <Input
                id="disable-pw"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
              />
            </div>
            {disableError && <p className="text-sm text-destructive">{disableError}</p>}
            <Button type="submit" variant="destructive" className="w-full" disabled={disableLoading}>
              {disableLoading ? "Poistetaan..." : "Poista 2FA käytöstä"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setView("status")}
            >
              Peruuta
            </button>
          </form>
        )}

      </CardContent>
    </Card>
  );
}

// ─── Login history & session management ──────────────────────────────────────

interface LoginEvent {
  id: string;
  provider: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

function LoginHistoryCard() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [invalidating, setInvalidating] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/auth/login-history")
      .then((r) => r.json())
      .then((d) => { setEvents(d); setLoading(false); });
  }, []);

  async function handleInvalidate() {
    if (!confirm("Tämä kirjaa sinut ulos kaikilta laitteilta. Haluatko jatkaa?")) return;
    setInvalidating(true);
    await fetch("/api/auth/sessions", { method: "POST" });
    setDone(true);
    setInvalidating(false);
    // Give the user a moment to read the confirmation, then sign out locally too
    setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle>Kirjautumishistoria</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleInvalidate}
            disabled={invalidating || done}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {done ? "Kirjaudutaan ulos…" : "Kirjaudu ulos kaikilta laitteilta"}
          </Button>
        </div>
        <CardDescription>Viimeiset 50 kirjautumista tällä tilillä.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Ladataan…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ei kirjautumisia.</p>
        ) : (
          <div className="space-y-1">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs font-mono w-20">{ev.provider}</span>
                  <span className="text-muted-foreground text-xs truncate max-w-xs">{ev.userAgent || "—"}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(ev.timestamp).toLocaleString("fi-FI")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── GDPR export ──────────────────────────────────────────────────────────────

function GdprCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <CardTitle>Omat tiedot (GDPR)</CardTitle>
        </div>
        <CardDescription>
          Lataa kaikki sinusta tallennettu tieto JSON-muodossa rekisteröidyn oikeuksien mukaisesti.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={() => window.open("/api/profile/gdpr-export", "_blank")}
        >
          <Download className="mr-2 h-4 w-4" />
          Lataa tietojeni kopio
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Etusivu
        </Link>

        <div className="space-y-6">
          <PasswordCard />
          {isAdmin && <TwoFACard />}
          <LoginHistoryCard />
          <GdprCard />
        </div>
      </div>
    </div>
  );
}
