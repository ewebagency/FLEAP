//Infos additionnelles du presta
interface PrestaInfosAdd {
	type : "transporteur" | "destinataire" | "courtier" | "negotiant",
	adresse : string,
	tel : string,
	mail : string,
	fax : string,
	nom? : string, // V2
	
	infos_transporteur? : {
		recepisse:string, 
		departement:string, 
		limite_validite:string, //date USA
		routier:string,
		multimodal?:string, // V2
		} 
}

interface DechetMetaInterface {
			date:string, 
			nom:string, 
			tonnage:string, //Le + reel
            ced:string, 
			d_r?:string, 
			tour?:string,
			// NOUVEAUX CHAMPS V2
			consistance?:string, // BSD
}

interface FactureInterface {
	ligne : {
		operation:string,
		quantite:number,
		unite:string,
		montant_ht:number,
		// NOUVEAUX CHAMPS V2
		tva_pourcentage?:number,
		avoir?:string, // true/false en string
		declassement?:string, // true/false en string - V2: déplacé de déchet vers ligne
		}[]
}



interface DocMetaInterface {
type_doc : "bon"|"bsd"|"facture"

site_raw : string, // Pour BON et BSD uniquement (pour FACTURE, dans chaque déchet)
presta_raw : string,
add_presta_raw? : PrestaInfosAdd

l_prestas? : [ 
		presta_raw2?:string,
		add_presta2_raw? : PrestaInfosAdd
		]

dechet : DechetMetaInterface[]

// NOUVEAUX CHAMPS V2 - communs à tous les types
nom_prestataire_2?:string,
role_prestataire_2?:string, // "transporteur" | "destinataire"
	}



interface DechetBonInterface extends DechetMetaInterface {
        num_bon:string,
		// NOUVEAUX CHAMPS V2
		nom_contenant?:string,
		volume_m3?:string,
		nombre_colis?:string,
		flag_rep?:string, // true/false en string
    }

interface DechetBsdInterface extends DechetMetaInterface {
        num_bon:string,
        contenant?:string,
        volume_m3?:string,
		// NOUVEAUX CHAMPS V2
		nombre_colis?:string,
		flag_rep?:string, // "true" | "false" - V2
    }    

interface DechetFactureInterface extends DechetBsdInterface {
        facture : FactureInterface
		// NOUVEAUX CHAMPS V2
		nom_site?:string, // Site spécifique pour chaque collecte
		adresse_site?:string, // Adresse du site
		nombre_colis?:string,
		flag_rep?:string, // true/false en string - V2
    }
    
    


interface DocBonInterface extends DocMetaInterface {
    type_doc : "bon",
    dechet : DechetBonInterface[]
	// NOUVEAUX CHAMPS V2
	type_bon?:string, // Brut : "livraison", "transport", etc.
	immatriculation?:string,
	recepisse?:string,
	adresse_site?:string,
}

interface DocBsdInterface extends DocMetaInterface {
    type_doc : "bsd",
    conformite: 
        {CAP:string, ADR:string},
    dechet : DechetBsdInterface[]
	// NOUVEAUX CHAMPS V2
	adresse_site?:string, // V2: Adresse émetteur
	type_emetteur?:string, // V2: Type émetteur
	negociant_raw?: {
		type:string,
		nom:string,
		adresse:string,
		siren:string,
		recepisse:string,
		departement:string,
		validite:string,
	},
	exutoire?: {
		entreposage:string,
		lot_accepte:string,
		motif_refus:string,
	},
}

interface DocFactureInterface extends DocMetaInterface {
    type_doc : "facture",
	num_facture:string,
	montant_total_ht:string, // V2
    dechet : DechetFactureInterface[]
	// NOUVEAUX CHAMPS V2
	type_facture?:string, // Brut : "Facture", "Avoir", "Rachat"
	date_fin_periode?:string,
	date_debut_periode?:string,
	num_contrat?:string,
	num_compte?:string,
	num_client?:string,
	total_ttc?:string,
}


