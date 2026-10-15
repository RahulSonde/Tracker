/**
 * UNLIMITED WEB NUTRITION & LAB API ENGINE v2 (food-api.js)
 * Features:
 * - Quantity / Piece / Household Unit logging (e.g., "3 oranges", "4 almonds", "2 chapatis", "1 katori")
 * - Smart Piece-Weight Detector for USDA & Open Food Facts API results
 * - Exact Per-100g Lab Macros scaled to your exact piece count or gram weight
 */

(function () {
  const API_CONFIG_KEY = 'rahul_nutrition_api_cfg_v1';

  // Verified per-100g Indian reference dataset (ICMR-NIN IFCT 2017 & USDA) + Natural Piece Weights
  const ICMR_INDIAN_DB_PER_100G = [
    // Nuts, Seeds & Dry Fruits (Countable by piece)
    { name: "Almonds (Badam), Raw", source: "ICMR-NIN", kcal100: 589, p100: 20.8, c100: 10.5, f100: 52.5, unitName: "1 almond (1.2 g)", unitG: 1.2, defaultQty: 4 },
    { name: "Walnuts (Akhrot), Halves", source: "ICMR-NIN", kcal100: 687, p100: 15.6, c100: 11.0, f100: 64.5, unitName: "1 walnut half (2.5 g)", unitG: 2.5, defaultQty: 4 },
    { name: "Cashews (Kaju), Whole", source: "ICMR-NIN", kcal100: 582, p100: 18.8, c100: 29.5, f100: 45.0, unitName: "1 whole cashew (1.6 g)", unitG: 1.6, defaultQty: 5 },
    { name: "Pistachios (Pista), Shelled", source: "ICMR-NIN", kcal100: 562, p100: 20.2, c100: 27.2, f100: 45.3, unitName: "1 pistachio (0.8 g)", unitG: 0.8, defaultQty: 10 },
    { name: "Dates (Khajoor), Seedless", source: "ICMR-NIN", kcal100: 282, p100: 2.5, c100: 75.0, f100: 0.4, unitName: "1 medium date (8 g)", unitG: 8.0, defaultQty: 2 },
    { name: "Raisins (Kishmish)", source: "ICMR-NIN", kcal100: 299, p100: 3.1, c100: 79.2, f100: 0.5, unitName: "1 raisin (0.5 g)", unitG: 0.5, defaultQty: 10 },
    { name: "Peanuts, Raw or Dry Roasted", source: "ICMR-NIN", kcal100: 567, p100: 25.8, c100: 16.1, f100: 49.2, unitName: "1 handful (25 g)", unitG: 25.0, defaultQty: 1 },
    { name: "Peanut Butter (Unsweetened Natural)", source: "Label", kcal100: 600, p100: 30.0, c100: 16.0, f100: 49.0, unitName: "1 tbsp (16 g)", unitG: 16.0, defaultQty: 1 },

    // Fruits (Countable by piece)
    { name: "Orange (Santra), Peeled Edible", source: "ICMR-NIN", kcal100: 47, p100: 0.9, c100: 11.8, f100: 0.1, unitName: "1 medium orange (130 g)", unitG: 130, defaultQty: 1 },
    { name: "Sweet Lime (Mosambi), Peeled", source: "ICMR-NIN", kcal100: 43, p100: 0.8, c100: 9.3, f100: 0.3, unitName: "1 medium mosambi (130 g)", unitG: 130, defaultQty: 1 },
    { name: "Banana, Ripe (Medium Robusta)", source: "ICMR-NIN", kcal100: 89, p100: 1.1, c100: 22.8, f100: 0.3, unitName: "1 medium banana (115 g)", unitG: 115, defaultQty: 1 },
    { name: "Banana, Elaichi (Small)", source: "ICMR-NIN", kcal100: 89, p100: 1.1, c100: 22.8, f100: 0.3, unitName: "1 small elaichi banana (60 g)", unitG: 60, defaultQty: 1 },
    { name: "Apple, Fresh Medium", source: "ICMR-NIN", kcal100: 52, p100: 0.3, c100: 13.8, f100: 0.2, unitName: "1 medium apple (160 g)", unitG: 160, defaultQty: 1 },
    { name: "Guava (Peru), Fresh Medium", source: "ICMR-NIN", kcal100: 68, p100: 2.6, c100: 14.3, f100: 1.0, unitName: "1 medium guava (140 g)", unitG: 140, defaultQty: 1 },
    { name: "Pomegranate (Anar), Peeled Arils", source: "ICMR-NIN", kcal100: 83, p100: 1.7, c100: 18.7, f100: 1.2, unitName: "1 medium bowl arils (120 g)", unitG: 120, defaultQty: 1 },
    { name: "Papaya, Ripe Cubed", source: "ICMR-NIN", kcal100: 43, p100: 0.5, c100: 10.8, f100: 0.3, unitName: "1 medium bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Watermelon, Cubed", source: "ICMR-NIN", kcal100: 30, p100: 0.6, c100: 7.6, f100: 0.2, unitName: "1 medium bowl (200 g)", unitG: 200, defaultQty: 1 },

    // Eggs, Poultry, Meat & Fish
    { name: "Whole Hen Egg, Boiled/Raw", source: "ICMR-NIN", kcal100: 143, p100: 12.6, c100: 0.7, f100: 9.9, unitName: "1 large egg (50 g)", unitG: 50, defaultQty: 3 },
    { name: "Egg White Only, Boiled/Raw", source: "ICMR-NIN", kcal100: 52, p100: 10.9, c100: 0.7, f100: 0.2, unitName: "1 large egg white (33 g)", unitG: 33, defaultQty: 3 },
    { name: "Chicken Breast, Boiled/Grilled No Oil", source: "USDA/ICMR", kcal100: 165, p100: 31.0, c100: 0.0, f100: 3.6, unitName: "1 medium breast fillet (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Chicken Breast, Skinless, Raw", source: "ICMR-NIN", kcal100: 114, p100: 21.8, c100: 0.0, f100: 2.6, unitName: "1 raw breast fillet (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Home Chicken Curry (With Gravy & Oil)", source: "INDB", kcal100: 160, p100: 14.0, c100: 4.0, f100: 9.5, unitName: "1 medium bowl / katori (200 g)", unitG: 200, defaultQty: 1 },
    { name: "Tandoori Chicken (Cooked, Bone-In Edible)", source: "INDB", kcal100: 195, p100: 25.4, c100: 2.2, f100: 9.2, unitName: "1 leg/breast piece edible (100 g)", unitG: 100, defaultQty: 2 },
    { name: "Surmai (King Mackerel / Seer Fish), Raw", source: "ICMR-NIN", kcal100: 126, p100: 20.0, c100: 0.5, f100: 4.8, unitName: "1 medium steak slice (120 g)", unitG: 120, defaultQty: 1 },
    { name: "Rohu / Bangda Fish, Raw", source: "ICMR-NIN", kcal100: 120, p100: 18.0, c100: 0.5, f100: 4.5, unitName: "1 medium piece (100 g)", unitG: 100, defaultQty: 1 },
    { name: "Mutton / Goat Meat, Lean Cooked", source: "ICMR-NIN", kcal100: 185, p100: 26.0, c100: 0.0, f100: 8.5, unitName: "1 bowl pieces (150 g)", unitG: 150, defaultQty: 1 },

    // Indian Breads, Rice, Breakfast & Bakery (Countable by piece/bowl)
    { name: "Whole Wheat Chapati / Roti (No Ghee)", source: "INDB", kcal100: 285, p100: 9.4, c100: 57.1, f100: 2.2, unitName: "1 medium chapati (35 g)", unitG: 35, defaultQty: 2 },
    { name: "Jowar Bhakri (Sorghum Flatbread)", source: "INDB", kcal100: 266, p100: 7.5, c100: 53.3, f100: 1.9, unitName: "1 medium bhakri (65 g)", unitG: 65, defaultQty: 1 },
    { name: "Bajra Bhakri (Pearl Millet Flatbread)", source: "INDB", kcal100: 274, p100: 8.6, c100: 51.5, f100: 3.8, unitName: "1 medium bhakri (65 g)", unitG: 65, defaultQty: 1 },
    { name: "Brown / Whole Wheat Bread Slice", source: "Label", kcal100: 255, p100: 8.8, c100: 49.0, f100: 2.5, unitName: "1 bread slice (28 g)", unitG: 28, defaultQty: 2 },
    { name: "Steamed White Rice (Cooked)", source: "INDB", kcal100: 130, p100: 2.7, c100: 28.2, f100: 0.3, unitName: "1 medium katori/bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Idli, Steamed Plain", source: "INDB", kcal100: 128, p100: 3.9, c100: 26.2, f100: 0.6, unitName: "1 medium idli (50 g)", unitG: 50, defaultQty: 2 },
    { name: "Plain Dosa (Cooked)", source: "INDB", kcal100: 188, p100: 4.5, c100: 32.0, f100: 4.6, unitName: "1 medium dosa (90 g)", unitG: 90, defaultQty: 1 },
    { name: "Kanda Poha (Cooked with Peanuts)", source: "INDB", kcal100: 150, p100: 3.1, c100: 25.5, f100: 3.9, unitName: "1 plate (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Rolled Oats (Raw Uncooked)", source: "USDA", kcal100: 379, p100: 13.2, c100: 67.7, f100: 6.5, unitName: "1 standard cup / 4 tbsp (40 g)", unitG: 40, defaultQty: 1 },
    { name: "Marie Gold / Tea Biscuit", source: "Label", kcal100: 440, p100: 7.5, c100: 77.0, f100: 11.0, unitName: "1 biscuit (5.5 g)", unitG: 5.5, defaultQty: 2 },

    // Dals, Legumes, Dairy & Supplements
    { name: "Dal Tadka (Toor/Moong, Cooked)", source: "INDB", kcal100: 123, p100: 5.5, c100: 16.3, f100: 4.0, unitName: "1 medium katori/bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Rajma / Chole Masala (Cooked)", source: "INDB", kcal100: 140, p100: 6.3, c100: 19.5, f100: 4.2, unitName: "1 medium katori/bowl (180 g)", unitG: 180, defaultQty: 1 },
    { name: "Green Moong Sprouts (Raw/Steamed)", source: "ICMR-NIN", kcal100: 95, p100: 7.5, c100: 15.0, f100: 0.5, unitName: "1 katori/bowl (100 g)", unitG: 100, defaultQty: 1 },
    { name: "Roasted Bhuna Chana", source: "ICMR-NIN", kcal100: 369, p100: 22.5, c100: 58.1, f100: 5.2, unitName: "1 handful / small bowl (35 g)", unitG: 35, defaultQty: 1 },
    { name: "Paneer (Cow Milk Cottage Cheese)", source: "ICMR-NIN", kcal100: 265, p100: 18.3, c100: 3.4, f100: 20.1, unitName: "1 standard block/portion (100 g)", unitG: 100, defaultQty: 1 },
    { name: "Amul Cheese Slice / Cube", source: "Label", kcal100: 310, p100: 20.0, c100: 1.5, f100: 25.0, unitName: "1 slice / cube (20 g)", unitG: 20, defaultQty: 1 },
    { name: "Curd / Dahi (Toned Milk)", source: "ICMR-NIN", kcal100: 60, p100: 3.5, c100: 4.7, f100: 3.0, unitName: "1 medium katori/cup (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Milk, Toned (3% Fat)", source: "Label", kcal100: 60, p100: 3.1, c100: 4.8, f100: 3.0, unitName: "1 glass (250 ml)", unitG: 250, defaultQty: 1 },
    { name: "Whey Protein Powder", source: "Label", kcal100: 400, p100: 80.0, c100: 10.0, f100: 5.0, unitName: "1 scoop (30 g)", unitG: 30, defaultQty: 1 },
    { name: "Pure Cow Ghee / Cooking Oil", source: "ICMR-NIN", kcal100: 900, p100: 0.0, c100: 0.0, f100: 100.0, unitName: "1 teaspoon (5 g)", unitG: 5, defaultQty: 1 }
  ];

  // Smart Piece-Weight Dictionary for USDA & OpenFoodFacts API results
  const NATURAL_UNIT_RULES = [
    { regex: /\balmond/i, unitName: "1 almond (1.2 g)", unitG: 1.2, defaultQty: 4 },
    { regex: /\bwalnut/i, unitName: "1 walnut half (2.5 g)", unitG: 2.5, defaultQty: 4 },
    { regex: /\bcashew/i, unitName: "1 cashew (1.6 g)", unitG: 1.6, defaultQty: 5 },
    { regex: /\bpistachio/i, unitName: "1 pistachio (0.8 g)", unitG: 0.8, defaultQty: 10 },
    { regex: /\bdate(s)?\b/i, unitName: "1 medium date (8 g)", unitG: 8.0, defaultQty: 2 },
    { regex: /\braisin/i, unitName: "1 raisin (0.5 g)", unitG: 0.5, defaultQty: 10 },
    { regex: /\borange|tangerine|mandarin|mosambi/i, unitName: "1 medium orange (130 g)", unitG: 130, defaultQty: 1 },
    { regex: /\bbanana/i, unitName: "1 medium banana (115 g)", unitG: 115, defaultQty: 1 },
    { regex: /\bapple\b/i, unitName: "1 medium apple (160 g)", unitG: 160, defaultQty: 1 },
    { regex: /\bguava/i, unitName: "1 medium guava (140 g)", unitG: 140, defaultQty: 1 },
    { regex: /\bmango\b/i, unitName: "1 medium mango edible (180 g)", unitG: 180, defaultQty: 1 },
    { regex: /\begg white/i, unitName: "1 large egg white (33 g)", unitG: 33, defaultQty: 3 },
    { regex: /\begg\b/i, unitName: "1 large egg (50 g)", unitG: 50, defaultQty: 2 },
    { regex: /\bbread\b/i, unitName: "1 slice (28 g)", unitG: 28, defaultQty: 2 },
    { regex: /\bchapati|roti|phulka/i, unitName: "1 medium roti (35 g)", unitG: 35, defaultQty: 2 },
    { regex: /\bbiscuit|cookie/i, unitName: "1 biscuit/cookie (8 g)", unitG: 8, defaultQty: 2 },
    { regex: /\bidli\b/i, unitName: "1 medium idli (50 g)", unitG: 50, defaultQty: 2 },
    { regex: /\bdosa\b/i, unitName: "1 medium dosa (90 g)", unitG: 90, defaultQty: 1 },
    { regex: /\bwhey|protein powder/i, unitName: "1 scoop (30 g)", unitG: 30, defaultQty: 1 },
    { regex: /\bpotato/i, unitName: "1 medium potato (130 g)", unitG: 130, defaultQty: 1 },
    { regex: /\btomato/i, unitName: "1 medium tomato (100 g)", unitG: 100, defaultQty: 1 },
    { regex: /\bonion/i, unitName: "1 medium onion (90 g)", unitG: 90, defaultQty: 1 },
    { regex: /\bcucumber/i, unitName: "1 medium cucumber (150 g)", unitG: 150, defaultQty: 1 }
  ];

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
    return { unitName: "1 medium bowl / serving (100 g)", unitG: 100, defaultQty: 1 };
  }

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(API_CONFIG_KEY));
      if (saved && saved.usdaKey) return saved;
    } catch (e) {}
    return { usdaKey: 'DEMO_KEY' };
  }

  function saveConfig(cfg) {
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(cfg));
  }

  let apiConfig = loadConfig();
  let currentResults = [];
  let selectedFood = null;

  function injectFoodSearchEngine() {
    const presetSelect = document.getElementById('presetFoodSelect');
    if (!presetSelect) return;
    const hostCard = presetSelect.closest('section');
    if (!hostCard) return;

    const apiPanel = document.createElement('div');
    apiPanel.className = 'mt-4 pt-4 border-t border-slate-800 space-y-3';
    apiPanel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>🌐 Live Web & Lab Nutrition Search (Supports Piece Count & Grams)</span>
            <span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">Pieces • Bowls • Grams</span>
          </h3>
          <p class="text-[11px] text-slate-400">Search any fruit, nut, Indian dish, or packaged brand — then log by **Quantity (e.g. 3 oranges, 4 almonds)** or exact grams.</p>
        </div>
      </div>

      <!-- Search Controls -->
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div class="sm:col-span-4">
          <select id="apiSourceSelect" class="w-full text-xs">
            <option value="all">All Sources (ICMR + USDA + OpenFoodFacts)</option>
            <option value="icmr">ICMR-NIN / Indian Reference</option>
            <option value="usda">USDA FoodData Central (Lab Verified)</option>
            <option value="off">Open Food Facts (Brands / Barcode)</option>
          </select>
        </div>
        <div class="sm:col-span-6">
          <input type="text" id="apiSearchInput"
            placeholder="Try 'orange', 'almonds', 'chapati', 'paneer', 'amul'..."
            class="w-full text-xs"
            onkeydown="if(event.key==='Enter') executeUnifiedFoodSearch()" />
        </div>
        <div class="sm:col-span-2">
          <button onclick="executeUnifiedFoodSearch()" id="apiSearchBtn"
            class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 rounded-lg">
            Search Food
          </button>
        </div>
      </div>

      <!-- Status & Results List -->
      <div id="apiSearchStatus" class="text-[11px] text-slate-400 hidden"></div>
      <div id="apiResultsContainer" class="max-h-60 overflow-y-auto divide-y divide-slate-800 bg-slate-950/80 border border-slate-800 rounded-lg hidden"></div>

      <!-- Quantity / Piece & Gram Scaler Panel -->
      <div id="apiScalerPanel" class="hidden bg-slate-900 border border-emerald-700/60 rounded-xl p-3.5 space-y-3">
        <div class="flex justify-between items-start gap-2">
          <div>
            <div class="text-xs font-bold text-white" id="scalerFoodTitle">Selected Food</div>
            <div class="text-[11px] text-slate-400" id="scalerPer100Info">Per 100g: -- kcal</div>
          </div>
          <button onclick="closeScalerPanel()" class="text-xs text-slate-400 hover:text-white">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div class="sm:col-span-2">
            <label class="block text-[11px] text-emerald-300 font-semibold mb-1">Quantity</label>
            <input type="number" id="scalerQtyInput" value="1" min="0.25" step="1"
              class="w-full text-xs font-bold text-emerald-300" oninput="recalcScaledMacros()" />
          </div>
          <div class="sm:col-span-5">
            <label class="block text-[11px] text-slate-400 mb-1">Unit (Piece / Bowl / Exact Grams)</label>
            <select id="scalerUnitSelect" class="w-full text-xs" onchange="onUnitModeChange()"></select>
          </div>
          <div class="sm:col-span-5">
            <label class="block text-[11px] text-slate-400 mb-1">Cooking Oil / Ghee Modifier</label>
            <select id="scalerOilInput" class="w-full text-xs" onchange="recalcScaledMacros()">
              <option value="0">0 tsp (No extra oil / Raw)</option>
              <option value="1">+1 tsp Oil/Ghee (+45 kcal, 5g F)</option>
              <option value="2">+2 tsp Oil/Ghee (+90 kcal, 10g F)</option>
              <option value="3">+1 tbsp Oil/Ghee (+135 kcal, 15g F)</option>
            </select>
          </div>
        </div>

        <!-- Live Computed Weight & Macro Preview -->
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs text-slate-300">
            Total Portion: <strong class="text-cyan-300" id="scPortionSummary">1 unit (100 g)</strong>
          </div>
          <div class="flex gap-4 text-center">
            <div><span class="text-[10px] text-slate-400 block">Calories</span><span class="text-xs font-bold text-white" id="scKcal">0 kcal</span></div>
            <div><span class="text-[10px] text-slate-400 block">Protein</span><span class="text-xs font-bold text-emerald-400" id="scP">0 g</span></div>
            <div><span class="text-[10px] text-slate-400 block">Carbs</span><span class="text-xs font-bold text-amber-400" id="scC">0 g</span></div>
            <div><span class="text-[10px] text-slate-400 block">Fat</span><span class="text-xs font-bold text-purple-400" id="scF">0 g</span></div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <button onclick="commitScaledFoodToLog(false)" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg">
            + Log to Active Shift Day
          </button>
          <button onclick="commitScaledFoodToLog(true)" class="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-semibold px-3 py-2 rounded-lg">
            ★ Log & Save to My Dropdown
          </button>
        </div>
      </div>

      <!-- Optional USDA API Key Configuration -->
      <details class="text-[11px] text-slate-500">
        <summary class="cursor-pointer hover:text-slate-300">⚙️ API Key Settings (USDA FDC Key)</summary>
        <div class="flex gap-2 mt-2 items-center">
          <input type="text" id="usdaKeyInput" value="${apiConfig.usdaKey}" placeholder="Enter USDA API Key or DEMO_KEY" class="text-xs flex-1" />
          <button onclick="saveUsdaApiKey()" class="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-700">Save Key</button>
          <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" class="text-blue-400 underline">Get Free Key</a>
        </div>
      </details>
    `;

    hostCard.appendChild(apiPanel);
  }

  window.saveUsdaApiKey = function () {
    const val = document.getElementById('usdaKeyInput').value.trim() || 'DEMO_KEY';
    apiConfig.usdaKey = val;
    saveConfig(apiConfig);
    alert(`USDA API Key saved: ${val}`);
  };

  function searchIcmrLocal(query) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return ICMR_INDIAN_DB_PER_100G.filter(item => {
      const hay = item.name.toLowerCase();
      return tokens.every(t => hay.includes(t));
    });
  }

  async function searchUsdaFdc(query) {
    const key = encodeURIComponent(apiConfig.usdaKey || 'DEMO_KEY');
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${encodeURIComponent(query)}&pageSize=10&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`USDA API status ${res.status}`);
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
        source: `USDA`,
        kcal100,
        p100,
        c100,
        f100,
        unitName: inferred.unitName,
        unitG: inferred.unitG,
        defaultQty: inferred.defaultQty
      };
    }).filter(item => item.kcal100 > 0 || item.p100 > 0);
  }

  async function searchOpenFoodFacts(query) {
    const clean = query.trim();
    if (/^\d{8,14}$/.test(clean)) {
      const bUrl = `https://world.openfoodfacts.org/api/v2/product/${clean}.json`;
      const res = await fetch(bUrl);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const n = p.nutriments || {};
        const fullName = `${p.product_name || 'Barcode Product'} ${p.brands ? '(' + p.brands + ')' : ''}`;
        const inferred = inferNaturalUnit(fullName, Number(p.serving_quantity) || null, p.serving_size || null);
        return [{
          name: fullName,
          source: 'OpenFoodFacts',
          kcal100: Math.round(Number(n['energy-kcal_100g'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0))),
          p100: +(Number(n.proteins_100g || 0)).toFixed(1),
          c100: +(Number(n.carbohydrates_100g || 0)).toFixed(1),
          f100: +(Number(n.fat_100g || 0)).toFixed(1),
          unitName: inferred.unitName,
          unitG: inferred.unitG,
          defaultQty: inferred.defaultQty
        }];
      }
      return [];
    }

    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(clean)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriments,serving_quantity,serving_size`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`OpenFoodFacts status ${res.status}`);
    const data = await res.json();

    return (data.products || []).map(p => {
      const n = p.nutriments || {};
      const kcal = Number(n['energy-kcal_100g'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0));
      const fullName = `${p.product_name || 'Unnamed Item'}${p.brands ? ' — ' + p.brands : ''}`;
      const inferred = inferNaturalUnit(fullName, Number(p.serving_quantity) || null, p.serving_size || null);
      return {
        name: fullName,
        source: 'OpenFoodFacts',
        kcal100: Math.round(kcal),
        p100: +(Number(n.proteins_100g || 0)).toFixed(1),
        c100: +(Number(n.carbohydrates_100g || 0)).toFixed(1),
        f100: +(Number(n.fat_100g || 0)).toFixed(1),
        unitName: inferred.unitName,
        unitG: inferred.unitG,
        defaultQty: inferred.defaultQty
      };
    }).filter(x => x.name && (x.kcal100 > 0 || x.p100 > 0));
  }

  window.executeUnifiedFoodSearch = async function () {
    const query = document.getElementById('apiSearchInput').value.trim();
    const source = document.getElementById('apiSourceSelect').value;
    const statusEl = document.getElementById('apiSearchStatus');
    const resultsEl = document.getElementById('apiResultsContainer');
    const btn = document.getElementById('apiSearchBtn');

    if (!query) return;

    statusEl.classList.remove('hidden');
    statusEl.textContent = `Searching verified nutrition databases for "${query}"...`;
    resultsEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Searching...';

    currentResults = [];

    try {
      const tasks = [];
      if (source === 'all' || source === 'icmr') {
        currentResults.push(...searchIcmrLocal(query));
      }
      if (source === 'all' || source === 'usda') {
        tasks.push(searchUsdaFdc(query).catch(() => []));
      }
      if (source === 'all' || source === 'off') {
        tasks.push(searchOpenFoodFacts(query).catch(() => []));
      }

      const webBatches = await Promise.all(tasks);
      webBatches.forEach(batch => currentResults.push(...batch));

      renderSearchResults();
    } catch (err) {
      statusEl.textContent = `Search error: ${err.message}. Showing local ICMR-NIN results.`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Search Food';
    }
  };

  function renderSearchResults() {
    const statusEl = document.getElementById('apiSearchStatus');
    const resultsEl = document.getElementById('apiResultsContainer');

    if (currentResults.length === 0) {
      statusEl.textContent = 'No matches found. Try a broader term (e.g., "orange", "almond", "paneer").';
      resultsEl.classList.add('hidden');
      return;
    }

    statusEl.textContent = `Found ${currentResults.length} items — click any item to log by Quantity/Pieces or Grams:`;
    resultsEl.classList.remove('hidden');

    resultsEl.innerHTML = currentResults.map((item, idx) => {
      const pieceKcal = Math.round(item.kcal100 * (item.unitG / 100));
      return `
        <div onclick="selectApiFoodItem(${idx})"
          class="p-2.5 hover:bg-slate-900 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 transition-colors">
          <div>
            <span class="text-xs font-semibold text-white">${item.name}</span>
            <span class="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">${item.source}</span>
            <div class="text-[11px] text-emerald-400 mt-0.5">Default Unit: ${item.unitName} ≈ ${pieceKcal} kcal</div>
          </div>
          <div class="text-[11px] text-slate-400 shrink-0 font-mono">
            <span>${item.kcal100} kcal</span> •
            <span>${item.p100}g P</span> •
            <span>${item.c100}g C</span> •
            <span>${item.f100}g F</span>
            <span class="text-slate-600">/100g</span>
          </div>
        </div>
      `;
    }).join('');
  }

  window.selectApiFoodItem = function (idx) {
    selectedFood = currentResults[idx];
    if (!selectedFood) return;

    document.getElementById('apiScalerPanel').classList.remove('hidden');
    document.getElementById('scalerFoodTitle').textContent = `${selectedFood.name} [${selectedFood.source}]`;
    document.getElementById('scalerPer100Info').textContent =
      `Lab Base per 100g: ${selectedFood.kcal100} kcal | Protein: ${selectedFood.p100}g | Carbs: ${selectedFood.c100}g | Fat: ${selectedFood.f100}g`;

    // Populate Unit Selector with the food's natural piece weight FIRST, followed by common Indian household units & 1g
    const unitSel = document.getElementById('scalerUnitSelect');
    unitSel.innerHTML = `
      <option value="${selectedFood.unitG}" data-label="${selectedFood.unitName}">${selectedFood.unitName}</option>
      <option value="1" data-label="g (Exact Weight)">Exact Grams / ml (1 g)</option>
      <option value="150" data-label="medium katori / bowl (150 g)">1 Medium Katori / Bowl (150 g)</option>
      <option value="250" data-label="large bowl / glass (250 g)">1 Large Bowl / Glass (250 g)</option>
      <option value="30" data-label="small handful / scoop (30 g)">1 Handful / Scoop (30 g)</option>
      <option value="15" data-label="tablespoon (15 g)">1 Tablespoon (15 g)</option>
      <option value="5" data-label="teaspoon (5 g)">1 Teaspoon (5 g)</option>
    `;

    document.getElementById('scalerQtyInput').value = selectedFood.defaultQty || 1;
    document.getElementById('scalerOilInput').value = "0";
    recalcScaledMacros();
  };

  window.onUnitModeChange = function () {
    const unitSel = document.getElementById('scalerUnitSelect');
    const unitWeight = parseFloat(unitSel.value);
    const qtyInput = document.getElementById('scalerQtyInput');
    if (unitWeight === 1) {
      qtyInput.value = 100;
      qtyInput.step = 5;
    } else {
      qtyInput.value = 1;
      qtyInput.step = 0.5;
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
    const unitLabel = unitSel.options[unitSel.selectedIndex]?.getAttribute('data-label') || 'unit';
    const oilTsp = parseInt(document.getElementById('scalerOilInput').value, 10) || 0;

    const totalGrams = +(qty * unitG).toFixed(1);
    const ratio = totalGrams / 100;

    const kcal = Math.round(selectedFood.kcal100 * ratio + (oilTsp * 45));
    const p = +(selectedFood.p100 * ratio).toFixed(1);
    const c = +(selectedFood.c100 * ratio).toFixed(1);
    const f = +(selectedFood.f100 * ratio + (oilTsp * 5.0)).toFixed(1);

    const portionDesc = unitG === 1
      ? `${totalGrams} g`
      : `${qty} × ${unitLabel.replace(/^1\s+/, '')} (${totalGrams} g total)`;

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
    const unitLabel = unitSel.options[unitSel.selectedIndex]?.getAttribute('data-label') || 'unit';
    const oilTsp = parseInt(document.getElementById('scalerOilInput').value, 10) || 0;
    const slotEl = document.getElementById('mealSlotSelect');
    const slot = slotEl ? slotEl.value : 'Shift Meal';

    const totalGrams = +(qty * unitG).toFixed(1);
    const ratio = totalGrams / 100;

    const kcal = Math.round(selectedFood.kcal100 * ratio + (oilTsp * 45));
    const p = +(selectedFood.p100 * ratio).toFixed(1);
    const c = +(selectedFood.c100 * ratio).toFixed(1);
    const f = +(selectedFood.f100 * ratio + (oilTsp * 5.0)).toFixed(1);

    const oilLabel = oilTsp > 0 ? ` (+${oilTsp} tsp oil/ghee)` : '';
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
        kcal,
        p,
        c,
        f
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