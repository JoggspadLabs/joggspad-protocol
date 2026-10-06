# Contributing to Joggspad

Thanks for helping. The project is small on purpose, so a few habits keep it that way.

## Setup

Node 18 or newer. There is nothing to install.

```bash
npm run build
```

```bash
npm run gates
```

Both must exit with code 0 before a change is ready for review.

## Ground rules

1. **Facts go in the register.** Any outside fact (address, link, endpoint, chain detail) is one record in `src/register.json` with a state of `stated`, `absent` or `unconfirmed`. Do not hard-code a fact in markup or script.
2. **Store the URL, derive the handle.** Never type a handle by hand. A record that is not stated must not produce an `href`.
3. **Never blanket-reject address input.** Validate shape (base58, 32 to 44 characters). Do not reject on a leading character alone.
4. **Color lives in `src/tokens.css`.** Every literal there is a color sampled from the brand assets, with its source pixel recorded. Other files use variables, and scripts read variables at runtime.
5. **No dates on the page.** Dates may live in the register. They never render.
6. **Respect reduced motion.** New animation needs a quiet path.
7. **Keep the policy tight.** A new network origin needs a matching entry in the content security policy and a reason in the pull request.

## Changing the gates

Gates use synthetic fixtures only and run on a fast clock. The suite holds at thirty gates or fewer and finishes in a few minutes at most. When a gate needs a mutation test, anchor it by reading the current register record at run time rather than assuming today's values.

## Pull requests

- One topic per pull request.
- Say what changed and how you checked it.
- Include a screenshot for any visual change, at a phone width and a desktop width.

## Copy

Write in plain, direct sentences. Keep marketing claims to what the code does today.
