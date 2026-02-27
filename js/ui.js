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

    // Selectors
    views: {
        selection: document.getElementById('view-party-selection'),
        detail: document.getElementById('view-party-detail'),
        topic: document.getElementById('view-topic-first'),
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
        comparisonResults: document.getElementById('comparison-results')
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

    // Methods
    renderPartySelection() {
        // Create a copy and shuffle for fairness
        const shuffledParties = [...PARTIES].sort(() => Math.random() - 0.5);

        this.containers.parties.innerHTML = shuffledParties.map(party => `
            <div class="party-card bg-white p-6 rounded-2xl border border-slate-100 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col items-center justify-center text-center" 
                 data-party-id="${party.id}">
                <div class="w-16 h-16 md:w-24 md:h-24 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 overflow-hidden shadow-sm border border-slate-50" 
                     style="background-color: white">
                    <img src="${party.logo}" alt="Logo ${party.name}" class="w-full h-full object-contain p-2">
                </div>
                <h3 class="text-lg md:text-xl font-bold text-slate-800">${party.name}</h3>
            </div>
        `).join('');
    },

    renderPartyHeader(metadata, partyInfo) {
        this.elements.partyTitle.textContent = partyInfo.name;
        this.elements.partyTitle.style.color = partyInfo.color;

        // Show candidate name, and coalition if it exists
        let candidateText = metadata.candidato;
        if (metadata.coalicion) {
            candidateText += ` • ${metadata.coalicion}`;
        }
        this.elements.partyCandidate.querySelector('span').textContent = candidateText;
        
        this.elements.partySlogan.textContent = metadata.lema ? `"${metadata.lema}"` : '';

        this.elements.partyLogo.innerHTML = `<img src="${partyInfo.logo}" alt="Logo ${partyInfo.name}" class="w-full h-full object-contain p-2">`;
        this.elements.partyLogo.style.backgroundColor = 'white';
        this.elements.partyLogo.style.border = `2px solid ${partyInfo.color}20`;
        this.elements.partyLogo.classList.add('overflow-hidden', 'rounded-xl');

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
                                ${prop.foco_rural ? '<span class="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded uppercase flex items-center gap-1"><i class="fa-solid fa-tractor"></i> Foco Rural</span>' : ''}
                                ${prop.tags.map(tag => `<span class="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-medium rounded">${tag}</span>`).join('')}
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
                    onSelect(item.dataset.category);
                    dropdown.remove();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        const quoteDiv = document.getElementById(`quote-${id}`);
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

    async shareProposal(partyInfo, category, prop, btn) {
        const url = `${window.location.origin}${window.location.pathname}#/${partyInfo.id}/${encodeURIComponent(category)}/${prop.id}`;
        const shareText = `${partyInfo.name} en Castilla y León propone: ${prop.resumen}`;
        const fullMessage = `${shareText}\n\n${url}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Propuesta de ${partyInfo.name}`,
                    text: shareText,
                    url: url
                });
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error sharing:', err);
            }
        } else {
            // Fallback to clipboard
            try {
                await navigator.clipboard.writeText(fullMessage);
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

        // Hide all views first
        Object.values(this.views).forEach(view => view?.classList.add('hidden'));

        // Clean up floating navigation when leaving detail view
        if (floatingNav && viewName !== 'detail') {
            floatingNav.remove();
        }

        if (viewName === 'selection') {
            this.views.selection.classList.remove('hidden');
            this.containers.headerActions.classList.add('hidden');
            if (stickyBar) stickyBar.classList.add('-translate-y-full');
            if (mobileFilter) mobileFilter.classList.add('hidden');
        } else if (viewName === 'detail') {
            this.views.detail.classList.remove('hidden');
            this.containers.headerActions.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.remove('hidden');
            window.scrollTo(0, 0);
        } else if (viewName === 'topic') {
            this.views.topic.classList.remove('hidden');
            this.containers.headerActions.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.add('hidden');
            window.scrollTo(0, 0);
        } else if (viewName === 'afinidad') {
            this.views.afinidad.classList.remove('hidden');
            this.containers.headerActions.classList.remove('hidden');
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

        // 4. Setup Simple Mobile Navigation
        this.setupSimpleMobileNav(comparisonIds);

        // 5. Render Results
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

        // Set first column active on mobile
        const firstCol = this.containers.comparisonResults.querySelector('.party-comparison-col');
        if (firstCol && !isMobile) firstCol.classList.add('mobile-active');

        // Setup simple mobile swipe
        if (!isMobile) this.setupSimpleMobileSwipe(comparisonIds);

        // Attach quote toggle events
        this.containers.comparisonResults.querySelectorAll('.btn-toggle-quote').forEach(btn => {
            btn.addEventListener('click', () => this.toggleQuote(btn.dataset.id, btn));
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
                    <img src="${party.logo}" alt="${party.name}" class="h-4 object-contain ${active ? '' : 'grayscale opacity-70'}">
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
        if (options.compact) {
            return `
                <article
                    class="proposal-card proposal-card-compact relative bg-white p-4 rounded-xl border border-slate-100 shadow-sm"
                    id="prop-${prop.id}">
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
                id="prop-${prop.id}">
                <div class="party-indicator" style="background-color: ${partyInfo.color}"></div>
                <div class="mb-4">
                    <h4 class="text-lg font-bold text-slate-800 leading-tight">${prop.titulo_corto}</h4>
                </div>
                <p class="text-slate-600 mb-6 text-sm leading-relaxed">${prop.resumen}</p>

                <div class="quote-section overflow-hidden transition-all duration-300 max-h-0" id="quote-${prop.id}">
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
                        ${prop.foco_rural ? '<i class="fa-solid fa-tractor text-amber-500 text-xs" title="Foco Rural"></i>' : ''}
                    </div>
                    <div class="flex gap-3">
                        <button class="btn-share text-xs font-semibold text-slate-400 hover:text-slate-800 flex items-center gap-2 transition-colors" data-id="${prop.id}" data-party="${partyInfo.id}">
                            <i class="fa-solid fa-share-nodes text-[10px]"></i>
                            <span>Compartir</span>
                        </button>
                        <button class="btn-toggle-quote text-xs font-semibold text-slate-400 hover:text-slate-800 flex items-center gap-2 transition-colors" data-id="${prop.id}">
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
