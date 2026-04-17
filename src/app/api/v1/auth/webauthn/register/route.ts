// ---------------------------------------------------------------------------
// OKrunit -- WebAuthn Registration (passkeys / hardware keys)
// ---------------------------------------------------------------------------
// POST: Generate registration options
// PUT: Verify registration response and store credential
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const RP_NAME = "OKrunit";
const RP_ID = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
  : "localhost";
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// In-memory challenge store (short-lived, per-request)
const challengeStore = new Map<string, string>();

// POST: Generate registration options
export async function POST() {
  try {
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get existing credentials for this user
    const { data: existing } = await admin
      .from("webauthn_credentials")
      .select("credential_id")
      .eq("user_id", user.id);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email ?? user.id,
      userDisplayName: user.user_metadata?.full_name ?? user.email ?? "User",
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // Store challenge for verification
    challengeStore.set(user.id, options.challenge);
    // Auto-cleanup after 5 minutes
    setTimeout(() => challengeStore.delete(user.id), 5 * 60 * 1000);

    return NextResponse.json(options);
  } catch (error) {
    logger.error("[WebAuthn] Registration options error:", error);
    return NextResponse.json({ error: "Failed to generate options" }, { status: 500 });
  }
}

// PUT: Verify registration response
export async function PUT(request: Request) {
  try {
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { response, name } = body as {
      response: RegistrationResponseJSON;
      name?: string;
    };

    const expectedChallenge = challengeStore.get(user.id);
    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Registration session expired. Please try again." },
        { status: 400 },
      );
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Store the credential
    const admin = createAdminClient();
    const { error } = await admin.from("webauthn_credentials").insert({
      user_id: user.id,
      credential_id: Buffer.from(credential.id).toString("base64url"),
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: Number(credential.counter),
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: response.response.transports ?? [],
      name: name ?? "Security Key",
    });

    // Clean up challenge
    challengeStore.delete(user.id);

    if (error) {
      logger.error("[WebAuthn] Save credential error:", error);
      return NextResponse.json({ error: "Failed to save credential" }, { status: 500 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    logger.error("[WebAuthn] Registration verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
