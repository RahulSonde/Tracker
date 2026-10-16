/**
 * GOOGLE FIT AUTO-STEP TRACKER & AI TELEMETRY COACH (ai-fit.js)
 * Features:
 * 1. Connects to Google Fit REST API (OAuth2) + Live Device Motion Pedometer + Quick Step Sync
 * 2. Automatically checks off the "walk" (3,000+ steps) habit in index.html when steps >= 3000
 * 3. Full-History AI Progress Block: Analyzes 7-day weight trend, protein pacing, sleep debt,
 *    hydration, and calorie deficit (Supports both Local Analytical Engine & Gemini 2.5 Flash API)
 */

(function () {
  const AI_FIT_CFG_KEY = 'rahul_ai_fit_cfg_v1';
  const STEP_GOAL = 3000;

  function loadAiFitConfig() {
    try {
      const raw = localStorage.getItem(AI_FIT_CFG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      googleClientId: '', // Optional Google Cloud OAuth 2.0 Web Client ID for Fit REST API
      geminiApiKey: '',   // Optional free Gemini API Key from aistudio.google.com
      lastFitSync: null
    };
  }

  function saveAiFitConfig(cfg) {
    localStorage.setItem(AI_FIT_CFG_KEY, JSON.stringify(cfg));
  }

  let aiFitCfg = loadAiFitConfig();
  let googleTokenClient = null;
  let pedometerActive = false;
  let lastAccelMag = 0;
  let lastStepTimestamp = 0;

  // Ensure the active day object has a steps counter
  function getDaySteps(dateStr) {
    if (typeof ensureDay !== 'function') return 0;
    const day = ensureDay(dateStr);
    if (typeof day.steps !== 'number') day.steps = 0;
    return day.steps;
  }

  // Save steps and auto-check the 3,000+ steps habit if goal is met
  window.updateDailySteps = function (newStepCount, sourceLabel = 'Manual') {
    if (typeof ensureDay !== 'function' || typeof activeDate === 'undefined') return;
    const day = ensureDay(activeDate);
    day.steps = Math.max(0, Math.round(newStepCount));

    // AUTO-CHECK HABIT: "walk" (3,000+ post-shift morning steps)
    if (day.steps >= STEP_GOAL) {
      day.habits["walk"] = true;
    }

    aiFitCfg.lastFitSync = `${sourceLabel} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    saveAiFitConfig(aiFitCfg);

    if (typeof saveDB === 'function') saveDB();
    if (typeof renderAll === 'function') renderAll();
    renderAiAndFitBlock();
  };

  window.addStepsDelta = function (delta) {
    const current = getDaySteps(activeDate);
    updateDailySteps(current + delta, 'Quick Log');
  };

  // ============================================================================
  // 1. GOOGLE FIT OAUTH2 REST API INTEGRATION
  // ============================================================================
  function loadGoogleIdentityScript() {
    if (document.getElementById('gisScript')) return;
    const s = document.createElement('script');
    s.id = 'gisScript';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    document.head.appendChild(s);
  }

  window.syncGoogleFitSteps = function () {
    if (!aiFitCfg.googleClientId) {
      openAiFitSettingsModal();
      return;
    }
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      return alert('Google Identity Services still loading. Please try again in 2 seconds.');
    }

    const syncBtn = document.getElementById('gfitSyncBtn');
    if (syncBtn) syncBtn.textContent = '🔄 Connecting Fit...';

    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: aiFitCfg.googleClientId.trim(),
      scope: 'https://www.googleapis.com/auth/fitness.activity.read',
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          if (syncBtn) syncBtn.textContent = '👟 Sync Google Fit';
          return alert('Google Fit Auth Error: ' + tokenResponse.error);
        }
        await fetchStepsFromGoogleFitAPI(tokenResponse.access_token);
      }
    });

    googleTokenClient.requestAccessToken({ prompt: '' });
  };

  async function fetchStepsFromGoogleFitAPI(accessToken) {
    const syncBtn = document.getElementById('gfitSyncBtn');
    try {
      // Compute time window for activeDate (Noon-to-Noon if night-shift mode is active, else Midnight-to-Midnight)
      const baseDate = new Date(activeDate + 'T00:00:00');
      const useNoon = typeof db !== 'undefined' && db?.profile?.noonBoundary;
      const startTime = new Date(baseDate.getTime());
      if (useNoon) startTime.setHours(12, 0, 0, 0);

      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

      const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
          }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startTime.getTime(),
          endTimeMillis: endTime.getTime()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      let totalSteps = 0;
      (data.bucket || []).forEach(b => {
        (b.dataset || []).forEach(ds => {
          (ds.point || []).forEach(pt => {
            (pt.value || []).forEach(v => {
              if (v.intVal) totalSteps += v.intVal;
            });
          });
        });
      });

      updateDailySteps(totalSteps, 'Google Fit API');
    } catch (err) {
      alert(`Google Fit API Sync Failed: ${err.message}`);
    } finally {
      if (syncBtn) syncBtn.textContent = '👟 Sync Google Fit';
    }
  }

  // ============================================================================
  // 2. BUILT-IN ANDROID / MOBILE SENSOR PEDOMETER (ZERO-API FALLBACK)
  // ============================================================================
  window.toggleLivePedometer = async function () {
    const btn = document.getElementById('livePedometerBtn');
    if (pedometerActive) {
      window.removeEventListener('devicemotion', handleMotionStep);
      pedometerActive = false;
      if (btn) {
        btn.textContent = '▶️ Start Walk Sensor';
        btn.className = 'px-3 py-1.5 text-xs font-bold pill-glow hover:bg-white/10 text-emerald-300 rounded-xl';
      }
      return;
    }

    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm !== 'granted') return alert('Motion sensor permission denied.');
      } catch (e) {}
    }

    window.addEventListener('devicemotion', handleMotionStep);
    pedometerActive = true;
    if (btn) {
      btn.textContent = '⏹️ Walking... (Counting)';
      btn.className = 'px-3 py-1.5 text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400 rounded-xl animate-pulse';
    }
  };

  function handleMotionStep(event) {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const now = Date.now();
    // Detect step peak (>12.8 m/s^2 with minimum 330ms debounce between steps)
    if (mag > 12.8 && lastAccelMag <= 12.8 && (now - lastStepTimestamp) > 330) {
      lastStepTimestamp = now;
      const current = getDaySteps(activeDate);
      updateDailySteps(current + 1, 'Live Sensor');
    }
    lastAccelMag = mag;
  }

  // ============================================================================
  // 3. FULL-PROGRESS AI ANALYTICAL & GEMINI COACH ENGINE
  // ============================================================================
  function buildComprehensiveTelemetrySnapshot() {
    const t = typeof computeTargets === 'function' ? computeTargets() : { tdee: 2194, targetKcal: 1799, proteinG: 150, carbsG: 187, fatG: 50 };
    const day = typeof ensureDay === 'function' ? ensureDay(activeDate) : { meals: [], habits: {}, waterMl: 0, steps: 0 };

    const totals = (day.meals || []).reduce((acc, m) => ({
      kcal: acc.kcal + m.kcal,
      p: +(acc.p + m.p).toFixed(1),
      c: +(acc.c + m.c).toFixed(1),
      f: +(acc.f + m.f).toFixed(1)
    }), { kcal: 0, p: 0, c: 0, f: 0 });

    // Analyze last 7 days across db.days
    const allDates = Object.keys(db?.days || {}).sort().reverse();
    const recent7Dates = allDates.slice(0, 7);

    const weights = recent7Dates.map(d => db.days[d]?.weight).filter(w => w !== null && w !== undefined);
    const avgWeight7d = weights.length ? +(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : db.profile.weightKg;
    const totalWeightLost = +(84.0 - avgWeight7d).toFixed(1);

    const sleeps = recent7Dates.map(d => db.days[d]?.sleep?.duration).filter(s => s > 0);
    const avgSleep7d = sleeps.length ? +(sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) : 0;

    return {
      date: activeDate,
      targets: t,
      today: {
        kcal: totals.kcal,
        remKcal: t.targetKcal - totals.kcal,
        protein: totals.p,
        remProtein: +(t.proteinG - totals.p).toFixed(1),
        carbs: totals.c,
        fat: totals.f,
        waterMl: day.waterMl || 0,
        steps: day.steps || 0,
        sleepHrs: day.sleep?.duration || 0,
        weight: day.weight || null,
        mealCount: (day.meals || []).length
      },
      trends: {
        avgWeight7d,
        totalWeightLost,
        avgSleep7d,
        daysTracked: allDates.length
      }
    };
  }

  // Instant Local Data-Science Coach (Zero API latency, 100% deterministic)
  function generateSmartLocalTips(snap) {
    const tips = [];
    const d = snap.today;
    const tr = snap.trends;

    // 1. Calorie & Protein Pacing Ratio Check
    const calPct = Math.round((d.kcal / snap.targets.targetKcal) * 100);
    const proPct = Math.round((d.protein / snap.targets.proteinG) * 100);

    if (d.mealCount === 0) {
      tips.push(`🎯 **Shift Kickoff:** You have **1,799 kcal** and **150g protein** open. Anchor your first meal after waking up with **45g+ protein** (e.g., 3 whole eggs + 3 egg whites or 150g chicken breast) so you aren't chasing protein at 5:00 AM.`);
    } else if (calPct - proPct >= 20) {
      tips.push(`⚠️ **Protein Lag Detected:** You've used **${calPct}%** of your calories (${d.kcal} kcal) but only hit **${proPct}%** of your protein (${d.protein}g / 150g). Make your next meal almost pure lean protein (**1 scoop whey, 4 boiled egg whites, or 150g grilled chicken/fish**) to stay under 1,799 kcal.`);
    } else if (d.remKcal < 0) {
      tips.push(`⚖️ **Calorie Buffer Notice:** You are **${Math.abs(d.remKcal)} kcal** over your 1,799 target, which still leaves you at a **${snap.targets.tdee - d.kcal >= 0 ? (snap.targets.tdee - d.kcal) + ' kcal deficit' : 'slight surplus'}** vs your 2,194 TDEE. Do not slash calories tomorrow—just hit your 3,000 morning steps and resume normal targets.`);
    } else {
      tips.push(`✅ **Macro Pacing On Point:** **${d.remKcal} kcal** and **${Math.max(0, d.remProtein)}g protein** left. Your protein-to-calorie ratio is well balanced to protect muscle mass while cutting.`);
    }

    // 2. Night-Shift Sleep & Craving Defense
    if (d.sleepHrs > 0 && d.sleepHrs < 6.5) {
      tips.push(`🌙 **Sleep Debt Alert (${d.sleepHrs}h logged):** Sleeping under 6.5 hours during the day spikes ghrelin (hunger hormone) between **2:00 AM and 5:00 AM**. Drink **500 ml water** before your shift break and stick to high-volume fiber/protein snacks.`);
    } else if (d.sleepHrs >= 7.0) {
      tips.push(`🌙 **Optimal Recovery (${d.sleepHrs}h sleep):** Hitting 7+ hours of daytime sleep keeps cortisol low and accelerates fat oxidation. Keep your **1:30 AM caffeine cutoff** tonight.`);
    } else if (tr.avgSleep7d > 0) {
      tips.push(`🌙 **7-Day Sleep Average (${tr.avgSleep7d}h):** Log today's daytime sleep window to keep tracking your recovery curve.`);
    }

    // 3. Steps & Hydration Progress
    if (d.steps >= STEP_GOAL) {
      tips.push(`👟 **Morning Walk Crushed (${d.steps.toLocaleString()} steps):** Your 3,000+ step habit was **auto-checked**! Post-shift morning walking improves insulin sensitivity before your pre-sleep meal.`);
    } else {
      const remSteps = STEP_GOAL - d.steps;
      tips.push(`👟 **Step Target (${d.steps.toLocaleString()} / 3,000):** Just **${remSteps.toLocaleString()} steps** (~${Math.ceil(remSteps / 100)} mins of brisk walking at 6:00 AM) left to auto-complete today's walking habit.`);
    }

    // 4. Weight Trend & Hydration
    if (d.waterMl < 2000) {
      tips.push(`💧 **Hydration Check (${d.waterMl} / 3,000 ml):** Add **${3000 - d.waterMl} ml** across your shift—mild dehydration on night shifts often disguises itself as namkeen/carb cravings.`);
    }
    if (tr.totalWeightLost > 0) {
      tips.push(`📉 **Overall Cut Progress:** Down **${tr.totalWeightLost} kg** from your 84.0 kg baseline (7-day rolling avg: **${tr.avgWeight7d} kg**, **${+(tr.avgWeight7d - 70).toFixed(1)} kg** to go).`);
    }

    return tips;
  }

  // Optional Live Gemini 2.5 Flash API Call
  window.generateDeepGeminiCoaching = async function () {
    const snap = buildComprehensiveTelemetrySnapshot();
    const outBox = document.getElementById('aiCoachOutputList');

    if (!aiFitCfg.geminiApiKey) {
      renderAiAndFitBlock();
      return;
    }

    if (outBox) {
      outBox.innerHTML = `<div class="text-xs text-cyan-300 animate-pulse py-2">🧠 Gemini AI analyzing your shift macros, sleep recovery, steps, and 7-day weight trend...</div>`;
    }

    const prompt = `You are a concise, data-driven personal fat-loss and night-shift nutrition coach for a 26yo male (178cm, starting 84kg -> target 70kg, working Mon-Fri 8PM-6AM night shift in India).
Current Telemetry JSON: ${JSON.stringify(snap)}
Give exactly 3 short, punchy, actionable bullet points (1 line each) covering:
1. Exact meal/protein adjustment for his remaining shift calories (${snap.today.remKcal} kcal, ${snap.today.remProtein}g protein left) using Indian foods.
2. Sleep/hydration/step recovery feedback based on today's numbers (${snap.today.steps} steps, ${snap.today.waterMl}ml water, ${snap.today.sleepHrs}h sleep).
3. Overall momentum toward 70kg. No intro fluff.`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(aiFitCfg.geminiApiKey.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text && outBox) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        outBox.innerHTML = lines.map(l => `<div class="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-200">${l.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300">$1</strong>')}</div>`).join('');
        return;
      }
    } catch (err) {
      // Fallback gracefully to local engine
    }
    renderAiAndFitBlock();
  };

  // ============================================================================
  // 4. UI INJECTION & LIVE UPDATES
  // ============================================================================
  function injectAiAndFitUI() {
    loadGoogleIdentityScript();

    // Insert the new Google Fit + AI Coach Hub right above the 2-column workspace
    const macroCard = document.getElementById('macroDashboardBody')?.closest('section');
    if (!macroCard) return;

    const hub = document.createElement('section');
    hub.id = 'aiAndFitHubSection';
    hub.className = 'grid grid-cols-1 lg:grid-cols-12 gap-5';
    macroCard.insertAdjacentElement('afterend', hub);

    // Settings Modal for Google Fit Client ID & Gemini API Key
    const modal = document.createElement('div');
    modal.id = 'aiFitSettingsModal';
    modal.className = 'fixed inset-0 bg-black/80 hidden items-center justify-center p-4 z-50 backdrop-blur-md';
    modal.innerHTML = `
      <div class="card max-w-lg w-full p-5 space-y-4 border border-white/15" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center border-b border-white/10 pb-2.5">
          <div>
            <h3 class="text-base font-extrabold text-white">👟 Google Fit & 🧠 Gemini AI Setup</h3>
            <p class="text-xs text-slate-400">Optional API keys for 1-click Google Fit OAuth & Gemini 2.5 Flash LLM</p>
          </div>
          <button onclick="closeAiFitSettingsModal()" class="text-slate-400 hover:text-white text-sm">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Google Cloud OAuth 2.0 Web Client ID (for Google Fit API)</label>
            <input type="text" id="cfgGfitClientId" value="${aiFitCfg.googleClientId || ''}" placeholder="123456789-abc.apps.googleusercontent.com" class="w-full mono text-xs" />
            <p class="text-[11px] text-slate-500 mt-1">Enable "Fitness API" in Google Cloud Console & add <code>https://rahulsonde.github.io</code> to Authorized JavaScript Origins.</p>
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Gemini API Key (Optional — for Deep LLM Insights)</label>
            <input type="password" id="cfgGeminiKey" value="${aiFitCfg.geminiApiKey || ''}" placeholder="AIzaSy... (Leave blank to use Built-in Smart Analytics)" class="w-full mono text-xs" />
            <p class="text-[11px] text-slate-500 mt-1">Even without an API key, the built-in Analytical Engine computes live tips from your macros, sleep, and weight automatically.</p>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button onclick="closeAiFitSettingsModal()" class="pill-glow px-3.5 py-2 rounded-xl text-xs">Cancel</button>
          <button onclick="saveAiFitModalSettings()" class="btn-neon-blue text-white font-bold px-4 py-2 rounded-xl text-xs">Save Settings</button>
        </div>
      </div>
    `;
    modal.onclick = closeAiFitSettingsModal;
    document.body.appendChild(modal);

    // Hook into renderAll() so the AI & Step Hub updates automatically whenever meals/weights/dates change
    if (typeof window.renderAll === 'function') {
      const origRenderAll = window.renderAll;
      window.renderAll = function () {
        origRenderAll();
        renderAiAndFitBlock();
      };
    }

    renderAiAndFitBlock();
  }

  window.openAiFitSettingsModal = function () {
    document.getElementById('cfgGfitClientId').value = aiFitCfg.googleClientId || '';
    document.getElementById('cfgGeminiKey').value = aiFitCfg.geminiApiKey || '';
    const m = document.getElementById('aiFitSettingsModal');
    m.classList.remove('hidden');
    m.classList.add('flex');
  };

  window.closeAiFitSettingsModal = function () {
    const m = document.getElementById('aiFitSettingsModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
  };

  window.saveAiFitModalSettings = function () {
    aiFitCfg.googleClientId = document.getElementById('cfgGfitClientId').value.trim();
    aiFitCfg.geminiApiKey = document.getElementById('cfgGeminiKey').value.trim();
    saveAiFitConfig(aiFitCfg);
    closeAiFitSettingsModal();
    renderAiAndFitBlock();
  };

  function renderAiAndFitBlock() {
    const hub = document.getElementById('aiAndFitHubSection');
    if (!hub) return;

    const snap = buildComprehensiveTelemetrySnapshot();
    const steps = snap.today.steps;
    const stepPct = Math.min(100, Math.round((steps / STEP_GOAL) * 100));
    const goalMet = steps >= STEP_GOAL;
    const tips = generateSmartLocalTips(snap);

    hub.innerHTML = `
      <!-- LEFT 5 COLS: GOOGLE FIT & STEP AUTO-TRACKER -->
      <div class="lg:col-span-5 card p-4 sm:p-5 flex flex-col justify-between space-y-4">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-extrabold uppercase tracking-wider text-emerald-400">👟 Google Fit & Step Engine</span>
              ${goalMet ? '<span class="mono text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full">✓ Habit Auto-Checked</span>' : ''}
            </div>
            <div class="mono text-2xl font-extrabold text-white mt-1">
              ${steps.toLocaleString()} <span class="text-xs font-normal text-slate-400">/ ${STEP_GOAL.toLocaleString()} steps</span>
            </div>
          </div>
          <button onclick="openAiFitSettingsModal()" class="text-xs pill-glow hover:bg-white/10 text-slate-300 px-2.5 py-1.5 rounded-xl" title="Configure Google Fit OAuth & Gemini API">⚙️</button>
        </div>

        <!-- Step Progress Bar -->
        <div class="space-y-1">
          <div class="w-full bg-slate-900/90 h-3 rounded-full overflow-hidden border border-white/10">
            <div class="bg-gradient-to-r ${goalMet ? 'from-emerald-400 to-cyan-400' : 'from-blue-500 to-indigo-500'} h-full transition-all duration-500" style="width:${stepPct}%"></div>
          </div>
          <div class="flex justify-between text-[11px] text-slate-400">
            <span>${stepPct}% of morning goal (${Math.round(steps * 0.04)} kcal active burn)</span>
            <span>${aiFitCfg.lastFitSync || 'Auto-checks habit at 3,000'}</span>
          </div>
        </div>

        <!-- Sync Controls: Google Fit API + Phone Walk Sensor + Quick Add -->
        <div class="flex flex-wrap gap-2">
          <button id="gfitSyncBtn" onclick="syncGoogleFitSteps()" class="flex-1 btn-neon-emerald text-white text-xs font-bold py-2 px-3 rounded-xl">
            👟 Sync Google Fit
          </button>
          <button id="livePedometerBtn" onclick="toggleLivePedometer()" class="px-3 py-2 text-xs font-bold pill-glow hover:bg-white/10 text-emerald-300 rounded-xl">
            ${pedometerActive ? '⏹️ Walking...' : '▶️ Walk Sensor'}
          </button>
        </div>

        <div class="flex items-center justify-between gap-1.5 pt-1 border-t border-white/10">
          <span class="text-[11px] text-slate-400">Quick Step Sync:</span>
          <div class="flex gap-1.5">
            <button onclick="addStepsDelta(500)" class="px-2.5 py-1 text-[11px] mono font-bold pill-glow hover:bg-white/10 rounded-lg">+500</button>
            <button onclick="addStepsDelta(1000)" class="px-2.5 py-1 text-[11px] mono font-bold pill-glow hover:bg-white/10 rounded-lg">+1k</button>
            <button onclick="updateDailySteps(3000, '3k Preset')" class="px-2.5 py-1 text-[11px] mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-lg">Hit 3,000✓</button>
          </div>
        </div>
      </div>

      <!-- RIGHT 7 COLS: AI PROGRESS & TELEMETRY COACH BLOCK -->
      <div class="lg:col-span-7 card p-4 sm:p-5 space-y-3 relative overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-extrabold text-white flex items-center gap-2">
              <span>🧠 AI Progress & Night-Shift Coach</span>
              <span class="mono text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">Live Telemetry</span>
            </h2>
            <p class="text-xs text-slate-400">Synthesizes your macros, 7-day rolling weight (${snap.trends.avgWeight7d} kg), sleep recovery, and steps</p>
          </div>
          <button onclick="generateDeepGeminiCoaching()" class="text-xs btn-neon-blue text-white font-bold px-3 py-1.5 rounded-xl">
            ✨ Refresh AI Insights
          </button>
        </div>

        <div id="aiCoachOutputList" class="space-y-2">
          ${tips.map(tip => `
            <div class="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-200 leading-relaxed">
              ${tip.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300">$1</strong>')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAiAndFitUI);
  } else {
    injectAiAndFitUI();
  }
})();