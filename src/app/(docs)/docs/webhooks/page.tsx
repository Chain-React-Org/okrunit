import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Webhooks & Callbacks",
  description:
    "Learn how OKRunit delivers approval decisions via webhooks — HMAC verification, payload format, retry logic, and testing.",
};

export default function WebhooksPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Webhooks & Callbacks
      </h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        When an approver makes a decision, OKRunit delivers the result to your
        callback URL via an HTTP POST request. This lets your automation
        continue or abort without polling.
      </p>

      {/* How it works */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        How callbacks work
      </h2>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            1
          </span>
          <span>
            You provide a{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">callback_url</code> when
            creating an approval request.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            2
          </span>
          <span>
            When a decision is made (approved, rejected, or cancelled), OKRunit
            POSTs the decision payload to your URL.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            3
          </span>
          <span>
            Your endpoint should respond with a 2xx status code within 10
            seconds to acknowledge receipt.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            4
          </span>
          <span>
            If delivery fails, OKRunit retries up to 3 times with exponential
            backoff.
          </span>
        </li>
      </ol>

      {/* Callback payload */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Callback payload
      </h2>
      <p className="mt-4 text-zinc-700">
        The callback is an HTTP POST with a JSON body containing the full
        approval request state at the time of the decision:
      </p>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`POST https://your-app.com/webhooks/okrunit
Content-Type: application/json
X-OKRunit-Signature: sha256=a1b2c3d4e5f6...

{
  "event": "approval.decided",
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "approved",
  "title": "Delete user account #4821",
  "priority": "high",
  "action_type": "user.delete",
  "decided_at": "2026-03-24T11:30:00.000Z",
  "decided_by": {
    "id": "user-uuid",
    "email": "approver@example.com",
    "name": "Jane Smith"
  },
  "comment": "Verified with the user. Proceeding.",
  "metadata": {
    "user_id": "4821",
    "ticket_id": "SUP-1234"
  }
}`}</code>
      </pre>

      <p className="mt-4 text-zinc-700">
        If you provided{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">callback_headers</code>{" "}
        when creating the request, those headers are included in the callback
        POST alongside the signature header.
      </p>

      {/* HMAC Verification */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        HMAC-SHA256 signature verification
      </h2>
      <p className="mt-4 text-zinc-700">
        Every callback includes an{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">X-OKRunit-Signature</code>{" "}
        header. You should verify this signature to ensure the request came from
        OKRunit and was not tampered with.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        How it works
      </h3>
      <ol className="mt-3 space-y-2 text-sm text-zinc-700">
        <li>
          <strong>1.</strong> OKRunit computes an HMAC-SHA256 of the raw request
          body using your connection&apos;s webhook secret as the key.
        </li>
        <li>
          <strong>2.</strong> The hex-encoded digest is sent in the{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800">X-OKRunit-Signature</code>{" "}
          header with a <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800">sha256=</code> prefix.
        </li>
        <li>
          <strong>3.</strong> On your end, compute the same HMAC and compare
          using a constant-time comparison function.
        </li>
      </ol>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Verification examples
      </h3>

      <p className="mt-3 text-sm font-medium text-zinc-600">Node.js</p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`import { createHmac, timingSafeEqual } from "crypto";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

// In your webhook handler:
const rawBody = await request.text();
const signature = request.headers.get("X-OKRunit-Signature") ?? "";
const secret = process.env.OKRUNIT_WEBHOOK_SECRET!;

if (!verifySignature(rawBody, signature, secret)) {
  return new Response("Invalid signature", { status: 401 });
}

const payload = JSON.parse(rawBody);
// Process the decision...`}</code>
      </pre>

      <p className="mt-6 text-sm font-medium text-zinc-600">Python</p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`import hmac
import hashlib

def verify_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# In your webhook handler:
raw_body = request.body
signature = request.headers.get("X-OKRunit-Signature", "")
secret = os.environ["OKRUNIT_WEBHOOK_SECRET"]

if not verify_signature(raw_body, signature, secret):
    return Response("Invalid signature", status=401)

payload = json.loads(raw_body)
# Process the decision...`}</code>
      </pre>

      {/* Retry Logic */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Retry logic
      </h2>
      <p className="mt-4 text-zinc-700">
        If your endpoint does not respond with a 2xx status code within the
        timeout window, OKRunit retries the delivery with exponential backoff:
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left">
              <th className="pb-2 pr-6 font-semibold text-zinc-900">Attempt</th>
              <th className="pb-2 pr-6 font-semibold text-zinc-900">Delay</th>
              <th className="pb-2 font-semibold text-zinc-900">Notes</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-6">1st (initial)</td>
              <td className="py-2 pr-6">Immediate</td>
              <td className="py-2">Sent as soon as the decision is made</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-6">2nd (retry 1)</td>
              <td className="py-2 pr-6">~1 second</td>
              <td className="py-2">After first failure</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-6">3rd (retry 2)</td>
              <td className="py-2 pr-6">~2 seconds</td>
              <td className="py-2">After second failure</td>
            </tr>
            <tr>
              <td className="py-2 pr-6">4th (retry 3)</td>
              <td className="py-2 pr-6">~4 seconds</td>
              <td className="py-2">Final attempt</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-zinc-700">
        After all retry attempts are exhausted, the delivery is marked as failed
        in the webhook delivery log. You can view delivery status and retry
        manually from the dashboard or via the{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          GET /api/v1/approvals/:id/webhooks
        </code>{" "}
        endpoint.
      </p>

      {/* Timeout */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Timeout
      </h2>
      <p className="mt-4 text-zinc-700">
        Each delivery attempt has a <strong>10 second</strong> timeout. If your
        server does not respond within this window, the attempt is considered
        failed and the next retry is scheduled. Design your webhook handler to
        acknowledge quickly and process the payload asynchronously if needed.
      </p>

      {/* Delivery logs */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Delivery logs
      </h2>
      <p className="mt-4 text-zinc-700">
        Every callback delivery attempt is logged with the HTTP status code,
        response body (truncated), and timing information. Query the logs via
        the API:
      </p>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`GET /api/v1/webhooks?request_id=a1b2c3d4-...&limit=10

// Response
{
  "data": [
    {
      "id": "log-uuid",
      "request_id": "a1b2c3d4-...",
      "url": "https://your-app.com/webhooks/okrunit",
      "status_code": 200,
      "attempt": 1,
      "success": true,
      "duration_ms": 142,
      "created_at": "2026-03-24T11:30:01.000Z"
    }
  ]
}`}</code>
      </pre>

      {/* Testing */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Testing webhooks
      </h2>
      <p className="mt-4 text-zinc-700">
        During development, you can test webhook delivery in several ways:
      </p>
      <ul className="mt-4 space-y-3 text-zinc-700">
        <li>
          <strong className="text-zinc-900">Local tunnel:</strong> Use{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">ngrok</code>,{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">localtunnel</code>, or{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">cloudflared</code> to
          expose your local server and use the tunnel URL as your callback.
        </li>
        <li>
          <strong className="text-zinc-900">Request catchers:</strong> Services
          like <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">webhook.site</code> or{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">requestbin.com</code>{" "}
          let you inspect the raw callback payload without writing any code.
        </li>
        <li>
          <strong className="text-zinc-900">Test endpoint:</strong> The OKRunit
          API includes a test webhook endpoint at{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
            POST /api/v1/test-webhook
          </code>{" "}
          that sends a sample payload to any URL you specify.
        </li>
      </ul>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`curl -X POST https://okrunit.com/api/v1/test-webhook \\
  -H "Authorization: Bearer gk_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/okrunit"
  }'`}</code>
      </pre>

      {/* Best practices */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Best practices
      </h2>
      <ul className="mt-4 space-y-3 text-zinc-700">
        <li>
          <strong className="text-zinc-900">Always verify signatures.</strong>{" "}
          Do not process webhook payloads without validating the HMAC signature
          first.
        </li>
        <li>
          <strong className="text-zinc-900">Respond quickly.</strong> Return a
          200 immediately and process the payload asynchronously. Do not block
          the response on downstream work.
        </li>
        <li>
          <strong className="text-zinc-900">Handle duplicates.</strong> In rare
          cases (e.g. network issues), you may receive the same callback more
          than once. Use the{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">request_id</code> to
          deduplicate.
        </li>
        <li>
          <strong className="text-zinc-900">Use HTTPS.</strong> Callback URLs
          must use HTTPS in production to protect the payload in transit.
        </li>
      </ul>
    </article>
  );
}
