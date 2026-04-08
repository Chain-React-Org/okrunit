// ---------------------------------------------------------------------------
// OKrunit -- SMS Notification Channel (Twilio)
// ---------------------------------------------------------------------------
//
// Sends SMS notifications via Twilio's REST API. No SDK dependency needed;
// uses plain fetch with HTTP Basic auth.
//
// Required env vars:
//   TWILIO_ACCOUNT_SID  -- Twilio Account SID
//   TWILIO_AUTH_TOKEN   -- Twilio Auth Token
//   TWILIO_FROM_NUMBER  -- Twilio phone number to send from (e.g. +1234567890)
// ---------------------------------------------------------------------------

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

export interface SmsParams {
  to: string;
  body: string;
}

/**
 * Returns true if all required Twilio environment variables are set.
 */
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}

/**
 * Send an SMS message via the Twilio REST API.
 *
 * Returns the Twilio message SID on success, or null if Twilio is not
 * configured. Throws on API errors so the caller can log failures.
 */
export async function sendSms(
  params: SmsParams,
): Promise<{ sid: string } | null> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn("[SMS] Twilio not configured, skipping SMS");
    return null;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
  ).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: params.to,
      From: TWILIO_FROM_NUMBER,
      Body: params.body,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return { sid: data.sid };
}
