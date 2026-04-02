// ===== DADOS DO MAPA =====
let mapData = null;
fetch('map_data.json').then(r => r.json()).then(d => { mapData = d; }).catch(() => {});

// ===== SCREENSHOTS =====
const screenshotMap = new Map(); // lote => dataURL

function setupScreenshots() {
  const input = document.getElementById("screenshot-input");
  if (!input) return;

  input.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    let loaded = 0;

    files.forEach(file => {
      // Extrair números do lote do nome do arquivo (ex: screenshot_110_111.png → ["110","111"])
      const match = file.name.match(/(\d+(?:_\d+)*)/);
      if (!match) return;

      const loteKeys = match[1].split("_"); // ["110","111"]
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        // Mapear para cada lote individual e também para o combinado
        loteKeys.forEach(k => screenshotMap.set(k, dataUrl));
        // Chave combinada: "110 + 111" ou "110"
        if (loteKeys.length > 1) {
          const combinedKey = loteKeys.join(" + ");
          screenshotMap.set(combinedKey, dataUrl);
          // Também com " E " e "+"
          screenshotMap.set(loteKeys.join(" E "), dataUrl);
          screenshotMap.set(loteKeys.join("+"), dataUrl);
        }
        loaded++;
        if (loaded === files.length) updateScreenshotCount();
      };
      reader.readAsDataURL(file);
    });
  });
}

function updateScreenshotCount() {
  const el = document.getElementById("screenshot-count");
  if (!el) return;
  const unique = new Set(screenshotMap.values()).size;
  el.textContent = unique > 0 ? `${unique} imagens carregadas` : "";
  // Atualizar label
  const label = document.getElementById("screenshot-label");
  if (label && unique > 0) label.classList.add("has-files");
}

function getScreenshotForLote(lote) {
  // Tentar match direto
  if (screenshotMap.has(lote)) return screenshotMap.get(lote);
  // Tentar variações: "110 + 111" → tentar "110", "111"
  const nums = lote.match(/\d+/g);
  if (nums) {
    // Tentar chave combinada
    const combined = nums.join("_");
    for (const [key, val] of screenshotMap) {
      const keyNums = key.match(/\d+/g);
      if (keyNums && keyNums.join("_") === combined) return val;
    }
    // Tentar qualquer número individual
    for (const n of nums) {
      if (screenshotMap.has(n)) return screenshotMap.get(n);
    }
  }
  return null;
}

function gerarScreenshotHtml(casa, cor) {
  const img = getScreenshotForLote(casa.lote);
  if (!img) return '';
  return `
    <div class="report-section">
      <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Projeto — Implantação</h3>
      <div class="screenshot-container">
        <img src="${img}" alt="Screenshot do projeto - Lote ${casa.lote}" class="screenshot-img"/>
      </div>
    </div>
  `;
}

// ===== CORES POR TIPOLOGIA =====
const COR_AZUL_SUAVE = { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a", accent: "#3b82f6" };

function getCorTipologia(tipologia) {
  // Todos os relatórios usam a mesma cor azul suave, conforme solicitado.
  // Apenas elementos "color graded" (por valor) mantêm cores diferentes internamente.
  return COR_AZUL_SUAVE;
}

// ===== CÓDIGO DE CORES POR TEMPO DE RETORNO =====
function getTempoRetornoCor(tr) {
  if (tr >= 10) return { cor: "#15803d", bg: "#e8f5e9", label: "Adequado", icon: "check" };
  if (tr >= 5)  return { cor: "#f57f17", bg: "#fff8e1", label: "Atenção", icon: "warning" };
  return { cor: "#c62828", bg: "#ffebee", label: "Crítico", icon: "alert" };
}

// ===== DADOS =====
let casas = [];

// ===== LEITURA DO EXCEL =====
function parseExcel(data) {
  const wb = XLSX.read(data, { type: "array" });

  // Tentar aba AREAS primeiro (LOTES - TRINCHEIRAS)
  let sheetName = wb.SheetNames.find(n => n.toUpperCase() === "AREAS");
  if (!sheetName) sheetName = wb.SheetNames[0];

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Buscar aba GERAL para tipologias (se existir)
  const geralSheet = wb.Sheets[wb.SheetNames.find(n => n.toUpperCase() === "GERAL")];
  let geralMap = {};
  if (geralSheet) {
    const geralRows = XLSX.utils.sheet_to_json(geralSheet, { header: 1, defval: "" });
    // Col 0 = LOTE, Col 1 = TIPOLOGIA
    for (let i = 1; i < geralRows.length; i++) {
      const r = geralRows[i];
      if (r[0]) geralMap[String(r[0]).trim()] = String(r[1] || "").trim();
    }
  }

  // Encontrar header row
  let headerRow = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(c => String(c).toUpperCase());
    if (row.some(c => c.includes("CASA") || c.includes("LOTE"))) {
      headerRow = i;
      break;
    }
  }

  const headers = rows[headerRow].map(c => String(c).replace(/\s+/g, '').toUpperCase());

  // Mapear colunas por nome
  function findCol(...names) {
    for (const name of names) {
      const target = name.replace(/\s+/g, '').toUpperCase();
      const idx = headers.findIndex(h => h.includes(target));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const colCasa     = findCol("CASA", "LOTE");
  const colTipo     = findCol("TIPO");
  const colPiscina  = findCol("PISCINA");
  const colTelhado  = findCol("TELHADO");
  const colPergolado = findCol("PERGOLADO");
  const colTotal    = findCol("TOTAL");
  const colAImp     = findCol("A IMP", "AIMP", "IMPERMEAV");
  const colGrama    = findCol("GRAMA");
  const colK        = findCol("K (M/S)", "K(M/S)", "K ");
  const colSP       = findCol("SP-AREA", "SP");
  const colLencol   = findCol("LENCOL", "PROF");
  const colTR       = findCol("TR");
  
  const colB1       = findCol("B1(M)", "B(M)");
  const colL1       = findCol("L1(M)", "L(M)");
  const colH1       = findCol("H1(M)", "H(M)");
  
  const colB2       = findCol("B2(M)");
  const colL2       = findCol("L2(M)");
  const colH2       = findCol("H2(M)");

  const colB3       = findCol("B3(M)");
  const colL3       = findCol("L3(M)");
  const colH3       = findCol("H3(M)");

  const colHTotal   = findCol("HTOTAL");
  const colLivre    = findCol("LIVRE");
  const colCompDisp = findCol("COMP DISP", "COMP. DISP", "DISPONIVEL");
  
  const colEsvaz    = findCol("TEMPOESVAZ", "ESVAZ");
  const colVazEnt   = findCol("VAZÃOENT", "VAZAOENT", "QENTRADA", "ENTRADA(L");
  const colVazSai   = findCol("VAZÃOSAI", "VAZAOSAI", "QSAIDA", "SAIDA(L");
  const colHMax     = findCol("HMAXCALCULADO", "HMAX");
  const colTd       = findCol("CHUVACRIT", "CHUVA", "TD(MIN)", "CRIT.");

  casas = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const lote = String(r[colCasa] || "").trim();
    if (!lote || lote === "0" || lote.toUpperCase() === "CASA") continue;

    const num = (col) => {
      if (col === -1) return 0;
      const v = r[col];
      return (typeof v === "number") ? v : parseFloat(String(v).replace(",", ".")) || 0;
    };

    const tipologia = (colTipo !== -1 && r[colTipo]) ? String(r[colTipo]).trim() : (geralMap[lote] || "");

    const piscina = num(colPiscina);
    const telhado = num(colTelhado);
    const pergolado = num(colPergolado);
    const area_total = num(colTotal);
    const area_imp = num(colAImp);
    const grama = num(colGrama);
    const k = num(colK);
    const tr = num(colTR) || 10;
    
    const b1 = num(colB1), l1 = num(colL1), h1 = num(colH1);
    const b2 = num(colB2), l2 = num(colL2), h2 = num(colH2);
    const b3 = num(colB3), l3 = num(colL3), h3 = num(colH3);

    let trincheiras = [];
    if (b1 > 0 && l1 > 0) trincheiras.push({ b: b1, l: l1, h: h1 });
    if (b2 > 0 && l2 > 0) trincheiras.push({ b: b2, l: l2, h: h2 });
    if (b3 > 0 && l3 > 0) trincheiras.push({ b: b3, l: l3, h: h3 });

    let trincheira_area = trincheiras.reduce((sum, t) => sum + (t.b * t.l), 0);
    let trincheira_volume = trincheiras.reduce((sum, t) => sum + (t.b * t.l * t.h), 0);
    
    const hTotal = num(colHTotal);
    const livre = num(colLivre);
    const compDisp = num(colCompDisp);
    
    const esvaziamento = num(colEsvaz);
    const vaz_ent = num(colVazEnt);
    const vaz_sai = num(colVazSai);
    const h_max = num(colHMax);
    const td_chuva = num(colTd);

    // Pular linhas sem dados significativos
    if (area_total === 0 && telhado === 0 && trincheiras.length === 0) continue;

    casas.push({
      id: casas.length + 1,
      lote,
      tipologia,
      // Áreas detalhadas
      area_telhado: telhado,
      area_piscina: piscina,
      area_pergolado: pergolado,
      area_total: area_total,
      area_impermeavel: area_imp,
      area_grama: grama,
      // Solo
      k_permeabilidade: k,
      sp_area: colSP !== -1 ? String(r[colSP] || "").trim() : "",
      lencol_prof: colLencol !== -1 ? String(r[colLencol] || "").trim() : "",
      // Trincheira
      tempo_retorno: tr,
      trincheiras: trincheiras,
      trincheira_profundidade_total: hTotal,
      trincheira_livre: livre,
      trincheira_area: trincheira_area,
      trincheira_volume: trincheira_volume,
      comp_disponivel: compDisp,
      // Desempenho
      tempo_esvaziamento: esvaziamento,
      vazao_entrada: vaz_ent,
      vazao_saida: vaz_sai,
      h_max_calculado: h_max,
      chuva_critica_td: td_chuva
    });
  }

  if (casas.length === 0) {
    alert("Nenhum dado encontrado na planilha. Verifique se a aba AREAS existe e contém dados.");
    return;
  }

  document.getElementById("home-subtitle").textContent =
    `${casas.length} lotes carregados · Selecione uma casa para visualizar o relatório`;

  showHomeScreen();
}

// ===== UPLOAD / DRAG & DROP =====
function setupUpload() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
  });
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => parseExcel(new Uint8Array(e.target.result));
  reader.readAsArrayBuffer(file);
}

