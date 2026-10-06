# Joggspad Tokenomics

Status: framework only. No supply, price, allocation percentage or fee rate has been fixed, and none appears on the site. This file records the shape of the economy so that numbers can be dropped in later without redesign.

## Principles

1. **Public before private.** Every allocation, including reserved shares, is declared inside the terms file and visible on chain before a window opens.
2. **Schedule over promise.** Anything not liquid at launch unlocks by slot height through the contract.
3. **Fees stay explainable.** Each fee has one named purpose and one named destination.
4. **Nothing is implied.** If a number is missing here, it is missing because it is not decided.

## Flows

| Flow | Source | Destination | Status |
| --- | --- | --- | --- |
| Opening liquidity | Launch creator | Curve contract | Shape fixed, size per launch |
| Trading fee | Each swap on the curve | Split set by the terms file | Rate open |
| Reserved units | Terms file | Vesting contract | Schedule per launch |
| Treasury spend | Guarded wallet | Named destinations only | Ceilings per launch |

## Fee design

A fee is charged on curve swaps only. The terms file names the split among the launch treasury, the protocol and any burn. The split is part of the hashed terms, so it cannot change after the window opens.

Open parameters:

- the protocol's share of any fee,
- whether a burn leg exists at all,
- the floor and ceiling a creator may choose.

## Vesting

Each reserved allocation carries a cliff height and a list of step heights with a share per step. Steps must sum to the full reserved amount; the contract refuses terms that do not.

## Treasury guard

Treasury movement is bounded by one ceiling per day and one per month. Crossing a ceiling parks the transfer until a human signature clears it. A freeze switch halts movement at once and is recorded on the ledger.

## What would change this file

A published address, an audit report, or one decision on an open parameter. Until one of those exists, this file stays a framework.
