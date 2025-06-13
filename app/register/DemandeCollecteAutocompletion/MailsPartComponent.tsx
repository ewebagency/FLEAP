import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import MailDifferentType from './MailDifferentType';
import { AggregatedMailRecipient } from './utils';
import { useSession } from '@/app/component/SessionProvider';

interface MailsPartComponentProps {
  aggregatedMailRecipients: AggregatedMailRecipient[];
}

export interface MailsPartComponentRef {
  sendAllMails: () => Promise<void>;
}

const MailsPartComponent = forwardRef<MailsPartComponentRef, MailsPartComponentProps>(({ aggregatedMailRecipients }, ref) => {
  const { entreprise_id, user_email, entreprise_name, user_contact, user_phone } = useSession();
  const mailSendFunctions = useRef<(() => Promise<void>)[]>([]);

  useImperativeHandle(ref, () => ({
    sendAllMails: async () => {
      for (const sendMail of mailSendFunctions.current) {
        await sendMail();
      }
    }
  }));

  // Debug logs
  //console.log('MailsPartComponent - aggregatedMailRecipients:', aggregatedMailRecipients);
  //console.log('MailsPartComponent - entreprise_id:', entreprise_id);
  //console.log('MailsPartComponent - user_email:', user_email);

  if (!aggregatedMailRecipients || aggregatedMailRecipients.length === 0) {
    return <div className="text-gray-500 text-center py-4">Aucun destinataire à contacter</div>;
  }

  return (
    <div className="space-y-4">
      {aggregatedMailRecipients.map((recipient, index) => {
        // Récupérer les informations de la première ligne pour l'émetteur
        const firstLine = recipient.lignes[0];
        const site = firstLine.site?.value;
        const pointCollecte = firstLine.pointCollecte;
        const contactEmetteur = firstLine.contactEmetteur?.[0];
        const num_client = firstLine.contrat?.value?.num_client;

        // Debug logs pour chaque destinataire
        /*console.log(`MailsPartComponent - Destinataire ${index}:`, {
          recipient,
          site,
          pointCollecte,
          contactEmetteur
        });*/

        // Convertir les lignes en format wasteLines
        const wasteLines = recipient.lignes.map(line => ({
          code: line.dechet?.value?.codeCED || '',
          description: line.dechet?.value?.nom || '',
          container: line.contenant?.value?.nom || '',
          volume: line.nombreContenant?.toString() || '1',
          volumeUnit: 'unité',
          collectDate: line.date ? new Date(line.date).toISOString().split('T')[0] : '',
          nombreContenant: line.nombreContenant || 1,
          prestationType: line.typePrestation || 'Collecte',
          showTime: line.showTime || false,
          time: line.time || '09:00'
        }));

        // Debug logs pour les wasteLines
        //console.log(`MailsPartComponent - WasteLines ${index}:`, wasteLines);

        const params = {
          emitter: {
            name: site?.nom || '',
            contact: contactEmetteur?.nom || '',
            phone: contactEmetteur?.telephone || '',
            email: user_email || '',
            address: site?.adresseSiege || '',
            workSite: {
              name: pointCollecte?.nom || '',
              fullAddress: pointCollecte?.adresse || '',
              address: pointCollecte?.adresse || '',
              postalCode: '',
              city: ''
            }
          },
          numClient: num_client || '',
          adminEmail: user_email || '',
          destinataire: recipient.destinataire.email,
          ccList: recipient.lignes[0]?.contactEmetteur
            ?.map(c => c.email)
            ?.filter((email): email is string => email !== undefined && email !== '') || [],
          respoTerrain: {
            email: recipient.lignes[0]?.contactEmetteur
              ?.find(c => c.respoTerrain === true)
              ?.email || '',
            nom: recipient.lignes[0]?.contactEmetteur
              ?.find(c => c.respoTerrain === true)
              ?.nom || '',
            telephone: recipient.lignes[0]?.contactEmetteur
              ?.find(c => c.respoTerrain === true)
              ?.telephone || ''
          },
          mention: {
            toMentionned: firstLine.mention?.toMentionned || false,
            mentionType: firstLine.mention?.mentionType || 'recipient',
            mentionCompany: firstLine.destinataireMail === 'transporteur' 
              ? firstLine.destinataire?.value?.nomBoite || ''
              : firstLine.transporteur?.value?.nomBoite || '',
            mentionAddress: firstLine.destinataireMail === 'transporteur'
              ? firstLine.destinataire?.value?.adresse || ''
              : firstLine.transporteur?.value?.adresse || ''
          },
          entrepriseId: entreprise_id || '',
          entrepriseName: entreprise_name || '',
          entrepriseGlobalName: entreprise_name || '',
          wasteLines,
          userContact: user_contact || '',
          userPhone: user_phone || '',
          userEmail: user_email || ''
        };

        // Debug logs pour les params
        //console.log(`MailsPartComponent - Params ${index}:`, params);

        return (
          <div key={index} className="border-t pt-4">
            <MailDifferentType
              params={params}
              onUpdateRecipientEmail={(email) => {
                recipient.destinataire.email = email;
              }}
              onSendMailFunction={(sendMail) => {
                mailSendFunctions.current[index] = sendMail;
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

MailsPartComponent.displayName = 'MailsPartComponent';

export default MailsPartComponent;
