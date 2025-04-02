import { supabase } from '@/app/database/supabaseClient';
import { SessionMore } from '../../component/SessionProvider';

export const handleExcelUpload = async (file: File, user_id: string, entreprise_id: string) => {
    try {
        if (file.size > 50 * 1024 * 1024) { // 50MB limite
            return { 
                success: false, 
                file: file.name, 
                error: 'Le fichier dépasse la taille maximale autorisée (50MB)' 
            };
        }

        // Récupérer les informations de l'utilisateur
        const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', user_id)
            .single();

        if (userError) {
            console.error('Erreur lors de la récupération des informations utilisateur:', userError);
            return { 
                success: false, 
                file: file.name, 
                error: 'Erreur lors de la récupération des informations utilisateur' 
            };
        }

        // Récupérer les informations de l'entreprise
        const { data: entrepriseData, error: entrepriseError } = await supabase
            .from('entreprise')
            .select('name')
            .eq('id', entreprise_id)
            .single();

        if (entrepriseError) {
            console.error('Erreur lors de la récupération des informations entreprise:', entrepriseError);
            return { 
                success: false, 
                file: file.name, 
                error: 'Erreur lors de la récupération des informations entreprise' 
            };
        }

        // Convertir le fichier en base64 pour l'envoi par email
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
                const base64 = reader.result as string;
                // Enlever le préfixe data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,
                const base64Clean = base64.split(',')[1];
                resolve(base64Clean);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Envoyer l'email avec le fichier en pièce jointe
        const response = await fetch('/api/send_mail', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: "asohm@fleap.fr", // Email de destination
                subject: `Nouveau fichier Excel importé - ${file.name}`,
                text: `Un nouveau fichier Excel a été importé par ${userData.first_name} ${userData.last_name} pour l'entreprise ${entrepriseData.name}.\nNom du fichier : ${file.name}`,
                attachments: [{
                    filename: file.name,
                    content: base64Data,
                    contentType: file.type
                }]
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return { 
                success: false, 
                file: file.name, 
                error: error.message || 'Erreur lors de l\'envoi de l\'email' 
            };
        }

        // Créer une entrée dans la table pdf_infos
        const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
        const { error: insertError } = await supabase
            .from('pdf_infos')
            .insert([{
                user_id: user_id,
                entreprise_id: entreprise_id,
                name_pdf: file.name,
                name_pdf_in_bucket: 'excel_import',
                pdf_path: 'excel_import',
                file_size: parseFloat(fileSizeInMB),
                document_type: 'excel'
            }]);

        if (insertError) {
            console.error('Erreur lors de l\'insertion dans pdf_infos:', insertError);
            return { 
                success: false, 
                file: file.name, 
                error: 'Erreur lors de l\'enregistrement du fichier' 
            };
        }

        // Afficher un message de succès
        alert(`Le fichier Excel "${file.name}" a bien été importé sur la base de données, il sera intégré au registre rapidement.`);

        return { success: true, file: file.name };
    } catch (error: unknown) {
        console.error(`Erreur détaillée pour ${file.name}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
        return { 
            success: false, 
            file: file.name, 
            error: errorMessage 
        };
    }
};
