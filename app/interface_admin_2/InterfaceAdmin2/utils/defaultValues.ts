import { FactureLine } from '../types/interfaces';
import { ALL_OPERATIONS, UNITES, DEFAULT_PRESTATAIRE, DEFAULT_NOM_DECHET, DEFAULT_CODE_CED, DEFAULT_LIEU_COLLECTE } from '../constants/formConstants';

export const defaultFormData: FactureLine = {
    header: {
        prestataire_nom: DEFAULT_PRESTATAIRE[0],
        prestataire_description: '',
        prestataire_siret: '',
        prestataire_num_client: '',
        num_facture: '',
        date_facture: new Date().toISOString().split('T')[0],
    },
    departs: [{
        line_header: {
            site_description: '',
            site_num_affaire: '',
            site_nom: '',
            site_siret: '',
            dechet_description: '',
            type_dechet: '',
            code_dechet: '',
            filiere: '',
            num_dossier: '',
            bon_intention: '',
            bon_pesee: '',
            lieu_vidage: '',
            date_depart: new Date().toISOString().split('T')[0],
        },
        line_body: [{
            type_operation: '',
            quantite: 0,
            unite: '',
            prix_unitaire: 0,
            montant_ht: 0,
            description_contenant: '',
            type_contenant: ''
        }],
        commentaire: '',
        linked_to_bsd: false
    }],
    footer: {
        total_ht: 0
    }
}; 