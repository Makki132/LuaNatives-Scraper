# FiveM Natives Scraper (Lua / All / Natives)

⚠️ **Important:** The scraper window must remain open and visible while running.  
Minimizing the browser can pause rendering and break the scraping process due to how the FiveM docs site loads content.


This Node.js + Playwright script scrapes **all FiveM natives** from the official docs, extracting rich, structured data directly from the `<aside class="show">` details panel.

It captures:
- **Namespace**
- **API Set**
- **Native Name**
- **Hash**
- **Lua Code Example**
- **Parameters**
- **Returns**
- **Full Description**

The output is saved as a JSON file for easy use in other tools or projects.

---

## 📦 Requirements

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Playwright](https://playwright.dev/) with Firefox browser installed

Install Playwright and Firefox:
bash
npm install playwright
npx playwright install firefox

🚀 Usage
---
Clone this repository:
git clone https://github.com/Makki132/LuaNatives-Scraper.git
cd fivem-natives-scraper

Install dependencies:
npm install

Run the scraper:
node FVS.js (Full Version Scraper)

In the visible Firefox window:
    Set Language → Lua
    Set API Set → All
    Set Type → Natives
    Press Enter in your terminal to start scraping

Wait for completion:
    The script will click through every native, extract the details, and save them to:
      lua_natives_full.json

⚙️ Configuration
---
You can edit the following constants at the top of the script:
```js
    const START_ID = 'li_0xEEB9B76A'; // First native to scrape
    const LAST_ID  = null;            // Last native to scrape (null = scrape all)
````
📝 Output Format
---
- Example JSON entry:
```json{
  "namespace": "CFX",
  "apiset": "server",
  "name": "AddBlipForEntity",
  "hash": "0x30822554",
  "code": "-- ADD_BLIP_FOR_ENTITY\nlocal retval --[[ Blip ]] =\n\tAddBlipForEntity(\n\t\tentity --[[ Entity ]]\n\t)",
  "parameters": ["entity: The entity handle to create the blip."],
  "returns": ["A blip handle."],
  "description": "Create a blip that by default is red (enemy)..."
}
```

🛠 Troubleshooting
---
- Script stops with “Could not render ID” The docs site uses virtualized lists. The script scrolls to each ID before clicking, but if the site layout changes, update the selectors in scrollToId().
- Script hangs on first native Make sure you’ve set Lua / All / Natives in the browser before pressing Enter.
- Output file is empty Check that you have the correct START_ID and that the selectors in the script match the current site HTML.

📄 License
MIT License — feel free to use, modify, and share.


