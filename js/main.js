/**
 * Main module - Application entry point and state management
 */

import { PARTIES, fetchAllPartiesData, getCategoriesFromProposals, CATEGORIES, loadPartiesCatalog } from './api.js';
import { UI } from './ui.js';
import { initAfinidad, handleAnswer, toggleImportant, nextQuestion, prevQuestion, toggleContext, calculateAndShowResults, startAfinidad, showAfinidadIntro, setStoriesController, setAppState } from './afinidad.js';
import { createStoriesController } from './stories/controller.js';
import { readSavedStoryIds, getStoryUniqueIdByParts } from './stories/saved.js';

const APP_VERSION = new URL(import.meta.url).searchParams.get('v') || '';
window.__APP_VERSION__ = APP_VERSION;

const ZONE_STORAGE_KEY = 'selectedZone';
const DEFAULT_FALLBACK_ZONE = 'Valladolid';
const FALLBACK_ZONES = [DEFAULT_FALLBACK_ZONE];

let allPartiesCatalog = [];
let availableZones = [...FALLBACK_ZONES];
let defaultZone = DEFAULT_FALLBACK_ZONE;
let afinidadAvailableZones = [DEFAULT_FALLBACK_ZONE];
let partyZonesMap = {};

let appState = {
    selectedParty: null,
    currentData: null,
    currentCategory: null,
    highlightedId: null,
    currentHash: '#/',
    previousHash: null,
    selectedZone: DEFAULT_FALLBACK_ZONE,

    // Topic-First state
    mode: 'party', // 'party' or 'topic'
    allData: {},
    selectedParties: [], // Array of party IDs
    searchTerm: '',
    searchPartyFilters: [],
    filters: {
        rural: false,
        competition: false,
        query: ''
    },
    stories: {
        source: 'random',
        selectedPartyId: '',
        selectedPartyIds: [],
        selectedTopic: '',
        returnHash: '#/',
        hideSeenStories: true,
        feed: [],
        currentIndex: 0,
        currentStory: null,
        currentDurationMs: 7000,
        transitionDirection: 'next',
        started: false
    }
};

const storiesController = createStoriesController(appState);

// Inyectar el controlador de historias y el estado de la aplicación en el módulo de afinidad
setStoriesController(storiesController);
setAppState(appState);