// ===== NAVEGAÇÃO =====
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function showUpload() { showScreen("upload-screen"); }

function showHomeScreen() {
  showScreen("home-screen");
  renderFilters();
  renderCards(casas);
}

function showHome() {
  document.getElementById("report-screen").classList.remove("active");
  document.getElementById("home-screen").classList.add("active");
}

// ===== MODO ESCURO =====
function toggleDarkMode() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  document.querySelectorAll(".btn-dark").forEach(b => b.textContent = isDark ? "Modo Claro" : "Modo Escuro");
  localStorage.setItem("darkMode", isDark ? "1" : "0");
}

function initDarkMode() {
  if (localStorage.getItem("darkMode") === "1") {
    document.body.classList.add("dark");
    document.querySelectorAll(".btn-dark").forEach(b => b.textContent = "Modo Claro");
  }
}

// ===== FILTROS =====
let filtroTipologia = null;

function getTipologias() {
  const tipSet = new Set(casas.map(c => c.tipologia).filter(Boolean));
  return [...tipSet].sort();
}

function renderFilters() {
  const container = document.getElementById("filter-chips");
  const tipologias = getTipologias();

  let html = `<button class="chip ${filtroTipologia === null ? "active" : ""}" onclick="setFiltro(null)"
    style="${filtroTipologia === null ? "background:#1a1a2e;color:white;" : ""}">Todas (${casas.length})</button>`;

  tipologias.forEach((tip) => {
    const cor = getCorTipologia(tip);
    const count = casas.filter(c => c.tipologia === tip).length;
    const isActive = filtroTipologia === tip;
    const style = isActive
      ? `background:${cor.accent};color:white;border-color:${cor.accent};`
      : `background:${cor.bg};color:${cor.text};border-color:${cor.border};`;
    html += `<button class="chip ${isActive ? "active" : ""}" onclick="setFiltro('${tip.replace(/'/g, "\\'")}')" style="${style}">${tip} (${count})</button>`;
  });

  container.innerHTML = html;
}

function setFiltro(tip) {
  filtroTipologia = tip;
  renderFilters();
  applyFilters();
}

function applyFilters() {
  const query = document.getElementById("search-input").value.toLowerCase();
  let filtered = casas;
  if (filtroTipologia) filtered = filtered.filter(c => c.tipologia === filtroTipologia);
  if (query) {
    filtered = filtered.filter(c =>
      c.lote.toLowerCase().includes(query) ||
      (c.tipologia && c.tipologia.toLowerCase().includes(query))
    );
  }
  renderCards(filtered);
}

// ===== MAPA DO LOTE =====
const AREA_COLORS = {
  SP01: '#3b82f6', SP02: '#8b5cf6', SP03: '#06b6d4', SP04: '#f59e0b',
  SP05: '#10b981', SP06: '#ef4444', SP07: '#ec4899', SP08: '#6366f1'
};

function findHouseInMap(lote) {
  if (!mapData) return null;
  const h = mapData.houses;
  // Direct match
  if (h[lote]) return { ...h[lote], id: lote };
  // Try with + → -
  const dashLote = lote.replace(/\+/g, '-');
  if (h[dashLote]) return { ...h[dashLote], id: dashLote };
  // Try splitting "116+117" and averaging
  const parts = lote.split('+').map(s => s.trim());
  if (parts.length > 1 && parts.every(p => h[p])) {
    const xs = parts.map(p => h[p].x);
    const ys = parts.map(p => h[p].y);
    return {
      x: xs.reduce((a,b) => a+b) / xs.length,
      y: ys.reduce((a,b) => a+b) / ys.length,
      area: h[parts[0]].area,
      id: lote
    };
  }
  return null;
}

function renderLoteMap(lote) {
  if (!mapData) return '<div class="perm-map-overlay"><span>Dados do mapa não disponíveis</span></div>';
  const house = findHouseInMap(lote);
  if (!house) return '<div class="perm-map-overlay"><span>Lote não encontrado no mapa</span></div>';

  const areas = mapData.areas;
  // Compute bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  Object.values(areas).forEach(poly => poly.forEach(([x, y]) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }));
  const pad = 30;
  const w = 400, h = 400;
  const rangeX = maxX - minX, rangeY = maxY - minY;
  const scale = Math.min((w - 2*pad) / rangeX, (h - 2*pad) / rangeY);
  const offX = (w - rangeX * scale) / 2, offY = (h - rangeY * scale) / 2;
  const tx = x => offX + (x - minX) * scale;
  const ty = y => h - (offY + (y - minY) * scale); // flip Y

  let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:100%;border-radius:8px;">';

  // Draw area polygons
  Object.entries(areas).forEach(([areaId, poly]) => {
    const pts = poly.map(([x,y]) => tx(x) + ',' + ty(y)).join(' ');
    const isActive = house.area === areaId;
    const color = AREA_COLORS[areaId] || '#94a3b8';
    svg += '<polygon points="' + pts + '" fill="' + color + '" fill-opacity="' + (isActive ? '0.35' : '0.1') + '" stroke="' + color + '" stroke-width="' + (isActive ? '2.5' : '1') + '" stroke-opacity="' + (isActive ? '1' : '0.4') + '"/>';
    // Area label
    const cx = poly.reduce((s,[x]) => s+x, 0) / poly.length;
    const cy = poly.reduce((s,[,y]) => s+y, 0) / poly.length;
    svg += '<text x="' + tx(cx) + '" y="' + ty(cy) + '" text-anchor="middle" fill="' + color + '" font-size="11" font-weight="700" opacity="' + (isActive ? '1' : '0.5') + '">' + areaId + '</text>';
  });

  // Draw houses in same area as small dots
  Object.entries(mapData.houses).forEach(([id, pt]) => {
    if (pt.x && pt.y && pt.area === house.area) {
      svg += '<circle cx="' + tx(pt.x) + '" cy="' + ty(pt.y) + '" r="2.5" fill="' + (AREA_COLORS[pt.area] || '#94a3b8') + '" opacity="0.4"/>';
    }
  });

  // Highlight current house
  const hx = tx(house.x), hy = ty(house.y);
  svg += '<circle cx="' + hx + '" cy="' + hy + '" r="12" fill="#ef4444" opacity="0.2"/>';
  svg += '<circle cx="' + hx + '" cy="' + hy + '" r="6" fill="#ef4444" stroke="white" stroke-width="2"/>';
  svg += '<text x="' + hx + '" y="' + (hy - 16) + '" text-anchor="middle" fill="#1e293b" font-size="11" font-weight="800">Casa ' + lote + '</text>';

  svg += '</svg>';
  return svg;
}

