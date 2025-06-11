'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/app/database/supabaseClient';
import { toast } from 'react-hot-toast';
import { useSession } from '@/app/component/SessionProvider';
import { BSDCerfa } from './ExtractBSD';
import { RowBSD } from '@/app/register/interface/BSD_Interface';


interface LinkBSDProps {
  pdf_id: number;
  isOpen?: boolean;
  onClose?: () => void;
  onLink?: (bsd_id: string) => void;
}

interface BSDInfos {
  collecteurTransporteur?: {
    datePriseEnCharge?: string;
  };
  declarationmetteur?: {
    date?: string;
  };
  realisationOperation?: {
    date?: string;
  };
  expedition?: {
    dateEnvoi?: string;
  };
  transport?: {
    dateEnlevement?: string;
    dateReception?: string;
  };
}

function cleanDate(input: string | undefined): Date | null {
  if (!input) return null;
  
  const normalized = input.trim().replace(/[^0-9]/g, '-').replace(/-+/g, '-');
  const patterns: RegExp[] = [
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,     // DD-MM-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,     // YYYY-MM-DD
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    let year: number, month: number, day: number;

    if (pattern === patterns[0]) {
      // DD-MM-YYYY
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
    } else {
      // YYYY-MM-DD
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
    }

    const currentYear = new Date().getFullYear();
    if (year < currentYear - 5 || year > currentYear + 5) return null;

    const date = new Date(year, month - 1, day);
    // Vérifie que la date est valide (ex : pas 2025-02-31)
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date;
    }
  }

  return null;
}

function extractValidDates(infos: BSDInfos): Date[] {
  const dates = [
    cleanDate(infos?.collecteurTransporteur?.datePriseEnCharge),
    cleanDate(infos?.declarationmetteur?.date),
    cleanDate(infos?.realisationOperation?.date),
    cleanDate(infos?.expedition?.dateEnvoi),
    cleanDate(infos?.transport?.dateEnlevement),
    cleanDate(infos?.transport?.dateReception)
  ];

  return dates.filter((date): date is Date => date !== null && !isNaN(date.getTime()));
}