function withAppVersion(path) {
    const version = window.__APP_VERSION__;
    if (!version) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}v=${encodeURIComponent(version)}`;
}

function normalizeZoneName(value = '') {
    return String(value || '').trim();
}

async function loadAvailableZonesConfig() {
    try {
        const response = await fetch(withAppVersion('./data/zones.json'));
        if (!response.ok) throw new Error('Could not load zones config');
        const data = await response.json();
        const zones = Array.isArray(data?.zones)
            ? data.zones.map(normalizeZoneName).filter(Boolean)
            : [];
        const safeZones = zones.length > 0 ? zones : [...FALLBACK_ZONES];
        defaultZone = normalizeZoneName(data?.defaultZone) || safeZones[0] || DEFAULT_FALLBACK_ZONE;
        if (!safeZones.includes(defaultZone)) {
            defaultZone = safeZones[0] || DEFAULT_FALLBACK_ZONE;
        }
        const afinidadRaw = Array.isArray(data?.afinidadAvailableZones)
            ? data.afinidadAvailableZones.map(normalizeZoneName).filter(Boolean)
            : [];
        afinidadAvailableZones = afinidadRaw.filter((zone) => safeZones.includes(zone));
        if (afinidadAvailableZones.length === 0) {
            afinidadAvailableZones = [defaultZone];
        }
        return safeZones;
    } catch (error) {
        console.error('Error loading zones config:', error);
        defaultZone = DEFAULT_FALLBACK_ZONE;
        afinidadAvailableZones = [DEFAULT_FALLBACK_ZONE];
        return [...FALLBACK_ZONES];
    }
}

function buildPartyZonesMap() {
    const map = {};
    allPartiesCatalog.forEach((party) => {
        const zonesRaw = appState.allData?.[party.id]?.metadatos?.zonas;
        const normalized = Array.isArray(zonesRaw)
            ? zonesRaw.map(normalizeZoneName).filter(Boolean)
            : [];
        map[party.id] = normalized.length > 0 ? normalized : [...availableZones];
    });
    return map;
}

function getAvailablePartyIdsByZone(zone) {
    return allPartiesCatalog
        .filter((party) => {
            const zones = partyZonesMap[party.id] || [];
            return zones.includes(zone);
        })
        .map((party) => party.id);
}

function applyZonePartyFilter(zone) {
    const allowedPartyIds = new Set(getAvailablePartyIdsByZone(zone));
    const filteredParties = allPartiesCatalog.filter((party) => allowedPartyIds.has(party.id));
    PARTIES.splice(0, PARTIES.length, ...filteredParties);
}

function isAfinidadEnabledForZone(zone) {
    return afinidadAvailableZones.includes(zone);
}

function renderAfinidadAvailabilityIntro() {
    const isEnabled = isAfinidadEnabledForZone(appState.selectedZone);
    const noteEl = document.getElementById('afinidad-unavailable-note');
    const startBtn = document.getElementById('afinidad-start-btn');
    const introTitleEl = document.getElementById('afinidad-intro-title');
    const introDescriptionEl = document.getElementById('afinidad-intro-description');
    const introDetailsEl = document.getElementById('afinidad-intro-details');
    const introMethodologyEl = document.getElementById('afinidad-intro-methodology');
    if (!noteEl || !startBtn) return;

    if (isEnabled) {
        noteEl.classList.add('hidden');
        noteEl.innerHTML = '';
        introTitleEl?.classList.remove('hidden');
        introDescriptionEl?.classList.remove('hidden');
        introDetailsEl?.classList.remove('hidden');
        introMethodologyEl?.classList.remove('hidden');
        startBtn.disabled = false;
        startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        startBtn.setAttribute('aria-disabled', 'false');
        return;
    }

    noteEl.innerHTML = `
        <p>Ahora mismo el cuestionario no está disponible para ${appState.selectedZone}.</p>
        <p class="mt-2">Puedes cambiar el selector de la parte superior y hacerlo en: ${afinidadAvailableZones.join(', ')}.</p>
        <p class="mt-2">Esta es una herramienta creada por vecinos voluntarios, iremos ampliándola en cuanto nos sea posible.</p>
    `;
    noteEl.classList.remove('hidden');
    introTitleEl?.classList.add('hidden');
    introDescriptionEl?.classList.add('hidden');
    introDetailsEl?.classList.add('hidden');
    introMethodologyEl?.classList.add('hidden');
    startBtn.disabled = true;
    startBtn.classList.add('opacity-50', 'cursor-not-allowed');
    startBtn.setAttribute('aria-disabled', 'true');
}

function getSavedZone() {
    try {
        const saved = localStorage.getItem(ZONE_STORAGE_KEY);
        if (saved && availableZones.includes(saved)) return saved;
    } catch (error) {
        console.error('Error reading saved zone:', error);
    }
    return availableZones.includes(defaultZone)
        ? defaultZone
        : (availableZones[0] || defaultZone);
}

function persistZone(zone) {
    try {
        localStorage.setItem(ZONE_STORAGE_KEY, zone);
    } catch (error) {
        console.error('Error persisting selected zone:', error);
    }
}

function renderZoneSelector() {
    const zoneOptionsHtml = availableZones
        .slice()
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
        .map((zoneName) => `<option value="${zoneName}">${zoneName}</option>`)
        .join('');
    const headerSelect = document.getElementById('zone-select');
    const exploraSelect = document.getElementById('explora-zone-select');
    if (headerSelect) headerSelect.innerHTML = zoneOptionsHtml;
    if (exploraSelect) exploraSelect.innerHTML = zoneOptionsHtml;
    syncZoneSelectors();
    syncExploraZoneSelectWidth();
}

function refreshZoneLabel() {
    // Zone is communicated through the selector value in the header.
}

function refreshAfinidadAvailabilityUI() {
    const isEnabled = isAfinidadEnabledForZone(appState.selectedZone);
    const homeButton = document.getElementById('btn-goto-afinidad');
    const unavailableText = document.getElementById('afinidad-home-unavailable');
    const homeSubtitle = document.getElementById('afinidad-home-subtitle');
    const mobileMenuLabel = document.getElementById('mobile-menu-afinidad-label');

    if (homeButton) {
        homeButton.classList.toggle('is-disabled', !isEnabled);
        homeButton.setAttribute('aria-disabled', String(!isEnabled));
    }
    if (unavailableText) {
        unavailableText.classList.toggle('hidden', isEnabled);
    }
    if (homeSubtitle) {
        homeSubtitle.classList.toggle('hidden', !isEnabled);
    }
    if (mobileMenuLabel) {
        mobileMenuLabel.textContent = isEnabled
            ? 'Cuestionario de afinidad'
            : `Cuestionario de afinidad (solo ${afinidadAvailableZones.join(', ')})`;
    }
    renderAfinidadAvailabilityIntro();
}

function applyZoneSelection(zone, { persist = true } = {}) {
    const fallbackZone = availableZones.includes(defaultZone)
        ? defaultZone
        : (availableZones[0] || defaultZone);
    const nextZone = availableZones.includes(zone) ? zone : fallbackZone;
    appState.selectedZone = nextZone;
    if (persist) persistZone(nextZone);

    applyZonePartyFilter(nextZone);
    appState.selectedParties = appState.selectedParties.filter((partyId) =>
        PARTIES.some((party) => party.id === partyId)
    );
    appState.searchPartyFilters = appState.searchPartyFilters.filter((partyId) =>
        PARTIES.some((party) => party.id === partyId)
    );
    if (appState.selectedParties.length === 0 && PARTIES.length > 0) {
        appState.selectedParties = PARTIES.slice(0, 2).map((party) => party.id);
    }
    refreshZoneLabel();
    refreshAfinidadAvailabilityUI();
}

function syncZoneSelectors() {
    const value = appState.selectedZone;
    const headerSelect = document.getElementById('zone-select');
    const exploraSelect = document.getElementById('explora-zone-select');
    if (headerSelect && headerSelect.value !== value) headerSelect.value = value;
    if (exploraSelect && exploraSelect.value !== value) exploraSelect.value = value;
    syncExploraZoneSelectWidth();
}

function syncExploraZoneSelectWidth() {
    const exploraSelect = document.getElementById('explora-zone-select');
    if (!exploraSelect) return;
    const selectedText = String(
        exploraSelect.options?.[exploraSelect.selectedIndex]?.text || exploraSelect.value || ''
    ).trim();
    const ruler = document.createElement('span');
    const styles = window.getComputedStyle(exploraSelect);
    ruler.textContent = selectedText || 'ZONA';
    ruler.style.position = 'absolute';
    ruler.style.visibility = 'hidden';
    ruler.style.whiteSpace = 'pre';
    ruler.style.fontSize = styles.fontSize;
    ruler.style.fontWeight = styles.fontWeight;
    ruler.style.fontFamily = styles.fontFamily;
    ruler.style.letterSpacing = styles.letterSpacing;
    ruler.style.textTransform = styles.textTransform;
    document.body.appendChild(ruler);
    const textWidth = Math.ceil(ruler.getBoundingClientRect().width);
    ruler.remove();
    exploraSelect.style.width = `${Math.max(textWidth + 20, 90)}px`;
}

function rerenderAfterZoneChange() {
    handleRouting();
}


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

function tokenizeSearchText(value = '') {
    const folded = foldSearchText(value);
    return folded.match(/[\p{L}\p{N}]+/gu) || [];
}

function fieldMatchesSearchTerm(fieldValue = '', queryTokens = []) {
    if (!Array.isArray(queryTokens) || queryTokens.length === 0) return false;
    const fieldTokens = tokenizeSearchText(fieldValue);
    return queryTokens.every((token) => {
        return fieldTokens.some((fieldToken) => {
            if (fieldToken === token) return true;
            if (token.length < 4 || fieldToken.length < 4) return false;
            return fieldToken.startsWith(token) || token.startsWith(fieldToken);
        });
    });
}

function getSearchTermFromParts(parts) {
    const raw = parts.slice(1).join('/');
    return sanitizeSearchTerm(safeDecodeURIComponent(raw));
}

function normalizeSearchPartyIds(partyIds = []) {
    const partyIdOrder = PARTIES.map((party) => party.id);
    const partyIdsSet = new Set(partyIdOrder);
    const seen = new Set();
    return partyIds
        .map((id) => (id || '').toString().trim().toLowerCase())
        .filter((id) => partyIdsSet.has(id) && !seen.has(id) && seen.add(id))
        .sort((a, b) => partyIdOrder.indexOf(a) - partyIdOrder.indexOf(b));
}

function buildSearchHash(term, partyIds = []) {
    const base = term ? `#/s/${encodeURIComponent(term)}` : '#/s';
    const normalizedPartyIds = normalizeSearchPartyIds(partyIds);
    if (normalizedPartyIds.length === 0) return base;

    const params = new URLSearchParams();
    params.set('parties', normalizedPartyIds.join(','));
    return `${base}?${params.toString()}`;
}

