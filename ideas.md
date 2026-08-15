# Paid Funnel Template — Design Direction

## Three candidate approaches

### Theme Name: Precision Conversion Ledger

**Very Brief Intro:** A calm, high-trust interface influenced by Swiss information design and modern service quoting tools. It treats every question as a clear decision, removes visual leakage, and makes progress feel concrete.

**Probability:** 0.04

### Theme Name: Warm Retail Concierge

**Very Brief Intro:** A softer residential-service direction using warm mineral tones, friendly editorial type, and tactile controls. It feels personal and reassuring without resembling a generic lifestyle landing page.

**Probability:** 0.07

### Theme Name: Industrial Signal System

**Very Brief Intro:** A utilitarian direction inspired by equipment labels and wayfinding systems, with compressed typography, high-contrast signals, and visible system status. It feels fast, direct, and operational.

**Probability:** 0.02

## Chosen approach: Precision Conversion Ledger

### Design Movement

The visual system draws from **International Typographic Style**, contemporary fintech onboarding, and quiet editorial product design. Its job is not to entertain; it is to make the next decision unmistakable and trustworthy on a phone.

### Core Principles

1. **One decision owns the screen.** Every route has one primary question and one unambiguous continuation path.
2. **Visible system confidence.** Progress, validation, saved-state feedback, and errors are explicit rather than decorative.
3. **Strong hierarchy without clutter.** Large question type, compact supporting copy, and spacious controls guide the eye in one direction.
4. **Conversion-safe restraint.** There is no navigation, no ornamental imagery, no competing offer, and no animation that delays action.

### Color Philosophy

The base uses warm off-white rather than sterile pure white, with ink-like navy for durable legibility. A saturated mineral blue is the action color because it reads as dependable and works across home-service categories. Success and validation states use restrained green; errors use a dark vermilion. Client branding may override the action color through config, but contrast requirements remain enforced.

### Layout Paradigm

The mobile layout is a **vertical decision rail** rather than a centered marketing page. A slim status band sits at the top, the question block starts high in the viewport, answer controls stack in the natural thumb zone, and the primary action settles near the lower portion of the screen without becoming a fixed overlay. Desktop preserves the same narrow decision rail and adds breathing room rather than extra content.

### Signature Elements

1. A precise segmented progress rule with a numeric step label.
2. Choice controls with a slim leading index marker and a decisive selected state.
3. Small uppercase system labels for advertising disclosure, saved-state feedback, and qualification context.

### Interaction Philosophy

Controls respond immediately and honestly. Single-choice answers save and advance with one tap; multi-choice and text steps expose a single continuation button. Buttons compress slightly on press, focus indicators remain obvious, and server validation errors stay adjacent to the field that needs correction.

### Animation

Route transitions use only a short opacity and 8-pixel vertical shift, capped at 180 ms with a strong ease-out curve. Choice selection confirms in roughly 120 ms. No looping motion, parallax, progress-bar tweening, or entrance delay is allowed. All nonessential motion is disabled under `prefers-reduced-motion`.

### Typography System

The primary stack is **IBM Plex Sans** with system fallbacks for questions, controls, and body text. **IBM Plex Mono** is reserved for step counters, disclosure labels, and compact system feedback. Questions use a 700 weight with tight leading; supporting text stays at 16–18 px; form inputs never fall below 16 px.

### Brand Essence

**Positioning:** A configurable paid-traffic qualification funnel for service businesses that captures useful lead data before a visitor disappears and reports trustworthy conversion signals back to Meta.

**Personality:** Precise, reassuring, disciplined.

### Brand Voice

Headlines state the offer without second-person promises. CTAs describe the next action in plain language. Microcopy is short, factual, and operational.

Example headline: “Local hot tub availability, matched by ZIP code.”

Example CTA: “Check My ZIP Code.”

### Wordmark & Logo

The template supports a client-supplied logo through one config field. The example fallback mark is a compact geometric monogram made from two offset water-line strokes inside a square—not the client name typed in a default font. The mark appears once, at a clearly visible size, and never competes with the question.

### Signature Brand Color

**Mineral Blue — `#155EEF`**. This is the unmistakable action signal used for primary buttons, selected answers, focus rings, and completed progress segments.

## Implementation constraints

The funnel uses no decorative or product imagery. The only permitted image is the config-provided client logo. Every paid route must retain the advertising disclosure, `noindex`, one-action layout, and full keyboard accessibility. Design polish must never add an outbound navigation choice or increase JavaScript on the critical rendering path.

## Style Decisions

The shipped surface system uses **flat ledger-like panels, crisp rules, and structural contrast**. Decorative shadows, glows, and soft SaaS card treatments are removed; tactile feedback is reserved for focus and press states.

The leading **A/B/C or numeric marker is a signature wayfinding element** integrated into each choice row. Selected states use Mineral Blue with a firm structural edge rather than a floating glow.

**Exception states** use restrained dark vermilion for the status label, rule, and qualification ledger. Mineral Blue remains reserved for the recovery action, active progress, focus, selection, and completion cues.
