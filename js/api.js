/**
 * API Module - Handles data loading for political parties
 */

export const PARTIES = [
    { id: 'psoe', name: 'PSOE', color: '#e30613', logo: 'img/psoe.png' },
    { id: 'pp', name: 'PP', color: '#0056a3', logo: 'img/pp.png' },
    { id: 'mev', name: 'España Vaciada', color: '#f39200', logo: 'img/mev.png' },
    { id: 'en-comun', name: 'En Común', color: '#6d2d91', logo: 'img/encomun.svg' }
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

export function getCategoriesFromProposals(proposals) {
    const categoriesSet = new Set();
    proposals.forEach(p => categoriesSet.add(p.categoria));
    return Array.from(categoriesSet).sort();
}
