// script.js - Versión que llama al BACKEND API

// ========== CONFIGURACIÓN ==========
// CAMBIAR ESTA URL POR LA DE RENDER CUANDO ESTÉ DESPLEGADO
const API_BASE_URL = 'http://localhost:8080';  // Local para pruebas
// const API_BASE_URL = 'https://optimizacion-barras-api.onrender.com'; // Producción

// ========== ESTADO GLOBAL ==========
let state = {
    cuts: [],
    bars: [],
    config: {
        barLength: 6000,
        marginLeft: 50,
        marginRight: 30,
        bladeThickness: 4.0,
        wasteThreshold: 300
    },
    results: {
        totalBars: 0,
        totalMaterial: 0,
        totalUtilizado: 0,
        totalReusable: 0,
        desperdicioCortes: 0,
        desperdicioMargen: 0,
        desperdicioDisco: 0,
        desperdicioFinal: 0,
        efficiency: 0,
        totalCuts: 0
    },
    calculationDone: false
};

let useCustomNames = false;
let barNamePrefix = "PERFIL";
let nombreObra = "";
let anclarObra = false;
let mostrarMedidas = true;
let mostrarGrados = true;
let cortePendiente = null;
let cantidadPendiente = 0;

// ========== UTILIDADES ==========
function mostrarMensaje(texto, tipo = "info") {
    const msg = document.createElement("div");
    msg.textContent = texto;
    let color = tipo === "exito" ? "#10b981" : tipo === "error" ? "#ef4444" : tipo === "advertencia" ? "#f59e0b" : "#64748b";
    msg.style.position = "fixed";
    msg.style.top = "80px";
    msg.style.left = "50%";
    msg.style.transform = "translateX(-50%)";
    msg.style.backgroundColor = color;
    msg.style.color = "white";
    msg.style.padding = "12px 24px";
    msg.style.borderRadius = "8px";
    msg.style.zIndex = "10001";
    msg.style.fontSize = "14px";
    msg.style.fontWeight = "bold";
    msg.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    msg.style.whiteSpace = "nowrap";
    msg.style.maxWidth = "90%";
    msg.style.whiteSpace = "normal";
    msg.style.textAlign = "center";
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
}

// ========== LLAMADA AL BACKEND ==========
async function calculateOptimization() {
    if (state.cuts.length === 0) {
        mostrarMensaje("❌ Agrega al menos un corte", "advertencia");
        return;
    }

    mostrarMensaje("🔄 Calculando optimización...", "info");

    try {
        const response = await fetch(`${API_BASE_URL}/api/optimizacion/calcular`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cuts: state.cuts,
                config: state.config
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Error en el servidor");
        }

        const resultado = await response.json();
        
        // Actualizar estado con resultados del backend
        state.bars = resultado.bars;
        state.results = {
            totalBars: resultado.totalBars,
            totalMaterial: resultado.totalMaterial,
            totalUtilizado: resultado.totalUtilizado,
            totalReusable: resultado.totalReusable,
            desperdicioCortes: resultado.desperdicioCortes,
            desperdicioMargen: resultado.desperdicioMargen,
            desperdicioDisco: resultado.desperdicioDisco,
            desperdicioFinal: resultado.desperdicioFinal,
            efficiency: resultado.efficiency,
            totalCuts: resultado.totalCuts
        };
        state.calculationDone = true;
        
        // Renderizar todo
        updateUIFromState();
        renderBarsVisualization();
        renderResultsTable();
        renderReport();
        
        mostrarMensaje(`✅ Optimización completada: ${resultado.totalBars} barras, ${resultado.efficiency}% eficiencia`, "exito");
        
    } catch (error) {
        console.error("Error:", error);
        mostrarMensaje(`❌ Error: ${error.message}`, "error");
    }
}

