/**
 * ADVANCED ANALYTICS, HEATMAP & ADAPTIVE TDEE ENGINE (analytics.js)
 * Features:
 * 1. Monthly Consistency Heatmap (30-day GitHub style habit matrix)
 * 2. 7-Day Rolling Weight Trend Chart (Chart.js canvas graph)
 * 3. Adaptive TDEE Recalculator (Computes true metabolic burn based on actual weight loss slope)
 */

(function () {
  function injectAnalyticsUI() {
    // Find the right sidebar or container to mount our new analytics card (e.g. right below weight log)
    const weightSec = document.getElementById('weightInput')?.closest('section');
    if (!weightSec) return;

    const analyticsCard = document.createElement('section');
    analyticsCard.className = 'card p-4 sm:p-5 space-y-4';
    analyticsCard.innerHTML = `
      <div class="flex items-center justify-between">
        <h2 class="text-base font-extrabold text-white">📊 Advanced Analytics & Adaptive TDEE</h2>
        <span class="mono text-[10px] bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2.5 py-0.5 rounded-full">Pro Metrics</span>
      </div>

      <!-- Adaptive TDEE Recalculator Box -->
      <div id="adaptiveTdeeBox" class="pill-glow rounded-xl p-3.5 space-y-2 text-xs">
        <div class="flex justify-between items-center font-bold text-cyan-300">
          <span>🔬 Adaptive TDEE & Metabolic Rate</span>
          <span id="tdeeStatusBadge" class="mono text-[11px] text-slate-400">Needs 14+ logs</span>
        </div>
        <p class="text-slate-400 text-[11px]" id="tdeeExplanation">
          Calculates your true energy expenditure based on actual weight change vs. average calorie intake over the last 2 weeks.
        </p>
        <div id="tdeeResultGrid" class="grid grid-cols-3 gap-2 pt-1 text-center mono">
          <div class="bg-black/40 p-2 rounded-lg border border-white/5">
            <div class="text-[10px] text-slate-400">Est. Intake</div>
            <div class="text-xs font-bold text-white" id="tdeeAvgIn">-- kcal</div>
          </div>
          <div class="bg-black/40 p-2 rounded-lg border border-white/5">
            <div class="text-[10px] text-slate-400">Weight Slope</div>
            <div class="text-xs font-bold text-purple-300" id="tdeeSlope">-- kg/wk</div>
          </div>
          <div class="bg-black/40 p-2 rounded-lg border border-white/5">
            <div class="text-[10px] text-slate-400">True Burn (TDEE)</div>
            <div class="text-xs font-bold text-emerald-400" id="tdeeTrueBurn">-- kcal</div>
          </div>
        </div>
      </div>

      <!-- 7-Day Rolling Weight Trend Chart -->
      <div class="space-y-2">
        <div class="text-xs font-bold text-slate-300 flex justify-between">
          <span>7-Day Rolling Weight Trend vs Goal (70 kg)</span>
          <span class="mono text-[11px] text-purple-400">Live Curve</span>
        </div>
        <div class="bg-black/50 p-3 rounded-xl border border-white/10 h-52 relative">
          <canvas id="weightTrendCanvas"></canvas>
        </div>
      </div>

      <!-- 30-Day Consistency Heatmap -->
      <div class="space-y-2 pt-1">
        <div class="text-xs font-bold text-slate-300 flex justify-between">
          <span>30-Day Habit Consistency Matrix</span>
          <span class="mono text-[11px] text-emerald-400" id="heatmapScore">0% Clean</span>
        </div>
        <div id="monthlyHeatmapGrid" class="grid grid-cols-10 sm:grid-cols-15 gap-1.5 p-2 pill-glow rounded-xl justify-center"></div>
        <div class="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span>Less consistent</span>
          <div class="flex gap-1 items-center">
            <div class="w-2.5 h-2.5 rounded bg-slate-900 border border-white/10"></div>
            <div class="w-2.5 h-2.5 rounded bg-emerald-950 border border-emerald-800"></div>
            <div class="w-2.5 h-2.5 rounded bg-emerald-700"></div>
            <div class="w-2.5 h-2.5 rounded bg-emerald-400"></div>
          </div>
          <span>Fully dialed</span>
        </div>
      </div>
    `;

    weightSec.insertAdjacentElement('afterend', analyticsCard);

    // Hook into renderAll
    if (typeof window.renderAll === 'function') {
      const orig = window.renderAll;
      window.renderAll = function () {
        orig();
        renderAdvancedAnalytics();
      };
    }

    renderAdvancedAnalytics();
  }

  let weightChartInstance = null;

  function renderAdvancedAnalytics() {
    renderWeightChart();
    renderMonthlyHeatmap();
    computeAdaptiveTdee();
  }

  // 1. Weight Trend Line Chart
  function renderWeightChart() {
    const canvas = document.getElementById('weightTrendCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    const allDates = Object.keys(db?.days || {}).sort();
    const last30Dates = allDates.slice(-30);

    const labels = [];
    const rawWeights = [];
    const rollingAvgWeights = [];

    last30Dates.forEach((dStr, idx, arr) => {
      labels.value = dStr.slice(5); // MM-DD
      labels.push(dStr.slice(5));
      const w = db.days[dStr]?.weight || null;
      rawWeights.push(w);

      // Compute 7-day rolling average
      if (idx >= 6) {
        const slice7 = arr.slice(idx - 6, idx + 1).map(dt => db.days[dt]?.weight).filter(Boolean);
        const avg7 = slice7.length ? +(slice7.reduce((a, b) => a + b, 0) / slice7.length).toFixed(1) : null;
        rollingAvgWeights.push(avg7);
      } else {
        rollingAvgWeights.push(null);
      }
    });

    if (weightChartInstance) {
      weightChartInstance.data.labels = labels;
      weightChartInstance.data.datasets[0].data = rawWeights;
      weightChartInstance.data.datasets[1].data = rollingAvgWeights;
      weightChartInstance.update();
      return;
    }

    const ctx = canvas.getContext('2d');
    weightChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Daily Weight (kg)',
            data: rawWeights,
            borderColor: 'rgba(168, 85, 247, 0.5)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            borderWidth: 1.5,
            pointRadius: 2,
            tension: 0.2
          },
          {
            label: '7-Day Rolling Avg (kg)',
            data: rollingAvgWeights,
            borderColor: '#38bdf8',
            backgroundColor: '#38bdf8',
            borderWidth: 2.5,
            pointRadius: 3,
            tension: 0.3,
            fill: false
          },
          {
            label: 'Goal (70 kg)',
            data: labels.map(() => 70.0),
            borderColor: 'rgba(16, 185, 129, 0.4)',
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#94a3b8', font: { size: 10, family: 'Plus Jakarta Sans' }, boxWidth: 12 }
          }
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' }, suggestedMin: 68, suggestedMax: 85 }
        }
      }
    });
  }

  // 2. 30-Day Consistency Heatmap Grid
  function renderMonthlyHeatmap() {
    const grid = document.getElementById('monthlyHeatmapGrid');
    const scoreEl = document.getElementById('heatmapScore');
    if (!grid) return;

    // Generate last 30 calendar days ending today
    const today = new Date();
    const daysArr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const offset = d.getTimezoneOffset() * 60000;
      daysArr.push(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    }

    let totalPossibleChecks = 0;
    let totalCompletedChecks = 0;
    const habitCount = (typeof DEFAULT_HABITS !== 'undefined' ? DEFAULT_HABITS.length : 6);

    grid.innerHTML = daysArr.map(dStr => {
      const dayObj = db?.days?.[dStr];
      let checkedInDay = 0;
      if (dayObj && dayObj.habits) {
        checkedInDay = Object.values(dayObj.habits).filter(Boolean).length;
      }
      totalPossibleChecks += habitCount;
      totalCompletedChecks += checkedInDay;

      const ratio = checkedInDay / habitCount;
      let bg = 'bg-slate-900 border-white/5';
      if (ratio >= 0.8) bg = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]';
      else if (ratio >= 0.5) bg = 'bg-emerald-600';
      else if (ratio > 0) bg = 'bg-emerald-950 border-emerald-800';

      return `<div class="w-6 h-6 rounded-md border ${bg} transition-transform hover:scale-110 cursor-pointer" title="${dStr}: ${checkedInDay}/${habitCount} habits"></div>`;
    }).join('');

    const score = totalPossibleChecks ? Math.round((totalCompletedChecks / totalPossibleChecks) * 100) : 0;
    if (scoreEl) scoreEl.textContent = `${score}% 30d Consistency`;
  }

  // 3. Adaptive TDEE Recalculator
  function computeAdaptiveTdee() {
    const badge = document.getElementById('tdeeStatusBadge');
    const avgInEl = document.getElementById('tdeeAvgIn');
    const slopeEl = document.getElementById('tdeeSlope');
    const burnEl = document.getElementById('tdeeTrueBurn');
    if (!badge) return;

    const allDates = Object.keys(db?.days || {}).sort();
    const weightEntries = allDates.filter(d => db.days[d]?.weight !== null && db.days[d]?.weight !== undefined);

    if (weightEntries.length < 5) {
      badge.textContent = `Needs ${5 - weightEntries.length} more weigh-ins`;
      return;
    }

    // Look at last 14 days of data
    const recentDays = allDates.slice(-14);
    let totalKcalConsumed = 0;
    let daysWithMeals = 0;

    recentDays.forEach(d => {
      const meals = db.days[d]?.meals || [];
      const dayKcal = meals.reduce((s, m) => s + m.kcal, 0);
      if (meals.length > 0) {
        totalKcalConsumed += dayKcal;
        daysWithMeals++;
      }
    });

    if (daysWithMeals < 5) {
      badge.textContent = `Log meals on 5+ days to calculate`;
      return;
    }

    const avgDailyIntake = Math.round(totalKcalConsumed / daysWithMeals);

    // Calculate actual weight change slope over available window (1 kg fat ≈ 7,700 kcal)
    const firstW = db.days[weightEntries[0]].weight;
    const lastW = db.days[weightEntries[weightEntries.length - 1]].weight;
    const totalDaysSpan = (new Date(weightEntries[weightEntries.length - 1]) - new Date(weightEntries[0])) / (1000 * 60 * 60 * 24) || 1;

    const weightDiffKg = lastW - firstW; // e.g. -1.2 kg
    const kgPerWeek = +((weightDiffKg / totalDaysSpan) * 7).toFixed(2);
    
    // 1 kg fat loss per week = 7700 / 7 = 1,100 kcal/day deficit
    const dailyEnergyBalance = Math.round((weightDiffKg * 7700) / totalDaysSpan);
    const calculatedTrueTdee = avgDailyIntake - dailyEnergyBalance;

    badge.textContent = `Active (${weightEntries.length} weigh-ins)`;
    avgInEl.textContent = `${avgDailyIntake} kcal`;
    slopeEl.textContent = `${kgPerWeek > 0 ? '+' : ''}${kgPerWeek} kg/wk`;
    burnEl.textContent = `${Math.round(calculatedTrueTdee)} kcal`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAnalyticsUI);
  } else {
    injectAnalyticsUI();
  }
})();