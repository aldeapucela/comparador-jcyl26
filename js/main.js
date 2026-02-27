/**
 * Main module - Application entry point and state management
 */

import { PARTIES, fetchPartyData, fetchAllPartiesData, getCategoriesFromProposals, CATEGORIES } from './api.js';
import { UI } from './ui.js';
import { initAfinidad, renderQuestion, handleAnswer, toggleImportant, nextQuestion, prevQuestion, toggleContext, loadFromUrl, calculateAndShowResults, setSharedResults, startAfinidad } from './afinidad.js';

let appState = {
    selectedParty: null,
    currentData: null,
    currentCategory: null,
    highlightedId: null,
    currentHash: '#/',
    previousHash: null,

    // Topic-First state
    mode: 'party', // 'party' or 'topic'
    allData: {},
    selectedParties: [], // Array of party IDs
    filters: {
        rural: false,
        competition: false,
        query: ''
    }
};

function safeDecodeURIComponent(value = '') {
    try {
        return decodeURIComponent(value);
    } catch {
        return '';
    }
}

function sanitizeSearchTerm(raw = '') {
    const normalized = raw
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);

    if (!normalized) return '';

    return normalized
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
}

function foldSearchText(value = '') {
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function getSearchTermFromParts(parts) {
    const raw = parts.slice(1).join('/');
    return sanitizeSearchTerm(safeDecodeURIComponent(raw));
}

function buildSearchHash(term) {
    return term ? `#/s/${encodeURIComponent(term)}` : '#/s';
}

function replaceSearchHash(term) {
    const nextHash = buildSearchHash(term);
    if (window.location.hash === nextHash) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
}

function searchAllProposals(term) {
    if (!term) return [];

    const needle = foldSearchText(term);
    const results = [];

    Object.entries(appState.allData).forEach(([partyId, partyData]) => {
        const partyInfo = PARTIES.find(p => p.id === partyId);
        if (!partyInfo || !partyData?.propuestas) return;

        partyData.propuestas.forEach((prop) => {
            const title = prop.titulo_corto || '';
            const summary = prop.resumen || '';
            const category = prop.categoria || '';
            const tags = Array.isArray(prop.tags) ? prop.tags : [];

            const titleFolded = foldSearchText(title);
            const summaryFolded = foldSearchText(summary);
            const categoryFolded = foldSearchText(category);
            const tagsFolded = tags.map(t => foldSearchText(t)).join(' ');

            const matches = titleFolded.includes(needle)
                || summaryFolded.includes(needle)
                || categoryFolded.includes(needle)
                || tagsFolded.includes(needle);

            if (!matches) return;

            let score = 0;
            if (titleFolded.includes(needle)) score += 4;
            if (summaryFolded.includes(needle)) score += 2;
            if (categoryFolded.includes(needle)) score += 1;
            if (tagsFolded.includes(needle)) score += 1;

            results.push({
                partyId,
                partyName: partyInfo.name,
                partyColor: partyInfo.color,
                proposalId: prop.id,
                title,
                summary,
                category,
                score
            });
        });
    });

    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, 100);
}

async function init() {
    // 1. Bulk Load all data at start (including afinidad data)
    appState.allData = await fetchAllPartiesData();
    
    // Also pre-load afinidad data
    await initAfinidad();

    UI.renderPartySelection();
    setupEventListeners();
    
    handleRouting();
}

