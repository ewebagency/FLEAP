/*import { useState, useCallback } from 'react';
import { BaseLink, Site, Dechet, Transporteur, Destinataire, Contenant, Negociant, Courtier, CodeTreatment, Ecorganisme, Contrat } from '../types';
import { handleLink, handleDeleteLink } from '../linkHandlers';

interface UseLinksProps {
  sites: Site[];
  dechets: Dechet[];
  transporteurs: Transporteur[];
  destinataires: Destinataire[];
  contenants: Contenant[];
  negociants: Negociant[];
  courtiers: Courtier[];
  codeTreatments: CodeTreatment[];
  ecoorganismes: Ecorganisme[];
  contrat: Contrat[];
  transportLinks: BaseLink[];
  destLinks: BaseLink[];
  contenantLinks: BaseLink[];
  negociantLinks: BaseLink[];
  courtierLinks: BaseLink[];
  codeTreatmentLinks: BaseLink[];
  ecoorganismeLinks: BaseLink[];
  contratLinks: BaseLink[];
  onUpdateTransportLinks: (links: BaseLink[]) => void;
  onUpdateDestLinks: (links: BaseLink[]) => void;
  onUpdateContenantLinks: (links: BaseLink[]) => void;
  onUpdateNegociantLinks: (links: BaseLink[]) => void;
  onUpdateCourtierLinks: (links: BaseLink[]) => void;
  onUpdateCodeTreatmentLinks: (links: BaseLink[]) => void;
  onUpdateEcorganismeLinks: (links: BaseLink[]) => void;
  onUpdateContratLinks: (links: BaseLink[]) => void;
}

export const useLinks = ({
  sites,
  dechets,
  transporteurs,
  destinataires,
  contenants,
  negociants,
  courtiers,
  codeTreatments,
  ecoorganismes,
  contrat,
  transportLinks,
  destLinks,
  contenantLinks,
  negociantLinks,
  courtierLinks,
  codeTreatmentLinks,
  ecoorganismeLinks,
  contratLinks,
  onUpdateTransportLinks,
  onUpdateDestLinks,
  onUpdateContenantLinks,
  onUpdateNegociantLinks,
  onUpdateCourtierLinks,
  onUpdateCodeTreatmentLinks,
  onUpdateEcorganismeLinks,
  onUpdateContratLinks,
}: UseLinksProps) => {
  // États pour les sélections
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedDechet, setSelectedDechet] = useState<string>('');
  const [selectedTransporteur, setSelectedTransporteur] = useState<string>('');
  const [selectedDestinataire, setSelectedDestinataire] = useState<string>('');
  const [selectedContenant, setSelectedContenant] = useState<string>('');
  const [selectedNegociant, setSelectedNegociant] = useState<string>('');
  const [selectedCourtier, setSelectedCourtier] = useState<string>('');
  const [selectedCodeTreatment, setSelectedCodeTreatment] = useState<string>('');
  const [selectedEcorganisme, setSelectedEcorganisme] = useState<string>('');
  const [selectedContrat, setSelectedContrat] = useState<string>('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // Gestion des liens
  const handleLinkCreation = useCallback(async (type: string, id: string) => {
    if (!selectedSite || !selectedDechet) return;

    const handlers = {
      transport_link: {
        handler: handleLink,
        update: onUpdateTransportLinks,
        links: transportLinks,
      },
      dest_link: {
        handler: handleLink,
        update: onUpdateDestLinks,
        links: destLinks,
      },
      contenant_link: {
        handler: handleLink,
        update: onUpdateContenantLinks,
        links: contenantLinks,
      },
      negociant_link: {
        handler: handleLink,
        update: onUpdateNegociantLinks,
        links: negociantLinks,
      },
      courtier_link: {
        handler: handleLink,
        update: onUpdateCourtierLinks,
        links: courtierLinks,
      },
      code_traitement: {
        handler: handleLink,
        update: onUpdateCodeTreatmentLinks,
        links: codeTreatmentLinks,
      },
      eco_organisme: {
        handler: handleLink,
        update: onUpdateEcorganismeLinks,
        links: ecoorganismeLinks,
      },
      contrat: {
        handler: handleLink,
        update: onUpdateContratLinks,
        links: contratLinks,
      },
    };

    const handler = handlers[type as keyof typeof handlers];
    if (handler) {
      await handler.handler(type, id, selectedSite, selectedDechet, handler.update, handler.links);
    }
  }, [
    selectedSite,
    selectedDechet,
    transportLinks,
    destLinks,
    contenantLinks,
    negociantLinks,
    courtierLinks,
    codeTreatmentLinks,
    ecoorganismeLinks,
    contratLinks,
    onUpdateTransportLinks,
    onUpdateDestLinks,
    onUpdateContenantLinks,
    onUpdateNegociantLinks,
    onUpdateCourtierLinks,
    onUpdateCodeTreatmentLinks,
    onUpdateEcorganismeLinks,
    onUpdateContratLinks,
  ]);

  const handleLinkDeletion = useCallback(async (type: string, id: string) => {
    if (!selectedSite || !selectedDechet) return;

    const handlers = {
      transport_link: {
        handler: handleDeleteLink,
        update: onUpdateTransportLinks,
        links: transportLinks,
      },
      dest_link: {
        handler: handleDeleteLink,
        update: onUpdateDestLinks,
        links: destLinks,
      },
      contenant_link: {
        handler: handleDeleteLink,
        update: onUpdateContenantLinks,
        links: contenantLinks,
      },
      negociant_link: {
        handler: handleDeleteLink,
        update: onUpdateNegociantLinks,
        links: negociantLinks,
      },
      courtier_link: {
        handler: handleDeleteLink,
        update: onUpdateCourtierLinks,
        links: courtierLinks,
      },
      code_traitement: {
        handler: handleDeleteLink,
        update: onUpdateCodeTreatmentLinks,
        links: codeTreatmentLinks,
      },
      eco_organisme: {
        handler: handleDeleteLink,
        update: onUpdateEcorganismeLinks,
        links: ecoorganismeLinks,
      },
      contrat: {
        handler: handleDeleteLink,
        update: onUpdateContratLinks,
        links: contratLinks,
      },
    };

    const handler = handlers[type as keyof typeof handlers];
    if (handler) {
      await handler.handler(type, id, selectedSite, selectedDechet, handler.update, handler.links);
    }
  }, [
    selectedSite,
    selectedDechet,
    transportLinks,
    destLinks,
    contenantLinks,
    negociantLinks,
    courtierLinks,
    codeTreatmentLinks,
    ecoorganismeLinks,
    contratLinks,
    onUpdateTransportLinks,
    onUpdateDestLinks,
    onUpdateContenantLinks,
    onUpdateNegociantLinks,
    onUpdateCourtierLinks,
    onUpdateCodeTreatmentLinks,
    onUpdateEcorganismeLinks,
    onUpdateContratLinks,
  ]);

  // Gestion des formulaires
  const handleFormSubmit = useCallback(async () => {
    if (!selectedSite || !selectedDechet) return;

    const linksToCreate = [
      { type: 'transport_link', id: selectedTransporteur },
      { type: 'dest_link', id: selectedDestinataire },
      { type: 'contenant_link', id: selectedContenant },
      { type: 'negociant_link', id: selectedNegociant },
      { type: 'courtier_link', id: selectedCourtier },
      { type: 'code_traitement', id: selectedCodeTreatment },
      { type: 'eco_organisme', id: selectedEcorganisme },
      { type: 'contrat', id: selectedContrat },
    ];

    for (const link of linksToCreate) {
      if (link.id) {
        await handleLinkCreation(link.type, link.id);
      }
    }

    // Réinitialiser les sélections
    setSelectedTransporteur('');
    setSelectedDestinataire('');
    setSelectedContenant('');
    setSelectedNegociant('');
    setSelectedCourtier('');
    setSelectedCodeTreatment('');
    setSelectedEcorganisme('');
    setSelectedContrat('');
  }, [
    selectedSite,
    selectedDechet,
    selectedTransporteur,
    selectedDestinataire,
    selectedContenant,
    selectedNegociant,
    selectedCourtier,
    selectedCodeTreatment,
    selectedEcorganisme,
    selectedContrat,
    handleLinkCreation,
  ]);

  // Gestion des options avancées
  const toggleAdvancedOptions = useCallback(() => {
    setShowAdvancedOptions(prev => !prev);
  }, []);

  return {
    // États
    selectedSite,
    setSelectedSite,
    selectedDechet,
    setSelectedDechet,
    selectedTransporteur,
    setSelectedTransporteur,
    selectedDestinataire,
    setSelectedDestinataire,
    selectedContenant,
    setSelectedContenant,
    selectedNegociant,
    setSelectedNegociant,
    selectedCourtier,
    setSelectedCourtier,
    selectedCodeTreatment,
    setSelectedCodeTreatment,
    selectedEcorganisme,
    setSelectedEcorganisme,
    selectedContrat,
    setSelectedContrat,
    showAdvancedOptions,
    setShowAdvancedOptions,

    // Handlers
    handleLinkCreation,
    handleLinkDeletion,
    handleFormSubmit,
    toggleAdvancedOptions,

    // Données
    sites,
    dechets,
    transporteurs,
    destinataires,
    contenants,
    negociants,
    courtiers,
    codeTreatments,
    ecoorganismes,
    contrat,
    transportLinks,
    destLinks,
    contenantLinks,
    negociantLinks,
    courtierLinks,
    codeTreatmentLinks,
    ecoorganismeLinks,
    contratLinks,
  };
}; */