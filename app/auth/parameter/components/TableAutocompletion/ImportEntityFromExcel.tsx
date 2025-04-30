import { useState, useRef } from "react";
import * as XLSX from 'xlsx';
import toast from "react-hot-toast";
import { useSession } from "@/app/component/SessionProvider";
import { supabase } from "@/app/database/supabaseClient";
import BoxIcon from "@/app/component/BoxIconWrapper";
import { codeTraitementDefinitions } from "@/app/component/Analyse/Environnementale/codeTraitement";
import { code_ced_DICTIONNAIRE } from "@/app/component/CodeCED";

// Types pour les entités
interface EntityBase {
    [key: string]: string | number | EntityBase[] | undefined;
    entreprise_id: string;
}

interface RelatedEntity {
    [key: string]: string | number | undefined;
}

interface EntityDefinition {
    unifyKeys: string[];
    columns: { [key: string]: string };
    relatedEntities?: {
        [key: string]: {
            unifyKeys: string[];
            columns: { [key: string]: string };
        };
    };
}

// Définition des règles d'unify et des colonnes pour chaque entité
export const entityDefinitions: { [key: string]: EntityDefinition } = {
    site: {
        unifyKeys: ['nom', 'siret'],
        columns: {
            nom: 'nomSiteEmetteur',
            siret: 'siretEmetteur',
            adresse: 'adresseEmetteur',
            codePostal: 'codePostalEmetteur',
            commune: 'communeEmetteur',
            pays: 'paysEmetteur'
        },
        relatedEntities: {
            pointsCollecte: {
                unifyKeys: ['nom', 'adresse'],
                columns: {
                    nom: 'nomPointCollecte',
                    adresse: 'adresseCollecte',
                    codePostal: 'codePostalCollecte',
                    commune: 'communeCollecte',
                    infos: 'infosCollecte'
                }
            },
            contacts: {
                unifyKeys: ['nom', 'prenom', 'email'],
                columns: {
                    nom: 'nomContactEmetteur',
                    prenom: 'prenomContactEmetteur',
                    email: 'emailContactEmetteur',
                    telephone: 'telephoneContactEmetteur'
                }
            }
        }
    },
    transporteur: {
        unifyKeys: ['nom', 'siret'],
        columns: {
            nom: 'nomTransporteur',
            siret: 'siretTransporteur',
            adresse: 'adresseTransporteur',
            codePostal: 'codePostalTransporteur',
            commune: 'communeTransporteur',
            pays: 'paysTransporteur',
            recepisse: 'recepisseTransporteur',
            email: 'emailContactTransporteur',
            telephone: 'telephoneContactTransporteur',
            nomContact: 'nomContactTransporteur',
            prenomContact: 'prenomContactTransporteur'
        }
    },
    dechet: {
        unifyKeys: ['nom'],
        columns: {
            nom: 'descDechet',
            codeCED: 'codeCed',
            adr: 'mentionAdr'
        }
    },
    destinataire: {
        unifyKeys: ['nom', 'siret'],
        columns: {
            nom: 'nomInstallationDestination',
            siret: 'siretInstallationDestination',
            adresse: 'adresseInstallationDestination',
            codePostal: 'codePostalInstallationDestination',
            commune: 'communeInstallationDestination',
            pays: 'paysInstallationDestination',
            email: 'emailContactInstallationDestination',
            telephone: 'telephoneContactInstallationDestination',
            nomContact: 'nomContactInstallationDestination',
            prenomContact: 'prenomContactInstallationDestination',
            cap: 'numeroCap',
            codeTraitement: 'codeTraitementPrevuInstallationDestination'
        }
    },
    contenant: {
        unifyKeys: ['nom', 'volume', 'uniteVolume'],
        columns: {
            nom: 'typeContenant',
            volume: 'volumeUnitaire',
            uniteVolume: 'uniteMesureVolume',
            description: 'descContenant'
        }
    }
};

interface Row {
    [key: string]: string | number;
}

interface Site {
    nom: string;
    siret: string;
    adresseSiege: string;
    pointsCollecte: {
        nom: string;
        adresse: string;
    }[];
    contacts: {
        nom: string;
        email: string;
        telephone: string;
    }[];
}

interface Dechet {
    nom: string;
    codeCED: string;
    adr: string;
    masseVolumique: number;
}

interface CodeTraitement {
    code: string;
    nom: string;
}

interface EcoOrganisme {
    nomBoite: string;
    siret: string;
    email: string;
    nomPrenom: string;
    adresse: string;
    telephone: string;
}

interface Transporteur {
    nomBoite: string;
    siret: string;
    recepisse: string;
    email: string;
    telephone: string;
    nomPrenom: string;
    adresse: string;
}

interface Destinataire {
    nomBoite: string;
    siret: string;
    email: string;
    telephone: string;
    nomPrenom: string;
    adresse: string;
}

