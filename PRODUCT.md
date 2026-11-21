# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Front-desk staff at ARMZTRONG GYM, General Luna Branch. They work the counter on a shared computer or tablet during shifts and serve members who are physically at the desk: walk-ins, renewals, payments, and gym visits. Staff sign in with an email/password account before any page is available. The schema also distinguishes `admin` and `staff` roles, but the primary user is the counter staff member, not the gym owner or the member.

## Product Purpose

An internal, staff-only operations system for one gym branch. It keeps member records, membership plans, subscription periods, payments, and gym attendance in one place so the front desk can answer "is this member active?", sell or renew a membership, record a payment, and check someone in or out without leaving the counter.

Success metrics have not been defined with the owner. The dashboard currently treats these as the operational picture: total member records, active subscriptions, people in the gym now, today's check-ins, revenue for the current month, and subscriptions ending within seven days.

## Positioning

A purpose-built desk tool for a single neighborhood gym, not a multi-tenant gym SaaS and not a member-facing app. Its defining mechanism is that membership status has one source of truth: subscriptions store the paid period, the `v_active_subscriptions` view derives who is currently covered, and the rest of the app asks that view instead of re-implementing the rule. Pricing and workflows reflect this branch's walk-in, student/regular, peso-cash reality.

## Operating Context

- The gym is ARMZTRONG GYM, General Luna Branch, Lower General Luna Road (below Mang Inasal), Philippines.
- The desk handles walk-ins, per-session visits, monthly memberships, student and regular rates, and long-term promos. Prices are in Philippine pesos (₱).
- Staff work on a shared device, sign in with email/password, and stay signed in for a one-hour session.
- Payments are recorded at the desk. The data model supports cash, card, transfer, and online methods; cash is the default.
- The branch's promo prices, logo, gym photos, and map/direction images live in `information.json` and `src/assets/`.
- The app has a JSON API under `/api/*` and server-rendered staff pages; the pages call the same services as the API.

## Capabilities and Constraints

- **Staff authentication only.** Credentials live in `auth_staff`, separate from members. Members have no password column and no login. Two roles exist: `admin` and `staff`; page access currently requires authentication, not a specific role.
- **Members.** Records include a generated membership number (`GYM-00001` format), name, email, phone, date of birth, gender, emergency contact, notes, and an active flag. Emails and membership numbers are unique.
- **Plans.** Each plan has a name, description, price, a duration value plus unit (day/week/month/year), and an optional visit cap (`NULL` = unlimited). Plans can be archived rather than deleted.
- **Subscriptions.** One row per membership period, with start and end dates. Status is `active`, `cancelled`, or `frozen`; there is deliberately no stored `expired` status — expiry is derived from `end_date`. Periods use a half-open interval: the end date is the first day not covered. Freezing records when it started and when it ends so the end date can be extended. Cancelled subscriptions require a cancellation time/reason. Billing history cannot be hard-deleted.
- **Payments.** Each payment belongs to a subscription and carries a unique human-readable reference number, decimal amount, method, status (`paid`, `pending`, `failed`, `refunded`), paid timestamp, and notes. Refunds are recorded through the refund flow; payments are never deleted.
- **Attendance.** One row per visit with check-in and optional check-out timestamps. Open visits represent people currently in the gym; check-out cannot precede check-in. Only members with a running subscription appear in the check-in directory.
- **Dashboard.** Shows total members, active subscriptions, in-gym count, today's check-ins, month-to-date revenue, and subscriptions expiring within seven days, plus recent check-ins.
- **Single branch.** The product is scoped to General Luna; there is no branch entity in the schema.
- **Existing stack.** Node.js 20+, Express 5, EJS templates, MariaDB 10.4 / MySQL 8, Tailwind CSS 4, TypeScript. The build produces `dist/`; views and assets remain under `src/`.

Open product decisions, not yet confirmed:

- No member self-service portal, online booking, class/trainer scheduling, or integrated online payment gateway.
- No public marketing site; `/login` is the public entry point.
- No multi-branch behavior; do not add branch switching or tenant isolation without an owner decision.
- No success metrics, retention targets, or reporting requirements beyond the current dashboard.
- The repository's `information.json` spells the gym "Armstrong Gym"; the owner confirmed "ARMZTRONG GYM" is the correct name.

## Brand Commitments

- Confirmed name: **ARMZTRONG GYM**, General Luna Branch. The app UI, page titles, sidebar, and footer already use this spelling.
- Existing logo: `src/assets/logo.jpeg`; favicon uses the same file.
- Existing real photography: gym interior (`pic1.jpg`–`pic3.jpg`), promos (`promo_2.jpg`, `promo_2026.jpg`), and directions (`map_and_directions_to_gym.jpg`, `map_and_directions_to_gym_2.jpg`).
- The login page carries the existing slogan "TRAIN HARD. STAY CONSISTENT." and the location line "Lower General Luna Road (below Mang Inasal)".
- The observed staff-facing voice is direct and operational ("See you next shift!", "Add members before using the front desk."). It has not been formally recorded as a brand standard.

## Evidence on Hand

- `information.json` — promo copy and current public prices: ₱50 per session; ₱450/month students and ₱550/month regular members; long-term student/regular rates for 2, 3, 6, and 12 months, with the promo stated as available until December 31, 2026 and applying to the Standard Package only.
- `src/assets/` — real logo, interior, promo, and map images listed above.
- `database/schema.sql` — the authoritative record of business rules: membership number generation, half-open subscription periods, derived active status, payment references, and attendance constraints.
- `src/views/` — the incumbent staff UI and existing copy.

Absences future work must not fill by invention: there are no real member records, revenue figures, testimonials, press mentions, trainer biographies, class schedules, or certifications in the repository. Do not fabricate them.

## Product Principles

1. **The counter is the moment of truth.** Every flow should be fast and unambiguous for a member standing at the desk: find the person, confirm status, take the payment, check them in.
2. **Derive, don't duplicate.** Membership validity comes from subscription dates and the active-subscriptions view, never from a hand-maintained flag that can drift.
3. **History is business data.** Cancel, freeze, refund, or archive — never hard-delete a member's billing or visit record.
4. **Money and attendance stay auditable.** Unique payment references, recorded timestamps, explicit statuses, and an append-only visit trail.
5. **Stay single-branch and staff-only until the owner says otherwise.** Resist multi-tenant, member-portal, and marketing-site complexity that the product has not committed to.
