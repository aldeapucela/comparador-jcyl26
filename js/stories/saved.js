const SAVED_STORIES_STORAGE_KEY = 'explora_saved_stories_v1';

function normalizeId(value = '') {
    return String(value || '').trim();
}

export function getStoryUniqueIdByParts(partyId, proposalId) {
    const cleanPartyId = normalizeId(partyId);
    const cleanProposalId = normalizeId(proposalId);
    if (!cleanPartyId || !cleanProposalId) return '';
    return `${cleanPartyId}:${cleanProposalId}`;
}

export function getStoryUniqueId(story) {
    return getStoryUniqueIdByParts(story?.party?.id, story?.proposal?.id);
}

export function readSavedStoryIds() {
    try {
        const raw = localStorage.getItem(SAVED_STORIES_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.map((id) => normalizeId(id)).filter(Boolean));
    } catch {
        return new Set();
    }
}

export function writeSavedStoryIds(idsSet = new Set()) {
    try {
        localStorage.setItem(SAVED_STORIES_STORAGE_KEY, JSON.stringify(Array.from(idsSet)));
    } catch {
        // Ignore storage quota/privacy failures.
    }
}

export function isStorySaved(partyId, proposalId) {
    const storyId = getStoryUniqueIdByParts(partyId, proposalId);
    if (!storyId) return false;
    return readSavedStoryIds().has(storyId);
}

export function toggleSavedStory(partyId, proposalId) {
    const storyId = getStoryUniqueIdByParts(partyId, proposalId);
    if (!storyId) return false;

    const saved = readSavedStoryIds();
    if (saved.has(storyId)) {
        saved.delete(storyId);
        writeSavedStoryIds(saved);
        notifySavedStoriesChanged();
        return false;
    }

    saved.add(storyId);
    writeSavedStoryIds(saved);
    notifySavedStoriesChanged();
    return true;
}

function notifySavedStoriesChanged() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('saved-proposals-changed'));
}
