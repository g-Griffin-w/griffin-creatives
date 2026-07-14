# GriffinCreativeLab — Creative Generation Pipeline Strategy
_v1 · locked 2026-07-02 · owner: Gabriel_

The reference doc for HOW we render client ad creative and WHY. Read before changing the render pipeline. Purpose: stop re-learning the product-fidelity lesson the hard way.

---

## The problem we hit (twice)
Our sample pipeline uses `nano-banana/edit` (img2img). It takes the client's real product photo as a *source*, but nano-banana is **generative** — it re-renders every pixel, product included. "Keep the product exactly" is a *suggestion* to the model, not a guarantee. Result: the product in the final ad is an AI *recreation*, not their real product. Detail-heavy items drift most (small label text, ribbed sock weave, brand bands). Kevin @ Southern Scholar spotted it instantly: "those aren't our actual products, they're AI-generated." For a brand owner, product fidelity is table stakes.

## Root cause
1. Generative img2img cannot guarantee pixel-exact product preservation.
2. nano-banana specifically is weak at small-text and fine-detail fidelity vs. newer models.
3. Our QA tested "does it look coherent," not "is this literally the real product."

---

## The three architectures (route per shot)

**A. Compositing — real photo + copy overlay (NO generation).**
Feed the client's real, untouched product/lifestyle photo straight into `render-ad.js`; overlay headline/subhead.
- Fidelity: 100% (it *is* their photo). Cost: $0 (no fal call). Speed: instant.
- Trade-off: less "editorial dreamscape" — as good as their source photography.
- Best for: hero product ads, proof-of-value samples, any fidelity-critical brand.

**B. Background-only generation + real product cutout composite.**
Cut the product out (fal BiRefNet / remove.bg) → generate an AI **background only** (product NOT in the prompt, so nothing to garble) → composite the REAL cutout on top → copy overlay.
- Fidelity: 100% product, AI scene. Cost: ~1 gen + cutout. Engineering: highest (add cutout + composite step). Note: `generate-concept-ads.js` already has a `txt2img = BACKGROUNDS ONLY` mode — half the architecture exists.
- Best for: editorial "hero product in a scene" where we want AI atmosphere but exact product.

**C. Product-consistency img2img (better model).**
Swap `nano-banana/edit` → **Seedream 4.5 edit** or **Flux Kontext**.
- Fidelity: ~95%, and Seedream renders small text reliably. Cost: ~$0.04/img. Engineering: one-line fal URL swap.
- Trade-off: still generative, never pixel-guaranteed.
- Best for: product shown **worn / held / in-use** where compositing can't work (socks on legs, hand holding the tin), and a fast quality lift across the board.

---

## Model landscape (all fal-hosted → drop-in swaps)
| Model | fal endpoint | Strength | Use |
|---|---|---|---|
| nano-banana/edit (current) | `fal-ai/nano-banana/edit` | cheap scenes; weak on detail/text | **deprecate for product shots** |
| Seedream 4.5 edit | `fal-ai/bytedance/seedream/v4.5/edit` | product/packaging **with text**, 2K, up to 10 refs | primary img2img |
| Flux Kontext pro | `fal-ai/flux-pro/kontext` | reference-consistent scene/lighting edits, keeps object | consistency + LoRA product-lock |
| Higgsfield Soul 2.0 | (platform, not fal API) | human/fashion editorial + face consistency (Soul ID) | AI **models wearing** product (lifestyle/UGC) — NOT product replication |

(No Higgsfield "death claw" model exists in public listings as of 2026-07 — likely a misremembered name.)

---

## Differentiation — why us, not "anyone with the same model"
The image model is a **commodity**; everyone can call Seedream/Flux/nano-banana. The moat is the system and judgment around it:
1. **Fidelity guarantee** — the client's real product, exact, every time. Competitors shipping raw img2img can't promise this. Trust wedge.
2. **Per-client brand lock** — stored logo, colors, fonts, product cutout library, approved photos → every ad on-brand automatically, at speed.
3. **Angle/hook strategy** — which concepts to test and why. The thinking, not the rendering.
4. **Test velocity + performance feedback loop** — volume of fresh, on-brand creative + learning from what actually converts. That's the outcome clients pay for.
5. **Real+AI hybrid** — real product base (compositing) + AI scene expansion. Best of both.

## The rule (locked by Gabriel, 2026-07-06)
**Every client creative is a PRODUCED scene — run through Nano Banana 2 img2img (`fal-ai/nano-banana-2/edit`). A raw product photo with our copy laid on top is NOT a deliverable.** Clients read it as "you made nothing" — it cost us the Southern Scholar (Kevin) lead. The composite engine is for internal proofs only, never a client sample.
**Guardrail:** because img2img is generative, QA the output against the client's REAL product before anything ships — same rule that mattered when nano-banana drifted the sock. Gabriel runs the img2img and approves the frame; Claude finishes it (copy + ratios) and double-checks fidelity.

---

## Implementation — `scripts/generate-ads.js`
One config-driven tool, all three engines, per-client concept config. Reuses the tested
`render-ad.js` (composite/seedream) and `render-concept-ad.js` (cutout) renderers.

```
ENGINE=composite CLIENT=southernscholar node scripts/generate-ads.js          # $0, no FAL_KEY
ENGINE=seedream  CLIENT=southernscholar FAL_KEY='...' node scripts/generate-ads.js
ENGINE=cutout    CLIENT=chikkachikka    FAL_KEY='...' node scripts/generate-ads.js
```
Output: `sample-ads/<client>-<engine>/`. Add `ONLY=<concept>` to run a single concept.

Confidence: **composite** and **seedream** are low-risk (reuse proven render path + a documented
fal endpoint). **cutout** is new — QA the composited output before sending to a client.

## Rollout plan
1. **Now:** run `composite` → accurate ads back to Kevin & Sabeen tonight, $0.
2. **This week:** run `seedream` on the garbled cases to confirm the fidelity lift; make Seedream the default img2img; keep nano-banana only for abstract/background use.
3. **Next:** validate `cutout` for editorial hero-in-scene; stand up per-client brand-lock config (differentiation item #2).
