import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const siret = searchParams.get('siret');

    if (process.env.NEXT_PUBLIC_API_SIRET_TOKEN) {
        const apiKey: string = process.env.NEXT_PUBLIC_API_SIRET_TOKEN; // Remplacez par votre clé API

        try {
            const response = await fetch(`https://api.insee.fr/api-sirene/3.11/siret/${siret}`, {
                method: 'GET',
                headers: {
                    'X-INSEE-Api-Key-Integration': apiKey
                }
            });

            const data = await response.json();
            const raison_sociale = data.etablissement.uniteLegale.denominationUniteLegale;
            console.log('Raison Sociale:', raison_sociale); // Log des données récupérées

            return NextResponse.json(raison_sociale); // Renvoie les données en réponse
        } catch (error) {
            console.error('Erreur:', error);
            return NextResponse.json({ error: 'Erreur lors de la récupération des données' }, { status: 500 });
        }
    } else {
        return NextResponse.json({ error: 'Token API manquant' }, { status: 400 });
    }
}