// Make buildSearchHash available globally for UI module
window.buildSearchHash = buildSearchHash;

function parseSearchRouteFromHash(hash) {
    const raw = hash.startsWith('#/') ? hash.slice(2) : hash.replace(/^#/, '');
    const [pathPart = '', queryPart = ''] = raw.split('?');
    const pathSegments = pathPart.split('/').filter(Boolean);
    if (pathSegments[0] !== 's') return null;

    const term = getSearchTermFromParts(pathSegments);
    const params = new URLSearchParams(queryPart);
    const partyIds = normalizeSearchPartyIds((params.get('parties') || '').split(','));

    return {
        term,
        partyIds,
        canonicalHash: buildSearchHash(term, partyIds)
    };
}

function replaceSearchHash(term, partyIds = []) {
    const nextHash = buildSearchHash(term, partyIds);
    if (window.location.hash === nextHash) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
}

function searchAllProposals(term, partyIds = []) {
    if (!term) return [];

    const queryTokens = tokenizeSearchText(term);
    if (queryTokens.length === 0) return [];
    const normalizedPartyIds = normalizeSearchPartyIds(partyIds);
    const hasPartyFilter = normalizedPartyIds.length > 0;
    const allowedParties = new Set(normalizedPartyIds);
    const results = [];

    Object.entries(appState.allData).forEach(([partyId, partyData]) => {
        if (hasPartyFilter && !allowedParties.has(partyId)) return;
        const partyInfo = PARTIES.find(p => p.id === partyId);
        if (!partyInfo || !partyData?.propuestas) return;

        partyData.propuestas.forEach((prop) => {
            const title = prop.titulo_corto || '';
            const summary = prop.resumen || '';
            const category = prop.categoria || '';
            const tags = (Array.isArray(prop.tags) ? prop.tags : []).join(' ');

            const titleMatch = fieldMatchesSearchTerm(title, queryTokens);
            const summaryMatch = fieldMatchesSearchTerm(summary, queryTokens);
            const categoryMatch = fieldMatchesSearchTerm(category, queryTokens);
            const tagsMatch = fieldMatchesSearchTerm(tags, queryTokens);
            const matches = titleMatch || summaryMatch || categoryMatch || tagsMatch;

            if (!matches) return;

            let score = 0;
            if (titleMatch) score += 4;
            if (summaryMatch) score += 2;
            if (categoryMatch) score += 1;
            if (tagsMatch) score += 1;

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

function countMatchesByParty(term) {
    const counts = PARTIES.reduce((acc, party) => {
        acc[party.id] = 0;
        return acc;
    }, {});

    if (!term) return counts;

    const queryTokens = tokenizeSearchText(term);
    if (queryTokens.length === 0) return counts;

    Object.entries(appState.allData).forEach(([partyId, partyData]) => {
        if (!Object.prototype.hasOwnProperty.call(counts, partyId)) return;
        if (!partyData?.propuestas) return;

        partyData.propuestas.forEach((prop) => {
            const titleMatch = fieldMatchesSearchTerm(prop.titulo_corto || '', queryTokens);
            const summaryMatch = fieldMatchesSearchTerm(prop.resumen || '', queryTokens);
            const categoryMatch = fieldMatchesSearchTerm(prop.categoria || '', queryTokens);
            const tagsMatch = fieldMatchesSearchTerm((Array.isArray(prop.tags) ? prop.tags : []).join(' '), queryTokens);
            const matches = titleMatch || summaryMatch || categoryMatch || tagsMatch;

            if (matches) counts[partyId] += 1;
        });
    });

    return counts;
}

function renderSearchScreen(term) {
    appState.searchTerm = term;
    const results = searchAllProposals(term, appState.searchPartyFilters);
    const partyMatchCounts = countMatchesByParty(term);

    UI.renderGlobalSearch(
        term,
        results,
        {
            selectedPartyIds: appState.searchPartyFilters,
            partyMatchCounts,
            onTogglePartyFilter: (partyId) => {
                const isActive = appState.searchPartyFilters.includes(partyId);
                const nextPartyIds = isActive
                    ? appState.searchPartyFilters.filter((id) => id !== partyId)
                    : [...appState.searchPartyFilters, partyId];

                appState.searchPartyFilters = normalizeSearchPartyIds(nextPartyIds);
                replaceSearchHash(appState.searchTerm, appState.searchPartyFilters);
                renderSearchScreen(appState.searchTerm);
            },
            onClearPartyFilters: () => {
                appState.searchPartyFilters = [];
                replaceSearchHash(appState.searchTerm, appState.searchPartyFilters);
                renderSearchScreen(appState.searchTerm);
            }
        }
    );
}

function getSavedProposalsGroupedByParty() {
    const savedIds = readSavedStoryIds();
    const grouped = new Map();

    PARTIES.forEach((party) => {
        const partyData = appState.allData[party.id];
        const proposals = Array.isArray(partyData?.propuestas) ? partyData.propuestas : [];
        const savedProposals = proposals.filter((proposal) => savedIds.has(getStoryUniqueIdByParts(party.id, proposal.id)));
        if (savedProposals.length > 0) {
            grouped.set(party.id, {
                party,
                proposals: savedProposals
            });
        }
    });

    return grouped;
}

function getSavedProposalsStats() {
    const savedIds = readSavedStoryIds();
    const partyStats = [];
    const categorySavedMap = new Map();
    const totalSavedCount = savedIds.size;

    PARTIES.forEach((party) => {
        const proposals = Array.isArray(appState.allData[party.id]?.propuestas)
            ? appState.allData[party.id].propuestas
            : [];
        let savedCount = 0;

        proposals.forEach((proposal) => {
            const category = proposal?.categoria || 'General';
            const storyId = getStoryUniqueIdByParts(party.id, proposal.id);
            const isSaved = savedIds.has(storyId);
            if (isSaved) savedCount += 1;
            if (isSaved) categorySavedMap.set(category, (categorySavedMap.get(category) || 0) + 1);
        });

        if (savedCount > 0) {
            partyStats.push({
                partyId: party.id,
                partyName: party.name,
                partyLogo: party.logo,
                savedCount,
                totalCount: totalSavedCount,
                percent: totalSavedCount > 0 ? (savedCount / totalSavedCount) * 100 : 0
            });
        }
    });

    const categoryStats = Array.from(categorySavedMap.entries())
        .map(([name, savedCount]) => {
            return {
                name,
                savedCount,
                totalCount: totalSavedCount,
                percent: totalSavedCount > 0 ? (savedCount / totalSavedCount) * 100 : 0
            };
        });

    return { partyStats, categoryStats };
}

function renderSavedProposalsScreen() {
    const grouped = getSavedProposalsGroupedByParty();
    const stats = getSavedProposalsStats();
    UI.renderSavedProposals(grouped, stats);
}

function syncHomeSavedEntryVisibility() {
    const homeSavedEntry = document.getElementById('home-saved-entry');
    if (!homeSavedEntry) return;
    const hasSaved = readSavedStoryIds().size > 0;
    homeSavedEntry.classList.toggle('hidden', !hasSaved);
}

async function shareHomePage(btn, origin = 'home-desktop') {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const url = `${baseUrl}?utm_source=share`;
    const shareBody = 'Descubre el comparador de programas de las elecciones a las Cortes de Castilla y León y descubre a qué partido eres más afín con el cuestionario exclusivo';
    const shareText = `${shareBody}\n\n${url}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Comparador Electoral CyL 2026',
                text: shareBody,
                url
            });
            // Track the share
            if (typeof UI !== 'undefined' && UI.trackShareEvent) {
                UI.trackShareEvent('web', origin, 'web_share');
            }
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }

    try {
        await navigator.clipboard.writeText(shareText);
        // Track the clipboard copy
        if (typeof UI !== 'undefined' && UI.trackShareEvent) {
            UI.trackShareEvent('web', origin, 'clipboard');
        }
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check text-emerald-300"></i><span>Copiado</span>';
            setTimeout(() => { btn.innerHTML = originalText; }, 2200);
        }
    } catch (err) {
        console.error('Failed to share home page: ', err);
    }
}

function setupMobileMenu() {
    const openBtn = document.getElementById('btn-mobile-menu');
    const closeBtn = document.getElementById('btn-mobile-menu-close');
    const overlay = document.getElementById('mobile-menu-overlay');
    const drawer = document.getElementById('mobile-menu-drawer');
    const programsContainer = document.getElementById('mobile-menu-programs');
    const pendingStoriesContainer = document.getElementById('mobile-menu-pending-stories');
    let skipPendingStoryClick = false;

    if (!overlay || !drawer) return;

    const renderProgramsMenu = () => {
        if (!programsContainer) return;
        const shuffledParties = [...PARTIES];
        for (let i = shuffledParties.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledParties[i], shuffledParties[j]] = [shuffledParties[j], shuffledParties[i]];
        }

        programsContainer.innerHTML = shuffledParties.map((party) => `
            <a class="mobile-menu-program-link mobile-menu-link" href="#/${party.id}" aria-label="Ver programa de ${UI.escapeHtml(party.name)}">
                <img src="${UI.escapeHtml(party.logo)}" alt="" aria-hidden="true">
                <span>${UI.escapeHtml(party.name)}</span>
            </a>
        `).join('');
    };

    const renderPendingStories = () => {
        if (!pendingStoriesContainer) return;
        const pendingParties = PARTIES
            .map((party) => {
                const proposals = appState.allData?.[party.id]?.propuestas || [];
                const unseenCount = storiesController.countUnseenStoriesForParty(party.id, proposals);
                return { party, unseenCount };
            })
            .filter((entry) => entry.unseenCount > 0);

        if (pendingParties.length === 0) {
            pendingStoriesContainer.innerHTML = '<span class="mobile-menu-pending-empty">No hay stories pendientes</span>';
            return;
        }

        // Fisher-Yates shuffle to avoid any fixed or priority order between parties.
        const shuffledPendingParties = [...pendingParties];
        for (let i = shuffledPendingParties.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledPendingParties[i], shuffledPendingParties[j]] = [shuffledPendingParties[j], shuffledPendingParties[i]];
        }

        pendingStoriesContainer.innerHTML = shuffledPendingParties.map(({ party, unseenCount }) => `
            <button class="mobile-menu-pending-pill" type="button" data-party-id="${UI.escapeHtml(party.id)}" aria-label="Ver stories pendientes de ${UI.escapeHtml(party.name)} (${unseenCount})" title="${UI.escapeHtml(party.name)} · ${unseenCount} pendientes">
                <span class="story-ring-icon">
                    <img src="${UI.escapeHtml(party.logo)}" alt="">
                </span>
            </button>
        `).join('');
    };

    const bindPendingStoriesDragScroll = () => {
        if (!pendingStoriesContainer || pendingStoriesContainer.dataset.dragBound === 'true') return;
        pendingStoriesContainer.dataset.dragBound = 'true';

        let isDragging = false;
        let startX = 0;
        let startScrollLeft = 0;
        let dragged = false;

        pendingStoriesContainer.addEventListener('pointerdown', (event) => {
            isDragging = true;
            dragged = false;
            startX = event.clientX;
            startScrollLeft = pendingStoriesContainer.scrollLeft;
        });

        pendingStoriesContainer.addEventListener('pointermove', (event) => {
            if (!isDragging) return;
            const deltaX = event.clientX - startX;
            if (Math.abs(deltaX) > 4) {
                dragged = true;
                pendingStoriesContainer.scrollLeft = startScrollLeft - deltaX;
            }
        });

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            if (dragged) {
                skipPendingStoryClick = true;
                window.setTimeout(() => {
                    skipPendingStoryClick = false;
                }, 60);
            }
        };

        pendingStoriesContainer.addEventListener('pointerup', endDrag);
        pendingStoriesContainer.addEventListener('pointercancel', endDrag);
        pendingStoriesContainer.addEventListener('pointerleave', endDrag);

        let isTouchDragging = false;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartScrollLeft = 0;
        let touchDragged = false;
        let touchIntentLocked = false;
        let touchIntentHorizontal = false;

        pendingStoriesContainer.addEventListener('touchstart', (event) => {
            const touch = event.touches?.[0];
            if (!touch) return;
            isTouchDragging = true;
            touchDragged = false;
            touchIntentLocked = false;
            touchIntentHorizontal = false;
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartScrollLeft = pendingStoriesContainer.scrollLeft;
        }, { passive: true });

        pendingStoriesContainer.addEventListener('touchmove', (event) => {
            if (!isTouchDragging) return;
            const touch = event.touches?.[0];
            if (!touch) return;

            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            if (!touchIntentLocked && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
                touchIntentHorizontal = Math.abs(deltaX) >= Math.abs(deltaY);
                touchIntentLocked = true;
            }

            if (touchIntentHorizontal) {
                touchDragged = true;
                pendingStoriesContainer.scrollLeft = touchStartScrollLeft - deltaX;
                event.preventDefault();
            }
        }, { passive: false });

        pendingStoriesContainer.addEventListener('touchend', () => {
            if (!isTouchDragging) return;
            isTouchDragging = false;
            if (touchDragged) {
                skipPendingStoryClick = true;
                window.setTimeout(() => {
                    skipPendingStoryClick = false;
                }, 150);
            }
        }, { passive: true });

        pendingStoriesContainer.addEventListener('touchcancel', () => {
            isTouchDragging = false;
            touchDragged = false;
            touchIntentLocked = false;
            touchIntentHorizontal = false;
        }, { passive: true });
    };

    const closeMenu = () => {
        overlay.classList.remove('is-open');
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('mobile-menu-open');
    };

    const openMenu = () => {
        renderProgramsMenu();
        renderPendingStories();
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
            overlay.classList.add('is-open');
        });
        document.body.classList.add('mobile-menu-open');
    };

    if (openBtn) openBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    bindPendingStoriesDragScroll();

    overlay.addEventListener('click', (event) => {
        if (!event.target.closest('#mobile-menu-drawer')) {
            closeMenu();
        }
    });

    drawer.addEventListener('click', (event) => {
        const navLink = event.target.closest('a.mobile-menu-link');
        if (navLink) {
            closeMenu();
            return;
        }

        const pendingPartyBtn = event.target.closest('.mobile-menu-pending-pill');
        if (pendingPartyBtn?.dataset.partyId) {
            if (skipPendingStoryClick) return;
            closeMenu();
            storiesController.focusOnParty(pendingPartyBtn.dataset.partyId);
            UI.navigateHash('#/explora/play');
        }
    });

    window.addEventListener('hashchange', closeMenu);
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
            closeMenu();
        }
    });
}

async function init() {
    await loadPartiesCatalog();
    allPartiesCatalog = [...PARTIES];
    appState.allPartiesCatalog = [...allPartiesCatalog];

    // 1. Bulk Load all data at start (including afinidad data)
    appState.allData = await fetchAllPartiesData();
    availableZones = await loadAvailableZonesConfig();
    partyZonesMap = buildPartyZonesMap();
    
    // Also pre-load afinidad data
    await initAfinidad();

    applyZoneSelection(getSavedZone(), { persist: false });
    renderZoneSelector();

    UI.renderPartySelection();
    syncHomeSavedEntryVisibility();
    setupMobileMenu();
    setupEventListeners();
    
    handleRouting();
}

function setupEventListeners() {
    const onZoneChange = (event) => {
        const nextZone = event.target?.value || defaultZone;
        applyZoneSelection(nextZone);
        syncZoneSelectors();
        UI.renderPartySelection();
        syncHomeSavedEntryVisibility();
        rerenderAfterZoneChange();
    };

    const zoneSelect = document.getElementById('zone-select');
    if (zoneSelect) zoneSelect.addEventListener('change', onZoneChange);

    const exploraZoneSelect = document.getElementById('explora-zone-select');
    if (exploraZoneSelect) exploraZoneSelect.addEventListener('change', onZoneChange);
    const exploraZoneControl = document.querySelector('.explora-zone-control');
    if (exploraZoneControl && exploraZoneSelect) {
        exploraZoneControl.addEventListener('click', () => {
            exploraZoneSelect.focus();
            if (typeof exploraZoneSelect.showPicker === 'function') {
                exploraZoneSelect.showPicker();
            } else {
                exploraZoneSelect.click();
            }
        });
    }

    // Hash change router
    window.addEventListener('hashchange', handleRouting);
    window.addEventListener('saved-proposals-changed', () => {
        syncHomeSavedEntryVisibility();
        if ((window.location.hash || '#/').startsWith('#/guardadas')) {
            renderSavedProposalsScreen();
        }
    });

    // Party Selection click
    UI.containers.parties.addEventListener('click', (e) => {
        const card = e.target.closest('.party-card');
        if (card) {
            window.location.hash = `#/${card.dataset.partyId}`;
        }
    });

    // Back Button
    UI.elements.btnBack.addEventListener('click', () => {
        const route = (appState.currentHash || '#/')
            .split('/')
            .filter(p => p && p !== '#')[0] || '';
        const isPartyRoute = allPartiesCatalog.some(p => p.id === route);

        if (route === 'explora') {
            const storiesReturnHash = appState.stories?.returnHash || '#/';
            UI.navigateHash(storiesReturnHash);
            return;
        }

        if (route === 'comparar' || route === 'guardadas' || isPartyRoute) {
            UI.navigateHash('#/');
            return;
        }

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
            UI.navigateHash(buildSearchHash(term, appState.searchPartyFilters));
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
                replaceSearchHash(term, appState.searchPartyFilters);
                renderSearchScreen(term);
            }, 120);
        });
    }

    const shareSearchQueryBtn = document.getElementById('btn-share-search-query');
    if (shareSearchQueryBtn) {
        shareSearchQueryBtn.addEventListener('click', () => {
            UI.shareSearchTerm(shareSearchQueryBtn);
        });
    }

    const shareHomeBtn = document.getElementById('btn-share-home');
    if (shareHomeBtn) {
        shareHomeBtn.addEventListener('click', () => {
            shareHomePage(shareHomeBtn, 'home-desktop');
        });
    }
    const shareHomeMobileBtn = document.getElementById('btn-share-home-mobile');
    if (shareHomeMobileBtn) {
        shareHomeMobileBtn.addEventListener('click', () => {
            shareHomePage(shareHomeMobileBtn, 'home-mobile');
        });
    }

    // Goto Topics
    const btnTopics = document.getElementById('btn-goto-topics');
    if (btnTopics) {
        btnTopics.addEventListener('click', () => {
            window.location.hash = '#/comparar';
        });
    }

    const btnExplora = document.getElementById('btn-goto-explora');
    if (btnExplora) {
        btnExplora.addEventListener('click', () => {
            appState.stories.returnHash = '#/';
            window.location.hash = '#/explora';
        });
    }
    const btnSaved = document.getElementById('btn-goto-saved');
    if (btnSaved) {
        btnSaved.addEventListener('click', () => {
            window.location.hash = '#/guardadas';
        });
    }

    // Goto Afinidad
    const btnAfinidad = document.getElementById('btn-goto-afinidad');
    if (btnAfinidad) {
        btnAfinidad.addEventListener('click', () => {
            if (!isAfinidadEnabledForZone(appState.selectedZone)) return;
            window.location.hash = '#/afinidad';
        });
    }

    // Afinidad event listeners
    document.addEventListener('click', (e) => {
        const startBtn = e.target.closest('#afinidad-start-btn');
        if (startBtn) {
            if (!isAfinidadEnabledForZone(appState.selectedZone)) return;
            startAfinidad();
            return;
        }

        const closeIntroBtn = e.target.closest('#afinidad-intro-close');
        if (closeIntroBtn) {
            window.location.hash = '#/';
            return;
        }

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

    document.querySelectorAll('.explora-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
            storiesController.setSource(btn.dataset.exploraChoice || 'random');
        });
    });

    document.getElementById('btn-explora-start')?.addEventListener('click', () => {
        UI.navigateHash('#/explora/play');
    });

    document.addEventListener('keydown', (event) => {
        storiesController.handleKeydown(event);
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

        // Vote Impact Survey
        const impactOptionBtn = e.target.closest('.impact-option-btn, .impact-option-btn-neutral');
        if (impactOptionBtn) {
            handleVoteImpactSurvey(impactOptionBtn.dataset.option);
        }

    });

}

