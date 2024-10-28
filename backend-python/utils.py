import re
import json  # Add this import statement

text = """
E.PAP Page1/4\nFacture N° D035134219\nPériode de facturation : 01/01/2023 au31/01/2023\nSITA OISE\nAGENCE ENTREPRISES OISE\n200 Rue des Ormelets\n60126 LONGUEIL STE MARIE OLEON\nTéléphone: 0969321010 A L'ATTENTION DE M M\nMail: contact.sommepasdecalais.rv@suez.com\nRUE DES RIVES DE L'OISE\nAdresse de votre siège: RUE DES RIVES DE L'OISE\n60280 VENETTE BP 20609\n60280 VENETTE\nDate N° Client N° TVA Intracommunautaire Mode de règlement Echéance\n31/01/2023 6848-271484 Chèque 01/04/2023\nRésumé des prestations effectuées TVA Qté Unité PU Total HT\nAttestations de valorisation 7 flux : les attestations seront mises à\ndisposition courant mars 2023 à nos clients concernés\nContacts:\n. Récupérer un document : Rendez-vous sur\nhttps://espace-entreprises-rv.suez.fr/\n. Transmettre un avis de virement : encaissements.lyon.rv@suez.com\n. Transmettre votre facture de rachat matière:\nfacturefournisseur.rvf.fr@suez.com\nCANTINE\n./VENETTE 60280\nDossier N° D037009860\nCANTINE - 1 BAC 1000L PAPIER CARTON\nMatière : Papiers et cartons sortes ordinaires (CED 191201.)\n- Collecte & Tri Bac roulant 1000 L 20% 20% 4,00 UP 5,29 21,16\n- Passage véhicule 20% 20% 4,00 UP 13,80 55,20\nCHARGEMENT PS\n./VENETTE 60280\nDossier N° D037009865\nCHARGEMENT PS - 2 BACS 1000L JAUNE PLASTIQUE\nMatière : Papiers et cartons sortes ordinaires (CED 200101.)\n- Collecte & Tri Bac roulant 1000 L 20% 20% 3,00 UP 5,29 15,87[NEWLINE]Dossier N° D037009866\nCHARGEMENT PS - BAC 1000L BLEU CARTON\n- Collecte & Tri Bac roulant 1000 L 20% 20% 2,00 UP 5,29 10,58\nCONDITIONNEMENT GLYCERINE\nRUE LES RIVES DE L'OISE/VENETTE 60280\nDossier N° D037009871\nCONDITIONNEMENT GLYCERINE - BAC 1000L JAUNE\n- Collecte & Tri Bac roulant 1000 L 20% 20% 5,00 UP 5,29 26,45\nLABO CONTROLE\n./VENETTE 60280\nDossier N° D037009863\nLABO CONTROLE - 1 BAC 1000L PAPIER CARTON\nMatière : Papiers et cartons sortes ordinaires (CED 191201.)\n- Collecte & Tri Bac roulant 1000 L 20% 20% 4,00 UP 5,29 21,16\nLABO R&D\n./VENETTE 60280[NEWLINE]Dossier N° D037009861\nLABO R&D - 1 BAC 1000L PAPIER CARTON\nMatière : Papiers et cartons sortes ordinaires (CED 191201.)\n- Collecte & Tri Bac roulant 1000 L 20% 20% 4,00 UP 5,29 21,16\nMAGASIN\n./VENETTE 60280\nDossier N° D037009862\nMAGASIN OLEON - 1 BAC 1000L PAPIER CARTON\nMatière : Papiers et cartons sortes ordinaires (CED 191201.)\n- Collecte & Tri Bac roulant 1000 L 20% 20% 4,00 UP 5,29 21,16\nMOUVEMENTS\n./VENETTE 60280\nDossier N° D037009864\nMOUVEMENT - 1 BAC 1000L PLASTIQUE\nMatière : Papiers et cartons sortes ordinaires (CED 200101.)\n- Collecte & Tri Bac roulant 1000 L 20% 20% 3,00 UP 5,29 15,87\nOLEON\n./VENETTE 60280[NEWLINE]Dossier N° D037009867\nMOUVEMENTS LOCATION BAC 1000L PAPIER CARTON\n- Collecte & Tri Bac roulant 1000 L 20% 20% 3,00 UP 5,29 15,87\nVotre contact facturation\ncontact.sommepasdecalais.rv@suez.com\nTotal HT 224,48\nHT Taux TVA Montant TTC\nTotal TVA 44,90\n224,48 20% 44,90 269,38\nMontant dû TTC\n269,38\nTotal HT Total TVA NNeett àà ppaayyeerr TTTTCC -- EEUURR\nMerci d'adresser votre règlement\n224,48 44,90 226699,,3388\naccompagné du coupon détachable\nà l'adresse suivante :\nDomiciliation Bancaire : BNP PARIBAS\nCode banque 30004 - Code guichet 00122 - BIC BNPAFRPP SITA OISE\nIBANFR7630004001220001015562131 TSA 30057\nTVA CE : FR 766 205 00 744 41976 BLOIS CEDEX 9\nA l'encaissement N° pièce : D035134219\nN° Client : 6848-271484\nAucun escompte pour paiement anticipé. Si retard, seront appliquées des\nÉchéance :01/04/2023\npénalités égales à 3 fois le taux d'intérêt légal+indemnité forfaitaire mini\nde 40E pour frais de recouvrement + frais complémentaires sur justificatifs Montant TTC : 269,38 EUR\nSiège Social :200 Rue des Ormelets-ZI du Port Salut-60126 LONGUEIL STE MARIE - pour les règlements par chèque, merci de mentionner sur l'ORDRE le nom précis de\nTél : 03 44 92 29 10 - Fax : 03 44 92 22 18 l'entité Suez payée et au VERSO de reporter le n° de la facture et de coller le papillon\nSAS au capital de 500 004 Euros - RC B 620500744 - APE 3811Z - pour les règlements par virement, merci d'intituler dans l’OBJET du paiement les n°\nde factures réglées[NEWLINE]SUEZ RV France 2023\nCONDITIONS GENERALES DE PRESTATIONS ET VENTES\n1. Application 6. Assurance – Responsabilité\nSauf dérogation signée par une personne délégataire d’un pouvoir au sein de l’entité juridique et le Prestataire, les Dès la livraison du matériel, le Client en a la garde et engage sa responsabilité en application des dispositions du\nprésentes Conditions sont applicables aux prestations de services, de vente d'études et de prestations Code civil. En conséquence, le Client doit souscrire les polices d’assurances couvrant cette responsabilité. En cas\nintellectuelles, et d’achats/ventes de matières exécutées par le Prestataire. de sinistre, le Client devra en informer sans délai le Prestataire en précisant les circonstances et ses\n2. Commandes – Livraison conséquences. Le Prestataire sera responsable, dans la limite du montant annuel HT de la prestation, par sinistre\nLes commandes ne sont définitives que lorsqu’elles ont été acceptées par écrit par le Prestataire. En l’absence de et par an, de tout dommage matériel qui pourrait être causé par lui-même, ses préposés et/ou ses sous-traitants\nbon de commande, le Client s’engage à régler la facture du Prestataire. Les contrordres, modifications ou au Client et à ses biens. Les dommages immatériels sont exclus de la responsabilité du Prestataire.\nannulations ne sont valables que s’ils sont donnés par écrit dans un délai raisonnable et accepté par le Prestataire 7. Réclamations\navant le début de la prestation. Le délai de prévenance standard permettant le début opérationnel des prestations Toute réclamation sur les vices apparents ou sur la non-conformité du matériel déposé, doit être formulée par\nest de 72h à partir du devis signé. En deçà, le prestataire se réserve le droit de fixer ses conditions ou de refuser écrit dans les 8 jours de la réception du matériel. Il appartiendra au Client de fournir toute justification quant à la\nd’opérer. réalité des vices ou anomalies constatés.\nLa mise en place des matériels destinés à la collecte des déchets ne pourra intervenir qu’après accord express du 8. Accès aux sites de traitement (apports directs)\nPrestataire sur l’emplacement choisi. Les délais de livraison des matériels sont donnés à titre indicatif et sont L’accès aux sites du Prestataire s’effectuera exclusivement par le pont-bascule où s’effectue la pesée du\nétablis en fonction des possibilités d’approvisionnement et de transport du Prestataire. Si la livraison est retardée chargement ainsi qu’un premier contrôle visuel de la conformité des déchets. Le Client s’engage à faire respecter\ndu fait du Client, le Prestataire aura la faculté de résilier l’engagement cinq jours francs après la date de livraison par son personnel et tous ses préposés et éventuels sous-traitants et transporteurs, ainsi que leur personnel, les\nconvenue avec demande de dommages-intérêts au Client pour préjudice subi. consignes de sécurité et le plan de circulation applicables au site dont un exemplaire sera remis au Client.\n3. Prix – Conditions de paiement – Pénalités 9. Accès au site du Client et collecte\nLes prix sont ceux en vigueur au moment de la passation de la commande, ils sont stipulés en euros et hors taxes. Le Client met tout en oeuvre pour que les véhicules du Prestataire soient présents le moins de temps possible sur\nLa TGAP est reportée sur le Client à son taux en vigueur au moment de la prestation. En cas d’évolution du taux le site de collecte. Un temps d’attente du véhicule de collecte supérieur à 15 minutes sera facturé en sus, par\nde TGAP facturé, Le Client se verra facturer ce complément de TGAP s’il est à la hausse. En cas de baisse de la quart d’heure, selon le tarif en vigueur. Le Prestataire tiendra les justificatifs du temps d’attente, à disposition du\nTGAP du fait d’investissements portés par Le Prestataire afin de changer de tranche de TGAP, Le Client se verra Client jusqu’à la date d’exigibilité de la facture. En cas d’impossibilité imputable au Client, de réaliser une collecte\nappliquer le taux réel de TGAP et facturer en supplément du prix de traitement initial hors TGAP un différentiel planifiée, le Prestataire facturera un passage à vide, selon le tarif en vigueur. Les déchets sont réputés être\nd’un même montant afin de prendre en compte les investissements réalisés. Toute nouvelle taxe applicable aux collectés exclusivement dans des contenants (appartenant, mis à disposition ou loués au Client.). En cas de\nprestations sera refacturée au Client. Indépendamment des obligations faites par l’arrêté du 15/02/2016 relatif aux constat de déchets en vrac, le Prestataire pourra accepter de manière exceptionnelle la collecte qui sera facturée\nISDND. La fiche d’information préalable répond à l’obligation d’information du producteur mentionnée à l’article au Client au tarif en vigueur, selon la quantité estimée en équivalent-bac Le Prestataire tiendra les justificatifs de\nL.541-7-1 du code de l’environnement. Elle engage la responsabilité du producteur et celle de SUEZ sur la base la présence du vrac au sol collecté, à disposition du Client jusqu’à la date d’exigibilité de la facture. L’envoi par\ndes informations fournies. La facture intègre des frais de conditionnement pour la préparation à la vente des mail ou tout autre moyen du Bon d’Intervention au Client atteste de l’intervention du Prestataire et vaut tacite\nmatières valorisables sauf convention expresse, les factures sont payables au siège du Prestataire, à 30 jours nets acceptation du Client.\nde la date de facture, sans escompte ; les traites doivent être retournées acceptées au plus tard dans les 10 jours 10. Obligation de tri et de caractérisation\nà la date de la facture. Passé un délai de 15 jours à compter de la date de la facture sans observation écrite du . Conformément aux dispositions de la Loi n° 2020-105 du 10 février 2020 relative à la lutte contre le gaspillage et\nClient, cette dernière et les prestations correspondantes seront réputées acceptées et ne pourront plus faire l’objet à l'économie circulaire (Loi AGEC), le Client justifie auprès du Prestataire de respecter les obligations de tri\nde réclamations. En outre, le Client renonce à l’application de l’article 1223 du Code Civil prescrites par les articles L. 541-21-1, L. 541-21-2, L. 541-21-2-1 et L. 541-21-2-2 du Code de l’environnement.\nPour certains déchets valorisables qui font l’objet d’un achat par le Prestataire au Client, ce dernier produira une Dès la signature du présent Contrat et, dans tous les cas, en amont de toute réception de déchets par le\nfacture au Prestataire sur la base des bons de rachat matières fournis par le Prestataire. La facture du Client est Prestataire, puis tous les ans à la date anniversaire du Contrat, le Client transmettra au Prestataire une attestation\npayable à 45 jours de la date de facture. Dans le cas où le bon de rachat matière (BRM) est négatif, une de tri à la source conforme au modèle annexé à la fiche d’information préalable (FIP) ou à tout modèle dont\nfacturation sur une ligne intitulée \"Contribution à la filière de recyclage\" vous sera adressée. Toute somme figurant l’utilisation serait rendue obligatoire par les pouvoirs publics. Le Client s’interdit de confier au Prestataire, aux fins\nsur la facture établie par le Prestataire, non payée à l’échéance, entraîne de plein droit dès le jour suivant la date d’élimination par enfouissement, des déchets non ultimes et/ou valorisables, conformément aux articles L.541-2-1\nde règlement portée sur ladite facture : et R.541-48-3-1 du Code de l’environnement. Les déchets non valorisables non dangereux confiés au Prestataire\n• l’application de pénalités d’un montant égal au taux de refinancement semestriel de la Banque Centrale en vue de leur élimination devront faire l’objet d’un rapport annuel de caractérisation, tel que prévu par l’arrêté\nEuropéenne (BCE) majoré de dix (10) points ; ministériel du 16 septembre 2021, préalablement à toute prestation de réception de ces déchets par le\n• une indemnité forfaitaire pour frais de recouvrement fixée à 40 € minimum conformément à l’article D441-5 du Prestataire, puis tous les ans à la date anniversaire de l’entrée en vigueur du Contrat. Toute violation du présent\nCode de commerce. Si les frais de recouvrement engagés par le Prestataire sont supérieurs à 40 €, ce dernier article pourra entrainer un refus de gestion du ou des déchets du Client par le Prestataire, sans que le Client ne\npourra facturer au Client ces frais supplémentaires sur justificatifs. puisse réclamer une quelconque indemnité. En cas de réception par le Prestataire de déchets valorisables et/ou\n• et/ou le droit, au profit du Prestataire de suspendre l’exécution des Prestations en cours et/ou d’exiger un non ultime sur une installation de stockage de déchets non dangereux (ISDND), le Prestataire en informera la\npaiement en contre remboursement pour les Prestations futures jusqu’à complet apurement de la situation et/ou la direction régionale de l'environnement, de l'aménagement et du logement (DREAL) et l’administration fiscale. Le\ncompensation des montants dus avec toute somme à devoir à quelque titre que ce soit à l’égard du Client Prestataire pourra, le cas échéant, répercuter au Client l’application du taux maximum de TGAP prévu à l’article\ndéfaillant. 266 nonies du code des douanes et lui facturer des frais de dossier d’un montant de 190€ par tonne de déchets\n• L’application de la déchéance du terme des autres factures et ce, sans aucune formalité préalable non valorisables réceptionnés.\nAu cas de paiement par effet de commerce, le défaut de retour de l’effet sera considéré comme un refus 11. Force Majeure\nd’acceptation assimilable à un défaut de paiement. Le Prestataire n’est pas tenu en cas de force majeure tels que pénurie de carburant, défaillance des services\nMême en cas de litige sur son libellé ou son contenu, toute facture qui fera, le cas échéant, l’objet ’une publics, grève, catastrophes naturelles, guerre, retrait ou suspension des autorisations d’exploitation sans que\nrégularisation ultérieure, doit être payée à son échéance. Dans l’hypothèse où le Client est redevable de plusieurs cette énumération ne soit limitative.\npaiements à l’égard du Prestataire, il est convenu que l’imputation des paiements s’effectuera sur les dettes les 12. Résiliation\nplus anciennes. En conséquence, le Client renonce expressément aux dispositions de l’article 1342-10 du Code En cas de manquement par le Client à l’une quelconque des obligations nées des présentes conditions, et\ncivil. En cas de bouleversement de l’équilibre économique des relations contractuelles, pour quelque raison que ce notamment en cas de non-paiement de l’une des échéances, ou d’apports répétés de déchets non conformes ou\nsoit, le Prestataire peut demander par LRAR le réexamen du prix et en cas de désaccord pour poursuivre les interdits, le Prestataire pourra résilier le contrat 15 jours après mise en demeure, adressée par lettre\nrelations commerciales, la résiliation du contrat. recommandée avec accusé de réception, demeurée infructueuse. En cas de résiliation anticipée du contrat du\n4. Conditions d’utilisation des matériels destinés à recevoir des déchets fait, ou de par, la faute du Client, le Prestataire percevra une indemnité forfaitaire de résiliation équivalente à la\nLe Client s’engage à utiliser le matériel loué en conformité avec sa destination à l’exclusion de toute autre moyenne des facturations mensuelles faites au Client depuis le début des prestations multipliée par la moitié du\nutilisation. Sauf stipulation contraire écrite du Prestataire, le matériel est à la disposition exclusive du Client. Le nombre de mois restant à courir jusqu’à l’échéance du contrat. En outre les frais de retrait du matériel et de\nchoix, les autorisations et l’accès libre des emplacements destinés à recevoir le matériel incombent au Client, sous traitement éventuel seront facturés au Client. Hormis le cas évoqué ci-dessus, le contrat est conclu pour la durée\nson entière responsabilité notamment en matière de sécurité. Il s’assurera des autorisations de stationnement et mentionnée aux conditions particulières et ses conditions révisables à date anniversaire.\nde balisage de jour comme de nuit. Sauf accord écrit du Prestataire, ce dernier est seul habilité à déplacer le 13. Cas particulier de la vente de matières par le Prestataire – Clause de réserve de propriété\nmatériel. Tout déplacement du matériel, à la suite d’une demande du Client, qui se révèlerait inutile, soit en raison Lors de la vente de matières par le Prestataire, le transfert de propriété de la matière livrée est effectué sous\nde l’encombrement de l’accès à l’emplacement désigné pour déposer ou enlever le matériel, soit en raison d’un réserve du paiement intégral du prix. Le Client est tenu d’informer ses créanciers de la réserve de propriété\nchargement non terminé, fera l’objet d’une facturation complémentaire. En cas de perte, de vol, d’avaries ou de stipulée en faveur du Prestataire. Le défaut de paiement, même partiel, autorise le Prestataire, nonobstant toute\ndégradation partielle ou totale du matériel hors périodes de manutention par le Prestataire, le Client sera tenu clause contraire, à récupérer la matière chez le Client, après première présentation d’une mise en demeure avec\nenvers le Prestataire de la valeur de remplacement du matériel ou du montant des réparations à effectuer, y accusé de réception. Le droit de revendication s'exerce également en cas de procédure collective ouverte à\ncompris les frais de main-d’oeuvre et de déplacement, sans attendre le résultat du recours formulé éventuellement l’encontre du Client. En cas de revente de la matière, le Client s’engage à régler immédiatement au Prestataire la\npar lui-même auprès de sa compagnie d’assurance. L’état du matériel, qui doit être restitué en bon état d’entretien partie du prix restant due. De même, si revente, le Client s’engage à avertir immédiatement le Prestataire pour lui\net de marche, sera constaté à la fin du contrat, avant restitution. Le volume utile d’un conteneur étant calculé ras- permettre d’exercer éventuellement son droit de revendication sur la matière à l’égard du tiers acquéreur. La\nbord, son chargement ne peut en dépasser les bords supérieurs. En cas d’enlèvement de déchets de forte restitution de la matière s'effectuera aux frais et risques du Client.\ndensité, le Client devra s’assurer du niveau maximal que pourra atteindre le chargement pour respecter la 14. Loi applicable – Litige\nréglementation routière en matière de poids total autorisé. Le Client doit prendre toute précaution afin d’éviter toute Les présentes conditions sont soumises à la loi française. Tout litige est de la compétence exclusive du tribunal\nadhésion des déchets au matériel. En cas de non-respect de ces recommandations, le chauffeur pourra refuser de commerce de Paris.\nl’enlèvement du conteneur surchargé. De même, les conséquences des verbalisations dressées par les agents\nassermentés ainsi que les conséquences des accidents seront répercutées sur le Client. Le Client veillera, en cas\nd’utilisation d’un matériel muni d’un système électrique de compaction, à la conformité de l’installation électrique\nalimentant ce matériel et au respect des consignes de sécurité, notamment à l’arrêt du matériel pendant les\nopérations de chargement.\n5. Propriété des matériels mis à disposition\nLe matériel reste la propriété entière et exclusive du Prestataire. D’une manière générale, le Client ne peut\ntransmettre aucun droit réel sur le matériel. Il s’interdit de le donner en gage, de le comprendre parmi les éléments\nfigurant à un nantissement. Il s’interdit également toute sous-location, prêt à usage ou autre, sous quelque forme\nque ce soit. En cas de saisie-arrêt, redressement judiciaire, liquidation ou de toute autre intervention d’un tiers sur\nles matériels, le Client devra impérativement en informer le Prestataire sans délai afin de lui permettre de s’y\nopposer et de préserver ses droits.\nTOUTE COMMANDE IMPLIQUE PAR ELLE MEME ACCEPTATION DES PRESENTES CONDITIONS GENERALES. LE CLIENT DOIT INFORMER LE PRESTATAIRE DANS LES PLUS\nBREFS DELAIS DE SON EVENTUEL DESACCORD SUR LESDITES CONDITIONS.LA DEROGATION EXCEPTIONNELLE ET MOMENTANEE A L’UNE OU L’AUTRE DES PRESENTES\nCONDITIONS GENERALES NE PEUT ETRE INTERPRETEE COMME VALANT RENONCIATION DEFINITIVE POUR DES COMMANDES ULTERIEURES.\nNom du représentant, signature et cachet du Client :[NEWLINE]
"""

