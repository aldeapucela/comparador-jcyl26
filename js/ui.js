/**
 * UI Module - Handles DOM manipulation and rendering
 */

import { PARTIES } from './api.js';

export const UI = {
    // Selectors
    views: {
        selection: document.getElementById('view-party-selection'),
        detail: document.getElementById('view-party-detail')
    },
    containers: {
        parties: document.getElementById('parties-container'),
        categories: document.getElementById('categories-nav'),
        proposals: document.getElementById('proposals-container'),
        headerActions: document.getElementById('header-actions'),
        mobileFilter: document.getElementById('mobile-filter-container')
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

        this.elements.partyCandidate.querySelector('span').textContent = metadata.candidato;
        this.elements.partySlogan.textContent = metadata.lema ? `"${metadata.lema}"` : '';

        this.elements.partyLogo.innerHTML = `<img src="${partyInfo.logo}" alt="Logo ${partyInfo.name}" class="w-full h-full object-contain p-2">`;
        this.elements.partyLogo.style.backgroundColor = 'white';
        this.elements.partyLogo.style.border = `2px solid ${partyInfo.color}20`;
        this.elements.partyLogo.classList.add('overflow-hidden', 'rounded-xl');
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

    renderProposals(proposals, category, partyInfo) {
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
        let config = { icon: 'fa-circle-check', color: 'text-emerald-500', text: 'Directa' };
        if (c.includes('compartida') || c.includes('coordinada') || c.includes('shared')) {
            config = { icon: 'fa-circle-nodes', color: 'text-amber-500', text: 'Compartida' };
        } else if (c.includes('petición') || c.includes('petition')) {
            config = { icon: 'fa-circle-arrow-up', color: 'text-rose-500', text: 'Petición' };
        }
        return `
            <div class="flex items-center gap-1.5" title="Competencia ${config.text}">
                <i class="fa-solid ${config.icon} ${config.color} text-[10px]"></i>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Comp. ${config.text}</span>
            </div>
        `;
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
        const stickyBar = document.getElementById('sticky-party-identity');
        const mobileFilter = document.getElementById('mobile-filter-container');
        if (viewName === 'selection') {
            this.views.selection.classList.remove('hidden');
            this.views.detail.classList.add('hidden');
            this.containers.headerActions.classList.add('hidden');
            if (stickyBar) stickyBar.classList.add('-translate-y-full');
            if (mobileFilter) mobileFilter.classList.add('hidden');
        } else {
            this.views.selection.classList.add('hidden');
            this.views.detail.classList.remove('hidden');
            this.containers.headerActions.classList.remove('hidden');
            if (mobileFilter) mobileFilter.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    }
};
