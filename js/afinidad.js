/**
 * Afinidad Module - Cuestionario de Afinidad Electoral
 * Implementa el algoritmo de distancia euclidiana según metodología
 */

import { PARTIES } from './api.js';

const LIKERT_OPTIONS = [
    { value: -2, label: 'Muy en desacuerdo', color: 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200' },
    { value: -1, label: 'En desacuerdo', color: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' },
    { value: 0, label: 'Neutral', color: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' },
    { value: 1, label: 'De acuerdo', color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
    { value: 2, label: 'Muy de acuerdo', color: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200' }
];

const CONTEXT_TEXTS = {
    'SAN_1': { tema: 'Sanidad - Atención Primaria', contexto: 'La Junta de Castilla y León destina actualmente alrededor del 14% del presupuesto sanitario a Atención Primaria. Esta pregunta propone elevarlo al 25% por ley.' },
    'SAN_2': { tema: 'Sanidad - Gestión Pública', contexto: 'Actualmente muchos servicios como ambulancias o limpieza hospitalaria están externalizados a empresas privadas. Esta pregunta propone que vuelvan a gestión 100% pública.' },
    'EDU_1': { tema: 'Educación - EBAU Única', contexto: 'Cada comunidad autónoma tiene su propia Selectividad. Esta pregunta propone una prueba única para toda España.' },
    'EDU_2': { tema: 'Educación - Escuelas Rurales', contexto: 'Muchas escuelas rurales закрываются cuando bajan los alumnos. Esta pregunta propone mantenerlas abiertas con al menos 3 alumnos.' },
    'SOC_1': { tema: 'Servicios Sociales - Residencias', contexto: 'Algunas residencias de mayores son gestionadas por empresas privadas con ánimo de lucro usando dinero público. Esta pregunta propone prohibirlo.' },
    'SOC_2': { tema: 'Servicios Sociales - Pensiones', contexto: 'Castilla y León tiene muchas pensiones bajas. Esta pregunta propone un complemento económico de la Junta para quienes cobren menos de 730€.' },
    'RET_1': { tema: 'Reto Demográfico - Garantía Rural', contexto: 'Muchas leyes perjudican a los pueblos sin pretenderlo. Esta pregunta propone evaluar siempre su impacto económico en el medio rural.' },
    'RET_2': { tema: 'Reto Demográfico - Sedes', contexto: 'La Junta tiene su sede principal en Valladolid. Esta pregunta propone distribuir sedes oficiales por todas las provincias.' },
    'VIV_1': { tema: 'Vivienda - Alquileres', contexto: 'El precio del alquiler ha subido mucho en ciudades como Valladolid. Esta pregunta propone limitar por ley los precios en zonas tensionadas.' },
    'VIV_2': { tema: 'Vivienda - Ayudas', contexto: 'Hay dos modelos: avalar hipotecas de jóvenes o construir vivienda pública de alquiler social. Esta pregunta se decanta por lo primero.' },
    'FIS_1': { tema: 'Fiscalidad - Sucesiones', contexto: 'El impuesto de sucesiones en Castilla y León ya es bajo. Esta pregunta propone eliminarlo casi totalmente para hermanos, tíos y sobrinos.' },
    'FIS_2': { tema: 'Fiscalidad - Rural', contexto: 'Los pueblos pierden habitantes. Esta pregunta propone una rebaja extra del 25% en IRPF para quienes vivan y trabajen en zonas rurales.' },
    'AGR_1': { tema: 'Sector Primario - Precios', contexto: 'Los agricultores cobran a veces por debajo de costes. Esta pregunta propone que la Junta intervenga para garantizar precios mínimos.' },
    'AGR_2': { tema: 'Sector Primario - PAC', contexto: 'Las ayudas europeas (PAC) van a veces a grandes propietarios que no viven del campo. Esta pregunta propone limitarlas a agricultores profesionales.' },
    'AMB_1': { tema: 'Medio Ambiente - Macrogranjas', contexto: 'Las macrogranjas de ganado generan contaminación. Esta pregunta propone paralizar todos los proyectos de ganadería industrial y biogás.' },
    'AMB_2': { tema: 'Medio Ambiente - Incendios', contexto: 'El operativo contra incendios trabaja sobre todo en verano. Esta pregunta propone que sea 100% público y trabaje los 12 meses.' },
    'MOV_1': { tema: 'Movilidad - Servicios Básicos', contexto: 'Muchos pueblos pierden servicios. Esta pregunta propone que cualquier servicio básico (médico, oficina) esté a menos de 30 minutos.' },
    'MOV_2': { tema: 'Movilidad - Internet', contexto: 'Muchos pueblos no tienen buena conexión. Esta pregunta propone garantizar 100 Mbps de internet para todos los municipios.' },
    'TRA_1': { tema: 'Democracia - Puertas Giratorias', contexto: 'Un alto cargo de la Junta podría luego trabajar para la empresa que regulaba. Esta pregunta propone prohibirlo durante 10 años.' },
    'TRA_2': { tema: 'Democracia - Aforamientos', contexto: 'Los políticos tienen privilegios judiciales. Esta pregunta propone eliminar los aforamientos para que sean juzgados por tribunales normales.' },
    'CUL_1': { tema: 'Otros - Tauromaquia', contexto: 'Las corridas de toros reciben subvenciones públicas. Esta pregunta propone eliminar todas las ayudas a la tauromaquia.' },
    'CUL_2': { tema: 'Otros - Memoria Democrática', contexto: 'El franquismo fue una dictadura. Esta pregunta propone que sea obligatorio estudiar la memoria democrática en los institutos.' }
};

let afinidadState = {
    questions: [],
    partyScores: {},
    currentIndex: 0,
    answers: {},
    importantQuestions: new Set()
};

function getStorageKey() {
    return 'afinidad_answers_' + new Date().toISOString().split('T')[0];
}

export async function initAfinidad() {
    try {
        const [questionsRes, scoresRes] = await Promise.all([
            fetch('./data/master-questions.json'),
            fetch('./data/party-scores.json')
        ]);
        
        afinidadState.questions = await questionsRes.json();
        afinidadState.partyScores = await scoresRes.json();
        
        loadFromSession();
        return true;
    } catch (error) {
        console.error('Error loading afinidad data:', error);
        return false;
    }
}

function loadFromSession() {
    const saved = sessionStorage.getItem(getStorageKey());
    if (saved) {
        try {
            const data = JSON.parse(saved);
            afinidadState.answers = data.answers || {};
            afinidadState.importantQuestions = new Set(data.importantQuestions || []);
            afinidadState.currentIndex = data.currentIndex || 0;
        } catch (e) {
            console.error('Error parsing saved data:', e);
        }
    }
}

function saveToSession() {
    const data = {
        answers: afinidadState.answers,
        importantQuestions: Array.from(afinidadState.importantQuestions),
        currentIndex: afinidadState.currentIndex
    };
    sessionStorage.setItem(getStorageKey(), JSON.stringify(data));
}

export function renderQuestion() {
    const q = afinidadState.questions[afinidadState.currentIndex];
    if (!q) return;

    const progress = ((afinidadState.currentIndex) / afinidadState.questions.length) * 100;
    document.getElementById('afinidad-progress-text').textContent = `Pregunta ${afinidadState.currentIndex + 1} de ${afinidadState.questions.length}`;
    document.getElementById('afinidad-progress-percent').textContent = `${Math.round(progress)}%`;
    document.getElementById('afinidad-progress-bar').style.width = `${progress}%`;

    document.getElementById('afinidad-category-badge').textContent = q.categoria;
    document.getElementById('afinidad-question-text').textContent = q.pregunta;

    const contextData = CONTEXT_TEXTS[q.id];
    if (contextData) {
        document.getElementById('afinidad-context-content').innerHTML = `<strong>${contextData.tema}</strong><br>${contextData.contexto}`;
    } else {
        document.getElementById('afinidad-context-content').textContent = q.pregunta;
    }

    const optionsContainer = document.getElementById('afinidad-options');
    optionsContainer.innerHTML = LIKERT_OPTIONS.map(opt => {
        const isSelected = afinidadState.answers[q.id] === opt.value;
        return `
            <button class="afinidad-option w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${opt.color} ${isSelected ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}"
                    data-value="${opt.value}" data-question="${q.id}">
                <div class="flex items-center justify-between">
                    <span class="font-medium">${opt.label}</span>
                    ${isSelected ? '<i class="fa-solid fa-check-circle text-indigo-600"></i>' : ''}
                </div>
            </button>
        `;
    }).join('');

    const importantBtn = document.getElementById('afinidad-important-btn');
    const isImportant = afinidadState.importantQuestions.has(q.id);
    importantBtn.innerHTML = isImportant 
        ? '<i class="fa-solid fa-star text-amber-500"></i> <span>Este tema me importa mucho</span>'
        : '<i class="fa-regular fa-star"></i> <span>Este tema me importa mucho</span>';
    importantBtn.classList.toggle('text-amber-600', isImportant);

    document.getElementById('afinidad-prev').disabled = afinidadState.currentIndex === 0;
    document.getElementById('afinidad-next').disabled = afinidadState.answers[q.id] === undefined;
    
    document.getElementById('afinidad-context-panel').classList.add('hidden');
}

export function handleAnswer(questionId, value) {
    afinidadState.answers[questionId] = value;
    saveToSession();
    renderQuestion();
}

export function toggleImportant() {
    const q = afinidadState.questions[afinidadState.currentIndex];
    if (!q) return;
    
    if (afinidadState.importantQuestions.has(q.id)) {
        afinidadState.importantQuestions.delete(q.id);
    } else {
        afinidadState.importantQuestions.add(q.id);
    }
    saveToSession();
    renderQuestion();
}

export function nextQuestion() {
    if (afinidadState.currentIndex < afinidadState.questions.length - 1) {
        afinidadState.currentIndex++;
        saveToSession();
        renderQuestion();
    } else {
        calculateAndShowResults();
    }
}

export function prevQuestion() {
    if (afinidadState.currentIndex > 0) {
        afinidadState.currentIndex--;
        saveToSession();
        renderQuestion();
    }
}

export function toggleContext() {
    const panel = document.getElementById('afinidad-context-panel');
    panel.classList.toggle('hidden');
}

function normalizePartyId(id) {
    const mapping = {
        'PP': 'pp',
        'PSOE': 'psoe',
        'EN_COMUN': 'en-comun',
        'MEV': 'mev'
    };
    return mapping[id] || id.toLowerCase();
}

export function calculateAndShowResults() {
    const answers = afinidadState.answers;
    const partyScoresRaw = afinidadState.partyScores;
    const importantQuestions = afinidadState.importantQuestions;
    const maxDistance = calculateMaxDistance();
    
    const partyScores = {};
    for (const [key, value] of Object.entries(partyScoresRaw)) {
        partyScores[normalizePartyId(key)] = value;
    }
    
    const results = {};
    
    for (const [partyId, scores] of Object.entries(partyScores)) {
        let totalDistance = 0;
        const categoryDistances = {};
        
        for (const [questionId, userValue] of Object.entries(answers)) {
            const partyValue = scores[questionId];
            if (partyValue === undefined) continue;
            
            const weight = importantQuestions.has(questionId) ? 2 : 1;
            const distance = Math.abs(userValue - partyValue) * weight;
            totalDistance += distance;
            
            const question = afinidadState.questions.find(q => q.id === questionId);
            if (question) {
                const cat = question.categoria;
                if (!categoryDistances[cat]) categoryDistances[cat] = { distance: 0, count: 0 };
                categoryDistances[cat].distance += distance;
                categoryDistances[cat].count += weight;
            }
        }
        
        const affinity = maxDistance > 0 ? Math.round((1 - totalDistance / maxDistance) * 100) : 0;
        
        const categoryAffinities = {};
        for (const [cat, data] of Object.entries(categoryDistances)) {
            const catMaxDistance = data.count * 4;
            categoryAffinities[cat] = catMaxDistance > 0 ? Math.round((1 - data.distance / catMaxDistance) * 100) : 0;
        }
        
        results[partyId] = {
            affinity,
            categoryAffinities,
            totalDistance
        };
    }
    
    renderResults(results);
}

function calculateMaxDistance() {
    const importantCount = afinidadState.importantQuestions.size;
    const normalCount = Object.keys(afinidadState.answers).length - importantCount;
    return (importantCount * 2 * 4) + (normalCount * 4);
}

function renderResults(results) {
    document.getElementById('afinidad-question-card').classList.add('hidden');
    document.getElementById('afinidad-progress').classList.add('hidden');
    document.getElementById('afinidad-results').classList.remove('hidden');
    
    const sorted = Object.entries(results).sort((a, b) => b[1].affinity - a[1].affinity);
    
    if (sorted.length === 0) {
        document.getElementById('afinidad-winner').innerHTML = '<p class="text-center text-slate-500">No hay resultados disponibles</p>';
        return;
    }
    
    const winnerId = sorted[0][0];
    const winner = PARTIES.find(p => p.id === winnerId);
    
    if (!winner) {
        console.error('Winner not found:', winnerId, 'Available:', PARTIES.map(p => p.id));
        document.getElementById('afinidad-winner').innerHTML = '<p class="text-center text-slate-500">Error al mostrar resultados</p>';
        return;
    }
    
    const winnerData = sorted[0][1];
    
    const winnerCard = document.getElementById('afinidad-winner');
    winnerCard.innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
            <p class="text-slate-500 text-sm font-medium mb-2">Tu partido más afín</p>
            <div class="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style="background-color: ${winner.color}20">
                <img src="${winner.logo}" alt="${winner.name}" class="w-14 h-14 object-contain">
            </div>
            <h2 class="text-3xl font-bold mb-2" style="color: ${winner.color}">${winner.name}</h2>
            <p class="text-5xl font-black text-slate-800">${winnerData.affinity}%</p>
            <p class="text-slate-400 mt-2">de afinidad</p>
        </div>
    `;
    
    const chart = document.getElementById('afinidad-chart');
    chart.innerHTML = sorted.map(([partyId, data]) => {
        const party = PARTIES.find(p => p.id === partyId);
        return `
            <div class="flex items-center gap-4 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors" onclick="togglePartyMatches('${partyId}')">
                <div class="w-20 text-right">
                    <span class="font-semibold text-slate-700">${party.name}</span>
                </div>
                <div class="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700 ease-out" 
                         style="width: ${data.affinity}%; background-color: ${party.color}"></div>
                </div>
                <div class="w-12 text-left">
                    <span class="font-bold text-slate-700">${data.affinity}%</span>
                </div>
                <button class="text-slate-400 hover:text-slate-600" onclick="event.stopPropagation(); togglePartyMatches('${partyId}')">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </div>
            <div id="matches-${partyId}" class="hidden ml-24 mb-4 text-sm text-slate-600"></div>
        `;
    }).join('');
    
    // Add click handlers for showing matches
    sorted.forEach(([partyId, data]) => {
        const party = PARTIES.find(p => p.id === partyId);
        const partyScores = {};
        for (const [key, value] of Object.entries(afinidadState.partyScores)) {
            partyScores[normalizePartyId(key)] = value;
        }
        const scores = partyScores[partyId];
        const matches = [];
        
        for (const [questionId, userValue] of Object.entries(afinidadState.answers)) {
            const partyValue = scores?.[questionId];
            if (partyValue !== undefined && userValue === partyValue) {
                const q = afinidadState.questions.find(q => q.id === questionId);
                if (q) {
                    const positionText = partyValue === 2 ? 'Muy de acuerdo' : 
                                         partyValue === 1 ? 'De acuerdo' : 
                                         partyValue === 0 ? 'Neutral' : 
                                         partyValue === -1 ? 'En desacuerdo' : 'Muy en desacuerdo';
                    matches.push({ question: q, partyValue, positionText });
                }
            }
        }
        
        window[`togglePartyMatches_${partyId}`] = () => {
            const el = document.getElementById(`matches-${partyId}`);
            if (el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                if (matches.length > 0) {
                    el.innerHTML = `<strong>Coincidencias con ${party.name} (${matches.length}):</strong>
                        <ul class="mt-2 space-y-2">${matches.map(m => `
                            <li class="bg-slate-50 p-2 rounded">
                                <p class="text-xs text-slate-500 mb-1">${m.question.categoria}</p>
                                <p class="font-medium">${m.question.pregunta}</p>
                                <p class="text-sm text-green-600 mt-1"><i class="fa-solid fa-check-circle mr-1"></i>${party.name} está "${m.positionText}"</p>
                            </li>
                        `).join('')}</ul>`;
                } else {
                    el.innerHTML = 'No hay coincidencias exactas';
                }
            } else {
                el.classList.add('hidden');
            }
        };
    });
    
    window.togglePartyMatches = (partyId) => window[`togglePartyMatches_${partyId}`]();
    
    renderCategoryBreakdown(sorted[0][1]);
    setupShareLinks(results);
}

function renderCategoryBreakdown(winnerData) {
    const container = document.getElementById('afinidad-categories');
    const categories = Object.entries(winnerData.categoryAffinities)
        .sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = `
        <h3 class="text-lg font-semibold text-slate-800 mb-4">Desglose por categorías</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            ${categories.map(([cat, affinity]) => `
                <div class="bg-white rounded-xl border border-slate-200 p-4">
                    <p class="text-xs text-slate-500 mb-1">${cat}</p>
                    <p class="text-2xl font-bold ${affinity >= 70 ? 'text-green-600' : affinity >= 40 ? 'text-amber-600' : 'text-red-500'}">${affinity}%</p>
                </div>
            `).join('')}
        </div>
    `;
}

function setupShareLinks(results) {
    const sorted = Object.entries(results).sort((a, b) => b[1].affinity - a[1].affinity);
    const winner = PARTIES.find(p => p.id === sorted[0][0]);
    const shareUrlForImage = `${window.location.host}${window.location.pathname}#afinidad`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#afinidad`;
    const shareText = `Mi resultado en el Cuestionario de Afinidad CyL 2026: ${sorted[0][1].affinity}% afín a ${winner.name}\n\nDescubre la tuya:\n${shareUrl}`;
    
    // Share button - copy text result
    document.getElementById('afinidad-share-copy').onclick = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Mi resultado - Cuestionario de Afinidad CyL 2026',
                    text: shareText
                });
            } catch (e) {
                await navigator.clipboard.writeText(shareText);
                showCopiedMessage();
            }
        } else {
            await navigator.clipboard.writeText(shareText);
            showCopiedMessage();
        }
    };
    
    // Share image button
    document.getElementById('afinidad-share-image').onclick = async () => {
        const btn = document.getElementById('afinidad-share-image');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Generando...';
        
        try {
            // Create a container for the image
            const container = document.createElement('div');
            container.style.cssText = 'background: #f8fafc; padding: 32px; width: 600px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000000;';
            
            container.innerHTML = `
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="color: #1e293b; font-size: 28px; margin: 0 0 12px 0; line-height: 1.3; font-weight: 600; letter-spacing: -0.01em;">Cuestionario de Afinidad CyL 2026</h1>
                    <p style="color: #64748b; margin: 0; line-height: 1.5; font-size: 18px; font-weight: 400; letter-spacing: 0.01em;">Mi resultado</p>
                </div>
                <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px 24px; text-align: center; margin-bottom: 32px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);">
                    <p style="color: #64748b; font-size: 16px; margin: 0 0 16px 0; line-height: 1.4; font-weight: 500; letter-spacing: 0.01em;">Tu partido más afín</p>
                    <div style="width: 88px; height: 88px; margin: 0 auto 20px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #e2e8f0;">
                        <img src="${window.location.origin}/${winner.logo}" style="width: 52px; height: 52px; object-fit: contain;" onerror="this.style.display='none'">
                    </div>
                    <h2 style="font-size: 36px; margin: 0 0 12px 0; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; color: ${winner.color};">${winner.name}</h2>
                    <p style="font-size: 64px; font-weight: 800; margin: 0; line-height: 1.1; letter-spacing: -0.03em; color: ${winner.color}; text-shadow: 0 2px 4px rgba(0,0,0,0.05);">${sorted[0][1].affinity}%</p>
                    <p style="color: #64748b; font-size: 18px; margin: 12px 0 0 0; line-height: 1.4; font-weight: 400; letter-spacing: 0.01em;">de afinidad</p>
                </div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    ${sorted.map(([partyId, data]) => {
                        const p = PARTIES.find(part => part.id === partyId);
                        return `
                            <div style="display: flex; align-items: center; margin-bottom: 16px; padding: 10px 0;">
                                <div style="width: 100px; text-align: right; font-weight: 600; color: #334155; font-size: 15px; line-height: 1.3; margin-right: 20px; letter-spacing: 0.01em;">${p?.name || partyId}</div>
                                <div style="flex: 1; background: #e2e8f0; border-radius: 12px; height: 32px; overflow: hidden; margin-right: 20px;">
                                    <div style="height: 100%; width: ${data.affinity}%; background: ${p?.color || '#666'}; border-radius: 12px;"></div>
                                </div>
                                <div style="width: 55px; text-align: left; font-weight: 700; color: #334155; line-height: 1.3; font-size: 15px; letter-spacing: 0.01em;">${data.affinity}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="text-align: center; padding: 20px; background: #ffffff; border-radius: 12px; margin-top: 12px; border: 1px solid #e2e8f0;">
                    <p style="color: #334155; font-size: 20px; margin: 0 0 12px 0; line-height: 1.4; font-weight: 600; letter-spacing: 0.01em;">Descubre la tuya</p>
                    <p style="color: #1e293b; font-size: 16px; margin: 0; line-height: 1.4; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; word-break: break-all; padding: 8px 12px; border-radius: 6px;">${shareUrlForImage}</p>
                </div>
            `;
            
            document.body.appendChild(container);
            
            const canvas = await html2canvas(container, {
                backgroundColor: '#ffffff',
                scale: 2
            });
            
            document.body.removeChild(container);
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'resultado-afinidad.png', { type: 'image/png' });
            
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    title: 'Mi resultado - Cuestionario de Afinidad CyL 2026',
                    text: shareText,
                    files: [file]
                });
            } else {
                // Fallback: download image
                const link = document.createElement('a');
                link.download = 'resultado-afinidad.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                showCopiedMessage();
            }
        } catch (e) {
            console.error('Error generating image:', e);
            await navigator.clipboard.writeText(shareText);
            showCopiedMessage();
        }
        
        btn.innerHTML = originalText;
    };
    
    // Hide Twitter button
    document.getElementById('afinidad-share-twitter').classList.add('hidden');
}

function showCopiedMessage() {
    const msg = document.getElementById('afinidad-share-copied');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
}

function encodeAnswers() {
    // Encode answers as before
    const data = {
        r: Object.entries(afinidadState.answers).map(([k, v]) => `${k}:${v}`).join(','),
        i: Array.from(afinidadState.importantQuestions).join(',')
    };
    return btoa(JSON.stringify(data));
}

// Store results directly for sharing
let sharedResults = null;

export function setSharedResults(results) {
    // Encode results directly: partyId:affinity
    const data = Object.entries(results).map(([id, d]) => `${id}:${d.affinity}`).join(',');
    sharedResults = btoa(data);
}

export async function loadFromUrl(encodedData) {
    try {
        // First try to decode as results (new format)
        try {
            const resultsStr = atob(encodedData);
            const parts = resultsStr.split(',');
            const results = {};
            
            for (const part of parts) {
                const [id, affinity] = part.split(':');
                if (id && affinity !== undefined) {
                    results[id] = { affinity: parseInt(affinity), categoryAffinities: {} };
                }
            }
            
            // If we have results, use them directly
            if (Object.keys(results).length > 0) {
                sharedResults = encodedData;
                renderSharedResults(results);
                return true;
            }
        } catch (e) {
            // Not results format, try answers format
        }
        
        // Fall back to answers format
        const data = JSON.parse(atob(encodedData));
        
        const answers = {};
        const answersStr = data.r || data.a;
        if (answersStr) {
            answersStr.split(',').forEach(item => {
                const [k, v] = item.split(':');
                answers[k] = parseInt(v);
            });
        }
        
        afinidadState.answers = answers;
        if (data.i) {
            afinidadState.importantQuestions = new Set(data.i.split(','));
        }
        
        // Fetch data if not already loaded
        if (!afinidadState.questions || !afinidadState.questions.length) {
            const [questionsRes, scoresRes] = await Promise.all([
                fetch('./data/master-questions.json'),
                fetch('./data/party-scores.json')
            ]);
            
            if (!questionsRes.ok || !scoresRes.ok) {
                throw new Error('Failed to fetch data');
            }
            
            afinidadState.questions = await questionsRes.json();
            afinidadState.partyScores = await scoresRes.json();
        }
        
        return true;
    } catch (e) {
        console.error('loadFromUrl: error:', e);
        return false;
    }
}

function renderSharedResults(results) {
    UI.switchView('afinidad');
    document.getElementById('afinidad-question-card').classList.add('hidden');
    document.getElementById('afinidad-progress').classList.add('hidden');
    document.getElementById('afinidad-results').classList.remove('hidden');
    
    const sorted = Object.entries(results).sort((a, b) => b[1].affinity - a[1].affinity);
    
    if (sorted.length === 0) {
        document.getElementById('afinidad-winner').innerHTML = '<p class="text-center text-slate-500">No hay resultados</p>';
        return;
    }
    
    const winnerId = sorted[0][0];
    const winner = PARTIES.find(p => p.id === winnerId);
    const winnerData = sorted[0][1];
    
    if (!winner) {
        document.getElementById('afinidad-winner').innerHTML = '<p class="text-center text-slate-500">Error al mostrar resultados</p>';
        return;
    }
    
    // Winner card
    document.getElementById('afinidad-winner').innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
            <p class="text-slate-500 text-sm font-medium mb-2">Tu partido más afín</p>
            <div class="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style="background-color: ${winner.color}20">
                <img src="${winner.logo}" alt="${winner.name}" class="w-14 h-14 object-contain">
            </div>
            <h2 class="text-3xl font-bold mb-2" style="color: ${winner.color}">${winner.name}</h2>
            <p class="text-5xl font-black text-slate-800">${winnerData.affinity}%</p>
            <p class="text-slate-400 mt-2">de afinidad</p>
        </div>
    `;
    
    // Chart
    document.getElementById('afinidad-chart').innerHTML = sorted.map(([partyId, data]) => {
        const party = PARTIES.find(p => p.id === partyId);
        return `
            <div class="flex items-center gap-4 p-3 rounded-lg">
                <div class="w-20 text-right">
                    <span class="font-semibold text-slate-700">${party?.name || partyId}</span>
                </div>
                <div class="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div class="h-full rounded-full" style="width: ${data.affinity}%; background-color: ${party?.color || '#666'}"></div>
                </div>
                <div class="w-12 text-left">
                    <span class="font-bold text-slate-700">${data.affinity}%</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Hide category breakdown and share (no data for it)
    document.getElementById('afinidad-categories').innerHTML = '';
    
    // Share button
    const shareUrl = `${window.location.origin}${window.location.pathname}#afinidad/${sharedResults}`;
    const shareText = `Mi resultado en el Cuestionario de Afinidad CyL 2026: ${winnerData.affinity}% afín a ${winner.name}`;
    
    document.getElementById('afinidad-share-copy').onclick = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Mi resultado', text: shareText });
            } catch (e) {
                await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
            }
        } else {
            await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        }
    };
    document.getElementById('afinidad-share-twitter').classList.add('hidden');
}

export function getCurrentIndex() {
    return afinidadState.currentIndex;
}

export function getTotalQuestions() {
    return afinidadState.questions.length;
}