export default function LinkBSD({ pdf_id }: LinkBSDProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBsdId, setselectedBsdId] = useState<string>('');
  const [bsdPdf, setBsdPdf] = useState<BSDCerfa | null>(null);
  const [candidateBSDs, setCandidateBSDs] = useState<RowBSD[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const { entreprise_id } = useSession();

  const fetchBSDData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch BSD PDF data
      const { data: pdfData, error: pdfError } = await supabase
        .from('bsd_pdf')
        .select('infos')
        .eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (pdfError) throw new Error('Erreur lors de la récupération du PDF');
      if (!pdfData) throw new Error('PDF non trouvé');

      setBsdPdf(pdfData.infos);

      // Extraire et valider les dates
      const validDates = extractValidDates(pdfData.infos);
      console.log("validDates", validDates);

      if (validDates.length === 0) {
        throw new Error('Aucune date valide trouvée dans le PDF');
      }

      // Trouver la date min et max
      const minDateValue = new Date(Math.min(...validDates.map((d: Date) => d.getTime())));
      const maxDateValue = new Date(Math.max(...validDates.map((d: Date) => d.getTime())));

      // Mettre à jour l'état avec les dates min/max
      setMinDate(minDateValue);
      setMaxDate(maxDateValue);

      // Calculer les dates de début et fin (±5 jours)
      const startDate = new Date(minDateValue);
      startDate.setDate(minDateValue.getDate() - 5);
      const endDate = new Date(maxDateValue);
      endDate.setDate(maxDateValue.getDate() + 5);

      // Nettoyer le code CED du PDF
      const pdfCodeCED = pdfData.infos?.dechet?.code?.replace(/[\s*]/g, '') || '';

      // Fetch candidate BSDs
      const { data: bsdData, error: bsdError } = await supabase
        .from('bsd')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('entreprise_id', entreprise_id);

      if (bsdError) throw new Error('Erreur lors de la récupération des BSDs');
      
      // Filtrer les BSDs par code CED
      const filteredBSDs = (bsdData || []).filter(bsd => {
        const bsdCodeCED = bsd.infos_json?.formAPI?.createFormInput?.wasteDetails?.code?.replace(/[\s*]/g, '') || '';
        return bsdCodeCED === pdfCodeCED;
      });
      
      setCandidateBSDs(filteredBSDs);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedBsdId) {
      toast.error('Veuillez sélectionner un BSD');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // D'abord, récupérer l'ID du bsd_pdf
      const { data: bsdPdfData, error: bsdPdfError } = await supabase
        .from('bsd_pdf')
        .select('id')
        .eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (bsdPdfError) throw new Error('Erreur lors de la récupération du BS PDF');
      if (!bsdPdfData) throw new Error('BS PDF non trouvé');

      // Mettre à jour le bsd_pdf avec le linked_bsd_id
      const { error: updateBsdPdfError } = await supabase
        .from('bsd_pdf')
        .update({
          linked_bsd_id: selectedBsdId
        })
        .eq('id', bsdPdfData.id)
        //.eq('pdf_id', pdf_id)
        .eq('entreprise_id', entreprise_id);

      if (updateBsdPdfError) throw new Error('Erreur lors de la mise à jour du BS PDF');

      // Récupérer les pdf_ids actuels du BSD
      const { data: ligne_register, error: ligne_register_error } = await supabase
        .from('bsd')
        .select('pdf_ids')
        .eq('id', selectedBsdId)
        .eq('entreprise_id', entreprise_id)
        .single();

      if (ligne_register_error) throw new Error('Erreur lors de la récupération du BSD');
      if (!ligne_register) throw new Error('BSD non trouvé');

      // S'assurer que pdf_ids est un tableau, même s'il est null
      const current_pdf_ids = ligne_register.pdf_ids || [];
      const new_pdf_ids = [...current_pdf_ids, pdf_id];

      // Mettre à jour le BSD avec le nouveau pdf_id
      const { error: update_pdf_ids_error } = await supabase
        .from('bsd')
        .update({
          pdf_ids: new_pdf_ids
        })
        .eq('id', selectedBsdId)
        .eq('entreprise_id', entreprise_id);

      if (update_pdf_ids_error) throw new Error('Erreur lors de la mise à jour des pdf_ids');

      // Mettre à jour le statut dans pdf_infos
      const { error: updateError } = await supabase
        .from('pdf_infos')
        .update({ 
          status: 'linked'
        })
        .eq('id', pdf_id)
        .eq('entreprise_id', entreprise_id);

      if (updateError) throw new Error('Erreur lors de la liaison du BSD');

      toast.success('BSD lié avec succès');
      setIsModalOpen(false);
      setselectedBsdId('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsModalOpen(true);
          fetchBSDData();
        }}
        className="px-3 py-1.5 border border-[var(--green-medium)] text-[var(--green-medium)] rounded-md text-xs hover:bg-green-50 w-[100px] text-center"
      >
        Lier BSD
      </button>

      <Dialog 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium">
                Lier un BSD au PDF
              </Dialog.Title>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-4">Chargement...</div>
            ) : (
              <div className="space-y-6">
                {/* BSD PDF Information */}
                {bsdPdf && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium mb-2">Informations du PDF</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Date minimum</p>
                        <p>{minDate?.toLocaleDateString() || 'Non spécifié'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Date maximum</p>
                        <p>{maxDate?.toLocaleDateString() || 'Non spécifié'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Code déchet</p>
                        <p>{String(bsdPdf.dechet?.code).replace(/[\s*]/g, '') || 'Non spécifié'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Émetteur</p>
                        <p>{bsdPdf.emetteur?.nom || 'Non spécifié'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Destinataire</p>
                        <p>{bsdPdf.installationDestination?.nom || 'Non spécifié'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate BSDs List */}
                <div>
                  <h3 className="font-medium mb-2">BSDs candidats</h3>
                  {candidateBSDs.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun BSD trouvé pour cette date</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {candidateBSDs.map((bsd) => (
                        <label
                          key={bsd.id}
                          className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="bsd"
                            value={bsd.id}
                            checked={selectedBsdId === String(bsd.id)}
                            onChange={(e) => setselectedBsdId(e.target.value)}
                            className="h-4 w-4 text-blue-600"
                          />
                          <div className="flex-1">
                            <p className="font-medium">{bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</p>
                            <p className="text-sm text-gray-600">
                              {bsd.infos_json.formAPI.createFormInput.emitter.company.name} → {bsd.infos_json.formAPI.createFormInput.recipient.company.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(bsd.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleLink}
                    disabled={!selectedBsdId || loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Liaison...' : 'Lier'}
                  </button>
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