interface Contenant {
    nom: string;
    volume: string;
    uniteVolume: string;
}

interface EntityData {
    entreprise_id: string;
    [key: string]: unknown;
}

interface Negociant {
    nomBoite: string;
    siret: string;
    recepisse: string;
    email: string;
    telephone: string;
    nomPrenom: string;
    adresse: string;
}

interface Courtier {
    nomBoite: string;
    siret: string;
    recepisse: string;
    email: string;
    telephone: string;
    nomPrenom: string;
    adresse: string;
}

const processSites = (rows: Row[], entreprise_id: string) => {
    // Map pour stocker les sites unifiés par SIRET
    const sitesBySiret = new Map<string, Site>();

    for (const row of rows) {
        const siret = row['siretEmetteur']?.toString();
        if (!siret) continue;

        if (!sitesBySiret.has(siret)) {
            // Créer un nouveau site
            const site: Site = {
                nom: row['nomSiteEmetteur']?.toString() || '',
                siret,
                adresseSiege: [
                    row['adresseEmetteur'],
                    row['codePostalEmetteur'],
                    row['communeEmetteur']
                ].filter(Boolean).join(' '),
                pointsCollecte: [],
                contacts: []
            };
            sitesBySiret.set(siret, site);
        }

        const site = sitesBySiret.get(siret)!;

        // Ajouter le point de collecte s'il n'existe pas déjà
        const pointCollecteNom = row['nomPointCollecte']?.toString();
        const pointCollecteAdresse = [
            row['adresseCollecte'],
            row['codePostalCollecte'],
            row['communeCollecte']
        ].filter(Boolean).join(' ');
        if (pointCollecteNom && !site.pointsCollecte.some(pc => pc.nom === pointCollecteNom)) {
            site.pointsCollecte.push({
                nom: pointCollecteNom,
                adresse: pointCollecteAdresse
            });
        }

        // Ajouter le contact s'il n'existe pas déjà
        const contactNom = [
            row['prenomContactEmetteur'],
            row['nomContactEmetteur']
        ].filter(Boolean).join(' ');
        const contactEmail = row['emailContactEmetteur']?.toString();
        const contactTelephone = row['telephoneContactEmetteur']?.toString();
        if (contactNom && contactEmail && 
            !site.contacts.some(c => c.email === contactEmail)) {
            site.contacts.push({
                nom: contactNom,
                email: contactEmail,
                telephone: contactTelephone || ''
            });
        }
    }

    return Array.from(sitesBySiret.values()).map(site => ({
        entreprise_id,
        site: site
    }));
};

const processDechets = (rows: Row[], entreprise_id: string) => {
    // Map pour stocker les déchets unifiés par nom
    const dechetsByNom = new Map<string, Dechet>();

    for (const row of rows) {
        const nom = row['descDechet']?.toString();
        const codeCed = row['codeCed']?.toString();
        const masseVolumique = code_ced_DICTIONNAIRE.find(ligne => String(ligne.ced).replaceAll(" ", "").replace("*", "") === String(codeCed).replaceAll(" ", "").replace("*", ""))?.masse_volumique || 1;
        
        if (!nom || !masseVolumique) continue;

        if (!dechetsByNom.has(nom)) {
            // Créer un nouveau déchet
            const dechet: Dechet = {
                nom,
                codeCED: row['codeCed']?.toString() || '',
                adr: row['mentionAdr']?.toString() || '',
                masseVolumique: masseVolumique
            };
            dechetsByNom.set(nom, dechet);
        }
    }

    return Array.from(dechetsByNom.values()).map(dechet => ({
        entreprise_id,
        dechet: dechet
    }));
};

const processCodeTraitements = (rows: Row[], entreprise_id: string) => {
    // Map pour stocker les codes de traitement unifiés par code
    const codesByCode = new Map<string, CodeTraitement>();

    for (const row of rows) {
        const code = row['codeTraitementPrevuInstallationDestination2']?.toString();
        const nom = codeTraitementDefinitions.find(ligne => ligne.code === code)?.nom;
        if (!code) continue;

        if (!codesByCode.has(code)) {
            // Créer un nouveau code de traitement
            const codeTraitement: CodeTraitement = {
                code,
                nom: nom || ''
            };
            codesByCode.set(code, codeTraitement);
        }
    }

    return Array.from(codesByCode.values()).map(codeTraitement => ({
        entreprise_id,
        code_traitement: codeTraitement
    }));
};

