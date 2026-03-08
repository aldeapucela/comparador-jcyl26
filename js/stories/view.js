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
    const forceLightBgLogo = String(party?.id || '').toLowerCase() === 'podemos';
    const logoWrapClass = (needsLightLogoAvatar(party.logo) || forceLightBgLogo)
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

function renderEngagementShareCard(container, data = {}) {
    if (!container) return;

    const {
        transitionDirection = 'next'
    } = data;

    const transitionClass = transitionDirection === 'prev'
        ? 'story-screen--enter-prev'
        : 'story-screen--enter-next';

    container.innerHTML = `
        <article class="story-screen story-screen--engagement story-screen--suggestion-premium story-screen--suggestion-share ${transitionClass}" style="--party-color: #0f766e; --story-accent: #99f6e4; --mesh-1: #14b87a; --mesh-2: #18d5cf; --mesh-3: #52e3a5; --mesh-4: #7de7e6; --cta-bg: #ffffff; --cta-color: #0b1220; --cta-border: transparent; --cta-shadow: 0 20px 34px rgba(5, 67, 54, 0.34), 0 0 0 4px rgba(255, 255, 255, 0.17);">
            <div class="story-mesh" aria-hidden="true">
                <span class="story-mesh-blob story-mesh-blob-a"></span>
                <span class="story-mesh-blob story-mesh-blob-b"></span>
                <span class="story-mesh-blob story-mesh-blob-c"></span>
                <span class="story-mesh-blob story-mesh-blob-d"></span>
            </div>
            <div class="story-screen-overlay"></div>

            <header class="story-top">
                <div class="story-progress-track" aria-hidden="true">
                    <span id="story-progress-fill-live" class="story-progress-fill" style="width: 0%"></span>
                </div>
            </header>

            <section class="story-body story-body--engagement">
                <div class="story-suggestion-content">
                    <h3 class="story-title story-title--premium">¡Pasa la voz a tus vecinos!</h3>
                    <div class="story-summary story-summary--suggestion" aria-label="Mensaje sugerido">
                        <span class="story-suggestion-line" style="--line-index: 0;">La información es poder.</span>
                        <span class="story-suggestion-line" style="--line-index: 1;">Ayuda a que tu comunidad vote <strong>informada</strong>.</span>
                        <span class="story-suggestion-line" style="--line-index: 2;">Comparte esta web en <strong>tus grupos</strong>.</span>
                    </div>
                </div>
                <button class="stories-cta-primary stories-cta-primary--suggestion" id="btn-story-engagement-share" type="button" aria-label="Compartir con amigos">
                    <i class="fa-solid fa-share-nodes"></i>
                    <span>Compartir con amigos</span>
                </button>
            </section>

            <footer class="story-actions story-actions--engagement">
                <button class="story-engagement-optout" id="btn-story-engagement-optout" type="button">
                    No volver a preguntar
                </button>
            </footer>
        </article>
    `;
}

function renderTelegramInterstitialCard(container, data = {}) {
    if (!container) return;

    const {
        transitionDirection = 'next'
    } = data;

    const transitionClass = transitionDirection === 'prev'
        ? 'story-screen--enter-prev'
        : 'story-screen--enter-next';

    container.innerHTML = `
        <article class="story-screen story-screen--engagement story-screen--suggestion-premium story-screen--telegram ${transitionClass}" style="--party-color: #312e81; --story-accent: #22d3ee; --mesh-1: #5f4ff5; --mesh-2: #4f7dff; --mesh-3: #3a52e6; --mesh-4: #37d9ff; --cta-bg: #ffffff; --cta-color: #0f172a; --cta-border: transparent;">
            <div class="story-mesh" aria-hidden="true">
                <span class="story-mesh-blob story-mesh-blob-a"></span>
                <span class="story-mesh-blob story-mesh-blob-b"></span>
                <span class="story-mesh-blob story-mesh-blob-c"></span>
                <span class="story-mesh-blob story-mesh-blob-d"></span>
            </div>
            <div class="story-screen-overlay"></div>

            <header class="story-top">
                <div class="story-progress-track" aria-hidden="true">
                    <span id="story-progress-fill-live" class="story-progress-fill" style="width: 0%"></span>
                </div>
            </header>

            <section class="story-body story-body--engagement story-body--telegram">
                <div class="story-suggestion-content">
                    <h3 class="story-title story-title--premium">¿Qué opinan tus vecinos?</h3>
                    <div class="story-summary story-summary--suggestion" aria-label="Mensaje sugerido">
                        <span class="story-suggestion-line" style="--line-index: 0;">No leas solo las propuestas.</span>
                        <span class="story-suggestion-line" style="--line-index: 1;">Únete al chat vecinal <strong>en directo</strong>.</span>
                        <span class="story-suggestion-line" style="--line-index: 2;">Debate de forma libre y <strong>sin ruido</strong>.</span>
                    </div>
                </div>
                <button class="stories-cta-primary stories-cta-primary--suggestion" id="btn-story-telegram-join" type="button" aria-label="Entrar al chat vecinal de Telegram">
                    <i class="fa-solid fa-message"></i>
                    <span>Entrar al chat vecinal</span>
                </button>
            </section>
        </article>
    `;
}

