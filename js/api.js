/**
 * API Module - Handles data loading for political parties
 */

function withAppVersion(path) {
    const version = window.__APP_VERSION__;
    if (!version) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}v=${encodeURIComponent(version)}`;
}

export const PARTIES = [
];

let partiesCatalogPromise = null;

function normalizePartyName(metadataName = '', partyId = '') {
    const name = (metadataName || '').trim();
    if (!name) return partyId.toUpperCase();

    return name
        .replace(/\s+castilla\s+y\s+le[oó]n$/i, '')
        .replace(/\s*-\s*castilla\s+y\s+le[oó]n$/i, '')
        .replace(/\s*–\s*castilla\s+y\s+le[oó]n$/i, '')
        .trim();
}

function resolvePartyLogo(metadataLogo = '', partyId = '') {
    const cleanLogo = (metadataLogo || '').trim();
    if (cleanLogo) return cleanLogo;
    return `img/${partyId}.png`;
}

function resolveStoryVideo(metadataStoryVideo = null) {
    if (!metadataStoryVideo) return null;
    if (typeof metadataStoryVideo === 'string') {
        const path = metadataStoryVideo.trim();
        return path ? { path, enabled: true } : null;
    }
    if (typeof metadataStoryVideo !== 'object') return null;
    const path = String(metadataStoryVideo.path || '').trim();
    if (!path) return null;
    return {
        path,
        enabled: metadataStoryVideo.enabled !== false
    };
}

function normalizeCandidateName(rawCandidateName = '') {
    const normalized = String(rawCandidateName || '').trim();
    if (!normalized) return null;
    const folded = normalized.toLowerCase();
    if (folded.includes('coalición') || folded.includes('coalicion')) return null;
    return normalized;
}

export async function loadPartiesCatalog() {
    if (partiesCatalogPromise) return partiesCatalogPromise;

    partiesCatalogPromise = (async () => {
        const response = await fetch(withAppVersion('./data/partidos/index.json'));
        if (!response.ok) throw new Error('Could not load party index');
        const indexData = await response.json();
        const partyIds = Array.isArray(indexData?.parties) ? indexData.parties : [];

        const loadedParties = await Promise.all(
            partyIds.map(async (partyId) => {
                const id = String(partyId || '').trim();
                if (!id) return null;

                const partyData = await fetchPartyData(id);
                if (!partyData) return null;

                const metadata = partyData.metadatos || {};
                return {
                    id,
                    name: normalizePartyName(metadata.partido, id),
                    logo: resolvePartyLogo(metadata.logo, id),
                    color: metadata.color || '#64748b',
                    candidateName: normalizeCandidateName(metadata.candidato),
                    candidatePhoto: metadata.foto_candidato || null,
                    storyVideo: resolveStoryVideo(metadata.story_video)
                };
            })
        );

        PARTIES.splice(0, PARTIES.length, ...loadedParties.filter(Boolean));
        return PARTIES;
    })();

    return partiesCatalogPromise;
}

export const CATEGORIES = [
    { id: 'demografia', name: 'Reto Demográfico y Despoblación', icon: 'fa-people-group' },
    { id: 'sanidad', name: 'Sanidad Pública', icon: 'fa-hospital' },
    { id: 'vivienda', name: 'Vivienda', icon: 'fa-house-chimney' },
    { id: 'economia', name: 'Economía, Empleo y Fiscalidad', icon: 'fa-chart-line' },
    { id: 'educacion', name: 'Educación y Futuro', icon: 'fa-graduation-cap' },
    { id: 'servicios-sociales', name: 'Servicios Sociales y Cuidados', icon: 'fa-hand-holding-heart' },
    { id: 'conectividad', name: 'Conectividad y Movilidad', icon: 'fa-tower-cell' },
    { id: 'medio-ambiente', name: 'Medio Ambiente y Energía', icon: 'fa-leaf' },
    { id: 'sector-primario', name: 'Sector Primario (Agricultura y Ganadería)', icon: 'fa-tractor' },
    { id: 'democracia', name: 'Calidad Democrática y Transparencia', icon: 'fa-building-shield' },
    { id: 'otros', name: 'Otros', icon: 'fa-ellipsis' }
];

export async function fetchPartyData(partyId) {
    try {
        const response = await fetch(withAppVersion(`./data/partidos/${partyId}.json`));
        if (!response.ok) throw new Error(`Could not load data for ${partyId}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching party data:', error);
        return null;
    }
}

export async function fetchAllPartiesData() {
    await loadPartiesCatalog();
    const data = {};
    const promises = PARTIES.map(async (party) => {
        const partyData = await fetchPartyData(party.id);
        if (partyData) {
            const metadata = partyData.metadatos || {};
            party.color = metadata.color || party.color || '#64748b';
            party.candidateName = normalizeCandidateName(metadata.candidato) || party.candidateName || null;
            if (metadata.foto_candidato) party.candidatePhoto = metadata.foto_candidato;
            party.storyVideo = resolveStoryVideo(metadata.story_video);
            data[party.id] = partyData;
        }
    });
    await Promise.all(promises);
    return data;
}

export function getCategoriesFromProposals(proposals) {
    const categoriesSet = new Set();
    proposals.forEach(p => categoriesSet.add(p.categoria));
    return Array.from(categoriesSet).sort();
}
