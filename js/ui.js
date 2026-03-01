/**
 * UI Module - Handles DOM manipulation and rendering
 */

import { PARTIES } from './api.js';

function updateAfinidadViewportOffset() {
    const section = document.getElementById('view-afinidad');
    if (!section || section.classList.contains('hidden')) return;

    const topOffset = Math.max(section.getBoundingClientRect().top, 0);
    document.documentElement.style.setProperty('--afinidad-top-offset', `${topOffset}px`);
}

if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateAfinidadViewportOffset);
}

export const UI = {
    floatingCategoryScrollHandler: null,
    comparisonTopScrollHandler: null,
    searchTopScrollHandler: null,
    candidatePhotoKeydownHandler: null,
    lastSearchResults: [],
    lastSearchTerm: '',
    lastSearchPartyIds: [],

    // Selectors
    views: {
        selection: document.getElementById('view-party-selection'),
        search: document.getElementById('view-search'),
        detail: document.getElementById('view-party-detail'),
        topic: document.getElementById('view-topic-first'),
        stories: document.getElementById('view-explora'),
        afinidad: document.getElementById('view-afinidad')
    },
    containers: {
        parties: document.getElementById('parties-container'),
        categories: document.getElementById('categories-nav'),
        proposals: document.getElementById('proposals-container'),
        headerActions: document.getElementById('header-actions'),
        mobileFilter: document.getElementById('mobile-filter-container'),
        duelParties: document.getElementById('duel-parties-list'),
        topicsGrid: document.getElementById('topics-grid'),
        comparisonResults: document.getElementById('comparison-results'),
        storiesCard: document.getElementById('stories-card'),
        searchResults: document.getElementById('global-search-results'),
        searchSummary: document.getElementById('global-search-summary'),
        searchPartyFilters: document.getElementById('global-search-party-filters')
    },
    elements: {
        categoryName: document.getElementById('current-category-name'),
        categoryDesc: document.getElementById('current-category-description'),
        btnBack: document.getElementById('btn-back'),
        partyTitle: document.getElementById('party-title-detail'),
        partyCandidate: document.getElementById('party-candidate-detail'),
        partySlogan: document.getElementById('party-slogan-detail'),
        partyLogo: document.getElementById('party-logo-detail')
    },

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    formatCategoryShare(share = 0) {
        if (!Number.isFinite(share) || share <= 0) return '0%';
        const rounded = Math.round(share * 10) / 10;
        if (Number.isInteger(rounded)) return `${rounded}%`;
        return `${rounded.toFixed(1).replace('.', ',')}%`;
    },

    normalizeTagSearchTerm(tag = '') {
        return String(tag)
            .replace(/^#+/, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    renderTagSearchLink(tag) {
        const rawTag = String(tag || '').trim();
        const searchTerm = this.normalizeTagSearchTerm(rawTag);

        if (!searchTerm) {
            return `<span class="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-medium rounded">${this.escapeHtml(rawTag)}</span>`;
        }

        return `
            <a href="#/s/${encodeURIComponent(searchTerm)}"
               class="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-medium rounded hover:bg-slate-200 hover:text-slate-700 transition-colors"
               aria-label="Buscar por etiqueta ${this.escapeHtml(searchTerm)}"
               title="Buscar ${this.escapeHtml(searchTerm)}">
                ${this.escapeHtml(rawTag)}
            </a>
        `;
    },

    ensureCandidatePhotoModal() {
        let modal = document.getElementById('candidate-photo-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'candidate-photo-modal';
        modal.className = 'fixed inset-0 z-[90] hidden';
        modal.innerHTML = `
            <div class="candidate-photo-backdrop absolute inset-0 bg-slate-900/75"></div>
            <div class="absolute inset-0 flex items-center justify-center p-4">
                <div class="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                        <p id="candidate-photo-modal-name" class="text-sm sm:text-base font-semibold text-slate-800 pr-4"></p>
                        <button type="button" id="candidate-photo-modal-close" class="w-8 h-8 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors" aria-label="Cerrar diálogo">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="bg-slate-100">
                        <img id="candidate-photo-modal-image" src="" alt="" class="w-full h-auto max-h-[70vh] object-contain">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => this.closeCandidatePhotoModal();
        modal.querySelector('.candidate-photo-backdrop')?.addEventListener('click', closeModal);
        modal.querySelector('#candidate-photo-modal-close')?.addEventListener('click', closeModal);

        if (!this.candidatePhotoKeydownHandler) {
            this.candidatePhotoKeydownHandler = (event) => {
                if (event.key === 'Escape') this.closeCandidatePhotoModal();
            };
            window.addEventListener('keydown', this.candidatePhotoKeydownHandler);
        }

        return modal;
    },

    openCandidatePhotoModal(photoSrc, candidateName) {
        if (!photoSrc) return;
        const modal = this.ensureCandidatePhotoModal();
        const img = modal.querySelector('#candidate-photo-modal-image');
        const nameEl = modal.querySelector('#candidate-photo-modal-name');

        if (img) {
            img.src = photoSrc;
            img.alt = `Foto de ${candidateName || 'candidato'}`;
        }
        if (nameEl) {
            nameEl.textContent = candidateName || 'Candidato';
        }

        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    },

    closeCandidatePhotoModal() {
        const modal = document.getElementById('candidate-photo-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    },

    navigateHash(hash) {
        if (!hash) return;

        // Some mobile browsers can restore DOM/view state with a stale hash.
        // If the target hash is already set, force router execution.
        if (window.location.hash === hash) {
            window.dispatchEvent(new Event('hashchange'));
            return;
        }

        window.location.hash = hash;
    },

    scrollToCategoryHeader(behavior = 'smooth') {
        const header = document.getElementById('category-header');
        if (!header) return;

        const stickyBar = document.getElementById('sticky-party-identity');
        const stickyOffset = stickyBar && !stickyBar.classList.contains('-translate-y-full') ? stickyBar.offsetHeight : 0;
        const targetTop = header.getBoundingClientRect().top + window.scrollY - stickyOffset - 12;

        window.scrollTo({
            top: Math.max(targetTop, 0),
            behavior
        });
    },

    // Methods
    renderPartySelection() {
        // Create a copy and shuffle for fairness
        const shuffledParties = [...PARTIES].sort(() => Math.random() - 0.5);
        const storiesPreview = document.getElementById('explora-stories-preview');
        if (storiesPreview) {
            const previewParties = shuffledParties.slice(0, 5);
            storiesPreview.innerHTML = previewParties.map((party) => `
                <span class="story-ring-icon"><img src="${this.escapeHtml(party.logo)}" alt=""></span>
            `).join('');
        }

        this.containers.parties.innerHTML = shuffledParties.map(party => `
            <a href="#/${party.id}" class="party-card bg-white p-6 rounded-2xl border border-slate-100 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col items-center justify-center text-center" 
               data-party-id="${party.id}" aria-label="Ver programa de ${this.escapeHtml(party.name)}">
                <div class="w-16 h-16 md:w-24 md:h-24 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 overflow-hidden shadow-sm border border-slate-50" 
                     style="background-color: white">
                    <img src="${party.logo}" alt="Logo ${party.name}" class="w-full h-full object-contain p-2">
                </div>
                <h3 class="text-lg md:text-xl font-bold text-slate-800">${party.name}</h3>
            </a>
        `).join('');
    },

    renderGlobalSearch(term, results, options = {}) {
        const selectedPartyIds = Array.isArray(options.selectedPartyIds) ? options.selectedPartyIds : [];
        const partyMatchCounts = options.partyMatchCounts && typeof options.partyMatchCounts === 'object'
            ? options.partyMatchCounts
            : {};
        const onTogglePartyFilter = typeof options.onTogglePartyFilter === 'function'
            ? options.onTogglePartyFilter
            : null;
        const onClearPartyFilters = typeof options.onClearPartyFilters === 'function'
            ? options.onClearPartyFilters
            : null;

        this.setupSearchTopButton();
        this.lastSearchResults = results;
        this.lastSearchTerm = term || '';
        this.lastSearchPartyIds = selectedPartyIds;
        const input = document.getElementById('global-search-input');
        if (input) input.value = term || '';
        const shareSearchBtn = document.getElementById('btn-share-search-query');
        if (shareSearchBtn) {
            shareSearchBtn.classList.toggle('hidden', !term);
        }

        if (this.containers.searchPartyFilters) {
            const selectedLabels = PARTIES
                .filter((party) => selectedPartyIds.includes(party.id))
                .map((party) => party.name);

            const clearButton = selectedPartyIds.length > 0 ? `
                <button class="search-party-filter-clear px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors">
                    Quitar filtros
                </button>
            ` : '';

            this.containers.searchPartyFilters.innerHTML = `
                <p class="w-full text-xs text-slate-500 mb-1">Filtrar por partido</p>
                ${PARTIES.map((party) => {
                    const isActive = selectedPartyIds.includes(party.id);
                    const matchCount = Number.isFinite(partyMatchCounts[party.id]) ? partyMatchCounts[party.id] : 0;
                    return `
                        <button
                            class="search-party-filter-btn px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors inline-flex items-center gap-2 ${isActive ? 'text-white border-transparent' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:text-slate-800'}"
                            style="${isActive ? `background-color: ${this.escapeHtml(party.color)};` : ''}"
                            data-party-id="${party.id}">
                            <span class="party-logo-bubble w-4 h-4 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                <img src="${this.escapeHtml(party.logo)}" alt="Logo ${this.escapeHtml(party.name)}" class="party-logo-bubble-img">
                            </span>
                            <span>${this.escapeHtml(party.name)} (${this.escapeHtml(String(matchCount))})</span>
                        </button>
                    `;
                }).join('')}
                ${clearButton}
                ${selectedLabels.length > 0 ? `<p class="w-full text-xs text-slate-400 mt-1">Filtrando por: ${this.escapeHtml(selectedLabels.join(', '))}</p>` : ''}
            `;

            this.containers.searchPartyFilters.querySelectorAll('.search-party-filter-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    if (!onTogglePartyFilter) return;
                    onTogglePartyFilter(btn.dataset.partyId);
                });
            });

            const clearBtn = this.containers.searchPartyFilters.querySelector('.search-party-filter-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (!onClearPartyFilters) return;
                    onClearPartyFilters();
                });
            }
        }

        if (!term) {
            this.containers.searchSummary.textContent = 'Escribe un término y pulsa Enter para buscar en todos los programas.';
            this.containers.searchResults.innerHTML = `
                <div class="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">
                    Prueba con: vivienda, ambulancias, IRPF rural, macrogranjas
                </div>
            `;
            return;
        }

        const withFiltersText = selectedPartyIds.length > 0 ? ' con filtros' : '';
        this.containers.searchSummary.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'} para "${term}"${withFiltersText}`;

        if (results.length === 0) {
            this.containers.searchResults.innerHTML = `
                <div class="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">
                    No hay resultados para "${this.escapeHtml(term)}". Prueba con otra palabra.
                </div>
            `;
            return;
        }

        this.containers.searchResults.innerHTML = results.map((item, index) => `
            <div class="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-slate-300 transition-all">
                <a href="#/${item.partyId}/${encodeURIComponent(item.category)}/${item.proposalId}" class="block">
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                        <span class="text-xs font-semibold px-2 py-1 rounded-full" style="background-color: ${this.escapeHtml(item.partyColor)}20; color: ${this.escapeHtml(item.partyColor)};">
                            ${this.escapeHtml(item.partyName)}
                        </span>
                        <span class="text-xs text-slate-500">${this.escapeHtml(item.category)}</span>
                    </div>
                    <h3 class="text-lg font-semibold text-slate-800 mb-1">${this.escapeHtml(item.title)}</h3>
                    <p class="text-sm text-slate-600 leading-relaxed">${this.escapeHtml(item.summary)}</p>
                </a>
                <div class="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <button class="btn-share-search w-8 h-8 rounded-full text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center"
                        data-result-index="${index}" aria-label="Compartir resultado de búsqueda" title="Compartir resultado">
                        <i class="fa-solid fa-share-nodes text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.containers.searchResults.querySelectorAll('.btn-share-search').forEach((btn) => {
            btn.addEventListener('click', () => {
                const index = Number(btn.dataset.resultIndex);
                const item = this.lastSearchResults[index];
                if (!item) return;
                this.shareSearchResult(item, btn);
            });
        });
    },

    async shareSearchResult(item, btn) {
        const url = `${window.location.origin}${window.location.pathname}#/${item.partyId}/${encodeURIComponent(item.category)}/${item.proposalId}`;
        const header = `El ${item.partyName} en CyL propone "${item.title}"`;
        const summary = (item.summary || '').trim();
        const shareText = summary
            ? `${header}\n\n${summary}\n\n${url}`
            : `${header}\n\n${url}`;
        const fullMessage = shareText;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${item.partyName} propone: ${item.title}`,
                    text: shareText,
                    url
                });
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error sharing search result:', err);
            }
            return;
        }

        try {
            await navigator.clipboard.writeText(fullMessage);
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check text-emerald-500"></i> <span class="text-emerald-600">Copiado</span>';
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        } catch (err) {
            console.error('Failed to copy search result: ', err);
        }
    },

    async shareSearchTerm(btn) {
        const term = this.lastSearchTerm;
        if (!term) return;

        const selectedNames = PARTIES
            .filter((party) => this.lastSearchPartyIds.includes(party.id))
            .map((party) => party.name);

        const url = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
        const scopeText = selectedNames.length > 0 ? ` (${selectedNames.join(', ')})` : '';
        const shareText = `Qué dicen sobre "${term}"${scopeText} en las elecciones a las Cortes de CyL 2026:\n\n${url}`;
        const fullMessage = shareText;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Búsqueda: ${term} | CyL 2026`,
                    text: shareText,
                    url
                });
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error sharing search query:', err);
            }
            return;
        }

        try {
            await navigator.clipboard.writeText(fullMessage);
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check text-emerald-500"></i> <span class="text-emerald-600">Copiado</span>';
                setTimeout(() => { btn.innerHTML = originalText; }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy search query: ', err);
        }
    },

    setupSearchTopButton() {
        let btn = document.getElementById('floating-search-top-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'floating-search-top-btn';
            btn.className = 'fixed bottom-6 right-6 w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg z-[70] transition-all duration-300 opacity-0 translate-y-full flex items-center justify-center hover:bg-slate-800';
            btn.setAttribute('aria-label', 'Subir al inicio de resultados');
            btn.setAttribute('title', 'Subir arriba');
            btn.innerHTML = '<i class="fa-solid fa-arrow-up text-sm"></i>';
            btn.style.bottom = 'calc(1rem + env(safe-area-inset-bottom))';
            btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            document.body.appendChild(btn);
        }

        if (this.searchTopScrollHandler) {
            window.removeEventListener('scroll', this.searchTopScrollHandler);
        }

        this.searchTopScrollHandler = () => {
            const shouldShow = window.scrollY > 140;
            btn.classList.toggle('opacity-100', shouldShow);
            btn.classList.toggle('translate-y-0', shouldShow);
            btn.classList.toggle('opacity-0', !shouldShow);
            btn.classList.toggle('translate-y-full', !shouldShow);
        };

        window.addEventListener('scroll', this.searchTopScrollHandler);
        this.searchTopScrollHandler();
    },

    renderPartyHeader(metadata, partyInfo, options = {}) {
        const { showStoryRing = false, onStoryClick = null } = options;
        this.elements.partyTitle.textContent = partyInfo.name;
        const partyColor = partyInfo.color || metadata.color || '#334155';
        this.elements.partyTitle.style.color = partyColor;
        // Keep heading in DOM for accessibility/SEO, but avoid visual duplication with the logo.
        this.elements.partyTitle.classList.add('sr-only');

        // Show candidate name, and coalition if it exists
        let candidateText = metadata.candidato;
        if (metadata.coalicion) {
            candidateText += ` • ${metadata.coalicion}`;
        }
        const candidatePhoto = metadata.foto_candidato || partyInfo.candidatePhoto;
        if (candidatePhoto) {
            this.elements.partyCandidate.innerHTML = `
                <button type="button" class="candidate-photo-trigger w-9 h-9 rounded-full overflow-hidden border border-slate-200 shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity" aria-label="Ver foto de ${this.escapeHtml(metadata.candidato || partyInfo.name)} a tamaño completo">
                    <img src="${this.escapeHtml(candidatePhoto)}" alt="Foto de ${this.escapeHtml(metadata.candidato || partyInfo.name)}" class="w-full h-full object-cover">
                </button>
                <span>${this.escapeHtml(candidateText)}</span>
            `;
            const trigger = this.elements.partyCandidate.querySelector('.candidate-photo-trigger');
            if (trigger) {
                trigger.addEventListener('click', () => this.openCandidatePhotoModal(candidatePhoto, metadata.candidato || partyInfo.name));
            }
        } else {
            this.elements.partyCandidate.innerHTML = `
                <i class="fa-solid fa-user-circle text-slate-400"></i>
                <span>${this.escapeHtml(candidateText)}</span>
            `;
        }
        
        this.elements.partySlogan.textContent = metadata.lema ? `"${metadata.lema}"` : '';

        this.elements.partyLogo.innerHTML = `<img src="${partyInfo.logo}" alt="Logo ${partyInfo.name}" class="w-full h-full object-contain p-2">`;
        this.elements.partyLogo.style.backgroundColor = showStoryRing ? 'transparent' : 'white';
        this.elements.partyLogo.style.border = showStoryRing ? 'none' : `2px solid ${partyColor}20`;
        this.elements.partyLogo.classList.add('overflow-hidden');
        this.elements.partyLogo.classList.toggle('party-story-ring', showStoryRing);

        this.elements.partyLogo.onclick = null;
        this.elements.partyLogo.onkeydown = null;
        if (typeof onStoryClick === 'function') {
            this.elements.partyLogo.classList.add('cursor-pointer');
            this.elements.partyLogo.setAttribute('role', 'button');
            this.elements.partyLogo.setAttribute('tabindex', '0');
            this.elements.partyLogo.setAttribute('aria-label', `Ver stories de ${partyInfo.name}`);
            this.elements.partyLogo.onclick = () => onStoryClick();
            this.elements.partyLogo.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onStoryClick();
                }
            };
        } else {
            this.elements.partyLogo.classList.remove('cursor-pointer');
            this.elements.partyLogo.removeAttribute('role');
            this.elements.partyLogo.removeAttribute('tabindex');
            this.elements.partyLogo.removeAttribute('aria-label');
        }

        // Add link to complete program
        const programLinkContainer = document.getElementById('party-program-link');
        if (programLinkContainer) {
            programLinkContainer.innerHTML = `
                <a href="programas/${partyInfo.id}.pdf" target="_blank" 
                   class="inline-flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                    <i class="fa-solid fa-file-pdf"></i>
                    Programa en PDF
                </a>
            `;
        }
    },

    renderCategories(categories, activeCategory, onSelect) {
        this.containers.categories.innerHTML = categories.map(cat => `
            <button class="category-item w-full text-left px-4 py-3 rounded-xl text-sm ${cat === activeCategory ? 'active' : 'text-slate-500 hover:text-slate-800'}" 
                    data-category="${cat}">
                ${cat}
            </button>
        `).join('');

        // Selection event
        this.containers.categories.querySelectorAll('.category-item').forEach(btn => {
            btn.addEventListener('click', () => onSelect(btn.dataset.category));
        });

        // Initialize mobile filter button if not done
        this.setupMobileFilter(categories, activeCategory, onSelect);
    },

    renderProposals(proposals, category, partyInfo, categories, onSelect) {
        let filtered;
        if (!category) {
            filtered = proposals;
            this.elements.categoryName.textContent = "Programa Completo";
            this.elements.categoryDesc.textContent = `Explorando las ${proposals.length} propuestas de ${partyInfo.name}.`;
        } else {
            filtered = proposals.filter(p => p.categoria === category);
            this.elements.categoryName.textContent = category;
            this.elements.categoryDesc.textContent = `${filtered.length} propuestas encontradas en esta sección.`;
        }

        let html = '';
        if (!category) {
            const categories = [...new Set(filtered.map(p => p.categoria))];
            categories.forEach(cat => {
                const catProps = filtered.filter(p => p.categoria === cat);
                html += `
                    <div class="category-group mb-12">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <span class="w-8 h-px bg-slate-200"></span>
                            ${cat}
                        </h3>
                        <div class="grid gap-6">
                            ${catProps.map(prop => this.createProposalHTML(prop, partyInfo)).join('')}
                        </div>
                    </div>
                `;
            });
        } else {
            html = `<div class="grid gap-6">${filtered.map(prop => this.createProposalHTML(prop, partyInfo)).join('')}</div>`;
        }

        this.containers.proposals.innerHTML = html;

        // Attach events
        this.containers.proposals.querySelectorAll('.btn-toggle-quote').forEach(btn => {
            btn.addEventListener('click', () => this.toggleQuote(btn.dataset.id, btn));
        });

        this.containers.proposals.querySelectorAll('.btn-share').forEach(btn => {
            const propId = btn.dataset.id;
            const prop = filtered.find(p => p.id == propId);
            btn.addEventListener('click', () => this.shareProposal(partyInfo, category || 'Todas', prop, btn));
        });

        this.renderStickyIdentity(partyInfo);
        this.updateMobileFilterLabel(category);
        this.renderFloatingCategoryNavigation(categories, category, onSelect);
    },

    createProposalHTML(prop, partyInfo) {
        return `
            <article class="proposal-card bg-white p-8 rounded-2xl border border-slate-100 fade-in shadow-sm hover:shadow-md" id="prop-${prop.id}">
                <div class="mb-6">
                    <h4 class="text-xl font-bold text-slate-800 leading-snug">${prop.titulo_corto}</h4>
                </div>
                <p class="text-slate-600 mb-8 leading-relaxed font-light">${prop.resumen}</p>
                <div class="flex flex-col gap-4">
                    <div class="quote-section overflow-hidden transition-all duration-300 max-h-0" id="quote-${prop.id}">
                        <div class="bg-slate-50 p-6 rounded-xl border-l-4 mb-2" style="border-color: ${partyInfo.color}50">
                            <p class="text-sm italic text-slate-500 mb-4 leading-relaxed font-serif">"${prop.cita_literal}"</p>
                            <div class="flex justify-between items-center text-xs">
                                <span class="text-slate-400">Fuente: Programa Electoral 2026</span>
                                <a href="programas/${partyInfo.id}.pdf#page=${prop.pagina}" target="_blank" 
                                   class="font-bold px-2 py-1 bg-white border border-slate-200 rounded text-blue-600 hover:bg-blue-50 transition-colors">
                                    Ver PDF (Pág. ${prop.pagina}) <i class="fa-solid fa-up-right-from-square ml-1 text-[10px]"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
                        <div class="flex flex-wrap items-center gap-3">
                            ${this.renderCompetenceBadge(prop.analisis.competencia)}
                            <div class="h-3 w-px bg-slate-200 mx-1 mobile-hidden"></div>
                            <div class="flex flex-wrap gap-2">
                                ${prop.analisis?.foco_rural ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-600" title="Foco rural"><i class="fa-solid fa-tractor text-[10px]"></i><span class="sr-only">Foco rural</span></span>' : ''}
                                ${prop.tags.map((tag) => this.renderTagSearchLink(tag)).join('')}
                            </div>
                        </div>
                        <div class="flex gap-3">
                            <button class="btn-toggle-quote text-slate-400 hover:text-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors" data-id="${prop.id}">
                                <i class="fa-solid fa-quote-left text-[10px]"></i>
                                <span>Ver</span>
                            </button>
                            <button class="btn-share text-slate-400 hover:text-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors" data-id="${prop.id}">
                                <i class="fa-solid fa-share-nodes text-[10px]"></i>
                                <span>Compartir</span>
                            </button>
                        </div>
                    </div>
                </div>
            </article>
        `;
    },

    renderCompetenceBadge(competence) {
        if (!competence) return '';
        const c = competence.toLowerCase();
        let config = { icon: 'fa-circle-check', color: 'text-emerald-500', text: 'Regional' };
        if (c.includes('compartida') || c.includes('coordinada') || c.includes('shared')) {
            config = { icon: 'fa-circle-nodes', color: 'text-amber-500', text: 'Compartida' };
        } else if (c.includes('petición') || c.includes('petition') || c.includes('estatal')) {
            config = { icon: 'fa-circle-arrow-up', color: 'text-rose-500', text: 'Estatal' };
        }
        return `
            <div class="flex items-center gap-1.5" title="Competencia ${config.text}">
                <i class="fa-solid ${config.icon} ${config.color} text-[10px]"></i>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Comp. ${config.text}</span>
            </div>
        `;
    },

    isRegionalCompetence(competence) {
        if (!competence) return false;
        const c = competence.toLowerCase();
        return c.includes('directa') || c.includes('propia') || c.includes('regional');
    },

    renderFloatingCategoryNavigation(categories, activeCategory, onSelect) {
        // Remove existing floating button
        const existing = document.getElementById('floating-category-btn');
        if (existing) existing.remove();
        const existingDropdown = document.getElementById('category-dropdown');
        if (existingDropdown) existingDropdown.remove();
        if (this.floatingCategoryScrollHandler) {
            window.removeEventListener('scroll', this.floatingCategoryScrollHandler);
            this.floatingCategoryScrollHandler = null;
        }

        if (!categories || categories.length <= 1) return;

        // Don't add "Todas" if it's already in the list
        const allCategories = categories.includes('Todas') ? categories : ['Todas', ...categories];
        const currentActiveCategory = activeCategory || 'Todas';

        // Create floating button
        const floatingBtn = document.createElement('button');
        floatingBtn.id = 'floating-category-btn';
        floatingBtn.className = 'fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg border border-slate-200 z-[60] transition-all duration-300 opacity-0 translate-y-full flex items-center justify-center hover:bg-slate-800 hover:scale-110';
        floatingBtn.innerHTML = `
            <i class="fa-solid fa-layer-group text-lg"></i>
        `;

        document.body.appendChild(floatingBtn);

        // Setup scroll behavior
        let scrollTimeout;
        const showFloatingBtn = () => {
            clearTimeout(scrollTimeout);
            if (window.scrollY > 200) {
                floatingBtn.classList.remove('opacity-0', 'translate-y-full');
                floatingBtn.classList.add('opacity-100', 'translate-y-0');
            } else {
                floatingBtn.classList.add('opacity-0', 'translate-y-full');
                floatingBtn.classList.remove('opacity-100', 'translate-y-0');
            }
            
            scrollTimeout = setTimeout(() => {
                if (window.scrollY > 200) {
                    floatingBtn.classList.add('opacity-100', 'translate-y-0');
                    floatingBtn.classList.remove('opacity-0', 'translate-y-full');
                }
            }, 150);
        };

        this.floatingCategoryScrollHandler = showFloatingBtn;
        window.addEventListener('scroll', this.floatingCategoryScrollHandler);
        
        // Initial check
        showFloatingBtn();

        // Setup category dropdown on click
        floatingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove existing dropdown
            const existingDropdown = document.getElementById('category-dropdown');
            if (existingDropdown) existingDropdown.remove();

            // Create dropdown
            const dropdown = document.createElement('div');
            dropdown.id = 'category-dropdown';
            dropdown.className = 'fixed bottom-24 right-6 bg-white border border-slate-200 rounded-2xl shadow-xl z-[70] max-h-80 overflow-y-auto min-w-48';
            
            const dropdownHTML = allCategories.map(cat => {
                const isActive = cat === currentActiveCategory;
                return `
                    <button class="category-dropdown-item w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                        isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700'
                    }" data-category="${cat}">
                        <span>${cat}</span>
                        ${isActive ? '<i class="fa-solid fa-check text-slate-400"></i>' : ''}
                    </button>
                `;
            }).join('');

            dropdown.innerHTML = dropdownHTML;
            document.body.appendChild(dropdown);

            // Setup category selection
            dropdown.querySelectorAll('.category-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const selectedCategory = item.dataset.category;
                    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
                    const didChangeCategory = selectedCategory !== currentActiveCategory;

                    onSelect(selectedCategory);
                    dropdown.remove();

                    if (isMobile && didChangeCategory) {
                        setTimeout(() => this.scrollToCategoryHeader('smooth'), 120);
                    }
                });
            });

            // Close dropdown when clicking outside
            const closeDropdown = (e) => {
                if (!dropdown.contains(e.target) && e.target !== floatingBtn) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeDropdown);
            }, 100);
        });
    },

    renderStickyIdentity(partyInfo) {
        let bar = document.getElementById('sticky-party-identity');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'sticky-party-identity';
            bar.className = 'fixed top-0 left-0 right-0 bg-white shadow-md z-50 transform -translate-y-full transition-transform duration-300 border-b border-slate-100';
            document.body.appendChild(bar);
        }

        bar.innerHTML = `
            <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <img src="${partyInfo.logo}" alt="Logo ${partyInfo.name}" class="h-10 object-contain">
                    <span class="font-bold text-slate-800">${partyInfo.name}</span>
                </div>
                <button onclick="window.scrollTo({top: 0, behavior: 'smooth'})" class="text-xs text-slate-400 hover:text-slate-800 font-medium"> Subir al inicio </button>
            </div>
        `;

        window.onscroll = () => {
            const bar = document.getElementById('sticky-party-identity');
            if (bar) {
                if (window.scrollY > 300) {
                    bar.classList.remove('-translate-y-full');
                } else {
                    bar.classList.add('-translate-y-full');
                }
            }
        };
    },

    updateMobileFilterLabel(category) {
        const span = document.querySelector('#btn-mobile-filter span');
        if (span) span.textContent = (category === 'Todas' || !category) ? 'Categorías' : category;
    },

    setupMobileFilter(categories, activeCategory, onSelect) {
        const btn = document.getElementById('btn-mobile-filter');
        if (!btn) return;

        // Clean up previous overlay if exists
        const oldOverlay = document.getElementById('mobile-filter-overlay');
        if (oldOverlay) oldOverlay.remove();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'mobile-filter-overlay';
        overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] hidden flex-col justify-end';
        overlay.innerHTML = `
            <div class="bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto transform translate-y-full transition-transform duration-300">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-slate-800">Filtrar categorías</h3>
                    <button id="close-filter" class="p-2 text-slate-400 hover:text-slate-800">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>
                <div class="grid gap-2">
                    ${categories.map(cat => `
                        <button class="filter-option w-full text-left p-4 rounded-xl border ${cat === activeCategory ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-600'}"
                                data-category="${cat}">
                            ${cat}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        btn.onclick = () => {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            setTimeout(() => {
                overlay.querySelector('div').classList.remove('translate-y-full');
            }, 10);
        };

        const close = () => {
            overlay.querySelector('div').classList.add('translate-y-full');
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
            }, 300);
        };

        document.getElementById('close-filter').onclick = close;
        overlay.querySelectorAll('.filter-option').forEach(opt => {
            opt.onclick = () => {
                onSelect(opt.dataset.category);
                close();
            };
        });
    },

    toggleQuote(id, btn) {
        const quoteId = String(id).startsWith('quote-') ? String(id) : `quote-${id}`;
        const quoteDiv = document.getElementById(quoteId);
        if (!quoteDiv) return;
        const isHidden = quoteDiv.style.maxHeight === '0px' || !quoteDiv.style.maxHeight || quoteDiv.style.maxHeight === '0';
        if (isHidden) {
            quoteDiv.style.maxHeight = '500px';
            btn.querySelector('span').textContent = 'Ocultar';
            btn.classList.add('text-slate-800');
        } else {
            quoteDiv.style.maxHeight = '0';
            btn.querySelector('span').textContent = 'Ver';
            btn.classList.remove('text-slate-800');
        }
    },

    trackStoryShareEvent(partyInfo, category, prop, method) {
        if (typeof _paq === 'undefined') return;
        const partyId = String(partyInfo?.id || 'unknown');
        const proposalId = String(prop?.id || 'unknown');
        const categoryName = String(category || 'General');
        const shareMethod = String(method || 'unknown');
        const label = `${partyId}|${proposalId}|${categoryName}|${shareMethod}`;
        _paq.push(['trackEvent', 'Explora Stories', 'Compartir', label, 1]);
    },

    async shareProposal(partyInfo, category, prop, btn, options = {}) {
        const surface = String(options?.surface || '');
        const url = `${window.location.origin}${window.location.pathname}#/${partyInfo.id}/${encodeURIComponent(category)}/${prop.id}`;
        const header = `${partyInfo.name} en Castilla y León propone "${prop.titulo_corto}"`;
        const summary = (prop.resumen || '').trim();
        const shareTextWithUrl = summary
            ? `${header}\n\n${summary}\n\n${url}`
            : `${header}\n\n${url}`;
        const shareText = summary
            ? `${header}\n\n${summary}`
            : header;
        const fullMessage = shareTextWithUrl;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Propuesta de ${partyInfo.name}`,
                    text: shareText,
                    url: url
                });
                if (surface === 'stories') {
                    this.trackStoryShareEvent(partyInfo, category, prop, 'web_share');
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error sharing:', err);
            }
        } else {
            // Fallback to clipboard
            try {
                await navigator.clipboard.writeText(fullMessage);
                if (surface === 'stories') {
                    this.trackStoryShareEvent(partyInfo, category, prop, 'clipboard');
                }
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check text-emerald-500"></i> <span class="text-emerald-600">Copiado</span>';
                setTimeout(() => { btn.innerHTML = originalText; }, 2000);
            } catch (err) {
                console.error('Failed to copy: ', err);
            }
        }
    },

    switchView(viewName) {
        document.body.classList.remove('afinidad-layout');
        document.body.classList.remove('home-view');
        document.body.classList.remove('explora-layout');
        const globalSearchBtn = document.getElementById('btn-global-search');
        if (globalSearchBtn) {
            globalSearchBtn.classList.toggle('hidden', viewName === 'search');
        }

        const stickyBar = document.getElementById('sticky-party-identity');
        const mobileFilter = document.getElementById('mobile-filter-container');
        const duelSelector = document.getElementById('duel-selector-container');
        const floatingNav = document.getElementById('floating-category-nav');

        // Sticky party header only exists in detail view.
        if (viewName !== 'detail') {
            if (stickyBar) stickyBar.remove();
            window.onscroll = null;
            const floatingBtn = document.getElementById('floating-category-btn');
            if (floatingBtn) floatingBtn.remove();
            const floatingDropdown = document.getElementById('category-dropdown');
            if (floatingDropdown) floatingDropdown.remove();
            if (this.floatingCategoryScrollHandler) {
                window.removeEventListener('scroll', this.floatingCategoryScrollHandler);
                this.floatingCategoryScrollHandler = null;
            }
        }

        if (viewName !== 'topic') {
            const comparisonTopBtn = document.getElementById('floating-comparison-top-btn');
            if (comparisonTopBtn) comparisonTopBtn.remove();
            if (this.comparisonTopScrollHandler) {
                window.removeEventListener('scroll', this.comparisonTopScrollHandler);
                this.comparisonTopScrollHandler = null;
            }
        }

        if (viewName !== 'search') {
            const searchTopBtn = document.getElementById('floating-search-top-btn');
            if (searchTopBtn) searchTopBtn.remove();
            if (this.searchTopScrollHandler) {
                window.removeEventListener('scroll', this.searchTopScrollHandler);
                this.searchTopScrollHandler = null;
            }
        }

        // Hide all views first
        Object.values(this.views).forEach(view => view?.classList.add('hidden'));

        // Clean up floating navigation when leaving detail view
        if (floatingNav && viewName !== 'detail') {
            floatingNav.remove();
        }

        if (viewName === 'selection') {
            document.body.classList.add('home-view');
            this.views.selection.classList.remove('hidden');
            this.elements.btnBack.classList.add('hidden');
            if (stickyBar) stickyBar.classList.add('-translate-y-full');
            if (mobileFilter) mobileFilter.classList.add('hidden');
        } else if (viewName === 'search') {
            this.views.search.classList.remove('hidden');
            this.elements.btnBack.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.add('hidden');
            window.scrollTo(0, 0);
            const searchInput = document.getElementById('global-search-input');
            if (searchInput) {
                requestAnimationFrame(() => searchInput.focus());
            }
        } else if (viewName === 'detail') {
            this.views.detail.classList.remove('hidden');
            this.elements.btnBack.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.remove('hidden');
            window.scrollTo(0, 0);
        } else if (viewName === 'topic') {
            this.views.topic.classList.remove('hidden');
            this.elements.btnBack.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.add('hidden');
            window.scrollTo(0, 0);
        } else if (viewName === 'stories') {
            this.views.stories.classList.remove('hidden');
            this.elements.btnBack.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.add('hidden');
            document.body.classList.add('explora-layout');
            window.scrollTo(0, 0);
        } else if (viewName === 'afinidad') {
            this.views.afinidad.classList.remove('hidden');
            this.elements.btnBack.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.add('hidden');
            document.body.classList.add('afinidad-layout');

            window.scrollTo(0, 0);
            requestAnimationFrame(updateAfinidadViewportOffset);
        }
    },
    // --- Comparison Specific Methods ---

    renderComparison(allData, selectedIds, currentCategory, filters, allCategories) {
        this.setupComparisonTopButton();

        const isMobile = window.matchMedia('(max-width: 1023px)').matches;
        const comparisonIds = isMobile ? selectedIds.slice(0, 2) : selectedIds;

        // 1. Render Party Selector (Duel)
        this.renderDuelSelector(comparisonIds);

        // 2. Render Topics Grid
        this.renderTopicsGrid(allCategories, currentCategory?.id);

        // 3. Render Filters state
        this.updateFilterButtons(filters);

        // 4. Render Results
        if (!currentCategory) {
            this.containers.comparisonResults.innerHTML = `
                <div class="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                    <i class="fa-solid fa-arrow-up text-4xl text-slate-200 mb-4"></i>
                    <p class="text-slate-500 font-light">Selecciona un tema arriba para comparar medidas</p>
                </div>
            `;
            return;
        }

        const categoryName = currentCategory.name;

        // 6. Build Contrast Grid - Direct to proposals, no redundant header
        const gridClass = isMobile ? 'contrast-grid mobile-two-col' : 'contrast-grid';
        let html = `<div class="${gridClass}" style="--cols: ${comparisonIds.length}">`;

        comparisonIds.forEach((partyId, index) => {
            const partyInfo = PARTIES.find(p => p.id === partyId);
            const proposals = allData[partyId]?.propuestas || [];
            const categoryProposalCount = proposals.filter(p => p.categoria === categoryName).length;
            const categoryShare = proposals.length > 0 ? (categoryProposalCount / proposals.length) * 100 : 0;
            const categoryShareLabel = this.formatCategoryShare(categoryShare);

            // Apply Topic Filter
            let filtered = proposals.filter(p => p.categoria === categoryName);

            // Apply Quality Filters
            if (filters.rural) filtered = filtered.filter(p => p.analisis.foco_rural);
            if (filters.competition) filtered = filtered.filter(p => this.isRegionalCompetence(p.analisis?.competencia));
            if (filters.query) {
                filtered = filtered.filter(p =>
                    p.titulo_corto.toLowerCase().includes(filters.query) ||
                    p.resumen.toLowerCase().includes(filters.query) ||
                    p.tags.some(t => t.toLowerCase().includes(filters.query))
                );
            }

            html += `
                <div class="party-comparison-col" data-party-col="${partyId}" data-party-index="${index}" style="--party-color: ${partyInfo.color}">
                    <div class="space-y-6">
                        <header class="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
                            <div class="flex items-center gap-2.5 mb-2">
                                <span class="party-logo-bubble w-7 h-7 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                    <img src="${this.escapeHtml(partyInfo.logo)}" alt="Logo ${this.escapeHtml(partyInfo.name)}" class="party-logo-bubble-img">
                                </span>
                                <p class="text-sm font-bold text-slate-800">${this.escapeHtml(partyInfo.name)}</p>
                            </div>
                            <p class="text-xs text-slate-600">
                                <span class="font-semibold text-slate-800">${categoryShareLabel}</span> de sus propuestas están en esta categoría
                                <span class="text-slate-400">(${categoryProposalCount}/${proposals.length})</span>
                            </p>
                        </header>
                        ${filtered.length > 0 ?
                    filtered.map(prop => this.createComparisonCardHTML(prop, partyInfo, { compact: isMobile, categoryName })).join('') :
                    `<div class="p-8 rounded-2xl bg-slate-50 text-slate-400 text-xs text-center border border-dashed border-slate-200">No hay medidas con estos filtros</div>`
                }
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        this.containers.comparisonResults.innerHTML = html;

        // Attach quote toggle events
        this.containers.comparisonResults.querySelectorAll('.btn-toggle-quote').forEach(btn => {
            btn.addEventListener('click', () => this.toggleQuote(btn.dataset.quoteId || btn.dataset.id, btn));
        });

        // Attach share events
        this.containers.comparisonResults.querySelectorAll('.btn-share').forEach(btn => {
            const partyId = btn.dataset.party;
            const partyInfo = PARTIES.find(p => p.id === partyId);
            const propId = btn.dataset.id;
            const prop = allData[partyId]?.propuestas?.find(p => p.id == propId);
            btn.addEventListener('click', () => this.shareProposal(partyInfo, currentCategory?.name || 'Comparación', prop, btn));
        });

        this.containers.comparisonResults.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const partyId = btn.dataset.party;
                const propId = btn.dataset.id;
                const category = btn.dataset.category || 'Todas';
                if (!partyId || !propId) return;
                this.navigateHash(`#/${partyId}/${encodeURIComponent(category)}/${propId}`);
            });
        });
    },

    setupComparisonTopButton() {
        let btn = document.getElementById('floating-comparison-top-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'floating-comparison-top-btn';
            btn.className = 'fixed bottom-6 right-6 w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg z-[70] transition-all duration-300 opacity-0 translate-y-full flex items-center justify-center hover:bg-slate-800';
            btn.setAttribute('aria-label', 'Subir al inicio del comparador');
            btn.setAttribute('title', 'Subir arriba');
            btn.innerHTML = '<i class="fa-solid fa-arrow-up text-sm"></i>';
            btn.style.bottom = 'calc(1rem + env(safe-area-inset-bottom))';
            btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            document.body.appendChild(btn);
        }

        if (this.comparisonTopScrollHandler) {
            window.removeEventListener('scroll', this.comparisonTopScrollHandler);
        }

        this.comparisonTopScrollHandler = () => {
            const shouldShow = window.scrollY > 140;
            btn.classList.toggle('opacity-100', shouldShow);
            btn.classList.toggle('translate-y-0', shouldShow);
            btn.classList.toggle('opacity-0', !shouldShow);
            btn.classList.toggle('translate-y-full', !shouldShow);
        };

        window.addEventListener('scroll', this.comparisonTopScrollHandler);
        this.comparisonTopScrollHandler();
    },

    renderDuelSelector(selectedIds) {
        this.containers.duelParties.innerHTML = PARTIES.map(party => {
            const active = selectedIds.includes(party.id);
            return `
                <button class="party-pill px-4 py-2 rounded-full border transition-all flex items-center gap-2 ${active ? 'bg-white border-slate-900 ring-2 ring-slate-900/5 active' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'}"
                        data-party-id="${party.id}" style="--shadow-color: ${party.color}20">
                    <span class="party-logo-bubble is-pill w-6 h-6 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        <img src="${party.logo}" alt="${party.name}" class="party-logo-bubble-img ${active ? '' : 'grayscale opacity-70'}">
                    </span>
                    <span class="text-sm font-bold">${party.name}</span>
                    ${active ? `<i class="fa-solid fa-circle-check text-slate-900 text-[10px]"></i>` : ''}
                </button>
            `;
        }).join('');

        document.getElementById('selected-parties-count').textContent = `${selectedIds.length} partido${selectedIds.length !== 1 ? 's' : ''}`;
    },

    renderTopicsGrid(categories, activeTopicId) {
        const activeCat = categories.find(c => c.id === activeTopicId);
        const label = activeCat ? `<i class="fa-solid ${activeCat.icon}"></i> ${activeCat.name}` : '<i class="fa-solid fa-list"></i> Elige un tema';

        // Render a single dropdown-trigger button
        this.containers.topicsGrid.innerHTML = `
            <button id="btn-topic-dropdown"
                class="w-full bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between text-slate-700 font-medium shadow-sm hover:border-slate-400 transition-colors">
                <div class="flex items-center gap-3">
                    ${label}
                </div>
                <i class="fa-solid fa-chevron-down text-xs text-slate-300"></i>
            </button>
        `;

        // Remove old overlay if exists
        const oldOverlay = document.getElementById('topic-overlay');
        if (oldOverlay) oldOverlay.remove();

        // Create overlay (same pattern as mobile category filter)
        const overlay = document.createElement('div');
        overlay.id = 'topic-overlay';
        overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] hidden flex-col justify-end';
        overlay.innerHTML = `
            <div class="bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto transform translate-y-full transition-transform duration-300">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-slate-800">Elige un tema</h3>
                    <button id="close-topic-overlay" class="p-2 text-slate-400 hover:text-slate-800">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>
                <div class="grid gap-2">
                    ${categories.map(cat => `
                        <button class="topic-dropdown-option w-full text-left p-4 rounded-xl border flex items-center gap-4
                            ${cat.id === activeTopicId ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-300'}"
                            data-topic-id="${cat.id}">
                            <div class="w-9 h-9 rounded-xl flex items-center justify-center ${cat.id === activeTopicId ? 'bg-white/10' : 'bg-white border border-slate-200'}">
                                <i class="fa-solid ${cat.icon} ${cat.id === activeTopicId ? 'text-sky-300' : 'text-slate-400'}"></i>
                            </div>
                            <span class="font-semibold">${cat.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const openOverlay = () => {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            setTimeout(() => overlay.querySelector('div').classList.remove('translate-y-full'), 10);
        };
        const closeOverlay = () => {
            overlay.querySelector('div').classList.add('translate-y-full');
            setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }, 300);
        };

        document.getElementById('btn-topic-dropdown').addEventListener('click', openOverlay);
        document.getElementById('close-topic-overlay').addEventListener('click', closeOverlay);
        overlay.querySelectorAll('.topic-dropdown-option').forEach(opt => {
            opt.addEventListener('click', () => {
                closeOverlay();
                this.navigateHash(`#/comparar/${opt.dataset.topicId}`);
            });
        });
    },

    updateFilterButtons(filters) {
        const btnRural = document.getElementById('filter-rural');
        const btnComp = document.getElementById('filter-competition');

        if (filters.rural) btnRural.classList.add('active'); else btnRural.classList.remove('active');
        if (filters.competition) btnComp.classList.add('active'); else btnComp.classList.remove('active');
    },

    createComparisonCardHTML(prop, partyInfo, options = {}) {
        const quoteKey = `${partyInfo.id}-${prop.id}`;

        if (options.compact) {
            return `
                <article
                    class="proposal-card proposal-card-compact relative bg-white p-4 rounded-xl border border-slate-100 shadow-sm"
                    id="prop-${quoteKey}">
                    <div class="party-indicator" style="background-color: ${partyInfo.color}"></div>
                    <p class="text-slate-700 text-sm leading-relaxed">${prop.resumen}</p>
                    <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button class="btn-share w-8 h-8 rounded-md text-slate-400 hover:text-slate-800 transition-colors flex items-center justify-center"
                                data-id="${prop.id}" data-party="${partyInfo.id}" aria-label="Compartir propuesta" title="Compartir">
                            <i class="fa-solid fa-share-nodes text-xs"></i>
                        </button>
                        <button class="btn-detail w-8 h-8 rounded-md text-slate-400 hover:text-slate-800 transition-colors flex items-center justify-center"
                                data-id="${prop.id}" data-party="${partyInfo.id}" data-category="${options.categoryName || 'Todas'}"
                                aria-label="Ver detalle de propuesta" title="Ver detalle">
                            <i class="fa-solid fa-eye text-xs"></i>
                        </button>
                    </div>
                </article>
            `;
        }

        return `
            <article
                class="proposal-card relative bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                id="prop-${quoteKey}">
                <div class="party-indicator" style="background-color: ${partyInfo.color}"></div>
                <div class="mb-4">
                    <h4 class="text-lg font-bold text-slate-800 leading-tight">${prop.titulo_corto}</h4>
                </div>
                <p class="text-slate-600 mb-6 text-sm leading-relaxed">${prop.resumen}</p>

                <div class="quote-section overflow-hidden transition-all duration-300 max-h-0" id="quote-${quoteKey}">
                    <div class="bg-slate-50 p-5 rounded-xl border-l-4 mb-4" style="border-color: ${partyInfo.color}50">
                        <p class="text-sm italic text-slate-500 mb-4 leading-relaxed font-serif">"${prop.cita_literal}"</p>
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-slate-400">Fuente: Programa Electoral 2026</span>
                            <a href="programas/${partyInfo.id}.pdf#page=${prop.pagina}" target="_blank"
                               class="font-bold px-2 py-1 bg-white border border-slate-200 rounded text-blue-600 hover:bg-blue-50 transition-colors">
                                Ver PDF (Pág. ${prop.pagina}) <i class="fa-solid fa-up-right-from-square ml-1 text-[10px]"></i>
                            </a>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div class="flex items-center gap-2">
                        ${prop.analisis?.foco_rural ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-600" title="Foco rural"><i class="fa-solid fa-tractor text-xs"></i><span class="sr-only">Foco rural</span></span>' : ''}
                    </div>
                    <div class="flex gap-3">
                        <button class="btn-share text-xs font-semibold text-slate-400 hover:text-slate-800 flex items-center gap-2 transition-colors" data-id="${prop.id}" data-party="${partyInfo.id}">
                            <i class="fa-solid fa-share-nodes text-[10px]"></i>
                            <span>Compartir</span>
                        </button>
                        <button class="btn-toggle-quote text-xs font-semibold text-slate-400 hover:text-slate-800 flex items-center gap-2 transition-colors" data-id="${prop.id}" data-quote-id="${quoteKey}">
                            <i class="fa-solid fa-quote-left text-[10px]"></i>
                            <span>Ver fuente</span>
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    // --- Simple Mobile Navigation ---

    setupSimpleMobileNav(selectedIds) {
        const navContainer = document.getElementById('mobile-party-nav');
        const isMobile = window.matchMedia('(max-width: 1023px)').matches;
        const logoEl = document.getElementById('current-party-logo');
        const nameEl = document.getElementById('current-party-name');
        const counterEl = document.getElementById('current-party-counter');

        if (isMobile) {
            navContainer?.classList.add('hidden');
            return;
        }

        navContainer?.classList.remove('hidden');
        
        // Update current party info (first party)
        const firstPartyId = selectedIds[0];
        const firstParty = PARTIES.find(p => p.id === firstPartyId);
        
        if (firstParty) {
            logoEl.innerHTML = `<img src="${firstParty.logo}" alt="${firstParty.name}" class="w-full h-full object-contain p-1">`;
            nameEl.textContent = firstParty.name;
            counterEl.textContent = `1 / ${selectedIds.length}`;
        }

        // Setup navigation buttons
        const prevBtn = document.getElementById('btn-prev-party');
        const nextBtn = document.getElementById('btn-next-party');

        if (prevBtn) {
            prevBtn.onclick = () => this.navigateSimpleMobile(-1, selectedIds);
            prevBtn.disabled = true; // First party, disable prev
        }

        if (nextBtn) {
            nextBtn.onclick = () => this.navigateSimpleMobile(1, selectedIds);
            nextBtn.disabled = false;
        }
    },

    setupSimpleMobileSwipe(selectedIds) {
        if (selectedIds.length <= 1) return;

        let startX = 0;
        let currentIndex = 0;
        let isDragging = false;

        const grid = this.containers.comparisonResults.querySelector('.contrast-grid');
        if (!grid) return;

        const handleSwipeEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;

            const endX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX;
            const diff = startX - endX;
            const threshold = 50;

            if (Math.abs(diff) > threshold) {
                if (diff > 0 && currentIndex < selectedIds.length - 1) {
                    // Swipe left - next party
                    this.navigateSimpleMobile(1, selectedIds);
                } else if (diff < 0 && currentIndex > 0) {
                    // Swipe right - previous party
                    this.navigateSimpleMobile(-1, selectedIds);
                }
            }
        };

        const handleSwipeStart = (e) => {
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            isDragging = true;
        };

        // Touch events
        grid.addEventListener('touchstart', handleSwipeStart);
        grid.addEventListener('touchend', handleSwipeEnd);
    },

    navigateSimpleMobile(direction, selectedIds) {
        const activeCol = this.containers.comparisonResults.querySelector('.party-comparison-col.mobile-active');
        if (!activeCol) return;

        const currentIndex = parseInt(activeCol.dataset.partyIndex);
        const newIndex = currentIndex + direction;
        
        if (newIndex < 0 || newIndex >= selectedIds.length) return;

        const targetPartyId = selectedIds[newIndex];
        const targetParty = PARTIES.find(p => p.id === targetPartyId);
        
        // Update navigation state
        this.updateSimpleNavState(newIndex, selectedIds, targetParty);
        
        // Switch to target party
        this.containers.comparisonResults.querySelectorAll('.party-comparison-col').forEach(col => {
            col.classList.toggle('mobile-active', col.dataset.partyCol === targetPartyId);
        });
    },

    updateSimpleNavState(currentIndex, selectedIds, currentParty) {
        const logoEl = document.getElementById('current-party-logo');
        const nameEl = document.getElementById('current-party-name');
        const counterEl = document.getElementById('current-party-counter');
        const prevBtn = document.getElementById('btn-prev-party');
        const nextBtn = document.getElementById('btn-next-party');

        if (logoEl && currentParty) {
            logoEl.innerHTML = `<img src="${currentParty.logo}" alt="${currentParty.name}" class="w-full h-full object-contain p-1">`;
        }
        
        if (nameEl && currentParty) {
            nameEl.textContent = currentParty.name;
        }

        if (counterEl) {
            counterEl.textContent = `${currentIndex + 1} / ${selectedIds.length}`;
        }

        if (prevBtn) {
            prevBtn.disabled = currentIndex === 0;
        }

        if (nextBtn) {
            nextBtn.disabled = currentIndex === selectedIds.length - 1;
        }
    }
};
