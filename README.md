# FiveM Natives Scraper (Lua / All / Natives)

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
```bash
npm install playwright
npx playwright install firefox
