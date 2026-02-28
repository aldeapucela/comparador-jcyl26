import { PARTIES, CATEGORIES } from '../api.js';
import { UI } from '../ui.js';
import { StoriesView } from './view.js';

const EXPLORA_CAPTION_STEP_MS = 850;
const EXPLORA_AFTER_LAST_BLOCK_MS = 6500;
const EXPLORA_MIN_STORY_DURATION_MS = 7000;

export function createStoriesController(appState) {
    let exploraTouchStart = null;
    let exploraWheelLocked = false;
    let exploraIsPaused = false;
    let exploraWasPausedByHold = false;
    let exploraAutoAdvanceTimer = null;
    let exploraProgressRaf = null;
    let exploraPlaybackElapsedMs = 0;
    let storyCaptionTimer = null;
    let storyCaptionChunks = [];
    let storyCaptionCurrentIndex = 0;
    let storyCaptionStepMs = EXPLORA_CAPTION_STEP_MS;
    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function getSelectedPartyIds() {
        const raw = Array.isArray(appState.stories.selectedPartyIds)
            ? appState.stories.selectedPartyIds
            : (appState.stories.selectedPartyId ? [appState.stories.selectedPartyId] : []);

        const allowed = new Set(PARTIES.map((party) => party.id));
        const unique = [];
        raw.forEach((id) => {
            const normalized = String(id || '').trim();
            if (!normalized || !allowed.has(normalized) || unique.includes(normalized)) return;
            unique.push(normalized);
        });

        return unique;
    }

    function setSelectedPartyIds(ids = [], { ensureOne = true } = {}) {
        const allowed = new Set(PARTIES.map((party) => party.id));
        const unique = [];
        (Array.isArray(ids) ? ids : []).forEach((id) => {
            const normalized = String(id || '').trim();
            if (!normalized || !allowed.has(normalized) || unique.includes(normalized)) return;
            unique.push(normalized);
        });

        if (ensureOne && unique.length === 0 && PARTIES[0]?.id) {
            unique.push(PARTIES[0].id);
        }

        appState.stories.selectedPartyIds = unique;
        appState.stories.selectedPartyId = unique[0] || '';
    }

    function renderPartyPills() {
        const partyPills = document.getElementById('explora-party-pills');
        if (!partyPills) return;

        const selected = new Set(getSelectedPartyIds());
        partyPills.innerHTML = PARTIES.map((party) => {
            const isActive = selected.has(party.id);
            const activeClass = isActive ? ' is-active' : '';
            return `
                <button type="button" class="explora-party-pill${activeClass}" data-party-id="${escapeHtml(party.id)}" aria-pressed="${isActive ? 'true' : 'false'}">
                    <span class="explora-party-pill-logo-wrap">
                        <img src="${escapeHtml(party.logo)}" alt="Logo ${escapeHtml(party.name)}" class="explora-party-pill-logo">
                    </span>
                    <span class="explora-party-pill-name">${escapeHtml(party.name)}</span>
                </button>
            `;
        }).join('');

        partyPills.querySelectorAll('.explora-party-pill').forEach((pill) => {
            pill.addEventListener('click', () => {
                const partyId = pill.dataset.partyId;
                if (!partyId) return;
                const current = getSelectedPartyIds();
                const isSelected = current.includes(partyId);
                let next = current;

                if (isSelected) {
                    if (current.length <= 1) return;
                    next = current.filter((id) => id !== partyId);
                } else {
                    next = [...current, partyId];
                }

                setSelectedPartyIds(next, { ensureOne: true });
                renderPartyPills();
            });
        });
    }

    async function requestExploraFullscreen() {
        if (typeof document === 'undefined') return;
        if (typeof window !== 'undefined' && !window.matchMedia('(max-width: 1023px)').matches) return;
        if (document.fullscreenElement) return;

        const target = document.getElementById('explora-player') || document.documentElement;
        if (!target) return;

        try {
            if (typeof target.requestFullscreen === 'function') {
                await target.requestFullscreen({ navigationUI: 'hide' });
                return;
            }
        } catch {
            // Ignore user agent/fullscreen permission failures.
        }

        try {
            if (typeof target.webkitRequestFullscreen === 'function') {
                target.webkitRequestFullscreen();
            }
        } catch {
            // Ignore unsupported vendor API failures.
        }
    }

    async function exitExploraFullscreenIfActive() {
        if (typeof document === 'undefined') return;
        if (!document.fullscreenElement) return;
        try {
            if (typeof document.exitFullscreen === 'function') {
                await document.exitFullscreen();
                return;
            }
        } catch {
            // Ignore exit failures.
        }

        try {
            if (typeof document.webkitExitFullscreen === 'function') {
                document.webkitExitFullscreen();
            }
        } catch {
            // Ignore unsupported vendor API failures.
        }
    }

    function buildStoriesFeed() {
        const allItems = [];

        Object.entries(appState.allData).forEach(([partyId, partyData]) => {
            const partyInfo = PARTIES.find((party) => party.id === partyId);
            if (!partyInfo || !Array.isArray(partyData?.propuestas)) return;

            partyData.propuestas.forEach((proposal) => {
                allItems.push({
                    party: partyInfo,
                    proposal,
                    categoryName: proposal.categoria || 'General'
                });
            });
        });

        const { source, selectedTopic } = appState.stories;
        const selectedPartyIds = getSelectedPartyIds();
        let filtered = allItems;

        if (source === 'party' && selectedPartyIds.length > 0) {
            const selectedSet = new Set(selectedPartyIds);
            filtered = filtered.filter((item) => selectedSet.has(item.party.id));
        }

        if (source === 'topic' && selectedTopic) {
            filtered = filtered.filter((item) => item.categoryName === selectedTopic);
        }

        if (source !== 'random') {
            return filtered.sort(() => Math.random() - 0.5);
        }

        return buildVariedRandomStoriesFeed(filtered);
    }

    function buildVariedRandomStoriesFeed(items = []) {
        if (!Array.isArray(items) || items.length <= 2) {
            return [...items];
        }

        const groups = new Map();
        items.forEach((item) => {
            const partyId = item?.party?.id || 'unknown';
            if (!groups.has(partyId)) groups.set(partyId, []);
            groups.get(partyId).push(item);
        });

        groups.forEach((groupItems) => {
            groupItems.sort(() => Math.random() - 0.5);
        });

        const result = [];
        let lastPartyId = null;
        let consecutiveCount = 0;
        const MAX_CONSECUTIVE_SAME_PARTY = 2;

        const pickWeightedPartyId = (candidates) => {
            const weighted = candidates.map((partyId) => {
                const remaining = groups.get(partyId)?.length || 0;
                return { partyId, weight: Math.max(remaining, 1) };
            });

            const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
            let pivot = Math.random() * totalWeight;
            for (const entry of weighted) {
                pivot -= entry.weight;
                if (pivot <= 0) return entry.partyId;
            }
            return weighted[weighted.length - 1]?.partyId || null;
        };

        while (true) {
            const availableParties = Array.from(groups.entries())
                .filter(([, groupItems]) => groupItems.length > 0)
                .map(([partyId]) => partyId);

            if (availableParties.length === 0) break;

            let candidates = availableParties;
            if (consecutiveCount >= MAX_CONSECUTIVE_SAME_PARTY && availableParties.length > 1) {
                candidates = availableParties.filter((partyId) => partyId !== lastPartyId);
            }

            const selectedPartyId = pickWeightedPartyId(candidates);
            if (!selectedPartyId) break;

            const selectedItems = groups.get(selectedPartyId);
            const nextItem = selectedItems?.pop();
            if (!nextItem) continue;

            result.push(nextItem);

            if (selectedPartyId === lastPartyId) {
                consecutiveCount += 1;
            } else {
                lastPartyId = selectedPartyId;
                consecutiveCount = 1;
            }
        }

        return result;
    }

    function populateExploraFilters() {
        const topicSelect = document.getElementById('explora-topic-select');

        setSelectedPartyIds(getSelectedPartyIds(), { ensureOne: true });
        renderPartyPills();

        if (topicSelect && topicSelect.options.length === 0) {
            const topicNames = CATEGORIES.map((category) => category.name);
            topicSelect.innerHTML = topicNames
                .map((topic) => `<option value="${topic}">${topic}</option>`)
                .join('');
        }
    }

    function syncExploraSetupUI() {
        const setup = document.getElementById('explora-setup');
        const player = document.getElementById('explora-player');
        const partyPicker = document.getElementById('explora-party-picker');
        const topicPicker = document.getElementById('explora-topic-picker');

        if (!setup || !player || !partyPicker || !topicPicker) return;

        setup.classList.toggle('hidden', appState.stories.started);
        player.classList.toggle('hidden', !appState.stories.started);

        partyPicker.classList.toggle('hidden', appState.stories.source !== 'party');
        topicPicker.classList.toggle('hidden', appState.stories.source !== 'topic');

        document.querySelectorAll('.explora-choice').forEach((btn) => {
            const isActive = btn.dataset.exploraChoice === appState.stories.source;
            btn.classList.toggle('active', isActive);
        });
    }

    function getStoryDurationMs(story) {
        const summary = story?.proposal?.resumen || 'Sin resumen disponible.';
        const clippedSummary = summary.length > 260
            ? `${summary.slice(0, 257)}...`
            : summary;
        const rawChunks = StoriesView.buildStoryCaptionChunks(clippedSummary, 6);
        const chunkCount = Math.min(rawChunks.length || 1, 6);
        const revealTotalMs = Math.max(0, chunkCount - 1) * EXPLORA_CAPTION_STEP_MS;
        return Math.max(EXPLORA_MIN_STORY_DURATION_MS, revealTotalMs + EXPLORA_AFTER_LAST_BLOCK_MS);
    }

    function stopStoryCaptionSequence() {
        if (storyCaptionTimer) {
            clearInterval(storyCaptionTimer);
            storyCaptionTimer = null;
        }
        storyCaptionChunks = [];
        storyCaptionCurrentIndex = 0;
    }

    function pauseStoryCaptionSequence() {
        if (storyCaptionTimer) {
            clearInterval(storyCaptionTimer);
            storyCaptionTimer = null;
        }
    }

    function resumeStoryCaptionSequence() {
        if (!storyCaptionChunks.length) return;
        if (storyCaptionCurrentIndex >= storyCaptionChunks.length) return;
        if (storyCaptionTimer) return;

        storyCaptionTimer = setInterval(() => {
            if (storyCaptionCurrentIndex >= storyCaptionChunks.length) {
                pauseStoryCaptionSequence();
                return;
            }
            storyCaptionChunks[storyCaptionCurrentIndex]?.classList.add('is-revealed');
            storyCaptionCurrentIndex += 1;
        }, storyCaptionStepMs);
    }

    function playStoryCaptionSequence(storyDurationMs = 7000, revealStepMs = EXPLORA_CAPTION_STEP_MS) {
        stopStoryCaptionSequence();

        const chunkEls = UI.containers.storiesCard?.querySelectorAll('.story-caption-chunk');
        if (!chunkEls || chunkEls.length === 0) return;

        chunkEls.forEach((el, index) => {
            el.classList.toggle('is-revealed', index === 0);
        });

        if (chunkEls.length === 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        storyCaptionChunks = Array.from(chunkEls);
        storyCaptionCurrentIndex = 1;
        const totalDuration = Number.isFinite(storyDurationMs) ? Math.max(3000, storyDurationMs) : 7000;
        const boundedStep = Math.min(1200, Math.max(350, revealStepMs));
        const maxStepByDuration = Math.max(350, Math.floor((totalDuration - 1200) / Math.max(chunkEls.length - 1, 1)));
        storyCaptionStepMs = Math.min(boundedStep, maxStepByDuration);

        storyCaptionTimer = setInterval(() => {
            if (storyCaptionCurrentIndex >= storyCaptionChunks.length) {
                pauseStoryCaptionSequence();
                return;
            }
            storyCaptionChunks[storyCaptionCurrentIndex]?.classList.add('is-revealed');
            storyCaptionCurrentIndex += 1;
        }, storyCaptionStepMs);
    }

    function renderCurrentStoryCard() {
        if (!appState.stories.feed.length) {
            clearPlaybackTimers();
            stopStoryCaptionSequence();
            UI.containers.storiesCard.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                    No hay propuestas para esta selección. Prueba otro partido o temática.
                </div>
            `;
            return;
        }

        const story = appState.stories.feed[appState.stories.currentIndex % appState.stories.feed.length];
        appState.stories.currentStory = story;
        appState.stories.currentDurationMs = getStoryDurationMs(story);

        StoriesView.renderStoriesCard(UI.containers.storiesCard, {
            ...story,
            progress: (appState.stories.currentIndex % appState.stories.feed.length) + 1,
            total: appState.stories.feed.length,
            storyDurationMs: appState.stories.currentDurationMs,
            transitionDirection: appState.stories.transitionDirection
        });
        playStoryCaptionSequence(appState.stories.currentDurationMs, EXPLORA_CAPTION_STEP_MS);

        const shareBtn = document.getElementById('btn-story-share-inline');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                UI.shareProposal(story.party, story.categoryName, story.proposal, shareBtn, { surface: 'stories' });
            });
        }

        UI.containers.storiesCard.querySelectorAll('.btn-story-party').forEach((btn) => {
            btn.addEventListener('click', () => {
                UI.navigateHash(`#/${story.party.id}`);
            });
        });

        document.querySelector('.story-nav-zone-prev')?.addEventListener('click', (event) => {
            event.stopPropagation();
            moveToPrevStory();
        });
        document.querySelector('.story-nav-zone-next')?.addEventListener('click', (event) => {
            event.stopPropagation();
            moveToNextStory();
        });

        bindExploraGestures();
        scheduleAutoAdvance();

        UI.containers.storiesCard.querySelectorAll('.btn-detail').forEach((btn) => {
            btn.addEventListener('click', () => {
                UI.navigateHash(`#/${story.party.id}/${encodeURIComponent(story.categoryName)}/${story.proposal.id}`);
            });
        });
    }

    function closeStoriesToHome() {
        if (appState.mode !== 'stories' || !appState.stories.started) return;
        clearPlaybackTimers();
        stopStoryCaptionSequence();
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');

        const storyScreen = UI.containers.storiesCard?.querySelector('.story-screen');
        if (storyScreen) {
            const rect = storyScreen.getBoundingClientRect();
            const ghost = storyScreen.cloneNode(true);
            ghost.classList.remove('story-screen--enter-next', 'story-screen--enter-prev');
            ghost.classList.add('story-screen-closing-ghost');
            ghost.style.top = `${rect.top}px`;
            ghost.style.left = `${rect.left}px`;
            ghost.style.width = `${rect.width}px`;
            ghost.style.height = `${rect.height}px`;
            document.body.appendChild(ghost);

            UI.navigateHash('#/');

            requestAnimationFrame(() => {
                ghost.classList.add('story-screen--closing');
            });
            window.setTimeout(() => {
                ghost.remove();
            }, 320);
            return;
        }

        UI.navigateHash('#/');
    }

    function bindExploraGestures() {
        const storyCard = document.getElementById('stories-card');
        if (!storyCard) return;
        storyCard.style.touchAction = 'none';

        storyCard.onwheel = null;
        storyCard.onpointerdown = null;
        storyCard.onpointerup = null;
        storyCard.onpointercancel = null;
        storyCard.onpointerleave = null;
        storyCard.ontouchstart = null;
        storyCard.ontouchend = null;
        storyCard.ontouchcancel = null;

        storyCard.onwheel = (event) => {
            if (appState.mode !== 'stories' || !appState.stories.started) return;
            const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (Math.abs(dominantDelta) < 22) return;
            if (exploraWheelLocked) return;
            event.preventDefault();
            exploraWheelLocked = true;
            if (dominantDelta > 0) {
                moveToNextStory();
            } else {
                moveToPrevStory();
            }
            setTimeout(() => { exploraWheelLocked = false; }, 260);
        };

        const isInteractiveTarget = (target) => {
            if (!(target instanceof Element)) return false;
            // Lateral nav zones should still allow swipe detection.
            if (target.closest('.story-nav-zone')) return false;
            return Boolean(target.closest('button, a, input, select, textarea, label'));
        };

        storyCard.onpointerdown = (event) => {
            if (appState.mode !== 'stories' || !appState.stories.started) return;
            if (isInteractiveTarget(event.target)) return;
            exploraTouchStart = { x: event.clientX, y: event.clientY };
            if (typeof storyCard.setPointerCapture === 'function') {
                try {
                    storyCard.setPointerCapture(event.pointerId);
                } catch {
                    // Ignore capture failures.
                }
            }
            pausePlayback();
            exploraWasPausedByHold = true;
        };

        const releaseHold = (event) => {
            if (exploraWasPausedByHold && event && exploraTouchStart) {
                const deltaX = event.clientX - exploraTouchStart.x;
                const deltaY = event.clientY - exploraTouchStart.y;
                const isDownSwipeToClose = deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX) * 1.15;
                if (isDownSwipeToClose) {
                    exploraTouchStart = null;
                    exploraWasPausedByHold = false;
                    closeStoriesToHome();
                    return;
                }
                const isHorizontalSwipe = Math.abs(deltaX) > 46 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
                if (isHorizontalSwipe) {
                    exploraTouchStart = null;
                    exploraWasPausedByHold = false;
                    if (deltaX > 0) {
                        moveToPrevStory();
                    } else {
                        moveToNextStory();
                    }
                    return;
                }
            }

            exploraTouchStart = null;
            if (!exploraWasPausedByHold) return;
            exploraWasPausedByHold = false;
            resumePlayback();
        };

        storyCard.onpointerup = releaseHold;
        storyCard.onpointercancel = releaseHold;
        storyCard.onpointerleave = releaseHold;

        const getTouchPoint = (event) => {
            const touch = event?.changedTouches?.[0] || event?.touches?.[0];
            if (!touch) return null;
            return { x: touch.clientX, y: touch.clientY };
        };

        storyCard.ontouchstart = (event) => {
            if (appState.mode !== 'stories' || !appState.stories.started) return;
            if (isInteractiveTarget(event.target)) return;
            const point = getTouchPoint(event);
            if (!point) return;
            exploraTouchStart = point;
            pausePlayback();
            exploraWasPausedByHold = true;
        };

        storyCard.ontouchend = (event) => {
            if (!exploraWasPausedByHold || !exploraTouchStart) return;
            const point = getTouchPoint(event);
            if (point) {
                const deltaX = point.x - exploraTouchStart.x;
                const deltaY = point.y - exploraTouchStart.y;
                const isDownSwipeToClose = deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX) * 1.15;
                if (isDownSwipeToClose) {
                    exploraTouchStart = null;
                    exploraWasPausedByHold = false;
                    closeStoriesToHome();
                    return;
                }
                const isHorizontalSwipe = Math.abs(deltaX) > 46 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
                if (isHorizontalSwipe) {
                    exploraTouchStart = null;
                    exploraWasPausedByHold = false;
                    if (deltaX > 0) {
                        moveToPrevStory();
                    } else {
                        moveToNextStory();
                    }
                    return;
                }
            }
            exploraTouchStart = null;
            exploraWasPausedByHold = false;
            resumePlayback();
        };

        storyCard.ontouchcancel = () => {
            exploraTouchStart = null;
            if (!exploraWasPausedByHold) return;
            exploraWasPausedByHold = false;
            resumePlayback();
        };
    }

    function clearPlaybackTimers() {
        if (exploraAutoAdvanceTimer) {
            clearTimeout(exploraAutoAdvanceTimer);
            exploraAutoAdvanceTimer = null;
        }

        if (exploraProgressRaf) {
            cancelAnimationFrame(exploraProgressRaf);
            exploraProgressRaf = null;
        }
    }

    function pausePlayback() {
        if (exploraIsPaused) return;
        if (appState.mode !== 'stories' || !appState.stories.started) return;
        exploraIsPaused = true;
        clearPlaybackTimers();
        pauseStoryCaptionSequence();
        document.body.classList.add('explora-paused');
    }

    function resumePlayback() {
        if (!exploraIsPaused) return;
        if (appState.mode !== 'stories' || !appState.stories.started) return;
        exploraIsPaused = false;
        resumeStoryCaptionSequence();
        document.body.classList.remove('explora-paused');
        scheduleAutoAdvance();
    }

    function scheduleAutoAdvance() {
        clearPlaybackTimers();
        if (appState.mode !== 'stories' || !appState.stories.started || exploraIsPaused) return;
        const storyDurationMs = Math.max(
            EXPLORA_MIN_STORY_DURATION_MS,
            Number(appState.stories.currentDurationMs) || EXPLORA_MIN_STORY_DURATION_MS
        );

        const progressFill = document.getElementById('story-progress-fill-live');
        if (progressFill) {
            progressFill.style.width = appState.stories.feed.length <= 1 ? '100%' : '0%';
        }

        if (appState.stories.feed.length <= 1) return;

        const startTime = performance.now() - exploraPlaybackElapsedMs;
        const animate = (now) => {
            if (appState.mode !== 'stories' || !appState.stories.started || exploraIsPaused) return;

            const fillEl = document.getElementById('story-progress-fill-live');
            const elapsed = now - startTime;
            exploraPlaybackElapsedMs = Math.min(elapsed, storyDurationMs);
            const ratio = Math.min(1, elapsed / storyDurationMs);

            if (fillEl) {
                fillEl.style.width = `${(ratio * 100).toFixed(2)}%`;
            }

            if (ratio >= 1) {
                moveToNextStory();
                return;
            }

            exploraProgressRaf = requestAnimationFrame(animate);
        };

        exploraProgressRaf = requestAnimationFrame(animate);

        // Fallback timer for browsers that heavily throttle animation frames.
        const remainingMs = Math.max(0, storyDurationMs - exploraPlaybackElapsedMs);
        exploraAutoAdvanceTimer = window.setTimeout(() => {
            if (appState.mode !== 'stories' || !appState.stories.started || exploraIsPaused) return;
            moveToNextStory();
        }, remainingMs + 250);
    }

    function moveToNextStory() {
        if (!appState.stories.feed.length) return;
        appState.stories.transitionDirection = 'next';
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        clearPlaybackTimers();
        appState.stories.currentIndex = (appState.stories.currentIndex + 1) % appState.stories.feed.length;
        renderCurrentStoryCard();
    }

    function moveToPrevStory() {
        if (!appState.stories.feed.length) return;
        appState.stories.transitionDirection = 'prev';
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        clearPlaybackTimers();
        const total = appState.stories.feed.length;
        appState.stories.currentIndex = (appState.stories.currentIndex - 1 + total) % total;
        renderCurrentStoryCard();
    }

    function startFeed() {
        const topicSelect = document.getElementById('explora-topic-select');

        setSelectedPartyIds(getSelectedPartyIds(), { ensureOne: true });
        appState.stories.selectedTopic = topicSelect?.value || CATEGORIES[0]?.name || '';
        appState.stories.feed = buildStoriesFeed();
        appState.stories.currentIndex = 0;
        appState.stories.currentDurationMs = EXPLORA_MIN_STORY_DURATION_MS;
        appState.stories.transitionDirection = 'next';
        appState.stories.started = true;
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        clearPlaybackTimers();

        syncExploraSetupUI();
        renderCurrentStoryCard();
        bindExploraGestures();
        requestExploraFullscreen();
    }

    function renderPrototype() {
        populateExploraFilters();
        syncExploraSetupUI();

        if (appState.stories.started) {
            if (!appState.stories.feed.length) {
                appState.stories.feed = buildStoriesFeed();
                appState.stories.currentIndex = 0;
            }
            renderCurrentStoryCard();
        }
    }

    function setSource(source) {
        appState.stories.source = source || 'random';
        if (appState.stories.source === 'party') {
            setSelectedPartyIds(getSelectedPartyIds(), { ensureOne: true });
            renderPartyPills();
        }
        syncExploraSetupUI();
    }

    function handleKeydown(event) {
        if (appState.mode !== 'stories') return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
            event.preventDefault();
            moveToNextStory();
            return true;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp') {
            event.preventDefault();
            moveToPrevStory();
            return true;
        }
        return false;
    }

    function resetForRouteEnter() {
        clearPlaybackTimers();
        stopStoryCaptionSequence();
        appState.stories.started = false;
        appState.stories.feed = [];
        appState.stories.currentIndex = 0;
        appState.stories.currentDurationMs = EXPLORA_MIN_STORY_DURATION_MS;
        appState.stories.transitionDirection = 'next';
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        exitExploraFullscreenIfActive();
    }

    function teardownForRouteLeave() {
        clearPlaybackTimers();
        stopStoryCaptionSequence();
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        exitExploraFullscreenIfActive();
    }

    return {
        setSource,
        startFeed,
        renderPrototype,
        handleKeydown,
        resetForRouteEnter,
        teardownForRouteLeave
    };
}