function setupEventListeners() {
    // Hash change router
    window.addEventListener('hashchange', handleRouting);

    // Party Selection click
    UI.containers.parties.addEventListener('click', (e) => {
        const card = e.target.closest('.party-card');
        if (card) {
            window.location.hash = `#/${card.dataset.partyId}`;
        }
    });

    // Back Button
    UI.elements.btnBack.addEventListener('click', () => {
        const previousHash = appState.previousHash;
        if (previousHash && previousHash !== appState.currentHash) {
            UI.navigateHash(previousHash);
            return;
        }

        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        UI.navigateHash('#/');
    });

    const btnGlobalSearch = document.getElementById('btn-global-search');
    if (btnGlobalSearch) {
        btnGlobalSearch.addEventListener('click', () => {
            UI.navigateHash('#/s');
        });
    }

    const searchForm = document.getElementById('global-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('global-search-input');
            const term = sanitizeSearchTerm(input?.value || '');
            UI.navigateHash(buildSearchHash(term));
        });
    }

    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
        let searchDebounceId = null;
        globalSearchInput.addEventListener('input', (e) => {
            if (appState.mode !== 'search') return;
            clearTimeout(searchDebounceId);
            searchDebounceId = setTimeout(() => {
                const term = sanitizeSearchTerm(e.target.value || '');
                replaceSearchHash(term);
                UI.renderGlobalSearch(term, searchAllProposals(term));
            }, 120);
        });
    }

    const shareSearchQueryBtn = document.getElementById('btn-share-search-query');
    if (shareSearchQueryBtn) {
        shareSearchQueryBtn.addEventListener('click', () => {
            UI.shareSearchTerm(shareSearchQueryBtn);
        });
    }

    // Goto Topics
    const btnTopics = document.getElementById('btn-goto-topics');
    if (btnTopics) {
        btnTopics.addEventListener('click', () => {
            window.location.hash = '#/comparar';
        });
    }

    // Goto Afinidad
    const btnAfinidad = document.getElementById('btn-goto-afinidad');
    if (btnAfinidad) {
        btnAfinidad.addEventListener('click', () => {
            window.location.hash = '#/afinidad';
        });
    }

    // Afinidad event listeners
    document.addEventListener('click', (e) => {
        const option = e.target.closest('.afinidad-option');
        if (option) {
            handleAnswer(option.dataset.question, parseInt(option.dataset.value));
        }
        
        const importantBtn = e.target.closest('#afinidad-important-btn');
        if (importantBtn) {
            toggleImportant();
        }
        
        const prevBtn = e.target.closest('#afinidad-prev');
        if (prevBtn) {
            prevQuestion();
        }
        
        const nextBtn = e.target.closest('#afinidad-next');
        if (nextBtn) {
            nextQuestion();
        }
        
        const contextBtn = e.target.closest('#afinidad-context-btn');
        if (contextBtn) {
            toggleContext();
        }
    });

    // Comparison Mode: Party selection
    document.addEventListener('click', (e) => {
        const pill = e.target.closest('.party-pill');
        if (pill) {
            const partyId = pill.dataset.partyId;
            togglePartySelection(partyId);
        }

        const topicCard = e.target.closest('.topic-card');
        if (topicCard) {
            const topicId = topicCard.dataset.topicId;
            window.location.hash = `#/comparar/${topicId}`;
        }

        const filterBtn = e.target.closest('.filter-btn');
        if (filterBtn) {
            const filterId = filterBtn.id;
            toggleFilter(filterId);
        }

    });

}

