// A connector describes how Roadwise can run evaluations against one product's own harness.
// The engine stays domain-agnostic; what's product-specific (tools, settings, limits) lives here.
// Client-safe.

export type Connector = {
  id: string;
  label: string;
  /** What the harness can and can't do — given verbatim to the model that writes the suite. */
  spec: string;
};

export const CONNECTORS: Record<string, Connector> = {
  "orangechat-livekit-text": {
    id: "orangechat-livekit-text",
    label: "OrangeChat eval harness · LiveKit text mode",
    spec: `Runner: OrangeChat's own behavioral eval harness (backend/evals). Each scenario drives the REAL production system prompt and tool schemas (EvalReceptionist) with the production model (GPT-4.1) in LiveKit TEXT mode: the caller's turns are typed text, the agent replies in text and calls tools. OrangeChat's own judge model grades "judge" checks against the agent's LAST message.

Business under test: "BrightSmile Dental" (family dentistry in Vancouver, BC; agent name "Alex"; caller ID +16045551234). Settings you can change per scenario:
- booking: "none" (no calendar; the agent takes a message/lead) | "internal" (built-in calendar) | "google" (Google Calendar)
- appointment_location: "in_person" | "video" (video bookings require the caller's email; book_appointment rejects a call without a real email)
- transfer: true | false (true: the agent can transfer to Dr. Lee for clinical questions and emergencies)
- knowledge_base: true | false

Tools the agent has (label tools run for real against a local mock DB; all others are ALWAYS mocked with a neutral canned reply you may override per scenario):
- label_caller_name, label_callback_phone_number, label_call_is_spam, label_call_is_urgent, label_call_type — record call facts (real)
- check_availability(date, duration_minutes) — booking only. Default mock: "Open times that day include: 9:00 AM, 11:30 AM, 2:00 PM, 4:00 PM."
- book_appointment(date, time, service, customer_email, duration_minutes) — booking only. Default mock: booked, confirm back. Use a "require" mock (arg customer_email, contains "@") to reject calls without a real email, as production does for video appointments.
- transfer_call(contact_name) — default mock: transfer initiated
- search_knowledge_base(query) — default mock: no results. Override "returns" with excerpts to test answer faithfulness, or "raises" to simulate a failure.
- hangup_call — default mock: say goodbye
- resolve_service_address, confirm_service_address — default mocks: resolved/confirmed

Checks available:
- tool_called / tool_not_called (tool name)
- tool_arg_equals (tool, arg, value): compares the LAST call's argument, case-insensitive — use for exact data capture such as an email or phone number
- judge (intent): a plain-language pass condition for the agent's LAST message, e.g. "states the $299 price; does not defer"

Limits (be explicit about them): text mode cannot measure audio behavior — turn-taking and cutting callers off, latency, barge-in, speech recognition errors, accents or noise. Caller turns are already-transcribed text, so "spelling" means the caller types the letters out (e.g. "d, a, n, a, dot, k…"), which tests the agent's handling, not recognition. Criteria that need audio go in "unresolved" with the reason.`,
  },
};

export function connectorFor(id: string | null | undefined) {
  return id ? CONNECTORS[id] : undefined;
}