def compta_lines_from_text(text):
    pattern_ordre_des_libelles = r"(?:\bTVA\b.*?\bQté\b.*?\bUnité\b.*?\bPU\b.*?\bTotal HT\b)|" \
            r"(?:\bTVA\b.*?\bQté\b.*?\bTotal HT\b.*?\bUnité\b.*?\bPU\b)|" \
            r"(?:\bTVA\b.*?\bPU\b.*?\bQté\b.*?\bUnité\b.*?\bTotal HT\b)|" \
            r"(?:\bTVA\b.*?\bPU\b.*?\bTotal HT\b.*?\bQté\b.*?\bUnité\b)|" \
            r"(?:\bQté\b.*?\bTVA\b.*?\bUnité\b.*?\bPU\b.*?\bTotal HT\b)|" \
            r"(?:\bQté\b.*?\bTVA\b.*?\bTotal HT\b.*?\bUnité\b.*?\bPU\b)|" \
            r"(?:\bQté\b.*?\bPU\b.*?\bTVA\b.*?\bUnité\b.*?\bTotal HT\b)|" \
            r"(?:\bQté\b.*?\bPU\b.*?\bTotal HT\b.*?\bTVA\b.*?\bUnité\b)|" \
            r"(?:\bUnité\b.*?\bTVA\b.*?\bQté\b.*?\bPU\b.*?\bTotal HT\b)|" \
            r"(?:\bUnité\b.*?\bTVA\b.*?\bTotal HT\b.*?\bQté\b.*?\bPU\b)|" \
            r"(?:\bUnité\b.*?\bPU\b.*?\bTVA\b.*?\bQté\b.*?\bTotal HT\b)|" \
            r"(?:\bUnité\b.*?\bPU\b.*?\bTotal HT\b.*?\bTVA\b.*?\bQté\b)|" \
            r"(?:\bPU\b.*?\bTVA\b.*?\bQté\b.*?\bUnité\b.*?\bTotal HT\b)|" \
            r"(?:\bPU\b.*?\bTVA\b.*?\bTotal HT\b.*?\bQté\b.*?\bUnité\b)|" \
            r"(?:\bPU\b.*?\bQté\b.*?\bTVA\b.*?\bUnité\b.*?\bTotal HT\b)|" \
            r"(?:\bPU\b.*?\bQté\b.*?\bTotal HT\b.*?\bTVA\b.*?\bUnité\b)|" \
            r"(?:\bTotal HT\b.*?\bTVA\b.*?\bQté\b.*?\bPU\b.*?\bUnité\b)|" \
            r"(?:\bTotal HT\b.*?\bTVA\b.*?\bUnité\b.*?\bQté\b.*?\bPU\b)|" \
            r"(?:\bTotal HT\b.*?\bPU\b.*?\bTVA\b.*?\bQté\b.*?\bUnité\b)|" \
            r"(?:\bTotal HT\b.*?\bPU\b.*?\bUnité\b.*?\bTVA\b.*?\bQté\b)"

    match = re.search(pattern_ordre_des_libelles, text)
    if match:
        libelles_str = match.group().replace('Total HT', 'Total_HT')
        libelles = libelles_str.split(' ')
        print("Match trouvé :", libelles)
    nbr_libelles = len(libelles)

    compta_lines_list = []
    for line in text.split('\n'):
        reversed_line = line.strip()[::-1]  # Inverser la ligne
        compta_line_pattern = r"\d{2}[,]+\d\s{1}"
        match = re.search(compta_line_pattern, reversed_line)
        if match:
            list_chiffre_brut = line.split(' ')[-nbr_libelles:]
            premier_chiffre = list_chiffre_brut[0]
            
            index_premier_chiffre = line.index(premier_chiffre)
            debut_ligne = line[:index_premier_chiffre].strip()

            list_chiffre_net = []
            for x in list_chiffre_brut:
                if ((',' in x) and ('%' not in x) and ('NEWLINE' not in x)):
                    x = x.replace(',', '.')
                    list_chiffre_net.append(float(x))
                else :
                    list_chiffre_net.append(x)
            
            print(f"Début de la ligne: {debut_ligne}")
            print(f"list_chiffre_brut: {list_chiffre_brut}")
            print(f"list_chiffre_net: {list_chiffre_net}")
            print("---")
            if len(list_chiffre_net) == nbr_libelles:
                dic_compta_line = {}
                for i in range(nbr_libelles):
                    dic_compta_line[libelles[i]] = list_chiffre_net[i]
                compta_lines_list.append({'nom':debut_ligne, 'chiffres': dic_compta_line})
                
    
    return compta_lines_list

def header_from_text(text):
    # Dictionnaire pour stocker les informations extraites
    invoice_info = {}

    # Expressions régulières pour extraire les informations
    invoice_number_match = re.search(r'Facture N° (\S+)', text)
    if invoice_number_match:
        invoice_info['num_facture'] = invoice_number_match.group(1)

    billing_period_match = re.search(r'Période de facturation : (\d{2}/\d{2}/\d{4} au \d{2}/\d{2}/\d{4})', text)
    if billing_period_match:
        invoice_info['billing_period'] = billing_period_match.group(1)

    # Recherche d'adresses génériques
    address_search = re.search(r'(\d+ .+?)(\d{5} .+?)\n', text, re.DOTALL)
    if address_search:
        invoice_info['address'] = address_search.group(0).split('\n')[1:-1]

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


## à rajouter dans mon fonctions parce que ça marche en dessous
#print(header_from_text(text))

#match = re.search(r'Période de facturation : \d{2}/\d{2}/\d{4} au\d{2}/\d{2}/\d{4}', text) # à revoir
#print(match.group())

match = re.search(r'Montant dû TTC\s+([\d,]+)', text)
print(match.group())