// api/render-concept-ad.js
//
// "Out-of-the-box" CONCEPT ad renderer (brand-world poster style), sibling to
// render-ad.js. Layout = full-bleed art-directed image + centered brand LOGO +
// big tagline + a row of benefit bullets. Built for the POCA "Sweetener for
// people with taste." style.
//
// Same engine as render-ad.js: Satori (JSX -> SVG) + @resvg/resvg-js (SVG -> PNG).
// Reuses the bundled Lato fonts and the shared RATIOS list.
//
// Exports renderConceptRatio({ ratio, imageDataUri, logo, tagline, bullets, accent })
// so a runner can fetch the nano-banana background + the client logo, then render
// all 4 ratios. Pipeline-ready: swap logo + imagery + copy per client.

const fs = require("fs");
const path = require("path");
const { RATIOS } = require("./render-ad.js"); // reuse 1x1 / 4x5 / 9x16 / 16x9

const WHITE = "#FFFFFF";
const ACCENT_DEFAULT = "#FF4D00";

// ---------- Fonts (bundled in api/fonts) ----------
function findFontPath(filename) {
  const candidates = [
    path.join(__dirname, "fonts", filename),
    path.join(process.cwd(), "api/fonts", filename),
    path.join(process.cwd(), "fonts", filename),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error(`Font not found. Tried: ${candidates.join(" | ")}`);
}
let _fonts = null;
function getFonts() {
  if (_fonts) return _fonts;
  _fonts = {
    Regular:  fs.readFileSync(findFontPath("Lato-Regular.ttf")),
    Semibold: fs.readFileSync(findFontPath("Lato-Semibold.ttf")),
    Bold:     fs.readFileSync(findFontPath("Lato-Bold.ttf")),
    Black:    fs.readFileSync(findFontPath("Lato-Black.ttf")),
  };
  return _fonts;
}

// ---------- JSX-without-build helper ----------
function h(type, props, ...children) {
  return {
    type,
    props: {
      ...(props || {}),
      children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
    },
  };
}

// ---------- Build the concept layout ----------
// logo = { dataUri, w, h } (already sized). bullets = ["0 Sugar","3g Fiber","Plant-Based"]
function buildConceptJsx({ w, h: H, imageDataUri, logo, tagline, bullets = [], accent = ACCENT_DEFAULT }) {
  const scale = Math.min(w, H);
  const pad = Math.round(w * 0.08);
  const tagSize = Math.round(scale * 0.075);
  const bulletSize = Math.round(scale * 0.030);
  const shadow = "0 2px 16px rgba(0,0,0,0.55)";

  const children = [];

  // Full-bleed background image, cover-fit.
  if (imageDataUri) {
    children.push(
      h("img", {
        src: imageDataUri,
        width: w,
        height: H,
        style: { position: "absolute", top: 0, left: 0, width: w, height: H, objectFit: "cover" },
      })
    );
  }

  // Gentle centered scrim so white type stays legible over any image.
  children.push(
    h("div", {
      style: {
        position: "absolute",
        left: 0, right: 0, top: 0, bottom: 0,
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(8,8,8,0.34) 0%, rgba(8,8,8,0.12) 55%, rgba(8,8,8,0) 78%)",
      },
    })
  );

  // Center stack: logo -> tagline -> bullets
  const stack = [];

  if (logo && logo.dataUri) {
    stack.push(
      h("img", {
        src: logo.dataUri,
        width: logo.w,
        height: logo.h,
        style: { width: logo.w, height: logo.h, objectFit: "contain" },
      })
    );
  }

  if (tagline) {
    stack.push(
      h("div", {
        style: {
          fontSize: tagSize,
          fontWeight: 900,
          color: WHITE,
          textAlign: "center",
          lineHeight: 1.04,
          letterSpacing: -0.5,
          marginTop: Math.round(scale * 0.045),
          maxWidth: w - pad * 2,
          textShadow: shadow,
        },
      }, String(tagline))
    );
  }

  if (bullets.length) {
    const row = [];
    bullets.forEach((b, i) => {
      if (i > 0) {
        row.push(
          h("div", {
            style: {
              width: Math.round(bulletSize * 0.42),
              height: Math.round(bulletSize * 0.42),
              borderRadius: 999,
              backgroundColor: accent,
              marginLeft: Math.round(bulletSize * 0.6),
              marginRight: Math.round(bulletSize * 0.6),
            },
          })
        );
      }
      row.push(
        h("div", { style: { fontSize: bulletSize, fontWeight: 700, color: WHITE, textShadow: shadow } }, String(b))
      );
    });
    stack.push(
      h("div", {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          marginTop: Math.round(scale * 0.035),
        },
      }, ...row)
    );
  }

  children.push(
    h("div", {
      style: {
        position: "absolute",
        left: 0, right: 0, top: 0, bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: pad,
      },
    }, ...stack)
  );

  return h("div", {
    style: {
      width: w, height: H, display: "flex", position: "relative",
      backgroundColor: "#080808", fontFamily: "Lato", overflow: "hidden",
    },
  }, ...children);
}

