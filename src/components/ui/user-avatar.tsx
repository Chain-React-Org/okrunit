"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  fullName: string | null;
  email: string;
  avatarUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.charAt(0).toUpperCase();
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function UserAvatar({
  fullName,
  email,
  avatarUrl,
  size = "default",
  className,
}: UserAvatarProps) {
  const [gravatarUrl, setGravatarUrl] = useState<string | null>(null);

  // Always compute Gravatar URL as fallback when no custom avatar is set
  useEffect(() => {
    if (avatarUrl) {
      setGravatarUrl(null);
      return;
    }

    let cancelled = false;
    const px = size === "lg" ? 160 : size === "sm" ? 48 : 80;

    sha256Hex(email.trim().toLowerCase()).then((hash) => {
      if (!cancelled) {
        setGravatarUrl(
          `https://www.gravatar.com/avatar/${hash}?s=${px}&d=404`,
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [email, avatarUrl, size]);

  // Priority: custom avatar > gravatar (automatic) > initials
  const imageSrc = avatarUrl ?? gravatarUrl;

  return (
    <Avatar size={size} className={className}>
      {imageSrc && <AvatarImage src={imageSrc} alt={fullName ?? email} />}
      <AvatarFallback className="bg-primary text-white text-xs font-bold">
        {getInitials(fullName, email)}
      </AvatarFallback>
    </Avatar>
  );
}
