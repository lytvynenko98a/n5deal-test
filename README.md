# N5Deal marketplace prototype

A working marketplace for regulated fintech assets, built for the N5Deal technical assignment.
Three roles share one database: sellers publish assets, buyers record an acquisition mandate and
browse, and platform managers moderate both sides.

Everything runs locally against SQLite. State survives a refresh, a restart, and a rebuild of the
dev server.

---

## Run it

```bash
npm install
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000 and sign in from `/login`. The seed writes `data/n5deal.db`, so the
second command creates the database and fills it. `npm run db:reset` deletes the file and rebuilds
it from scratch.

npm 11.16 blocks package install scripts by default. `package.json` carries an `allowScripts`
allowlist for the four packages that need one (`better-sqlite3`, `esbuild`, `fsevents`,
`unrs-resolver`). If your npm predates that feature the field is ignored and install behaves as
usual.

| Command | Does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Vitest suite, 40 tests |
| `npm run db:seed` | Wipe and reload the demo data |
| `npm run db:reset` | Delete the database file, then seed |
| `npm run db:generate` | Regenerate SQL migrations after a schema edit |

### Optional: model-backed features

Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY` to switch on two extras: search
that reads a sentence the rules parser cannot classify, and a first-message drafter in the contact
form. Both are described under [AI functionality](#ai-functionality). The marketplace is complete
without a key.

---

## Sign-in accounts

There are no passwords. `/login` lists every seeded account and issues a session for whichever one
you pick, so a reviewer can move between roles in two clicks.

| Role | Try | Why this one |
|---|---|---|
| Buyer | `elena@arcvestpartners.com` | Sharp mandate: EMI and payments, LT/CY/MT/IE, $2M–$12M, proof of funds. Matches score high and explain themselves. |
| Buyer | `jonas@vitkus.lt` | Small tickets and a narrow mandate, so the same listings score low. Good contrast with Elena. |
| Seller | `ruta@balticlicensing.lt` | Four listings including one under offer, plus two live threads. |
| Seller | `dana@quarrybridge.com` | Unverified seller with a licence-portfolio listing. |
| Manager | `olena@n5deal.com` | Moderation views, with an audit trail that already has entries. |
| Buyer | `greg@mallory-arb.com` | Suspended. Signing in shows the manager's reason instead of a session. |

The seed writes 24 accounts, 30 listings across 7 sectors and 18 jurisdictions, 8 message threads,
saved assets, and two moderation actions.

---

## What each role can do

**Buyer.** Edit a mandate (sectors, jurisdictions, ticket range, deal structures, timeline, proof
of funds). Browse and filter listings. Read a per-listing match score with the reasoning behind it.
Save listings. Contact a seller, which opens a thread tied to that listing.

**Seller.** Publish and edit listings through a form that reviews the draft as you type. Browse and
filter the buyer directory. Rank buyers against a chosen listing. Contact a buyer. Move a listing
between draft and live.

**Platform manager.** Read counts across the marketplace. Search participants and listings. Suspend,
remove, or reinstate an account. Unlist or restore a listing. Every action takes a written reason
and lands in an append-only audit trail.

---

## Architecture and the reasoning behind it

### Stack

Next.js 16 App Router with TypeScript, Tailwind v4, Drizzle ORM over SQLite via `better-sqlite3`.
React Server Components render every page; mutations go through Server Actions.

### Server Actions instead of a REST layer

Every write in `src/server/actions.ts` is a Server Action. A REST layer would mean duplicating each
Zod schema on both sides of a `fetch` and hand-rolling the loading states. With actions, the
validation sits next to the write, forms submit without client JavaScript, and `useActionState`
gives the pending flag for free. The one place that returns data rather than performing a write is
`interpretQueryAction`, which the search box calls so it can show what it understood before the URL
changes.

### SQLite, and what it costs

SQLite with a file on disk means `npm install && npm run db:seed && npm run dev` and nothing else.
No container, no connection string, no cloud account for a reviewer to create. Drizzle keeps the
schema in TypeScript (`src/db/schema.ts`) and generates real SQL migrations into `drizzle/`, so
moving to Postgres is a driver swap plus a regenerate, and the query layer above it stays as
written.

The cost is deployment. Vercel's serverless filesystem does not persist, so a hosted version needs
Postgres or Turso. That trade favours the reviewer's first five minutes over a deploy button, which
seemed like the right way round for a prototype.

Two schema choices worth naming:

- **Money is integer USD cents.** SQLite has no decimal type and floats lose precision at deal
  sizes. Every column is `*Cents` and formatting happens at the edge in `src/domain/money.ts`.
- **Multi-value fields are JSON text.** A buyer's sectors, jurisdictions and deal types sit in JSON
  columns rather than three join tables. The lists are short, always read whole, and filtered over a
  result set of a size the directory will never outgrow at this scale. A join table per attribute
  would be more normalised and would buy nothing here. `src/server/queries.ts` marks where the
  filtering moves from SQL into memory because of it.

### One place decides visibility

"Who can see a suspended listing" is the kind of rule that drifts once three pages answer it
separately. Every asset query in `src/server/queries.ts` runs through `visibilityFilter`, which
encodes the whole answer: the public sees published, under-offer and sold listings from active
sellers; a seller also sees their own drafts and suspensions; a manager sees everything. Suspending
a seller pulls their listings out of public search through the same filter, with no cascade write to
go wrong. `src/server/visibility.test.ts` covers each of those cases against a real database.

### Filters live in the URL

`src/lib/filter-params.ts` parses and serialises the whole filter state. A buyer can send a
colleague a link to operating EMIs in Lithuania under $5M and it opens the same page, the server
renders the first paint already filtered, and the back button means the previous page rather than
the previous checkbox. The parser drops any value outside the taxonomy, so a hand-edited URL cannot
push junk into a query.

### Sessions are rows

`src/lib/session.ts` writes a session row and puts its opaque id in an httpOnly cookie. Nothing
downstream reads the cookie contents. Two things follow: a manager suspending an account ends its
sessions, and the account is signed out on its next request; and swapping the demo picker for real
credentials touches one function, `signIn`.

### Layout

```
src/
  domain/      Pure functions, no I/O: matching, listing review, money, search parsing, taxonomy
  db/          Drizzle schema, client, seed
  server/      queries.ts (read model, visibility), actions.ts (every mutation), mappers.ts
  lib/         session, i18n, URL filter serialisation, Anthropic client
  components/  Server and client components, filters/ for the faceted-search controls
  app/         Routes
```

`domain/` holds the decisions worth testing and never touches the database, which is why the suite
runs in under a second.

---

## AI functionality

Three features, each with a deterministic fallback. The marketplace runs whole with no API key.

### Match scoring (no key needed)

`src/domain/matching.ts` scores a buyer mandate against a listing across five weighted factors:
sector fit including adjacent sectors, ticket range with a 25% tolerance band, jurisdiction, deal
structure, and buyer readiness. Both sides of the marketplace read the same scorer, so a buyer's
"recommended for you" and a seller's "buyers who fit this asset" can never disagree about who fits
whom.

Every point it awards comes back as a reason string. A buyer sees why a listing surfaced instead of
being handed a number to trust, and an unstated part of a mandate scores as neutral rather than as
a mismatch, so an empty field does not silently bury good listings.

### Search that reads a sentence

The box on `/listings` runs a rules parser (`parseSmartQuery`) on every keystroke. It handles the
phrasings people type on a deal site: a sector, a jurisdiction, a price ceiling, a range, industry
shorthand like `psp`, `vasp` and `shelf company`. The chips under the box show what it matched, so a
buyer can correct it. No network call, no key, no latency.

When the rules recognise nothing and a key is present, submitting sends the sentence to Claude with
a Zod output schema and takes structured filters back. That ordering is the point: search on a deal
platform cannot stop working because a provider is rate-limiting, so the model handles the residue
rather than the request. A failed call falls back to the rules parser and the page renders.

### Listing review

`src/domain/listing-quality.ts` reviews a draft against what a deal desk queries on a first read.
It separates errors that block publishing from contradictions between fields the seller entered
themselves: an operating business reporting zero revenue, EBITDA above revenue, a minority sale
offering 80%, a regulated asset with no named licence, an ask at 15x revenue. The editor's side
panel and the publish gate in `saveAssetAction` call the same function, so the panel is guidance
and the server call is the gate.

This one runs on rules rather than a model on purpose. It is a validator, it needs to be the same
every time, and it needs to run on every keystroke.

### Message drafting (key needed)

The contact form can draft an opening message grounded in the listing and the mandate. It fills the
textarea and stops there. A person reads and edits before anything sends, so the model never speaks
to a counterparty on someone's behalf.

---

## Assumptions

- **No passwords.** The assignment left authentication open. A demo account picker shows all three
  roles in the time a reviewer would otherwise spend registering. The session mechanism underneath
  is real.
- **One currency.** Every amount is USD. The reference site offers currency switching; here it would
  have added FX handling without showing anything new about the product.
- **Removal hides, it does not delete.** A removed participant keeps their rows and drops out of
  every public view. An M&A platform needs the record after a dispute, and the audit trail would be
  worthless pointing at deleted ids.
- **Sold listings stay visible.** Buyers on a thin market read closed deals as pricing comparables,
  so `SOLD` remains public and carries a badge.
- **One thread per buyer, seller and listing.** A unique index enforces it. Contacting the same
  seller about the same asset twice opens the existing thread rather than a second one.
- **Buyers can hide from the directory.** Some acquirers do not want to be visible while they are
  hunting. The flag hides them from sellers and leaves their saved assets and threads intact.
- **Listing images are out of scope.** The reference site shows a country flag on each card; the
  prototype does the same rather than build upload and storage.

---

## Testing

```bash
npm test
```

40 tests over the parts where a mistake would be silent:

- `src/domain/matching.test.ts`: weights, adjacency, tolerance bands, score bounds
- `src/domain/listing-quality.test.ts`: every publish blocker and cross-field contradiction
- `src/domain/search.test.ts`: the natural-language parser, including magnitudes and shorthand
- `src/lib/filter-params.test.ts`: URL round-tripping and rejection of out-of-taxonomy values
- `src/server/visibility.test.ts`: the visibility rules, against a real SQLite database in a
  temporary directory

Rendering is covered by hand rather than by tests. With more time the flows below would be the
first thing to automate.

---

## Edge cases handled

- A manager suspends a seller: their listings leave public search, the seller keeps editing them,
  and the manager still sees them.
- A manager suspends an account mid-session: the next request ends the session, and the sign-in
  screen shows the recorded reason.
- A seller cannot publish out of a manager's suspension. `saveAssetAction` pins the status.
- A buyer opens a direct link to a hidden buyer profile or another seller's draft: 404, not a leak.
- A listing with no price scores as neutral on budget rather than as a mismatch, and shows "price on
  request".
- A deleted listing detaches from its threads, and the conversation survives with its asset link
  cleared.
- A contact form cannot attach a listing that the seller in the thread does not own.
- Chip counts on `/listings` come from the result set with the sector facet removed, so a chip shows
  what selecting it would return.

---

## Multi-language

English and Ukrainian, switchable from the header, stored in a cookie and read on the server so the
first paint is in the right language. Both dictionaries are typed against the English keys, so a
missing Ukrainian string fails the build rather than shipping. Country names, number formatting and
dates follow the locale.

---

## Deployed version

Not deployed. The prototype writes to a SQLite file, and Vercel's serverless filesystem does not
persist between invocations, so a hosted build needs a database swap first. `src/db/client.ts` and
`drizzle.config.ts` are the two files to change: point Drizzle at `postgresql`, regenerate
migrations, and the query and action layers stay as written. Run it locally with the three commands
at the top.

---

## With more time

1. **Deal room and NDA gating.** The reference platform gates detailed financials behind an NDA.
   The schema has room for it, and it is the next real product step: publish a public summary, and
   release the rest to a buyer who has signed.
2. **Playwright coverage of the flows.** Publish a listing, contact a seller, suspend an account.
   Those three journeys carry most of the risk and none of them are automated.
3. **Full-text search.** SQLite `LIKE` scans the description column. FTS5 with ranking would handle
   a corpus larger than 30 listings.
4. **Postgres and a deploy.** See above.
5. **Semantic matching.** The current scorer reads structured fields. Embedding the mandate text and
   the listing description would catch the fit a taxonomy misses, with the rules score kept as the
   explainable floor.
6. **Notifications.** A message arriving is only visible if you open the inbox. Email and a digest
   for sellers with matching buyers.
7. **Seller verification.** The `verified` flag on a seller profile is seeded, not earned. It needs
   a review queue for a manager.
8. **Ukrainian listing content.** The chrome translates; the seeded listings themselves are English
   only.

---

## AI tools used

Built with Claude Code (Claude Opus 5) in a single session. The model wrote most of the code from
my specification of the data model, the visibility rules, the matching weights and the UX; I
directed the product decisions, the architecture, and the trade-offs written up above, and reviewed
and corrected as it went. The reference site at n5deal.com was read for its visual language and its
listing attributes.

The application itself calls the Anthropic API for the two features in
[AI functionality](#ai-functionality), through `src/lib/ai.ts`.