// ---------- Layout B: "split" — product on a color field (left), type block (right) ----------
// The nano-banana background already places the product on the left over a solid
// color field with the right side empty. We overlay logo + a two-line headline
// (second line in the accent color) anchored in the right portion.
function buildConceptSplitJsx({ w, h: H, imageDataUri, logo, headline, accentLine, accent = ACCENT_DEFAULT }) {
  const scale = Math.min(w, H);
  const pad = Math.round(w * 0.06);
  const hlSize = Math.round(scale * 0.082);
  const shadow = "0 2px 14px rgba(0,0,0,0.45)";

  const children = [];

  if (imageDataUri) {
    children.push(
      h("img", {
        src: imageDataUri,
        width: w, height: H,
        style: { position: "absolute", top: 0, left: 0, width: w, height: H, objectFit: "cover" },
      })
    );
  }

  const block = [];
  if (logo && logo.dataUri) {
    block.push(
      h("img", {
        src: logo.dataUri, width: logo.w, height: logo.h,
        style: { width: logo.w, height: logo.h, objectFit: "contain", marginBottom: Math.round(scale * 0.03) },
      })
    );
  }
  if (headline) {
    block.push(
      h("div", {
        style: { fontSize: hlSize, fontWeight: 900, color: WHITE, lineHeight: 1.02, letterSpacing: -0.5, textShadow: shadow },
      }, String(headline))
    );
  }
  if (accentLine) {
    block.push(
      h("div", {
        style: { fontSize: hlSize, fontWeight: 900, color: accent, lineHeight: 1.02, letterSpacing: -0.5, textShadow: shadow },
      }, String(accentLine))
    );
  }

  children.push(
    h("div", {
      style: {
        position: "absolute",
        left: Math.round(w * 0.40), right: pad, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        alignItems: "flex-start", justifyContent: "center",
      },
    }, ...block)
  );

  return h("div", {
    style: { width: w, height: H, display: "flex", position: "relative", backgroundColor: "#080808", fontFamily: "Lato", overflow: "hidden" },
  }, ...children);
}

