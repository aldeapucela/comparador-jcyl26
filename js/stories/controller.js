import { PARTIES, CATEGORIES } from '../api.js';
import { UI } from '../ui.js';
import { StoriesView } from './view.js';
import { isStorySaved, toggleSavedStory } from './saved.js';

const EXPLORA_CAPTION_STEP_MS = 850;
const EXPLORA_AFTER_LAST_BLOCK_MS = 6500;
const EXPLORA_MIN_STORY_DURATION_MS = 7000;
const EXPLORA_ENGAGEMENT_DURATION_MS = 12000;
const EXPLORA_SEEN_STORIES_STORAGE_KEY = 'explora_seen_stories_v1';
const EXPLORA_SHARE_ENGAGEMENT_STORAGE_KEY = 'explora_share_engagement_v1';
const EXPLORA_TELEGRAM_INTERSTITIAL_STORAGE_KEY = 'explora_telegram_interstitial_v1';
const EXPLORA_AFINIDAD_INTERSTITIAL_STORAGE_KEY = 'explora_afinidad_interstitial_v1';
const EXPLORA_CANDIDATE_VIDEO_SEEN_STORAGE_KEY = 'explora_candidate_video_seen_v1';
const EXPLORA_CANDIDATE_VIDEO_MUTED_STORAGE_KEY = 'explora_candidate_video_muted_v1';
const SAVE_TOAST_ID = 'story-save-toast';
const TELEGRAM_CHAT_URL = 'https://t.me/aldeapucela/115494';
const INTERSTITIAL_POSITION_TELEGRAM = 6;
const INTERSTITIAL_POSITION_AFINIDAD = 9;
const TELEGRAM_TARGET_ZONE = 'valladolid';

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
    let activeInterstitial = null;
    let engagementSessionViewedCount = 0;
    let engagementSessionNextPromptAt = 10;
    let afinidadSessionNextPromptAt = INTERSTITIAL_POSITION_AFINIDAD;
    let lastInterstitialViewedCount = -1000;
    const interstitialShownInSession = new Set();
    const partyVideoShownInSession = new Set();
    const candidateVideoByAnchorIndex = new Map();
    const warmedCandidateVideoPaths = new Set();
    let candidateVideoMutedPreference = readCandidateVideoMutedPreference();
    let trackingModeName = '';
    let trackingSessionEnded = false;
    let trackingLifecycleBound = false;
    const escapeHtml = (value = '') => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const SHARE_PROMPT_FIRST_THRESHOLD = 10;
    const SHARE_PROMPT_REPEAT_INTERVAL = 15;
    const AFINIDAD_PROMPT_FIRST_THRESHOLD = INTERSTITIAL_POSITION_AFINIDAD;
    const AFINIDAD_PROMPT_REPEAT_INTERVAL = 20;
    const INTERSTITIAL_GLOBAL_COOLDOWN_STORIES = 3;

    const INTERSTITIAL_STORIES = [
        {
            id: 'afinidad-promo',
            placement: {
                type: 'viewed-count',
                firstAt: AFINIDAD_PROMPT_FIRST_THRESHOLD,
                repeatEvery: AFINIDAD_PROMPT_REPEAT_INTERVAL
            },
            durationMs: EXPLORA_ENGAGEMENT_DURATION_MS,
            shouldShow() {
                const state = readAfinidadInterstitialState();
                if (state.optOut) return false;
                if (hasCompletedAfinidadTest()) return false;
                return engagementSessionViewedCount >= afinidadSessionNextPromptAt;
            },
            onShow() {
                consumeAfinidadPrompt();
            },
            render() {
                StoriesView.renderAfinidadInterstitialCard(UI.containers.storiesCard, {
                    transitionDirection: appState.stories.transitionDirection
                });
            },
            bindActions() {
                const afinidadBtn = document.getElementById('btn-story-afinidad-start');
                if (afinidadBtn) {
                    const stopTapPropagation = (event) => event.stopPropagation();
                    afinidadBtn.addEventListener('pointerdown', stopTapPropagation);
                    afinidadBtn.addEventListener('touchstart', stopTapPropagation, { passive: true });
                    afinidadBtn.addEventListener('click', () => {
                        if (typeof _paq !== 'undefined') {
                            _paq.push(['trackEvent', 'Conversion', 'AfinidadStory', 'Click']);
                        }
                        UI.navigateHash('#/afinidad');
                    });
                }

                const afinidadOptOutBtn = document.getElementById('btn-story-afinidad-optout');
                if (afinidadOptOutBtn) {
                    const stopTapPropagation = (event) => event.stopPropagation();
                    afinidadOptOutBtn.addEventListener('pointerdown', stopTapPropagation);
                    afinidadOptOutBtn.addEventListener('touchstart', stopTapPropagation, { passive: true });
                    afinidadOptOutBtn.addEventListener('click', () => {
                        markAfinidadInterstitialOptOut();
                        clearActiveInterstitialAndContinue();
                    });
                }
            }
        },
        {
            id: 'party-candidate-video',
            placement: {
                type: 'dynamic'
            },
            durationMs: EXPLORA_ENGAGEMENT_DURATION_MS,
            shouldShow(context = {}) {
                const party = context.story?.party;
                const partyId = party?.id || '';
                const videoPath = party?.storyVideo?.path || '';
                if (!partyId || !videoPath || party?.storyVideo?.enabled === false) return false;
                if (partyVideoShownInSession.has(partyId)) return false;
                if (hasCandidateVideoBeenSeen(partyId)) return false;

            if (appState.stories.source === 'party') {
                    const selectedPartyIds = getSelectedPartyIds({ allowOutOfProvince: true });
                    if (selectedPartyIds.length !== 1 || selectedPartyIds[0] !== partyId) return false;
                    const nextIndex = (appState.stories.currentIndex + 1) % appState.stories.feed.length;
                    const nextPosition = nextIndex + 1;
                    return nextPosition === 2;
                }

                if (appState.stories.source === 'random' || appState.stories.source === 'topic') return true;

                return false;
            },
            onShow(context = {}) {
                const partyId = context.story?.party?.id;
                if (partyId) partyVideoShownInSession.add(partyId);
                if (partyId) markCandidateVideoAsSeen(partyId);
                const anchorIndex = Number(context.anchorIndex);
                if (Number.isInteger(anchorIndex)) {
                    candidateVideoByAnchorIndex.set(anchorIndex, {
                        id: 'party-candidate-video',
                        context: {
                            ...context,
                            anchorIndex
                        }
                    });
                }
            },
            render(context = {}) {
                const story = context.story;
                if (!story?.party?.storyVideo?.path) return;
                StoriesView.renderCandidateVideoCard(UI.containers.storiesCard, {
                    transitionDirection: appState.stories.transitionDirection,
                    party: story.party,
                    videoPath: story.party.storyVideo.path
                });
            },
            bindActions(context = {}) {
                const partyId = context.story?.party?.id;
                const partyName = context.story?.party?.name || 'Candidato';
                const videoPath = context.story?.party?.storyVideo?.path || '';
                UI.containers.storiesCard.querySelectorAll('.btn-story-party').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        if (!partyId) return;
                        UI.navigateHash(`#/${partyId}`);
                    });
                });

                const shareBtn = document.getElementById('btn-story-video-share');
                if (shareBtn) {
                    const stopTapPropagation = (event) => event.stopPropagation();
                    shareBtn.addEventListener('pointerdown', stopTapPropagation);
                    shareBtn.addEventListener('touchstart', stopTapPropagation, { passive: true });
                    shareBtn.addEventListener('click', async () => {
                        await shareCandidateVideoFile(videoPath, partyName, partyId, shareBtn);
                    });
                }

                const videoEl = document.getElementById('story-candidate-video-player');
                if (!videoEl) return;
                const audioToggleBtn = document.getElementById('btn-story-video-audio-toggle');
                const loadingEl = document.getElementById('story-candidate-video-loading');
                const showVideoLoading = () => loadingEl?.classList.remove('is-hidden');
                const hideVideoLoading = () => loadingEl?.classList.add('is-hidden');

                showVideoLoading();

                if (audioToggleBtn) {
                    const stopTapPropagation = (event) => event.stopPropagation();
                    audioToggleBtn.addEventListener('pointerdown', stopTapPropagation);
                    audioToggleBtn.addEventListener('touchstart', stopTapPropagation, { passive: true });
                    audioToggleBtn.addEventListener('click', () => {
                        videoEl.muted = !videoEl.muted;
                        candidateVideoMutedPreference = Boolean(videoEl.muted);
                        writeCandidateVideoMutedPreference(candidateVideoMutedPreference);
                        syncCandidateVideoAudioToggleUI(videoEl);
                    });
                }

                const tryAutoplay = () => {
                    videoEl.muted = Boolean(candidateVideoMutedPreference);
                    syncCandidateVideoAudioToggleUI(videoEl);
                    videoEl.volume = 1;
                    const playPromise = videoEl.play();
                    if (playPromise?.catch) {
                        playPromise.catch(() => {
                            // Autoplay may be blocked by browser policies.
                        });
                    }
                };

                videoEl.addEventListener('loadedmetadata', () => {
                    const durationMs = Math.round((Number(videoEl.duration) || 0) * 1000);
                    if (durationMs > 0) {
                        appState.stories.currentDurationMs = Math.max(EXPLORA_MIN_STORY_DURATION_MS, durationMs);
                        exploraPlaybackElapsedMs = 0;
                        scheduleAutoAdvance();
                    }
                });
                videoEl.addEventListener('loadeddata', hideVideoLoading);
                videoEl.addEventListener('canplay', hideVideoLoading);
                videoEl.addEventListener('playing', hideVideoLoading);
                videoEl.addEventListener('waiting', showVideoLoading);
                videoEl.addEventListener('stalled', showVideoLoading);
                videoEl.addEventListener('error', showVideoLoading);

                videoEl.addEventListener('ended', () => {
                    clearActiveInterstitialAndContinue();
                });

                tryAutoplay();
            }
        },
        {
            id: 'telegram-promo',
            placement: {
                type: 'position',
                positions: [INTERSTITIAL_POSITION_TELEGRAM]
            },
            durationMs: EXPLORA_ENGAGEMENT_DURATION_MS,
            shouldShow() {
                const selectedZone = String(appState?.selectedZone || '').trim().toLowerCase();
                return !isTelegramConverted() && selectedZone === TELEGRAM_TARGET_ZONE;
            },
            onShow() {
                interstitialShownInSession.add('telegram-promo');
            },
            render() {
                StoriesView.renderTelegramInterstitialCard(UI.containers.storiesCard, {
                    transitionDirection: appState.stories.transitionDirection
                });
            },
            bindActions() {
                const telegramBtn = document.getElementById('btn-story-telegram-join');
                if (!telegramBtn) return;
                const stopTapPropagation = (event) => event.stopPropagation();
                telegramBtn.addEventListener('pointerdown', stopTapPropagation);
                telegramBtn.addEventListener('touchstart', stopTapPropagation, { passive: true });
                telegramBtn.addEventListener('click', () => {
                    if (typeof _paq !== 'undefined') {
                        _paq.push(['trackEvent', 'Conversion', 'TelegramStory', 'Posicion_6']);
                    }
                    markTelegramConverted();
                    window.open(TELEGRAM_CHAT_URL, '_blank', 'noopener,noreferrer');
                    clearActiveInterstitialAndContinue();
                });
            }
        },
        {
            id: 'share-engagement',
            placement: {
                type: 'viewed-count',
                firstAt: SHARE_PROMPT_FIRST_THRESHOLD,
                repeatEvery: SHARE_PROMPT_REPEAT_INTERVAL
            },
            durationMs: EXPLORA_ENGAGEMENT_DURATION_MS,
            shouldShow() {
                const state = readShareEngagementState();
                if (state.shared || state.optOut) return false;
                return engagementSessionViewedCount >= engagementSessionNextPromptAt;
            },
            onShow() {
                consumeShareEngagementPrompt();
            },
            render() {
                StoriesView.renderEngagementShareCard(UI.containers.storiesCard, {
                    transitionDirection: appState.stories.transitionDirection
                });
            },
            bindActions() {
                const engagementShareBtn = document.getElementById('btn-story-engagement-share');
                if (engagementShareBtn) {
                    const stopTapPropagation = (event) => event.stopPropagation();
                    engagementShareBtn.addEventListener('pointerdown', stopTapPropagation);
                    engagementShareBtn.addEventListener('touchstart', stopTapPropagation, { passive: true });
                    engagementShareBtn.addEventListener('click', async () => {
                        const result = await shareCurrentWebsite(engagementShareBtn);
                        if (!result?.success) return;
                        markEngagementShared();
                        if (result.method !== 'web_share') return;
                        clearActiveInterstitialAndContinue();
                    });
                }

                const engagementOptOutBtn = document.getElementById('btn-story-engagement-optout');
                if (engagementOptOutBtn) {
                    const stopTapPropagation = (event) => event.stopPropagation();
                    engagementOptOutBtn.addEventListener('pointerdown', stopTapPropagation);
                    engagementOptOutBtn.addEventListener('touchstart', stopTapPropagation, { passive: true });
                    engagementOptOutBtn.addEventListener('click', () => {
                        markEngagementOptOut();
                        clearActiveInterstitialAndContinue();
                    });
                }
            }
        }
    ];

    function readShareEngagementState() {
        try {
            const raw = localStorage.getItem(EXPLORA_SHARE_ENGAGEMENT_STORAGE_KEY);
            if (!raw) {
                return {
                    shared: false,
                    optOut: false
                };
            }
            const parsed = JSON.parse(raw);
            return {
                shared: Boolean(parsed?.shared),
                optOut: Boolean(parsed?.optOut)
            };
        } catch {
            return {
                shared: false,
                optOut: false
            };
        }
    }

    function writeShareEngagementState(state = {}) {
        try {
            localStorage.setItem(EXPLORA_SHARE_ENGAGEMENT_STORAGE_KEY, JSON.stringify({
                shared: Boolean(state.shared),
                optOut: Boolean(state.optOut)
            }));
        } catch {
            // Ignore storage quota/privacy failures.
        }
    }

    function incrementViewedStoriesCount() {
        engagementSessionViewedCount += 1;
        return engagementSessionViewedCount;
    }

    function toSlug(value = '') {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function buildTrackingModeName() {
        const source = String(appState.stories.source || 'random');
        if (source === 'topic') {
            return `topic:${toSlug(appState.stories.selectedTopic || CATEGORIES[0]?.name || 'general') || 'general'}`;
        }
        if (source === 'party') {
            const parties = getSelectedPartyIds({ allowOutOfProvince: true })
                .map((id) => String(id || '').trim())
                .filter(Boolean)
                .sort();
            return parties.length ? `parties:${parties.join(',')}` : 'parties:none';
        }
        return 'random';
    }

    function trackStoriesEvent(action = '', name = '', value = null) {
        const paq = window._paq = window._paq || [];
        const cleanAction = String(action || '').trim();
        const cleanName = String(name || '').trim();
        if (!cleanAction || !cleanName) return;

        if (Number.isFinite(value)) {
            paq.push(['trackEvent', 'Stories', cleanAction, cleanName, Number(value)]);
            return;
        }

        paq.push(['trackEvent', 'Stories', cleanAction, cleanName]);
    }

    function getStoriesPlayRouteMeta(modeName = '') {
        const cleanMode = String(modeName || '').trim();
        if (!cleanMode) return null;

        let hash = '#/explora/play/random';
        let title = 'Explora Play: Random - CyL 2026';
        if (cleanMode.startsWith('topic:')) {
            const topicSlug = cleanMode.slice('topic:'.length) || 'general';
            hash = `#/explora/play/topic/${topicSlug}`;
            title = `Explora Play: Tema ${topicSlug} - CyL 2026`;
        } else if (cleanMode.startsWith('parties:')) {
            const partiesValue = cleanMode.slice('parties:'.length) || 'none';
            hash = `#/explora/play/parties/${partiesValue}`;
            title = `Explora Play: Partidos ${partiesValue} - CyL 2026`;
        }

        return { hash, title };
    }

    function trackStoriesVirtualPageView(modeName = '') {
        const paq = window._paq = window._paq || [];
        const meta = getStoriesPlayRouteMeta(modeName);
        if (!meta) return;
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        paq.push(['setCustomUrl', `${baseUrl}${meta.hash}`]);
        paq.push(['setDocumentTitle', meta.title]);
        paq.push(['trackPageView']);
    }

    function syncStoriesBrowserHash(modeName = '') {
        const meta = getStoriesPlayRouteMeta(modeName);
        if (!meta) return false;

        const target = `${window.location.pathname}${window.location.search}${meta.hash}`;
        const current = `${window.location.pathname}${window.location.search}${window.location.hash || '#/'}`;
        if (target === current) return false;
        window.history.replaceState(null, '', target);
        return true;
    }

    function startTrackingSession() {
        trackingModeName = buildTrackingModeName();
        trackingSessionEnded = false;
        const didSyncHash = syncStoriesBrowserHash(trackingModeName);
        if (didSyncHash) {
            trackStoriesVirtualPageView(trackingModeName);
        }
        trackStoriesEvent('Start', trackingModeName);
    }

    function endTrackingSession() {
        if (trackingSessionEnded || !trackingModeName) return;
        trackingSessionEnded = true;
        trackStoriesEvent('End', trackingModeName, engagementSessionViewedCount);
    }

    function bindTrackingLifecycle() {
        if (trackingLifecycleBound) return;
        trackingLifecycleBound = true;

        window.addEventListener('pagehide', () => {
            if (!appState.stories.started) return;
            endTrackingSession();
        });
    }

    function markEngagementShared() {
        const current = readShareEngagementState();
        writeShareEngagementState({
            ...current,
            shared: true
        });
    }

    function markEngagementOptOut() {
        const current = readShareEngagementState();
        writeShareEngagementState({
            ...current,
            optOut: true
        });
    }

    function isTelegramConverted() {
        try {
            const raw = localStorage.getItem(EXPLORA_TELEGRAM_INTERSTITIAL_STORAGE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Boolean(parsed?.converted);
        } catch {
            return false;
        }
    }

    function markTelegramConverted() {
        try {
            localStorage.setItem(EXPLORA_TELEGRAM_INTERSTITIAL_STORAGE_KEY, JSON.stringify({
                converted: true,
                convertedAt: Date.now()
            }));
        } catch {
            // Ignore storage quota/privacy failures.
        }
    }

    function consumeShareEngagementPrompt() {
        engagementSessionNextPromptAt = Math.max(
            SHARE_PROMPT_FIRST_THRESHOLD,
            engagementSessionNextPromptAt + SHARE_PROMPT_REPEAT_INTERVAL
        );
        return engagementSessionNextPromptAt;
    }

    function readAfinidadInterstitialState() {
        try {
            const raw = localStorage.getItem(EXPLORA_AFINIDAD_INTERSTITIAL_STORAGE_KEY);
            if (!raw) {
                return { optOut: false };
            }
            const parsed = JSON.parse(raw);
            return {
                optOut: Boolean(parsed?.optOut)
            };
        } catch {
            return { optOut: false };
        }
    }

    function writeAfinidadInterstitialState(state = {}) {
        try {
            localStorage.setItem(EXPLORA_AFINIDAD_INTERSTITIAL_STORAGE_KEY, JSON.stringify({
                optOut: Boolean(state.optOut)
            }));
        } catch {
            // Ignore storage quota/privacy failures.
        }
    }

    function markAfinidadInterstitialOptOut() {
        const current = readAfinidadInterstitialState();
        writeAfinidadInterstitialState({
            ...current,
            optOut: true
        });
    }

    function consumeAfinidadPrompt() {
        afinidadSessionNextPromptAt = Math.max(
            AFINIDAD_PROMPT_FIRST_THRESHOLD,
            afinidadSessionNextPromptAt + AFINIDAD_PROMPT_REPEAT_INTERVAL
        );
        return afinidadSessionNextPromptAt;
    }

    function hasCompletedAfinidadTest() {
        try {
            const raw = localStorage.getItem('afinidad_answers_latest');
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Boolean(parsed?.completed && parsed?.results);
        } catch {
            return false;
        }
    }

    function readSeenCandidateVideoPartyIds() {
        try {
            const raw = localStorage.getItem(EXPLORA_CANDIDATE_VIDEO_SEEN_STORAGE_KEY);
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean));
        } catch {
            return new Set();
        }
    }

    function readCandidateVideoMutedPreference() {
        try {
            return localStorage.getItem(EXPLORA_CANDIDATE_VIDEO_MUTED_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    }

    function writeCandidateVideoMutedPreference(isMuted = false) {
        try {
            localStorage.setItem(EXPLORA_CANDIDATE_VIDEO_MUTED_STORAGE_KEY, isMuted ? '1' : '0');
        } catch {
            // Ignore storage failures.
        }
    }

    function syncCandidateVideoAudioToggleUI(videoEl = null) {
        const audioToggleBtn = document.getElementById('btn-story-video-audio-toggle');
        if (!audioToggleBtn || !videoEl) return;
        const muted = Boolean(videoEl.muted);
        const icon = audioToggleBtn.querySelector('i');
        audioToggleBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
        audioToggleBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar vídeo');
        audioToggleBtn.title = muted ? 'Activar sonido' : 'Silenciar vídeo';
        if (icon) {
            icon.classList.toggle('fa-volume-high', !muted);
            icon.classList.toggle('fa-volume-xmark', muted);
        }
    }

    function resumeActiveVideoPlayback(videoEl = null) {
        if (!videoEl) return;
        videoEl.muted = Boolean(candidateVideoMutedPreference);
        syncCandidateVideoAudioToggleUI(videoEl);
        const playPromise = videoEl.play();
        if (playPromise?.catch) {
            playPromise.catch(() => {
                // Ignore play errors if browser blocks resume.
            });
        }
    }

    function writeSeenCandidateVideoPartyIds(idsSet = new Set()) {
        try {
            localStorage.setItem(EXPLORA_CANDIDATE_VIDEO_SEEN_STORAGE_KEY, JSON.stringify(Array.from(idsSet)));
        } catch {
            // Ignore storage failures.
        }
    }

    function hasCandidateVideoBeenSeen(partyId = '') {
        const id = String(partyId || '').trim();
        if (!id) return false;
        return readSeenCandidateVideoPartyIds().has(id);
    }

    function markCandidateVideoAsSeen(partyId = '') {
        const id = String(partyId || '').trim();
        if (!id) return;
        const seen = readSeenCandidateVideoPartyIds();
        if (seen.has(id)) return;
        seen.add(id);
        writeSeenCandidateVideoPartyIds(seen);
    }

    function getInterstitialById(id) {
        return INTERSTITIAL_STORIES.find((item) => item.id === id) || null;
    }

    function getCurrentStory() {
        if (!appState.stories.feed.length) return null;
        const index = appState.stories.currentIndex % appState.stories.feed.length;
        return appState.stories.feed[index] || null;
    }

    function matchesInterstitialPlacement(definition) {
        if (!appState.stories.feed.length) return false;
        const placement = definition?.placement || {};

        if (placement.type === 'position') {
            const positions = Array.isArray(placement.positions) ? placement.positions : [];
            if (!positions.length) return false;
            const nextIndex = (appState.stories.currentIndex + 1) % appState.stories.feed.length;
            const nextPosition = nextIndex + 1;
            return positions.includes(nextPosition);
        }

        if (placement.type === 'dynamic') {
            return Boolean(getCurrentStory()?.party?.id);
        }

        if (placement.type === 'viewed-count') {
            const firstAt = Number(placement.firstAt) || SHARE_PROMPT_FIRST_THRESHOLD;
            return engagementSessionViewedCount >= Math.max(1, firstAt);
        }

        return false;
    }

    function shouldShowInterstitial(definition, context = {}) {
        if (!definition) return false;
        const placementType = definition.placement?.type;
        if (interstitialShownInSession.has(definition.id) && definition.placement?.type === 'position') {
            return false;
        }
        // Keep fixed-position interstitials deterministic (e.g. Telegram at #6).
        // Cooldown applies to non-position prompts to avoid suggestion clustering.
        if (placementType !== 'position'
            && engagementSessionViewedCount - lastInterstitialViewedCount < INTERSTITIAL_GLOBAL_COOLDOWN_STORIES) {
            return false;
        }
        if (!matchesInterstitialPlacement(definition)) return false;
        return definition.shouldShow ? definition.shouldShow(context) : true;
    }

    function getNextInterstitialToShow() {
        if (!appState.stories.feed.length) return null;
        const context = {
            story: getCurrentStory(),
            anchorIndex: appState.stories.currentIndex
        };
        const byPriority = [
            ...INTERSTITIAL_STORIES.filter((item) => item?.placement?.type === 'position'),
            ...INTERSTITIAL_STORIES.filter((item) => item?.placement?.type !== 'position')
        ];
        for (const definition of byPriority) {
            if (!shouldShowInterstitial(definition, context)) continue;
            return {
                id: definition.id,
                context
            };
        }
        return null;
    }

    function clearActiveInterstitialAndContinue() {
        if (!activeInterstitial) return;
        activeInterstitial = null;
        moveToNextStory();
    }

    function warmCandidateVideo(videoPath = '') {
        const path = String(videoPath || '').trim();
        if (!path || warmedCandidateVideoPaths.has(path)) return;
        warmedCandidateVideoPaths.add(path);

        try {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'video';
            preloadLink.href = path;
            preloadLink.crossOrigin = 'anonymous';
            document.head.appendChild(preloadLink);
        } catch {
            // Ignore preload link failures.
        }

        try {
            const warmupVideo = document.createElement('video');
            warmupVideo.preload = 'auto';
            warmupVideo.muted = true;
            warmupVideo.playsInline = true;
            warmupVideo.src = path;
            warmupVideo.load();
        } catch {
            // Ignore warmup failures.
        }
    }

    async function shareCurrentWebsite(btn) {
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        const url = `${baseUrl}?utm_source=share-story`;
        const shareBody = 'Descubre el comparador de programas de las elecciones a las Cortes de Castilla y León y a qué partido eres más afín';
        const fullMessage = `${shareBody}\n\n${url}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Elecciones Castilla y León 2026',
                    text: shareBody,
                    url
                });
                const currentStory = appState.stories.currentStory;
                if (currentStory) {
                    UI.trackStoryShareEvent(currentStory.party, currentStory.categoryName, currentStory.proposal, 'engagement_web_share');
                }
                return { success: true, method: 'web_share' };
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error sharing engagement prompt:', err);
                return { success: false, method: 'web_share' };
            }
        }

        try {
            await navigator.clipboard.writeText(fullMessage);
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Copiado</span>';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 1800);
            }
            return { success: true, method: 'clipboard' };
        } catch (err) {
            console.error('Failed to copy engagement share:', err);
            return { success: false, method: 'clipboard' };
        }
    }

    function sanitizeFilename(value = '') {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'candidato';
    }

    function trackCandidateVideoShare(partyId = '', method = '', outcome = 'success') {
        if (typeof _paq === 'undefined') return;
        _paq.push([
            'trackEvent',
            'Compartir',
            'VideoCandidato',
            `${partyId || 'unknown'}:${method || 'unknown'}:${outcome}`
        ]);
    }

    async function shareCandidateVideoFile(videoPath = '', partyName = '', partyId = '', btn = null) {
        if (!videoPath) return { success: false, method: 'none' };
        try {
            const response = await fetch(videoPath, { cache: 'force-cache' });
            if (!response.ok) throw new Error(`video-fetch-failed-${response.status}`);
            const blob = await response.blob();
            const filename = `video-candidato-${sanitizeFilename(partyName)}.mp4`;
            const file = new File([blob], filename, { type: blob.type || 'video/mp4' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Vídeo de ${partyName}`,
                    text: `Vídeo de ${partyName}`,
                    files: [file]
                });
                trackCandidateVideoShare(partyId, 'web_share_files', 'success');
                return { success: true, method: 'web_share_files' };
            }

            const objectUrl = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);

            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                window.setTimeout(() => { btn.innerHTML = original; }, 1400);
            }
            trackCandidateVideoShare(partyId, 'download_fallback', 'success');
            return { success: true, method: 'download_fallback' };
        } catch (error) {
            if (error?.name === 'AbortError') {
                trackCandidateVideoShare(partyId, 'web_share_files', 'cancel');
            } else {
                trackCandidateVideoShare(partyId, 'share_video', 'error');
                console.error('Failed to share candidate video:', error);
            }
            return { success: false, method: 'error' };
        }
    }

    function readSeenStoryIds() {
        try {
            const raw = localStorage.getItem(EXPLORA_SEEN_STORIES_STORAGE_KEY);
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.map((id) => String(id || '')).filter(Boolean));
        } catch {
            return new Set();
        }
    }

    function writeSeenStoryIds(idsSet = new Set()) {
        try {
            localStorage.setItem(EXPLORA_SEEN_STORIES_STORAGE_KEY, JSON.stringify(Array.from(idsSet)));
        } catch {
            // Ignore storage quota/privacy failures.
        }
    }

    function getStoryUniqueId(story) {
        const partyId = story?.party?.id || '';
        const proposalId = story?.proposal?.id || '';
        if (!partyId || !proposalId) return '';
        return `${partyId}:${proposalId}`;
    }

    function getStoryUniqueIdByParts(partyId, proposalId) {
        const cleanPartyId = String(partyId || '').trim();
        const cleanProposalId = String(proposalId || '').trim();
        if (!cleanPartyId || !cleanProposalId) return '';
        return `${cleanPartyId}:${cleanProposalId}`;
    }

    function markStoryAsSeen(story) {
        const storyId = getStoryUniqueId(story);
        if (!storyId) return;
        const seen = readSeenStoryIds();
        if (seen.has(storyId)) return;
        seen.add(storyId);
        writeSeenStoryIds(seen);
    }

    function countUnseenStoriesForParty(partyId, proposals = []) {
        if (!partyId || !Array.isArray(proposals) || proposals.length === 0) return 0;
        const seen = readSeenStoryIds();
        let unseenCount = 0;
        proposals.forEach((proposal) => {
            const proposalId = proposal?.id;
            const storyId = getStoryUniqueIdByParts(partyId, proposalId);
            if (!storyId) return;
            if (!seen.has(storyId)) unseenCount += 1;
        });
        return unseenCount;
    }

    function getSelectedPartyIds({ allowOutOfProvince = false } = {}) {
        const raw = Array.isArray(appState.stories.selectedPartyIds)
            ? appState.stories.selectedPartyIds
            : (appState.stories.selectedPartyId ? [appState.stories.selectedPartyId] : []);

        const allowed = allowOutOfProvince
            ? new Set(Object.keys(appState.allData || {}))
            : new Set(PARTIES.map((party) => party.id));
        const unique = [];
        raw.forEach((id) => {
            const normalized = String(id || '').trim();
            if (!normalized || !allowed.has(normalized) || unique.includes(normalized)) return;
            unique.push(normalized);
        });

        return unique;
    }

    function setSelectedPartyIds(ids = [], { ensureOne = false, allowOutOfProvince = false } = {}) {
        const allowed = allowOutOfProvince
            ? new Set(Object.keys(appState.allData || {}))
            : new Set(PARTIES.map((party) => party.id));
        const unique = [];
        (Array.isArray(ids) ? ids : []).forEach((id) => {
            const normalized = String(id || '').trim();
            if (!normalized || !allowed.has(normalized) || unique.includes(normalized)) return;
            unique.push(normalized);
        });

        const fallbackId = allowOutOfProvince
            ? Object.keys(appState.allData || {})[0]
            : PARTIES[0]?.id;

        if (ensureOne && unique.length === 0 && fallbackId) {
            unique.push(fallbackId);
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
                    next = current.filter((id) => id !== partyId);
                } else {
                    next = [...current, partyId];
                }

                setSelectedPartyIds(next, { ensureOne: false });
                renderPartyPills();
                syncExploraStartButtonState();
            });
        });
    }

    function canStartExplora() {
        if (appState.stories.source !== 'party') return true;
        return getSelectedPartyIds({ allowOutOfProvince: true }).length > 0;
    }

    function syncExploraStartButtonState() {
        const startBtn = document.getElementById('btn-explora-start');
        if (!startBtn) return;
        const canStart = canStartExplora();
        startBtn.disabled = !canStart;
        startBtn.setAttribute('aria-disabled', canStart ? 'false' : 'true');
        startBtn.title = canStart ? '' : 'Selecciona al menos un partido para empezar';
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
        const { source, selectedTopic } = appState.stories;
        const selectedPartyIds = getSelectedPartyIds({ allowOutOfProvince: source === 'party' });
        const selectedSet = new Set(selectedPartyIds);
        const visibleProvincePartyIds = new Set(PARTIES.map((party) => party.id));
        const allPartiesCatalog = Array.isArray(appState.allPartiesCatalog) ? appState.allPartiesCatalog : [];
        const allItems = [];

        Object.entries(appState.allData).forEach(([partyId, partyData]) => {
            const partyInfo = PARTIES.find((party) => party.id === partyId)
                || allPartiesCatalog.find((party) => party.id === partyId);
            if (!partyInfo || !Array.isArray(partyData?.propuestas)) return;
            if (source !== 'party' && !visibleProvincePartyIds.has(partyId)) return;
            if (source === 'party' && selectedSet.size > 0 && !selectedSet.has(partyId)) return;

            partyData.propuestas.forEach((proposal) => {
                allItems.push({
                    party: partyInfo,
                    proposal,
                    categoryName: proposal.categoria || 'General'
                });
            });
        });

        let filtered = allItems;

        if (source === 'party' && selectedPartyIds.length > 0) {
            filtered = filtered.filter((item) => selectedSet.has(item.party.id));
        }

        if (source === 'topic' && selectedTopic) {
            filtered = filtered.filter((item) => item.categoryName === selectedTopic);
        }

        if (appState.stories.hideSeenStories) {
            const seen = readSeenStoryIds();
            filtered = filtered.filter((item) => !seen.has(getStoryUniqueId(item)));
        }

        if (source === 'party') {
            return buildVariedRandomStoriesFeed(filtered, { maxConsecutiveSameParty: 1 });
        }

        if (source !== 'random') {
            return filtered.sort(() => Math.random() - 0.5);
        }

        return buildVariedRandomStoriesFeed(filtered);
    }

    function buildVariedRandomStoriesFeed(items = [], { maxConsecutiveSameParty = 2 } = {}) {
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
        const MAX_CONSECUTIVE_SAME_PARTY = Math.max(1, Number(maxConsecutiveSameParty) || 2);

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

        setSelectedPartyIds(getSelectedPartyIds(), { ensureOne: false });
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

        const hideSeenCheckbox = document.getElementById('explora-hide-seen');
        if (hideSeenCheckbox) {
            hideSeenCheckbox.checked = Boolean(appState.stories.hideSeenStories);
        }

        syncExploraStartButtonState();
    }

    function bindSeenToggle() {
        const hideSeenCheckbox = document.getElementById('explora-hide-seen');
        if (!hideSeenCheckbox || hideSeenCheckbox.dataset.bound === 'true') return;

        hideSeenCheckbox.dataset.bound = 'true';
        hideSeenCheckbox.addEventListener('change', () => {
            appState.stories.hideSeenStories = Boolean(hideSeenCheckbox.checked);
        });
    }

    function bindSetupCloseButton() {
        const closeBtn = document.getElementById('explora-setup-close');
        if (!closeBtn || closeBtn.dataset.bound === 'true') return;

        closeBtn.dataset.bound = 'true';
        closeBtn.addEventListener('click', () => {
            UI.navigateHash('#/');
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

    function triggerSuggestionHapticFeedback() {
        const suggestionScreen = UI.containers.storiesCard?.querySelector('.story-screen--suggestion-premium');
        if (!suggestionScreen || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
        try {
            navigator.vibrate([10, 35, 10]);
        } catch {
            // Ignore unsupported/blocked vibration API.
        }
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
                    ${appState.stories.hideSeenStories
                        ? 'No quedan historias nuevas para esta selección. Desmarca "No mostrar historias ya vistas" para volver a verlas.'
                        : 'No hay propuestas para esta selección. Prueba otro partido o temática.'}
                </div>
            `;
            return;
        }

        if (activeInterstitial?.id) {
            const definition = getInterstitialById(activeInterstitial.id);
            if (!definition) {
                activeInterstitial = null;
                renderCurrentStoryCard();
                return;
            }
            clearPlaybackTimers();
            stopStoryCaptionSequence();
            definition.render(activeInterstitial.context || {});
            triggerSuggestionHapticFeedback();
            appState.stories.currentDurationMs = Number(definition.durationMs) || EXPLORA_ENGAGEMENT_DURATION_MS;
            definition.bindActions?.(activeInterstitial.context || {});

            bindExploraGestures();
            scheduleAutoAdvance();
            return;
        }

        const story = appState.stories.feed[appState.stories.currentIndex % appState.stories.feed.length];
        warmCandidateVideo(story?.party?.storyVideo?.path);
        markStoryAsSeen(story);
        incrementViewedStoriesCount();
        appState.stories.currentStory = story;
        appState.stories.currentDurationMs = getStoryDurationMs(story);

        StoriesView.renderStoriesCard(UI.containers.storiesCard, {
            ...story,
            progress: (appState.stories.currentIndex % appState.stories.feed.length) + 1,
            total: appState.stories.feed.length,
            storyDurationMs: appState.stories.currentDurationMs,
            transitionDirection: appState.stories.transitionDirection,
            isSaved: isStorySaved(story.party.id, story.proposal.id)
        });
        playStoryCaptionSequence(appState.stories.currentDurationMs, EXPLORA_CAPTION_STEP_MS);

        const saveBtn = UI.containers.storiesCard.querySelector('.btn-story-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const nowSaved = toggleSavedStory(story.party.id, story.proposal.id);
                if (nowSaved) {
                    UI.trackProposalSaveEvent(story.party, story.categoryName, story.proposal, 'story');
                }
                saveBtn.classList.toggle('is-saved', nowSaved);
                const icon = saveBtn.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-solid', nowSaved);
                    icon.classList.toggle('fa-regular', !nowSaved);
                }
                showSaveToast(nowSaved ? 'Propuesta guardada' : 'Propuesta eliminada');
            });
        }

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

    function showSaveToast(message) {
        if (!message) return;
        let toast = document.getElementById(SAVE_TOAST_ID);
        const toastHost = document.fullscreenElement || document.body;
        if (!toast) {
            toast = document.createElement('div');
            toast.id = SAVE_TOAST_ID;
            toast.className = 'story-save-toast';
            toastHost.appendChild(toast);
        } else if (toast.parentElement !== toastHost) {
            toastHost.appendChild(toast);
        }

        if (message === 'Propuesta guardada') {
            toast.innerHTML = `Propuesta <a href="#/guardadas" class="save-toast-link">guardada</a>`;
        } else {
            toast.textContent = message;
        }
        toast.classList.add('is-visible');
        clearTimeout(showSaveToast._timerId);
        showSaveToast._timerId = window.setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 2200);
    }

    function closeStoriesToHome() {
        if (appState.mode !== 'stories' || !appState.stories.started) return;
        endTrackingSession();
        const returnHash = appState.stories?.returnHash || '#/';
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

            UI.navigateHash(returnHash);

            requestAnimationFrame(() => {
                ghost.classList.add('story-screen--closing');
            });
            window.setTimeout(() => {
                ghost.remove();
            }, 320);
            return;
        }

        UI.navigateHash(returnHash);
    }

    function bindExploraGestures() {
        const storyCard = document.getElementById('stories-card');
        if (!storyCard) return;
        storyCard.style.touchAction = 'none';
        const getActiveVideoEl = () => document.getElementById('story-candidate-video-player');

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
            getActiveVideoEl()?.pause();
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
            resumeActiveVideoPlayback(getActiveVideoEl());
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
            getActiveVideoEl()?.pause();
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
            resumeActiveVideoPlayback(getActiveVideoEl());
        };

        storyCard.ontouchcancel = () => {
            exploraTouchStart = null;
            if (!exploraWasPausedByHold) return;
            exploraWasPausedByHold = false;
            resumePlayback();
            resumeActiveVideoPlayback(getActiveVideoEl());
        };
    }

    function resetPlaybackInteractionState() {
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        clearPlaybackTimers();
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
        const replayAnchorInterstitial = candidateVideoByAnchorIndex.get(appState.stories.currentIndex);
        if (!activeInterstitial?.id && replayAnchorInterstitial) {
            appState.stories.transitionDirection = 'next';
            resetPlaybackInteractionState();
            activeInterstitial = replayAnchorInterstitial;
            renderCurrentStoryCard();
            return;
        }

        if (!activeInterstitial?.id) {
            const nextInterstitial = getNextInterstitialToShow();
            if (nextInterstitial) {
                appState.stories.transitionDirection = 'next';
                resetPlaybackInteractionState();
                const definition = getInterstitialById(nextInterstitial.id);
                activeInterstitial = nextInterstitial;
                definition?.onShow?.(nextInterstitial.context || {});
                lastInterstitialViewedCount = engagementSessionViewedCount;
                renderCurrentStoryCard();
                return;
            }
        } else {
            activeInterstitial = null;
        }
        appState.stories.transitionDirection = 'next';
        resetPlaybackInteractionState();
        appState.stories.currentIndex = (appState.stories.currentIndex + 1) % appState.stories.feed.length;
        renderCurrentStoryCard();
    }

    function moveToPrevStory() {
        if (!appState.stories.feed.length) return;
        if (activeInterstitial?.id) {
            activeInterstitial = null;
            appState.stories.transitionDirection = 'prev';
            resetPlaybackInteractionState();
            renderCurrentStoryCard();
            return;
        }
        appState.stories.transitionDirection = 'prev';
        resetPlaybackInteractionState();
        const total = appState.stories.feed.length;
        appState.stories.currentIndex = (appState.stories.currentIndex - 1 + total) % total;
        const previousAnchorInterstitial = candidateVideoByAnchorIndex.get(appState.stories.currentIndex);
        if (previousAnchorInterstitial) {
            activeInterstitial = previousAnchorInterstitial;
            renderCurrentStoryCard();
            return;
        }
        renderCurrentStoryCard();
    }

    function startFeed() {
        const topicSelect = document.getElementById('explora-topic-select');

        const allowOutOfProvince = appState.stories.source === 'party';
        setSelectedPartyIds(
            getSelectedPartyIds({ allowOutOfProvince }),
            { ensureOne: false, allowOutOfProvince }
        );
        if (!canStartExplora()) {
            syncExploraStartButtonState();
            UI.navigateHash('#/explora');
            return;
        }
        if (appState.stories.source === 'topic') {
            const fallbackTopic = CATEGORIES[0]?.name || '';
            const requestedTopic = String(appState.stories.selectedTopic || '').trim();
            const hasRequestedTopic = CATEGORIES.some((category) => category?.name === requestedTopic);
            const nextTopic = hasRequestedTopic
                ? requestedTopic
                : (topicSelect?.value || fallbackTopic);
            appState.stories.selectedTopic = nextTopic;
            if (topicSelect && nextTopic) {
                topicSelect.value = nextTopic;
            }
        } else {
            appState.stories.selectedTopic = topicSelect?.value || CATEGORIES[0]?.name || '';
        }
        appState.stories.feed = buildStoriesFeed();
        appState.stories.currentIndex = 0;
        appState.stories.currentDurationMs = EXPLORA_MIN_STORY_DURATION_MS;
        appState.stories.transitionDirection = 'next';
        appState.stories.started = true;
        activeInterstitial = null;
        interstitialShownInSession.clear();
        partyVideoShownInSession.clear();
        candidateVideoByAnchorIndex.clear();
        engagementSessionViewedCount = 0;
        engagementSessionNextPromptAt = SHARE_PROMPT_FIRST_THRESHOLD;
        afinidadSessionNextPromptAt = AFINIDAD_PROMPT_FIRST_THRESHOLD;
        lastInterstitialViewedCount = -1000;
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        clearPlaybackTimers();
        startTrackingSession();
        bindTrackingLifecycle();

        syncExploraSetupUI();
        renderCurrentStoryCard();
        bindExploraGestures();
        requestExploraFullscreen();
    }

    function renderPrototype() {
        populateExploraFilters();
        bindSeenToggle();
        bindSetupCloseButton();
        syncExploraSetupUI();
        syncExploraStartButtonState();

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
            setSelectedPartyIds([], { ensureOne: false });
            renderPartyPills();
        }
        syncExploraSetupUI();
        syncExploraStartButtonState();
    }

    function focusOnParty(partyId) {
        if (!partyId) return;
        setSource('party');
        setSelectedPartyIds([partyId], { ensureOne: true, allowOutOfProvince: true });
        // Force a fresh feed on next /explora/play entry so it doesn't reuse
        // a previously started party feed.
        appState.stories.started = false;
        appState.stories.feed = [];
        appState.stories.currentIndex = 0;
        renderPartyPills();
        syncExploraStartButtonState();
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
        if (appState.stories.started) {
            endTrackingSession();
        }
        clearPlaybackTimers();
        stopStoryCaptionSequence();
        appState.stories.started = false;
        appState.stories.feed = [];
        appState.stories.currentIndex = 0;
        appState.stories.currentDurationMs = EXPLORA_MIN_STORY_DURATION_MS;
        appState.stories.transitionDirection = 'next';
        activeInterstitial = null;
        interstitialShownInSession.clear();
        partyVideoShownInSession.clear();
        candidateVideoByAnchorIndex.clear();
        engagementSessionViewedCount = 0;
        engagementSessionNextPromptAt = SHARE_PROMPT_FIRST_THRESHOLD;
        afinidadSessionNextPromptAt = AFINIDAD_PROMPT_FIRST_THRESHOLD;
        lastInterstitialViewedCount = -1000;
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        document.body.classList.remove('explora-paused');
        exitExploraFullscreenIfActive();
    }

    function teardownForRouteLeave() {
        if (appState.stories.started) {
            endTrackingSession();
        }
        clearPlaybackTimers();
        stopStoryCaptionSequence();
        exploraPlaybackElapsedMs = 0;
        exploraIsPaused = false;
        exploraWasPausedByHold = false;
        activeInterstitial = null;
        interstitialShownInSession.clear();
        partyVideoShownInSession.clear();
        candidateVideoByAnchorIndex.clear();
        engagementSessionViewedCount = 0;
        engagementSessionNextPromptAt = SHARE_PROMPT_FIRST_THRESHOLD;
        afinidadSessionNextPromptAt = AFINIDAD_PROMPT_FIRST_THRESHOLD;
        lastInterstitialViewedCount = -1000;
        document.body.classList.remove('explora-paused');
        exitExploraFullscreenIfActive();
    }

    return {
        setSource,
        focusOnParty,
        countUnseenStoriesForParty,
        startFeed,
        renderPrototype,
        handleKeydown,
        resetForRouteEnter,
        teardownForRouteLeave
    };
}
