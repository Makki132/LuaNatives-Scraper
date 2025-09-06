const fs = require('fs');
const readline = require('readline');
const { firefox } = require('playwright');

const START_ID = 'li_0xEEB9B76A';
const LAST_ID  = null; // null = scrape all
const ID_FILE = 'ids.json';
const CHECKPOINT_FILE = 'progress.json';
const SAVE_INTERVAL = 50; // save every N entries

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim().toLowerCase());
  }));
}

async function harvestIDs(page) {
  const listSelector = '.ReactVirtualized__Grid.ReactVirtualized__List';
  const entrySelector = '.native.entry';
  await page.waitForSelector(listSelector);

  const ids = [];
  let startFound = false;
  let noNewCount = 0;

  while (true) {
    const visibleIds = await page.$$eval(entrySelector, els => els.map(el => el.id));
    let foundNew = false;

    for (const vid of visibleIds) {
      if (!startFound) {
        if (vid === START_ID) {
          startFound = true;
          console.log(`🎯 Found start ID: ${START_ID} — beginning harvest`);
          ids.push(vid);
          foundNew = true;
        }
      } else {
        if (!ids.includes(vid)) {
          ids.push(vid);
          foundNew = true;
        }
      }
      if (LAST_ID && ids.includes(LAST_ID)) break;
    }

    if (LAST_ID && ids.includes(LAST_ID)) break;

    if (!foundNew) {
      noNewCount++;
      if (noNewCount >= 20) {
        console.log(`✅ No new IDs after ${noNewCount} scrolls — assuming end of list.`);
        break;
      }
    } else {
      noNewCount = 0;
    }

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

  for (let i = 0; i < 600; i++) {
    if (await page.$(`#${id} a`)) return true;
    await listHandle.evaluate(el => el.scrollBy(0, el.clientHeight));
    await page.waitForTimeout(200);
  }
  for (let i = 0; i < 600; i++) {
    if (await page.$(`#${id} a`)) return true;
    await listHandle.evaluate(el => el.scrollBy(0, -el.clientHeight));
    await page.waitForTimeout(200);
  }
  return false;
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log(`🔄 Found checkpoint at index ${data.lastIndex + 1}`);
    return data;
  }
  return { lastIndex: -1, results: [] };
}

function saveCheckpoint(lastIndex, results) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex, results }, null, 2));
  console.log(`💾 Checkpoint saved at index ${lastIndex}`);
}

(async () => {
  const browser = await firefox.launch({ headless: false });
  const page = await browser.newPage();

  console.log("Opening FiveM natives page...");
  await page.goto('https://docs.fivem.net/natives/', { waitUntil: 'domcontentloaded' });
  console.log('Set Language=Lua, API Set=All, Type=Natives manually.');
  console.log('Press Enter here when ready...');
  await new Promise(res => process.stdin.once('data', res));

  let ids = [];
  if (fs.existsSync(ID_FILE)) {
    const useOld = await askQuestion(`Use existing ID list from ${ID_FILE}? (y/n): `);
    if (useOld === 'y') {
      ids = JSON.parse(fs.readFileSync(ID_FILE, 'utf8'));
      console.log(`📂 Loaded ${ids.length} IDs from file.`);
    } else {
      ids = await harvestIDs(page);
      fs.writeFileSync(ID_FILE, JSON.stringify(ids, null, 2));
      console.log(`✅ Harvested and saved ${ids.length} IDs to ${ID_FILE}`);
    }
  } else {
    ids = await harvestIDs(page);
    fs.writeFileSync(ID_FILE, JSON.stringify(ids, null, 2));
    console.log(`✅ Harvested and saved ${ids.length} IDs to ${ID_FILE}`);
  }

  let results = [];
  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const resume = await askQuestion(`Resume from checkpoint in ${CHECKPOINT_FILE}? (y/n): `);
    if (resume === 'y') {
      const checkpoint = loadCheckpoint();
      results = checkpoint.results;
      startIndex = checkpoint.lastIndex + 1;
    }
  }

  const listHandle = await page.$('.ReactVirtualized__Grid.ReactVirtualized__List');
  await listHandle.evaluate(el => el.scrollTo(0, 0));
  await page.waitForSelector('.native.entry', { timeout: 10000 });

  for (let idx = startIndex; idx < ids.length; idx++) {
    const id = ids[idx];
    if (!(await scrollToId(page, id))) {
      console.warn(`⚠️ Could not render ${id} — skipping`);
      continue;
    }

    console.log(`➡️ ${idx + 1}/${ids.length} — Clicking ${id}`);
    await page.click(`#${id} a`);

    const detailsSelector = 'div.app.lang-lua.apiset-all.type-natives aside.show .details';
    try {
      await page.waitForSelector(detailsSelector, { timeout: 20000 });
    } catch {
      console.warn(`❌ Details panel never appeared for ${id}`);
      continue;
    }

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

    if ((idx + 1) % SAVE_INTERVAL === 0) {
      saveCheckpoint(idx, results);
    }

    await page.waitForTimeout(500);
  }

  fs.writeFileSync('lua_natives_full.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved ${results.length} natives to lua_natives_full.json`);

  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log(`🗑️ Deleted checkpoint file (${CHECKPOINT_FILE}) — run completed successfully.`);
  }

  await browser.close();
})();