// ===== COR DA FOLGA =====
function getFolgaCor(folga) {
  if (folga >= 1.0) return { cor: "#15803d", bg: "#e8f5e9", label: "Segura" };
  if (folga >= 0.5) return { cor: "#f57f17", bg: "#fff8e1", label: "Moderada" };
  if (folga > 0)    return { cor: "#c62828", bg: "#ffebee", label: "Reduzida" };
  return { cor: "#9e9e9e", bg: "#f5f5f5", label: "N/A" };
}

// ===== MINI DISCO SVG =====
function miniDisc(pct, cor, label, size, value) {
  const s = size || 28;
  const r = s / 2 - 4;
  const sw = Math.max(s / 9, 3);
  const circ = 2 * Math.PI * r;
  const dash = Math.max(pct, 0.05) * circ;
  const fsVal = Math.round(s * 0.28);
  const totalH = s + 14;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
    <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="var(--gauge-track)" stroke-width="${sw}"/>
      <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="${cor}" stroke-width="${sw}"
        stroke-dasharray="${dash} ${circ - dash}" stroke-linecap="round" transform="rotate(-90 ${s/2} ${s/2})"/>
      <text x="${s/2}" y="${s/2 + fsVal*0.35}" text-anchor="middle" fill="${cor}" font-size="${fsVal}" font-weight="800">${value || ''}</text>
    </svg>
    <span style="font-size:0.6rem;font-weight:700;color:${cor};letter-spacing:0.5px;">${label}</span>
  </div>`;
}

// ===== CARDS =====
function renderCards(data) {
  const grid = document.getElementById("house-grid");
  grid.innerHTML = "";

  if (data.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:#999;grid-column:1/-1;padding:40px;">Nenhuma casa encontrada.</p>';
    return;
  }

  data.forEach((casa) => {
    const cor = getCorTipologia(casa.tipologia);
    const trCor = getTempoRetornoCor(casa.tempo_retorno);
    const folgaCor = getFolgaCor(casa.trincheira_livre);
    const pctImp = casa.area_total > 0 ? (casa.area_impermeavel / casa.area_total * 100) : 0;

    // TR disc
    const trPct = Math.min(casa.tempo_retorno / 10, 1);
    // Folga disc
    const folgaPct = Math.min((casa.trincheira_livre || 0) / 1.5, 1);

    // Cor impermeabilidade
    let impCor = "#15803d";
    if (pctImp > 70) impCor = "#c62828";
    else if (pctImp > 50) impCor = "#f57f17";

    // Trincheira blocos
    const maxL = Math.max(...casa.trincheiras.map(t => t.l), 1);

    // Sparklines
    const maxVol = Math.max(...casas.map(c => c.trincheira_volume), 1);
    const volPct = maxVol > 0 ? (casa.trincheira_volume / maxVol * 100) : 0;
    const maxAreaTr = Math.max(...casas.map(c => c.trincheira_area), 1);
    const areaPct = maxAreaTr > 0 ? (casa.trincheira_area / maxAreaTr * 100) : 0;

    // Helper: meia roda gauge com label + subtexto
    function halfGauge(pct, color, value, label, sub) {
      const r = 28;
      const c = Math.PI * r;
      const off = c * (1 - pct);
      return '<div style="display:flex;flex-direction:column;align-items:center;flex:1;">' +
        '<svg viewBox="0 0 72 46" width="80" height="46">' +
          '<path d="M6,42 A28,28 0 0,1 66,42" fill="none" stroke="var(--gauge-track)" stroke-width="5" stroke-linecap="round"/>' +
          '<path d="M6,42 A28,28 0 0,1 66,42" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>' +
          '<text x="36" y="38" text-anchor="middle" font-size="13" font-weight="800" fill="' + color + '">' + value + '</text>' +
        '</svg>' +
        '<div style="font-size:0.65rem;color:var(--text-muted);font-weight:700;text-align:center;margin-top:1px;">' + label + '</div>' +
        (sub ? '<div style="font-size:0.58rem;color:' + color + ';font-weight:600;text-align:center;">' + sub + '</div>' : '') +
      '</div>';
    }

    const card = document.createElement("div");
    card.className = "house-card";
    // Borda lateral: metade TR, metade Folga
    card.style.setProperty("--card-border-gradient", `linear-gradient(to bottom, ${trCor.cor} 50%, ${folgaCor.cor} 50%)`);

    card.onclick = () => showReport(casa);
    card.innerHTML = `
      <!-- BARRA SUPERIOR -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;margin:-24px -20px 14px -20px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;">
        <div>
          <div style="font-size:1.15rem;font-weight:800;color:white;line-height:1.2;">Casa ${casa.lote}</div>
          <div style="font-size:0.75rem;font-weight:600;color:rgba(255,255,255,0.6);margin-top:2px;">${casa.tipologia || "Sem tipologia"}</div>
        </div>
      </div>

      <!-- REGIÃO CINZA: Wheels + Trincheiras -->
      <div style="background:var(--bg-body);border-radius:10px;padding:14px 10px;margin-bottom:14px;border:1px solid var(--border-light);">
        <!-- 3 MEIAS RODAS -->
        <div style="display:flex;gap:4px;align-items:flex-start;margin-bottom:12px;">
          ${halfGauge(pctImp / 100, impCor, pctImp.toFixed(0) + '%', 'Impermeável', casa.area_impermeavel.toFixed(0) + '/' + casa.area_total.toFixed(0) + ' m²')}
          ${halfGauge(trPct, trCor.cor, casa.tempo_retorno + 'a', 'Tempo Retorno', trCor.label)}
          ${halfGauge(folgaPct, folgaCor.cor, casa.trincheira_livre ? casa.trincheira_livre.toFixed(1) + 'm' : '—', 'Folga Lençol', folgaCor.label)}
        </div>
        <!-- TRINCHEIRAS -->
        <div style="border-top:1px solid var(--border-light);padding-top:10px;">
          <div style="font-size:0.7rem;color:var(--text-muted);font-weight:700;margin-bottom:6px;text-align:center;">${casa.trincheiras.length} trincheira${casa.trincheiras.length !== 1 ? 's' : ''}</div>
          <div style="display:flex;gap:8px;align-items:flex-end;justify-content:center;flex-wrap:wrap;">
            ${casa.trincheiras.length > 0 ? casa.trincheiras.map((t, i) => {
              const w = Math.max((t.l / maxL) * 90, 28);
              const h = Math.max((t.h / 2) * 22, 16);
              return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
                '<div title="T' + (i+1) + ': ' + t.l.toFixed(1) + '×' + t.b.toFixed(1) + '×' + t.h.toFixed(1) + 'm" style="width:' + w + 'px;height:' + h + 'px;background:' + cor.accent + ';border-radius:3px;opacity:' + (0.55 + (i+1)*0.18) + ';"></div>' +
                '<span style="font-size:0.58rem;color:var(--text-muted);font-weight:600;">' + t.l.toFixed(0) + 'm</span>' +
              '</div>';
            }).join('') : '<span style="font-size:0.75rem;color:var(--text-muted);">—</span>'}
          </div>
        </div>
      </div>

      <!-- BARRAS: Área + Volume lado a lado -->
      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">
            <span style="font-weight:600;">Área</span>
            <span style="font-weight:700;color:var(--text-primary);">${casa.trincheira_area.toFixed(1)} m²</span>
          </div>
          <div style="height:14px;background:var(--gauge-track);border-radius:6px;overflow:hidden;">
            <div style="height:100%;width:${areaPct}%;background:#2ecc71;border-radius:6px;transition:width 0.3s;"></div>
          </div>
        </div>
        <div style="flex:1;">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">
            <span style="font-weight:600;">Volume</span>
            <span style="font-weight:700;color:var(--text-primary);">${casa.trincheira_volume.toFixed(1)} m³</span>
          </div>
          <div style="height:14px;background:var(--gauge-track);border-radius:6px;overflow:hidden;">
            <div style="height:100%;width:${volPct}%;background:${cor.accent};border-radius:6px;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>

    `;
    grid.appendChild(card);
  });
}

// ===== BARRAS E MAPA DE PERMEABILIDADE =====
function formatScientific(val) {
  const [coef, exp] = val.toExponential(2).split('e');
  const superExp = exp.replace('-', '⁻').replace('+','')
    .replace('1','¹').replace('2','²').replace('3','³').replace('4','⁴').replace('5','⁵')
    .replace('6','⁶').replace('7','⁷').replace('8','⁸').replace('9','⁹').replace('0','⁰');
  return `${coef} &times; 10${superExp}`;
}

function gerarBarraPermeabilidadeE_Mapa(k, cor, lote, casa) {
  let logK = Math.log10(k);
  if (!isFinite(logK)) logK = -8;
  
  let pct = ((logK - (-8)) / ((-3) - (-8))) * 100;
  pct = Math.max(3, Math.min(pct, 100)); 

  let labelLit = "";
  let badgeClass = "";
  let colorFill = "";
  if (k >= 1e-4) { labelLit = "Boa (Areia Grossa/Média)"; badgeClass = "badge-good"; colorFill = "linear-gradient(0deg, #4ade80, #15803d)"; }
  else if (k >= 1e-5) { labelLit = "Moderada (Areia Fina/Siltosa)"; badgeClass = "badge-warn"; colorFill = "linear-gradient(0deg, #fcd34d, #d97706)"; }
  else if (k >= 1e-6) { labelLit = "Baixa (Silte)"; badgeClass = "badge-bad"; colorFill = "linear-gradient(0deg, #fca5a5, #dc2626)"; }
  else { labelLit = "Muito Baixa (Argila)"; badgeClass = "badge-bad"; colorFill = "linear-gradient(0deg, #f87171, #991b1b)"; }

  return `
    <div class="permeability-split">
      <!-- Lado Esquerdo: Permeabilidade -->
      <div class="perm-card">
        <div class="perm-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
          <h4>Capacidade de Infiltração</h4>
        </div>
        <div class="perm-card-body">
          <div class="perm-bar-wrapper">
             <div class="perm-bar-graduations">
               <div class="perm-tick" style="bottom: 100%;"><span>10⁻³</span></div>
               <div class="perm-tick" style="bottom: 80%;"><span>10⁻⁴</span></div>
               <div class="perm-tick" style="bottom: 60%;"><span>10⁻⁵</span></div>
               <div class="perm-tick" style="bottom: 40%;"><span>10⁻⁶</span></div>
               <div class="perm-tick" style="bottom: 20%;"><span>10⁻⁷</span></div>
               <div class="perm-tick" style="bottom: 0%;"><span>10⁻⁸</span></div>
             </div>
             <div class="perm-bar-track">
               <div class="perm-bar-fill" style="height: ${pct}%; background: ${colorFill};"></div>
             </div>
          </div>
          <div class="perm-details">
            <span class="perm-value-huge">${formatScientific(k)} <span class="perm-unit">m/s</span></span>
            <span class="perm-class-badge ${badgeClass}">${labelLit}</span>
            ${casa && casa.sp_area ? '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:0.8rem;color:#475569;"><span style="font-weight:600;">Área de Infiltração:</span> <span style="font-weight:800;color:#1e293b;">' + casa.sp_area + '</span></div>' : ''}
          </div>
        </div>
      </div>

      <!-- Lado Direito: Mapa/Localização -->
      <div class="perm-card">
        <div class="perm-card-header">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
           <h4>Localização do Lote</h4>
        </div>
        <div class="perm-map-area">
           ${renderLoteMap(lote)}
        </div>
      </div>
    </div>
  `;
}

function gerarGauge(valor, max, label, unidade, corAccent, decimals) {
  const dec = decimals !== undefined ? decimals : 2;
  const pct = max > 0 ? Math.min(valor / max, 1) : 0;
  const radius = 50;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - pct);

  return `
    <div class="gauge-container">
      <svg viewBox="0 0 120 75" class="gauge-svg">
        <path d="M10,65 A50,50 0 0,1 110,65" fill="none" stroke="var(--gauge-track)" stroke-width="10" stroke-linecap="round"/>
        <path d="M10,65 A50,50 0 0,1 110,65" fill="none" stroke="${corAccent}" stroke-width="10" stroke-linecap="round"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
        <text x="60" y="55" text-anchor="middle" class="gauge-value">${valor.toFixed(dec)}</text>
        <text x="60" y="70" text-anchor="middle" class="gauge-unit">${unidade}</text>
      </svg>
      <div class="gauge-label">${label}</div>
    </div>
  `;
}

// ===== GRÁFICOS DE ÁREA E IMPERMEABILIDADE =====
function gerarGaugeImpermeabilidade(casa, cor) {
  const total = casa.area_total || 1;
  const imp = casa.area_impermeavel;
  const perm = casa.area_grama;
  const pctImp = (imp / total * 100);
  const pctPerm = (perm / total * 100);

  // Cor da área impermeável: sempre cinza escuro para contrastar com verde
  let barCor = "#64748b";
  if (pctImp > 70) barCor = "#c62828";
  else if (pctImp > 50) barCor = "#f57f17";

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const impDash = circumference * (pctImp / 100);
  const permDash = circumference * (pctPerm / 100);

  // Gráfico 1: Impermeabilidade
  let html = `
    <div class="impermeability-section" style="margin-bottom: 24px;">
      <div class="impermeability-gauge">
        <svg viewBox="0 0 140 140" class="impermeability-svg">
          <circle cx="70" cy="70" r="${radius}" fill="none" stroke="var(--gauge-track)" stroke-width="12"/>
          <circle cx="70" cy="70" r="${radius}" fill="none" stroke="${barCor}" stroke-width="12"
            stroke-dasharray="${impDash} ${circumference - impDash}"
            stroke-dashoffset="${circumference * 0.25}"
            stroke-linecap="round"/>
          <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#15803d" stroke-width="12" opacity="0.7"
            stroke-dasharray="${permDash} ${circumference - permDash}"
            stroke-dashoffset="${circumference * 0.25 - impDash}"
            stroke-linecap="round"/>
          <text x="70" y="64" text-anchor="middle" class="gauge-value-lg">${pctImp.toFixed(0)}%</text>
          <text x="70" y="82" text-anchor="middle" class="gauge-unit">impermeável</text>
        </svg>
      </div>
      <div class="impermeability-details">
        <h4 style="margin-bottom: 12px; font-size: 0.95rem; color: var(--text-secondary); text-transform: uppercase;">Índice de Impermeabilidade</h4>
        <div class="area-row">
          <span class="area-dot" style="background:${barCor};"></span>
          <span class="area-name">Área Impermeável</span>
          <span class="area-value">${imp.toFixed(1)} m² (${pctImp.toFixed(0)}%)</span>
        </div>
        <div class="area-row">
          <span class="area-dot" style="background:#15803d;"></span>
          <span class="area-name">Grama / Permeável</span>
          <span class="area-value">${perm.toFixed(1)} m² (${pctPerm.toFixed(0)}%)</span>
        </div>
      </div>
    </div>
  `;

  // Gráfico 2: Composição das Áreas
  const telhado = casa.area_telhado || 0;
  const piscina = casa.area_piscina || 0;
  const pergolado = casa.area_pergolado || 0;
  const grama = casa.area_grama || 0;
  const outros = Math.max(0, total - (telhado + piscina + pergolado + grama));

  let items = [
    { label: "Casa / Telhado", value: telhado, color: "#3b82f6" },
    { label: "Grama / Permeável", value: grama, color: "#15803d" },
    { label: "Pergolado", value: pergolado, color: "#f59e0b" },
    { label: "Piscina", value: piscina, color: "#0ea5e9" },
  ];

  if (outros > 1) {
    items.push({ label: "Outros (Pisos, Calçadas)", value: outros, color: "#8b5cf6" });
  }

  items = items.filter(i => i.value > 0);

  let legendHtml = '';
  let segmentsHtml = '';

  for (const item of items) {
    const pct = (item.value / total) * 100;
    
    legendHtml += `
      <div style="display: flex; flex-direction: column; min-width: 110px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; display: inline-block;"></span>
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); line-height: 1;">${item.label}</span>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 16px;">${item.value.toFixed(1)} m² (${pct.toFixed(0)}%)</span>
      </div>
    `;

    segmentsHtml += `
      <div style="width: ${pct}%; height: 100%; background: ${item.color}; border-right: 1px solid rgba(255,255,255,0.3); box-sizing: border-box;"></div>
    `;
  }

  html += `
    <div class="composition-section" style="padding-top: 24px; border-top: 1px solid var(--border-light); margin-top: 24px;">
      <h4 style="margin-bottom: 16px; font-size: 0.95rem; color: var(--text-secondary); text-transform: uppercase;">Composição do Lote</h4>
      
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
        ${legendHtml}
      </div>

      <div style="display: flex; width: 100%; height: 28px; border-radius: 14px; overflow: hidden; background: var(--gauge-track);">
        ${segmentsHtml}
      </div>

      <div class="area-row" style="margin-top: 16px; border-top: 1px solid var(--border-light); padding-top: 16px;">
        <span class="area-name" style="font-weight: 700; color: var(--text-primary);">Total do Lote</span>
        <span class="area-value">${total.toFixed(1)} m²</span>
      </div>
    </div>
  `;

  return html;
}

// ===== DIAGRAMA SVG =====
function gerarDiagramaTrincheira(casa, cor) {
  if (!casa.trincheiras || casa.trincheiras.length === 0) {
    return '<p style="color:#999;text-align:center;">Nenhuma trincheira definida para este lote.</p>';
  }

  const profLencolBase = (casa.trincheiras[0]?.h || 0) + (Number(casa.trincheira_livre) || 0);

  let html = '';
  casa.trincheiras.forEach((t, i) => {
    const C = t.l;
    const L = t.b;
    const P = t.h;
    if (C === 0 || L === 0 || P === 0) return;

    let folgaReal = profLencolBase - P;
    const folgaVisual = Math.min(Math.max(folgaReal, 0.2), P * 1.2); 
    
    const svgW = 850; 
    const offsetX = 80, offsetY = 40;
    
    const corteScale = Math.min(180 / L, 200 / (P + folgaVisual));
    const corteW = L * corteScale;
    const corteH = P * corteScale;
    const folgaH = folgaVisual * corteScale;

    const corteX = offsetX;
    const corteY = offsetY + 30;
    const lencolY = corteY + corteH + folgaH;

    const plantaScale = Math.min(300 / C, 120 / L);
    const plantaW = C * plantaScale;
    const plantaH = L * plantaScale;
    const plantaX = corteX + corteW + 240; 
    const plantaY = corteY;

    const svgH = Math.max(lencolY, plantaY + plantaH) + 60; // Altura dinâmica exata
    const sf = `_${i}`; 

    html += `
      <div style="margin-bottom: 16px;">
      <h4 style="color: var(--text-secondary); margin-bottom: 12px; font-size: 1rem; text-transform: uppercase;">Trincheira ${i+1} (${C.toFixed(2)}m × ${L.toFixed(2)}m × ${P.toFixed(2)}m)</h4>
      <svg viewBox="0 0 ${svgW} ${svgH}" class="trench-diagram">
        <text x="${corteX + corteW/2}" y="${corteY - 12}" text-anchor="middle" class="diagram-title">Corte Transversal</text>
        
        <!-- Linha do Solo -->
        <line x1="${corteX - 30}" y1="${corteY}" x2="${corteX + corteW + 180}" y2="${corteY}"
          stroke="var(--diagram-ground)" stroke-width="2" stroke-dasharray="6,3"/>
        <text x="${corteX - 35}" y="${corteY + 4}" text-anchor="end" class="diagram-label-small">Solo</text>
        
        <!-- Retângulo Trincheira -->
        <rect x="${corteX}" y="${corteY}" width="${corteW}" height="${corteH}"
          fill="${cor.bg}" stroke="${cor.accent}" stroke-width="2.5" rx="2"/>
        <pattern id="brita${sf}" patternUnits="userSpaceOnUse" width="12" height="12">
          <circle cx="3" cy="3" r="2" fill="${cor.accent}" opacity="0.2"/>
          <circle cx="9" cy="9" r="1.5" fill="${cor.accent}" opacity="0.15"/>
          <circle cx="9" cy="3" r="1" fill="${cor.accent}" opacity="0.1"/>
        </pattern>
        <rect x="${corteX}" y="${corteY}" width="${corteW}" height="${corteH}" fill="url(#brita${sf})" rx="2"/>
        
        ${casa.h_max_calculado > 0 ? (() => {
          const hVisual = Math.min(casa.h_max_calculado, P);
          const offsetYWater = corteY + (P - hVisual)*corteScale;
          const heightWater = hVisual*corteScale;
          return `<rect x="${corteX}" y="${offsetYWater}" width="${corteW}" height="${heightWater}" fill="#0288d1" opacity="0.4" rx="2"/>
           <line x1="${corteX}" y1="${offsetYWater}" x2="${corteX+corteW}" y2="${offsetYWater}" stroke="#0288d1" stroke-width="2" stroke-dasharray="8,4"/>
           <text x="${corteX + corteW/2}" y="${offsetYWater + 15}" text-anchor="middle" fill="#0277bd" font-size="11px" font-weight="bold">H Calc: ${casa.h_max_calculado.toFixed(2)}m</text>`;
        })() : ''}

        <!-- Distância L -->
        <line x1="${corteX}" y1="${corteY + corteH + 20}" x2="${corteX + corteW}" y2="${corteY + corteH + 20}"
          stroke="var(--diagram-dim)" stroke-width="1.5" marker-start="url(#arrowL${sf})" marker-end="url(#arrowR${sf})"/>
        <text x="${corteX + corteW/2}" y="${corteY + corteH + 38}" text-anchor="middle" class="diagram-dim">${L.toFixed(2)} m</text>
        
        <!-- Distância P -->
        <line x1="${corteX - 20}" y1="${corteY}" x2="${corteX - 20}" y2="${corteY + corteH}"
          stroke="var(--diagram-dim)" stroke-width="1.5" marker-start="url(#arrowU${sf})" marker-end="url(#arrowD${sf})"/>
        <text x="${corteX - 25}" y="${corteY + corteH/2 + 4}" text-anchor="end" class="diagram-dim">${P.toFixed(2)} m</text>

        <!-- Linha do Lençol Freático -->
        <line x1="${corteX - 30}" y1="${lencolY}" x2="${corteX + corteW + 180}" y2="${lencolY}"
          stroke="#0288d1" stroke-width="2" stroke-dasharray="4,4"/>
        <path d="M${corteX + corteW + 180},${lencolY} l4,4 l4,-4 l4,4 l4,-4" fill="none" stroke="#0288d1" stroke-width="1.5"/>
        <text x="${corteX - 35}" y="${lencolY + 4}" text-anchor="end" fill="#0288d1" font-size="10px" font-weight="bold">Lençol Freático</text>

        <!-- Marcação Folga -->
        <line x1="${corteX + corteW + 30}" y1="${corteY + corteH}" x2="${corteX + corteW + 30}" y2="${lencolY}"
          stroke="#e65100" stroke-width="1.5" marker-start="url(#arrowU${sf}_folga)" marker-end="url(#arrowD${sf}_folga)"/>
        <text x="${corteX + corteW + 36}" y="${corteY + corteH + folgaH/2 + 4}" text-anchor="start" fill="#e65100" font-size="11px" font-weight="bold">Folga: ${folgaReal.toFixed(2)}m</text>
        
        <!-- Marcação Profundidade Lençol total -->
        <line x1="${corteX + corteW + 116}" y1="${corteY}" x2="${corteX + corteW + 116}" y2="${lencolY}"
          stroke="#0288d1" stroke-width="1.5" marker-start="url(#arrowU${sf}_lencol)" marker-end="url(#arrowD${sf}_lencol)"/>
        <text x="${corteX + corteW + 122}" y="${corteY + (corteH + folgaH)/2 + 4}" text-anchor="start" fill="#0288d1" font-size="11px" font-weight="bold">Prof. Lençol: ${profLencolBase.toFixed(2)}m</text>

        <!-- PLANTA -->
        <text x="${plantaX + plantaW/2}" y="${plantaY - 12}" text-anchor="middle" class="diagram-title">Vista em Planta</text>
        <rect x="${plantaX}" y="${plantaY}" width="${plantaW}" height="${plantaH}"
          fill="${cor.bg}" stroke="${cor.accent}" stroke-width="2.5" rx="2"/>
        <rect x="${plantaX}" y="${plantaY}" width="${plantaW}" height="${plantaH}" fill="url(#brita${sf})" rx="2"/>
        <line x1="${plantaX}" y1="${plantaY + plantaH + 20}" x2="${plantaX + plantaW}" y2="${plantaY + plantaH + 20}"
          stroke="var(--diagram-dim)" stroke-width="1.5" marker-start="url(#arrowL${sf})" marker-end="url(#arrowR${sf})"/>
        <text x="${plantaX + plantaW/2}" y="${plantaY + plantaH + 38}" text-anchor="middle" class="diagram-dim">${C.toFixed(2)} m</text>
        <line x1="${plantaX + plantaW + 20}" y1="${plantaY}" x2="${plantaX + plantaW + 20}" y2="${plantaY + plantaH}"
          stroke="var(--diagram-dim)" stroke-width="1.5" marker-start="url(#arrowU${sf})" marker-end="url(#arrowD${sf})"/>
        <text x="${plantaX + plantaW + 25}" y="${plantaY + plantaH/2 + 4}" text-anchor="start" class="diagram-dim">${L.toFixed(2)} m</text>
  
        <defs>
          <marker id="arrowR${sf}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="var(--diagram-dim)"/></marker>
          <marker id="arrowL${sf}" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M8,0 L0,3 L8,6" fill="var(--diagram-dim)"/></marker>
          <marker id="arrowD${sf}" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto">
            <path d="M0,0 L3,8 L6,0" fill="var(--diagram-dim)"/></marker>
          <marker id="arrowU${sf}" markerWidth="6" markerHeight="8" refX="3" refY="0" orient="auto">
            <path d="M0,8 L3,0 L6,8" fill="var(--diagram-dim)"/></marker>
            
          <marker id="arrowD${sf}_folga" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto">
            <path d="M0,0 L3,8 L6,0" fill="#e65100"/></marker>
          <marker id="arrowU${sf}_folga" markerWidth="6" markerHeight="8" refX="3" refY="0" orient="auto">
            <path d="M0,8 L3,0 L6,8" fill="#e65100"/></marker>

          <marker id="arrowD${sf}_lencol" markerWidth="6" markerHeight="8" refX="3" refY="8" orient="auto">
            <path d="M0,0 L3,8 L6,0" fill="#0288d1"/></marker>
          <marker id="arrowU${sf}_lencol" markerWidth="6" markerHeight="8" refX="3" refY="0" orient="auto">
            <path d="M0,8 L3,0 L6,8" fill="#0288d1"/></marker>
        </defs>
      </svg>
      </div>
    `;
  });

  return html;
}

// ===== TEMPO DE RETORNO BADGE =====
function gerarTempoRetornoBadge(tr) {
  const info = getTempoRetornoCor(tr);
  const icons = {
    check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${info.cor}" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${info.cor}" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/><line x1="12" y1="9" x2="12" y2="15"/><circle cx="12" cy="18" r="0.5" fill="${info.cor}"/></svg>`,
    alert: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${info.cor}" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="${info.cor}"/></svg>`,
  };
  return `
    <div class="tr-badge-large" style="background:${info.bg};border:2px solid ${info.cor};">
      <div class="tr-badge-icon">${icons[info.icon]}</div>
      <div class="tr-badge-info">
        <span class="tr-badge-value" style="color:${info.cor};">TR = ${tr} anos</span>
        <span class="tr-badge-label" style="color:${info.cor};">${info.label}</span>
      </div>
    </div>
  `;
}