const processEcoOrganismes = (rows: Row[], entreprise_id: string) => {
    const ecoOrganismesBySiret = new Map<string, EcoOrganisme>();

    for (const row of rows) {
        const siret = row['siretEcoOrganisme']?.toString();
        if (!siret) continue;

        if (!ecoOrganismesBySiret.has(siret)) {
            let nomPrenom = `${row['nomContactEcoOrganisme']?.toString()||''} ${row['prenomContactEcoOrganisme']?.toString()||''}`;
            if(nomPrenom === " "){nomPrenom = "";}
            const ecoOrganisme: EcoOrganisme = {
                nomBoite: row['nomEcoOrganisme']?.toString() || '',
                siret,
                email: row['emailEcoOrganisme']?.toString() || '',
                nomPrenom: nomPrenom,
                adresse: row['adresseEcoOrganisme']?.toString() || '',
                telephone: row['telephoneContactEcoOrganisme']?.toString() || ''
            };
            ecoOrganismesBySiret.set(siret, ecoOrganisme);
        }
    }

    return Array.from(ecoOrganismesBySiret.values()).map(ecoOrganisme => ({
        entreprise_id,
        eco_organisme: ecoOrganisme
    }));
};

const processTransporteurs = (rows: Row[], entreprise_id: string) => {
    const transporteursBySiret = new Map<string, Transporteur>();

    for (const row of rows) {
        const siret = row['siretTransporteur']?.toString();
        if (!siret) continue;

        if (!transporteursBySiret.has(siret)) {
            let nomPrenom = `${row['nomContactTransporteur']?.toString()||''} ${row['prenomContactTransporteur']?.toString()||''}`;
            if(nomPrenom === " "){nomPrenom = "";}
            const transporteur: Transporteur = {
                nomBoite: row['nomTransporteur']?.toString() || '',
                siret,
                recepisse: row['recepisseTransporteur']?.toString() || '',
                email: row['emailContactTransporteur']?.toString() || '',
                telephone: row['telephoneContactTransporteur']?.toString() || '',
                nomPrenom: nomPrenom,
                adresse: row['adresseTransporteur']?.toString() || '',
            };
            transporteursBySiret.set(siret, transporteur);
        }
    }

    return Array.from(transporteursBySiret.values()).map(transporteur => ({
        entreprise_id,
        transporteur: transporteur
    }));
};

const processDestinataires = (rows: Row[], entreprise_id: string) => {
    const destinatairesBySiret = new Map<string, Destinataire>();

    for (const row of rows) {
        const siret = row['siretInstallationDestination']?.toString();
        if (!siret) continue;

        if (!destinatairesBySiret.has(siret)) {
            let nomPrenom = `${row['nomContactInstallationDestination']?.toString()||''} ${row['prenomContactInstallationDestination']?.toString()||''}`;
            if(nomPrenom === " "){nomPrenom = "";}
            const destinataire: Destinataire = {
                nomBoite: row['nomInstallationDestination']?.toString() || '',
                siret,
                email: row['emailContactInstallationDestination']?.toString() || '',
                telephone: row['telephoneContactInstallationDestination']?.toString() || '',
                nomPrenom: nomPrenom,
                adresse: row['adresseInstallationDestination']?.toString() || ''
            };
            destinatairesBySiret.set(siret, destinataire);
        }
    }

    return Array.from(destinatairesBySiret.values()).map(destinataire => ({
        entreprise_id,
        destinataire: destinataire
    }));
};

const processContenants = (rows: Row[], entreprise_id: string) => {
    const contenantsByNom = new Map<string, Contenant>();

    for (const row of rows) {
        const nom = row['descContenant']?.toString();
        if (!nom) continue;

        if (!contenantsByNom.has(nom)) {
            const contenant: Contenant = {
                nom,
                volume: row['volumeUnitaire']?.toString() || '',
                uniteVolume: row['uniteMesureVolume']?.toString() || ''
            };
            contenantsByNom.set(nom, contenant);
        }
    }

    return Array.from(contenantsByNom.values()).map(contenant => ({
        entreprise_id,
        contenant: contenant
    }));
};

const processNegociants = (rows: Row[], entreprise_id: string) => {
    const negociantsBySiret = new Map<string, Negociant>();

    for (const row of rows) {
        const siret = row['siretNegotiant']?.toString();
        if (!siret) continue;

        if (!negociantsBySiret.has(siret)) {
            let nomPrenom = `${row['nomContactNegotiant']?.toString()||''} ${row['prenomContactNegotiant']?.toString()||''}`;
            if(nomPrenom === " "){nomPrenom = "";}
            const negociant: Negociant = {
                nomBoite: row['nomNegotiant']?.toString() || '',
                siret,
                recepisse: row['recepisseNegotiant']?.toString() || '',
                email: row['emailContactNegotiant']?.toString() || '',
                telephone: row['telephoneContactNegotiant']?.toString() || '',
                nomPrenom: nomPrenom,
                adresse: row['adresseNegotiant']?.toString() || ''
            };
            negociantsBySiret.set(siret, negociant);
        }
    }

    return Array.from(negociantsBySiret.values()).map(negociant => ({
        entreprise_id,
        negociant: negociant
    }));
};