// ========== AGREGAR CORTE LOCAL ==========
function addCutFromInput() {
    if (state.calculationDone) {
        mostrarMensaje("Usa 'NUEVO PROYECTO' para agregar más cortes", "advertencia");
        return;
    }

    const length = parseFloat(document.getElementById("input-corte-length").value);
    const quantity = parseInt(document.getElementById("input-corte-cantidad").value) || 1;
    const fijarGrados = document.getElementById("checkbox-fijar-grados").checked;
    let gradoInicial = parseInt(document.getElementById("select-grado-inicial").value);
    let gradoFinal = parseInt(document.getElementById("select-grado-final").value);

    if (!length || length <= 0) {
        mostrarMensaje("Ingresa una longitud válida", "error");
        document.getElementById("input-corte-length").focus();
        return;
    }

    // Validación local básica
    const maxLength = state.config.barLength - state.config.marginLeft - state.config.marginRight - state.config.bladeThickness;
    if (length < 50) {
        mostrarMensaje(`❌ Medida mínima: 50 mm`, "error");
        return;
    }
    if (length > maxLength) {
        mostrarMensaje(`❌ Medida máxima: ${maxLength} mm`, "error");
        return;
    }

    if (quantity > 2000) {
        mostrarMensaje("La cantidad no puede superar 2000", "error");
        return;
    }

    // Verificar duplicados
    const existe = state.cuts.some(cut => cut.length === length && cut.gradoInicial === gradoInicial && cut.gradoFinal === gradoFinal);
    
    if (existe) {
        cortePendiente = { length, gradoInicial, gradoFinal };
        cantidadPendiente = quantity;
        const mensajeDiv = document.getElementById("mensaje-duplicado");
        mensajeDiv.innerHTML = `<p><strong>Medida:</strong> ${length}mm</p><p><strong>Grados:</strong> ${gradoInicial}° → ${gradoFinal}°</p><p><strong>¿Deseas agregar ${quantity} más?</strong></p>`;
        document.getElementById("modal-duplicado").style.display = "flex";
        return;
    }

    agregarCorteDirectamente(length, quantity, gradoInicial, gradoFinal, fijarGrados);
}

function agregarCorteDirectamente(length, quantity, gradoInicial, gradoFinal, fijarGrados) {
    for (let i = 0; i < quantity; i++) {
        state.cuts.push({
            id: Date.now() + i + Math.random(),
            length: length,
            bladeThickness: state.config.bladeThickness,
            gradoInicial: gradoInicial,
            gradoFinal: gradoFinal
        });
    }

    document.getElementById("input-corte-length").value = "";
    document.getElementById("input-corte-cantidad").value = "1";
    
    if (!fijarGrados) {
        document.getElementById("select-grado-inicial").value = "0";
        document.getElementById("select-grado-final").value = "0";
    }

    updateCutsList();
    updateBladeStats();
    mostrarMensaje(`✓ ${quantity} corte(s) de ${length}mm agregado(s)`, "exito");
    document.getElementById("input-corte-length").focus();
}

// ========== ELIMINAR CORTE ==========
window.removeCut = (cutId) => {
    if (!state.calculationDone) {
        const corteAEliminar = state.cuts.find(cut => String(cut.id) === String(cutId));
        if (corteAEliminar) {
            state.cuts = state.cuts.filter(cut => !(cut.length === corteAEliminar.length && cut.gradoInicial === corteAEliminar.gradoInicial && cut.gradoFinal === corteAEliminar.gradoFinal));
        }
        updateCutsList();
        updateBladeStats();
        mostrarMensaje("✖ Cortes eliminados", "error");
    } else {
        mostrarMensaje("Usa 'NUEVO PROYECTO' para eliminar cortes", "advertencia");
    }
};

