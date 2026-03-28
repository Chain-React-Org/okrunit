"use client";

import { useState } from "react";
import { Send, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to send message");
      }

      setSent(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-[var(--card)] py-12 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Check className="size-6 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Message sent</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll get back to you as soon as we can.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setSent(false)}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border/50 bg-[var(--card)] p-6 shadow-[var(--shadow-card)]"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="text-xs">
            Name
          </Label>
          <Input
            id="contact-name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={sending}
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-xs">
            Email
          </Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={sending}
            maxLength={200}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-subject" className="text-xs">
          Subject
        </Label>
        <Input
          id="contact-subject"
          placeholder="What can we help with?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          disabled={sending}
          maxLength={300}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-message" className="text-xs">
          Message
        </Label>
        <Textarea
          id="contact-message"
          placeholder="Tell us more about your question or issue..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          disabled={sending}
          maxLength={5000}
          rows={5}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={
          sending ||
          !name.trim() ||
          !email.trim() ||
          !subject.trim() ||
          !message.trim()
        }
        className="gap-1.5"
      >
        <Send className="size-3.5" />
        {sending ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
