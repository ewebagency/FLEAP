//Infos additionnelles du presta
interface PrestaInfosAdd {
	type : "transporteur" | "destinataire" | "courtier" | "negotiant",
	adresse : string,
	tel : string,
	mail : string,
	fax : string,
	
	infos_transporteur? : {
		recepisse:string, 
		departement:string, 
		limite_validite:string, //date USA
		routier:string,
		} 
}

interface DechetMetaInterface {
			date:string, 
			nom:string, 
			tonnage:string, //Le + reel
            ced:string, 
			d_r?:string, 
			tour?:string,
}

interface FactureInterface {
	ligne : {
		operation:string,
		quantite:number,
		unite:string,
		montant_ht:number,
		tva_absolute:number,
		}[]
	declassement?:string,
}



interface DocMetaInterface {
type_doc : "bon"|"bsd"|"facture"

site_raw : string,
presta_raw : string,
add_presta_raw? : PrestaInfosAdd

l_prestas? : [ 
		presta_raw2?:string,
		add_presta2_raw? : PrestaInfosAdd
		]

dechet : DechetMetaInterface[]
	}



interface DechetBonInterface extends DechetMetaInterface {
        num_bon:string,
    }

interface DechetBsdInterface extends DechetMetaInterface {
        num_bon:string,
        contenant?:string,
        volume_m3?:string,
    }    

interface DechetFactureInterface extends DechetBsdInterface {
        facture : FactureInterface
    }
    
    


interface DocBonInterface extends DocMetaInterface {
    type_doc : "bon",
    dechet : DechetBonInterface[]
}

interface DocBsdInterface extends DocMetaInterface {
    type_doc : "bsd",
    conformite: 
        {CAP:string, ADR:string},
    dechet : DechetBsdInterface[]
}

interface DocFactureInterface extends DocMetaInterface {
    type_doc : "facture",
	num_facture:string,
    dechet : DechetFactureInterface[]
}


