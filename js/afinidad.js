/**
 * Afinidad Module - Cuestionario de Afinidad Electoral
 * Implementa el algoritmo de distancia de Manhattan según metodología
 */

import { PARTIES } from './api.js';
import { UI } from './ui.js';

// Importar el controlador de historias para contar historias pendientes
let storiesController = null;
let appState = null;

// Función para obtener el controlador de historias (inyectado desde main.js)
export function setStoriesController(controller) {
    storiesController = controller;
}

// Función para establecer el estado de la aplicación (inyectado desde main.js)
export function setAppState(state) {
    appState = state;
}

function withAppVersion(path) {
    const version = window.__APP_VERSION__;
    if (!version) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}v=${encodeURIComponent(version)}`;
}

const LIKERT_OPTIONS = [
    { value: -2, label: 'Muy en desacuerdo', color: 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200' },
    { value: -1, label: 'En desacuerdo', color: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' },
    { value: 0, label: 'Neutral', color: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' },
    { value: 1, label: 'De acuerdo', color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
    { value: 2, label: 'Muy de acuerdo', color: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200' }
];

function getQuestionContextData(question) {
    if (!question) return { tema: '', contexto: '' };
    return {
        tema: question.tema || question.categoria || '',
        contexto: question.contexto || question.pregunta || ''
    };
}

function getQuestionBadgeLabel(question) {
    const tema = question?.tema;
    if (!tema) return question?.categoria || 'Tema';
    const parts = tema.split(' - ');
    return (parts[1] || parts[0]).trim();
}

let afinidadState = {
    questions: [],
    partyScores: {},
    currentIndex: 0,
    answers: {},
    importantQuestions: new Set(),
    restored: false
};

const AFINIDAD_STORAGE_KEY = 'afinidad_answers_latest';

function getStorageKey() {
    return AFINIDAD_STORAGE_KEY;
}

export async function initAfinidad() {
    // Load data
    return Promise.all([
        fetch(withAppVersion('./data/master-questions.json')).then(r => r.json()),
        fetch(withAppVersion('./data/party-scores.json')).then(r => r.json())
    ]).then(([questions, partyScores]) => {
        afinidadState.questions = questions;
        afinidadState.partyScores = partyScores;
        return true;
    }).catch(error => {
        console.error('Error loading afinidad data:', error);
        return false;
    });
}

function initDiscourseEmbed() {
    const container = document.getElementById('discourse-comments');
    if (!container) return;
    if (window.__DISCOURSE_EMBED_LOADED__) return;

    window.DiscourseEmbed = {
        discourseUrl: 'https://foro.aldeapucela.org/',
        topicId: 951
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = window.DiscourseEmbed.discourseUrl + 'javascripts/embed.js';

    const head = document.getElementsByTagName('head')[0];
    if (head) head.appendChild(script);
    window.__DISCOURSE_EMBED_LOADED__ = true;
}

// Reset afinidad state to start fresh
function resetAfinidadState() {
    afinidadState.currentIndex = 0;
    afinidadState.answers = {};
    afinidadState.importantQuestions = new Set();
    afinidadState.restored = false;
    
    // Clear persisted storage
    localStorage.removeItem(getStorageKey());
}

function bindCommentsLink() {
    const link = document.getElementById('afinidad-comments-link');
    const target = document.getElementById('afinidad-comments');
    if (!link || !target) return;
    if (link.__boundCommentsScroll) return;

    link.addEventListener('click', (event) => {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    link.__boundCommentsScroll = true;
}

function loadFromSession(autoComplete = true) {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
        try {
            const data = JSON.parse(saved);
            afinidadState.answers = data.answers || {};
            afinidadState.importantQuestions = new Set(data.importantQuestions || []);
            afinidadState.currentIndex = data.currentIndex || 0;
            
            // If completed, show results directly
            if (data.completed && data.results) {
                renderResults(data.results);
                return true; // Indicate results were loaded
            }

            // If all questions are answered, recompute results and show them
            if (autoComplete && afinidadState.questions?.length && Object.keys(afinidadState.answers).length >= afinidadState.questions.length) {
                const results = calculateAffinity();
                renderResults(results);
                return true;
            }
        } catch (e) {
            console.error('Error parsing saved data:', e);
        }
    }
    return false; // No results loaded
}

function saveToSession() {
    // If we already have a completed result saved, do not overwrite it.
    // This prevents losing results on reload and falling back to the last question.
    const existing = localStorage.getItem(getStorageKey());
    if (existing) {
        try {
            const parsed = JSON.parse(existing);
            if (parsed?.completed && parsed?.results) {
                return;
            }
        } catch (e) {
            // If parsing fails, we proceed to overwrite with fresh state.
        }
    }

    const data = {
        answers: afinidadState.answers,
        importantQuestions: Array.from(afinidadState.importantQuestions),
        currentIndex: afinidadState.currentIndex
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

export function startAfinidad() {
    afinidadState.restored = false;

    const resultsLoaded = loadFromSession(true);
    if (resultsLoaded) {
        return;
    }

    const introEl = document.getElementById('afinidad-intro');
    const questionCardEl = document.getElementById('afinidad-question-card');
    const progressEl = document.getElementById('afinidad-progress');
    const resultsEl = document.getElementById('afinidad-results');

    if (introEl) introEl.classList.add('hidden');
    if (questionCardEl) questionCardEl.classList.remove('hidden');
    if (progressEl) progressEl.classList.remove('hidden');
    if (resultsEl) resultsEl.classList.add('hidden');

    renderQuestion();
}

export function showAfinidadIntro() {
    afinidadState.restored = false;

    const introEl = document.getElementById('afinidad-intro');
    const questionCardEl = document.getElementById('afinidad-question-card');
    const progressEl = document.getElementById('afinidad-progress');
    const resultsEl = document.getElementById('afinidad-results');

    if (introEl) introEl.classList.remove('hidden');
    if (questionCardEl) questionCardEl.classList.add('hidden');
    if (progressEl) progressEl.classList.add('hidden');
    if (resultsEl) resultsEl.classList.add('hidden');
}

export function restoreSavedAfinidadResults() {
    return loadFromSession(true);
}

export function restartAfinidadFromIntro() {
    resetAfinidadState();
    showAfinidadIntro();
    window.scrollTo(0, 0);
}

export function renderQuestion() {
    // Restore persisted state only once per view entry.
    // This prevents auto-complete to results from triggering right after answering the last question.
    if (!afinidadState.restored) {
        const resultsLoaded = loadFromSession(true);
        afinidadState.restored = true;
        if (resultsLoaded) {
            return; // Results were loaded and displayed
        }
    }
    
    const q = afinidadState.questions[afinidadState.currentIndex];
    if (!q) return;

    const progress = ((afinidadState.currentIndex) / afinidadState.questions.length) * 100;
    document.getElementById('afinidad-progress-text').textContent = `Pregunta ${afinidadState.currentIndex + 1} de ${afinidadState.questions.length}`;
    document.getElementById('afinidad-progress-percent').textContent = `${Math.round(progress)}%`;
    document.getElementById('afinidad-progress-bar').style.width = `${progress}%`;

    document.getElementById('afinidad-category-badge').textContent = q.categoria;
    document.getElementById('afinidad-question-text').textContent = q.pregunta;

    const contextData = getQuestionContextData(q);
    document.getElementById('afinidad-context-content').innerHTML = `<strong>${contextData.tema}</strong><br>${contextData.contexto}`;

    const optionsContainer = document.getElementById('afinidad-options');
    optionsContainer.innerHTML = LIKERT_OPTIONS.map(opt => {
        const isSelected = afinidadState.answers[q.id] === opt.value;
        return `
            <button class="afinidad-option w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${opt.color} ${isSelected ? 'afinidad-option-selected' : ''}"
                    data-value="${opt.value}" data-question="${q.id}">
                <div class="flex items-center justify-between">
                    <span class="font-medium">${opt.label}</span>
                    ${isSelected ? '<i class="fa-solid fa-check-circle text-slate-700"></i>' : ''}
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
    // Convert to lowercase and replace spaces/special chars with hyphens
    return id.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