// Helper function to normalize party ID (same as in afinidad.js)
function normalizePartyId(id) {
    // Convert to lowercase and replace spaces/special chars with hyphens
    return id.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Helper function to generate page titles for Matomo
function getPageTitle(hash) {
    const parts = hash.split('/').filter(p => p && p !== '#');
    
    if (parts.length === 0) {
        return 'Comparador Programas Electorales CyL 2026';
    }
    
    const partyId = parts[0];
    
    if (partyId === 'comparar') {
        const topicId = parts[1] || '';
        return `Comparar: ${decodeURIComponent(topicId)} - CyL 2026`;
    }
    
    if (partyId === 's') {
        const term = getSearchTermFromParts(parts);
        return term
            ? `Buscar: ${term} - CyL 2026`
            : 'Buscar medidas - CyL 2026';
    }

    if (partyId === 'afinidad') {
        return 'Cuestionario de Afinidad - CyL 2026';
    }
    
    // Find party name
    const party = appState.allData[partyId] || appState.allData[normalizePartyId(partyId)];
    if (party) {
        return `${party.name} - Programa Electoral CyL 2026`;
    }
    
    return 'Comparador Programas Electorales CyL 2026';
}

function trackSpaPageView(hash) {
    if (typeof _paq === 'undefined') return;

    _paq.push(['setCustomUrl', window.location.href]);
    _paq.push(['setDocumentTitle', getPageTitle(hash)]);
    _paq.push(['trackPageView']);
}

async function handleRouting() {
    const hash = window.location.hash || '#/';
    const parts = hash.split('/').filter(p => p && p !== '#');

    if (hash !== appState.currentHash) {
        appState.previousHash = appState.currentHash;
        appState.currentHash = hash;
    }

    if (parts.length === 0) {
        trackSpaPageView(hash);
        UI.switchView('selection');
        appState.selectedParty = null;
        appState.currentCategory = null;
        return;
    }

    const partyId = parts[0];

    // Check if it's comparison mode
    if (partyId === 'comparar') {
        const topicId = parts[1] || null;
        appState.mode = 'topic';
        appState.currentCategory = topicId;

        // Default selection if empty
        if (appState.selectedParties.length === 0) {
            appState.selectedParties = ['pp', 'psoe'];
        }

        trackSpaPageView(hash);
        UI.switchView('topic');
        renderComparison();
        return;
    }

    // Check if it's global search mode
    if (partyId === 's') {
        appState.mode = 'search';
        const term = getSearchTermFromParts(parts);
        const canonicalHash = buildSearchHash(term);
        if (hash !== canonicalHash) {
            UI.navigateHash(canonicalHash);
            return;
        }

        trackSpaPageView(hash);
        UI.switchView('search');
        UI.renderGlobalSearch(term, searchAllProposals(term));
        return;
    }

    // Check if it's afinidad mode
    if (partyId === 'afinidad') {
        const sharedData = parts[1] || null;
        appState.mode = 'afinidad';
        trackSpaPageView(hash);
        
        if (sharedData) {
            // Load from shared URL - show results directly
            try {
                await loadFromUrl(sharedData);
            } catch (err) {
                console.error('Error loading shared URL:', err);
                window.location.hash = '#/afinidad';
            }
        } else {
            // Show cuestionario (will restore session state if available)
            UI.switchView('afinidad');
            renderQuestion();
        }
        return;
    }

    // --- Party-first mode ---
    const categoryName = parts[1] ? decodeURIComponent(parts[1]) : null;
    const propId = parts[2] || null;

    appState.mode = 'party';
    trackSpaPageView(hash);
    // 1. Always ensure detail view is mounted for party routes.
    // In mobile back/forward flows, selectedParty can match while UI is still
    // in topic view, which would update hash but not switch screen.
    doPartySelect(partyId);

    // 2. Navigate to category if specified
    doCategorySelect(categoryName);

    // 3. Highlight specific measure
    if (propId) {
        highlightMeasure(propId);
    }
}

async function doPartySelect(partyId) {
    const partyInfo = PARTIES.find(p => p.id === partyId);
    if (!partyInfo) {
        window.location.hash = '#/';
        return;
    }

    appState.selectedParty = partyInfo;
    const data = appState.allData[partyId];
    if (data) {
        appState.currentData = data;
        const categories = getCategoriesFromProposals(data.propuestas);
        UI.switchView('detail');
        UI.renderPartyHeader(data.metadatos, partyInfo);
        renderNavigation(categories);
    }
}

function renderNavigation(categories) {
    // 1. Separate 'Otros' if it exists
    const hasOtros = categories.includes('Otros');
    const filteredCategories = categories.filter(c => c !== 'Otros');

    // 2. Sort alphabetically
    filteredCategories.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    // 3. Build final list: Todas + Sorted + (Otros if exists)
    const sortedCategories = ['Todas', ...filteredCategories];
    if (hasOtros) sortedCategories.push('Otros');

    UI.renderCategories(sortedCategories, appState.currentCategory || 'Todas', (cat) => {
        const hash = (cat === 'Todas' || !cat) ? `#/${appState.selectedParty.id}` : `#/${appState.selectedParty.id}/${encodeURIComponent(cat)}`;
        window.location.hash = hash;
    });

    // Also render proposals with floating navigation
    UI.renderProposals(appState.currentData.propuestas, appState.currentCategory, appState.selectedParty, sortedCategories, (cat) => {
        const hash = (cat === 'Todas' || !cat) ? `#/${appState.selectedParty.id}` : `#/${appState.selectedParty.id}/${encodeURIComponent(cat)}`;
        window.location.hash = hash;
    });
}

function doCategorySelect(category) {
    if (!appState.currentData) return;
    appState.currentCategory = (category === 'Todas' || !category) ? null : category;

    const categories = getCategoriesFromProposals(appState.currentData.propuestas);
    renderNavigation(categories);
    UI.renderProposals(appState.currentData.propuestas, appState.currentCategory, appState.selectedParty, categories, doCategorySelect);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function highlightMeasure(id) {
    setTimeout(() => {
        const el = document.getElementById(`prop-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-4');
            const btn = el.querySelector('.btn-toggle-quote');
            if (btn) UI.toggleQuote(id, btn);

            setTimeout(() => {
                el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-4');
            }, 3000);
        }
    }, 500);
}

// --- Topic-First Logic ---

function togglePartySelection(partyId) {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    const index = appState.selectedParties.indexOf(partyId);
    if (index > -1) {
        if (appState.selectedParties.length > 1) {
            appState.selectedParties.splice(index, 1);
        }
    } else {
        if (isMobile && appState.selectedParties.length >= 2) {
            appState.selectedParties.shift();
        }
        appState.selectedParties.push(partyId);
    }
    renderComparison();
}

function toggleFilter(filterId) {
    if (filterId === 'filter-rural') appState.filters.rural = !appState.filters.rural;
    if (filterId === 'filter-competition') appState.filters.competition = !appState.filters.competition;
    renderComparison();
}

function renderComparison() {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (isMobile && appState.selectedParties.length > 2) {
        appState.selectedParties = appState.selectedParties.slice(0, 2);
    }

    const categoryObj = appState.currentCategory ?
        CATEGORIES.find(c => c.id === appState.currentCategory) : null;

    UI.renderComparison(
        appState.allData,
        appState.selectedParties,
        categoryObj,
        appState.filters,
        CATEGORIES
    );
}

document.addEventListener('DOMContentLoaded', init);
