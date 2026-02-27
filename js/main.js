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

async function init() {
    // 1. Bulk Load all data at start (including afinidad data)
    appState.allData = await fetchAllPartiesData();
    
    // Also pre-load afinidad data
    await initAfinidad();

    UI.renderPartySelection();
    setupEventListeners();
    
    // Track initial page view
    if (typeof _paq !== 'undefined') {
        _paq.push(['trackPageView']);
    }
    
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
        window.location.hash = '#/';
    });

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

    // Search input
    const bSearch = document.getElementById('search-input');
    if (bSearch) {
        bSearch.addEventListener('input', (e) => {
            appState.filters.query = e.target.value.toLowerCase();
            if (appState.mode === 'topic') renderComparison();
        });
    }
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

async function handleRouting() {
    const hash = window.location.hash || '#/';
    const parts = hash.split('/').filter(p => p && p !== '#');

    // Track page view with Matomo
    if (typeof _paq !== 'undefined') {
        // Set custom URL and title for SPA
        const customUrl = window.location.href;
        const customTitle = getPageTitle(hash);
        
        _paq.push(['setCustomUrl', customUrl]);
        _paq.push(['setDocumentTitle', customTitle]);
        _paq.push(['trackPageView']);
    }

    if (parts.length === 0) {
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

        UI.switchView('topic');
        renderComparison();
        return;
    }

    // Check if it's afinidad mode
    if (partyId === 'afinidad') {
        const sharedData = parts[1] || null;
        appState.mode = 'afinidad';
        
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
    // 1. Load Party if needed
    if (appState.selectedParty?.id !== partyId) {
        doPartySelect(partyId);
    }

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
