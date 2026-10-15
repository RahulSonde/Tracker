/**
 * STEALTH RECOVERY & DAILY HABIT VAULT (stealth.js)
 * Tracks Smoking Cessation (Protocol A-1) & Retention/NoPMO (Protocol B-2)
 * Linked automatically to activeDate from index.html
 */

(function () {
  const VAULT_STORAGE_KEY = 'sys_telemetry_v1'; // Neutral key name in localStorage
  let isUnlocked = false;
  let showExplicitNames = false; // Default false = Disguised labels
  let urgeTimerInterval = null;

  // Encode/Decode Base64 so raw text isn't readable in browser DevTools
  function loadVaultDB() {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(decodeURIComponent(atob(raw)));
      } catch (e) {}
    }
    return {
      pin: "1799",
      cigsPerDayBaseline: 5,
      pricePerCigINR: 18,
      days: {}
      // days['YYYY-MM-DD'] = {
      //   smoke: { status: 'clean' | 'urge' | 'slip' | null, count: 0, trigger: '' },
      //   retain: { status: 'clean' | 'urge' | 'slip' | null, trigger: '' }
      // }
    };
  }

  function saveVaultDB() {
    const encoded = btoa(encodeURIComponent(JSON.stringify(vaultDB)));
    localStorage.setItem(VAULT_STORAGE_KEY, encoded);
  }

  let vaultDB = loadVaultDB();

  function getCurrentShiftDate() {
    if (typeof activeDate !== 'undefined' && activeDate) return activeDate;
    const d = new Date();
    if (d.getHours() < 12) d.setDate(d.getDate() - 1);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  }

  function ensureVaultDay(dateStr) {
    if (!vaultDB.days[dateStr]) {
      vaultDB.days[dateStr] = {
        smoke: { status: null, count: 0, trigger: '' },
        retain: { status: null, trigger: '' }
      };
    }
    return vaultDB.days[dateStr];
  }

  // Compute current consecutive clean streak ending on or before selected date
  function calculateStreak(type, refDateStr) {
    let streak = 0;
    let cursor = new Date(refDateStr + "T00:00:00");

    for (let i = 0; i < 365; i++) {
      const offset = cursor.getTimezoneOffset() * 60000;
      const dStr = new Date(cursor.getTime() - offset).toISOString().split('T')[0];
      const entry = vaultDB.days[dStr]?.[type]?.status;

      if (entry === 'clean' || entry === 'urge') {
        streak++;
      } else if (entry === 'slip') {
        break;
      } else {
        // If today isn't logged yet, check yesterday before breaking
        if (i === 0) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function calculateMoneySaved() {
    let cleanDays = 0;
    Object.values(vaultDB.days).forEach(d => {
      if (d.smoke?.status === 'clean' || d.smoke?.status === 'urge') {
        cleanDays++;
      }
    });
    const cigsAvoided = cleanDays * (vaultDB.cigsPerDayBaseline || 5);
    const inrSaved = cigsAvoided * (vaultDB.pricePerCigINR || 18);
    return { cleanDays, cigsAvoided, inrSaved };
  }

  function getWeekDates(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const temp = new Date(mon);
      temp.setDate(mon.getDate() + i);
      const offset = temp.getTimezoneOffset() * 60000;
      return new Date(temp.getTime() - offset).toISOString().split('T')[0];
    });
  }

  // Inject subtle trigger badge & modal shell into DOM
  function injectStealthUI() {
    // 1. Discreet bottom-right system badge (looks like a build version number)
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'stealthTriggerBtn';
    triggerBtn.className = 'fixed bottom-3 right-3 text-[10px] text-slate-600 hover:text-slate-400 bg-slate-900/60 border border-slate-800/80 px-2 py-1 rounded select-none z-40';
    triggerBtn.textContent = 'sys v1.4-sync';
    triggerBtn.title = 'System Diagnostics (Alt + S)';
    triggerBtn.onclick = openStealthModal;
    document.body.appendChild(triggerBtn);

    // 2. Modal Container
    const modal = document.createElement('div');
    modal.id = 'stealthVaultModal';
    modal.className = 'fixed inset-0 bg-black/85 hidden items-center justify-center p-4 z-50 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="card max-w-2xl w-full p-5 space-y-5 max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl" onclick="event.stopPropagation()">
        <div id="stealthModalInner"></div>
      </div>
    `;
    modal.onclick = lockAndCloseVault;
    document.body.appendChild(modal);

    // 3. Keyboard Shortcuts: Alt+S to open, Esc to instant-lock
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openStealthModal();
      } else if (e.key === 'Escape') {
        lockAndCloseVault();
      }
    });
  }

  function openStealthModal() {
    const modal = document.getElementById('stealthVaultModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderStealthContent();
  }

  function lockAndCloseVault() {
    isUnlocked = false;
    showExplicitNames = false;
    if (urgeTimerInterval) clearInterval(urgeTimerInterval);
    const modal = document.getElementById('stealthVaultModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  window.verifyVaultPin = function () {
    const input = document.getElementById('vaultPinInput').value;
    if (input === vaultDB.pin) {
      isUnlocked = true;
      renderStealthContent();
    } else {
      document.getElementById('vaultPinError').textContent = 'Invalid code.';
      document.getElementById('vaultPinInput').value = '';
    }
  };

  window.toggleDisguiseLabels = function () {
    showExplicitNames = !showExplicitNames;
    renderStealthContent();
  };

  window.logStealthStatus = function (type, status) {
    const dStr = getCurrentShiftDate();
    const day = ensureVaultDay(dStr);
    const trigEl = document.getElementById(`${type}TriggerSelect`);
    const triggerVal = trigEl ? trigEl.value : '';

    day[type].status = status;
    day[type].trigger = triggerVal;
    if (type === 'smoke' && (status === 'clean' || status === 'urge')) {
      day.smoke.count = 0;
    }
    saveVaultDB();
    renderStealthContent();
  };

  window.updateSmokeCount = function (delta) {
    const dStr = getCurrentShiftDate();
    const day = ensureVaultDay(dStr);
    const next = Math.max(0, (day.smoke.count || 0) + delta);
    day.smoke.count = next;
    if (next > 0) day.smoke.status = 'slip';
    saveVaultDB();
    renderStealthContent();
  };

  window.updateVaultSettings = function () {
    const baseCigs = parseInt(document.getElementById('setBaseCigs').value, 10) || 5;
    const cigPrice = parseInt(document.getElementById('setCigPrice').value, 10) || 18;
    const newPin = document.getElementById('setNewPin').value.trim();

    vaultDB.cigsPerDayBaseline = baseCigs;
    vaultDB.pricePerCigINR = cigPrice;
    if (newPin && newPin.length >= 4) {
      vaultDB.pin = newPin;
    }
    saveVaultDB();
    renderStealthContent();
  };

  window.startUrgeTimer = function () {
    if (urgeTimerInterval) clearInterval(urgeTimerInterval);
    let remaining = 90;
    const display = document.getElementById('urgeTimerDisplay');
    urgeTimerInterval = setInterval(() => {
      remaining--;
      if (!display) {
        clearInterval(urgeTimerInterval);
        return;
      }
      if (remaining <= 0) {
        clearInterval(urgeTimerInterval);
        display.textContent = "90s Complete — Craving Wave Passed!";
        display.className = "text-xs font-bold text-emerald-400";
      } else {
        display.textContent = `Hold steady: ${remaining}s remaining (Deep inhale 4s, slow exhale 6s)`;
      }
    }, 1000);
  };

  function renderWeekStrip(type, activeDateStr) {
    const weekDates = getWeekDates(activeDateStr);
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return weekDates.map((dStr, i) => {
      const status = vaultDB.days[dStr]?.[type]?.status;
      let bg = 'bg-slate-800 text-slate-400 border-slate-700';
      let icon = dayNames[i];
      if (status === 'clean') {
        bg = 'bg-emerald-900/70 text-emerald-300 border-emerald-600';
        icon = '✓';
      } else if (status === 'urge') {
        bg = 'bg-cyan-900/70 text-cyan-300 border-cyan-500';
        icon = '⚡';
      } else if (status === 'slip') {
        bg = 'bg-rose-950 text-rose-400 border-rose-700';
        icon = '↺';
      }
      const ring = dStr === activeDateStr ? 'ring-2 ring-blue-400' : '';
      return `
        <div class="flex flex-col items-center gap-1" title="${dStr}: ${status || 'Unlogged'}">
          <div class="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${bg} ${ring}">${icon}</div>
          <span class="text-[10px] text-slate-500">${dStr.slice(8)}</span>
        </div>
      `;
    }).join('');
  }

  function renderStealthContent() {
    const container = document.getElementById('stealthModalInner');
    if (!container) return;

    // 1. PIN LOCK SCREEN
    if (!isUnlocked) {
      container.innerHTML = `
        <div class="py-6 text-center space-y-4">
          <div class="text-xs uppercase tracking-widest text-slate-400">System Telemetry & Diagnostics</div>
          <h3 class="text-lg font-bold text-white">Enter Access Passcode</h3>
          <div class="flex justify-center gap-2 max-w-xs mx-auto">
            <input type="password" id="vaultPinInput" maxlength="8" placeholder="••••"
              class="text-center text-lg tracking-widest w-36"
              onkeydown="if(event.key==='Enter') verifyVaultPin()" autofocus />
            <button onclick="verifyVaultPin()" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg">Unlock</button>
          </div>
          <div id="vaultPinError" class="text-xs text-rose-400 h-4"></div>
          <p class="text-[11px] text-slate-500">Press Esc or click outside to close immediately</p>
        </div>
      `;
      setTimeout(() => document.getElementById('vaultPinInput')?.focus(), 50);
      return;
    }

    // 2. UNLOCKED VAULT DASHBOARD
    const dStr = getCurrentShiftDate();
    const day = ensureVaultDay(dStr);

    const smokeTitle = showExplicitNames ? "Quit Smoking Tracker" : "Protocol A-1 (Airflow / Nicotine)";
    const retainTitle = showExplicitNames ? "Quit Masturbation (Retention)" : "Protocol B-2 (Dopamine / Focus)";

    const smokeStreak = calculateStreak('smoke', dStr);
    const retainStreak = calculateStreak('retain', dStr);
    const savings = calculateMoneySaved();

    container.innerHTML = `
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-white">Private Recovery & Discipline Vault</h3>
            <span class="text-xs bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">Shift Date: ${dStr}</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Synced with your active shift date • Press <kbd class="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">Esc</kbd> anytime to instant-hide</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="toggleDisguiseLabels()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg">
            ${showExplicitNames ? '🙈 Hide Explicit Labels' : '👁️ Show Real Labels'}
          </button>
          <button onclick="(${lockAndCloseVault.toString()})()" class="text-xs bg-rose-900/70 hover:bg-rose-800 text-rose-200 px-3 py-1.5 rounded-lg font-semibold">
            🔒 Lock (Esc)
          </button>
        </div>
      </div>

      <!-- Night-Shift 90-Second Urge Breaker -->
      <div class="bg-slate-900/90 border border-indigo-900/60 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div class="text-xs font-semibold text-indigo-300">Night-Shift Craving / Urge Breaker (2 AM – 6 AM Window)</div>
          <div id="urgeTimerDisplay" class="text-xs text-slate-400 mt-0.5">Most nicotine and dopamine urges peak and subside within 90 seconds if you delay action.</div>
        </div>
        <button onclick="startUrgeTimer()" class="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
          ⚡ Start 90s Reset Timer
        </button>
      </div>

      <!-- TWO TRACKER CARDS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- CARD 1: QUIT SMOKING (PROTOCOL A-1) -->
        <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-xs text-slate-400 uppercase font-semibold">${smokeTitle}</div>
              <div class="text-2xl font-bold text-emerald-400 mt-0.5">${smokeStreak} <span class="text-sm font-normal text-slate-400">days clean</span></div>
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400">Saved Total</div>
              <div class="text-sm font-bold text-amber-400">₹${savings.inrSaved.toLocaleString()} <span class="text-[11px] font-normal text-slate-400">(${savings.cigsAvoided} avoided)</span></div>
            </div>
          </div>

          <!-- Today's Status Badge -->
          <div class="text-xs py-1.5 px-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between items-center">
            <span>Status (${dStr}):</span>
            <span class="font-bold ${
              day.smoke.status === 'clean' ? 'text-emerald-400' :
              day.smoke.status === 'urge' ? 'text-cyan-400' :
              day.smoke.status === 'slip' ? 'text-rose-400' : 'text-slate-500'
            }">${
              day.smoke.status === 'clean' ? '✓ Clean Day Logged' :
              day.smoke.status === 'urge' ? '⚡ Urge Defeated!' :
              day.smoke.status === 'slip' ? `↺ Slip (${day.smoke.count || 1} cigs)` : 'Not logged yet'
            }</span>
          </div>

          <!-- Trigger Tag -->
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Shift Trigger / Context (Optional)</label>
            <select id="smokeTriggerSelect" class="w-full text-xs">
              <option value="None / Smooth Shift" ${day.smoke.trigger === 'None / Smooth Shift' ? 'selected' : ''}>None / Smooth Shift</option>
              <option value="Night-Shift Break / Colleagues" ${day.smoke.trigger === 'Night-Shift Break / Colleagues' ? 'selected' : ''}>Night-Shift Break / Colleagues</option>
              <option value="Work Stress / Escalation" ${day.smoke.trigger === 'Work Stress / Escalation' ? 'selected' : ''}>Work Stress / Escalation</option>
              <option value="Post-Meal / Chai Pairing" ${day.smoke.trigger === 'Post-Meal / Chai Pairing' ? 'selected' : ''}>Post-Meal / Chai Pairing</option>
              <option value="Late-Shift Fatigue (3AM–5AM)" ${day.smoke.trigger === 'Late-Shift Fatigue (3AM–5AM)' ? 'selected' : ''}>Late-Shift Fatigue (3AM–5AM)</option>
            </select>
          </div>

          <!-- Daily Log Buttons -->
          <div class="grid grid-cols-3 gap-2 pt-1">
            <button onclick="logStealthStatus('smoke', 'clean')" class="bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold py-2 rounded-lg">✓ Clean</button>
            <button onclick="logStealthStatus('smoke', 'urge')" class="bg-cyan-700/80 hover:bg-cyan-600 text-white text-xs font-semibold py-2 rounded-lg">⚡ Beat Urge</button>
            <button onclick="logStealthStatus('smoke', 'slip')" class="bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-semibold py-2 rounded-lg">↺ Slip</button>
          </div>

          <!-- Optional Unit Counter if tapering or slipped -->
          <div class="flex items-center justify-between text-xs pt-1 text-slate-400">
            <span>Units today (if any): <strong class="text-white">${day.smoke.count || 0}</strong></span>
            <div class="flex gap-1">
              <button onclick="updateSmokeCount(-1)" class="px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700">-</button>
              <button onclick="updateSmokeCount(1)" class="px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700">+</button>
            </div>
          </div>

          <!-- 7-Day Visual Strip -->
          <div class="pt-2 border-t border-slate-800">
            <div class="text-[11px] text-slate-400 mb-1.5">This Week's Streak (Mon–Sun)</div>
            <div class="flex justify-between">${renderWeekStrip('smoke', dStr)}</div>
          </div>
        </div>

        <!-- CARD 2: QUIT MASTURBATION / RETENTION (PROTOCOL B-2) -->
        <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-xs text-slate-400 uppercase font-semibold">${retainTitle}</div>
              <div class="text-2xl font-bold text-blue-400 mt-0.5">${retainStreak} <span class="text-sm font-normal text-slate-400">days clean</span></div>
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400">Next Milestone</div>
              <div class="text-sm font-bold text-indigo-300">${retainStreak < 7 ? '7 Days' : retainStreak < 14 ? '14 Days' : retainStreak < 30 ? '30 Days' : '90 Days'}</div>
            </div>
          </div>

          <!-- Today's Status Badge -->
          <div class="text-xs py-1.5 px-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between items-center">
            <span>Status (${dStr}):</span>
            <span class="font-bold ${
              day.retain.status === 'clean' ? 'text-emerald-400' :
              day.retain.status === 'urge' ? 'text-cyan-400' :
              day.retain.status === 'slip' ? 'text-rose-400' : 'text-slate-500'
            }">${
              day.retain.status === 'clean' ? '✓ Clean Day Logged' :
              day.retain.status === 'urge' ? '⚡ Urge Defeated!' :
              day.retain.status === 'slip' ? '↺ Reset Logged' : 'Not logged yet'
            }</span>
          </div>

          <!-- Trigger Tag -->
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Shift Trigger / Vulnerability Window</label>
            <select id="retainTriggerSelect" class="w-full text-xs">
              <option value="Focused / Disciplined" ${day.retain.trigger === 'Focused / Disciplined' ? 'selected' : ''}>Focused / Disciplined</option>
              <option value="Post-Shift Wind-Down (6AM–8AM)" ${day.retain.trigger === 'Post-Shift Wind-Down (6AM–8AM)' ? 'selected' : ''}>Post-Shift Wind-Down (6AM–8AM in bed)</option>
              <option value="Doomscrolling / Phone in Bed" ${day.retain.trigger === 'Doomscrolling / Phone in Bed' ? 'selected' : ''}>Doomscrolling / Phone in Bed</option>
              <option value="Boredom / Alone on Weekend" ${day.retain.trigger === 'Boredom / Alone on Weekend' ? 'selected' : ''}>Boredom / Alone on Off-Day</option>
              <option value="Sleep Deprivation / Stress" ${day.retain.trigger === 'Sleep Deprivation / Stress' ? 'selected' : ''}>Sleep Deprivation / High Stress</option>
            </select>
          </div>

          <!-- Daily Log Buttons -->
          <div class="grid grid-cols-3 gap-2 pt-1">
            <button onclick="logStealthStatus('retain', 'clean')" class="bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold py-2 rounded-lg">✓ Clean</button>
            <button onclick="logStealthStatus('retain', 'urge')" class="bg-cyan-700/80 hover:bg-cyan-600 text-white text-xs font-semibold py-2 rounded-lg">⚡ Beat Urge</button>
            <button onclick="logStealthStatus('retain', 'slip')" class="bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-semibold py-2 rounded-lg">↺ Reset</button>
          </div>

          <div class="text-[11px] text-slate-400 pt-1">
            Rule: Keep phone charging away from bed at 7:00 AM after your morning walk.
          </div>

          <!-- 7-Day Visual Strip -->
          <div class="pt-2 border-t border-slate-800">
            <div class="text-[11px] text-slate-400 mb-1.5">This Week's Streak (Mon–Sun)</div>
            <div class="flex justify-between">${renderWeekStrip('retain', dStr)}</div>
          </div>
        </div>

      </div>

      <!-- Vault Settings (PIN & Savings Config) -->
      <details class="bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-xs">
        <summary class="text-slate-400 font-medium cursor-pointer">Vault Settings (Change PIN & Cigarette Cost Baseline)</summary>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3 items-end">
          <div>
            <label class="text-slate-400 block mb-1">Baseline Cigs/Day</label>
            <input type="number" id="setBaseCigs" value="${vaultDB.cigsPerDayBaseline || 5}" class="w-full" />
          </div>
          <div>
            <label class="text-slate-400 block mb-1">Cost per Cig (₹)</label>
            <input type="number" id="setCigPrice" value="${vaultDB.pricePerCigINR || 18}" class="w-full" />
          </div>
          <div>
            <label class="text-slate-400 block mb-1">New Vault PIN</label>
            <input type="password" id="setNewPin" placeholder="Current: ${vaultDB.pin}" class="w-full" />
          </div>
          <button onclick="updateVaultSettings()" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg">Save Config</button>
        </div>
      </details>
    `;
  }

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStealthUI);
  } else {
    injectStealthUI();
  }
})();