// ========== ACTUALIZAR UI LOCAL ==========
function updateCutsList() {
    const cutsList = document.getElementById("cuts-list");
    if (state.cuts.length === 0) {
        cutsList.innerHTML = '<div class="cut-item empty-message"><span>No hay cortes agregados</span></div>';
        return;
    }
    const cutsMap = new Map();
    state.cuts.forEach(cut => {
        const key = `${cut.length}_${cut.gradoInicial}_${cut.gradoFinal}`;
        if (!cutsMap.has(key)) cutsMap.set(key, { count: 0, firstCut: cut });
        cutsMap.get(key).count++;
    });
    cutsList.innerHTML = Array.from(cutsMap.values()).map(data => {
        const cut = data.firstCut;
        const count = data.count;
        const gradoText = (cut.gradoInicial === 0 && cut.gradoFinal === 0) ? "" : `<span class="cut-degree">${cut.gradoInicial}°→${cut.gradoFinal}°</span>`;
        return `<div class="cut-item"><div class="cut-info"><span class="cut-length">${cut.length} mm</span>${count > 1 ? `<span class="cut-quantity">×${count}</span>` : ""}${gradoText}</div><div><button class="btn-icon" onclick="removeCut('${cut.id}')"><i class="fas fa-times"></i></button></div></div>`;
    }).join("");
}

function updateBladeStats() {
    document.getElementById("total-cortes").textContent = state.cuts.length;
    document.getElementById("valor-perdida-disco").textContent = `${state.config.bladeThickness} mm`;
}

function updateUsableLength() {
    const usableLength = state.config.barLength - state.config.marginLeft - state.config.marginRight;
    document.getElementById("largo-util-disponible").textContent = `${usableLength} mm`;
    document.getElementById("descartes-extremos").textContent = `${state.config.marginLeft + state.config.marginRight} mm`;
    actualizarLimitesInput();
}

function actualizarLimitesInput() {
    const maxLength = state.config.barLength - state.config.marginLeft - state.config.marginRight - state.config.bladeThickness;
    const helpText = document.getElementById("length-help-text");
    if (helpText) helpText.textContent = `Rango válido: 50mm - ${maxLength}mm`;
}

function updateUIFromState() {
    document.getElementById("stats-barras-necesarias").textContent = state.results.totalBars;
    document.getElementById("stats-material-total").textContent = `${(state.results.totalMaterial / 1000).toFixed(2)} m`;
    document.getElementById("stats-material-util").textContent = `${(state.results.totalUtilizado / 1000).toFixed(2)} m`;
    document.getElementById("stats-sobrante-reutilizable").textContent = `${(state.results.totalReusable / 1000).toFixed(2)} m`;
    document.getElementById("stats-desperdicio-cortes").textContent = `${(state.results.desperdicioCortes / 1000).toFixed(2)} m`;
    document.getElementById("stats-desperdicio-margen").textContent = `${(state.results.desperdicioMargen / 1000).toFixed(2)} m`;
    document.getElementById("stats-desperdicio-disco").textContent = `${(state.results.desperdicioDisco / 1000).toFixed(2)} m`;
    const wastePercent = state.results.totalMaterial > 0 ? ((state.results.desperdicioFinal / state.results.totalMaterial) * 100).toFixed(1) : "0";
    document.getElementById("stats-desperdicio-final").innerHTML = `${(state.results.desperdicioFinal / 1000).toFixed(2)} m (${wastePercent}%)`;
    
    document.getElementById("footer-barras").textContent = state.results.totalBars;
    document.getElementById("footer-material-total").textContent = `${(state.results.totalMaterial / 1000).toFixed(2)} m`;
    document.getElementById("footer-material-utilizado").textContent = `${(state.results.totalUtilizado / 1000).toFixed(2)} m`;
    document.getElementById("footer-sobrante").textContent = `${(state.results.totalReusable / 1000).toFixed(2)} m`;
    document.getElementById("footer-desperdicio-cortes").textContent = `${(state.results.desperdicioCortes / 1000).toFixed(2)} m`;
    document.getElementById("footer-desperdicio-margen").textContent = `${(state.results.desperdicioMargen / 1000).toFixed(2)} m`;
    document.getElementById("footer-desperdicio-disco").textContent = `${(state.results.desperdicioDisco / 1000).toFixed(2)} m`;
    document.getElementById("footer-desperdicio-final").textContent = `${(state.results.desperdicioFinal / 1000).toFixed(2)} m`;
    
    document.getElementById("stats-largo-total").textContent = `${state.config.barLength} mm`;
    document.getElementById("stats-considerado-desperdicio").textContent = `${state.config.wasteThreshold} mm`;
}

