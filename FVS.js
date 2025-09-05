const fs = require('fs');
const { firefox } = require('playwright');

const START_ID = 'li_0xEEB9B76A'; // your chosen start point
const LAST_ID  = 'li_0xBA5ECEEA120E5611'; // optional: set to null to scrape until end

async function harvestIDs(page) {
  const listSelector = '.ReactVirtualized__Grid.ReactVirtualized__List';
  const entrySelector = '.native.entry';
  await page.waitForSelector(listSelector);

  const ids = [];
  let startFound = false;

  while (true) {
    const visibleIds = await page.$$eval(entrySelector, els => els.map(el => el.id));

    for (const vid of visibleIds) {
      if (!startFound) {
        if (vid === START_ID) {
          startFound = true;
          console.log(`🎯 Found start ID: ${START_ID} — beginning harvest`);
          ids.push(vid);
        }
      } else {
        if (!ids.includes(vid)) ids.push(vid);
      }
      if (LAST_ID && ids.includes(LAST_ID)) break;
    }

    if (LAST_ID && ids.includes(LAST_ID)) break;

    const listHandle = await page.$(listSelector);
    await listHandle.evaluate(el => el.scrollBy(0, el.clientHeight));
    await page.waitForTimeout(200);
  }

  return ids;
}

async function scrollToId(page, id) {
  const listSelector = '.ReactVirtualized__Grid.ReactVirtualized__List';
  const listHandle = await page.waitForSelector(listSelector, { timeout: 10000 }).catch(() => null);
  if (!listHandle) return false;

  // Scroll down
  for (let i = 0; i < 600; i++) {
    if (await page.$(`#${id} a`)) return true;
    await listHandle.evaluate(el => el.scrollBy(0, el.clientHeight));
    await page.waitForTimeout(200);
  }
  // Scroll up
  for (let i = 0; i < 600; i++) {
    if (await page.$(`#${id} a`)) return true;
    await listHandle.evaluate(el => el.scrollBy(0, -el.clientHeight));
    await page.waitForTimeout(200);
  }
  return false;
}

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  console.log("Opening FiveM natives page...");
  await page.goto('https://docs.fivem.net/natives/', { waitUntil: 'domcontentloaded' });
  console.log('Set Language=Lua, API Set=All, Type=Natives manually.');
  console.log('Press Enter here when ready...');
  await new Promise(res => process.stdin.once('data', res));

  const ids = await harvestIDs(page);
  console.log(`📦 Collected ${ids.length} IDs. Starting scrape...`);

  // Scroll back to top before scraping
  const listHandle = await page.$('.ReactVirtualized__Grid.ReactVirtualized__List');
  await listHandle.evaluate(el => el.scrollTo(0, 0));
  await page.waitForSelector('.native.entry', { timeout: 10000 });

  const results = [];

  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx];
    if (!(await scrollToId(page, id))) {
      console.warn(`⚠️ Could not render ${id} — skipping`);
      continue;
    }

    console.log(`➡️ ${idx + 1}/${ids.length} — Clicking ${id}`);
    await page.click(`#${id} a`);

    // Wait for the aside.show panel to appear
    const detailsSelector = 'div.app.lang-lua.apiset-all.type-natives aside.show .details';
    try {
      await page.waitForSelector(detailsSelector, { timeout: 20000 });
    } catch {
      console.warn(`❌ Details panel never appeared for ${id}`);
      continue;
    }

    // Extract all data from inside the details panel
    const data = await page.$eval(detailsSelector, el => {
      const getText = (selector) => el.querySelector(selector)?.innerText.trim() || '';
      const getList = (selector) => Array.from(el.querySelectorAll(selector)).map(e => e.innerText.trim());

      return {
        namespace: getText('.info .namespace'),
        apiset: getText('.info .apiset'),
        name: getText('h2'),
        hash: getText('.hash pre'),
        code: getText('.code pre'),
        parameters: getList('.parameters li'),
        returns: getList('.returns p'),
        description: getText('.desc')
      };
    });

    results.push(data);
    await page.waitForTimeout(500);
  }

  fs.writeFileSync('lua_natives_full.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved ${results.length} natives to lua_natives_full.json`);

  await browser.close();
})();