const LOGO_SCALE_BY_PARTY = {
    'en-comun': 0.62,
    'podemos': 0.66
};

function getWinnerLogoScale(partyId) {
    if (!partyId) return 0.74;
    return LOGO_SCALE_BY_PARTY[partyId] || 0.74;
}

export function calculateAndShowResults() {
    const results = calculateAffinity();
    renderResults(results);
    
    // Track anonymous affinity result
    trackAffinityResult(results);
}

function calculateAffinity() {
    const answers = afinidadState.answers;
    const partyScoresRaw = afinidadState.partyScores;
    const importantQuestions = afinidadState.importantQuestions;
    
    const results = {};
    
    // Iteramos por cada partido en los scores
    for (const [rawPartyName, scores] of Object.entries(partyScoresRaw)) {
        const partyId = normalizePartyId(rawPartyName);
        let totalDistance = 0;
        const categoryDistances = {};
        const categoryCoverage = {};

        let partyMaxPossibleDistance = 0;
        let coveredCount = 0;
        const totalAnsweredCount = Object.keys(answers).length;
        const totalAnsweredByCategory = {};
        
        for (const [questionId, userValue] of Object.entries(answers)) {
            const partyValue = scores[questionId];
            const weight = importantQuestions.has(questionId) ? 2 : 1;
            const question = afinidadState.questions.find(q => q.id === questionId);

            if (question) {
                const cat = question.categoria;

                if (!totalAnsweredByCategory[cat]) totalAnsweredByCategory[cat] = 0;
                totalAnsweredByCategory[cat] += 1;

                if (!categoryCoverage[cat]) categoryCoverage[cat] = { covered: 0, total: 0 };
                categoryCoverage[cat].total += 1;
            }

            if (partyValue === undefined || partyValue === null) {
                continue;
            }

            const distance = Math.abs(userValue - partyValue) * weight;
            totalDistance += distance;
            partyMaxPossibleDistance += weight * 4;
            coveredCount += 1;

            // Guardar por categorías para el desglose posterior
            if (question) {
                const cat = question.categoria;
                if (!categoryDistances[cat]) categoryDistances[cat] = { dist: 0, max: 0 };
                categoryDistances[cat].dist += distance;
                categoryDistances[cat].max += weight * 4;

                if (!categoryCoverage[cat]) categoryCoverage[cat] = { covered: 0, total: 0 };
                categoryCoverage[cat].covered += 1;
            }
        }
        
        const affinity = partyMaxPossibleDistance > 0 ? Math.round((1 - totalDistance / partyMaxPossibleDistance) * 100) : 0;
        const coverage = totalAnsweredCount > 0 ? Math.round((coveredCount / totalAnsweredCount) * 100) : 0;
        
        const categoryAffinities = {};
        for (const [cat, data] of Object.entries(categoryDistances)) {
            categoryAffinities[cat] = data.max > 0 ? Math.round((1 - data.dist / data.max) * 100) : 0;
        }

        const categoryCoveragePct = {};
        for (const [cat, data] of Object.entries(categoryCoverage)) {
            categoryCoveragePct[cat] = data.total > 0 ? Math.round((data.covered / data.total) * 100) : 0;
        }
        
        results[partyId] = {
            affinity: Math.max(0, affinity),
            categoryAffinities,
            totalDistance,
            coverage,
            categoryCoverage: categoryCoveragePct,
            coveredCount,
            totalAnsweredCount
        };
    }
    return results;
}
export function renderResults(results) {
    const introEl = document.getElementById('afinidad-intro');
    if (introEl) introEl.classList.add('hidden');

    document.getElementById('afinidad-question-card').classList.add('hidden');
    document.getElementById('afinidad-progress').classList.add('hidden');
    document.getElementById('afinidad-results').classList.remove('hidden');
    
    // Guardar estado de completado
    const completionData = {
        answers: afinidadState.answers,
        importantQuestions: Array.from(afinidadState.importantQuestions),
        currentIndex: afinidadState.currentIndex,
        completed: true,
        results: results
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(completionData));
    
    const sorted = Object.entries(results).sort((a, b) => b[1].affinity - a[1].affinity);
    if (sorted.length === 0) return;
    
    const winnerId = sorted[0][0];
    const winner = PARTIES.find(p => p.id === winnerId);
    const winnerLogoScale = getWinnerLogoScale(winner?.id);
    
    // Verificar si hay historias pendientes para el partido ganador
    const unseenCount = storiesController ? 
        storiesController.countUnseenStoriesForParty(winnerId, Object.values(appState?.allData?.[winnerId]?.propuestas || [])) : 0;
    const hasPendingStories = unseenCount > 0;
    
    // 1. Renderizar Ganador
    document.getElementById('afinidad-winner').innerHTML = `
        <div class="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
            <p class="text-slate-500 text-sm font-medium mb-2">Tu partido más afín</p>
            <div class="group">
                <button class="block w-full cursor-pointer mb-4" onclick="handleWinnerLogoClick('${winnerId}')" aria-label="Ver ${hasPendingStories ? 'historias de' : 'programa de'} ${winner?.name || winnerId}">
                    <div class="w-20 h-20 mx-auto rounded-full flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-105 ${hasPendingStories ? 'party-story-ring' : ''}" style="background-color: ${winner?.color || '#666'}20">
                        <img src="${winner?.logo || ''}" alt="${winner?.name || ''}" class="w-full h-full object-contain" style="transform: scale(${winnerLogoScale}); transform-origin: center;">
                    </div>
                </button>
                <a href="#/${winnerId}" class="block group">
                    <h2 class="text-3xl font-bold mb-2 transition-colors duration-200 group-hover:text-indigo-600" style="color: ${winner?.color || '#334155'}">${winner?.name || winnerId}</h2>
                </a>
            </div>
            <p class="text-5xl font-black text-slate-800">${sorted[0][1].affinity}%</p>
            <p class="text-slate-400 mt-2">de afinidad global</p>
        </div>
    `;
    
    // 2. Definir función de toggle global (para evitar el error ReferenceError)
    window.togglePartyMatches = (id) => {
        const el = document.getElementById(`matches-${id}`);
        if (el) el.classList.toggle('hidden');
    };
    
    // 3. Definir función para manejar el clic en el logo del ganador
    window.handleWinnerLogoClick = (partyId) => {
        const party = PARTIES.find(p => p.id === partyId);
        if (!party) return;
        
        // Reutilizar el cálculo de historias pendientes ya hecho en renderResults
        const proposals = Object.values(appState?.allData?.[partyId]?.propuestas || []);
        const unseenCount = storiesController ? storiesController.countUnseenStoriesForParty(partyId, proposals) : 0;
        
        if (unseenCount > 0 && storiesController) {
            // Usar la misma lógica que en la vista de detalle del partido
            const fallbackPartyHash = `#/${partyId}`;
            const currentHash = window.location.hash || fallbackPartyHash;
            appState.stories.returnHash = currentHash.startsWith(fallbackPartyHash) ? currentHash : fallbackPartyHash;
            storiesController.focusOnParty(partyId);
            UI.navigateHash('#/explora/play');
        } else {
            // Ir al programa del partido
            window.location.hash = `#/${partyId}`;
        }
    };
    window.toggleMatchList = (partyId, listName) => {
        const compactEl = document.getElementById(`${listName}-compact-${partyId}`);
        const fullEl = document.getElementById(`${listName}-full-${partyId}`);
        const btnEl = document.getElementById(`${listName}-btn-${partyId}`);
        if (!compactEl || !fullEl || !btnEl) return;
        const expanded = fullEl.classList.contains('hidden');
        compactEl.classList.toggle('hidden', expanded);
        fullEl.classList.toggle('hidden', !expanded);
        btnEl.textContent = expanded ? 'Ver menos' : 'Ver todas';
    };

    const getPosText = (val) => {
        const texts = { '2': 'Muy de acuerdo', '1': 'De acuerdo', '0': 'Neutral', '-1': 'En desacuerdo', '-2': 'Muy en desacuerdo' };
        return texts[val] || 'Sin postura';
    };

    // 3. Renderizar Lista de Partidos con sus desgloses internos
    document.getElementById('afinidad-chart').innerHTML = `
        <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            ${sorted.map(([partyId, data]) => {
        const party = PARTIES.find(p => p.id === partyId);
        const partyScoresRaw = afinidadState.partyScores;
        const partyKeyInScores = Object.keys(partyScoresRaw).find(k => normalizePartyId(k) === partyId);
        const scores = partyScoresRaw[partyKeyInScores];

        const coverage = typeof data.coverage === 'number' ? data.coverage : 0;
        const coveredCount = typeof data.coveredCount === 'number' ? data.coveredCount : 0;
        const totalAnsweredCount = typeof data.totalAnsweredCount === 'number' ? data.totalAnsweredCount : 0;
        
        const acuerdos = [], desacuerdos = [], silencios = [];
        
        // Analizar cada respuesta para este partido
        Object.entries(afinidadState.answers).forEach(([qId, uVal]) => {
            const pVal = scores?.[qId];
            const q = afinidadState.questions.find(q => q.id === qId);
            if (!q) return;

            if (pVal === undefined || pVal === null) {
                silencios.push(q);
            } else {
                const dist = Math.abs(uVal - pVal);
                if (dist === 0) acuerdos.push({ q, txt: getPosText(pVal), important: afinidadState.importantQuestions.has(qId) });
                else if (dist >= 3) desacuerdos.push({ q, uTxt: getPosText(uVal), pTxt: getPosText(pVal), dist, important: afinidadState.importantQuestions.has(qId) });
            }
        });

        acuerdos.sort((a, b) => Number(b.important) - Number(a.important));
        desacuerdos.sort((a, b) => {
            if (b.dist !== a.dist) return b.dist - a.dist;
            return Number(b.important) - Number(a.important);
        });

        const acuerdosTop = acuerdos.slice(0, 3);
        const hasMoreAcuerdos = acuerdos.length > 3;
        const desacuerdosTop = desacuerdos.slice(0, 3);
        const hasMoreDesacuerdos = desacuerdos.length > 3;

        return `
            <div class="mb-4">
                <div class="flex items-center gap-4 cursor-pointer hover:bg-slate-50 p-3 rounded-xl transition-all border border-transparent hover:border-slate-200" 
                     onclick="togglePartyMatches('${partyId}')">
                    <div class="w-20 text-right"><span class="font-semibold text-slate-700 text-sm">${party?.name || partyId}</span></div>
                    <div class="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                        <div class="h-full transition-all duration-700" style="width: ${data.affinity}%; background-color: ${party?.color || '#666'}"></div>
                    </div>
                    <div class="w-10 text-left font-bold text-slate-700 text-sm">${data.affinity}%</div>
                    <i class="fa-solid fa-chevron-down text-slate-300 text-xs"></i>
                </div>
                
                <!-- Desglose oculto por defecto -->
                <div id="matches-${partyId}" class="hidden ml-0 md:ml-24 mt-2 space-y-4 animate-fade-in">
                    <div class="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-6 text-sm">
                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <p class="font-bold text-slate-700 leading-tight">Cobertura del programa</p>
                            <p class="text-slate-500 mt-1 text-xs">Este partido se moja en <strong>${coverage}%</strong> de los temas del cuestionario que has contestado (${coveredCount}/${totalAnsweredCount}).</p>
                            <a
                                href="#/${partyId}"
                                class="inline-flex items-center gap-2 mt-3 text-xs font-semibold text-indigo-700 hover:text-indigo-800"
                                onclick="event.stopPropagation()"
                            >
                                Ver todas sus propuestas
                                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                            </a>
                        </div>
                        ${acuerdos.length > 0 ? `
                            <div>
                                <h5 class="font-bold text-green-700 text-[10px] uppercase mb-3 flex items-center tracking-wider">
                                    <i class="fa-solid fa-circle-check mr-2"></i> Coincidencias principales
                                </h5>
                                <div id="acuerdos-compact-${partyId}" class="space-y-2">
                                    ${acuerdosTop.map(m => `
                                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <p class="font-bold text-slate-700 leading-tight">${m.q.pregunta}</p>
                                            <p class="text-green-600 mt-1 text-xs">Ambos estáis <strong>${m.txt}</strong></p>
                                        </div>`).join('')}
                                </div>
                                ${hasMoreAcuerdos ? `
                                <div id="acuerdos-full-${partyId}" class="space-y-2 hidden">
                                    ${acuerdos.map(m => `
                                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                            <p class="font-bold text-slate-700 leading-tight">${m.q.pregunta}</p>
                                            <p class="text-green-600 mt-1 text-xs">Ambos estáis <strong>${m.txt}</strong></p>
                                        </div>`).join('')}
                                </div>
                                <button id="acuerdos-btn-${partyId}" class="mt-2 text-xs font-semibold text-green-700 hover:text-green-800" onclick="event.stopPropagation(); toggleMatchList('${partyId}', 'acuerdos')">Ver todas</button>
                                ` : ''}
                            </div>` : ''}

                        ${desacuerdos.length > 0 ? `
                            <div>
                                <h5 class="font-bold text-red-600 text-[10px] uppercase mb-3 flex items-center tracking-wider">
                                    <i class="fa-solid fa-circle-xmark mr-2"></i> Mayores desacuerdos
                                </h5>
                                <div id="desacuerdos-compact-${partyId}" class="space-y-2">
                                    ${desacuerdosTop.map(m => `
                                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                                            <p class="font-bold text-slate-700 leading-tight">${m.q.pregunta}</p>
                                            <p class="text-slate-500 mt-1 text-xs">Tú has dicho: <strong>${m.uTxt}</strong></p>
                                            <p class="text-red-500 mt-1 text-xs">El partido: <strong>${m.pTxt}</strong></p>
                                        </div>`).join('')}
                                </div>
                                ${hasMoreDesacuerdos ? `
                                <div id="desacuerdos-full-${partyId}" class="space-y-2 hidden">
                                    ${desacuerdos.map(m => `
                                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                                            <p class="font-bold text-slate-700 leading-tight">${m.q.pregunta}</p>
                                            <p class="text-slate-500 mt-1 text-xs">Tú has dicho: <strong>${m.uTxt}</strong></p>
                                            <p class="text-red-500 mt-1 text-xs">El partido: <strong>${m.pTxt}</strong></p>
                                        </div>`).join('')}
                                </div>
                                <button id="desacuerdos-btn-${partyId}" class="mt-2 text-xs font-semibold text-red-700 hover:text-red-800" onclick="event.stopPropagation(); toggleMatchList('${partyId}', 'desacuerdos')">Ver todas</button>
                                ` : ''}
                            </div>` : ''}

                        ${silencios.length > 0 ? `
                            <div>
                                <h5 class="font-bold text-amber-600 text-[10px] uppercase mb-2 flex items-center tracking-wider">
                                    <i class="fa-solid fa-comment-slash mr-2"></i> Temas no tratados
                                </h5>
                                <div class="flex flex-wrap gap-2">
                                    ${silencios.map(q => `
                                        <span class="bg-white border border-amber-200 text-amber-700 text-[10px] px-2.5 py-1.5 rounded-full shadow-sm font-semibold">
                                            ${getQuestionBadgeLabel(q)}
                                        </span>`).join('')}
                                </div>
                            </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('')}
            <p class="text-slate-400 text-xs text-center mt-4">Clic en cada partido para detalles</p>
        </div>
    `;
    
    renderCategoryBreakdown(results);
    setupShareLinks(results);
    initDiscourseEmbed();
    bindCommentsLink();
}

function renderCategoryBreakdown(allResults) {
    const container = document.getElementById('afinidad-categories');
    if (!container) return;

    const categories = [...new Set(afinidadState.questions.map(q => q.categoria))];
    
    const categoryWinners = categories.map(cat => {
        const partyAffinities = Object.entries(allResults)
            .map(([pId, data]) => ({ partyId: pId, affinity: data.categoryAffinities[cat] }))
            .filter(item => item.affinity !== undefined);

        if (partyAffinities.length === 0) {
            return { category: cat, affinity: -1, isTie: false, winners: [] };
        }

        const maxAff = Math.max(...partyAffinities.map(item => item.affinity));
        const winners = partyAffinities.filter(item => item.affinity === maxAff);

        return {
            category: cat,
            affinity: maxAff,
            isTie: winners.length > 1,
            winners
        };
    });

    container.innerHTML = `
        <div class="mt-12 pt-8 border-t border-slate-200 text-center">
            <h3 class="text-xl font-bold text-slate-800">Tu partido ideal por temática</h3>
            <p class="text-slate-500 text-xs mt-2 mb-8 italic">¿Quién te representa mejor en cada área?</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-left">
                ${categoryWinners.map(cw => {
                    if (cw.affinity < 20) return '';
                    const firstWinner = cw.winners[0];
                    const party = firstWinner ? PARTIES.find(p => p.id === firstWinner.partyId) : null;
                    const tieNames = cw.winners
                        .map(w => PARTIES.find(p => p.id === w.partyId)?.name)
                        .filter(Boolean)
                        .join(', ');
                    const topBarColor = cw.isTie ? '#94a3b8' : (party?.color || '#94a3b8');
                    if (!cw.isTie && !party) return '';
                    return `
                        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
                            <div class="absolute top-0 left-0 w-full h-1" style="background-color: ${topBarColor}"></div>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3 h-8 flex items-center">${cw.category}</span>
                            <div class="flex items-center gap-3">
                                ${cw.isTie
                                    ? '<div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-[10px] font-bold">=</div>'
                                    : `<img src="${party.logo}" class="w-8 h-8 object-contain opacity-90">`
                                }
                                <div>
                                    <p class="text-[11px] font-bold text-slate-800 leading-tight">${cw.isTie ? 'Varios' : party.name}</p>
                                    ${cw.isTie ? `<p class="text-[10px] text-slate-500 leading-tight mt-0.5">${tieNames}</p>` : ''}
                                </div>
                            </div>
                        </div>`;
                }).join('')}
            </div>
        </div>
    `;
}

function urlToImageDataUrl(url, {
  fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontWeight = 800,
  fontSize = 24,
  color = '#0f172a',
  paddingX = 0,
  paddingY = 0,
  dpr = 2
} = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Font (canvas no soporta bien ligaduras/kerning raros; perfecto)
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(url);
  const textWidth = Math.ceil(metrics.width);

  // Altura: aproximación fiable
  const textHeight = Math.ceil(fontSize * 1.25);

  canvas.width = (textWidth + paddingX * 2) * dpr;
  canvas.height = (textHeight + paddingY * 2) * dpr;

  ctx.scale(dpr, dpr);
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  // Dibuja
  ctx.fillText(url, paddingX, paddingY);

  return canvas.toDataURL('image/png');
}

function setupShareLinks(results) {
  const sorted = Object.entries(results).sort((a, b) => b[1].affinity - a[1].affinity);
  const winner = PARTIES.find(p => p.id === sorted[0][0]);

  const basePath = window.location.pathname.replace(/\/+$/, '');
  const isDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('localhost');

  const shareUrlForImage = `${window.location.hostname}${basePath}`;

  const shareUrl = `${window.location.origin}${basePath}?utm_source=share`;
  const shareText =
    `Mi resultado en el Cuestionario de Afinidad CyL 2026: ${sorted[0][1].affinity}% afín a ${winner.name}\n\n` +
    `Descubre la tuya:\n${shareUrl}`;

  // --- helpers (robustos para html2canvas) ---

  // Separador con "narrow no-break spaces" alrededor del punto:
  // evita que el siguiente carácter se monte encima del "."
  // y NO permite salto de línea.
  function buildUrlHTML(url) {
    const i = url.indexOf('.');
    if (i <= 0) return escapeHtml(url);

    const left = escapeHtml(url.slice(0, i));
    const right = escapeHtml(url.slice(i + 1));

    // &#8239; = narrow no-break space (NNBSP)
    return (
      `<span style="letter-spacing:0; font-variant-ligatures:none; font-feature-settings:'liga' 0,'clig' 0;">${left}</span>` +
      `<span aria-hidden="true" style="display:inline-block; letter-spacing:0; font-weight:800; ` +
        `transform:translateY(-0.02em); ` +
        `font-variant-ligatures:none; font-feature-settings:'liga' 0,'clig' 0;">&#8239;.</span>` +
      `<span aria-hidden="true" style="display:inline-block; width:0; letter-spacing:0;">&#8239;</span>` +
      `<span style="letter-spacing:0; font-variant-ligatures:none; font-feature-settings:'liga' 0,'clig' 0;">${right}</span>`
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function fitTextToParent(el, maxPx = 24, minPx = 16) {
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;

    let size = maxPx;
    el.style.fontSize = size + 'px';

    // Forzar layout
    void el.offsetWidth;

    // Medimos contra el ancho del padre (más fiable que clientWidth del propio <p>)
    const available = parent.clientWidth - 8; // margen de seguridad
    while (size > minPx && el.scrollWidth > available) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
  }

  // --- Share copy button ---
  document.getElementById('afinidad-share-copy').onclick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mi resultado - Cuestionario de Afinidad CyL 2026',
          text: shareText
        });
        // Track the share
        if (typeof UI !== 'undefined' && UI.trackShareEvent) {
          UI.trackShareEvent('web', 'cuestionario-afinidad', 'web_share');
        }
      } catch (e) {
        await navigator.clipboard.writeText(shareText);
        showCopiedMessage();
        // Track the clipboard copy
        if (typeof UI !== 'undefined' && UI.trackShareEvent) {
          UI.trackShareEvent('web', 'cuestionario-afinidad', 'clipboard');
        }
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      showCopiedMessage();
      // Track the clipboard copy
      if (typeof UI !== 'undefined' && UI.trackShareEvent) {
        UI.trackShareEvent('web', 'cuestionario-afinidad', 'clipboard');
      }
    }
  };

  // --- Share image button ---
  document.getElementById('afinidad-share-image').onclick = async () => {
    const btn = document.getElementById('afinidad-share-image');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Generando...';

    const winnerLogoScale = getWinnerLogoScale(winner?.id);
    const winnerLogoSizePct = Math.round(winnerLogoScale * 100);

    try {
      const urlPng = urlToImageDataUrl(shareUrlForImage, {
  fontSize: 24,
  fontWeight: 800,
  color: '#0f172a',
  dpr: 3 // mejor en móvil
});

      const container = document.createElement('div');
      container.style.cssText = `
        background:#f8fafc;
        padding:32px;
        width:600px;
        box-sizing:border-box;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        color:#0f172a;
      `;

      const urlHtml = buildUrlHTML(shareUrlForImage);

      container.innerHTML = `
        <div style="text-align:center; margin-bottom:32px;">
          <h1 style="color:#1e293b; font-size:28px; margin:0 0 12px 0; line-height:1.3; font-weight:600; letter-spacing:-0.01em;">
            Cuestionario de Afinidad CyL 2026
          </h1>
        </div>

        <div style="background:#fff; border:2px solid #e2e8f0; border-radius:16px; padding:32px 24px; text-align:center; margin-bottom:32px; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <p style="color:#64748b; font-size:16px; margin:0 0 16px 0; line-height:1.4; font-weight:500; letter-spacing:0.01em;">
            Tu partido más afín
          </p>
          <div style="width:88px; height:88px; margin:0 auto 20px; background:#f8fafc; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #e2e8f0; overflow:hidden;">
            <img src="${window.location.origin}/${winner.logo}" style="width:${winnerLogoSizePct}%; height:${winnerLogoSizePct}%; object-fit:contain; object-position:center; display:block;" onerror="this.style.display='none'">
          </div>
          <h2 style="font-size:36px; margin:0 0 12px 0; line-height:1.2; font-weight:700; letter-spacing:-0.02em; color:${winner.color};">
            ${winner.name}
          </h2>
          <p style="font-size:64px; font-weight:800; margin:0; line-height:1.1; letter-spacing:-0.03em; color:#000000; text-shadow:0 2px 4px rgba(0,0,0,0.05);">
            ${sorted[0][1].affinity}%
          </p>
          <p style="color:#64748b; font-size:18px; margin:12px 0 0 0; line-height:1.4; font-weight:400; letter-spacing:0.01em;">
            de afinidad global
          </p>
        </div>

        <div style="background:#fff; border:2px solid #e2e8f0; border-radius:16px; padding:32px 24px; margin-bottom:32px; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <div style="border-radius:12px; padding:24px;">
            ${sorted.map(([partyId, data]) => {
              const p = PARTIES.find(part => part.id === partyId);
              return `
                <div style="display:flex; align-items:center; margin-bottom:16px; padding:10px 0;">
                  <div style="width:100px; text-align:right; font-weight:600; color:#334155; font-size:15px; line-height:1.3; margin-right:20px; letter-spacing:0.01em;">
                    ${p?.name || partyId}
                  </div>
                  <div style="flex:1; background:#e2e8f0; border-radius:12px; height:32px; overflow:hidden; margin-right:20px;">
                    <div style="height:100%; width:${data.affinity}%; background:${p?.color || '#666'}; border-radius:12px;"></div>
                  </div>
                  <div style="width:55px; text-align:left; font-weight:700; color:#334155; line-height:1.3; font-size:15px; letter-spacing:0.01em;">
                    ${data.affinity}%
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="background:#fff; border:2px solid #e2e8f0; border-radius:16px; padding:32px 24px; text-align:center; margin-top:32px; box-shadow:0 8px 24px rgba(0,0,0,0.08);">
          <p style="color:#64748b; font-size:16px; margin:0 0 20px 0; line-height:1.4; font-weight:500; letter-spacing:0.01em;">
            Descubre la tuya
          </p>

          <img
            src="${urlPng}"
            alt="${shareUrlForImage}"
            style="
              display:block;
              margin:0 auto;
              height:30px;
              width:auto;
            "
          />
        </div>
      `;

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
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
        // Track the image share
        if (typeof UI !== 'undefined' && UI.trackShareEvent) {
          UI.trackShareEvent('web', 'resultado-afinidad', 'web_share');
        }
      } else {
        const link = document.createElement('a');
        link.download = 'resultado-afinidad.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        showCopiedMessage();
        // Track the download/fallback
        if (typeof UI !== 'undefined' && UI.trackShareEvent) {
          UI.trackShareEvent('web', 'resultado-afinidad', 'download');
        }
      }
    } catch (e) {
      console.error('Error generating image:', e);
      await navigator.clipboard.writeText(shareText);
      showCopiedMessage();
      // Track the fallback clipboard copy
      if (typeof UI !== 'undefined' && UI.trackShareEvent) {
        UI.trackShareEvent('web', 'resultado-afinidad', 'clipboard');
      }
    }

    btn.innerHTML = originalText;
  };

  // Restart button
  const restartBtn = document.getElementById('afinidad-restart');
  if (restartBtn) {
    restartBtn.onclick = () => restartAfinidadFromIntro();
  }
}

// Track anonymous affinity result with Matomo
function trackAffinityResult(results) {
    // Find the party with highest affinity
    const sorted = Object.entries(results).sort((a, b) => b[1].affinity - a[1].affinity);
    const winnerId = sorted[0][0];
    const winnerAffinity = sorted[0][1].affinity;
    
    // Generate daily hash to prevent spam (based on date + user agent)
    const today = new Date().toDateString();
    const userAgent = navigator.userAgent;
    const hash = btoa(today + userAgent).substring(0, 16);
    
    // Check if already tracked today
    const storageKey = 'afinidad_tracked_' + hash;
    if (localStorage.getItem(storageKey)) {
        return; // Already tracked today
    }
    
    // Track with Matomo as custom event
    if (typeof _paq !== 'undefined') {
        _paq.push(['trackEvent', 'Afinidad', 'Resultado', winnerId, winnerAffinity]);
        
        // Also track without value for compatibility
        _paq.push(['trackEvent', 'Afinidad', 'Partido', winnerId]);
        
        // Mark as tracked today
        localStorage.setItem(storageKey, 'true');
        
        // Clean old entries (keep only last 7 days)
        const keys = Object.keys(localStorage);
        const todayTime = new Date().getTime();
        keys.forEach(key => {
            if (key.startsWith('afinidad_tracked_')) {
                const keyDate = new Date(key.substring(17)).getTime();
                const sevenDaysAgo = todayTime - (7 * 24 * 60 * 60 * 1000);
                if (keyDate < sevenDaysAgo) {
                    localStorage.removeItem(key);
                }
            }
        });
    }
}

function showCopiedMessage() {
    const msg = document.getElementById('afinidad-share-copied');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
}

export function getCurrentIndex() {
    return afinidadState.currentIndex;
}

export function getTotalQuestions() {
    return afinidadState.questions.length;
}