// ========== RENDERIZADO DE RESULTADOS ==========
function renderBarsVisualization() {
    const container = document.getElementById("bars-container");
    if (state.bars.length === 0) {
        container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;color:#64748b;"><i class="fas fa-chart-bar" style="font-size:4rem;opacity:0.5;"></i><p>No hay barras para mostrar</p><p>Agrega cortes y haz clic en "Optimización"</p></div>`;
        return;
    }

    container.innerHTML = state.bars.map((bar, barIndex) => {
        const margenTotal = state.config.marginLeft + state.config.marginRight;
        const usableLength = state.config.barLength - margenTotal;
        const bladeTotalBar = bar.cuts.length * state.config.bladeThickness;
        const utilizadoBar = bar.usedLength - bladeTotalBar;
        const sobranteReal = bar.waste;
        const sobranteRealEsDesperdicio = sobranteReal < state.config.wasteThreshold;
        const sobranteVisual = sobranteRealEsDesperdicio ? 0 : sobranteReal;
        const desperdicioBar = sobranteRealEsDesperdicio ? sobranteReal : 0;

        const marginLeftPercent = (state.config.marginLeft / state.config.barLength) * 100;
        const marginRightPercent = (state.config.marginRight / state.config.barLength) * 100;
        let segments = `<div class="bar-segment segment-margin" style="left:0%; width:${marginLeftPercent}%;" title="Margen izquierdo ${state.config.marginLeft}mm"></div>`;
        let leftPos = marginLeftPercent;
        
        bar.cuts.forEach((cut, idx) => {
            const cutPercent = ((cut.length + state.config.bladeThickness) / state.config.barLength) * 100;
            const colorClass = `segment-cut-${(idx % 6) + 1}`;
            let contenidoMedida = (mostrarMedidas && cutPercent > 5) ? cut.length + "mm" : "";
            let contenidoGrados = "";
            if (mostrarGrados && (cut.gradoInicial !== 0 || cut.gradoFinal !== 0)) {
                contenidoGrados = `<div class="degree-visual degree-left" style="left:2%;">${cut.gradoInicial}°</div><div class="degree-visual degree-right" style="right:2%;">${cut.gradoFinal}°</div>`;
            }
            segments += `<div class="bar-segment ${colorClass}" style="left:${leftPos}%; width:${cutPercent}%;" title="${cut.length}mm [${cut.gradoInicial}°→${cut.gradoFinal}°]">${contenidoMedida}${contenidoGrados}</div>`;
            leftPos += cutPercent;
        });
        
        const wastePercent = 100 - marginLeftPercent - marginRightPercent - (bar.usedLength / state.config.barLength) * 100;
        if (wastePercent > 0) {
            const wasteClass = sobranteRealEsDesperdicio ? "segment-waste-disposal" : "segment-waste-reusable";
            segments += `<div class="bar-segment ${wasteClass}" style="left:${leftPos}%; width:${wastePercent}%;" title="${sobranteRealEsDesperdicio ? "DESPERDICIO" : "REUTILIZABLE"} ${Math.round(bar.waste)}mm">${Math.round(bar.waste)}mm</div>`;
        }
        segments += `<div class="bar-segment segment-margin" style="left:${100 - marginRightPercent}%; width:${marginRightPercent}%;" title="Margen derecho ${state.config.marginRight}mm"></div>`;

        return `<div class="bar-card"><div class="bar-header"><div class="bar-title">${bar.name}</div><div class="bar-stats"><span>Margen:${margenTotal}</span><span>Útil:${usableLength}</span><span>Cortes:${bar.cuts.length}</span><span>Util:${utilizadoBar}</span><span>Disco:${bladeTotalBar}</span><span>Sobrante:${Math.round(sobranteVisual)}</span><span>Desp:${desperdicioBar}</span></div></div><div class="bar-diagram"><div class="bar-scale">${segments}</div>${barIndex === 0 ? `<div class="bar-labels"><span>0</span><span>${state.config.barLength}mm</span></div><div class="bar-legend"><div class="legend-item"><div class="legend-color" style="background:#10b981;"></div><span>Corte</span></div><div class="legend-item"><div class="legend-color" style="background:#94a3b8;"></div><span>Margen</span></div><div class="legend-item"><div class="legend-color" style="background:#024A86;"></div><span>Sobrante</span></div><div class="legend-item"><div class="legend-color" style="background:#ef4444;"></div><span>Desperdicio</span></div></div>` : ""}</div></div>`;
    }).join("");
}

