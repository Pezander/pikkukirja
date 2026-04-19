"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ORG_TYPE_OPTIONS, getOrgLabels, type OrgType } from "@/lib/orgLabels";

export default function NewAssociationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("tiekunta");

  const labels = getOrgLabels(orgType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = e.currentTarget;
    const data = {
      type: orgType,
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      address: (form.elements.namedItem("address") as HTMLInputElement).value,
      postalCode: (form.elements.namedItem("postalCode") as HTMLInputElement).value,
      city: (form.elements.namedItem("city") as HTMLInputElement).value,
      iban: (form.elements.namedItem("iban") as HTMLInputElement).value,
      bic: (form.elements.namedItem("bic") as HTMLInputElement).value,
      bankName: (form.elements.namedItem("bankName") as HTMLInputElement).value,
      contactName: (form.elements.namedItem("contactName") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
    };

    const res = await fetch("/api/associations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const assoc = await res.json();
      router.push(`/associations/${assoc.id}`);
    } else {
      const err = await res.json();
      setError(err.error ?? "Tallennus epäonnistui");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Takaisin
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Uusi organisaatio</CardTitle>
            <CardDescription>
              Tilikartta täytetään automaattisesti valitun organisaatiotyypin mukaisilla tileillä.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Organization type selector */}
              <div className="space-y-2">
                <Label>Organisaatiotyyppi *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ORG_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOrgType(opt.value)}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        orgType === opt.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <fieldset className="space-y-4">
                <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Perustiedot
                </legend>
                <div className="space-y-2">
                  <Label htmlFor="name">{labels.orgNameLabel} *</Label>
                  <Input id="name" name="name" required placeholder={`Esim. ${orgType === "tiekunta" ? "Oravalahdentien tiekunta" : orgType === "metsastysseura" ? "Koivumetsän metsästysseura" : "Koivukujan taloyhtiö"}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Osoite</Label>
                    <Input id="address" name="address" placeholder="Katuosoite" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Kaupunki</Label>
                    <Input id="city" name="city" placeholder="Kaupunki" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postinumero</Label>
                  <Input id="postalCode" name="postalCode" placeholder="00000" className="max-w-32" />
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Pankkitiedot
                </legend>
                <div className="space-y-2">
                  <Label htmlFor="bankName">Pankki</Label>
                  <Input id="bankName" name="bankName" placeholder="Esim. Nordea" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN-tilinumero</Label>
                  <Input id="iban" name="iban" placeholder="FI00 0000 0000 0000 00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bic">BIC / SWIFT</Label>
                  <Input id="bic" name="bic" placeholder="Esim. NDEAFIHH" />
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Yhteyshenkilö
                </legend>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nimi</Label>
                  <Input id="contactName" name="contactName" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Puhelin</Label>
                    <Input id="phone" name="phone" type="tel" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Sähköposti</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                </div>
              </fieldset>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Tallennetaan..." : `Luo ${labels.orgTypeName.toLowerCase()}`}
                </Button>
                <Link href="/">
                  <Button type="button" variant="outline">Peruuta</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
