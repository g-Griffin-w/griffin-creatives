# raw-photos

Drop a client's real product photos here to use them as an exact source in `scripts/generate-ads.js`.

- Any concept whose `product_url` / `real_photo_url` is a local path (e.g. `raw-photos/southernscholar-patriotic.png`) reads from this folder.
- The **cutout** engine runs the photo through BiRefNet, which isolates the product from its background (any baked-in text on the background is removed with it), then composites the exact product onto a fresh scene + our copy.
- The **composite** engine uses the photo as-is (best with a clean product/lifestyle shot).

Current expected files:
- `southernscholar-patriotic.png` — the socks from Southern Scholar's "HAPPY FOURTH" post.