function renderResultsTable() {
    const tbody = document.getElementById("table-body");
    if (state.bars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:3rem;"><i class="fas fa-table" style="font-size:3rem;opacity:0.5;"></i><p>No hay datos para mostrar</p></td></tr>`;
        return;
    }
    let rows = "";
    const coloresPastel = ["#eff6ff", "#f0fdf4", "#fffbeb", "#fdf2f8", "#f5f3ff", "#ecfeff"];
    state.bars.forEach(bar => {
        let acumulado = 0;
        const usableLength = state.config.barLength - state.config.marginLeft - state.config.marginRight;
        const colorFila = coloresPastel[(bar.id - 1) % coloresPastel.length];
        bar.cuts.forEach((cut, idx) => {
            const total = cut.length + state.config.bladeThickness;
            acumulado += total;
            const sobrante = usableLength - acumulado;
            const gradoText = (cut.gradoInicial === 0 && cut.gradoFinal === 0) ? "0°" : `${cut.gradoInicial}°→${cut.gradoFinal}°`;
            rows += `<tr style="background-color:${colorFila}"><td>${bar.name}</td><td>${idx + 1}</td><td>${cut.length}</td><td>${gradoText}</td><td>${state.config.bladeThickness}</td><td>${total}</td><td><strong>${acumulado}</strong></td><td>${sobrante}</td></tr>`;
        });
    });
    tbody.innerHTML = rows;
}

