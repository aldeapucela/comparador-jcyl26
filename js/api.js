/**
 * API Module - Handles data loading for political parties
 */

export const PARTIES = [
    { id: 'psoe', name: 'PSOE', logo: 'img/psoe.png' },
    { id: 'pp', name: 'PP', logo: 'img/pp.png' },
    { id: 'mev', name: 'España Vaciada', logo: 'img/mev.png' },
    { id: 'en-comun', name: 'En Común', logo: 'img/encomun.svg' }
];

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
        const response = await fetch(`./data/partidos/${partyId}.json`);
        if (!response.ok) throw new Error(`Could not load data for ${partyId}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching party data:', error);
        return null;
    }
}

export async function fetchAllPartiesData() {
    const data = {};
    const promises = PARTIES.map(async (party) => {
        const partyData = await fetchPartyData(party.id);
        if (partyData) {
            const metadata = partyData.metadatos || {};
            party.color = metadata.color || party.color || '#64748b';
            if (metadata.foto_candidato) party.candidatePhoto = metadata.foto_candidato;
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