// ---------- Layout C: "poster-bottom" — full-bleed image, copy over a bottom scrim ----------
// Proven legibility (same scrim as render-ad). Works no matter where the product
// lands in the image: product sits above, logo + two-line headline sit bottom-left
// over a dark gradient. Best for img2img product concepts.
function buildConceptBottomJsx({ w, h: H, imageDataUri, logo, headline, accentLine, accent = ACCENT_DEFAULT }) {
  const scale = Math.min(w, H);
  const pad = Math.round(w * 0.065);
  const hlSize = Math.round(scale * 0.082);
  const children = [];

  if (imageDataUri) {
    children.push(
      h("img", {
        src: imageDataUri, width: w, height: H,
        style: { position: "absolute", top: 0, left: 0, width: w, height: H, objectFit: "cover" },
      })
    );
  }

  // Bottom gradient scrim for legibility.
  children.push(
    h("div", {
      style: {
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: Math.round(H * 0.6),
        backgroundImage: "linear-gradient(to top, rgba(8,8,8,0.92) 0%, rgba(8,8,8,0.72) 36%, rgba(8,8,8,0) 100%)",
      },
    })
  );

  const block = [];
  if (logo && logo.dataUri) {
    block.push(
      h("img", {
        src: logo.dataUri, width: logo.w, height: logo.h,
        style: { width: logo.w, height: logo.h, objectFit: "contain", marginBottom: Math.round(scale * 0.028) },
      })
    );
  }
  if (headline) {
    block.push(h("div", { style: { fontSize: hlSize, fontWeight: 900, color: WHITE, lineHeight: 1.02, letterSpacing: -0.5 } }, String(headline)));
  }
  if (accentLine) {
    block.push(h("div", { style: { fontSize: hlSize, fontWeight: 900, color: accent, lineHeight: 1.02, letterSpacing: -0.5 } }, String(accentLine)));
  }

  children.push(
    h("div", {
      style: {
        position: "absolute", left: pad, right: pad, bottom: pad,
        display: "flex", flexDirection: "column", alignItems: "flex-start",
      },
    }, ...block)
  );

  return h("div", {
    style: { width: w, height: H, display: "flex", position: "relative", backgroundColor: "#080808", fontFamily: "Lato", overflow: "hidden" },
  }, ...children);
}

async function renderJsxToPng(jsxNode, w, h) {
  const satoriMod = await import("satori");
  const satori = satoriMod.default || satoriMod;
  const fonts = getFonts();
  const svg = await satori(jsxNode, {
    width: w,
    height: h,
    fonts: [
      { name: "Lato", data: fonts.Regular,  weight: 400, style: "normal" },
      { name: "Lato", data: fonts.Semibold, weight: 600, style: "normal" },
      { name: "Lato", data: fonts.Bold,     weight: 700, style: "normal" },
      { name: "Lato", data: fonts.Black,    weight: 900, style: "normal" },
    ],
  });
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, { background: "transparent" });
  return resvg.render().asPng();
}

async function renderConceptRatio({ ratio, imageDataUri, logo, layout = "center", tagline, bullets, headline, accentLine, accent }) {
  let jsx;
  if (layout === "split") {
    jsx = buildConceptSplitJsx({ w: ratio.w, h: ratio.h, imageDataUri, logo, headline, accentLine, accent });
  } else if (layout === "poster-bottom") {
    jsx = buildConceptBottomJsx({ w: ratio.w, h: ratio.h, imageDataUri, logo, headline, accentLine, accent });
  } else {
    jsx = buildConceptJsx({ w: ratio.w, h: ratio.h, imageDataUri, logo, tagline, bullets, accent });
  }
  return renderJsxToPng(jsx, ratio.w, ratio.h);
}

// Prepare a logo for a target on-canvas width. Rasterizes SVG via resvg (gives
// exact dims); for raster logos falls back to an assumed wordmark aspect.
async function prepareLogo({ buf, contentType, targetW }) {
  const isSvg = /svg/i.test(contentType || "") || buf.slice(0, 200).toString("utf8").includes("<svg");
  if (isSvg) {
    const { Resvg } = await import("@resvg/resvg-js");
    const r = new Resvg(buf.toString("utf8"), { fitTo: { mode: "width", value: targetW } });
    const img = r.render();
    const png = img.asPng();
    return { dataUri: `data:image/png;base64,${png.toString("base64")}`, w: img.width, h: img.height };
  }
  // raster fallback: assume ~3.4:1 wordmark
  const ct = contentType || "image/png";
  return { dataUri: `data:${ct};base64,${buf.toString("base64")}`, w: targetW, h: Math.round(targetW / 3.4) };
}

module.exports = { renderConceptRatio, buildConceptJsx, buildConceptSplitJsx, buildConceptBottomJsx, prepareLogo, RATIOS };
