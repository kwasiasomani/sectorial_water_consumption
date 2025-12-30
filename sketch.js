//Kwasi Asomani
//Consulted claude and ChatGPT for guidance
// ---------- CONFIG ----------
//https://drive.google.com/file/d/1BbQxqRCjHNYiVUHTlPeMy97_ubUGr0Ak/view?usp=sharing
const geoJsonUrls = {
  orange: "https://raw.githubusercontent.com/kwasiasomani/kwasiasomani.github.io/main/orange.geojson",
  riverside: "https://raw.githubusercontent.com/kwasiasomani/kwasiasomani.github.io/main/riverside.geojson",
  san: "https://raw.githubusercontent.com/kwasiasomani/kwasiasomani.github.io/main/san.geojson",
};

const basinMultipliers = {
  riverside: [
    { Sector: "Farming", Water_multiplier_m3_per_$: 3.8451845391026236 },
    { Sector: "Forestry activity", Water_multiplier_m3_per_$: 0.15971108196434852 },
    { Sector: "Mining", Water_multiplier_m3_per_$: 0.3623802155333746 },
    { Sector: "Utilities", Water_multiplier_m3_per_$: 0.5697866697818319 }
  ],
  orange: [
    { Sector: "Farming", Water_multiplier_m3_per_$: 0.09324895338413007 },
    { Sector: "Forestry activity", Water_multiplier_m3_per_$: 0.0663237352823424 },
    { Sector: "Mining", Water_multiplier_m3_per_$: 0.3405889000401679 },
    { Sector: "Utilities", Water_multiplier_m3_per_$: 0.3778933756941906 }
  ],
  san: [
    { Sector: "Farming", Water_multiplier_m3_per_$: 0.8692218114049547 },
    { Sector: "Forestry activity", Water_multiplier_m3_per_$: 0.07224314397126201 },
    { Sector: "Mining", Water_multiplier_m3_per_$: 0.12270834455500218 },
    { Sector: "Utilities", Water_multiplier_m3_per_$: 0.9433954353805012 }
  ]
};

const sectorOrder = ["Farming", "Forestry activity", "Mining", "Utilities"];
const basinPrettyNames = {
  orange: "Orange County",
  riverside: "Riverside County",
  san: "San Diego County",
};

// Basin colors for map - all blue
const basinColors = {
  orange: "#3b82f6",
  riverside: "#3b82f6", 
  san: "#3b82f6"
};

// Chart colors - distinct from basin colors
const chartColors = ['#ec4899', '#10b981', '#f59e0b', '#6366f1'];

let map;
const basinLayers = {};
let currentBasinKey = null;
let finalDemandMode = false;

// ---------- UTILITIES ----------
function getMultipliersFor(basinKey) {
  const table = basinMultipliers[basinKey];
  if (!table) return sectorOrder.map(() => 0);
  return sectorOrder.map((sec) => {
    const row = table.find((r) => r.Sector === sec);
    if (!row) return 0;
    const val = Number(row.Water_multiplier_m3_per_$);
    return isNaN(val) ? 0 : val;
  });
}

// ---------- MAP ----------
function initMap() {
  map = L.map("map", {
    center: [33.7, -117.6],
    zoom: 8,
    zoomControl: true,
  });

  // Using dark map without labels to avoid grid lines
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 18,
  }).addTo(map);
}

async function loadData() {
  for (const [key, url] of Object.entries(geoJsonUrls)) {
    try {
      const res = await fetch(url);
      const gj = await res.json();
      const color = basinColors[key];

      const layer = L.geoJSON(gj, {
        style: {
          color,
          fillColor: color,
          fillOpacity: 0.5,
          weight: 2,
        },
        onEachFeature: (feature, layer) => {
          layer.on("mouseover", function () {
            this.setStyle({ weight: 3, fillOpacity: 0.7 });
          });
          layer.on("mouseout", function () {
            this.setStyle({ weight: 2, fillOpacity: 0.5 });
          });
          layer.on("click", () => {
            handleBasinClick(key, layer);
          });
        },
      }).addTo(map);

      basinLayers[key] = layer;
      const pretty = basinPrettyNames[key] || key;
      const muls = getMultipliersFor(key);
      const popupHtml =
        `<strong>${pretty}</strong><br>` +
        `<em>Water multipliers (m³ per $)</em><br>` +
        `Farming: ${muls[0].toFixed(3)}<br>` +
        `Forestry: ${muls[1].toFixed(3)}<br>` +
        `Mining: ${muls[2].toFixed(3)}<br>` +
        `Utilities: ${muls[3].toFixed(3)}`;
      layer.bindPopup(popupHtml);
    } catch (err) {
      console.error("GeoJSON load error for", key, err);
    }
  }

  const allLayers = Object.values(basinLayers);
  if (allLayers.length > 0) {
    const allBounds = allLayers
      .map((l) => l.getBounds())
      .reduce((acc, b) => acc.extend(b), L.latLngBounds());
    if (allBounds.isValid()) {
      map.fitBounds(allBounds.pad(0.2));
    }
  }
}

