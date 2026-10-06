# Joggspad Architecture

Two things live here: the static site that ships today, and the protocol layers it will front.

## The site

A hand-built static page. No framework, no bundler, no runtime dependency.

```
src/register.json      outside facts, one record each
src/index.template.html page skeleton with named slots
src/tokens.css         the only place color literals exist
src/styles.css         layout and motion
src/app.js             entry; wires the modules below
src/live.js            RPC, TVL and pair polling
src/backoff.js         delay math with jitter
src/fx.js              progress bar, reveal, parallax, count-up
src/field.js           hero canvas
src/ui.js              tabs and copy controls
tools/build.mjs        register + template -> dist/
tools/gates.mjs        release gates
```

### Build

`tools/build.mjs` loads the register, validates it, fills the template slots (contract strip, social icons, info tiles, footer entry), derives the favicon from the tokens, writes the content security policy into both a meta tag and a `_headers` file, and copies scripts and styles into `dist/`.

### The register

Each outside fact is one record:

```json
{ "state": "stated | absent | unconfirmed", "...": "value fields" }
```

Only `stated` records produce a value, and only they produce a hyperlink. Links are stored whole; handles are derived at build time. A malformed contract address fails the build, but any well-formed base58 string of 32 to 44 characters is accepted.

### Live data

| Feed | Origin | Method | Cadence |
| --- | --- | --- | --- |
| Current slot, genesis hash | Solana mainnet-beta RPC | JSON-RPC `getSlot`, `getGenesisHash` | about two seconds |
| Value locked | DefiLlama chains list | match on the `solana` slug | about a minute |
| Top pairs | DexScreener search | keep pairs tagged solana, sort by 24h volume | under a minute |

Each poller obeys one rulebook: exponential backoff with jitter after a failure, a cap on the delay, a pause while the tab is hidden, and a dash when no value could be read. Chain health is Connecting until the first answer, Live while answers arrive, and Offline after two failures in a row.

### Security

- Content security policy: scripts and styles from the site itself, fonts from the font host, connections only to the RPC, DefiLlama and DexScreener.
- No inline script, no inline style attribute, no event-handler attributes.
- Remote text is written with `textContent`; remote URLs are checked against an expected host before use.

### Motion

All motion respects `prefers-reduced-motion`. Under that setting, the canvas draws one still frame, parallax and count-up are skipped, and reveal animations resolve instantly.

## The protocol layers

Planned, not shipped.

```
terms file --hash--> curve contract --opens--> window
                          |
                          +--reserved units--> vesting contract (slot height steps)
                          |
                          +--treasury--------> guard contract (ceilings, allow list, freeze, ledger)
```

- **Curve contract:** price is a pure function of the hashed terms.
- **Vesting contract:** steps unlock at fixed slot heights.
- **Guard contract:** wraps any wallet that spends for a launch.

## Failure modes the design accepts

- RPC outage: the site shows Offline and dashes; nothing else breaks.
- Third-party feed outage: the affected tile shows a dash; other tiles continue.
- Missing address: the top strip stays inert and says so.