const processCourtiers = (rows: Row[], entreprise_id: string) => {
    const courtiersBySiret = new Map<string, Courtier>();

    for (const row of rows) {
        const siret = row['siretCourtier']?.toString();
        if (!siret) continue;

        if (!courtiersBySiret.has(siret)) {
            let nomPrenom = `${row['nomContactCourtier']?.toString()||''} ${row['prenomContactCourtier']?.toString()||''}`;
            if(nomPrenom === " "){nomPrenom = "";}
            const courtier: Courtier = {
                nomBoite: row['nomCourtier']?.toString() || '',
                siret,
                recepisse: row['recepisseCourtier']?.toString() || '',
                email: row['emailContactCourtier']?.toString() || '',
                telephone: row['telephoneContactCourtier']?.toString() || '',
                nomPrenom: nomPrenom,
                adresse: row['adresseCourtier']?.toString() || ''
            };
            courtiersBySiret.set(siret, courtier);
        }
    }

    return Array.from(courtiersBySiret.values()).map(courtier => ({
        entreprise_id,
        courtier: courtier
    }));
};

const ImportEntityFromExcel = () => {
    const { entreprise_id } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        setIsLoading(true);
        try {
            if (!entreprise_id) {
                throw new Error("Entreprise ID non trouvé");
            }

            console.log('\n=== Import Excel ===');
            console.log(`Fichier: ${file.name}`);

            // Lire le fichier Excel
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet) as Row[];

            // Traiter toutes les entités
            const sites = processSites(jsonData, entreprise_id);
            const dechets = processDechets(jsonData, entreprise_id);
            const codeTraitements = processCodeTraitements(jsonData, entreprise_id);
            const ecoOrganismes = processEcoOrganismes(jsonData, entreprise_id);
            const transporteurs = processTransporteurs(jsonData, entreprise_id);
            const destinataires = processDestinataires(jsonData, entreprise_id);
            const contenants = processContenants(jsonData, entreprise_id);
            const negociants = processNegociants(jsonData, entreprise_id);
            const courtiers = processCourtiers(jsonData, entreprise_id);

            console.log('\nSites', sites);
            console.log('\nDéchets', dechets);
            console.log('\nCodes de traitement', codeTraitements);
            console.log('\nÉco-organismes', ecoOrganismes);
            console.log('\nTransporteurs', transporteurs);
            console.log('\nDestinataires', destinataires);
            console.log('\nContenants', contenants);
            console.log('\nNégociants', negociants);
            console.log('\nCourtiers', courtiers);
            console.log(`\nTotal: ${sites.length} sites, ${dechets.length} déchets, ${codeTraitements.length} codes de traitement, ${ecoOrganismes.length} éco-organismes, ${transporteurs.length} transporteurs, ${destinataires.length} destinataires, ${contenants.length} contenants, ${negociants.length} négociants, ${courtiers.length} courtiers`);

            // Envoyer les données à Supabase
            const sendToSupabase = async (data: EntityData[], type: string) => {
                if (data.length === 0) return;
                
                const { error } = await supabase
                    .from('table_autocompletion')
                    .insert(data.map(item => ({
                        entreprise_id: item.entreprise_id,
                        [type]: item[type] as Record<string, unknown>
                    })));

                if (error) {
                    console.error(`Erreur lors de l'insertion des ${type}:`, error);
                    throw error;
                }
            };

            // Envoyer les données entité par entité
            await sendToSupabase(sites, 'site');
            await sendToSupabase(dechets, 'dechet');
            await sendToSupabase(codeTraitements, 'code_traitement');
            await sendToSupabase(ecoOrganismes, 'eco_organisme');
            await sendToSupabase(transporteurs, 'transporteur');
            await sendToSupabase(destinataires, 'destinataire');
            await sendToSupabase(contenants, 'contenant');
            await sendToSupabase(negociants, 'negociant');
            await sendToSupabase(courtiers, 'courtier');

            toast.success('Import réussi !');
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            toast.error('Erreur lors de l\'import');
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={handleButtonClick}
                className="h-[30px] flex justify-between items-center gap-2 bg-gray-100 rounded-md px-2 cursor-pointer active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
            >
                <div className="text-[var(--green-light)] rounded-full py-1 mt-1 font-thin">
                    {isLoading ? (
                        <span className="inline-block animate-spin">↻</span>
                    ) : (
                        <BoxIcon name='import' type='solid' color='green' size="18px" />
                    )}
                </div>
                <div className="text-black font-thin text-xs">
                    {isLoading ? 'Import en cours...' : 'Importer'}
                </div>
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
                disabled={isLoading}
            />
        </div>
    );
};

export default ImportEntityFromExcel;