// Vote Impact Survey Functions
function handleVoteImpactSurvey(option) {
    // Track with Matomo
    if (typeof _paq !== 'undefined') {
        _paq.push(['trackEvent', 'EncuestaVoto', 'Impacto', option]);
    }

    // Show thanks message and hide buttons
    const surveyContainer = document.getElementById('vote-impact-survey');
    const thanksMessage = document.getElementById('survey-thanks');
    const buttons = surveyContainer.querySelectorAll('.impact-option-btn, .impact-option-btn-neutral');
    
    buttons.forEach(btn => btn.style.display = 'none');
    thanksMessage.classList.remove('hidden');
    
    // Store completion in localStorage
    localStorage.setItem('voteImpactSurveyCompleted', Date.now().toString());
    
    // Hide survey after showing thanks
    setTimeout(() => {
        surveyContainer.classList.add('hidden');
    }, 3000);
}

function showVoteImpactSurveyIfNeeded() {
    const surveyContainer = document.getElementById('vote-impact-survey');
    if (!surveyContainer) {
        // Retry if DOM not ready
        setTimeout(showVoteImpactSurveyIfNeeded, 100);
        return;
    }
    
    // Check if user already completed survey
    const completedTime = localStorage.getItem('voteImpactSurveyCompleted');
    if (completedTime) {
        const completed = parseInt(completedTime);
        const now = Date.now();
        const hoursSinceCompletion = (now - completed) / (1000 * 60 * 60);
        
        // Don't show if completed less than 24 hours ago
        if (hoursSinceCompletion < 24) {
            return;
        }
    }
    
    // Show survey with animation
    surveyContainer.classList.remove('hidden');
    requestAnimationFrame(() => {
        surveyContainer.style.opacity = '1';
        surveyContainer.style.transform = 'translateY(0)';
    });
}

