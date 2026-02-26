/**
 * Main module - Application entry point and state management
 */

import { PARTIES, fetchPartyData, getCategoriesFromProposals } from './api.js';
import { UI } from './ui.js';

let appState = {
    selectedParty: null,
    currentData: null,
    currentCategory: null,
    highlightedId: null
};

async function init() {
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
        window.location.hash = '#/';
    });
}

async function handleRouting() {
    const hash = window.location.hash || '#/';
    const parts = hash.split('/').filter(p => p && p !== '#');

    if (parts.length === 0) {
        UI.switchView('selection');
        appState.selectedParty = null;
        appState.currentCategory = null;
        return;
    }

    const partyId = parts[0];
    const categoryName = parts[1] ? decodeURIComponent(parts[1]) : null;
    const propId = parts[2] || null;

    // 1. Load Party if needed
    if (appState.selectedParty?.id !== partyId) {
        await doPartySelect(partyId);
    }

    // 2. Navigate to category if specified (or force re-render if party changed)
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
    const data = await fetchPartyData(partyId);
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
}

function doCategorySelect(category) {
    if (!appState.currentData) return;
    appState.currentCategory = (category === 'Todas' || !category) ? null : category;

    const categories = getCategoriesFromProposals(appState.currentData.propuestas);
    renderNavigation(categories);
    UI.renderProposals(appState.currentData.propuestas, appState.currentCategory, appState.selectedParty);
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

document.addEventListener('DOMContentLoaded', init);
