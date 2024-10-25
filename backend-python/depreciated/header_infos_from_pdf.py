import re
import json

def extract_invoice_info(text):
    # Dictionnaire pour stocker les informations extraites
    invoice_info = {}

    # Expressions régulières pour extraire les informations
    invoice_number_match = re.search(r'Facture N° (\S+)', text)
    if invoice_number_match:
        invoice_info['invoice_number'] = invoice_number_match.group(1)

    billing_period_match = re.search(r'Période de facturation : (\d{2}/\d{2}/\d{4} au \d{2}/\d{2}/\d{4})', text)
    if billing_period_match:
        invoice_info['billing_period'] = billing_period_match.group(1)

    # Recherche d'adresses génériques
    address_search = re.search(r'(\d+ .+?)(\d{5} .+?)\n', text, re.DOTALL)
    if address_search:
        invoice_info['address'] = address_search.group(0).replace('\n', ', ').strip()

    # Téléphone et email génériques
    phone_match = re.search(r'Téléphone: (\S+)', text)
    if phone_match:
        invoice_info['phone'] = phone_match.group(1)

    email_match = re.search(r'Mail: (\S+)', text)
    if email_match:
        invoice_info['email'] = email_match.group(1)

    # Date, Numéro Client, TVA, Mode de Règlement et Échéance
    match = re.search(r'Date N° Client N° TVA Intracommunautaire Mode de règlement Echéance\n(\d{2}/\d{2}/\d{4}) (\S+) (\S+) (\S+) (\S+)', text)
    if match:
        invoice_info['date'] = match.group(1)
        invoice_info['client_number'] = match.group(2)
        invoice_info['vat_number'] = match.group(3)
        invoice_info['payment_method'] = match.group(4)
        invoice_info['due_date'] = match.group(5)

    # Résumé des prestations effectuées
    invoice_info['services'] = []
    service_matches = re.findall(r'(\S.+?)\n.*?(\d{1,2}%)\s*(\d+\.\d+)\s*(\w+)\s*(\d+\.\d+)\s*(\d+\.\d+)', text)
    for service in service_matches:
        invoice_info['services'].append({
            'service_description': service[0],
            'vat_rate': service[1],
            'quantity': service[2],
            'unit': service[3],
            'unit_price': service[4],
            'total_ht': service[5]
        })
    
    # Liens utiles (génériques)
    invoice_info['links'] = {
        'document_retrieval': 'https://example.com/document-retrieval',
        'payment_notice': 'example@example.com',
        'invoice_submission': 'example@example.com'
    }

    return json.dumps(invoice_info, indent=4)

