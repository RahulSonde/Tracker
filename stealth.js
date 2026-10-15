/**
 * STEALTH RECOVERY & DAILY HABIT VAULT v2 (stealth.js)
 * Fixed: Re-reads localStorage whenever Cloud Sync pulls remote data from Firebase
 */

(function () {
  const VAULT_STORAGE_KEY = 'sys_telemetry_v1';
  let isUnlocked = false;
  let showExplicitNames = false;
  let urgeTimerInterval = null;

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
    };
  }

  let vaultDB = loadVaultDB();

  function saveVaultDB() {
    const encoded = btoa(encodeURIComponent(JSON.stringify(vaultDB)));
    localStorage.setItem(VAULT_STORAGE_KEY, encoded);
  }

  // Hook called automatically by cloud-sync.js when remote Firestore data arrives
  window.refreshStealthFromCloud = function () {
    vaultDB = loadVaultDB();
    if (isUnlocked) renderStealthContent();
  };

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
      if (d.smoke?.status === 'clean' || d.smoke?.status === 'urge') cleanDays++;
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

  function injectStealthUI() {
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'stealthTriggerBtn';
    triggerBtn.className = 'fixed bottom-3 right-3 mono text-[10px] text-slate-500 hover:text-cyan-300 pill-glow px-2.5 py-1 rounded-full select-none z-40';
    triggerBtn.textContent = 'sys v2.0-sync';
    triggerBtn.title = 'System Diagnostics (Alt + S)';
    triggerBtn.onclick = openStealthModal;
    document.body.appendChild(triggerBtn);

    const modal = document.createElement('div');
    modal.id = 'stealthVaultModal';
    modal.className = 'fixed inset-0 bg-black/85 hidden items-center justify-center p-4 z-50 backdrop-blur-xl';
    modal.innerHTML = `
      <div class="card max-w-2xl w-full p-5 space-y-5 max-h-[90vh] overflow-y-auto border border-white/15 shadow-2xl" onclick="event.stopPropagation()">
        <div id="stealthModalInner"></div>
      </div>
    `;
    modal.onclick = lockAndCloseVault;
    document.body.appendChild(modal);

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
    // Always reload latest state from localStorage (in case cloud-sync updated it)
    vaultDB = loadVaultDB();
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
    vaultDB = loadVaultDB();
    const input = document.getElementById('vaultPinInput').value;
    if (input === vaultDB.pin) {
      isUnlocked = true;
      renderStealthContent();
    } else {
      document.getElementById('vaultPinError').textContent = 'Invalid access passcode.';
      document.getElementById('vaultPinInput').value = '';
    }
  };

  window.toggleDisguiseLabels = function () {
    showExplicitNames = !showExplicitNames;
    renderStealthContent();
  };

  window.logStealthStatus = function (type, status) {
    vaultDB = loadVaultDB();
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
    vaultDB = loadVaultDB();
    const dStr = getCurrentShiftDate();
    const day = ensureVaultDay(dStr);
    const next = Math.max(0, (day.smoke.count || 0) + delta);
    day.smoke.count = next;
    if (next > 0) day.smoke.status = 'slip';
    saveVaultDB();
    renderStealthContent();
  };

  window.updateVaultSettings = function () {
    vaultDB = loadVaultDB();
    const baseCigs = parseInt(document.getElementById('setBaseCigs').value, 10) || 5;
    const cigPrice = parseInt(document.getElementById('setCigPrice').value, 10) || 18;
    const newPin = document.getElementById('setNewPin').value.trim();

    vaultDB.cigsPerDayBaseline = baseCigs;
    vaultDB.pricePerCigINR = cigPrice;
    if (newPin && newPin.length >= 4) vaultDB.pin = newPin;
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
        display.textContent = "✅ 90s Complete — Craving Wave Passed!";
        display.className = "text-xs font-bold text-emerald-400";
      } else {
        display.textContent = `Hold steady: ${remaining}s remaining (Inhale 4s, slow exhale 6s)`;
      }
    }, 1000);
  };

  function renderWeekStrip(type, activeDateStr) {
    const weekDates = getWeekDates(activeDateStr);
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return weekDates.map((dStr, i) => {
      const status = vaultDB.days[dStr]?.[type]?.status;
      let bg = 'bg-slate-900 text-slate-400 border-white/10';
      let icon = dayNames[i];
      if (status === 'clean') {
        bg = 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50';
        icon = '✓';
      } else if (status === 'urge') {
        bg = 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50';
        icon = '⚡';
      } else if (status === 'slip') {
        bg = 'bg-rose-500/20 text-rose-300 border-rose-500/50';
        icon = '↺';
      }
      const ring = dStr === activeDateStr ? 'ring-2 ring-cyan-400' : '';
      return `
        <div class="flex flex-col items-center gap-1" title="${dStr}: ${status || 'Unlogged'}">
          <div class="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${bg} ${ring}">${icon}</div>
          <span class="mono text-[10px] text-slate-500">${dStr.slice(8)}</span>
        </div>
      `;
    }).join('');
  }

  function renderStealthContent() {
    const container = document.getElementById('stealthModalInner');
    if (!container) return;

    if (!isUnlocked) {
      container.innerHTML = `
        <div class="py-6 text-center space-y-4">
          <div class="mono text-xs uppercase tracking-widest text-cyan-400">Encrypted System Telemetry</div>
          <h3 class="text-lg font-extrabold text-white">Enter Vault Passcode</h3>
          <div class="flex justify-center gap-2 max-w-xs mx-auto">
            <input type="password" id="vaultPinInput" maxlength="8" placeholder="••••"
              class="text-center text-lg tracking-widest w-36 mono"
              onkeydown="if(event.key==='Enter') verifyVaultPin()" autofocus />
            <button onclick="verifyVaultPin()" class="btn-neon-blue text-white text-xs font-bold px-4 py-2 rounded-xl">Unlock</button>
          </div>
          <div id="vaultPinError" class="text-xs text-rose-400 h-4"></div>
          <p class="text-[11px] text-slate-500">Press Esc or tap outside to close</p>
        </div>
      `;
      setTimeout(() => document.getElementById('vaultPinInput')?.focus(), 50);
      return;
    }

    const dStr = getCurrentShiftDate();
    const day = ensureVaultDay(dStr);
    const totalDaysLogged = Object.keys(vaultDB.days).length;

    const smokeTitle = showExplicitNames ? "Quit Smoking Tracker" : "Protocol A-1 (Airflow / Nicotine)";
    const retainTitle = showExplicitNames ? "Quit Masturbation (Retention)" : "Protocol B-2 (Dopamine / Focus)";

    const smokeStreak = calculateStreak('smoke', dStr);
    const retainStreak = calculateStreak('retain', dStr);
    const savings = calculateMoneySaved();

    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-base font-extrabold text-white">Stealth Recovery & Discipline Vault</h3>
            <span class="mono text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">☁️ ${totalDaysLogged}d Encrypted in DB</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Active Shift Date: <strong class="mono text-cyan-300">${dStr}</strong> • Press <kbd class="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">Esc</kbd> to instant-lock</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="toggleDisguiseLabels()" class="text-xs pill-glow hover:bg-white/10 text-slate-200 px-2.5 py-1.5 rounded-xl">
            ${showExplicitNames ? '🙈 Disguise Labels' : '👁️ Reveal Labels'}
          </button>
          <button onclick="(${lockAndCloseVault.toString()})()" class="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 px-3 py-1.5 rounded-xl font-bold">
            🔒 Lock
          </button>
        </div>
      </div>

      <div class="pill-glow rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div class="text-xs font-bold text-cyan-300">⚡ 90-Second Night-Shift Urge Breaker</div>
          <div id="urgeTimerDisplay" class="text-xs text-slate-400 mt-0.5">Delay action for 90 seconds to let dopamine/nicotine craving waves pass.</div>
        </div>
        <button onclick="startUrgeTimer()" class="shrink-0 btn-neon-blue text-white text-xs font-bold px-3 py-1.5 rounded-xl">
          Start 90s Timer
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- PROTOCOL A-1 -->
        <div class="pill-glow rounded-2xl p-4 space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-[11px] text-slate-400 uppercase font-bold">${smokeTitle}</div>
              <div class="mono text-2xl font-extrabold text-emerald-400 mt-0.5">${smokeStreak} <span class="text-xs font-normal text-slate-400">days clean</span></div>
            </div>
            <div class="text-right">
              <div class="text-[11px] text-slate-400">Saved</div>
              <div class="mono text-sm font-bold text-amber-400">₹${savings.inrSaved.toLocaleString()} <span class="text-[10px] text-slate-400">(${savings.cigsAvoided})</span></div>
            </div>
          </div>

          <div class="text-xs py-1.5 px-2.5 rounded-lg bg-black/40 border border-white/5 flex justify-between items-center">
            <span>Status (${dStr}):</span>
            <span class="font-bold ${
              day.smoke.status === 'clean' ? 'text-emerald-400' :
              day.smoke.status === 'urge' ? 'text-cyan-400' :
              day.smoke.status === 'slip' ? 'text-rose-400' : 'text-slate-500'
            }">${
              day.smoke.status === 'clean' ? '✓ Clean Day' :
              day.smoke.status === 'urge' ? '⚡ Urge Defeated!' :
              day.smoke.status === 'slip' ? `↺ Slip (${day.smoke.count || 1})` : 'Unlogged'
            }</span>
          </div>

          <select id="smokeTriggerSelect" class="w-full text-xs">
            <option value="Smooth Shift">Smooth Shift</option>
            <option value="Night-Shift Break / Colleagues">Night-Shift Break / Colleagues</option>
            <option value="Work Stress">Work Stress</option>
            <option value="Post-Meal / Chai">Post-Meal / Chai</option>
            <option value="Late-Shift Fatigue (3AM–5AM)">Late-Shift Fatigue (3AM–5AM)</option>
          </select>

          <div class="grid grid-cols-3 gap-2">
            <button onclick="logStealthStatus('smoke', 'clean')" class="btn-neon-emerald text-white text-xs font-bold py-2 rounded-xl">✓ Clean</button>
            <button onclick="logStealthStatus('smoke', 'urge')" class="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 rounded-xl">⚡ Beat Urge</button>
            <button onclick="logStealthStatus('smoke', 'slip')" class="bg-rose-900/70 hover:bg-rose-800 text-rose-200 text-xs font-bold py-2 rounded-xl">↺ Slip</button>
          </div>

          <div class="flex items-center justify-between text-xs pt-1 text-slate-400">
            <span>Units today: <strong class="mono text-white">${day.smoke.count || 0}</strong></span>
            <div class="flex gap-1">
              <button onclick="updateSmokeCount(-1)" class="px-2.5 py-0.5 pill-glow rounded hover:bg-white/10">-</button>
              <button onclick="updateSmokeCount(1)" class="px-2.5 py-0.5 pill-glow rounded hover:bg-white/10">+</button>
            </div>
          </div>

          <div class="pt-2 border-t border-white/10">
            <div class="flex justify-between">${renderWeekStrip('smoke', dStr)}</div>
          </div>
        </div>

        <!-- PROTOCOL B-2 -->
        <div class="pill-glow rounded-2xl p-4 space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-[11px] text-slate-400 uppercase font-bold">${retainTitle}</div>
              <div class="mono text-2xl font-extrabold text-cyan-400 mt-0.5">${retainStreak} <span class="text-xs font-normal text-slate-400">days clean</span></div>
            </div>
            <div class="text-right">
              <div class="text-[11px] text-slate-400">Target</div>
              <div class="mono text-sm font-bold text-indigo-300">${retainStreak < 7 ? '7 Days' : retainStreak < 14 ? '14 Days' : retainStreak < 30 ? '30 Days' : '90 Days'}</div>
            </div>
          </div>

          <div class="text-xs py-1.5 px-2.5 rounded-lg bg-black/40 border border-white/5 flex justify-between items-center">
            <span>Status (${dStr}):</span>
            <span class="font-bold ${
              day.retain.status === 'clean' ? 'text-emerald-400' :
              day.retain.status === 'urge' ? 'text-cyan-400' :
              day.retain.status === 'slip' ? 'text-rose-400' : 'text-slate-500'
            }">${
              day.retain.status === 'clean' ? '✓ Clean Day' :
              day.retain.status === 'urge' ? '⚡ Urge Defeated!' :
              day.retain.status === 'slip' ? '↺ Reset Logged' : 'Unlogged'
            }</span>
          </div>

          <select id="retainTriggerSelect" class="w-full text-xs">
            <option value="Focused / Disciplined">Focused / Disciplined</option>
            <option value="Post-Shift Wind-Down (6AM–8AM)">Post-Shift Wind-Down (6AM–8AM)</option>
            <option value="Phone in Bed">Phone in Bed</option>
            <option value="Weekend Boredom">Weekend Boredom</option>
            <option value="Sleep Deprivation / Stress">Sleep Deprivation / Stress</option>
          </select>

          <div class="grid grid-cols-3 gap-2">
            <button onclick="logStealthStatus('retain', 'clean')" class="btn-neon-emerald text-white text-xs font-bold py-2 rounded-xl">✓ Clean</button>
            <button onclick="logStealthStatus('retain', 'urge')" class="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 rounded-xl">⚡ Beat Urge</button>
            <button onclick="logStealthStatus('retain', 'slip')" class="bg-rose-900/70 hover:bg-rose-800 text-rose-200 text-xs font-bold py-2 rounded-xl">↺ Reset</button>
          </div>

          <div class="text-[11px] text-slate-400 pt-1">
            Rule: Charge phone away from bed at 7:00 AM after post-shift walk.
          </div>

          <div class="pt-2 border-t border-white/10">
            <div class="flex justify-between">${renderWeekStrip('retain', dStr)}</div>
          </div>
        </div>
      </div>

      <details class="pill-glow rounded-xl p-3 text-xs">
        <summary class="text-slate-400 font-semibold cursor-pointer">⚙️ Vault Passcode & Baseline Settings</summary>
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3 items-end">
          <div>
            <label class="text-slate-400 block mb-1">Baseline Cigs/Day</label>
            <input type="number" id="setBaseCigs" value="${vaultDB.cigsPerDayBaseline || 5}" class="w-full mono" />
          </div>
          <div>
            <label class="text-slate-400 block mb-1">Cost per Cig (₹)</label>
            <input type="number" id="setCigPrice" value="${vaultDB.pricePerCigINR || 18}" class="w-full mono" />
          </div>
          <div>
            <label class="text-slate-400 block mb-1">New PIN</label>
            <input type="password" id="setNewPin" placeholder="Current: ${vaultDB.pin}" class="w-full mono" />
          </div>
          <button onclick="updateVaultSettings()" class="btn-neon-blue text-white font-bold py-2 rounded-xl">Save</button>
        </div>
      </details>
    `;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStealthUI);
  } else {
    injectStealthUI();
  }
})();