#!/usr/bin/env python3
# Boise Gun Club local-business directory -> outfitter candidates for scripts/discover-outfitters.js.
# Reads the site's own business sitemap, keeps hunting/outfitter pages in our eight states, and
# collects name, phone and the website the listing points at. robots.txt crawl-delay is 2s.
# A listed website is only passed on when its domain shares a word with the business name
# (the directory's data is unverified); otherwise discover-outfitters falls back to guessing.
# Usage: python3 scripts/scrape-bgc-outfitters.py leads-work/bgc_sel.txt leads-work/candidates_bgc.json
import re, sys, json, time, html as H, urllib.request
UA = {'User-Agent': 'Mozilla/5.0 (compatible; GriffinCreativeBot/1.0; +https://griffincreativelab.com)'}
ST = {'idaho': 'ID', 'oregon': 'OR', 'montana': 'MT', 'wyoming': 'WY', 'california': 'CA', 'washington': 'WA', 'colorado': 'CO', 'utah': 'UT'}
GEN = {'outfitters', 'outfitter', 'outfitting', 'hunting', 'hunts', 'guide', 'guides', 'guiding', 'llc', 'inc', 'the', 'and', 'ranch', 'co', 'services', 'service', 'adventures', 'adventure'}
urls = [u.strip() for u in open(sys.argv[1]) if u.strip()]
out = []
for i, u in enumerate(urls):
    try:
        s = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25).read().decode('utf8', 'ignore')
    except Exception:
        time.sleep(2); continue
    time.sleep(2)
    st = ST[re.match(r'https://boisegunclub.com/([a-z-]+)/', u).group(1)]
    title = H.unescape((re.search(r'<title>([^<]+)', s) or [0, ''])[1])
    name = re.split(r'\s+[|\-–]\s+', title)[0].strip()
    ph = re.search(r'"telephone":"([^"]+)"', s)
    web = re.search(r'<a[^>]+href="(https?://(?!(?:www\.)?(?:boisegunclub|google))[^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*Website', s)
    text = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    if not re.search(r'hunt', text[:6000], re.I): continue
    c = {'name': name, 'state': st, 'phone': ph.group(1) if ph else None, 'source': u}
    if web:
        w = web.group(1)
        dom = re.sub(r'https?://(www\.)?', '', w).split('/')[0].lower().replace('-', '')
        toks = [t for t in re.findall(r'[a-z0-9]+', name.lower()) if t not in GEN and len(t) > 2]
        if any(t in dom for t in toks): c['website'] = w
    out.append(c)
    if i % 50 == 0: print(i, len(urls), len(out), flush=True)
json.dump(out, open(sys.argv[2], 'w'), indent=1)
print('wrote', sys.argv[2], len(out))