// ---------- CHARTS ----------
function updateChartsForBasin(basinKey) {
  const prettyName = basinPrettyNames[basinKey] || basinKey;
  const multipliers = getMultipliersFor(basinKey);
  const factor = finalDemandMode ? 12_000_000 : 1;
  const unitLabel = finalDemandMode ? "m³ for $12M" : "m³ per $1";
  const scaled = multipliers.map((m) => m * factor);

  // Sort sectors by value (descending)
  const sortedIndices = scaled
    .map((val, idx) => ({ val, idx }))
    .sort((a, b) => b.val - a.val)
    .map(item => item.idx);

  const sortedSectors = sortedIndices.map(i => sectorOrder[i]);
  const sortedScaled = sortedIndices.map(i => scaled[i]);
  const sortedColors = sortedIndices.map(i => chartColors[i]);

  // Bar Chart - Descending order with values displayed
  Plotly.newPlot('barChart', [{
    y: sortedSectors,
    x: sortedScaled,
    type: 'bar',
    orientation: 'h',
    marker: {
      color: sortedColors
    },
    text: sortedScaled.map(v => v.toFixed(3)),
    textposition: 'auto',
    textfont: { color: '#1e293b', size: 10 }
  }], {
    margin: { l: 130, r: 20, t: 10, b: 40 },
    paper_bgcolor: '#1e293b',
    plot_bgcolor: '#1e293b',
    font: { color: '#e5e7eb', size: 11 },
    xaxis: { 
      title: unitLabel, 
      color: '#9ca3af', 
      gridcolor: 'rgba(51, 65, 85, 0.3)',
      showgrid: true
    },
    yaxis: { 
      color: '#e5e7eb', 
      autorange: 'reversed',
      showgrid: false
    }
  }, { responsive: true, displayModeBar: false });

  // Pie Chart
  Plotly.newPlot('pieChart', [{
    labels: sectorOrder,
    values: scaled,
    type: 'pie',
    marker: {
      colors: chartColors
    },
    textinfo: 'label+percent',
    textfont: { size: 11 }
  }], {
    margin: { l: 20, r: 20, t: 10, b: 10 },
    paper_bgcolor: '#1e293b',
    font: { color: '#e5e7eb', size: 11 },
    showlegend: false
  }, { responsive: true, displayModeBar: false });

  // Line Chart
  Plotly.newPlot('lineChart', [{
    x: sectorOrder,
    y: multipliers,
    type: 'scatter',
    mode: 'lines+markers',
    name: 'm³ per $1',
    line: { color: '#ec4899', width: 2 },
    marker: { size: 8 }
  }, {
    x: sectorOrder,
    y: multipliers.map(m => m * 12_000_000),
    type: 'scatter',
    mode: 'lines+markers',
    name: 'm³ for $12M',
    line: { color: '#14b8a6', width: 2, dash: 'dash' },
    marker: { size: 8 }
  }], {
    margin: { l: 80, r: 20, t: 10, b: 60 },
    paper_bgcolor: '#1e293b',
    plot_bgcolor: '#1e293b',
    font: { color: '#e5e7eb', size: 11 },
    xaxis: { 
      color: '#e5e7eb',
      showgrid: false
    },
    yaxis: { 
      type: 'log',
      color: '#9ca3af',
      gridcolor: 'rgba(51, 65, 85, 0.3)',
      title: 'Water Usage (m³)',
      showgrid: true
    },
    legend: { 
      orientation: 'h',
      y: -0.2,
      font: { size: 10 }
    }
  }, { responsive: true, displayModeBar: false });

  document.getElementById("chart-title").textContent = `Water multipliers – ${prettyName}`;
  document.getElementById("chart-subtitle").textContent = `Values shown as ${unitLabel} across four key sectors`;
  document.getElementById("panel-title").textContent = `${prettyName} river basin`;

  const total = scaled.reduce((a, b) => a + b, 0);
  const shares = scaled.map((v) => (total > 0 ? (v / total) * 100 : 0));
  const captionLines = sectorOrder.map((sec, i) => `${sec}: ${shares[i].toFixed(1)}%`);
  document.getElementById("chart-caption").textContent = captionLines.join(" · ");
}

// ---------- INTERACTION ----------
function handleBasinClick(basinKey, layer) {
  currentBasinKey = basinKey;
  layer.openPopup();
  updateChartsForBasin(basinKey);
}

function showHelp() {
  document.getElementById('helpModal').classList.add('active');
}

function closeHelp() {
  document.getElementById('helpModal').classList.remove('active');
}

// ---------- STARTUP ----------
async function init() {
  const helpBtn = document.getElementById("help-btn");
  const demandBtn = document.getElementById("demand-btn");
  const modalCloseBtn = document.getElementById("modal-close-btn");

  if (helpBtn) {
    helpBtn.addEventListener("click", showHelp);
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeHelp);
  }

  if (demandBtn) {
    demandBtn.addEventListener("click", () => {
      finalDemandMode = !finalDemandMode;
      demandBtn.classList.toggle("active", finalDemandMode);
      demandBtn.textContent = finalDemandMode ? "Mode: per $12M" : "Mode: per $1";
      if (currentBasinKey) {
        updateChartsForBasin(currentBasinKey);
      }
    });
  }

  document.querySelectorAll(".sector-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".sector-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
    });
  });
  
  // Close modal on outside click
  document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') {
      closeHelp();
    }
  });

  initMap();
  await loadData();
  
  // Auto-select San Diego as default
  if (basinLayers["san"]) {
    currentBasinKey = "san";
    updateChartsForBasin("san");
  }
  
  // Handle window resize for responsive charts and map
  window.addEventListener('resize', () => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
    if (currentBasinKey) {
      setTimeout(() => {
        updateChartsForBasin(currentBasinKey);
      }, 100);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}