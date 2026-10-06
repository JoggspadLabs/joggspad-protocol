# Joggspad Roadmap

Phases are ordered by dependency, not by calendar. A phase starts when the one before it has exited.

## Phase 1: Anchor

Goal: a public front end that reports truthfully on what it knows.

- Site reads the current slot, chain health, value locked and top pairs live.
- Contract strip pinned at the top, inert until an address is published.
- Social icons drawn from day one, inert until links exist.
- Release gates in place, with both the published and unpublished branches exercised.

Exit: the site is deployed from `dist/` and every gate passes.

## Phase 2: Terms

Goal: a terms file format that anyone can read and recompute.

- Fix the schema: supply, curve, window, vesting steps, fee split.
- Publish a reference implementation of the curve as a pure function.
- Ship a validator that rejects terms whose vesting steps do not sum to the reserved amount.

Exit: three independent recomputations of one terms file agree to the last unit.

## Phase 3: Rails

Goal: contracts for opening, vesting and guarding.

- Curve contract with a fixed window.
- Vesting contract keyed to slot height.
- Guard contract with ceilings, allow list, freeze and ledger.

Exit: a written audit report exists, with every finding closed. The site links the report only after this point.

## Phase 4: First launches

Goal: a small number of supervised launches.

- Invite-only creators.
- Public ledger index.
- Post-launch review published for each.

Exit: no open critical finding from any supervised launch.

## Phase 5: Open creation

Goal: anyone may create a launch using a valid terms file.

- Self-serve terms upload and validation.
- Creator dashboard for ceilings and the freeze switch.

## Not planned

- Features that cannot be explained in a paragraph.
- Anything that needs an unlabeled allocation.
