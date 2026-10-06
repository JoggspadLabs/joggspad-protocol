# Security Policy

## Scope

This repository holds the Joggspad public site. It contains no private keys and talks to three outside services: the Solana RPC, DefiLlama and DexScreener. Protocol contracts are not in this repository yet.

## Reporting a problem

Please do not open a public issue for a vulnerability. Send a private report to the maintainers through the contact route published on the site once one is listed. Until a contact is listed, hold the report and check back; do not guess an address.

A useful report includes:

- what you found and where,
- steps to reproduce,
- the effect you expect it to have,
- any suggested fix.

We aim to acknowledge a report quickly and to keep you informed until it is closed.

## What counts

- Script injection through any remote field (pair names, logos, links).
- A way to make the site present a wrong contract address.
- A way to make an inert control act as a live link.
- Weakening of the content security policy.
- Leaking a visitor's data to a host outside the policy.

## What does not count

- Third-party outages and their effect on the dash fallback.
- Findings that need a visitor to paste untrusted code into their own console.

## Address hygiene

The only contract address the project recognizes is the one pinned in the strip at the top of the site. If that strip says no address has been published, then no address exists. Treat any other claim as hostile.

## Our commitments

- Remote strings are written with `textContent`, never as markup.
- Remote URLs are checked against an expected host before use.
- Scripts and styles load only from the site itself.
- No inline script, no inline style attribute, no event-handler attributes.
