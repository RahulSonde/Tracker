/**
 * UNLIMITED WEB NUTRITION & LAB API ENGINE (food-api.js)
 * Integrates:
 * 1. USDA FoodData Central REST API (Lab-tested Foundation & SR Legacy foods)
 * 2. Open Food Facts REST API v2 (Indian & Global packaged brands + Barcode search)
 * 3. ICMR-NIN IFCT 2017 / INDB Reference Dataset (Indian raw & cooked staples per 100g)
 *
 * Automatically mounts into index.html and logs directly into db.days[activeDate].meals
 */

(function () {
  const API_CONFIG_KEY = 'rahul_nutrition_api_cfg_v1';

  // Verified per-100g Indian reference dataset (ICMR-NIN IFCT 2017 & INDB)
  const ICMR_INDIAN_DB_PER_100G = [
    // Poultry, Meat & Fish (per 100g edible portion)
    { name: "Chicken Breast, Skinless, Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 114, p100: 21.8, c100: 0.0, f100: 2.6, defaultG: 150 },
    { name: "Chicken Breast, Boiled/Grilled No Oil", source: "USDA/ICMR", kcal100: 165, p100: 31.0, c100: 0.0, f100: 3.6, defaultG: 150 },
    { name: "Chicken Thigh, Boneless, Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 144, p100: 18.2, c100: 0.0, f100: 7.8, defaultG: 150 },
    { name: "Home Chicken Curry (With Gravy & Oil)", source: "INDB", kcal100: 160, p100: 14.0, c100: 4.0, f100: 9.5, defaultG: 200 },
    { name: "Tandoori Chicken (Cooked, Bone-In Edible)", source: "INDB", kcal100: 195, p100: 25.4, c100: 2.2, f100: 9.2, defaultG: 150 },
    { name: "Mutton / Goat Meat, Lean, Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 118, p100: 21.4, c100: 0.0, f100: 3.6, defaultG: 150 },
    { name: "Surmai (King Mackerel / Seer Fish), Raw", source: "ICMR-NIN", kcal100: 126, p100: 20.0, c100: 0.5, f100: 4.8, defaultG: 150 },
    { name: "Rohu Fish, Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 97, p100: 16.6, c100: 1.0, f100: 2.4, defaultG: 150 },
    { name: "Bangda (Indian Mackerel), Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 139, p100: 19.3, c100: 0.0, f100: 6.6, defaultG: 150 },
    { name: "Pomfret, White, Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 111, p100: 17.0, c100: 0.8, f100: 4.2, defaultG: 150 },
    { name: "Prawns / Shrimp, Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 89, p100: 19.2, c100: 0.8, f100: 0.8, defaultG: 150 },
    { name: "Whole Hen Egg, Boiled/Raw (ICMR-NIN)", source: "ICMR-NIN", kcal100: 143, p100: 12.6, c100: 0.7, f100: 9.9, defaultG: 100 },
    { name: "Egg White Only, Raw/Boiled (ICMR-NIN)", source: "ICMR-NIN", kcal100: 52, p100: 10.9, c100: 0.7, f100: 0.2, defaultG: 100 },

    // Dairy, Paneer & Soy (per 100g)
    { name: "Paneer (Cow Milk Cottage Cheese)", source: "ICMR-NIN", kcal100: 265, p100: 18.3, c100: 3.4, f100: 20.1, defaultG: 100 },
    { name: "Low-Fat Paneer / Milky Mist High Protein", source: "Label", kcal100: 165, p100: 25.0, c100: 3.2, f100: 5.8, defaultG: 100 },
    { name: "Tofu (Soy Paneer), Firm", source: "ICMR-NIN", kcal100: 85, p100: 10.2, c100: 1.9, f100: 4.2, defaultG: 100 },
    { name: "Soya Chunks (Dry, Uncooked Weight)", source: "ICMR-NIN", kcal100: 345, p100: 52.0, c100: 33.0, f100: 0.5, defaultG: 50 },
    { name: "Curd / Dahi (Toned Milk)", source: "ICMR-NIN", kcal100: 60, p100: 3.5, c100: 4.7, f100: 3.0, defaultG: 150 },
    { name: "Greek Yogurt / Hung Curd (Unsweetened)", source: "Label", kcal100: 75, p100: 9.0, c100: 4.0, f100: 2.5, defaultG: 100 },
    { name: "Milk, Toned (3% Fat, Amul Taaza)", source: "Label", kcal100: 60, p100: 3.1, c100: 4.8, f100: 3.0, defaultG: 250 },
    { name: "Milk, Skimmed (0.1% Fat)", source: "Label", kcal100: 35, p100: 3.5, c100: 5.0, f100: 0.1, defaultG: 250 },

    // Indian Breads, Rice, Grains & Millets (per 100g)
    { name: "Whole Wheat Chapati / Roti (Cooked, No Ghee)", source: "INDB", kcal100: 285, p100: 9.4, c100: 57.1, f100: 2.2, defaultG: 70 },
    { name: "Jowar Bhakri (Sorghum Flatbread, Cooked)", source: "INDB", kcal100: 266, p100: 7.5, c100: 53.3, f100: 1.9, defaultG: 60 },
    { name: "Bajra Bhakri (Pearl Millet Flatbread, Cooked)", source: "INDB", kcal100: 274, p100: 8.6, c100: 51.5, f100: 3.8, defaultG: 60 },
    { name: "Steamed White Rice (Cooked)", source: "INDB", kcal100: 130, p100: 2.7, c100: 28.2, f100: 0.3, defaultG: 150 },
    { name: "Brown Rice (Cooked)", source: "INDB", kcal100: 123, p100: 2.7, c100: 25.6, f100: 1.0, defaultG: 150 },
    { name: "Indrayani / Basmati Rice (Raw Uncooked)", source: "ICMR-NIN", kcal100: 356, p100: 7.9, c100: 78.2, f100: 0.5, defaultG: 60 },
    { name: "Rolled Oats (Raw Uncooked)", source: "USDA/ICMR", kcal100: 379, p100: 13.2, c100: 67.7, f100: 6.5, defaultG: 40 },
    { name: "Kanda Poha (Cooked with Peanuts)", source: "INDB", kcal100: 150, p100: 3.1, c100: 25.5, f100: 3.9, defaultG: 180 },
    { name: "Rava Upma (Cooked)", source: "INDB", kcal100: 142, p100: 3.6, c100: 23.0, f100: 4.0, defaultG: 180 },
    { name: "Thalipeeth (Multigrain, Cooked with 1 tsp Oil)", source: "INDB", kcal100: 235, p100: 7.8, c100: 38.0, f100: 5.8, defaultG: 80 },
    { name: "Idli, Steamed Plain", source: "INDB", kcal100: 128, p100: 3.9, c100: 26.2, f100: 0.6, defaultG: 100 },
    { name: "Plain Dosa (Cooked with minimal oil)", source: "INDB", kcal100: 188, p100: 4.5, c100: 32.0, f100: 4.6, defaultG: 100 },

    // Dals, Pulses & Legumes (Cooked & Raw per 100g)
    { name: "Dal Tadka (Toor/Arhar, Cooked Medium Thick)", source: "INDB", kcal100: 123, p100: 5.5, c100: 16.3, f100: 4.0, defaultG: 150 },
    { name: "Moong Dal (Yellow, Cooked Plain)", source: "INDB", kcal100: 105, p100: 6.2, c100: 16.8, f100: 1.4, defaultG: 150 },
    { name: "Masoor Dal (Red Lentil, Cooked)", source: "INDB", kcal100: 116, p100: 7.6, c100: 18.0, f100: 1.5, defaultG: 150 },
    { name: "Rajma Masala (Kidney Beans Curry, Cooked)", source: "INDB", kcal100: 133, p100: 6.1, c100: 18.9, f100: 3.9, defaultG: 180 },
    { name: "Chole / Chana Masala (Cooked)", source: "INDB", kcal100: 148, p100: 6.5, c100: 20.2, f100: 4.6, defaultG: 180 },
    { name: "Matki Usal (Moth Bean Sprouts Curry, Cooked)", source: "INDB", kcal100: 128, p100: 6.8, c100: 17.5, f100: 3.5, defaultG: 150 },
    { name: "Green Moong Sprouts (Raw/Steamed)", source: "ICMR-NIN", kcal100: 95, p100: 7.5, c100: 15.0, f100: 0.5, defaultG: 100 },
    { name: "Roasted Bhuna Chana (Dry Bengal Gram)", source: "ICMR-NIN", kcal100: 369, p100: 22.5, c100: 58.1, f100: 5.2, defaultG: 40 },

    // Nuts, Oils, Fruits & Everyday Vegetables (per 100g)
    { name: "Peanuts, Raw or Dry Roasted", source: "ICMR-NIN", kcal100: 567, p100: 25.8, c100: 16.1, f100: 49.2, defaultG: 20 },
    { name: "Almonds (Badam), Raw", source: "ICMR-NIN", kcal100: 589, p100: 20.8, c100: 10.5, f100: 52.5, defaultG: 15 },
    { name: "Peanut Butter (Unsweetened Natural)", source: "Label", kcal100: 600, p100: 30.0, c100: 16.0, f100: 49.0, defaultG: 16 },
    { name: "Banana, Ripe (Robusta / Elaichi)", source: "ICMR-NIN", kcal100: 89, p100: 1.1, c100: 22.8, f100: 0.3, defaultG: 100 },
    { name: "Apple, Fresh", source: "ICMR-NIN", kcal100: 52, p100: 0.3, c100: 13.8, f100: 0.2, defaultG: 150 },
    { name: "Guava (Peru), Fresh", source: "ICMR-NIN", kcal100: 68, p100: 2.6, c100: 14.3, f100: 1.0, defaultG: 150 },
    { name: "Papaya, Ripe", source: "ICMR-NIN", kcal100: 43, p100: 0.5, c100: 10.8, f100: 0.3, defaultG: 150 },
    { name: "Potato, Boiled (Peeled)", source: "ICMR-NIN", kcal100: 87, p100: 1.9, c100: 20.1, f100: 0.1, defaultG: 100 },
    { name: "Sweet Potato (Shakarkandi), Boiled", source: "ICMR-NIN", kcal100: 86, p100: 1.6, c100: 20.1, f100: 0.1, defaultG: 100 },
    { name: "Bhindi / Mixed Dry Sabzi (Cooked with 1 tsp Oil)", source: "INDB", kcal100: 85, p100: 2.0, c100: 9.5, f100: 4.5, defaultG: 150 },
    { name: "Pure Cow Ghee / Cooking Oil", source: "ICMR-NIN", kcal100: 900, p100: 0.0, c100: 0.0, f100: 100.0, defaultG: 5 }
  ];

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

  // Inject the Web/API Search UI directly into the Left Column of index.html
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
            <span>🌐 Live Web & Lab Nutrition Search Engine</span>
            <span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">Per-100g Exact Macros</span>
          </h3>
          <p class="text-[11px] text-slate-400">Searches ICMR-NIN Indian Tables + USDA Lab Database (400k+ foods) + Open Food Facts (3M+ packaged foods & barcodes)</p>
        </div>
      </div>

      <!-- Search Controls -->
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div class="sm:col-span-4">
          <select id="apiSourceSelect" class="w-full text-xs">
            <option value="all">All Sources (ICMR + USDA + OpenFoodFacts)</option>
            <option value="usda">USDA FoodData Central (Lab Verified)</option>
            <option value="off">Open Food Facts (Packaged Brands / Barcode)</option>
            <option value="icmr">ICMR-NIN / INDB (Indian Reference Only)</option>
          </select>
        </div>
        <div class="sm:col-span-6">
          <input type="text" id="apiSearchInput"
            placeholder="Search e.g. 'chicken breast', 'amul lassi', 'surmai', or Barcode..."
            class="w-full text-xs"
            onkeydown="if(event.key==='Enter') executeUnifiedFoodSearch()" />
        </div>
        <div class="sm:col-span-2">
          <button onclick="executeUnifiedFoodSearch()" id="apiSearchBtn"
            class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 rounded-lg">
            Search API
          </button>
        </div>
      </div>

      <!-- Status & Results List -->
      <div id="apiSearchStatus" class="text-[11px] text-slate-400 hidden"></div>
      <div id="apiResultsContainer" class="max-h-60 overflow-y-auto divide-y divide-slate-800 bg-slate-950/80 border border-slate-800 rounded-lg hidden"></div>

      <!-- Exact Gram Scaler & Logger Drawer (Appears when a result is clicked) -->
      <div id="apiScalerPanel" class="hidden bg-slate-900 border border-emerald-700/60 rounded-xl p-3.5 space-y-3">
        <div class="flex justify-between items-start gap-2">
          <div>
            <div class="text-xs font-bold text-white" id="scalerFoodTitle">Selected Food</div>
            <div class="text-[11px] text-slate-400" id="scalerPer100Info">Per 100g: -- kcal</div>
          </div>
          <button onclick="closeScalerPanel()" class="text-xs text-slate-400 hover:text-white">✕</button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Exact Weight (g or ml)</label>
            <input type="number" id="scalerGramsInput" value="100" min="1" step="5"
              class="w-full text-xs font-bold text-emerald-300" oninput="recalcScaledMacros()" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Added Cooking Oil/Ghee</label>
            <select id="scalerOilInput" class="w-full text-xs" onchange="recalcScaledMacros()">
              <option value="0">0 tsp (None / Already in dish)</option>
              <option value="1">+1 tsp Oil/Ghee (+45 kcal, 5g F)</option>
              <option value="2">+2 tsp Oil/Ghee (+90 kcal, 10g F)</option>
              <option value="3">+1 tbsp Oil/Ghee (+135 kcal, 15g F)</option>
            </select>
          </div>
          <div class="col-span-2 bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-around text-center">
            <div><div class="text-[10px] text-slate-400">Calories</div><div class="text-xs font-bold text-white" id="scKcal">0</div></div>
            <div><div class="text-[10px] text-slate-400">Protein</div><div class="text-xs font-bold text-emerald-400" id="scP">0g</div></div>
            <div><div class="text-[10px] text-slate-400">Carbs</div><div class="text-xs font-bold text-amber-400" id="scC">0g</div></div>
            <div><div class="text-[10px] text-slate-400">Fat</div><div class="text-xs font-bold text-purple-400" id="scF">0g</div></div>
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
        <summary class="cursor-pointer hover:text-slate-300">⚙️ API Key Settings (USDA FDC Key: currently using ${apiConfig.usdaKey === 'DEMO_KEY' ? 'Built-in DEMO_KEY' : 'Custom Key'})</summary>
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

  // 1. Search Local ICMR-NIN / INDB Verified Dataset
  function searchIcmrLocal(query) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return ICMR_INDIAN_DB_PER_100G.filter(item => {
      const hay = item.name.toLowerCase();
      return tokens.every(t => hay.includes(t));
    });
  }

  // 2. Query USDA FoodData Central API (Foundation, SR Legacy, Branded)
  async function searchUsdaFdc(query) {
    const key = encodeURIComponent(apiConfig.usdaKey || 'DEMO_KEY');
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${encodeURIComponent(query)}&pageSize=12&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`;
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

      return {
        name: f.description,
        source: `USDA (${f.dataType})`,
        kcal100,
        p100,
        c100,
        f100,
        defaultG: 100
      };
    }).filter(item => item.kcal100 > 0 || item.p100 > 0);
  }

  // 3. Query Open Food Facts API (Barcode or Text Search for Indian & Global Packaged Foods)
  async function searchOpenFoodFacts(query) {
    const clean = query.trim();
    // If numeric barcode (8-14 digits), use direct v2 barcode endpoint
    if (/^\d{8,14}$/.test(clean)) {
      const bUrl = `https://world.openfoodfacts.org/api/v2/product/${clean}.json`;
      const res = await fetch(bUrl);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const n = p.nutriments || {};
        return [{
          name: `${p.product_name || 'Barcode Product'} ${p.brands ? '(' + p.brands + ')' : ''}`,
          source: 'OpenFoodFacts Barcode',
          kcal100: Math.round(Number(n['energy-kcal_100g'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0))),
          p100: +(Number(n.proteins_100g || 0)).toFixed(1),
          c100: +(Number(n.carbohydrates_100g || 0)).toFixed(1),
          f100: +(Number(n.fat_100g || 0)).toFixed(1),
          defaultG: 100
        }];
      }
      return [];
    }

    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(clean)}&search_simple=1&action=process&json=1&page_size=12&fields=product_name,brands,nutriments`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`OpenFoodFacts status ${res.status}`);
    const data = await res.json();

    return (data.products || []).map(p => {
      const n = p.nutriments || {};
      const kcal = Number(n['energy-kcal_100g'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0));
      return {
        name: `${p.product_name || 'Unnamed Item'}${p.brands ? ' — ' + p.brands : ''}`,
        source: 'OpenFoodFacts',
        kcal100: Math.round(kcal),
        p100: +(Number(n.proteins_100g || 0)).toFixed(1),
        c100: +(Number(n.carbohydrates_100g || 0)).toFixed(1),
        f100: +(Number(n.fat_100g || 0)).toFixed(1),
        defaultG: 100
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
      btn.textContent = 'Search API';
    }
  };

  function renderSearchResults() {
    const statusEl = document.getElementById('apiSearchStatus');
    const resultsEl = document.getElementById('apiResultsContainer');

    if (currentResults.length === 0) {
      statusEl.textContent = 'No exact matches found. Try a broader term (e.g., "paneer", "chicken", "oats") or switch the source filter.';
      resultsEl.classList.add('hidden');
      return;
    }

    statusEl.textContent = `Found ${currentResults.length} verified items (values shown per 100g — click any item to scale exact grams):`;
    resultsEl.classList.remove('hidden');

    resultsEl.innerHTML = currentResults.map((item, idx) => `
      <div onclick="selectApiFoodItem(${idx})"
        class="p-2.5 hover:bg-slate-900 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1 transition-colors">
        <div>
          <span class="text-xs font-semibold text-white">${item.name}</span>
          <span class="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">${item.source}</span>
        </div>
        <div class="text-[11px] text-slate-300 shrink-0 font-mono">
          <span class="text-white font-bold">${item.kcal100} kcal</span> •
          <span class="text-emerald-400">${item.p100}g P</span> •
          <span class="text-amber-400">${item.c100}g C</span> •
          <span class="text-purple-400">${item.f100}g F</span>
          <span class="text-slate-500">/100g</span>
        </div>
      </div>
    `).join('');
  }

  window.selectApiFoodItem = function (idx) {
    selectedFood = currentResults[idx];
    if (!selectedFood) return;

    document.getElementById('apiScalerPanel').classList.remove('hidden');
    document.getElementById('scalerFoodTitle').textContent = `${selectedFood.name} [${selectedFood.source}]`;
    document.getElementById('scalerPer100Info').textContent =
      `Verified Base per 100g: ${selectedFood.kcal100} kcal | Protein: ${selectedFood.p100}g | Carbs: ${selectedFood.c100}g | Fat: ${selectedFood.f100}g`;
    document.getElementById('scalerGramsInput').value = selectedFood.defaultG || 100;
    document.getElementById('scalerOilInput').value = "0";
    recalcScaledMacros();
  };

  window.closeScalerPanel = function () {
    selectedFood = null;
    document.getElementById('apiScalerPanel').classList.add('hidden');
  };

  window.recalcScaledMacros = function () {
    if (!selectedFood) return;
    const grams = parseFloat(document.getElementById('scalerGramsInput').value) || 0;
    const oilTsp = parseInt(document.getElementById('scalerOilInput').value, 10) || 0;
    const ratio = grams / 100;

    const kcal = Math.round(selectedFood.kcal100 * ratio + (oilTsp * 45));
    const p = +(selectedFood.p100 * ratio).toFixed(1);
    const c = +(selectedFood.c100 * ratio).toFixed(1);
    const f = +(selectedFood.f100 * ratio + (oilTsp * 5.0)).toFixed(1);

    document.getElementById('scKcal').textContent = `${kcal} kcal`;
    document.getElementById('scP').textContent = `${p} g`;
    document.getElementById('scC').textContent = `${c} g`;
    document.getElementById('scF').textContent = `${f} g`;
  };

  window.commitScaledFoodToLog = function (saveToPresets) {
    if (!selectedFood) return;
    const grams = parseFloat(document.getElementById('scalerGramsInput').value) || 100;
    const oilTsp = parseInt(document.getElementById('scalerOilInput').value, 10) || 0;
    const slotEl = document.getElementById('mealSlotSelect');
    const slot = slotEl ? slotEl.value : 'Shift Meal';
    const ratio = grams / 100;

    const kcal = Math.round(selectedFood.kcal100 * ratio + (oilTsp * 45));
    const p = +(selectedFood.p100 * ratio).toFixed(1);
    const c = +(selectedFood.c100 * ratio).toFixed(1);
    const f = +(selectedFood.f100 * ratio + (oilTsp * 5.0)).toFixed(1);

    const oilLabel = oilTsp > 0 ? ` (+${oilTsp} tsp oil/ghee)` : '';
    const finalName = `${selectedFood.name}${oilLabel}`;
    const finalPortion = `${grams} g`;

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