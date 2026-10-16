/**
 * SMART WEB DISH & RESTAURANT MACRO ENGINE v4 (food-api.js)
 * Upgrades:
 * - Replaces manual "Custom Dish" entry with instant Web Consensus Macro Lookup
 * - Queries USDA FNDDS (Mixed/Restaurant Dishes) + Open Food Facts + Expanded Indian Restaurant/Street Food DB
 * - Automatically computes a "General Standard Macro" average when you search any random dish
 * - Parses natural quantities directly from search text (e.g. "2 vada pav", "300g chicken biryani", "3 oranges")
 */

(function () {
  const API_CONFIG_KEY = 'rahul_nutrition_api_cfg_v1';
  const BARCODE_VAULT_KEY = 'rahul_custom_barcodes_v1';

  const DEFAULT_BARCODE_DB = {
    "8902979029834": {
      name: "Garden Crispy Murukku",
      source: "Verified Barcode (8902979029834)",
      kcal100: 520, p100: 8.0, c100: 56.0, f100: 29.0,
      unitName: "1 small snack portion (25 g)", unitG: 25, defaultQty: 1
    }
  };

  // Comprehensive Indian Restaurant, Street Food, Home Dishes & Staples (Per 100g + Standard Serving Weight)
  const INDIAN_DISH_AND_STAPLE_DB = [
    { barcode: "8902979029834", name: "Garden Crispy Murukku (8902979029834)", source: "Barcode Vault", kcal100: 520, p100: 8.0, c100: 56.0, f100: 29.0, unitName: "1 snack portion (25 g)", unitG: 25, defaultQty: 1 },

    // Popular Indian Restaurant & Street Dishes (Non-Veg & Veg)
    { name: "Chicken Biryani / Dum Biryani (Restaurant Standard)", source: "Indian Restaurant Std", kcal100: 165, p100: 9.5, c100: 19.0, f100: 5.5, unitName: "1 regular plate (350 g)", unitG: 350, defaultQty: 1 },
    { name: "Mutton Biryani (Restaurant Standard)", source: "Indian Restaurant Std", kcal100: 185, p100: 9.0, c100: 18.5, f100: 8.2, unitName: "1 regular plate (350 g)", unitG: 350, defaultQty: 1 },
    { name: "Egg Biryani", source: "Indian Restaurant Std", kcal100: 155, p100: 6.8, c100: 20.0, f100: 5.2, unitName: "1 regular plate (320 g)", unitG: 320, defaultQty: 1 },
    { name: "Veg Pulao / Veg Biryani", source: "Indian Restaurant Std", kcal100: 140, p100: 3.2, c100: 22.5, f100: 4.2, unitName: "1 medium plate (250 g)", unitG: 250, defaultQty: 1 },
    { name: "Butter Chicken / Chicken Makhani", source: "Indian Restaurant Std", kcal100: 195, p100: 13.5, c100: 6.5, f100: 13.0, unitName: "1 restaurant bowl (250 g)", unitG: 250, defaultQty: 1 },
    { name: "Chicken Tikka Masala (Gravy)", source: "Indian Restaurant Std", kcal100: 175, p100: 14.0, c100: 7.0, f100: 10.2, unitName: "1 restaurant bowl (250 g)", unitG: 250, defaultQty: 1 },
    { name: "Chicken Tikka (Dry / Tandoori Roasted Boneless)", source: "Indian Restaurant Std", kcal100: 160, p100: 24.5, c100: 2.5, f100: 5.8, unitName: "1 plate / 6 pieces (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Tandoori Chicken (Bone-In Edible Portion)", source: "Indian Restaurant Std", kcal100: 195, p100: 25.4, c100: 2.2, f100: 9.2, unitName: "1 half tandoori edible (200 g)", unitG: 200, defaultQty: 1 },
    { name: "Home Chicken Curry / Chicken Rassa", source: "INDB Standard", kcal100: 160, p100: 14.0, c100: 4.0, f100: 9.5, unitName: "1 medium bowl (200 g)", unitG: 200, defaultQty: 1 },
    { name: "Chicken Shawarma Roll (Rumali/Kububoos with Mayo)", source: "Street Food Std", kcal100: 235, p100: 13.0, c100: 22.0, f100: 10.5, unitName: "1 standard roll (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Chicken Fried Rice (Indo-Chinese)", source: "Indian Restaurant Std", kcal100: 170, p100: 7.5, c100: 23.0, f100: 5.2, unitName: "1 regular plate (300 g)", unitG: 300, defaultQty: 1 },
    { name: "Chicken Hakka Noodles / Chowmein", source: "Indian Restaurant Std", kcal100: 165, p100: 7.0, c100: 22.0, f100: 5.5, unitName: "1 regular plate (280 g)", unitG: 280, defaultQty: 1 },
    { name: "Chilli Chicken (Dry / Semi-Gravy)", source: "Indian Restaurant Std", kcal100: 190, p100: 15.0, c100: 10.0, f100: 10.0, unitName: "1 medium portion (200 g)", unitG: 200, defaultQty: 1 },
    { name: "Paneer Butter Masala / Paneer Tikka Masala", source: "Indian Restaurant Std", kcal100: 215, p100: 9.5, c100: 8.5, f100: 16.0, unitName: "1 medium bowl (220 g)", unitG: 220, defaultQty: 1 },
    { name: "Palak Paneer / Matar Paneer", source: "INDB Standard", kcal100: 165, p100: 8.8, c100: 7.2, f100: 11.5, unitName: "1 medium bowl (200 g)", unitG: 200, defaultQty: 1 },
    { name: "Paneer Bhurji", source: "INDB Standard", kcal100: 210, p100: 13.5, c100: 5.5, f100: 15.0, unitName: "1 medium bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Dal Makhani (Restaurant Style)", source: "Indian Restaurant Std", kcal100: 150, p100: 5.8, c100: 15.5, f100: 7.2, unitName: "1 medium bowl (200 g)", unitG: 200, defaultQty: 1 },
    { name: "Dal Tadka / Dal Fry (Yellow Toor/Moong)", source: "INDB Standard", kcal100: 123, p100: 5.5, c100: 16.3, f100: 4.0, unitName: "1 medium bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Misal Pav (Complete Plate with Farsan & 2 Pav)", source: "Maharashtrian Std", kcal100: 185, p100: 6.2, c100: 25.0, f100: 6.8, unitName: "1 full plate with 2 pav (320 g)", unitG: 320, defaultQty: 1 },
    { name: "Vada Pav (Complete with Chutney)", source: "Street Food Std", kcal100: 260, p100: 5.5, c100: 36.0, f100: 10.5, unitName: "1 vada pav (115 g)", unitG: 115, defaultQty: 1 },
    { name: "Pav Bhaji (Bhaji with Butter + 2 Pav)", source: "Street Food Std", kcal100: 190, p100: 4.8, c100: 26.0, f100: 7.5, unitName: "1 plate with 2 buttered pav (300 g)", unitG: 300, defaultQty: 1 },
    { name: "Samosa (Fried Potato Stuffed)", source: "Street Food Std", kcal100: 295, p100: 4.8, c100: 32.0, f100: 16.5, unitName: "1 medium samosa (85 g)", unitG: 85, defaultQty: 1 },
    { name: "Masala Dosa (With Potato Bhaji)", source: "South Indian Std", kcal100: 195, p100: 4.2, c100: 31.0, f100: 6.0, unitName: "1 full masala dosa (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Plain Dosa", source: "INDB Standard", kcal100: 188, p100: 4.5, c100: 32.0, f100: 4.6, unitName: "1 medium dosa (90 g)", unitG: 90, defaultQty: 1 },
    { name: "Idli Sambar (Steamed Idli)", source: "INDB Standard", kcal100: 128, p100: 3.9, c100: 26.2, f100: 0.6, unitName: "1 medium idli (50 g)", unitG: 50, defaultQty: 2 },
    { name: "Medu Vada (Fried Lentil Donut)", source: "South Indian Std", kcal100: 285, p100: 7.5, c100: 31.0, f100: 14.5, unitName: "1 medu vada (55 g)", unitG: 55, defaultQty: 2 },
    { name: "Uttapam (Onion / Tomato)", source: "South Indian Std", kcal100: 170, p100: 4.8, c100: 28.0, f100: 4.2, unitName: "1 medium uttapam (140 g)", unitG: 140, defaultQty: 1 },
    { name: "Kanda Poha (With Peanuts)", source: "INDB Standard", kcal100: 150, p100: 3.1, c100: 25.5, f100: 3.9, unitName: "1 plate (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Sabudana Khichdi (With Peanuts)", source: "Maharashtrian Std", kcal100: 215, p100: 3.5, c100: 36.0, f100: 6.5, unitName: "1 plate (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Aloo Paratha (Without Extra Butter)", source: "INDB Standard", kcal100: 245, p100: 5.8, c100: 39.0, f100: 7.2, unitName: "1 medium paratha (100 g)", unitG: 100, defaultQty: 1 },
    { name: "Butter Naan / Garlic Naan", source: "Indian Restaurant Std", kcal100: 310, p100: 8.5, c100: 50.0, f100: 8.5, unitName: "1 restaurant naan (90 g)", unitG: 90, defaultQty: 1 },
    { name: "Tandoori Roti (Whole Wheat)", source: "Indian Restaurant Std", kcal100: 275, p100: 8.8, c100: 54.0, f100: 2.5, unitName: "1 tandoori roti (50 g)", unitG: 50, defaultQty: 2 },
    { name: "Whole Wheat Chapati / Phulka (No Ghee)", source: "INDB Standard", kcal100: 285, p100: 9.4, c100: 57.1, f100: 2.2, unitName: "1 medium chapati (35 g)", unitG: 35, defaultQty: 2 },
    { name: "Jowar / Bajra Bhakri", source: "INDB Standard", kcal100: 266, p100: 7.8, c100: 52.5, f100: 2.5, unitName: "1 medium bhakri (65 g)", unitG: 65, defaultQty: 1 },
    { name: "Steamed White Rice / Jeera Rice (Cooked)", source: "INDB Standard", kcal100: 135, p100: 2.7, c100: 28.2, f100: 1.0, unitName: "1 medium bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Dal Khichdi (Rice & Lentil Mash with Ghee)", source: "INDB Standard", kcal100: 135, p100: 4.5, c100: 21.0, f100: 3.6, unitName: "1 bowl (250 g)", unitG: 250, defaultQty: 1 },
    { name: "Maggi Masala Noodles (Prepared)", source: "Label Standard", kcal100: 140, p100: 3.3, c100: 21.5, f100: 4.6, unitName: "1 cooked pack (210 g)", unitG: 210, defaultQty: 1 },
    { name: "Egg Omelette / Egg Bhurji (2 Eggs + 1 tsp Oil)", source: "INDB Standard", kcal100: 175, p100: 11.5, c100: 1.5, f100: 13.5, unitName: "1 serving (110 g)", unitG: 110, defaultQty: 1 },
    { name: "Boiled Whole Egg", source: "ICMR-NIN", kcal100: 143, p100: 12.6, c100: 0.7, f100: 9.9, unitName: "1 large egg (50 g)", unitG: 50, defaultQty: 3 },
    { name: "Egg White Only, Boiled", source: "ICMR-NIN", kcal100: 52, p100: 10.9, c100: 0.7, f100: 0.2, unitName: "1 large egg white (33 g)", unitG: 33, defaultQty: 3 },
    { name: "Chicken Breast, Boiled/Grilled", source: "USDA/ICMR", kcal100: 165, p100: 31.0, c100: 0.0, f100: 3.6, unitName: "1 breast fillet (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Surmai / Fish Tawa Fry", source: "Indian Coastal Std", kcal100: 185, p100: 21.0, c100: 3.5, f100: 9.5, unitName: "1 medium fish slice (120 g)", unitG: 120, defaultQty: 1 },

    // Nuts, Fruits & Dairy
    { name: "Almonds (Badam), Raw", source: "ICMR-NIN", kcal100: 589, p100: 20.8, c100: 10.5, f100: 52.5, unitName: "1 almond (1.2 g)", unitG: 1.2, defaultQty: 4 },
    { name: "Walnuts (Akhrot), Halves", source: "ICMR-NIN", kcal100: 687, p100: 15.6, c100: 11.0, f100: 64.5, unitName: "1 walnut half (2.5 g)", unitG: 2.5, defaultQty: 4 },
    { name: "Cashews (Kaju), Whole", source: "ICMR-NIN", kcal100: 582, p100: 18.8, c100: 29.5, f100: 45.0, unitName: "1 cashew (1.6 g)", unitG: 1.6, defaultQty: 5 },
    { name: "Orange (Santra), Peeled", source: "ICMR-NIN", kcal100: 47, p100: 0.9, c100: 11.8, f100: 0.1, unitName: "1 medium orange (130 g)", unitG: 130, defaultQty: 1 },
    { name: "Banana, Ripe Medium", source: "ICMR-NIN", kcal100: 89, p100: 1.1, c100: 22.8, f100: 0.3, unitName: "1 medium banana (115 g)", unitG: 115, defaultQty: 1 },
    { name: "Apple, Fresh Medium", source: "ICMR-NIN", kcal100: 52, p100: 0.3, c100: 13.8, f100: 0.2, unitName: "1 medium apple (160 g)", unitG: 160, defaultQty: 1 },
    { name: "Curd / Dahi (Toned Milk)", source: "ICMR-NIN", kcal100: 60, p100: 3.5, c100: 4.7, f100: 3.0, unitName: "1 medium bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Paneer (Raw / Sautéed)", source: "ICMR-NIN", kcal100: 265, p100: 18.3, c100: 3.4, f100: 20.1, unitName: "1 standard portion (100 g)", unitG: 100, defaultQty: 1 },
    { name: "Whey Protein Scoop", source: "Label", kcal100: 400, p100: 80.0, c100: 10.0, f100: 5.0, unitName: "1 scoop (30 g)", unitG: 30, defaultQty: 1 }
  ];

  const NATURAL_UNIT_RULES = [
    { regex: /\bbiryani|pulao|fried rice|noodles|chowmein|misal|pav bhaji|khichdi/i, unitName: "1 regular plate (300 g)", unitG: 300, defaultQty: 1 },
    { regex: /\bcurry|masala|makhani|korma|gravy|dal|sambar|kadhi|palak|chole|rajma/i, unitName: "1 medium bowl (200 g)", unitG: 200, defaultQty: 1 },
    { regex: /\bshawarma|roll|wrap|frankie|burrito|sub\b/i, unitName: "1 standard roll/wrap (180 g)", unitG: 180, defaultQty: 1 },
    { regex: /\bburger|sandwich/i, unitName: "1 standard burger/sandwich (170 g)", unitG: 170, defaultQty: 1 },
    { regex: /\bpizza/i, unitName: "1 medium slice (100 g)", unitG: 100, defaultQty: 2 },
    { regex: /\bvada pav/i, unitName: "1 vada pav (115 g)", unitG: 115, defaultQty: 1 },
    { regex: /\bsamosa|kachori/i, unitName: "1 piece (85 g)", unitG: 85, defaultQty: 1 },
    { regex: /\bmurukku|chakli|bhujia|sev|namkeen|chips|chivda/i, unitName: "1 snack portion (25 g)", unitG: 25, defaultQty: 1 },
    { regex: /\balmond/i, unitName: "1 almond (1.2 g)", unitG: 1.2, defaultQty: 4 },
    { regex: /\bwalnut/i, unitName: "1 walnut half (2.5 g)", unitG: 2.5, defaultQty: 4 },
    { regex: /\bcashew/i, unitName: "1 cashew (1.6 g)", unitG: 1.6, defaultQty: 5 },
    { regex: /\borange|mosambi|mandarin/i, unitName: "1 medium fruit (130 g)", unitG: 130, defaultQty: 1 },
    { regex: /\bbanana/i, unitName: "1 medium banana (115 g)", unitG: 115, defaultQty: 1 },
    { regex: /\bapple\b/i, unitName: "1 medium apple (160 g)", unitG: 160, defaultQty: 1 },
    { regex: /\begg white/i, unitName: "1 large egg white (33 g)", unitG: 33, defaultQty: 3 },
    { regex: /\begg\b/i, unitName: "1 large egg (50 g)", unitG: 50, defaultQty: 2 },
    { regex: /\bchapati|roti|phulka/i, unitName: "1 medium roti (35 g)", unitG: 35, defaultQty: 2 },
    { regex: /\bnaan|paratha|kulcha|bhakri/i, unitName: "1 medium piece (85 g)", unitG: 85, defaultQty: 1 },
    { regex: /\bidli\b/i, unitName: "1 medium idli (50 g)", unitG: 50, defaultQty: 2 },
    { regex: /\bdosa|uttapam/i, unitName: "1 medium dosa (130 g)", unitG: 130, defaultQty: 1 }
  ];

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(API_CONFIG_KEY));
      if (saved && saved.usdaKey) return saved;
    } catch (e) {}
    return { usdaKey: 'DEMO_KEY' };
  }

  function loadBarcodeVault() {
    try {
      const saved = JSON.parse(localStorage.getItem(BARCODE_VAULT_KEY));
      if (saved) return { ...DEFAULT_BARCODE_DB, ...saved };
    } catch (e) {}
    return { ...DEFAULT_BARCODE_DB };
  }

  function saveBarcodeVault(vault) {
    localStorage.setItem(BARCODE_VAULT_KEY, JSON.stringify(vault));
  }

  let apiConfig = loadConfig();
  let barcodeVault = loadBarcodeVault();
  let currentResults = [];
  let selectedFood = null;
  let cameraStream = null;
  let parsedUserQty = null;

  function inferNaturalUnit(foodName, apiServingG, apiServingText) {
    for (const rule of NATURAL_UNIT_RULES) {
      if (rule.regex.test(foodName)) {
        return { unitName: rule.unitName, unitG: rule.unitG, defaultQty: rule.defaultQty };
      }
    }
    if (apiServingG && apiServingG > 0 && apiServingG !== 100) {
      const label = apiServingText ? `${apiServingText} (${apiServingG} g)` : `1 standard serving (${apiServingG} g)`;
      return { unitName: label, unitG: apiServingG, defaultQty: 1 };
    }
    return { unitName: "1 standard serving / bowl (200 g)", unitG: 200, defaultQty: 1 };
  }

  // Extract leading quantity or gram weight if user types e.g. "2 vada pav" or "250g chicken biryani"
  function parseNaturalQuery(rawInput) {
    let text = rawInput.trim();
    if (/^\d{8,14}$/.test(text)) {
      return { cleanQuery: text, qty: null, mode: 'barcode' };
    }
    const gramMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:g|gm|gms|grams|ml)\s+(.+)$/i);
    if (gramMatch) {
      return { cleanQuery: gramMatch[2].trim(), qty: parseFloat(gramMatch[1]), mode: 'grams' };
    }
    const countMatch = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i);
    if (countMatch) {
      return { cleanQuery: countMatch[2].trim(), qty: parseFloat(countMatch[1]), mode: 'units' };
    }
    return { cleanQuery: text, qty: null, mode: 'default' };
  }

  function injectFoodSearchEngine() {
    const presetSelect = document.getElementById('presetFoodSelect');
    if (!presetSelect) return;
    const hostCard = presetSelect.closest('section');
    if (!hostCard) return;

    // Hide the old manual "Create Custom Dish / Restaurant Entry" details box so everything uses automatic web lookup
    const oldCustomDetails = document.getElementById('custName')?.closest('details');
    if (oldCustomDetails) {
      oldCustomDetails.classList.add('hidden');
    }

    const apiPanel = document.createElement('div');
    apiPanel.className = 'mt-4 pt-4 border-t border-white/10 space-y-3';
    apiPanel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-extrabold text-emerald-400 flex items-center gap-2">
            <span>⚡ Smart Web Dish, Restaurant & Barcode Auto-Lookup</span>
            <span class="mono text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">Auto Standard Macros</span>
          </h3>
          <p class="text-[11px] text-slate-400">Type any random dish (e.g. <strong>"Butter Chicken"</strong>, <strong>"2 Vada Pav"</strong>, <strong>"250g Chicken Biryani"</strong>) or scan a barcode—it fetches and averages the general standard macros automatically.</p>
        </div>
      </div>

      <!-- Unified Search Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div class="sm:col-span-8">
          <input type="text" id="apiSearchInput"
            placeholder="Type any dish (e.g. 'Chicken Shawarma', '2 Masala Dosa', 'Paneer Tikka', or Barcode)..."
            class="w-full text-xs"
            onkeydown="if(event.key==='Enter') executeUnifiedFoodSearch()" />
        </div>
        <div class="sm:col-span-2">
          <button onclick="executeUnifiedFoodSearch()" id="apiSearchBtn"
            class="w-full btn-neon-emerald text-white font-bold text-xs py-2.5 rounded-xl">
            🔍 Auto-Fetch
          </button>
        </div>
        <div class="sm:col-span-2">
          <button onclick="toggleCameraScanner()"
            class="w-full pill-glow hover:bg-white/10 text-cyan-300 font-bold text-xs py-2.5 rounded-xl">
            📷 Barcode
          </button>
        </div>
      </div>

      <!-- Live Camera Barcode Scanner Box -->
      <div id="cameraScannerBox" class="hidden bg-slate-950 border border-cyan-800 rounded-xl p-3 space-y-2 text-center">
        <div class="text-xs text-cyan-300 font-semibold">Point camera at packet barcode (EAN-13 / UPC)</div>
        <video id="barcodeVideo" class="w-full max-h-48 rounded bg-black mx-auto" autoplay playsinline muted></video>
        <button onclick="stopCameraScanner()" class="text-xs bg-rose-900/70 text-rose-200 px-3 py-1 rounded">Close Camera</button>
      </div>

      <!-- Status & Results List -->
      <div id="apiSearchStatus" class="text-[11px] text-slate-400 hidden"></div>
      <div id="apiResultsContainer" class="max-h-60 overflow-y-auto divide-y divide-white/5 bg-slate-950/80 border border-white/10 rounded-xl hidden"></div>

      <!-- Quantity / Piece & Exact Gram Scaler Panel -->
      <div id="apiScalerPanel" class="hidden pill-glow border border-emerald-500/40 rounded-2xl p-4 space-y-3">
        <div class="flex justify-between items-start gap-2">
          <div>
            <div class="text-xs font-extrabold text-white" id="scalerFoodTitle">Selected Dish</div>
            <div class="mono text-[11px] text-emerald-300 mt-0.5" id="scalerPer100Info">Per 100g: -- kcal</div>
          </div>
          <button onclick="closeScalerPanel()" class="text-xs text-slate-400 hover:text-white">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div class="sm:col-span-3">
            <label class="block text-[11px] text-emerald-300 font-bold mb-1" id="scalerQtyLabel">Quantity</label>
            <input type="number" id="scalerQtyInput" value="1" min="0.25" step="0.5"
              class="w-full text-xs font-bold text-emerald-300 mono" oninput="recalcScaledMacros()" />
          </div>
          <div class="sm:col-span-5">
            <label class="block text-[11px] text-slate-400 mb-1">Portion / Serving Size</label>
            <select id="scalerUnitSelect" class="w-full text-xs" onchange="onUnitModeChange()"></select>
          </div>
          <div class="sm:col-span-4">
            <label class="block text-[11px] text-slate-400 mb-1">Restaurant / Extra Oil Modifier</label>
            <select id="scalerOilInput" class="w-full text-xs" onchange="recalcScaledMacros()">
              <option value="0">Standard Prep (No extra oil)</option>
              <option value="1">+1 tsp Oil/Butter (+45 kcal, 5g F)</option>
              <option value="2">+2 tsp Heavy Restaurant Oil (+90 kcal, 10g F)</option>
              <option value="3">+1 tbsp Extra Ghee/Butter (+135 kcal, 15g F)</option>
            </select>
          </div>
        </div>

        <!-- Live Computed Weight & Macro Preview -->
        <div class="bg-black/50 border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs text-slate-300">
            Logging: <strong class="mono text-cyan-300" id="scPortionSummary">1 serving</strong>
          </div>
          <div class="flex gap-4 text-center mono">
            <div><span class="text-[10px] text-slate-400 block">Calories</span><span class="text-xs font-bold text-white" id="scKcal">0 kcal</span></div>
            <div><span class="text-[10px] text-slate-400 block">Protein</span><span class="text-xs font-bold text-emerald-400" id="scP">0 g</span></div>
            <div><span class="text-[10px] text-slate-400 block">Carbs</span><span class="text-xs font-bold text-amber-400" id="scC">0 g</span></div>
            <div><span class="text-[10px] text-slate-400 block">Fat</span><span class="text-xs font-bold text-purple-400" id="scF">0 g</span></div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <button onclick="commitScaledFoodToLog(false)" class="flex-1 btn-neon-blue text-white text-xs font-bold py-2.5 rounded-xl">
            + Log Dish to Active Shift Day
          </button>
          <button onclick="commitScaledFoodToLog(true)" class="pill-glow hover:bg-white/10 text-emerald-300 text-xs font-bold px-3.5 py-2.5 rounded-xl">
            ★ Log & Pin to Presets
          </button>
        </div>
      </div>

      <!-- Missing Barcode Quick-Registration Drawer (Only if an unindexed barcode is scanned) -->
      <div id="registerBarcodeDrawer" class="hidden pill-glow border border-amber-500/40 rounded-xl p-3.5 space-y-3">
        <div class="flex justify-between items-center">
          <div class="text-xs font-bold text-amber-300">
            Unindexed Barcode (<span id="regBarcodeNum"></span>) — Type Packet Name to Auto-Fetch Web Macros:
          </div>
          <button onclick="document.getElementById('registerBarcodeDrawer').classList.add('hidden')" class="text-xs text-slate-400">✕</button>
        </div>
        <div class="flex gap-2">
          <input type="text" id="regProdNameLookup" placeholder="Type product/dish name (e.g. 'Banana Chips' or 'Protein Bar')..." class="text-xs flex-1" />
          <button onclick="lookupBarcodeByNameFallback()" class="btn-neon-emerald text-white text-xs font-bold px-4 py-2 rounded-xl">
            Auto-Fetch Macros & Link Barcode
          </button>
        </div>
      </div>
    `;

    hostCard.appendChild(apiPanel);
  }

  // Camera Barcode Scanner
  window.toggleCameraScanner = async function () {
    const box = document.getElementById('cameraScannerBox');
    if (!box.classList.contains('hidden')) {
      stopCameraScanner();
      return;
    }
    if (!('BarcodeDetector' in window)) {
      alert("Camera barcode detection isn't supported in this browser tab. Type the barcode or dish name directly!");
      return;
    }
    try {
      box.classList.remove('hidden');
      const video = document.getElementById('barcodeVideo');
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = cameraStream;

      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const scanLoop = async () => {
        if (!cameraStream) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const rawCode = codes[0].rawValue;
            stopCameraScanner();
            document.getElementById('apiSearchInput').value = rawCode;
            executeUnifiedFoodSearch();
            return;
          }
        } catch (e) {}
        requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
    } catch (err) {
      alert("Camera unavailable. Please type the dish name or barcode.");
      stopCameraScanner();
    }
  };

  window.stopCameraScanner = function () {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    document.getElementById('cameraScannerBox')?.classList.add('hidden');
  };

  // If a barcode isn't in OpenFoodFacts, user types the product name and we fetch web macros & bind the barcode automatically
  window.lookupBarcodeByNameFallback = async function () {
    const code = document.getElementById('regBarcodeNum').textContent.trim();
    const dishName = document.getElementById('regProdNameLookup').value.trim();
    if (!dishName) return;
    document.getElementById('registerBarcodeDrawer').classList.add('hidden');
    document.getElementById('apiSearchInput').value = dishName;
    await executeUnifiedFoodSearch();
    if (currentResults.length > 0) {
      const topHit = { ...currentResults[0], name: `${dishName} (${code})`, source: `Linked Barcode (${code})` };
      barcodeVault[code] = topHit;
      saveBarcodeVault(barcodeVault);
      currentResults.unshift(topHit);
      renderSearchResults(dishName, false);
      selectApiFoodItem(0);
    }
  };

  function searchLocalIndianDB(query) {
    const clean = query.trim();
    const hits = [];
    if (barcodeVault[clean]) hits.push(barcodeVault[clean]);

    const tokens = clean.toLowerCase().split(/\s+/).filter(Boolean);
    INDIAN_DISH_AND_STAPLE_DB.forEach(item => {
      const hay = (item.name + " " + (item.barcode || "")).toLowerCase();
      if (tokens.every(t => hay.includes(t))) {
        if (!hits.some(h => h.name === item.name)) hits.push(item);
      }
    });
    return hits;
  }

  // Query USDA FoodData Central (Includes Survey FNDDS Mixed/Restaurant Dishes)
  async function searchUsdaFdc(query) {
    const key = encodeURIComponent(apiConfig.usdaKey || 'DEMO_KEY');
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${encodeURIComponent(query)}&pageSize=8&dataType=Survey%20(FNDDS),SR%20Legacy,Foundation`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.foods || []).map(f => {
      const nutrients = f.foodNutrients || [];
      const getVal = (ids, nums) => {
        const hit = nutrients.find(n => ids.includes(n.nutrientId) || nums.includes(String(n.nutrientNumber)));
        return hit ? +(Number(hit.value || 0)).toFixed(1) : 0;
      };

      const kcal100 = Math.round(getVal([1008, 2047, 2048], ['208', '957', '958']));
      const p100 = getVal([1003], ['203']);
      const f100 = getVal([1004], ['204']);
      const c100 = getVal([1005], ['205']);
      const inferred = inferNaturalUnit(f.description, Number(f.servingSize) || null, f.householdServingFullText || null);

      return {
        name: f.description,
        source: 'USDA Standard',
        kcal100, p100, c100, f100,
        unitName: inferred.unitName,
        unitG: inferred.unitG,
        defaultQty: inferred.defaultQty
      };
    }).filter(item => item.kcal100 > 0 && item.kcal100 < 950);
  }

  // Query Open Food Facts API
  async function searchOpenFoodFacts(query) {
    const clean = query.trim();
    if (/^\d{8,14}$/.test(clean)) {
      const bUrl = `https://world.openfoodfacts.org/api/v2/product/${clean}.json`;
      const res = await fetch(bUrl);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const n = p.nutriments || {};
        const kcal100 = Math.round(Number(n['energy-kcal_100g'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0)));
        const p100 = +(Number(n.proteins_100g || 0)).toFixed(1);
        const c100 = +(Number(n.carbohydrates_100g || 0)).toFixed(1);
        const f100 = +(Number(n.fat_100g || 0)).toFixed(1);

        if (kcal100 > 0 || p100 > 0) {
          const fullName = `${p.product_name || 'Barcode Product'} ${p.brands ? '(' + p.brands + ')' : ''}`;
          const inferred = inferNaturalUnit(fullName, Number(p.serving_quantity) || null, p.serving_size || null);
          return [{
            name: fullName,
            source: `OpenFoodFacts (${clean})`,
            kcal100, p100, c100, f100,
            unitName: inferred.unitName,
            unitG: inferred.unitG,
            defaultQty: inferred.defaultQty
          }];
        }
      }
      return [];
    }

    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(clean)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments,serving_quantity,serving_size`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.products || []).map(p => {
      const n = p.nutriments || {};
      const kcal = Number(n['energy-kcal_100g'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0));
      const fullName = `${p.product_name || 'Dish'}${p.brands ? ' — ' + p.brands : ''}`;
      const inferred = inferNaturalUnit(fullName, Number(p.serving_quantity) || null, p.serving_size || null);
      return {
        name: fullName,
        source: 'Web Nutrition DB',
        kcal100: Math.round(kcal),
        p100: +(Number(n.proteins_100g || 0)).toFixed(1),
        c100: +(Number(n.carbohydrates_100g || 0)).toFixed(1),
        f100: +(Number(n.fat_100g || 0)).toFixed(1),
        unitName: inferred.unitName,
        unitG: inferred.unitG,
        defaultQty: inferred.defaultQty
      };
    }).filter(x => x.name && x.kcal100 > 10 && x.kcal100 <= 900);
  }

  // Synthesize a single "General Standard Macro" consensus row across top matches
  function buildConsensusStandardDish(cleanQuery, resultsList) {
    if (resultsList.length < 2) return null;
    const sample = resultsList.slice(0, 6);
    const avg = (key) => +(sample.reduce((s, x) => s + (Number(x[key]) || 0), 0) / sample.length).toFixed(1);
    const inferred = inferNaturalUnit(cleanQuery, sample[0].unitG, null);
    const titleCase = cleanQuery.replace(/\b\w/g, c => c.toUpperCase());

    return {
      name: `${titleCase} (General Standard Macro)`,
      source: `Web Consensus (${sample.length} sources)`,
      kcal100: Math.round(avg('kcal100')),
      p100: avg('p100'),
      c100: avg('c100'),
      f100: avg('f100'),
      unitName: inferred.unitName,
      unitG: inferred.unitG,
      defaultQty: inferred.defaultQty,
      isConsensus: true
    };
  }

  window.executeUnifiedFoodSearch = async function () {
    const rawInput = document.getElementById('apiSearchInput').value.trim();
    const statusEl = document.getElementById('apiSearchStatus');
    const resultsEl = document.getElementById('apiResultsContainer');
    const regDrawer = document.getElementById('registerBarcodeDrawer');
    const btn = document.getElementById('apiSearchBtn');

    if (!rawInput) return;

    const parsed = parseNaturalQuery(rawInput);
    parsedUserQty = parsed;
    const query = parsed.cleanQuery;
    const isBarcode = parsed.mode === 'barcode';

    regDrawer.classList.add('hidden');
    statusEl.classList.remove('hidden');
    statusEl.textContent = isBarcode
      ? `Looking up barcode ${query}...`
      : `Fetching general standard macros for "${query}" across Indian & Web databases...`;
    resultsEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Fetching...';

    currentResults = [];

    try {
      // 1. Check Indian Restaurant & Staple Reference DB first
      const localHits = searchLocalIndianDB(query);
      currentResults.push(...localHits);

      // 2. Query USDA FNDDS (Mixed Dishes) & OpenFoodFacts in parallel
      if (isBarcode) {
        const offBarcode = await searchOpenFoodFacts(query).catch(() => []);
        currentResults.push(...offBarcode);
      } else {
        const [usdaHits, offHits] = await Promise.all([
          searchUsdaFdc(query).catch(() => []),
          searchOpenFoodFacts(query).catch(() => [])
        ]);
        currentResults.push(...usdaHits, ...offHits);
      }

      // 3. If user searched a general dish and we have multiple web hits but no exact local match, prepend a Web Consensus Standard row
      if (!isBarcode && localHits.length === 0 && currentResults.length >= 2) {
        const consensus = buildConsensusStandardDish(query, currentResults);
        if (consensus) currentResults.unshift(consensus);
      }

      renderSearchResults(query, isBarcode);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 Auto-Fetch';
    }
  };

  function renderSearchResults(query, isBarcode) {
    const statusEl = document.getElementById('apiSearchStatus');
    const resultsEl = document.getElementById('apiResultsContainer');
    const regDrawer = document.getElementById('registerBarcodeDrawer');

    if (currentResults.length === 0) {
      if (isBarcode) {
        statusEl.textContent = `Barcode ${query} isn't indexed by number yet. Type the food/snack name below to auto-fetch its standard macros:`;
        document.getElementById('regBarcodeNum').textContent = query;
        regDrawer.classList.remove('hidden');
      } else {
        statusEl.textContent = `No exact match for "${query}". Try a simpler dish name (e.g. "Chicken Curry", "Fried Rice", "Paneer", "Biryani").`;
      }
      resultsEl.classList.add('hidden');
      return;
    }

    statusEl.textContent = `Standard macro match ready for "${query}" (top match auto-selected below — or click any variant):`;
    resultsEl.classList.remove('hidden');

    resultsEl.innerHTML = currentResults.map((item, idx) => {
      const servingKcal = Math.round(item.kcal100 * (item.unitG / 100));
      return `
        <div onclick="selectApiFoodItem(${idx})"
          class="p-2.5 hover:bg-white/5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 transition-colors ${idx === 0 ? 'bg-emerald-950/25' : ''}">
          <div>
            <span class="text-xs font-bold text-white">${item.name}</span>
            <span class="mono text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-white/10">${item.source}</span>
            <div class="text-[11px] text-emerald-400 mt-0.5">Standard Serving: ${item.unitName} ≈ <strong>${servingKcal} kcal</strong></div>
          </div>
          <div class="mono text-[11px] text-slate-300 shrink-0">
            <span class="text-white font-bold">${item.kcal100} kcal</span> •
            <span class="text-emerald-400">${item.p100}g P</span> •
            <span class="text-amber-300">${item.c100}g C</span> •
            <span class="text-purple-300">${item.f100}g F</span>
            <span class="text-slate-500">/100g</span>
          </div>
        </div>
      `;
    }).join('');

    // Automatically open the top standard macro match immediately so logging takes 1 click
    selectApiFoodItem(0);
  }

  window.selectApiFoodItem = function (idx) {
    selectedFood = currentResults[idx];
    if (!selectedFood) return;

    document.getElementById('apiScalerPanel').classList.remove('hidden');
    document.getElementById('scalerFoodTitle').textContent = `${selectedFood.name}`;
    document.getElementById('scalerPer100Info').textContent =
      `Standard Base per 100g: ${selectedFood.kcal100} kcal | Protein: ${selectedFood.p100}g | Carbs: ${selectedFood.c100}g | Fat: ${selectedFood.f100}g`;

    const unitSel = document.getElementById('scalerUnitSelect');
    unitSel.innerHTML = `
      <option value="${selectedFood.unitG}" data-label="${selectedFood.unitName}">${selectedFood.unitName}</option>
      <option value="1" data-label="g">Exact Weight in Grams (1 g)</option>
      <option value="300" data-label="full restaurant plate (300 g)">1 Full Restaurant Plate (300 g)</option>
      <option value="200" data-label="medium bowl (200 g)">1 Medium Bowl (200 g)</option>
      <option value="150" data-label="small katori / bowl (150 g)">1 Small Katori / Bowl (150 g)</option>
      <option value="25" data-label="small snack portion (25 g)">1 Small Snack Portion (25 g)</option>
    `;

    // Apply natural quantity if the user typed e.g. "2 vada pav" or "250g biryani"
    if (parsedUserQty && parsedUserQty.mode === 'grams' && parsedUserQty.qty) {
      unitSel.selectedIndex = 1; // 1g mode
      document.getElementById('scalerQtyInput').value = parsedUserQty.qty;
      document.getElementById('scalerQtyLabel').textContent = "Weight (g)";
    } else if (parsedUserQty && parsedUserQty.mode === 'units' && parsedUserQty.qty) {
      unitSel.selectedIndex = 0; // natural unit mode
      document.getElementById('scalerQtyInput').value = parsedUserQty.qty;
      document.getElementById('scalerQtyLabel').textContent = "Quantity";
    } else {
      unitSel.selectedIndex = 0;
      document.getElementById('scalerQtyInput').value = selectedFood.defaultQty || 1;
      document.getElementById('scalerQtyLabel').textContent = "Quantity";
    }

    document.getElementById('scalerOilInput').value = "0";
    recalcScaledMacros();
  };

  window.onUnitModeChange = function () {
    const unitSel = document.getElementById('scalerUnitSelect');
    const unitWeight = parseFloat(unitSel.value);
    const qtyInput = document.getElementById('scalerQtyInput');
    const qtyLabel = document.getElementById('scalerQtyLabel');

    if (unitWeight === 1) {
      qtyInput.value = 100;
      qtyInput.step = 10;
      qtyLabel.textContent = "Weight (g)";
    } else {
      qtyInput.value = 1;
      qtyInput.step = 0.5;
      qtyLabel.textContent = "Quantity";
    }
    recalcScaledMacros();
  };

  window.closeScalerPanel = function () {
    selectedFood = null;
    document.getElementById('apiScalerPanel').classList.add('hidden');
  };

  window.recalcScaledMacros = function () {
    if (!selectedFood) return;
    const qty = parseFloat(document.getElementById('scalerQtyInput').value) || 0;
    const unitSel = document.getElementById('scalerUnitSelect');
    const unitG = parseFloat(unitSel.value) || 1;
    const unitLabel = unitSel.options[unitSel.selectedIndex]?.getAttribute('data-label') || 'serving';
    const oilTsp = parseInt(document.getElementById('scalerOilInput').value, 10) || 0;

    const totalGrams = +(qty * unitG).toFixed(1);
    const ratio = totalGrams / 100;

    const kcal = Math.round(selectedFood.kcal100 * ratio + (oilTsp * 45));
    const p = +(selectedFood.p100 * ratio).toFixed(1);
    const c = +(selectedFood.c100 * ratio).toFixed(1);
    const f = +(selectedFood.f100 * ratio + (oilTsp * 5.0)).toFixed(1);

    const portionDesc = unitG === 1
      ? `${totalGrams} g`
      : `${qty} × ${unitLabel.replace(/^1\s+/, '')} (${totalGrams} g)`;

    document.getElementById('scPortionSummary').textContent = portionDesc;
    document.getElementById('scKcal').textContent = `${kcal} kcal`;
    document.getElementById('scP').textContent = `${p} g`;
    document.getElementById('scC').textContent = `${c} g`;
    document.getElementById('scF').textContent = `${f} g`;
  };

  window.commitScaledFoodToLog = function (saveToPresets) {
    if (!selectedFood) return;
    const qty = parseFloat(document.getElementById('scalerQtyInput').value) || 1;
    const unitSel = document.getElementById('scalerUnitSelect');
    const unitG = parseFloat(unitSel.value) || 1;
    const unitLabel = unitSel.options[unitSel.selectedIndex]?.getAttribute('data-label') || 'serving';
    const oilTsp = parseInt(document.getElementById('scalerOilInput').value, 10) || 0;
    const slotEl = document.getElementById('mealSlotSelect');
    const slot = slotEl ? slotEl.value : 'Shift Meal';

    const totalGrams = +(qty * unitG).toFixed(1);
    const ratio = totalGrams / 100;

    const kcal = Math.round(selectedFood.kcal100 * ratio + (oilTsp * 45));
    const p = +(selectedFood.p100 * ratio).toFixed(1);
    const c = +(selectedFood.c100 * ratio).toFixed(1);
    const f = +(selectedFood.f100 * ratio + (oilTsp * 5.0)).toFixed(1);

    const oilLabel = oilTsp > 0 ? ` (+${oilTsp} tsp oil/butter)` : '';
    const finalName = `${selectedFood.name}${oilLabel}`;
    const finalPortion = unitG === 1
      ? `${totalGrams} g`
      : `${qty} × ${unitLabel.replace(/^1\s+/, '')} (${totalGrams} g)`;

    if (typeof ensureDay === 'function' && typeof activeDate !== 'undefined') {
      const day = ensureDay(activeDate);
      day.meals.push({
        name: finalName,
        slot: slot,
        portion: finalPortion,
        kcal, p, c, f
      });

      if (saveToPresets && typeof db !== 'undefined' && Array.isArray(db.foods)) {
        db.foods.unshift({ name: finalName, portion: finalPortion, kcal, p, c, f });
        if (typeof populatePresetDropdown === 'function') populatePresetDropdown();
      }

      if (typeof saveDB === 'function') saveDB();
      if (typeof renderAll === 'function') renderAll();
      closeScalerPanel();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFoodSearchEngine);
  } else {
    injectFoodSearchEngine();
  }
})();