/**
 * REAL-TIME CLOUD DATABASE SYNC ENGINE (cloud-sync.js)
 * Pre-configured for Firebase Project: tracker-cfa6d
 * Automatically syncs Meals, Sleep, Weight, Custom Barcodes & Encrypted Stealth Vault
 */

(function () {
  const CLOUD_CFG_KEY = 'rahul_firebase_cloud_cfg_v1';
  const TRACKED_KEYS = [
    'rahul_fatloss_tracker_v1',
    'rahul_custom_barcodes_v1',
    'sys_telemetry_v1'
  ];

  // Your exact Firebase Web Configuration
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDgXdKjqrl18I8J3s1la50V9q3H5BOJbkY",
    authDomain: "tracker-cfa6d.firebaseapp.com",
    projectId: "tracker-cfa6d",
    storageBucket: "tracker-cfa6d.firebasestorage.app",
    messagingSenderId: "186403792059",
    appId: "1:186403792059:web:f264a3283568a0d8a9359e",
    measurementId: "G-ZWE3EX8LFW",
    syncId: "rahul_private_vault_2026",
    autoSync: true,
    lastSynced: null
  };

  let syncTimeout = null;
  let isApplyingRemote = false;
  const origSetItem = localStorage.setItem;

  function loadCloudConfig() {
    try {
      const raw = localStorage.getItem(CLOUD_CFG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_FIREBASE_CONFIG,
          ...parsed,
          apiKey: parsed.apiKey || DEFAULT_FIREBASE_CONFIG.apiKey,
          projectId: parsed.projectId || DEFAULT_FIREBASE_CONFIG.projectId
        };
      }
    } catch (e) {}
    return { ...DEFAULT_FIREBASE_CONFIG };
  }

  function saveCloudConfig(cfg) {
    origSetItem.call(localStorage, CLOUD_CFG_KEY, JSON.stringify(cfg));
  }

  let cloudCfg = loadCloudConfig();
  saveCloudConfig(cloudCfg);

  // Intercept every local save (meals, weight, sleep, barcodes, stealth logs) and push to Firestore
  localStorage.setItem = function (key, value) {
    origSetItem.call(localStorage, key, value);
    if (!isApplyingRemote && TRACKED_KEYS.includes(key) && cloudCfg.projectId && cloudCfg.apiKey && cloudCfg.autoSync) {
      updateStatusBadge('syncing', '☁️ Syncing...');
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        pushToFirestore(false);
      }, 800);
    }
  };

  function getFirestoreDocUrl() {
    const proj = encodeURIComponent(cloudCfg.projectId.trim());
    const docId = encodeURIComponent(cloudCfg.syncId.trim());
    const key = encodeURIComponent(cloudCfg.apiKey.trim());
    return `https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents/nightshift_tracker_sync/${docId}?key=${key}`;
  }

  window.pushToFirestore = async function (showAlert = true) {
    updateStatusBadge('syncing', '☁️ Uploading...');
    const payload = {
      fields: {
        updatedAt: { stringValue: new Date().toISOString() },
        mainDB: { stringValue: localStorage.getItem('rahul_fatloss_tracker_v1') || '{}' },
        barcodeDB: { stringValue: localStorage.getItem('rahul_custom_barcodes_v1') || '{}' },
        stealthDB: { stringValue: localStorage.getItem('sys_telemetry_v1') || '' }
      }
    };

    try {
      const res = await fetch(getFirestoreDocUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }

      cloudCfg.lastSynced = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      saveCloudConfig(cloudCfg);
      updateStatusBadge('ok', `☁️ Synced ${cloudCfg.lastSynced}`);
      if (showAlert) alert('Cloud Sync Complete! Data saved to tracker-cfa6d.');
    } catch (err) {
      updateStatusBadge('err', '☁️ Sync Error');
      if (showAlert) {
        alert(`Firestore Error: ${err.message}\n\nMake sure you have clicked "Create Database" under Firestore Database in the Firebase Console and set Rules to allow read/write.`);
      }
    }
  };

  window.pullFromFirestore = async function (silentOnStartup = false) {
    updateStatusBadge('syncing', '☁️ Checking Cloud...');
    try {
      const res = await fetch(getFirestoreDocUrl(), { method: 'GET' });
      if (res.status === 404) {
        // Document doesn't exist in Firestore yet — push current local state to create it
        await pushToFirestore(false);
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }

      const doc = await res.json();
      const f = doc.fields || {};

      isApplyingRemote = true;
      if (f.mainDB?.stringValue && f.mainDB.stringValue !== '{}') {
        origSetItem.call(localStorage, 'rahul_fatloss_tracker_v1', f.mainDB.stringValue);
        if (typeof db !== 'undefined') {
          try { db = JSON.parse(f.mainDB.stringValue); } catch (e) {}
        }
      }
      if (f.barcodeDB?.stringValue && f.barcodeDB.stringValue !== '{}') {
        origSetItem.call(localStorage, 'rahul_custom_barcodes_v1', f.barcodeDB.stringValue);
      }
      if (f.stealthDB?.stringValue) {
        origSetItem.call(localStorage, 'sys_telemetry_v1', f.stealthDB.stringValue);
      }
      isApplyingRemote = false;

      if (typeof populatePresetDropdown === 'function') populatePresetDropdown();
      if (typeof renderAll === 'function') renderAll();

      cloudCfg.lastSynced = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      saveCloudConfig(cloudCfg);
      updateStatusBadge('ok', `☁️ Synced ${cloudCfg.lastSynced}`);

      if (!silentOnStartup) {
        alert('Pulled latest data from tracker-cfa6d!');
        closeCloudModal();
      }
    } catch (err) {
      isApplyingRemote = false;
      updateStatusBadge('err', '☁️ Check Rules');
      if (!silentOnStartup) alert(`Cloud Pull Error: ${err.message}`);
    }
  };

  function updateStatusBadge(state, text) {
    const btn = document.getElementById('cloudStatusBtn');
    if (!btn) return;
    btn.textContent = text;
    if (state === 'ok') {
      btn.className = 'px-2.5 py-1.5 text-xs font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 rounded-lg';
    } else if (state === 'syncing') {
      btn.className = 'px-2.5 py-1.5 text-xs font-medium bg-blue-950/70 text-blue-300 border border-blue-700/60 rounded-lg animate-pulse';
    } else {
      btn.className = 'px-2.5 py-1.5 text-xs font-medium bg-rose-950/70 text-rose-300 border border-rose-700/60 rounded-lg';
    }
  }

  function injectCloudUI() {
    const headerControls = document.getElementById('activeDateInput')?.parentElement;
    if (headerControls) {
      const btn = document.createElement('button');
      btn.id = 'cloudStatusBtn';
      btn.onclick = openCloudModal;
      btn.textContent = '☁️ Connecting...';
      btn.className = 'px-2.5 py-1.5 text-xs font-medium bg-blue-950/70 text-blue-300 border border-blue-700/60 rounded-lg';
      headerControls.prepend(btn);
    }

    const modal = document.createElement('div');
    modal.id = 'cloudSyncModal';
    modal.className = 'fixed inset-0 bg-black/80 hidden items-center justify-center p-4 z-50 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="card max-w-lg w-full p-5 space-y-4 border border-slate-700" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center border-b border-slate-800 pb-2.5">
          <div>
            <h3 class="text-base font-bold text-white">☁️ Connected: Firebase (tracker-cfa6d)</h3>
            <p class="text-xs text-slate-400">Real-time sync for Meals, Sleep, Weight, Barcodes & Stealth Vault</p>
          </div>
          <button onclick="closeCloudModal()" class="text-slate-400 hover:text-white text-sm">✕</button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Firebase Project ID</label>
            <input type="text" id="cfgProjectId" value="${cloudCfg.projectId}" class="w-full" />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Private Sync Document Key</label>
            <input type="text" id="cfgSyncId" value="${cloudCfg.syncId}" class="w-full font-mono text-emerald-300" />
          </div>
          <label class="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
            <input type="checkbox" id="cfgAutoSync" ${cloudCfg.autoSync ? 'checked' : ''} class="accent-emerald-500" />
            <span>Auto-sync every log immediately to Firestore</span>
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <button onclick="saveCloudSettings()" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg">
            Save Config
          </button>
          <button onclick="pushToFirestore(true)" class="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold py-2 rounded-lg">
            ⬆️ Force Push
          </button>
          <button onclick="pullFromFirestore(false)" class="bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold py-2 rounded-lg">
            ⬇️ Force Pull
          </button>
        </div>
      </div>
    `;
    modal.onclick = closeCloudModal;
    document.body.appendChild(modal);

    // Automatically sync on page load
    pullFromFirestore(true);
  }

  window.openCloudModal = function () {
    document.getElementById('cfgProjectId').value = cloudCfg.projectId;
    document.getElementById('cfgSyncId').value = cloudCfg.syncId;
    document.getElementById('cfgAutoSync').checked = !!cloudCfg.autoSync;
    const m = document.getElementById('cloudSyncModal');
    m.classList.remove('hidden');
    m.classList.add('flex');
  };

  window.closeCloudModal = function () {
    const m = document.getElementById('cloudSyncModal');
    m.classList.add('hidden');
    m.classList.remove('flex');
  };

  window.saveCloudSettings = function () {
    cloudCfg.projectId = document.getElementById('cfgProjectId').value.trim() || DEFAULT_FIREBASE_CONFIG.projectId;
    cloudCfg.syncId = document.getElementById('cfgSyncId').value.trim() || DEFAULT_FIREBASE_CONFIG.syncId;
    cloudCfg.autoSync = document.getElementById('cfgAutoSync').checked;
    saveCloudConfig(cloudCfg);
    pushToFirestore(true);
    closeCloudModal();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCloudUI);
  } else {
    injectCloudUI();
  }
})();