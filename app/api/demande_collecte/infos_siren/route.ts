import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const siret = searchParams.get('siret');

    if (process.env.NEXT_PUBLIC_API_SIRET_TOKEN) {
        const apiKey: string = process.env.NEXT_PUBLIC_API_SIRET_TOKEN;

        try {
            const response = await fetch(`https://api.insee.fr/api-sirene/3.11/siret/${siret}`, {
                method: 'GET',
                headers: {
                    'X-INSEE-Api-Key-Integration': apiKey
                }
            });

            const data = await response.json();

            
            const raison_sociale = data.etablissement.uniteLegale.denominationUniteLegale || '';
            const adresse_siege = [
                data.etablissement.adresseEtablissement.numeroVoieEtablissement,
                data.etablissement.adresseEtablissement.typeVoieEtablissement,
                data.etablissement.adresseEtablissement.libelleVoieEtablissement,
                data.etablissement.adresseEtablissement.codePostalEtablissement,
                data.etablissement.adresseEtablissement.libelleCommuneEtablissement,
                data.etablissement.adresseEtablissement.libellePaysEtrangerEtablissement || 'FRANCE'
            ]
            .filter(part => part)
            .join(' ') || '';

            const pays = data.etablissement.adresseEtablissement.libellePaysEtrangerEtablissement || 'FRANCE';
            
            // Formatage selon l'interface Gouv
            const formattedResponse = {
                raison: { first: raison_sociale },
                adresse: { first: adresse_siege },
                pays: { first: pays}
            };
            
            return NextResponse.json(formattedResponse);
        } catch (error) {
            //console.error('Erreur:', error);
            return NextResponse.json({ 
                raison: { first: '' }, 
                adresse: { first: '' } 
            });
        }
    } else {
        return NextResponse.json({ 
            raison: { first: '' }, 
            adresse: { first: '' } 
        });
    }
}