function renderAfinidadInterstitialCard(container, data = {}) {
    if (!container) return;

    const {
        transitionDirection = 'next'
    } = data;

    const transitionClass = transitionDirection === 'prev'
        ? 'story-screen--enter-prev'
        : 'story-screen--enter-next';

    container.innerHTML = `
        <article class="story-screen story-screen--engagement story-screen--suggestion-premium story-screen--suggestion-afinidad ${transitionClass}" style="--party-color: #be123c; --story-accent: #fb7185; --mesh-1: #ff58d8; --mesh-2: #ff8d35; --mesh-3: #ff6aa8; --mesh-4: #ffbb45; --cta-bg: #ffffff; --cta-color: #111827; --cta-border: transparent;">
            <div class="story-mesh" aria-hidden="true">
                <span class="story-mesh-blob story-mesh-blob-a"></span>
                <span class="story-mesh-blob story-mesh-blob-b"></span>
                <span class="story-mesh-blob story-mesh-blob-c"></span>
                <span class="story-mesh-blob story-mesh-blob-d"></span>
            </div>
            <div class="story-screen-overlay"></div>

            <header class="story-top">
                <div class="story-progress-track" aria-hidden="true">
                    <span id="story-progress-fill-live" class="story-progress-fill" style="width: 0%"></span>
                </div>
            </header>

            <section class="story-body story-body--engagement">
                <div class="story-suggestion-content">
                    <h3 class="story-title story-title--premium">¿Cuál es tu partido ideal?</h3>
                    <div class="story-summary story-summary--suggestion" aria-label="Mensaje sugerido">
                        <span class="story-suggestion-line" style="--line-index: 0;">Ahorra tiempo de lectura.</span>
                        <span class="story-suggestion-line" style="--line-index: 1;">Haz el test de afinidad en <strong>2 min</strong>.</span>
                        <span class="story-suggestion-line" style="--line-index: 2;">Descubre quién piensa realmente <strong>como tú</strong>.</span>
                    </div>
                </div>
                <button class="stories-cta-primary stories-cta-primary--suggestion" id="btn-story-afinidad-start" type="button" aria-label="Hacer test de afinidad">
                    <i class="fa-solid fa-bolt"></i>
                    <span>Hacer test de afinidad</span>
                </button>
            </section>

            <footer class="story-actions story-actions--engagement">
                <button class="story-engagement-optout" id="btn-story-afinidad-optout" type="button">
                    No volver a mostrar
                </button>
            </footer>
        </article>
    `;
}

function renderCandidateVideoCard(container, data = {}) {
    if (!container) return;

    const {
        transitionDirection = 'next',
        party = null,
        videoPath = ''
    } = data;
    if (!party || !videoPath) return;

    const transitionClass = transitionDirection === 'prev'
        ? 'story-screen--enter-prev'
        : 'story-screen--enter-next';
    const forceLightBgLogo = String(party?.id || '').toLowerCase() === 'podemos';
    const logoWrapClass = (needsLightLogoAvatar(party.logo) || forceLightBgLogo)
        ? 'story-party-logo-wrap is-light-bg'
        : 'story-party-logo-wrap';
    const candidateLabel = String(party?.candidateName || '').trim()
        ? `${String(party.candidateName).trim()} (candidato)`
        : '';

    container.innerHTML = `
        <article class="story-screen story-screen--engagement story-screen--party-video ${transitionClass}" style="--party-color: ${escapeHtml(party.color || '#334155')}; --story-accent: ${escapeHtml(party.color || '#334155')};">
            <video
                id="story-candidate-video-player"
                class="story-candidate-video-bg"
                src="${escapeHtml(videoPath)}"
                autoplay
                muted
                playsinline
                webkit-playsinline
                preload="auto"
                aria-label="Vídeo del candidato de ${escapeHtml(party.name)}"></video>
            <div id="story-candidate-video-loading" class="story-video-loading" role="status" aria-live="polite">
                <span class="story-video-loading-spinner" aria-hidden="true"></span>
                <span>Cargando vídeo…</span>
            </div>
            <div class="story-screen-overlay"></div>
            <header class="story-top">
                <div class="story-progress-track" aria-hidden="true">
                    <span id="story-progress-fill-live" class="story-progress-fill" style="width: 0%"></span>
                </div>
                <div class="story-meta-row">
                    <span class="story-counter">Vídeo</span>
                </div>
                <div class="story-party-row">
                    <button type="button" class="story-party-link btn-story-party" data-party="${escapeHtml(party.id)}" aria-label="Ir al programa de ${escapeHtml(party.name)}">
                        <span class="${logoWrapClass}">
                            <img src="${escapeHtml(party.logo)}" alt="Logo ${escapeHtml(party.name)}" class="story-party-logo">
                        </span>
                    </button>
                    <button type="button" class="story-party-text-link btn-story-party" data-party="${escapeHtml(party.id)}" aria-label="Ir al programa de ${escapeHtml(party.name)}">
                        <p class="story-party-name">${escapeHtml(party.name)}</p>
                        ${candidateLabel ? `<p class="story-party-mode">${escapeHtml(candidateLabel)}</p>` : ''}
                    </button>
                </div>
            </header>
            <section class="story-body story-body--engagement"></section>
            <footer class="story-actions story-actions-icons story-actions--single">
                <button class="story-action-btn" id="btn-story-video-share" aria-label="Compartir vídeo del candidato" title="Compartir vídeo del candidato">
                    <i class="fa-solid fa-share-nodes"></i>
                </button>
            </footer>
            <button type="button"
                id="btn-story-video-audio-toggle"
                class="story-video-audio-btn story-video-audio-btn--floating"
                aria-label="Silenciar vídeo"
                aria-pressed="false"
                title="Silenciar vídeo">
                <i class="fa-solid fa-volume-high" aria-hidden="true"></i>
            </button>
            <div class="story-video-subtitles-wrap" aria-live="polite" aria-atomic="true">
                <div id="story-video-subtitle-active" class="story-video-subtitle-active"></div>
            </div>
        </article>
    `;
}

export const StoriesView = {
    buildStoryCaptionChunks,
    renderStoriesCard,
    renderEngagementShareCard,
    renderTelegramInterstitialCard,
    renderAfinidadInterstitialCard,
    renderCandidateVideoCard
};
