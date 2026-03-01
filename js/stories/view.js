function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildStoryCaptionChunks(summary = '', wordsPerChunk = 3) {
    const normalized = String(summary || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return [];

    const words = normalized.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
        chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
    }
    return chunks;
}

function preventWidow(text = '') {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    // Keep the final two words together to avoid orphan single-word lines.
    return normalized.replace(/\s+(\S+)$/, '\u00A0$1');
}

function needsLightLogoAvatar(logoPath = '') {
    const normalized = String(logoPath || '').trim().toLowerCase();
    return /\.svg(?:\?|#|$)/.test(normalized);
}

function getStoryCategoryAccent(categoryName = '') {
    const key = String(categoryName || '').toLowerCase();
    if (key.includes('sanidad')) return '#22c55e';
    if (key.includes('vivienda')) return '#f97316';
    if (key.includes('educación') || key.includes('educacion')) return '#eab308';
    if (key.includes('econom')) return '#38bdf8';
    if (key.includes('medio')) return '#10b981';
    if (key.includes('conectividad') || key.includes('movilidad')) return '#6366f1';
    if (key.includes('servicios sociales') || key.includes('cuidados')) return '#ec4899';
    if (key.includes('democr')) return '#a855f7';
    return '#8b5cf6';
}

function renderStoriesCard(container, storyData) {
    if (!container || !storyData) return;

    const {
        party,
        proposal,
        categoryName,
        progress,
        total,
        storyDurationMs,
        transitionDirection,
        isSaved
    } = storyData;

    const summary = proposal?.resumen || 'Sin resumen disponible.';
    const clippedSummary = summary.length > 260
        ? `${summary.slice(0, 257)}...`
        : summary;
    const rawSummaryChunks = buildStoryCaptionChunks(clippedSummary, 6);
    const summaryChunks = rawSummaryChunks.length > 6
        ? [...rawSummaryChunks.slice(0, 5), rawSummaryChunks.slice(5).join(' ')]
        : rawSummaryChunks;

    const categoryAccent = getStoryCategoryAccent(categoryName);
    const timelineDuration = Number.isFinite(storyDurationMs) ? Math.max(1500, storyDurationMs) : 7000;
    const timelineStyle = total > 1 ? 'width: 0%;' : 'width: 100%;';
    const transitionClass = transitionDirection === 'prev'
        ? 'story-screen--enter-prev'
        : 'story-screen--enter-next';
    const logoWrapClass = needsLightLogoAvatar(party.logo)
        ? 'story-party-logo-wrap is-light-bg'
        : 'story-party-logo-wrap';

    container.innerHTML = `
        <article class="story-screen ${transitionClass}" style="--party-color: ${escapeHtml(party.color || '#334155')}; --story-accent: ${escapeHtml(categoryAccent)}">
            <div class="story-screen-overlay"></div>
            <button type="button" class="story-nav-zone story-nav-zone-prev" aria-label="Story anterior"></button>
            <button type="button" class="story-nav-zone story-nav-zone-next" aria-label="Story siguiente"></button>

            <header class="story-top">
                <div class="story-progress-track" aria-hidden="true">
                    <span id="story-progress-fill-live" class="story-progress-fill" data-story-duration="${timelineDuration}" style="${timelineStyle}"></span>
                </div>
                <div class="story-meta-row">
                    <span class="story-counter">${progress}/${total}</span>
                </div>
                <div class="story-party-row">
                    <button type="button" class="story-party-link btn-story-party" data-party="${escapeHtml(party.id)}" aria-label="Ir al programa de ${escapeHtml(party.name)}">
                        <span class="${logoWrapClass}">
                            <img src="${escapeHtml(party.logo)}" alt="Logo ${escapeHtml(party.name)}" class="story-party-logo">
                        </span>
                    </button>
                    <button type="button" class="story-party-text-link btn-story-party" data-party="${escapeHtml(party.id)}" aria-label="Ir al programa de ${escapeHtml(party.name)}">
                        <p class="story-party-name">${escapeHtml(party.name)}</p>
                        <p class="story-party-mode">${escapeHtml(categoryName)}</p>
                    </button>
                </div>
            </header>

            <section class="story-body">
                <h3 class="story-title">${escapeHtml(proposal?.titulo_corto || 'Propuesta sin título')}</h3>
                <div class="story-summary story-summary-caption" aria-live="polite">
                    ${summaryChunks.map((chunk, idx) => `<span class="story-caption-chunk${idx === 0 ? ' is-revealed' : ''}">${escapeHtml(preventWidow(chunk))}</span>`).join('')}
                </div>
            </section>

            <footer class="story-actions story-actions-icons">
                <button class="story-action-btn btn-detail" data-party="${escapeHtml(party.id)}" data-id="${escapeHtml(proposal.id)}" aria-label="Ver detalle" title="Ver detalle">
                    <i class="fa-solid fa-up-right-from-square"></i>
                </button>
                <button class="story-action-btn btn-story-save${isSaved ? ' is-saved' : ''}" data-party="${escapeHtml(party.id)}" data-id="${escapeHtml(proposal.id)}" aria-label="Guardar propuesta" title="Guardar propuesta">
                    <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                </button>
                <button class="story-action-btn" id="btn-story-share-inline" aria-label="Compartir propuesta" title="Compartir propuesta">
                    <i class="fa-solid fa-share-nodes"></i>
                </button>
            </footer>
        </article>
    `;
}

export const StoriesView = {
    buildStoryCaptionChunks,
    renderStoriesCard
};
