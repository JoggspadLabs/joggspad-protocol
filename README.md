# Joggspad

Joggspad is a launch pad for Solana. This repository holds the public site: a static front end that reads the chain directly and ships as a single folder.

- Network: Solana mainnet-beta (no EVM chain id)
- RPC: `https://solana-rpc.publicnode.com`
- Deploy folder: `dist/`

## What the page does

- Pins the contract address (base58, 32 to 44 characters) in a strip at the very top. Until an address is published the strip is inert text; once published it becomes a one-tap copy control showing the whole address.
- Streams the current slot from the RPC (`getSlot`), with a health pill that reads Live, Connecting or Offline.
- Pulls value locked from DefiLlama by matching the `solana` slug.
- Lists the busiest pairs carrying the solana tag on DexScreener, with logo, price and daily volume.
- Backs off exponentially, with jitter, after any failed request. Polling stops while the tab is hidden. A dash replaces any figure that could not be read.

## Layout

```
src/            page source: template, styles, tokens, scripts, register
tools/build.mjs builds src/ into dist/
tools/gates.mjs runs the release gates
tools/serve.mjs tiny static server for local checks
docs/           whitepaper, tokenomics, roadmap, architecture
dist/           deploy output
```

## Commands

```bash
npm run build
```

```bash
npm run gates
```

```bash
npm run serve
```

`build` needs only Node 18 or newer. There are no runtime dependencies.

## The register

Every outside fact lives as one record in `src/register.json` with a state of `stated`, `absent` or `unconfirmed`. The build reads the register and nothing else decides what renders:

| Record | Today | Effect when not stated |
| --- | --- | --- |
| chain | stated | n/a |
| rpc | stated | n/a |
| contract | absent | top strip stays inert text, no copy control |
| x | absent | icon drawn, not clickable |
| github | absent | icon drawn, not clickable |

Links are stored as full URLs and the visible handle is derived from the URL. A record that is not stated never produces an `href`.

To publish the address, set `contract.state` to `stated`, fill `contract.address`, and rebuild. Links follow that pattern through `x.url` and `github.url`.

## Colors

The palette comes from the brand assets. Each color was found by k-means across the files in `brand/` and `reference/`, then snapped to a real pixel; `src/brand.json` records the file and coordinates. All color literals sit in `src/tokens.css`, and scripts read colors from CSS custom properties at runtime. `npm run brand` (`tools/brand-extract.mjs`) re-verifies the palette and re-traces the logo.

## Deploying

Drag the contents of `dist/` onto Cloudflare Pages. The `_headers` file inside carries the content security policy, which allows only the RPC, DefiLlama, DexScreener and the font host.

## License

MIT. See `LICENSE`.