// ===== RELATÓRIO =====
let currentCasa = null;
function showReport(casa) {
  currentCasa = casa;
  const reportContent = document.getElementById("report-content");
  const cor = getCorTipologia(casa.tipologia);

  const dataAtual = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  
  const currentIndex = casas.findIndex(c => c.id === casa.id);
  const prevCasa = casas[currentIndex - 1];
  const nextCasa = casas[currentIndex + 1];

  const maxCoef = 0.50;
  const maxArea = Math.max(...casas.map(c => c.trincheira_area), 1);
  const maxVol = Math.max(...casas.map(c => c.trincheira_volume), 1);

  const soloHtml = "";

  // Seção livre (segurança)
  let livreHtml = "";
  if (casa.trincheira_livre) {
    const livreCor = casa.trincheira_livre >= 1.0 ? "#15803d" : (casa.trincheira_livre >= 0.5 ? "#f57f17" : "#c62828");
    const livreLabel = casa.trincheira_livre >= 1.0 ? "Segura" : (casa.trincheira_livre >= 0.5 ? "Moderada" : "Reduzida");
    livreHtml = `
      <div class="highlight-row" style="border-color:${cor.border}30;">
        <span class="highlight-label">Folga até lençol</span>
        <span class="highlight-value" style="color:${livreCor};">${casa.trincheira_livre.toFixed(2)} m (${livreLabel})</span>
      </div>
    `;
  }

  reportContent.innerHTML = `
    <div class="report-nav-floating no-print">
      ${prevCasa ? `<button class="btn-nav-float btn-prev-float" onclick="showReport(casas.find(c=>c.id==${prevCasa.id}))">&#8592; Lote ${prevCasa.lote}</button>` : ''}
      ${nextCasa ? `<button class="btn-nav-float btn-next-float" onclick="showReport(casas.find(c=>c.id==${nextCasa.id}))">Lote ${nextCasa.lote} &#8594;</button>` : ''}
    </div>

    <div class="report-content-inner">
      <div class="report-header-modern">
        <span class="report-modern-badge">${casa.tipologia || "Sem Tipologia"}</span>
        <h1 class="header-lote-title">Lote ${casa.lote}</h1>
        <p class="header-report-subtitle">Relatório de Trincheira de Infiltração &bull; ${dataAtual}</p>
      </div>

      <div class="report-body">

      ${gerarScreenshotHtml(casa, cor)}

      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Áreas do Lote</h3>
        ${gerarGaugeImpermeabilidade(casa, cor)}
      </div>

      ${soloHtml}

      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Indicadores e Localização</h3>
        ${casa.k_permeabilidade > 0 ? gerarBarraPermeabilidadeE_Mapa(casa.k_permeabilidade, cor, casa.lote, casa) : ""}
        <div class="gauges-row" style="margin-top: 24px;">
          ${gerarGauge(casa.trincheira_area, maxArea, "Área Trincheira", "m²", cor.accent)}
          ${gerarGauge(casa.trincheira_volume, maxVol, "Volume Trincheira", "m³", cor.accent)}
        </div>
      </div>

      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Desempenho Hidro-Sanitário e Dimensionamento</h3>
        ${casa.tempo_esvaziamento > 0 ? `
        <div class="report-highlight" style="background:#eff6ff; border: 1px solid #bfdbfe;">
          <div class="highlight-row">
            <span class="highlight-label">Tempo de Esvaziamento</span>
            <span class="highlight-value" style="color:${casa.tempo_esvaziamento <= 48 ? '#15803d' : '#c62828'}; font-weight:700;">
              ${casa.tempo_esvaziamento.toFixed(1)} h ${casa.tempo_esvaziamento <= 48 ? '✅ (Adequado)' : '⚠️ (Atenção)'}
            </span>
          </div>
          <div class="highlight-row" style="border-color:#bfdbfe;">
            <span class="highlight-label">Vazão de Entrada (Qe) / Infiltração (Qs)</span>
            <span class="highlight-value" style="color:var(--text-primary);">${casa.vazao_entrada.toFixed(2)} L/min  |  ${casa.vazao_saida.toExponential(2)} L/min</span>
          </div>
          <div class="highlight-row" style="border-color:#bfdbfe;">
            <span class="highlight-label">Altura da Lâmina d'Água (H Calc)</span>
            <span class="highlight-value" style="color:var(--text-primary);">${casa.h_max_calculado.toFixed(2)} m</span>
          </div>
          <div class="highlight-row" style="border-color:#bfdbfe;">
            <span class="highlight-label">Duração da Chuva Crítica (td)</span>
            <span class="highlight-value" style="color:var(--text-primary);">${casa.chuva_critica_td.toFixed(0)} min</span>
          </div>
        </div>
        ` : `
        <div style="background: var(--bg-body); padding: 24px; border-radius: 12px; text-align: center; border: 2px dashed var(--border-light); margin-top: 16px;">
          <h4 style="color: var(--text-secondary); margin-bottom: 8px;">Sem Dados de Desempenho</h4>
          <p style="color: var(--text-muted); font-size: 0.95rem;">A planilha Excel analisada não continha cálculos de vazão (Qe/Qs), chuva crítica e tempo de esvaziamento para o Lote ${casa.lote}. O laudo e análise dessa sessão não podem ser gerados neste lote.</p>
        </div>
        `}
      </div>

      ${casa.tempo_esvaziamento > 0 ? `
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Memória de Cálculo</h3>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">

          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">1. Intensidade de Chuva (IDF — Cruz/CE)</div>
            <div class="formula-box">
              <span class="formula">i = <span style="color:#3b82f6;">3493,67</span> · [<span style="color:#3b82f6;">${casa.tempo_retorno}</span> + (−2,04)]<sup>0,143</sup> / (t<sub>d</sub> + 15,95)<sup>0,76</sup></span>
            </div>
            <div style="font-size:0.75rem;color:#64748b;margin-top:6px;line-height:1.6;">
              A* = 1257,72 × (100/36) = 3493,67 &nbsp;|&nbsp; TR = ${casa.tempo_retorno} anos &nbsp;|&nbsp; t<sub>d,crit</sub> = ${casa.chuva_critica_td.toFixed(0)} min
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">2. Vazão de Entrada (Método Racional)</div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div class="formula-box">
                <span class="formula">Q<sub>e</sub> = C<sub>pond</sub> · i · A</span>
              </div>
              <div style="font-size:1.1rem;font-weight:800;color:#1e293b;">= ${casa.vazao_entrada.toFixed(2)} L/min</div>
            </div>
            <div style="font-size:0.75rem;color:#64748b;margin-top:6px;line-height:1.6;">
              C<sub>pond</sub> = Σ(C<sub>j</sub> · A<sub>j</sub>) / Σ A<sub>j</sub> &nbsp;|&nbsp; C<sub>telhado</sub> = 0,9 &nbsp;|&nbsp; C<sub>piscina</sub> = 1,0 &nbsp;|&nbsp; C<sub>grama</sub> = 0,15
              <br>Redução de 80% da área de telhado (Res. ADASA nº 9)
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">3. Vazão de Infiltração</div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div class="formula-box">
                <span class="formula">Q<sub>s</sub> = k · A<sub>inf</sub> · C<sub>s</sub></span>
              </div>
              <div style="font-size:1.1rem;font-weight:800;color:#1e293b;">= ${casa.vazao_saida.toExponential(2)} L/min</div>
            </div>
            <div style="font-size:0.75rem;color:#64748b;margin-top:6px;line-height:1.6;">
              k = ${casa.k_permeabilidade.toExponential(2)} m/s &nbsp;|&nbsp; C<sub>s</sub> = 0,5 (coef. segurança)
              <br>A<sub>inf</sub> = L · (H + b) — área lateral molhada
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">4. Balanço Hídrico (Altura Máxima)</div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div class="formula-box">
                <span class="formula">b · L · H = (Q<sub>e</sub> − Q<sub>s</sub>) · t<sub>d</sub> / P</span>
              </div>
              <div style="font-size:1.1rem;font-weight:800;color:#1e293b;">→ H<sub>máx</sub> = ${casa.h_max_calculado.toFixed(2)} m</div>
            </div>
            <div style="font-size:0.75rem;color:#64748b;margin-top:6px;line-height:1.6;">
              P = 50% (porosidade) &nbsp;|&nbsp; t<sub>d,crit</sub> = ${casa.chuva_critica_td.toFixed(0)} min &nbsp;|&nbsp; H<sub>máx</sub> = max[H(t<sub>d</sub>)] para t<sub>d</sub> = 1…301 min
            </div>
          </div>

          <div>
            <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">5. Tempo de Esvaziamento</div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div class="formula-box">
                <span class="formula">T<sub>e</sub> = V / Q<sub>s</sub></span>
              </div>
              <div style="font-size:1.1rem;font-weight:800;color:${casa.tempo_esvaziamento <= 48 ? '#15803d' : '#c62828'};">= ${casa.tempo_esvaziamento.toFixed(1)} h ${casa.tempo_esvaziamento <= 48 ? '(< 48h ✅)' : '(> 48h ⚠️)'}</div>
            </div>
            <div style="font-size:0.75rem;color:#64748b;margin-top:6px;line-height:1.6;">
              V = b · L · H<sub>máx</sub> = ${casa.trincheira_volume.toFixed(2)} m³
            </div>
          </div>

        </div>
      </div>
      ` : ''}

      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Dimensionamento da Trincheira</h3>
        <div class="report-highlight" style="background:${cor.bg};">
          <div class="highlight-row" style="align-items: flex-start;">
            <span class="highlight-label" style="padding-top: 4px;">Dimensões (C × L × P)</span>
            <div style="text-align: right;">
              ${casa.trincheiras.length > 0 ? casa.trincheiras.map((t, i) => `<div class="highlight-value" style="color:${cor.text}; font-size: 1.05rem; margin-bottom: 6px;">T${i+1}: ${t.l.toFixed(2)}m × ${t.b.toFixed(2)}m × ${t.h.toFixed(2)}m</div>`).join('') : '<span class="highlight-value" style="color:#999; font-size: 1rem;">N/A</span>'}
            </div>
          </div>
          ${casa.trincheira_profundidade_total > 0 ? `
          <div class="highlight-row" style="border-color:${cor.border}30;">
            <span class="highlight-label">Profundidade total (P + folga)</span>
            <span class="highlight-value" style="color:${cor.text};">${casa.trincheira_profundidade_total.toFixed(2)} m</span>
          </div>` : ""}
          <div class="highlight-row" style="border-color:${cor.border}30;">
            <span class="highlight-label">Área da trincheira</span>
            <span class="highlight-value" style="color:${cor.text};">${casa.trincheira_area.toFixed(2)} m²</span>
          </div>
          <div class="highlight-row" style="border-color:${cor.border}30;">
            <span class="highlight-label">Volume da trincheira</span>
            <span class="highlight-value" style="color:${cor.text};">${casa.trincheira_volume.toFixed(2)} m³</span>
          </div>
          ${livreHtml}
        </div>

        <div style="margin-top:12px;">
          ${gerarTempoRetornoBadge(casa.tempo_retorno)}
        </div>
      </div>

      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Diagrama da Trincheira</h3>
        <div class="diagram-wrapper">
          ${gerarDiagramaTrincheira(casa, cor)}
        </div>
      </div>

    </div>

    <div class="report-footer">
      <div style="font-weight: 700; color: #0f3460; font-size: 0.85rem;">Mestra Engenharia Sustentável</div>
      <div style="font-size: 0.8rem; margin-bottom: 6px;">Engenheiro Responsável Gustavo Moro Bassil Dower</div>
      <div style="font-size: 0.7rem; color: var(--text-muted); border-top: 1px solid var(--border-light); padding-top: 6px; display: inline-block;">
        Relatório gerado em ${dataAtual} &bull; Vila Carnaúba - Turnkey - Casa ${casa.lote} - ${casa.tipologia || "Sem Tipologia"}
      </div>
    </div>
  `;

  showScreen("report-screen");
  window.scrollTo(0, 0);
}

// ===== VISTA DE IMPRESSÃO A4 =====
let currentPrintCasa = null;

function showPrintView() {
  if (!currentCasa) return;
  currentPrintCasa = currentCasa;
  const casa = currentCasa;
  const cor = getCorTipologia(casa.tipologia);
  const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const maxArea = Math.max(...casas.map(c => c.trincheira_area), 1);
  const maxVol = Math.max(...casas.map(c => c.trincheira_volume), 1);

  // soloHtml removido - SP area agora no card de permeabilidade

  const livreHtml = casa.trincheira_livre ? (() => {
    const livreCor = casa.trincheira_livre >= 1.0 ? "#15803d" : (casa.trincheira_livre >= 0.5 ? "#f57f17" : "#c62828");
    const livreLabel = casa.trincheira_livre >= 1.0 ? "Segura" : (casa.trincheira_livre >= 0.5 ? "Moderada" : "Reduzida");
    return `<div class="highlight-row" style="border-color:${cor.border}30;">
      <span class="highlight-label">Folga até lençol freático</span>
      <span class="highlight-value" style="color:${livreCor};">${casa.trincheira_livre.toFixed(2)} m (${livreLabel})</span>
    </div>`;
  })() : '';

  function pageHeader() {
    return `<div class="a4-header">
      <div class="a4-header-left">
        <div>
          <div class="a4-header-title">Mestra Engenharia Sustentável</div>
          <div class="a4-header-sub">Relatório de Trincheira de Infiltração</div>
        </div>
      </div>
      <div class="a4-header-lote">Lote ${casa.lote} — ${casa.tipologia || 'Sem Tipologia'}</div>
    </div>`;
  }

  function pageFooter(num, total) {
    return `<div class="a4-footer">
      <span class="a4-footer-company">Mestra Engenharia Sustentável — Eng. Gustavo Moro Bassil Dower</span>
      <span>${dataAtual} · Vila Carnaúba · Casa ${casa.lote}</span>
      <span class="a4-footer-page">Página ${num}/${total}</span>
    </div>`;
  }

  // PAGE 1: Header + TR + Áreas do Lote + Solo
  const page1 = `<div class="a4-page">
    ${pageHeader()}
    <div class="a4-body">
      <div style="text-align:center;margin-bottom:16px;">
        <span class="report-modern-badge" style="display:inline-block;">${casa.tipologia || 'Sem Tipologia'}</span>
        <h1 style="font-size:2rem;font-weight:900;color:#1a1a2e;margin:8px 0 4px;">Lote ${casa.lote}</h1>
        <p style="color:#64748b;font-size:0.85rem;">${dataAtual}</p>
      </div>
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Tempo de Retorno</h3>
        ${gerarTempoRetornoBadge(casa.tempo_retorno)}
      </div>
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Áreas do Lote</h3>
        ${gerarGaugeImpermeabilidade(casa, cor)}
      </div>
    </div>
    ${pageFooter(1, 3)}
  </div>`;

  // PAGE 2: Indicadores + Desempenho + Dimensionamento
  const page2 = `<div class="a4-page">
    ${pageHeader()}
    <div class="a4-body">
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Indicadores e Localização</h3>
        ${casa.k_permeabilidade > 0 ? gerarBarraPermeabilidadeE_Mapa(casa.k_permeabilidade, cor, casa.lote, casa) : ''}
        <div class="gauges-row" style="margin-top:16px;">
          ${gerarGauge(casa.trincheira_area, maxArea, "Área Trincheira", "m²", cor.accent)}
          ${gerarGauge(casa.trincheira_volume, maxVol, "Volume Trincheira", "m³", cor.accent)}
        </div>
      </div>
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Desempenho Hidro-Sanitário</h3>
        ${casa.tempo_esvaziamento > 0 ? `
        <div class="report-highlight" style="background:#eff6ff;border:1px solid #bfdbfe;">
          <div class="highlight-row">
            <span class="highlight-label">Tempo de Esvaziamento</span>
            <span class="highlight-value" style="color:${casa.tempo_esvaziamento <= 48 ? '#15803d' : '#c62828'};">
              ${casa.tempo_esvaziamento.toFixed(1)} h ${casa.tempo_esvaziamento <= 48 ? '✅' : '⚠️'}
            </span>
          </div>
          <div class="highlight-row" style="border-color:#bfdbfe;">
            <span class="highlight-label">Vazão Entrada / Infiltração</span>
            <span class="highlight-value">${casa.vazao_entrada.toFixed(2)} L/min | ${casa.vazao_saida.toExponential(2)} L/min</span>
          </div>
          <div class="highlight-row" style="border-color:#bfdbfe;">
            <span class="highlight-label">Altura da Lâmina d'Água</span>
            <span class="highlight-value">${casa.h_max_calculado.toFixed(2)} m</span>
          </div>
          <div class="highlight-row" style="border-color:#bfdbfe;">
            <span class="highlight-label">Duração da Chuva Crítica</span>
            <span class="highlight-value">${casa.chuva_critica_td.toFixed(0)} min</span>
          </div>
        </div>` : '<p style="color:#999;text-align:center;">Sem dados de desempenho</p>'}
      </div>
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Dimensionamento da Trincheira</h3>
        <div class="report-highlight" style="background:${cor.bg};">
          <div class="highlight-row" style="align-items:flex-start;">
            <span class="highlight-label" style="padding-top:4px;">Dimensões (C × L × P)</span>
            <div style="text-align:right;">
              ${casa.trincheiras.length > 0 ? casa.trincheiras.map((t, i) => '<div class="highlight-value" style="color:' + cor.text + ';font-size:1.05rem;margin-bottom:6px;">T' + (i+1) + ': ' + t.l.toFixed(2) + 'm × ' + t.b.toFixed(2) + 'm × ' + t.h.toFixed(2) + 'm</div>').join('') : '<span class="highlight-value" style="color:#999;">N/A</span>'}
            </div>
          </div>
          ${casa.trincheira_profundidade_total > 0 ? `
          <div class="highlight-row" style="border-color:${cor.border}30;">
            <span class="highlight-label">Profundidade total (P + folga)</span>
            <span class="highlight-value" style="color:${cor.text};">${casa.trincheira_profundidade_total.toFixed(2)} m</span>
          </div>` : ''}
          <div class="highlight-row" style="border-color:${cor.border}30;">
            <span class="highlight-label">Área da trincheira</span>
            <span class="highlight-value" style="color:${cor.text};">${casa.trincheira_area.toFixed(2)} m²</span>
          </div>
          <div class="highlight-row" style="border-color:${cor.border}30;">
            <span class="highlight-label">Volume da trincheira</span>
            <span class="highlight-value" style="color:${cor.text};">${casa.trincheira_volume.toFixed(2)} m³</span>
          </div>
          ${livreHtml}
        </div>
      </div>
    </div>
    ${pageFooter(2, 3)}
  </div>`;

  // PAGE 3: Diagrama
  const page3 = `<div class="a4-page">
    ${pageHeader()}
    <div class="a4-body">
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Diagrama da Trincheira</h3>
        <div class="diagram-wrapper">
          ${gerarDiagramaTrincheira(casa, cor)}
        </div>
      </div>
    </div>
    ${pageFooter(3, 3)}
  </div>`;

  // Página 4: Screenshot do projeto (se houver)
  const screenshotImg = getScreenshotForLote(casa.lote);
  const page4 = screenshotImg ? `<div class="a4-page">
    ${pageHeader()}
    <div class="a4-body">
      <div class="report-section">
        <h3 style="color:${cor.accent};border-bottom-color:${cor.bg};">Projeto — Implantação</h3>
        <div class="screenshot-container">
          <img src="${screenshotImg}" alt="Screenshot do projeto - Lote ${casa.lote}" class="screenshot-img"/>
        </div>
      </div>
    </div>
    ${pageFooter(4, 4)}
  </div>` : '';

  const totalPages = screenshotImg ? 4 : 3;
  const p1 = page1.replace(/Página \d+ de \d+/, `Página 1 de ${totalPages}`);
  const p2 = page2.replace(/Página \d+ de \d+/, `Página 2 de ${totalPages}`);
  const p3 = page3.replace(/Página \d+ de \d+/, `Página 3 de ${totalPages}`);

  document.getElementById("print-pages").innerHTML = p1 + p2 + p3 + page4;
  showScreen("print-screen");
  window.scrollTo(0, 0);
}

function closePrintView() {
  showScreen("report-screen");
  window.scrollTo(0, 0);
}

// ===== BUSCA =====
document.getElementById("search-input").addEventListener("input", () => applyFilters());

// ===== INIT =====
initDarkMode();
setupUpload();
setupScreenshots();

// Tentar carregar a planilha hardcoded do servidor
async function carregarPlanilhaPadrao() {
  try {
    const uploadArea = document.querySelector(".upload-area h2");
    if (uploadArea) uploadArea.textContent = "Carregando planilha padrão...";
    
    const res = await fetch("/api/planilha");
    if (!res.ok) throw new Error("Planilha padrão não disponível no servidor");
    
    const buffer = await res.arrayBuffer();
    parseExcel(new Uint8Array(buffer));
  } catch (err) {
    console.log("Iniciando com seleção manual:", err.message);
    const uploadArea = document.querySelector(".upload-area h2");
    if (uploadArea) uploadArea.textContent = "Arraste o arquivo Excel aqui";
  }
}

carregarPlanilhaPadrao();
