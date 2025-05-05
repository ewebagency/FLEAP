import React, { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';


import {
  Site,
  Transporteur,
  Dechet,
  Destinataire,
  Contenant,
  Negociant,
  Courtier,
  CodeTreatment,
  Ecorganisme,
  Contrat,
  BaseLink
} from './types';



interface GroupedLink {
  site: string;
  dechet: string;
  transporteurId?: string;
  destinataireId?: string;
  contenantId?: string;
  negociantId?: string;
  courtierId?: string;
  codeTreatmentId?: string;
  ecoorganismeId?: string;
  contratId?: string;
  mailRecipientType?: string;
}





interface MultiLinkFormProps {
  sites: Site[];
  dechets: Dechet[];
  transporteurs: Transporteur[];
  destinataires: Destinataire[];
  negociants: Negociant[];
  courtiers: Courtier[];
  contenants: Contenant[];
  codeTreatments: CodeTreatment[];
  ecoorganismes: Ecorganisme[];
  contrats: Contrat[];
  transportLinks: BaseLink[];
  destLinks: BaseLink[];
  negociantLinks: BaseLink[];
  courtierLinks: BaseLink[];
  contenantLinks: BaseLink[];
  codeTreatmentLinks: BaseLink[];
  ecoorganismeLinks: BaseLink[];
  contratLinks: BaseLink[];
  onTransportLink: (transportId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onDestLink: (destId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onNegociantLink: (negociantId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onCourtierLink: (courtierId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onCodeTreatmentLink: (codeTreatmentId: string, siteId: string, dechetId: string) => void;
  onEcorganismeLink: (ecoorganismeId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onContratLink: (contratId: string, siteId: string, dechetId: string) => void;
  onUpdateTransportLinks: (links: BaseLink[]) => void;
  onUpdateDestLinks: (links: BaseLink[]) => void;
  onUpdateContenantLinks: (links: BaseLink[]) => void;
  onUpdateNegociantLinks: (links: BaseLink[]) => void;
  onUpdateCourtierLinks: (links: BaseLink[]) => void;
  onUpdateCodeTreatmentLinks: (links: BaseLink[]) => void;
  onUpdateEcorganismeLinks: (links: BaseLink[]) => void;
  onUpdateContratLinks: (links: BaseLink[]) => void;
  onDeleteTransportLink: (transportId: string, siteId: string, dechetId: string) => void;
  onDeleteDestLink: (destId: string, siteId: string, dechetId: string) => void;
  onDeleteNegociantLink: (negociantId: string, siteId: string, dechetId: string) => void;
  onDeleteCourtierLink: (courtierId: string, siteId: string, dechetId: string) => void;
  onDeleteContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onDeleteCodeTreatmentLink: (codeTreatmentId: string, siteId: string, dechetId: string) => void;
  onDeleteEcorganismeLink: (ecoorganismeId: string, siteId: string, dechetId: string) => void;
  onDeleteContratLink: (contratId: string, siteId: string, dechetId: string) => void;
}

const dic_mail_dest = {
  'transporteur': "Transporteur",
  'destinataire': "Destinataire",
  'negociant': "Négociant",
  'courtier': "Courtier",
  'ecoorganisme': "Écoorganisme",
  'contrat': "Contrat"
} as const;

// Formulaire html de création de lien entre site + déchet et entités qui va être utilisé dans le composant LinkComponents
const MultiLinkForm: React.FC<MultiLinkFormProps> = ({
  sites,
  dechets,
  transporteurs,
  destinataires,
  negociants,
  courtiers,
  contenants,
  codeTreatments,
  ecoorganismes,
  contrats,
  transportLinks,
  destLinks,
  negociantLinks,
  courtierLinks,
  contenantLinks,
  codeTreatmentLinks,
  ecoorganismeLinks,
  contratLinks,
  onTransportLink,
  onDestLink,
  onNegociantLink,
  onCourtierLink,
  onContenantLink,
  onCodeTreatmentLink,
  onEcorganismeLink,
  onContratLink,
  onDeleteTransportLink,
  onDeleteDestLink,
  onDeleteNegociantLink,
  onDeleteCourtierLink,
  onDeleteContenantLink,
  onDeleteCodeTreatmentLink,
  onDeleteEcorganismeLink,
  onDeleteContratLink,
  onUpdateTransportLinks,
  onUpdateDestLinks,
  onUpdateContenantLinks,
  onUpdateNegociantLinks,
  onUpdateCourtierLinks,
  onUpdateCodeTreatmentLinks,
  onUpdateEcorganismeLinks,
  onUpdateContratLinks,
}) => {
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedDechet, setSelectedDechet] = useState<string>('');
  const [selectedTransporteur, setSelectedTransporteur] = useState<string>('');
  const [selectedDestinataire, setSelectedDestinataire] = useState<string>('');
  const [selectedNegociant, setSelectedNegociant] = useState<string>('');
  const [selectedCourtier, setSelectedCourtier] = useState<string>('');
  const [selectedContenant, setSelectedContenant] = useState<string>('');
  const [selectedCodeTreatment, setSelectedCodeTreatment] = useState<string>('');
  const [selectedEcorganisme, setSelectedEcorganisme] = useState<string>('');
  const [selectedContrat, setSelectedContrat] = useState<string>('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<GroupedLink | null>(null);
  const [selectedMailRecipient, setSelectedMailRecipient] = useState<string>('');

  // Ajout des états pour les filtres
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [dechetFilter, setDechetFilter] = useState<string>('');
  const [transporteurFilter, setTransporteurFilter] = useState<string>('');
  const [destinataireFilter, setDestinataireFilter] = useState<string>('');
  const [contenantFilter, setContenantFilter] = useState<string>('');
  const [negociantFilter, setNegociantFilter] = useState<string>('');
  const [courtierFilter, setCourtierFilter] = useState<string>('');
  const [codeTreatmentFilter, setCodeTreatmentFilter] = useState<string>('');
  const [ecoorganismeFilter, setEcoorganismeFilter] = useState<string>('');
  const [contratFilter, setContratFilter] = useState<string>('');
  const getGroupedLinks = (): GroupedLink[] => {
    // 1. Créer tous les couples possibles site+dechet
    const allCombinations: GroupedLink[] = [];    
    sites.forEach(site => {
      dechets.forEach(dechet => {
        allCombinations.push({
          site: site.id,
          dechet: dechet.id,
          transporteurId: "",
          destinataireId: "",
          contenantId: "",
          negociantId: "",
          courtierId: "",
          codeTreatmentId: "",
          ecoorganismeId: "",
          contratId: "",
          mailRecipientType: ""
        });
      });
    });





    // 2. Pour chaque type d'item conséquence, remplir les valeurs
    // Transporteurs
    transporteurs.forEach(transporteur => {
      
      const transportLinksForTransporteur = transportLinks.filter(link => link.id === transporteur.id);
      
      
      transportLinksForTransporteur.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.transporteurId = transporteur.id;
          if(link.mail) {
            combination.mailRecipientType = 'transporteur';
          }
        }
      });
    });

    // Destinataires
    destinataires.forEach(destinataire => {
      const destLinksForDestinataire = destLinks.filter(link => link.id === destinataire.id);
      
      destLinksForDestinataire.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.destinataireId = destinataire.id;
          if(link.mail) {
            combination.mailRecipientType = 'destinataire';
          }
        }
      });
    });

    // Contenants
    contenants.forEach(contenant => {
      const contenantLinksForContenant = contenantLinks.filter(link => link.id === contenant.id);
      
      contenantLinksForContenant.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.contenantId = contenant.id;
        }
      });
    });

    // Négociants
    negociants.forEach(negociant => {
      const negociantLinksForNegociant = negociantLinks.filter(link => link.id === negociant.id);
      
      negociantLinksForNegociant.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.negociantId = negociant.id;
          if(link.mail) {
            combination.mailRecipientType = 'negociant';
          }
        }
      });
    });

    // Courtiers
    courtiers.forEach(courtier => {
      const courtierLinksForCourtier = courtierLinks.filter(link => link.id === courtier.id);
      
      courtierLinksForCourtier.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.courtierId = courtier.id;
          if(link.mail) {
            combination.mailRecipientType = 'courtier';
          }
        }
      });
    });

    // Code treatments
    codeTreatments.forEach(codeTreatment => {
      const codeTreatmentLinksForCodeTreatment = codeTreatmentLinks.filter(link => link.id === codeTreatment.id);
      
      codeTreatmentLinksForCodeTreatment.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.codeTreatmentId = codeTreatment.id;
        }
      });
    });

    // Ecoorganismes
    ecoorganismes.forEach(ecoorganisme => {
      const ecoorganismeLinksForEcoorganisme = ecoorganismeLinks.filter(link => link.id === ecoorganisme.id);
      
      ecoorganismeLinksForEcoorganisme.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.ecoorganismeId = ecoorganisme.id;
          if(link.mail) {
            combination.mailRecipientType = 'ecoorganisme';
          }
        }
      });
    });

    // Contrats
    contrats.forEach(contrat => {
      const contratLinksForContrat = contratLinks.filter(link => link.id === contrat.id); 
      
      contratLinksForContrat.forEach(link => {
        const combination = allCombinations.find(
          c => c.site === link.site && c.dechet === link.dechet
        );
        if (combination) {
          combination.contratId = contrat.id;
        }
      });
    });
    
    
    //console.log('allcombinations',allCombinations.map(c => c.mailRecipientType));
    return allCombinations;
  };

  const handleEditLink = (link: GroupedLink) => {
    //console.log('link',link);
    setEditingLink(link);
    setSelectedSite(link.site);
    setSelectedDechet(link.dechet);
    
    setSelectedTransporteur(link.transporteurId || '');
    setSelectedDestinataire(link.destinataireId || '');
    setSelectedContenant(link.contenantId || '');
    setSelectedNegociant(link.negociantId || '');
    setSelectedCourtier(link.courtierId || '');
    setSelectedCodeTreatment(link.codeTreatmentId || '');
    setSelectedEcorganisme(link.ecoorganismeId || '');
    setSelectedContrat(link.contratId || '');
    setSelectedMailRecipient(link.mailRecipientType || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== DÉBUT DU PROCESSUS DE SAUVEGARDE ===');
    console.log('1. Vérification du lien en édition:', editingLink);
    
    if (editingLink) {
      try {
        // Supprimer les anciens liens
        if (editingLink.transporteurId) {
          console.log('2. Suppression de l\'ancien lien transporteur:', {
            transportId: editingLink.transporteurId,
            siteId: editingLink.site,
            dechetId: editingLink.dechet
          });
          await onDeleteTransportLink(editingLink.transporteurId, editingLink.site, editingLink.dechet);
        }
        if (editingLink.destinataireId) {
          await onDeleteDestLink(editingLink.destinataireId, editingLink.site, editingLink.dechet);
        }
        if (editingLink.contenantId) {
          await onDeleteContenantLink(editingLink.contenantId, editingLink.site, editingLink.dechet);
        }
        if (editingLink.negociantId) {
          await onDeleteNegociantLink(editingLink.negociantId, editingLink.site, editingLink.dechet);
        }
        if (editingLink.courtierId) {
          await onDeleteCourtierLink(editingLink.courtierId, editingLink.site, editingLink.dechet);
        }
        if (editingLink.codeTreatmentId) {
          await onDeleteCodeTreatmentLink(editingLink.codeTreatmentId, editingLink.site, editingLink.dechet);
        }
        if (editingLink.ecoorganismeId) {
          await onDeleteEcorganismeLink(editingLink.ecoorganismeId, editingLink.site, editingLink.dechet);
        }
        if (editingLink.contratId) {
          await onDeleteContratLink(editingLink.contratId, editingLink.site, editingLink.dechet);
        }

        // Attendre un court instant pour s'assurer que les suppressions sont terminées
        await new Promise(resolve => setTimeout(resolve, 100));

        // Ajouter les nouveaux liens
        if (selectedTransporteur) {
          console.log('3. Création du nouveau lien transporteur:', {
            transportId: selectedTransporteur,
            siteId: selectedSite,
            dechetId: selectedDechet,
            isMailRecipient: selectedMailRecipient === 'transporteur'
          });
          await onTransportLink(selectedTransporteur, selectedSite, selectedDechet, selectedMailRecipient === 'transporteur');
        }
        if (selectedDestinataire) {
          await onDestLink(selectedDestinataire, selectedSite, selectedDechet, selectedMailRecipient === 'destinataire');
        }
        if (selectedContenant) {
          await onContenantLink(selectedContenant, selectedSite, selectedDechet);
        }
        if (selectedNegociant) {
          await onNegociantLink(selectedNegociant, selectedSite, selectedDechet, selectedMailRecipient === 'negociant');
        }
        if (selectedCourtier) {
          await onCourtierLink(selectedCourtier, selectedSite, selectedDechet, selectedMailRecipient === 'courtier');
        }
        if (selectedCodeTreatment) {
          await onCodeTreatmentLink(selectedCodeTreatment, selectedSite, selectedDechet);
        }
        if (selectedEcorganisme) {
          await onEcorganismeLink(selectedEcorganisme, selectedSite, selectedDechet, selectedMailRecipient === 'ecoorganisme');
        }
        if (selectedContrat) {
          await onContratLink(selectedContrat, selectedSite, selectedDechet);
        }

        // Attendre un court instant pour s'assurer que les créations sont terminées
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mettre à jour l'état local des liens
        const updatedLinks = getGroupedLinks().map(link => {
          if (link.site === selectedSite && link.dechet === selectedDechet) {
            return {
              ...link,
              transporteurId: selectedTransporteur || '',
              destinataireId: selectedDestinataire || '',
              contenantId: selectedContenant || '',
              negociantId: selectedNegociant || '',
              courtierId: selectedCourtier || '',
              codeTreatmentId: selectedCodeTreatment || '',
              ecoorganismeId: selectedEcorganisme || '',
              contratId: selectedContrat || '',
              mailRecipientType: selectedMailRecipient || ''
            };
          }
          return link;
        });

        // Mettre à jour les états des liens de manière synchrone
        const updatePromises = [
          onUpdateTransportLinks(updatedLinks.filter(link => link.transporteurId).map(link => ({
            id: link.transporteurId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'transporteur'
          }))),
          onUpdateDestLinks(updatedLinks.filter(link => link.destinataireId).map(link => ({
            id: link.destinataireId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'destinataire'
          }))),
          onUpdateNegociantLinks(updatedLinks.filter(link => link.negociantId).map(link => ({
            id: link.negociantId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'negociant'
          }))),
          onUpdateCourtierLinks(updatedLinks.filter(link => link.courtierId).map(link => ({
            id: link.courtierId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'courtier'
          }))),
          onUpdateEcorganismeLinks(updatedLinks.filter(link => link.ecoorganismeId).map(link => ({
            id: link.ecoorganismeId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'ecoorganisme'
          }))),
          onUpdateContenantLinks(updatedLinks.filter(link => link.contenantId).map(link => ({
            id: link.contenantId,
            site: link.site,
            dechet: link.dechet
          }))),
          onUpdateCodeTreatmentLinks(updatedLinks.filter(link => link.codeTreatmentId).map(link => ({
            id: link.codeTreatmentId,
            site: link.site,
            dechet: link.dechet
          }))),
          onUpdateContratLinks(updatedLinks.filter(link => link.contratId).map(link => ({
            id: link.contratId,
            site: link.site,
            dechet: link.dechet
          })))
        ];

        await Promise.all(updatePromises);

        console.log('4. Réinitialisation des états');
        setEditingLink(null);
        setSelectedSite('');
        setSelectedDechet('');
        setSelectedTransporteur('');
        setSelectedDestinataire('');
        setSelectedContenant('');
        setSelectedNegociant('');
        setSelectedCourtier('');
        setSelectedCodeTreatment('');
        setSelectedEcorganisme('');
        setSelectedContrat('');
        setSelectedMailRecipient('');
        console.log('=== FIN DU PROCESSUS DE SAUVEGARDE ===');
      } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSite && selectedDechet) {
      try {
        // Ajouter les nouveaux liens
        if (selectedTransporteur) {
          await onTransportLink(selectedTransporteur, selectedSite, selectedDechet, selectedMailRecipient === 'transporteur');
        }
        if (selectedDestinataire) {
          await onDestLink(selectedDestinataire, selectedSite, selectedDechet, selectedMailRecipient === 'destinataire');
        }
        if (selectedContenant) {
          await onContenantLink(selectedContenant, selectedSite, selectedDechet);
        }
        if (selectedNegociant) {
          await onNegociantLink(selectedNegociant, selectedSite, selectedDechet, selectedMailRecipient === 'negociant');
        }
        if (selectedCourtier) {
          await onCourtierLink(selectedCourtier, selectedSite, selectedDechet, selectedMailRecipient === 'courtier');
        }
        if (selectedCodeTreatment) {
          await onCodeTreatmentLink(selectedCodeTreatment, selectedSite, selectedDechet);
        }
        if (selectedEcorganisme) {
          await onEcorganismeLink(selectedEcorganisme, selectedSite, selectedDechet, selectedMailRecipient === 'ecoorganisme');
        }
        if (selectedContrat) {
          await onContratLink(selectedContrat, selectedSite, selectedDechet);
        }

        // Attendre un court instant pour s'assurer que les créations sont terminées
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mettre à jour l'état local des liens
        const updatedLinks = getGroupedLinks().map(link => {
          if (link.site === selectedSite && link.dechet === selectedDechet) {
            return {
              ...link,
              transporteurId: selectedTransporteur || '',
              destinataireId: selectedDestinataire || '',
              contenantId: selectedContenant || '',
              negociantId: selectedNegociant || '',
              courtierId: selectedCourtier || '',
              codeTreatmentId: selectedCodeTreatment || '',
              ecoorganismeId: selectedEcorganisme || '',
              contratId: selectedContrat || '',
              mailRecipientType: selectedMailRecipient || ''
            };
          }
          return link;
        });

        // Mettre à jour les états des liens de manière synchrone
        const updatePromises = [
          onUpdateTransportLinks(updatedLinks.filter(link => link.transporteurId).map(link => ({
            id: link.transporteurId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'transporteur'
          }))),
          onUpdateDestLinks(updatedLinks.filter(link => link.destinataireId).map(link => ({
            id: link.destinataireId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'destinataire'
          }))),
          onUpdateNegociantLinks(updatedLinks.filter(link => link.negociantId).map(link => ({
            id: link.negociantId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'negociant'
          }))),
          onUpdateCourtierLinks(updatedLinks.filter(link => link.courtierId).map(link => ({
            id: link.courtierId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'courtier'
          }))),
          onUpdateEcorganismeLinks(updatedLinks.filter(link => link.ecoorganismeId).map(link => ({
            id: link.ecoorganismeId,
            site: link.site,
            dechet: link.dechet,
            mail: link.mailRecipientType === 'ecoorganisme'
          }))),
          onUpdateContenantLinks(updatedLinks.filter(link => link.contenantId).map(link => ({
            id: link.contenantId,
            site: link.site,
            dechet: link.dechet
          }))),
          onUpdateCodeTreatmentLinks(updatedLinks.filter(link => link.codeTreatmentId).map(link => ({
            id: link.codeTreatmentId,
            site: link.site,
            dechet: link.dechet
          }))),
          onUpdateContratLinks(updatedLinks.filter(link => link.contratId).map(link => ({
            id: link.contratId,
            site: link.site,
            dechet: link.dechet
          })))
        ];

        await Promise.all(updatePromises);

        // Réinitialiser les sélections
        setSelectedTransporteur('');
        setSelectedDestinataire('');
        setSelectedNegociant('');
        setSelectedCourtier('');
        setSelectedContenant('');
        setSelectedCodeTreatment('');
        setSelectedEcorganisme('');
        setSelectedContrat('');
        setSelectedMailRecipient('');
      } catch (error) {
        console.error('Erreur lors de la création des liens:', error);
      }
    }
  };

  // Fonction de filtrage
  const filterLinks = (links: GroupedLink[]) => {
    return links.filter(link => {
      const site = sites.find(s => s.id === link.site);
      const dechet = dechets.find(d => d.id === link.dechet);
      const transporteur = transporteurs.find(t => t.id === link.transporteurId);
      const destinataire = destinataires.find(d => d.id === link.destinataireId);
      const contenant = contenants.find(c => c.id === link.contenantId);
      const negociant = negociants.find(n => n.id === link.negociantId);
      const courtier = courtiers.find(c => c.id === link.courtierId);
      const codeTreatment = codeTreatments.find(ct => ct.id === link.codeTreatmentId);
      const ecoorganisme = ecoorganismes.find(eo => eo.id === link.ecoorganismeId);
      const contrat = contrats.find(c => c.id === link.contratId);

      const siteName = site?.nom || '';
      const dechetName = dechet?.nom || '';
      const transporteurName = transporteur?.nomBoite || '';
      const destinataireName = destinataire?.nomBoite || '';
      const contenantName = contenant?.nom || '';
      const negociantName = negociant?.nomBoite || '';
      const courtierName = courtier?.nomBoite || '';
      const codeTreatmentName = codeTreatment?.nom || '';
      const ecoorganismeName = ecoorganisme?.nomBoite || '';
      const contratName = contrat?.nom || '';

      return (
        (!siteFilter || siteName.toLowerCase().includes(siteFilter.toLowerCase())) &&
        (!dechetFilter || dechetName.toLowerCase().includes(dechetFilter.toLowerCase())) &&
        (!transporteurFilter || transporteurName.toLowerCase().includes(transporteurFilter.toLowerCase())) &&
        (!destinataireFilter || destinataireName.toLowerCase().includes(destinataireFilter.toLowerCase())) &&
        (!contenantFilter || contenantName.toLowerCase().includes(contenantFilter.toLowerCase())) &&
        (!negociantFilter || negociantName.toLowerCase().includes(negociantFilter.toLowerCase())) &&
        (!courtierFilter || courtierName.toLowerCase().includes(courtierFilter.toLowerCase())) &&
        (!codeTreatmentFilter || codeTreatmentName.toLowerCase().includes(codeTreatmentFilter.toLowerCase())) &&
        (!ecoorganismeFilter || ecoorganismeName.toLowerCase().includes(ecoorganismeFilter.toLowerCase())) &&
        (!contratFilter || contratName.toLowerCase().includes(contratFilter.toLowerCase()))
      );
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Liens Site + Déchet</h3>
      <form onSubmit={editingLink ? handleSaveEdit : handleSubmit} className="space-y-4">
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showAdvancedOptions ? (
              <>
                <span>Masquer options avancées</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>Afficher options avancées</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-60">
                  <div className="flex flex-col items-center gap-2">
                    <span>Site + Déchet</span>
                    <div className="flex gap-2 w-full">
                      <select
                        value={selectedSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                        className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                      >
                        <option value="">Site</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.nom}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedDechet}
                        onChange={(e) => setSelectedDechet(e.target.value)}
                        className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                      >
                        <option value="">Déchet</option>
                        {dechets.map((dechet) => (
                          <option key={dechet.id} value={dechet.id}>
                            {dechet.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  <div className="flex flex-col gap-2">
                    <span>Transporteur</span>
                    <select
                      value={selectedTransporteur}
                      onChange={(e) => setSelectedTransporteur(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Transporteur</option>
                      {transporteurs.map((transporteur) => (
                        <option key={transporteur.id} value={transporteur.id}>
                          {transporteur.nomBoite}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  <div className="flex flex-col gap-2">
                    <span>Destinataire</span>
                    <select
                      value={selectedDestinataire}
                      onChange={(e) => setSelectedDestinataire(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Destinataire</option>
                      {destinataires.map((destinataire) => (
                        <option key={destinataire.id} value={destinataire.id}>
                          {destinataire.nomBoite}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  <div className="flex flex-col gap-2">
                    <span>Contenant</span>
                    <select
                      value={selectedContenant}
                      onChange={(e) => setSelectedContenant(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Contenant</option>
                      {contenants.map((contenant) => (
                        <option key={contenant.id} value={contenant.id}>
                          {contenant.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  <div className="flex flex-col gap-2">
                    <span>Traitement</span>
                    <select
                      value={selectedCodeTreatment}
                      onChange={(e) => setSelectedCodeTreatment(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Code Traitement</option>
                      {(codeTreatments || []).map((codeTreatment) => (
                        <option key={codeTreatment.id} value={codeTreatment.id}>
                          {codeTreatment.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  <div className="flex flex-col gap-2">
                    <span>Mail</span>
                    <select
                      value={selectedMailRecipient}
                      onChange={(e) => setSelectedMailRecipient(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Mail</option>
                      <option value="transporteur">Transporteur</option>
                      <option value="destinataire">Destinataire</option>
                      <option value="negociant">Négociant</option>
                      <option value="courtier">Courtier</option>
                      <option value="ecoorganisme">Écoorganisme</option>
                    </select>
                  </div>
                </th>
                {showAdvancedOptions && (
                  <>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                      <div className="flex flex-col gap-2">
                        <span>Négociant</span>
                        <select
                          value={selectedNegociant}
                          onChange={(e) => setSelectedNegociant(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Négociant</option>
                          {negociants.map((negociant) => (
                            <option key={negociant.id} value={negociant.id}>
                              {negociant.nomBoite}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                      <div className="flex flex-col gap-2">
                        <span>Courtier</span>
                        <select
                          value={selectedCourtier}
                          onChange={(e) => setSelectedCourtier(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Courtier</option>
                          {courtiers.map((courtier) => (
                            <option key={courtier.id} value={courtier.id}>
                              {courtier.nomBoite}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                      <div className="flex flex-col gap-2">
                        <span>Écoorganisme</span>
                        <select
                          value={selectedEcorganisme}
                          onChange={(e) => setSelectedEcorganisme(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Écoorganisme</option>
                          {ecoorganismes.map((ecoorganisme) => (
                            <option key={ecoorganisme.id} value={ecoorganisme.id}>
                              {ecoorganisme.nomBoite}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                      <div className="flex flex-col gap-2">
                        <span>Contrat</span>
                        <select
                          value={selectedContrat}
                          onChange={(e) => setSelectedContrat(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Contrat</option>
                          {contrats.map((contrat) => (
                            <option key={contrat.id} value={contrat.id}>
                              {contrat.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                  </>
                )}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  <div className="flex flex-col gap-2">
                    <span>Actions</span>
                    <button
                      type="submit"
                      className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                    >
                      {editingLink ? 'Sauvegarder' : 'Lier'}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
          </table>
        </div>
      </form>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Liens existants</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col items-center gap-2 w-60">
                    <span>Site + Déchet</span>
                    <div className="flex gap-2">
                      <select
                        value={siteFilter}
                        onChange={(e) => setSiteFilter(e.target.value)}
                        className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                      >
                        <option value="">Sites</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.nom}>
                            {site.nom}
                          </option>
                        ))}
                      </select>
                      <select
                        value={dechetFilter}
                        onChange={(e) => setDechetFilter(e.target.value)}
                        className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                      >
                        <option value="">Déchets</option>
                        {dechets.map((dechet) => (
                          <option key={dechet.id} value={dechet.nom}>
                            {dechet.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col gap-2">
                    <span>Transporteur</span>
                    <select
                      value={transporteurFilter}
                      onChange={(e) => setTransporteurFilter(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Transporteurs</option>
                      {transporteurs.map((transporteur) => (
                        <option key={transporteur.id} value={transporteur.nomBoite}>
                          {transporteur.nomBoite}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col gap-2">
                    <span>Destinataire</span>
                    <select
                      value={destinataireFilter}
                      onChange={(e) => setDestinataireFilter(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Destinataires</option>
                      {destinataires.map((destinataire) => (
                        <option key={destinataire.id} value={destinataire.nomBoite}>
                          {destinataire.nomBoite}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col gap-2">
                    <span>Contenant</span>
                    <select
                      value={contenantFilter}
                      onChange={(e) => setContenantFilter(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Contenants</option>
                      {contenants.map((contenant) => (
                        <option key={contenant.id} value={contenant.nom}>
                          {contenant.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex flex-col gap-2">
                    <span>Traitement</span>
                    <select
                      value={codeTreatmentFilter}
                      onChange={(e) => setCodeTreatmentFilter(e.target.value)}
                      className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                    >
                      <option value="">Codes traitement</option>
                      {codeTreatments.map((codeTreatment) => (
                        <option key={codeTreatment.id} value={codeTreatment.nom}>
                          {codeTreatment.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mail</th>
                {showAdvancedOptions && (
                  <>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex flex-col gap-2">
                        <span>Négociant</span>
                        <select
                          value={negociantFilter}
                          onChange={(e) => setNegociantFilter(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Négociants</option>
                          {negociants.map((negociant) => (
                            <option key={negociant.id} value={negociant.nomBoite}>
                              {negociant.nomBoite}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex flex-col gap-2">
                        <span>Courtier</span>
                        <select
                          value={courtierFilter}
                          onChange={(e) => setCourtierFilter(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Courtiers</option>
                          {courtiers.map((courtier) => (
                            <option key={courtier.id} value={courtier.nomBoite}>
                              {courtier.nomBoite}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex flex-col gap-2">
                        <span>Écoorganisme</span>
                        <select
                          value={ecoorganismeFilter}
                          onChange={(e) => setEcoorganismeFilter(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Ecoorganismes</option>
                          {ecoorganismes.map((ecoorganisme) => (
                            <option key={ecoorganisme.id} value={ecoorganisme.nomBoite}>
                              {ecoorganisme.nomBoite}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex flex-col gap-2">
                        <span>Contrat</span>
                        <select
                          value={contratFilter}
                          onChange={(e) => setContratFilter(e.target.value)}
                          className="w-full p-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent min-w-[120px]"
                        >
                          <option value="">Contrats</option>
                          {contrats.map((contrat) => (
                            <option key={contrat.id} value={contrat.nom}>
                              {contrat.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                  </>
                )}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filterLinks(getGroupedLinks()).map((link, index) => {
                const site = sites.find(s => s.id === link.site);
                const dechet = dechets.find(d => d.id === link.dechet);
                const transporteur = transporteurs.find(t => t.id === link.transporteurId);
                const destinataire = destinataires.find(d => d.id === link.destinataireId);
                const contenant = contenants.find(c => c.id === link.contenantId);
                const negociant = negociants.find(n => n.id === link.negociantId);
                const courtier = courtiers.find(c => c.id === link.courtierId);
                const codeTreatment = codeTreatments.find(ct => ct.id === link.codeTreatmentId);
                const ecoorganisme = ecoorganismes.find(eo => eo.id === link.ecoorganismeId);
                const contrat = contrats.find(c => c.id === link.contratId);

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center truncate max-w-[250px]">
                      {site?.nom} + {dechet?.nom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transporteur?.nomBoite || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {destinataire?.nomBoite || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contenant?.nom || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {codeTreatment?.nom || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {link.mailRecipientType ? dic_mail_dest[link.mailRecipientType as keyof typeof dic_mail_dest] : '-'}
                    </td>
                    {showAdvancedOptions && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {negociant?.nomBoite || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {courtier?.nomBoite || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {ecoorganisme?.nomBoite || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contrat?.nom || '-'}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditLink(link)}
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full p-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface LinkComponentsProps {
  sites: Site[];
  transporteurs: Transporteur[];
  dechets: Dechet[];
  destinataires: Destinataire[];
  contenants: Contenant[];
  //contactEmetteurs: ContactEmetteur[];
  negociants: Negociant[];
  courtiers: Courtier[];
  codeTreatments: CodeTreatment[];
  contrats: Contrat[];
  ecoorganismes: Ecorganisme[];
  transportLinks: BaseLink[];
  destLinks: BaseLink[];
  contenantLinks: BaseLink[];
  siteContactLinks: BaseLink[];
  negociantLinks: BaseLink[];
  courtierLinks: BaseLink[];
  codeTreatmentLinks: BaseLink[];
  ecoorganismeLinks: BaseLink[];
  contratLinks: BaseLink[];
  onTransportLink: (transportId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onDestLink: (destId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onSiteContactLink: (siteId: string, contactId: string) => void;
  onNegociantLink: (negociantId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onCourtierLink: (courtierId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onCodeTreatmentLink: (codeTreatmentId: string, siteId: string, dechetId: string) => void;
  onEcorganismeLink: (ecoorganismeId: string, siteId: string, dechetId: string, isMailRecipient: boolean) => void;
  onContratLink: (contratId: string, siteId: string, dechetId: string) => void;
  onUpdateTransportLinks: (links: BaseLink[]) => void;
  onUpdateDestLinks: (links: BaseLink[]) => void;
  onUpdateContenantLinks: (links: BaseLink[]) => void;
  onUpdateNegociantLinks: (links: BaseLink[]) => void;
  onUpdateCourtierLinks: (links: BaseLink[]) => void;
  onUpdateCodeTreatmentLinks: (links: BaseLink[]) => void;
  onUpdateEcorganismeLinks: (links: BaseLink[]) => void;
  onUpdateContratLinks: (links: BaseLink[]) => void;
}

const LinkComponents: React.FC<LinkComponentsProps> = ({
  sites,
  transporteurs,
  dechets,
  destinataires,
  contenants,
  //contactEmetteurs,
  negociants,
  courtiers,
  codeTreatments,
  contrats,
  ecoorganismes,
  transportLinks,
  destLinks,
  contenantLinks,
  negociantLinks,
  courtierLinks,
  codeTreatmentLinks,
  contratLinks,
  ecoorganismeLinks,
  onTransportLink,
  onDestLink,
  onContenantLink,
  onNegociantLink,
  onCourtierLink,
  onCodeTreatmentLink,
  onEcorganismeLink,
  onContratLink,
  onUpdateTransportLinks,
  onUpdateDestLinks,
  onUpdateContenantLinks,
  onUpdateNegociantLinks,
  onUpdateCourtierLinks,
  onUpdateCodeTreatmentLinks,
  onUpdateEcorganismeLinks,
  onUpdateContratLinks,
}) => {
  const handleDeleteTransportLink = async (transportId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('transport_link')
        .eq('id', transportId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing transport links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.transport_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string, mail?:boolean}) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ transport_link: updatedLinks })
        .eq('id', transportId);

      if (updateError) {
        console.error('Error updating transport link:', updateError);
        return;
      }

      onUpdateTransportLinks(transportLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteTransportLink:', error);
    }
  };

  const handleDeleteDestLink = async (destId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('dest_link')
        .eq('id', destId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing destination links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.dest_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ dest_link: updatedLinks })
        .eq('id', destId);

      if (updateError) {
        console.error('Error updating destination link:', updateError);
        return;
      }

      onUpdateDestLinks(destLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteDestLink:', error);
    }
  };

  const handleDeleteNegociantLink = async (negociantId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('negociant_link')
        .eq('id', negociantId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing negociant links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.negociant_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ negociant_link: updatedLinks })
        .eq('id', negociantId);

      if (updateError) {
        console.error('Error updating negociant link:', updateError);
        return;
      }

      onUpdateNegociantLinks(negociantLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteNegociantLink:', error);
    }
  };

  const handleDeleteCourtierLink = async (courtierId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('courtier_link')
        .eq('id', courtierId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing courtier links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.courtier_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ courtier_link: updatedLinks })
        .eq('id', courtierId);

      if (updateError) {
        console.error('Error updating courtier link:', updateError);
        return;
      }

      onUpdateCourtierLinks(courtierLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteCourtierLink:', error);
    }
  };

  const handleDeleteContenantLink = async (contenantId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('contenant_link')
        .eq('id', contenantId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing container links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.contenant_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ contenant_link: updatedLinks })
        .eq('id', contenantId);

      if (updateError) {
        console.error('Error updating container link:', updateError);
        return;
      }

      onUpdateContenantLinks(contenantLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteContenantLink:', error);
    }
  };

  const handleDeleteCodeTreatmentLink = async (codeTreatmentId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('code_traitement_link')
        .eq('id', codeTreatmentId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing code treatment links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.code_traitement_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ code_traitement_link: updatedLinks })
        .eq('id', codeTreatmentId);

      if (updateError) {
        console.error('Error updating code treatment link:', updateError);
        return;
      }

      onUpdateCodeTreatmentLinks(codeTreatmentLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteCodeTreatmentLink:', error);
    }
  };

  const handleDeleteContratLink = async (contratId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('contrat_link')
        .eq('id', contratId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing contrat links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.contrat_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ contrat_link: updatedLinks })
        .eq('id', contratId);

      if (updateError) {
        console.error('Error updating contrat link:', updateError);
        return;
      }

      onUpdateContratLinks(contratLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteContratLink:', error);
    }
  };

  const handleDeleteEcorganismeLink = async (ecoorganismeId: string, siteId: string, dechetId: string) => {
    try {
      const { data: existingRecord, error: fetchError } = await supabase
        .from('table_autocompletion')
        .select('eco_organisme_link')
        .eq('id', ecoorganismeId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing ecoorganisme links:', fetchError);
        return;
      }

      const existingLinks = existingRecord?.eco_organisme_link || [];
      const updatedLinks = existingLinks.filter(
        (link: { site: string; dechet: string }) => !(link.site === siteId && link.dechet === dechetId)
      );

      const { error: updateError } = await supabase
        .from('table_autocompletion')
        .update({ eco_organisme_link: updatedLinks })
        .eq('id', ecoorganismeId);

      if (updateError) {
        console.error('Error updating ecoorganisme link:', updateError);
        return;
      }

      onUpdateEcorganismeLinks(ecoorganismeLinks.filter(
        link => !(link.site === siteId && link.dechet === dechetId)
      ));
    } catch (error) {
      console.error('Error in handleDeleteEcorganismeLink:', error);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <MultiLinkForm
        sites={sites}
        dechets={dechets}
        transporteurs={transporteurs}
        destinataires={destinataires}
        negociants={negociants}
        courtiers={courtiers}
        contenants={contenants}
        codeTreatments={codeTreatments}
        contrats={contrats}
        ecoorganismes={ecoorganismes}
        transportLinks={transportLinks}
        destLinks={destLinks}
        negociantLinks={negociantLinks}
        courtierLinks={courtierLinks}
        contenantLinks={contenantLinks}
        codeTreatmentLinks={codeTreatmentLinks}
        contratLinks={contratLinks}
        ecoorganismeLinks={ecoorganismeLinks}
        onTransportLink={onTransportLink}
        onDestLink={onDestLink}
        onNegociantLink={onNegociantLink}
        onCourtierLink={onCourtierLink}
        onContenantLink={onContenantLink}
        onCodeTreatmentLink={onCodeTreatmentLink}
        onEcorganismeLink={onEcorganismeLink}
        onContratLink={onContratLink}
        onUpdateTransportLinks={onUpdateTransportLinks}
        onUpdateDestLinks={onUpdateDestLinks}
        onUpdateContenantLinks={onUpdateContenantLinks}
        onUpdateNegociantLinks={onUpdateNegociantLinks}
        onUpdateCourtierLinks={onUpdateCourtierLinks}
        onUpdateCodeTreatmentLinks={onUpdateCodeTreatmentLinks}
        onUpdateEcorganismeLinks={onUpdateEcorganismeLinks}
        onUpdateContratLinks={onUpdateContratLinks}
        onDeleteTransportLink={handleDeleteTransportLink}
        onDeleteDestLink={handleDeleteDestLink}
        onDeleteNegociantLink={handleDeleteNegociantLink}
        onDeleteCourtierLink={handleDeleteCourtierLink}
        onDeleteContenantLink={handleDeleteContenantLink}
        onDeleteCodeTreatmentLink={handleDeleteCodeTreatmentLink}
        onDeleteEcorganismeLink={handleDeleteEcorganismeLink}
        onDeleteContratLink={handleDeleteContratLink}
      />
    </div>
  );
};

export default LinkComponents;