# Exemple d'utilisation
text = """E.PAP Page1/6[NEWLINE]Facture N° D035134220[NEWLINE]Période de facturation : 01/01/2023 au31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelets[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: 0969321010 A L'ATTENTION DE M M[NEWLINE]Mail: contact.sommepasdecalais.rv@suez.com[NEWLINE]RUE DES RIVES DE L'OISE[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE]Date N° Client N° TVA Intracommunautaire Mode de règlement Echéance[NEWLINE]31/01/2023 6848-271484 Chèque 01/04/2023[NEWLINE]Résumé des prestations effectuées TVA Qté Unité PU Total HT[NEWLINE]Attestations de valorisation 7 flux : les attestations seront mises à[NEWLINE]disposition courant mars 2023 à nos clients concernés[NEWLINE]Contacts:[NEWLINE]. Récupérer un document : Rendez-vous sur[NEWLINE]https://espace-entreprises-rv.suez.fr/[NEWLINE]. Transmettre un avis de virement : encaissements.lyon.rv@suez.com[NEWLINE]. Transmettre votre facture de rachat matière:[NEWLINE]facturefournisseur.rvf.fr@suez.com[NEWLINE]ACTIROB[NEWLINE]./VENETTE 60280[NEWLINE]Dossier N° D037009848[NEWLINE]ACTIROB COLLECTE PELICAN 3M3 DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Collecte & Transfert Conteneur pélican3 20% 4,00 UP 63,94 255,76[NEWLINE]m3 20%[NEWLINE]+TGAP Pél/EDI/Eas3m3-G.ISO&NOX&Valo-E-N 4,00 Fixe 3,60 14,40[NEWLINE]ATELIER DIOL[NEWLINE]./VENETTE 60280[NEWLINE]Dossier N° D037009851[NEWLINE]ATELIER DIOL - 1 BAC 770L DIB[NEWLINE]- Passage véhicule 20% 20% 5,00 UP 13,80 69,00[PAGE_BREAK]E.PAP Page2/6[NEWLINE]Facture N° D035134220[NEWLINE]Période de facturation : 01/01/2023 au31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelets[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: 0969321010 A L'ATTENTION DE M M[NEWLINE]Mail: contact.sommepasdecalais.rv@suez.com[NEWLINE]RUE DES RIVES DE L'OISE[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE]Date N° Client N° TVA Intracommunautaire Mode de règlement Echéance[NEWLINE]31/01/2023 6848-271484 Chèque 01/04/2023[NEWLINE]Résumé des prestations effectuées TVA Qté Unité PU Total HT[NEWLINE]MONTANT DU REPORT 339,16[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Collecte & Transfert Bac roulant 770 L 20% 5,00 UP 16,91 84,55[NEWLINE]20%[NEWLINE]+TGAP Bac 770 L - ISO Nox Energ. -E-N 5,00 Fixe 0,92 4,60[NEWLINE]CANTINE[NEWLINE]./VENETTE 60280[NEWLINE]Dossier N° D037009850[NEWLINE]CANTINE - 3 BACS 1000L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Collecte & Transfert Bac roulant 1000 L 20% 14,00 UP 19,21 268,94[NEWLINE]20%[NEWLINE]+TGAP Bac 1000 L - ISO Nox Energ. -E-N 14,00 Fixe 1,20 16,80[NEWLINE]CHARGEMENT PS[NEWLINE]./VENETTE 60280[NEWLINE]Dossier N° D037009855[NEWLINE]CHARGEMENT PS - 2 BACS 770L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200199.)[NEWLINE]- Collecte & Transfert Bac roulant 770 L 20% 4,00 UP 16,91 67,64[NEWLINE]20%[NEWLINE]+TGAP Bac 770 L - ISO Nox Energ. -E-N 4,00 Fixe 0,92 3,68[PAGE_BREAK]E.PAP Page3/6[NEWLINE]Facture N° D035134220[NEWLINE]Période de facturation : 01/01/2023 au31/01/2023[NEWLINE]SITA OISE[NEWLINE]AGENCE ENTREPRISES OISE[NEWLINE]200 Rue des Ormelets[NEWLINE]60126 LONGUEIL STE MARIE OLEON[NEWLINE]Téléphone: 0969321010 A L'ATTENTION DE M M[NEWLINE]Mail: contact.sommepasdecalais.rv@suez.com[NEWLINE]RUE DES RIVES DE L'OISE[NEWLINE]Adresse de votre siège: RUE DES RIVES DE L'OISE[NEWLINE]60280 VENETTE BP 20609[NEWLINE]60280 VENETTE[NEWLINE]Date N° Client N° TVA Intracommunautaire Mode de règlement Echéance[NEWLINE]31/01/2023 6848-271484 Chèque 01/04/2023[NEWLINE]Résumé des prestations effectuées TVA Qté Unité PU Total HT[NEWLINE]MONTANT DU REPORT 785,37[NEWLINE]COUR CENTRAL[NEWLINE]./VENETTE 60280[NEWLINE]Dossier N° D037009856[NEWLINE]COUR CENTRAL - 1 BAC 1000L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Collecte & Transfert Bac roulant 1000 L 20% 2,00 UP 19,21 38,42[NEWLINE]20%[NEWLINE]+TGAP Bac 1000 L - ISO Nox Energ. -E-N 2,00 Fixe 1,20 2,40[NEWLINE]LABO CONTROLE[NEWLINE]./VENETTE 60280[NEWLINE]Dossier N° D037009854[NEWLINE]LABO CONTROLE - 1 BAC 770L DIB[NEWLINE]Matière : Déchets non recyclables en mélange (CED 200301.)[NEWLINE]- Collecte & Transfert Bac roulant 770 L 20% 5,00 UP 16,91 84,55[NEWLINE]20%[NEWLINE]+TGAP Bac 770 L - ISO Nox Energ. -E-N 5,00 Fixe 0,92 4,60[NEWLINE]LABO R&D[NEWLINE]./VENETTE 60280[PAGE_BREAK]"""
invoice_json = extract_invoice_info(text)
print(invoice_json)
