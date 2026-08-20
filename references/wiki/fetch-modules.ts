// Fetch StS1 wiki.gg Lua data modules via api.php (index.php?action=raw is Cloudflare-challenged).
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const MODULES = ["Cards", "Relics", "Potions", "Events", "Enemies", "Powers", "Keywords", "Ascension"];

for (const m of MODULES) {
  const url = `https://slaythespire.wiki.gg/api.php?action=parse&page=Module:${m}/data&prop=wikitext&format=json&formatversion=2`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) {
    console.error(`${m}: HTTP ${res.status}`);
    continue;
  }
  const json: any = await res.json();
  const wikitext = json?.parse?.wikitext;
  if (typeof wikitext !== "string" || wikitext.length < 1000) {
    console.error(`${m}: unexpected response (${JSON.stringify(json).slice(0, 200)})`);
    continue;
  }
  await Bun.write(`${import.meta.dir}/${m}.lua`, wikitext);
  console.log(`${m}: ${wikitext.length} chars`);
  await Bun.sleep(500); // be polite
}
