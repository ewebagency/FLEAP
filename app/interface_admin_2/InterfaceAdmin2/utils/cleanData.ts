import { FactureLine, DepartLine } from '../types/interfaces';

const cleanDepartLine = (depart: DepartLine): DepartLine => {
    // Nettoyer line_header
    const cleanedHeader = {
        site_description: depart.line_header.site_description || '',
        site_num_affaire: depart.line_header.site_num_affaire || '',
        site_nom: depart.line_header.site_nom || '',
        site_siret :depart.line_header.site_siret || '',
        dechet_description: depart.line_header.dechet_description || '',
        type_dechet: depart.line_header.type_dechet || '',
        code_dechet: depart.line_header.code_dechet || '',
        filiere: depart.line_header.filiere || '',
        num_dossier: depart.line_header.num_dossier || '',
        bon_intention: depart.line_header.bon_intention || '',
        bon_pesee: depart.line_header.bon_pesee || '',
        //lieu_vidage: depart.line_header.lieu_vidage || '',
        date_depart: depart.line_header.date_depart || '',
    };

    // Nettoyer line_body
    const cleanedBody = depart.line_body.map(body => {
        const cleanedLine = {
            type_operation: body.type_operation || '',
            quantite: body.quantite || 0,
            unite: body.unite || '',
            prix_unitaire: body.prix_unitaire || 0,
            montant_ht: body.montant_ht || 0
        };

        // Ajouter les champs de contenant uniquement si nécessaire
        if (body.type_operation === 'Contenant') {
            return {
                ...cleanedLine,
                description_contenant: body.description_contenant || '',
                type_contenant: body.type_contenant || ''
            };
        }

        return cleanedLine;
    });

    return {
        line_header: cleanedHeader,
        line_body: cleanedBody,
        linked_to_bsd: depart.linked_to_bsd || false
    };
};

export const cleanFormData = (formData: FactureLine): FactureLine => {
    return {
        header: {
            prestataire_nom: formData.header.prestataire_nom || '',
            prestataire_description: formData.header.prestataire_description || '',
            prestataire_siret: formData.header.prestataire_siret || '',
            prestataire_num_client: formData.header.prestataire_num_client || '',
            num_facture: formData.header.num_facture || '',
            date_facture: formData.header.date_facture || '',
        },
        departs: formData.departs.map(cleanDepartLine),
        footer: {
            total_ht: formData.footer.total_ht || 0
        }
    };
}; 