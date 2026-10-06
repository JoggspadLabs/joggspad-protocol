# Joggspad Whitepaper

## Summary

Joggspad is a launch pad for Solana. It exists to make the first hours of a new asset legible: the curve is public before money moves, release schedules are written into the contract, and any wallet that spends on a launch's behalf works under hard ceilings.

The network is Solana mainnet-beta, which has no EVM chain id; the cluster is identified by its genesis hash. This paper describes design intent. Parameters that are not yet fixed are named as open rather than guessed.

## The problem

New launches fail in familiar ways.

1. **Hidden allocation.** Early insiders hold supply the public cannot see, and the first buyers are really exit liquidity.
2. **Promised release.** Vesting is described in a post, not enforced by code, so it bends when pressure arrives.
3. **Open treasuries.** A single key can drain a launch treasury with a single transaction.
4. **Noisy provenance.** Look-alike addresses circulate and newcomers cannot tell which one is real.

## Design

### Open

Creating a launch starts with a terms file: total supply, curve shape, window length, vesting steps. The terms are hashed and the hash is pinned on chain before the window opens. The curve is a pure function of the terms, so anyone can recompute the price at every point before committing a coin.

No allocation may sit outside the terms. If the terms say a share is reserved, that share is visible, locked and scheduled from the first block.

### Vest

Vesting steps are keyed to slot height, not to wall-clock promises. A step is an on-chain event: when the chain reaches the height, the units become movable. Nothing off chain can accelerate a step, and nothing can delay one without a visible, recorded override.

### Guard

Every wallet that spends on behalf of a launch sits inside a guard with four parts:

- a daily ceiling and a monthly ceiling,
- an allow list of destinations,
- a freeze switch that halts movement within the block where it is thrown,
- an append-only ledger of transfers, refusals and rule changes.

Crossing a ceiling does not fail silently. The action parks until a human signature clears it.

### Settle

Settlement uses the chain's native finality. The front end reads the current slot straight off the public RPC and shows chain health so a visitor can distinguish a quiet chain and a dead link.

## Verification posture

The site pins one contract address in a strip at the top of each page. That address is the only one the project recognizes. When no address has been published, the strip says so plainly and offers nothing to copy. That choice is deliberate: an empty slot is safer than a guess.

## What this paper does not claim

- It does not state a token supply, price, or fee rate. Those are open.
- It does not promise returns of any kind.
- It does not describe audits that have not happened. Audit status will be published only once a report exists.

## Open questions

- Curve family for the first launches.
- Whether human sign-off should be a single key, or else a threshold set.
- Retention window for the public ledger index.