function renderReport() {
    const container = document.getElementById("report-container");
    if (state.bars.length === 0) {
        container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;color:#64748b;"><i class="fas fa-file-alt" style="font-size:4rem;opacity:0.5;"></i><p>No hay reporte para mostrar</p></div>`;
        return;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const usableLength = state.config.barLength - state.config.marginLeft - state.config.marginRight;
    const margenTotal = state.config.marginLeft + state.config.marginRight;
    const html = `<div class="report-content" id="printable-report"><div style="text-align:center;margin-bottom:1.5rem;border-bottom:2px solid #000;"><h1>REPORTE DE OPTIMIZACIÓN DE BARRAS</h1><p>Fecha: ${dateStr}</p><p>Obra: ${nombreObra || "No especificada"}</p></div><div style="font-size:13px;margin-bottom:1rem;"><p><strong>CONFIGURACIÓN:</strong> Largo:${state.config.barLength}mm | Márgenes:${state.config.marginLeft}+${state.config.marginRight}=${margenTotal}mm | Disco:${state.config.bladeThickness}mm | Útil:${usableLength}mm</p><p>Total cortes:${state.cuts.length} | Barras:${state.bars.length} | Eficiencia:${state.results.efficiency}%</p></div>${state.bars.map(bar => `<div style="margin-bottom:1rem;border-bottom:1px solid #ccc;"><strong>${bar.name}</strong> - ${bar.cuts.length} cortes - ${Math.round(bar.efficiency)}% eficiencia<br>Cortes: ${bar.cuts.map(c => c.length + "mm").join(", ")}</div>`).join("")}<div style="margin-top:2rem;"><p>Firma: _________________________</p><p>Desarrollado por: LCevallos</p></div></div>`;
    container.innerHTML = html;
}

// ========== CONFIGURACIÓN ==========
function openModal() {
    document.getElementById("modal-largo-barra").value = state.config.barLength;
    document.getElementById("modal-margen-izquierdo").value = state.config.marginLeft;
    document.getElementById("modal-margen-derecho").value = state.config.marginRight;
    document.getElementById("modal-grosor-disco").value = state.config.bladeThickness;
    document.getElementById("modal-waste-threshold").value = state.config.wasteThreshold;
    document.getElementById("config-modal").style.display = "block";
}

function closeModal() {
    document.getElementById("config-modal").style.display = "none";
}

function applyModalChanges() {
    if (state.calculationDone) {
        mostrarMensaje("Usa 'NUEVO PROYECTO' para cambiar la configuración", "advertencia");
        closeModal();
        return;
    }
    
    state.config.barLength = parseFloat(document.getElementById("modal-largo-barra").value) || 6000;
    state.config.marginLeft = parseFloat(document.getElementById("modal-margen-izquierdo").value) || 0;
    state.config.marginRight = parseFloat(document.getElementById("modal-margen-derecho").value) || 0;
    state.config.bladeThickness = parseFloat(document.getElementById("modal-grosor-disco").value) || 4;
    state.config.wasteThreshold = parseFloat(document.getElementById("modal-waste-threshold").value) || 300;
    
    // Validar cortes existentes
    const maxLength = state.config.barLength - state.config.marginLeft - state.config.marginRight - state.config.bladeThickness;
    const cortesInvalidos = state.cuts.filter(cut => cut.length > maxLength);
    if (cortesInvalidos.length > 0) {
        mostrarMensaje(`⚠️ ${cortesInvalidos.length} corte(s) exceden el nuevo límite y serán eliminados`, "advertencia");
        state.cuts = state.cuts.filter(cut => cut.length <= maxLength);
        updateCutsList();
        updateBladeStats();
    }
    
    updateUsableLength();
    actualizarLimitesInput();
    updateUIFromState();
    if (state.bars.length > 0) {
        renderBarsVisualization();
        renderResultsTable();
        renderReport();
    }
    closeModal();
    mostrarMensaje("✅ Configuración actualizada", "exito");
}

// ========== NUEVO PROYECTO ==========
function resetApplication() {
    state.cuts = [];
    state.bars = [];
    state.calculationDone = false;
    state.results = { totalBars: 0, totalMaterial: 0, totalUtilizado: 0, totalReusable: 0, desperdicioCortes: 0, desperdicioMargen: 0, desperdicioDisco: 0, desperdicioFinal: 0, efficiency: 0, totalCuts: 0 };
    
    if (!anclarObra) {
        nombreObra = "";
        document.getElementById("input-nombre-obra").value = "";
    }
    
    document.getElementById("checkbox-usar-nombres").checked = false;
    document.getElementById("nombre-barra-container").style.display = "none";
    document.getElementById("input-corte-length").value = "";
    document.getElementById("input-corte-cantidad").value = "1";
    document.getElementById("select-grado-inicial").value = "0";
    document.getElementById("select-grado-final").value = "0";
    document.getElementById("checkbox-fijar-grados").checked = false;
    
    updateCutsList();
    updateBladeStats();
    updateUsableLength();
    updateUIFromState();
    renderBarsVisualization();
    renderResultsTable();
    renderReport();
    mostrarMensaje("🔄 Nuevo proyecto iniciado", "info");
}

function startNewProject() {
    if (state.cuts.length === 0) {
        mostrarMensaje("No hay cortes para eliminar", "advertencia");
        return;
    }
    document.getElementById("modal-nuevo-proyecto").style.display = "flex";
    document.getElementById("btn-confirmar-nuevo").onclick = () => { resetApplication(); document.getElementById("modal-nuevo-proyecto").style.display = "none"; };
    document.getElementById("btn-cancelar-nuevo").onclick = () => { document.getElementById("modal-nuevo-proyecto").style.display = "none"; };
}

// ========== IMPRESIÓN ==========
function printReport() {
    if (state.bars.length === 0) {
        mostrarMensaje("Primero calcula una optimización", "advertencia");
        return;
    }
    const contenido = document.getElementById("printable-report").cloneNode(true);
    const ventana = window.open("", "_blank");
    ventana.document.write(`<html><head><title>Reporte Optimización</title><style>body{font-family:Arial;padding:20px;}@media print{@page{size:A4;margin:1cm;}}</style></head><body>${contenido.outerHTML}<script>window.print();<\/script></body></html>`);
    ventana.document.close();
}

// ========== EVENTOS ==========
function bindEvents() {
    document.getElementById("btn-add-cut").addEventListener("click", addCutFromInput);
    document.getElementById("btn-calculate").addEventListener("click", calculateOptimization);
    document.getElementById("btn-new").addEventListener("click", startNewProject);
    document.getElementById("btn-print").addEventListener("click", printReport);
    document.getElementById("btn-config").addEventListener("click", openModal);
    document.getElementById("btn-manual").addEventListener("click", () => document.getElementById("manual-modal").style.display = "block");
    document.getElementById("btn-manual-footer").addEventListener("click", () => document.getElementById("manual-modal").style.display = "block");
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-apply").addEventListener("click", applyModalChanges);
    document.getElementById("manual-modal-close").addEventListener("click", () => document.getElementById("manual-modal").style.display = "none");
    document.getElementById("manual-modal-close-btn").addEventListener("click", () => document.getElementById("manual-modal").style.display = "none");
    
    document.getElementById("checkbox-usar-nombres").addEventListener("change", function(e) {
        useCustomNames = e.target.checked;
        document.getElementById("nombre-barra-container").style.display = e.target.checked ? "block" : "none";
    });
    document.getElementById("input-nombre-base").addEventListener("input", function(e) { barNamePrefix = e.target.value.trim() || "PERFIL"; });
    document.getElementById("checkbox-mostrar-medidas").addEventListener("change", function(e) { mostrarMedidas = e.target.checked; renderBarsVisualization(); });
    document.getElementById("checkbox-mostrar-grados").addEventListener("change", function(e) { mostrarGrados = e.target.checked; renderBarsVisualization(); });
    document.getElementById("input-nombre-obra").addEventListener("input", function(e) { nombreObra = e.target.value; });
    document.getElementById("checkbox-anclar-obra").addEventListener("change", function(e) { anclarObra = e.target.checked; });
    document.getElementById("btn-fullscreen").addEventListener("click", () => document.documentElement.requestFullscreen());
    
    // Edge panel móvil
    document.getElementById("edgeTab")?.addEventListener("click", () => document.getElementById("edgePanel").classList.add("open"));
    document.getElementById("edgeOverlay")?.addEventListener("click", () => document.getElementById("edgePanel").classList.remove("open"));
    document.getElementById("edge-calculate")?.addEventListener("click", () => { calculateOptimization(); document.getElementById("edgePanel").classList.remove("open"); });
    document.getElementById("edge-print")?.addEventListener("click", () => { printReport(); document.getElementById("edgePanel").classList.remove("open"); });
    document.getElementById("edge-config")?.addEventListener("click", () => { openModal(); document.getElementById("edgePanel").classList.remove("open"); });
    document.getElementById("edge-new")?.addEventListener("click", () => { startNewProject(); document.getElementById("edgePanel").classList.remove("open"); });
    
    // Modal duplicado
    document.getElementById("btn-duplicado-confirmar")?.addEventListener("click", () => {
        if (cortePendiente) {
            agregarCorteDirectamente(cortePendiente.length, cantidadPendiente, cortePendiente.gradoInicial, cortePendiente.gradoFinal, false);
        }
        document.getElementById("modal-duplicado").style.display = "none";
        cortePendiente = null;
    });
    document.getElementById("btn-duplicado-cancelar")?.addEventListener("click", () => {
        document.getElementById("modal-duplicado").style.display = "none";
        cortePendiente = null;
        document.getElementById("input-corte-length").value = "";
        document.getElementById("input-corte-cantidad").value = "1";
    });
    
    document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", function() {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
        this.classList.add("active");
        document.getElementById(this.dataset.tab).classList.add("active");
    }));
}

// ========== INICIALIZACIÓN ==========
function init() {
    bindEvents();
    updateUsableLength();
    actualizarLimitesInput();
    updateCutsList();
    updateBladeStats();
    updateUIFromState();
    renderBarsVisualization();
    renderResultsTable();
    renderReport();
}

init();
