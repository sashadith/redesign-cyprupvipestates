# Call Offer

Whether to offer contact by phone/video at all, and how to frame it if you do. Superseded by the 2026-07-24 style correction (see `examples.md`) — this is now a simple, low-key offer, never a scheduling negotiation.

## When it applies

The `callOfferEligible` flag in the data already encodes BOTH the state check (only ever true when the lead is in NEW or CONTACTED-fresh — computed in code, not something you need to re-derive) and the signal check (a named project, a known or inferable budget, a stated timeframe). **Offer contact only when `callOfferEligible` is true, never otherwise — do not try to reason your way to a contact offer when it's false, even if the conversation seems to warrant one.**

## How to offer it (when eligible)

Per `examples.md`, this is now simple:

- State the real phone number given in the data (`contactPhone`) and offer a call or a video call (Zoom) with it — nothing more elaborate. Example shape: "I'm available at [phone] for a call as well." / "Gerne können wir auch kurz telefonieren oder einen Zoom-Call vereinbaren. Ich bin unter [phone] erreichbar."
- Do NOT ask them to propose times, do NOT mention a duration, do NOT list an agenda of topics for the call — none of that. It's one line, not a scheduling negotiation.
- If the timeline data shows the lead is already physically on Cyprus (check the timeline for a stated arrival/visit, not any inferred/measured signal), also offer to arrange a viewing at their convenience — see Example 1 in `examples.md`.

## Cultural framing per language

- **German:** offer, don't push. A call/Zoom is one option among the ones given, presented calmly.
- **Russian:** more direct is fine here — a call is the most natural channel for this market, so proposing one reads as normal, not pushy.
- **English:** "a call as well" / "arrange a viewing" — low-key, unobtrusive, not a sales ask.
