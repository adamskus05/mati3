"use client";

import { useState } from "react";
import Link from "next/link";
import { submitSignupRequest } from "@/lib/actions/signup-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RequestAccessForm() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await submitSignupRequest({
      email,
      displayName,
      message: message || undefined,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Tack! Din begäran är mottagen. Du får e-post med inbjudan när en administratör
        godkänt den. Har du redan inbjudan?{" "}
        <Link href="/login" className="text-primary underline">
          Logga in
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Namn</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Meddelande (valfritt)</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="T.ex. vem du är eller vilket hushåll du vill gå med i"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Skickar…" : "Begär åtkomst"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Har du konto?{" "}
        <Link href="/login" className="font-medium text-primary underline">
          Logga in
        </Link>
      </p>
    </form>
  );
}
