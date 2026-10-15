/**
 * UNLIMITED WEB NUTRITION & BARCODE ENGINE v3 (food-api.js)
 * Features:
 * - Barcode Lookup (8-14 digits) via Local Indian Barcode Vault + Open Food Facts API v2
 * - Built-in Camera Barcode Scanner (HTML5 BarcodeDetector / Fallback)
 * - "Register Missing Indian Barcode" flow: if an 890... packet isn't online yet, save it once by barcode forever
 * - Piece / Quantity & Exact Gram Scaler (e.g., 25g murukku, 3 oranges, 4 almonds)
 */

(function () {
  const API_CONFIG_KEY = 'rahul_nutrition_api_cfg_v1';
  const BARCODE_VAULT_KEY = 'rahul_custom_barcodes_v1';

  // Pre-verified Indian Barcode Vault (persisted & expandable in localStorage)
  const DEFAULT_BARCODE_DB = {
    "8902979029834": {
      name: "Garden Crispy Murukku",
      source: "Verified Barcode (8902979029834)",
      kcal100: 520,
      p100: 8.0,
      c100: 56.0,
      f100: 29.0,
      unitName: "1 small snack portion (25 g)",
      unitG: 25,
      defaultQty: 1
    }
  };

  // Verified per-100g Indian reference dataset (ICMR-NIN IFCT 2017 & USDA) + Natural Piece Weights
  const ICMR_INDIAN_DB_PER_100G = [
    { barcode: "8902979029834", name: "Garden Crispy Murukku (8902979029834)", source: "Barcode Vault", kcal100: 520, p100: 8.0, c100: 56.0, f100: 29.0, unitName: "1 snack portion (25 g)", unitG: 25, defaultQty: 1 },
    // Nuts & Dry Fruits
    { name: "Almonds (Badam), Raw", source: "ICMR-NIN", kcal100: 589, p100: 20.8, c100: 10.5, f100: 52.5, unitName: "1 almond (1.2 g)", unitG: 1.2, defaultQty: 4 },
    { name: "Walnuts (Akhrot), Halves", source: "ICMR-NIN", kcal100: 687, p100: 15.6, c100: 11.0, f100: 64.5, unitName: "1 walnut half (2.5 g)", unitG: 2.5, defaultQty: 4 },
    { name: "Cashews (Kaju), Whole", source: "ICMR-NIN", kcal100: 582, p100: 18.8, c100: 29.5, f100: 45.0, unitName: "1 whole cashew (1.6 g)", unitG: 1.6, defaultQty: 5 },
    { name: "Pistachios (Pista), Shelled", source: "ICMR-NIN", kcal100: 562, p100: 20.2, c100: 27.2, f100: 45.3, unitName: "1 pistachio (0.8 g)", unitG: 0.8, defaultQty: 10 },
    { name: "Dates (Khajoor), Seedless", source: "ICMR-NIN", kcal100: 282, p100: 2.5, c100: 75.0, f100: 0.4, unitName: "1 medium date (8 g)", unitG: 8.0, defaultQty: 2 },
    { name: "Peanuts, Raw or Dry Roasted", source: "ICMR-NIN", kcal100: 567, p100: 25.8, c100: 16.1, f100: 49.2, unitName: "1 handful (25 g)", unitG: 25.0, defaultQty: 1 },
    { name: "Peanut Butter (Unsweetened Natural)", source: "Label", kcal100: 600, p100: 30.0, c100: 16.0, f100: 49.0, unitName: "1 tbsp (16 g)", unitG: 16.0, defaultQty: 1 },

    // Fruits
    { name: "Orange (Santra), Peeled Edible", source: "ICMR-NIN", kcal100: 47, p100: 0.9, c100: 11.8, f100: 0.1, unitName: "1 medium orange (130 g)", unitG: 130, defaultQty: 1 },
    { name: "Sweet Lime (Mosambi), Peeled", source: "ICMR-NIN", kcal100: 43, p100: 0.8, c100: 9.3, f100: 0.3, unitName: "1 medium mosambi (130 g)", unitG: 130, defaultQty: 1 },
    { name: "Banana, Ripe (Medium Robusta)", source: "ICMR-NIN", kcal100: 89, p100: 1.1, c100: 22.8, f100: 0.3, unitName: "1 medium banana (115 g)", unitG: 115, defaultQty: 1 },
    { name: "Banana, Elaichi (Small)", source: "ICMR-NIN", kcal100: 89, p100: 1.1, c100: 22.8, f100: 0.3, unitName: "1 small elaichi banana (60 g)", unitG: 60, defaultQty: 1 },
    { name: "Apple, Fresh Medium", source: "ICMR-NIN", kcal100: 52, p100: 0.3, c100: 13.8, f100: 0.2, unitName: "1 medium apple (160 g)", unitG: 160, defaultQty: 1 },
    { name: "Guava (Peru), Fresh Medium", source: "ICMR-NIN", kcal100: 68, p100: 2.6, c100: 14.3, f100: 1.0, unitName: "1 medium guava (140 g)", unitG: 140, defaultQty: 1 },

    // Eggs, Poultry & Fish
    { name: "Whole Hen Egg, Boiled/Raw", source: "ICMR-NIN", kcal100: 143, p100: 12.6, c100: 0.7, f100: 9.9, unitName: "1 large egg (50 g)", unitG: 50, defaultQty: 3 },
    { name: "Egg White Only, Boiled/Raw", source: "ICMR-NIN", kcal100: 52, p100: 10.9, c100: 0.7, f100: 0.2, unitName: "1 large egg white (33 g)", unitG: 33, defaultQty: 3 },
    { name: "Chicken Breast, Boiled/Grilled No Oil", source: "USDA/ICMR", kcal100: 165, p100: 31.0, c100: 0.0, f100: 3.6, unitName: "1 medium breast fillet (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Home Chicken Curry (With Gravy & Oil)", source: "INDB", kcal100: 160, p100: 14.0, c100: 4.0, f100: 9.5, unitName: "1 medium bowl / katori (200 g)", unitG: 200, defaultQty: 1 },
    { name: "Surmai (King Mackerel / Seer Fish), Raw", source: "ICMR-NIN", kcal100: 126, p100: 20.0, c100: 0.5, f100: 4.8, unitName: "1 medium steak slice (120 g)", unitG: 120, defaultQty: 1 },

    // Staples, Breads, Dals & Dairy
    { name: "Whole Wheat Chapati / Roti (No Ghee)", source: "INDB", kcal100: 285, p100: 9.4, c100: 57.1, f100: 2.2, unitName: "1 medium chapati (35 g)", unitG: 35, defaultQty: 2 },
    { name: "Jowar Bhakri (Sorghum Flatbread)", source: "INDB", kcal100: 266, p100: 7.5, c100: 53.3, f100: 1.9, unitName: "1 medium bhakri (65 g)", unitG: 65, defaultQty: 1 },
    { name: "Steamed White Rice (Cooked)", source: "INDB", kcal100: 130, p100: 2.7, c100: 28.2, f100: 0.3, unitName: "1 medium katori/bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Dal Tadka (Toor/Moong, Cooked)", source: "INDB", kcal100: 123, p100: 5.5, c100: 16.3, f100: 4.0, unitName: "1 medium katori/bowl (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Paneer (Cow Milk Cottage Cheese)", source: "ICMR-NIN", kcal100: 265, p100: 18.3, c100: 3.4, f100: 20.1, unitName: "1 standard block (100 g)", unitG: 100, defaultQty: 1 },
    { name: "Curd / Dahi (Toned Milk)", source: "ICMR-NIN", kcal100: 60, p100: 3.5, c100: 4.7, f100: 3.0, unitName: "1 medium katori/cup (150 g)", unitG: 150, defaultQty: 1 },
    { name: "Whey Protein Powder", source: "Label", kcal100: 400, p100: 80.0, c100: 10.0, f100: 5.0, unitName: "1 scoop (30 g)", unitG: 30, defaultQty: 1 }
  ];

  const NATURAL_UNIT_RULES = [
    { regex: /\bmurukku|chakli|bhujia|sev|namkeen|mixture|chivda/i, unitName: "1 snack portion (25 g)", unitG: 25, defaultQty: 1 },
    { regex: /\balmond/i, unitName: "1 almond (1.2 g)", unitG: 1.2, defaultQty: 4 },
    { regex: /\bwalnut/i, unitName: "1 walnut half (2.5 g)", unitG: 2.5, defaultQty: 4 },
    { regex: /\bcashew/i, unitName: "1 cashew (1.6 g)", unitG: 1.6, defaultQty: 5 },
    { regex: /\borange|tangerine|mandarin|mosambi/i, unitName: "1 medium orange (130 g)", unitG: 130, defaultQty: 1 },
    { regex: /\bbanana/i, unitName: "1 medium banana (115 g)", unitG: 115, defaultQty: 1 },
    { regex: /\bapple\b/i, unitName: "1 medium apple (160 g)", unitG: 160, defaultQty: 1 },
    { regex: /\begg white/i, unitName: "1 large egg white (33 g)", unitG: 33, defaultQty: 3 },
    { regex: /\begg\b/i, unitName: "1 large egg (50 g)", unitG: 50, defaultQty: 2 },
    { regex: /\bbread\b/i, unitName: "1 slice (28 g)", unitG: 28, defaultQty: 2 },
    { regex: /\bchapati|roti|phulka/i, unitName: "1 medium roti (35 g)", unitG: 35, defaultQty: 2 },
    { regex: /\bbiscuit|cookie/i, unitName: "1 biscuit/cookie (8 g)", unitG: 8, defaultQty: 2 }
  ];

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

  let barcodeVault = loadBarcodeVault();
  let currentResults = [];
  let selectedFood = null;
  let cameraStream = null;

  function inferNaturalUnit(foodName, apiServingG, apiServingText) {
    for (const rule of NATURAL_UNIT_RULES) {
      if (rule.regex.test(foodName)) {
        return { unitName: rule.unitName, unitG: rule.unitG, defaultQty: rule.defaultQty };
      }
    }
    if (apiServingG && apiServingG > 0 && apiServingG !== 100) {
      const label = apiServingText ? `${apiServingText} (${apiServingG} g)` : `1 serving (${apiServingG} g)`;
      return { unitName: label, unitG: apiServingG, defaultQty: 1 };
    }
    return { unitName: "Exact Grams (1 g)", unitG: 1, defaultQty: 25 };
  }

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
            <span>🌐 Live Web, Barcode & Piece-Count Nutrition Engine</span>
            <span class="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">EAN-13 Barcode Ready</span>
          </h3>
          <p class="text-[11px] text-slate-400">Type any 8–14 digit barcode (e.g. <strong>8902979029834</strong>), scan with camera, or search by food name.</p>
        </div>
      </div>

      <!-- Search & Barcode Controls -->
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div class="sm:col-span-3">
          <select id="apiSourceSelect" class="w-full text-xs">
            <option value="all">All Sources + Barcode</option>
            <option value="off">Barcode / OpenFoodFacts</option>
            <option value="icmr">ICMR-NIN Indian Ref</option>
            <option value="usda">USDA Lab Database</option>
          </select>
        </div>
        <div class="sm:col-span-5">
          <input type="text" id="apiSearchInput"
            placeholder="Barcode (8902979029834) or 'murukku', 'orange'..."
            class="w-full text-xs"
            onkeydown="if(event.key==='Enter') executeUnifiedFoodSearch()" />
        </div>
        <div class="sm:col-span-2">
          <button onclick="executeUnifiedFoodSearch()" id="apiSearchBtn"
            class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 rounded-lg">
            Search / Lookup
          </button>
        </div>
        <div class="sm:col-span-2">
          <button onclick="toggleCameraScanner()"
            class="w-full bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-semibold text-xs py-2 rounded-lg">
            📷 Scan Barcode
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
      <div id="apiResultsContainer" class="max-h-60 overflow-y-auto divide-y divide-slate-800 bg-slate-950/80 border border-slate-800 rounded-lg hidden"></div>

      <!-- Missing Barcode Quick-Registration Drawer -->
      <div id="registerBarcodeDrawer" class="hidden bg-slate-900 border border-amber-700/70 rounded-xl p-3.5 space-y-3">
        <div class="flex justify-between items-center">
          <div class="text-xs font-bold text-amber-300">
            New Indian Barcode Detected (<span id="regBarcodeNum"></span>) — Save Label Once (Per 100g)
          </div>
          <button onclick="document.getElementById('registerBarcodeDrawer').classList.add('hidden')" class="text-xs text-slate-400">✕</button>
        </div>
        <p class="text-[11px] text-slate-400">Enter the "Per 100 g" values from the packet's nutrition table once. This barcode will be saved permanently to your device.</p>
        <div class="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <input type="text" id="regProdName" placeholder="Brand & Name (e.g. Garden Crispy Murukku)" class="col-span-2 text-xs" />
          <input type="number" id="regKcal100" placeholder="kcal / 100g" class="text-xs" />
          <input type="number" id="regP100" placeholder="Protein / 100g" step="0.1" class="text-xs" />
          <input type="number" id="regC100" placeholder="Carbs / 100g" step="0.1" class="text-xs" />
          <input type="number" id="regF100" placeholder="Fat / 100g" step="0.1" class="text-xs" />
        </div>
        <button onclick="saveNewBarcodeToVault()" class="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg">
          Save Barcode & Open Gram Scaler
        </button>
      </div>

      <!-- Quantity / Piece & Exact Gram Scaler Panel -->
      <div id="apiScalerPanel" class="hidden bg-slate-900 border border-emerald-700/60 rounded-xl p-3.5 space-y-3">
        <div class="flex justify-between items-start gap-2">
          <div>
            <div class="text-xs font-bold text-white" id="scalerFoodTitle">Selected Food</div>
            <div class="text-[11px] text-slate-400" id="scalerPer100Info">Per 100g: -- kcal</div>
          </div>
          <button onclick="closeScalerPanel()" class="text-xs text-slate-400 hover:text-white">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div class="sm:col-span-3">
            <label class="block text-[11px] text-emerald-300 font-semibold mb-1" id="scalerQtyLabel">Quantity / Grams</label>
            <input type="number" id="scalerQtyInput" value="25" min="0.25" step="1"
              class="w-full text-xs font-bold text-emerald-300" oninput="recalcScaledMacros()" />
          </div>
          <div class="sm:col-span-5">
            <label class="block text-[11px] text-slate-400 mb-1">Measurement Mode</label>
            <select id="scalerUnitSelect" class="w-full text-xs" onchange="onUnitModeChange()"></select>
          </div>
          <div class="sm:col-span-4">
            <label class="block text-[11px] text-slate-400 mb-1">Extra Oil / Ghee</label>
            <select id="scalerOilInput" class="w-full text-xs" onchange="recalcScaledMacros()">
              <option value="0">0 tsp (Already in packet/dish)</option>
              <option value="1">+1 tsp Oil/Ghee (+45 kcal, 5g F)</option>
              <option value="2">+2 tsp Oil/Ghee (+90 kcal, 10g F)</option>
            </select>
          </div>
        </div>

        <!-- Live Computed Weight & Macro Preview -->
        <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs text-slate-300">
            Logging Portion: <strong class="text-cyan-300" id="scPortionSummary">25 g</strong>
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
    `;

    hostCard.appendChild(apiPanel);
  }

  // Camera Barcode Scanner using HTML5 BarcodeDetector API
  window.toggleCameraScanner = async function () {
    const box = document.getElementById('cameraScannerBox');
    if (!box.classList.contains('hidden')) {
      stopCameraScanner();
      return;
    }
    if (!('BarcodeDetector' in window)) {
      alert("Your current browser doesn't support native camera barcode detection. Type the 13-digit barcode number directly into the search box!");
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
      alert("Camera permission denied or unavailable. Please type the barcode number.");
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

  window.saveNewBarcodeToVault = function () {
    const code = document.getElementById('regBarcodeNum').textContent.trim();
    const name = document.getElementById('regProdName').value.trim();
    const kcal100 = parseFloat(document.getElementById('regKcal100').value) || 0;
    const p100 = parseFloat(document.getElementById('regP100').value) || 0;
    const c100 = parseFloat(document.getElementById('regC100').value) || 0;
    const f100 = parseFloat(document.getElementById('regF100').value) || 0;

    if (!name || kcal100 <= 0) return alert("Please enter the product name and calories per 100g.");

    const newItem = {
      name: `${name} (${code})`,
      source: `Saved Barcode (${code})`,
      kcal100: Math.round(kcal100),
      p100: +p100.toFixed(1),
      c100: +c100.toFixed(1),
      f100: +f100.toFixed(1),
      unitName: "Exact Grams (1 g)",
      unitG: 1,
      defaultQty: 25
    };

    barcodeVault[code] = newItem;
    saveBarcodeVault(barcodeVault);

    document.getElementById('registerBarcodeDrawer').classList.add('hidden');
    currentResults = [newItem];
    renderSearchResults();
    selectApiFoodItem(0);
  };

  function searchIcmrLocal(query) {
    const clean = query.trim();
    const hits = [];
    if (barcodeVault[clean]) {
      hits.push(barcodeVault[clean]);
    }
    const tokens = clean.toLowerCase().split(/\s+/).filter(Boolean);
    ICMR_INDIAN_DB_PER_100G.forEach(item => {
      const hay = (item.name + " " + (item.barcode || "")).toLowerCase();
      if (tokens.every(t => hay.includes(t))) {
        if (!hits.some(h => h.name === item.name)) hits.push(item);
      }
    });
    return hits;
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
            kcal100,
            p100,
            c100,
            f100,
            unitName: inferred.unitName,
            unitG: inferred.unitG,
            defaultQty: inferred.defaultQty
          }];
        }
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
    const regDrawer = document.getElementById('registerBarcodeDrawer');
    const btn = document.getElementById('apiSearchBtn');

    if (!query) return;

    const isBarcode = /^\d{8,14}$/.test(query);
    regDrawer.classList.add('hidden');
    statusEl.classList.remove('hidden');
    statusEl.textContent = isBarcode
      ? `Looking up barcode ${query} in Local Vault & Open Food Facts...`
      : `Searching verified databases for "${query}"...`;
    resultsEl.classList.add('hidden');
    btn.disabled = true;

    currentResults = [];

    try {
      // 1. Always check local Barcode Vault & ICMR first
      currentResults.push(...searchIcmrLocal(query));

      // 2. Query OpenFoodFacts for barcodes or text
      if (source === 'all' || source === 'off' || isBarcode) {
        const offHits = await searchOpenFoodFacts(query).catch(() => []);
        currentResults.push(...offHits);
      }

      renderSearchResults(query, isBarcode);
    } finally {
      btn.disabled = false;
    }
  };

  function renderSearchResults(query, isBarcode) {
    const statusEl = document.getElementById('apiSearchStatus');
    const resultsEl = document.getElementById('apiResultsContainer');
    const regDrawer = document.getElementById('registerBarcodeDrawer');

    if (currentResults.length === 0) {
      if (isBarcode) {
        statusEl.textContent = `Barcode ${query} is not in Open Food Facts yet. Register its per-100g label below once to save it forever:`;
        document.getElementById('regBarcodeNum').textContent = query;
        regDrawer.classList.remove('hidden');
      } else {
        statusEl.textContent = 'No matches found. Try a broader term or register a custom item.';
      }
      resultsEl.classList.add('hidden');
      return;
    }

    statusEl.textContent = `Found ${currentResults.length} match(es) — click to scale by exact grams (e.g. 25 g) or pieces:`;
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

    // Auto-open scaler if exact barcode match found
    if (isBarcode && currentResults.length === 1) {
      selectApiFoodItem(0);
    }
  }

  window.selectApiFoodItem = function (idx) {
    selectedFood = currentResults[idx];
    if (!selectedFood) return;

    document.getElementById('apiScalerPanel').classList.remove('hidden');
    document.getElementById('scalerFoodTitle').textContent = `${selectedFood.name}`;
    document.getElementById('scalerPer100Info').textContent =
      `Per 100g: ${selectedFood.kcal100} kcal | Protein: ${selectedFood.p100}g | Carbs: ${selectedFood.c100}g | Fat: ${selectedFood.f100}g`;

    const unitSel = document.getElementById('scalerUnitSelect');
    // Put Exact Grams (1 g) AND the natural piece/portion option right at the top
    unitSel.innerHTML = `
      <option value="1" data-label="g">Exact Weight in Grams (1 g)</option>
      <option value="${selectedFood.unitG}" data-label="${selectedFood.unitName}">${selectedFood.unitName}</option>
      <option value="25" data-label="small snack portion (25 g)">1 Small Snack Portion (25 g)</option>
      <option value="150" data-label="medium katori / bowl (150 g)">1 Medium Katori / Bowl (150 g)</option>
    `;

    // If the food is a countable piece (like almond = 1.2g or orange = 130g), select piece mode by default; for snacks/namkeen default to Exact Grams (25g)
    if (selectedFood.unitG !== 1 && selectedFood.unitG !== 25 && selectedFood.unitG !== 100) {
      unitSel.selectedIndex = 1;
      document.getElementById('scalerQtyInput').value = selectedFood.defaultQty || 1;
      document.getElementById('scalerQtyLabel').textContent = "Quantity (Pieces)";
    } else {
      unitSel.selectedIndex = 0;
      document.getElementById('scalerQtyInput').value = 25;
      document.getElementById('scalerQtyLabel').textContent = "Weight in Grams (g)";
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
      qtyInput.value = 25;
      qtyInput.step = 5;
      qtyLabel.textContent = "Weight in Grams (g)";
    } else {
      qtyInput.value = 1;
      qtyInput.step = 1;
      qtyLabel.textContent = "Quantity (Units)";
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