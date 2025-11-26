import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/app/database/supabaseClient";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import { useSession } from "@/app/component/SessionProvider";

interface ModifyPromptsProps {
    ragId: string | null;
    documentType: "bon" | "bsd" | "facture" | null;
    pdfId?: string | number;
    pdfPath?: string;
    onReloadRagId?: () => Promise<void>;
}

const ModifyPrompts = ({ ragId, documentType, pdfId, pdfPath, onReloadRagId }: ModifyPromptsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [hasPrompt, setHasPrompt] = useState<boolean | null>(null); // null = en chargement, true = existe, false = n'existe pas
    const [showModal, setShowModal] = useState(false);
    const { entreprise_id } = useSession();

    // URL du backend Python
    const BACKEND_URL = process.env.NEXT_PUBLIC_SERVER_PYTHON || "http://localhost:8000";

    // Charger le prompt depuis la BDD
    const loadPromptFromRAG = useCallback(async () => {
        if (!ragId) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('bdd_rag')
                .select('prompt')
                .eq('id', ragId)
                .eq('entreprise_id', entreprise_id)
                .single();

            if (error) {
                console.error('Erreur lors du chargement du prompt RAG:', error);
                setHasPrompt(false);
                setPrompt("");
                return;
            }

            if (data && data.prompt && data.prompt.trim() !== "") {
                // Prompt existe dans la BDD
                setPrompt(data.prompt);
                setHasPrompt(true);
            } else {
                // Pas de prompt dans la BDD
                setPrompt("");
                setHasPrompt(false);
            }
        } catch (error) {
            console.error('Erreur lors du chargement du prompt RAG:', error);
            setHasPrompt(false);
            setPrompt("");
        } finally {
            setIsLoading(false);
        }
    }, [ragId]);

    // Charger le prompt par défaut depuis le backend
    const loadDefaultPrompt = useCallback(async () => {
        if (!documentType) {
            toast.error("Type de document non défini");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/get-default-prompt?document_type=${documentType}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.prompt) {
                setPrompt(result.prompt);
                setHasPrompt(true); // On considère qu'on a maintenant un prompt
                toast.success("Prompt par défaut chargé");
            } else {
                toast.error("Aucun prompt par défaut trouvé");
            }
        } catch (error) {
            console.error('Erreur lors du chargement du prompt par défaut:', error);
            toast.error(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
        } finally {
            setIsLoading(false);
        }
    }, [documentType, BACKEND_URL]);

    // Sauvegarder le prompt dans la BDD avec Swal et gestion de la relance
    const savePrompt = useCallback(async () => {
        if (!ragId) {
            toast.error("Aucun RAG ID disponible");
            return;
        }

        if (!prompt.trim()) {
            toast.error("Le prompt ne peut pas être vide");
            return;
        }

        setIsSaving(true);
        try {
            // Vérifier les données du RAG : perfect_answer et pdf_infos_id
            const { data: ragData, error: fetchError } = await supabase
                .from('bdd_rag')
                .select('perfect_answer, pdf_infos_id')
                .eq('id', ragId)
                .eq('entreprise_id', entreprise_id)
                .maybeSingle();

            if (fetchError) {
                throw fetchError;
            }

            const hasPerfectAnswer = ragData?.perfect_answer && 
                typeof ragData.perfect_answer === 'object' &&
                Object.keys(ragData.perfect_answer).length > 0;

            // Vérifier si le PDF actuel est différent du PDF du RAG
            const ragPdfId = ragData?.pdf_infos_id ? String(ragData.pdf_infos_id) : null;
            const currentPdfId = pdfId ? String(pdfId) : null;
            const pdfChanged = currentPdfId && ragPdfId && currentPdfId !== ragPdfId;

            // Swal 1 : Demander si on supprime le perfect_answer
            let shouldDeletePerfectAnswer = false;
            if (hasPerfectAnswer) {
                const result1 = await Swal.fire({
                    title: 'Supprimer les réponses précédentes ?',
                    html: pdfChanged 
                        ? `Vous modifiez le prompt depuis un PDF différent de celui utilisé précédemment.<br/><br/>`
                        + `Souhaitez-vous <strong>supprimer les réponses extraites précédemment</strong> pour ce RAG ?<br/><br/>`
                        + `<em>Ces réponses seront recalculées lors de la prochaine extraction avec le nouveau prompt.</em>`
                        : `Souhaitez-vous <strong>supprimer les réponses extraites précédemment</strong> pour ce RAG ?<br/><br/>`
                        + `<em>Ces réponses seront recalculées lors de la prochaine extraction avec le nouveau prompt.</em>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Oui, supprimer',
                    cancelButtonText: 'Non, conserver'
                });

                shouldDeletePerfectAnswer = result1.isConfirmed;
            }

            // Sauvegarder le prompt
            const { error: updateError } = await supabase
                .from('bdd_rag')
                .update({ prompt: prompt.trim() })
                .eq('id', ragId)
                .eq('entreprise_id', entreprise_id);

            if (updateError) {
                throw updateError;
            }

            // Si le PDF a changé, supprimer perfect_answer et préparer la mise à jour
            if (pdfChanged && shouldDeletePerfectAnswer) {
                // Supprimer perfect_answer car il était lié à l'ancien PDF
                const { error: deleteError } = await supabase
                    .from('bdd_rag')
                    .update({ perfect_answer: null })
                    .eq('id', ragId)
                    .eq('entreprise_id', entreprise_id);

                if (deleteError) {
                    console.error('Erreur lors de la suppression du perfect_answer:', deleteError);
                }

                // Swal 2 : Informer l'utilisateur (PDF changé)
                await Swal.fire({
                    title: 'PDF différent détecté',
                    html: `<strong>Le prompt a été modifié avec succès.</strong><br/><br/>`
                        + `Vous modifiez depuis un PDF différent de celui utilisé initialement.<br/><br/>`
                        + `<strong>Pour appliquer les changements :</strong><br/>`
                        + `1️⃣ Cliquez sur <strong>&quot;Extraire&quot;</strong> pour relancer l&apos;extraction avec le nouveau prompt<br/>`
                        + `2️⃣ Puis cliquez sur <strong>&quot;Push to RAG&quot;</strong> pour mettre à jour les données du RAG<br/><br/>`
                        + `<em>Les deux PDFs resteront liés au même RAG.</em>`,
                    icon: 'info',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'Compris'
                });
            } else if (shouldDeletePerfectAnswer) {
                // Supprimer perfect_answer si demandé (même PDF)
                const { error: deleteError } = await supabase
                    .from('bdd_rag')
                    .update({ perfect_answer: null })
                    .eq('id', ragId)
                    .eq('entreprise_id', entreprise_id);

                if (deleteError) {
                    console.error('Erreur lors de la suppression du perfect_answer:', deleteError);
                }

                // Swal 2 : Informer l'utilisateur de relancer l'extraction (même PDF)
                await Swal.fire({
                    title: 'Prompt modifié avec succès',
                    html: `<strong>Les réponses précédentes ont été supprimées.</strong><br/><br/>`
                        + `N&apos;oubliez pas de cliquer sur <strong>&quot;Extraire&quot;</strong> pour relancer l&apos;extraction avec le nouveau prompt !<br/><br/>`
                        + `<em>Les nouvelles réponses seront calculées avec le prompt personnalisé.</em>`,
                    icon: 'success',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'Compris'
                });
            }

            setHasPrompt(true);
            toast.success("Prompt sauvegardé avec succès");
            
            // Toast final pour rappeler de mettre à jour la perfect_answer
            if (!shouldDeletePerfectAnswer) {
                toast("N&apos;oubliez pas de pousser vers RAG après l&apos;extraction pour sauvegarder les nouvelles réponses", {
                    duration: 5000,
                    icon: 'ℹ️'
                });
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du prompt:', error);
            toast.error(`Erreur lors de la sauvegarde: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
        } finally {
            setIsSaving(false);
        }
    }, [ragId, prompt]);

    // Supprimer le prompt (remettre à NULL)
    const deletePrompt = useCallback(async () => {
        if (!ragId) {
            toast.error("Aucun RAG ID disponible");
            return;
        }

        // Confirmation avant suppression
        if (!confirm("Êtes-vous sûr de vouloir supprimer le prompt personnalisé ? Le prompt par défaut sera utilisé lors de la prochaine extraction.")) {
            return;
        }

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('bdd_rag')
                .update({ prompt: null })
                .eq('id', ragId)
                .eq('entreprise_id', entreprise_id);

            if (error) {
                throw error;
            }

            setPrompt("");
            setHasPrompt(false);
            toast.success("Prompt supprimé avec succès. Le prompt par défaut sera utilisé.");
        } catch (error) {
            console.error('Erreur lors de la suppression du prompt:', error);
            toast.error(`Erreur lors de la suppression: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
        } finally {
            setIsDeleting(false);
        }
    }, [ragId]);

    // Charger le prompt au montage si le toggle est ouvert
    useEffect(() => {
        if (isOpen && ragId && hasPrompt === null) {
            void loadPromptFromRAG();
        }
    }, [isOpen, ragId, hasPrompt, loadPromptFromRAG]);

    return (
        <div className="bg-white rounded-lg p-2 mb-2 shadow-sm border border-gray-200">
            {/* Toggle Header */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors"
                disabled={!ragId}
            >
                <span>Modifier le prompt RAG</span>
                <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
            </button>
            
            {/* Message si pas de ragId */}
            {!ragId && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-800 mb-2">
                        <strong>💡 Pour modifier le prompt RAG :</strong><br/>
                        Ce document peut déjà être lié au RAG. Cliquez sur le bouton ci-dessous pour vérifier, ou envoyez ce document vers le RAG en cliquant sur le bouton <strong>&quot;Push to RAG&quot;</strong> dans l&apos;en-tête.
                    </p>
                    {onReloadRagId && (
                        <button
                            type="button"
                            onClick={async () => {
                                await onReloadRagId();
                                toast.success('Vérification effectuée');
                            }}
                            className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
                        >
                            🔍 Vérifier le lien RAG
                        </button>
                    )}
                </div>
            )}

            {/* Contenu collapsible */}
            {isOpen && (
                <div className="mt-3 space-y-3">
                    {isLoading && hasPrompt === null ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <span className="ml-2 text-sm text-gray-600">Chargement...</span>
                        </div>
                    ) : (
                        <>
                            {/* Textarea pour éditer le prompt */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-medium text-gray-700">
                                        Prompt RAG
                                    </label>
                                    {prompt.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(true)}
                                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                                        >
                                            Voir en grand
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                    rows={12}
                                    placeholder={hasPrompt === false ? "Aucun prompt défini. Cliquez sur &quot;Charger prompt par défaut&quot; pour en ajouter un." : "Modifiez le prompt ici..."}
                                />
                            </div>

                            {/* Boutons d'action */}
                            <div className="flex items-center gap-2">
                                {hasPrompt === false && (
                                    <button
                                        type="button"
                                        onClick={loadDefaultPrompt}
                                        disabled={isLoading || !documentType}
                                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? "Chargement..." : "Charger prompt par défaut"}
                                    </button>
                                )}
                                {hasPrompt === true && (
                                    <button
                                        type="button"
                                        onClick={deletePrompt}
                                        disabled={isDeleting || !ragId}
                                        className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isDeleting ? "Suppression..." : "Supprimer prompt"}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={savePrompt}
                                    disabled={isSaving || !prompt.trim() || hasPrompt === false}
                                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                                >
                                    {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                                </button>
                            </div>

                            {/* Info sur l'état */}
                            {hasPrompt === false && (
                                <p className="text-xs text-gray-500 italic">
                                    Aucun prompt personnalisé trouvé pour ce RAG. Vous pouvez charger le prompt par défaut ou en créer un nouveau.
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Modal pour voir le prompt en grand */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full h-[90vh] max-w-5xl flex flex-col">
                        {/* Header du modal */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800">Prompt RAG - Vue complète</h3>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Contenu du modal */}
                        <div className="flex-1 p-4 overflow-hidden">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full h-full px-4 py-3 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-none"
                                placeholder="Prompt RAG..."
                            />
                        </div>

                        {/* Footer du modal */}
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                            >
                                Fermer
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowModal(false);
                                    void savePrompt();
                                }}
                                disabled={isSaving || !prompt.trim()}
                                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModifyPrompts;