// Make function globally available
window.showVoteImpactSurveyIfNeeded = showVoteImpactSurveyIfNeeded;

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
    const hashWithoutQuery = hash.split('?')[0];
    const parts = hashWithoutQuery.split('/').filter(p => p && p !== '#');
    
    if (parts.length === 0) {
        return 'Comparador Programas Electorales CyL 2026';
    }
    
    const partyId = parts[0];
    
    if (partyId === 'comparar') {
        const topicId = parts[1] || '';
        return `Comparar: ${decodeURIComponent(topicId)} - CyL 2026`;
    }
    
    if (partyId === 's') {
        const searchRoute = parseSearchRouteFromHash(hash);
        const term = searchRoute?.term || '';
        return term
            ? `Buscar: ${term} - CyL 2026`
            : 'Buscar medidas - CyL 2026';
    }

    if (partyId === 'afinidad') {
        return 'Cuestionario de Afinidad - CyL 2026';
    }

    if (partyId === 'explora') {
        return 'Explora propuestas - CyL 2026';
    }

    if (partyId === 'guardadas') {
        return 'Propuestas guardadas - CyL 2026';
    }
    
    // Find party name
    const party = allPartiesCatalog.find(p => p.id === partyId) || allPartiesCatalog.find(p => p.id === normalizePartyId(partyId));
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
    const hashWithoutQuery = hash.split('?')[0];
    const parts = hashWithoutQuery.split('/').filter(p => p && p !== '#');
    const isExploraRoute = parts[0] === 'explora';

    if (!isExploraRoute) {
        storiesController.teardownForRouteLeave();
    }

    if (hash !== appState.currentHash) {
        appState.previousHash = appState.currentHash;
        appState.currentHash = hash;
    }

    if (parts.length === 0) {
        trackSpaPageView(hash);
        UI.switchView('selection');
        syncHomeSavedEntryVisibility();
        appState.selectedParty = null;
        appState.currentCategory = null;
        return;
    }

    const partyId = parts[0];

    if (partyId === 'explora') {
        const exploraSubroute = parts[1] || '';
        if (!appState.stories.returnHash) {
            appState.stories.returnHash = '#/';
        }
        appState.mode = 'stories';
        trackSpaPageView(hash);
        UI.switchView('stories');
        if (exploraSubroute === 'play') {
            if (!appState.stories.started) {
                storiesController.startFeed();
            } else {
                storiesController.renderPrototype();
            }
            return;
        }

        storiesController.resetForRouteEnter();
        storiesController.renderPrototype();
        return;
    }

    if (partyId === 'guardadas') {
        appState.mode = 'saved';
        trackSpaPageView(hash);
        UI.switchView('saved');
        renderSavedProposalsScreen();
        return;
    }

    // Check if it's comparison mode
    if (partyId === 'comparar') {
        const topicId = parts[1] || null;
        appState.mode = 'topic';
        appState.currentCategory = topicId;

        // Default selection if empty
        if (appState.selectedParties.length === 0) {
            appState.selectedParties = PARTIES.slice(0, 2).map((party) => party.id);
        }

        trackSpaPageView(hash);
        UI.switchView('topic');
        renderComparison();
        return;
    }

    // Check if it's global search mode
    if (partyId === 's') {
        appState.mode = 'search';
        const searchRoute = parseSearchRouteFromHash(hash);
        const term = searchRoute?.term || '';
        const partyFilters = searchRoute?.partyIds || [];
        const canonicalHash = searchRoute?.canonicalHash || buildSearchHash(term, partyFilters);
        if (hash !== canonicalHash) {
            UI.navigateHash(canonicalHash);
            return;
        }

        appState.searchPartyFilters = partyFilters;
        trackSpaPageView(hash);
        UI.switchView('search');
        renderSearchScreen(term);
        return;
    }

    // Check if it's afinidad mode
    if (partyId === 'afinidad') {
        const hasLegacySharedData = Boolean(parts[1]);
        appState.mode = 'afinidad';
        trackSpaPageView(hash);
        UI.switchView('afinidad');
        renderAfinidadAvailabilityIntro();

        if (hasLegacySharedData) {
            window.location.hash = '#/afinidad';
            return;
        } else {
            if (!isAfinidadEnabledForZone(appState.selectedZone)) {
                showAfinidadIntro();
                return;
            }
            // Avoid cross-module cache mismatch: inspect storage here without extra imports.
            // If completed, start flow directly; renderQuestion will restore and show results.
            let hasStoredCompletedResults = false;
            try {
                const saved = localStorage.getItem('afinidad_answers_latest');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    hasStoredCompletedResults = Boolean(parsed?.completed && parsed?.results);
                }
            } catch (err) {
                console.error('Error reading saved afinidad state:', err);
            }

            if (hasStoredCompletedResults) {
                startAfinidad();
                // Show survey when displaying saved results
                setTimeout(() => {
                    if (typeof window.showVoteImpactSurveyIfNeeded === 'function') {
                        window.showVoteImpactSurveyIfNeeded();
                    }
                }, 1000);
            } else {
                showAfinidadIntro();
            }
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
    const partyInfo = allPartiesCatalog.find(p => p.id === partyId);
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
        const unseenCount = storiesController.countUnseenStoriesForParty(partyInfo.id, data.propuestas);
        const partyZones = partyZonesMap[partyInfo.id] || [];
        const isAvailableInSelectedZone = partyZones.includes(appState.selectedZone);
        const zoneWarningText = isAvailableInSelectedZone
            ? ''
            : `Esta formación no se presenta en ${appState.selectedZone}`;
        UI.renderPartyHeader(data.metadatos, partyInfo, {
            showStoryRing: unseenCount > 0,
            zoneWarningText,
            onStoryClick: () => {
                const fallbackPartyHash = `#/${partyInfo.id}`;
                const currentHash = window.location.hash || fallbackPartyHash;
                appState.stories.returnHash = currentHash.startsWith(fallbackPartyHash) ? currentHash : fallbackPartyHash;
                storiesController.focusOnParty(partyInfo.id);
                UI.navigateHash('#/explora/play');
            }
        });
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
