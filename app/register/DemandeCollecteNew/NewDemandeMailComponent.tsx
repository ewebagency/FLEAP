'use client';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useMailContext } from '../MailComponents/MailContext';
import { getMappingTableFiliere, getFiliere } from '../RegisterComponents/Modal/FormulaireFull/utils_new';

interface EmailTemplate {
    name: string;
    subject: (params: EmailParams) => Promise<string>;
    getBody: (params: EmailParams) => string;
}

interface EmailParams {
    emitter: {
        name: string;
        contact: string;
        phone: string;
        email: string;
        address: string;
        workSite: {
            name: string;
            fullAddress: string;
            address: string;
            postalCode: string;
            city: string;
        };
    };
    adminEmail: string;
    destinataire: string;
    mention: {
        toMentionned: boolean;
        mentionType: string;
        mentionCompany: string;
        mentionAddress: string;
    };
    entrepriseId: string;
    entrepriseName: string;
    entrepriseGlobalName: string;
    wasteLines: {
        code: string;
        description: string;
        container: string;
        volume: string;
        volumeUnit: string;
        collectDate: string;
    }[];
}

interface MailComponentProps {
    params: EmailParams;
    pastBrouillon?: boolean;
    onMobile?: boolean;
    onUpdateRecipientEmail: (email: string) => void;
}

const emailTemplate: EmailTemplate = {
    name: "Demande de collecte",
    subject: async (params: EmailParams) => {
        const mappingTable = await getMappingTableFiliere(params.entrepriseId);
        const filieres = new Set(params.wasteLines.map(line => 
            getFiliere(line.code, mappingTable)
        ));
        return `Demande de collecte - ${Array.from(filieres).join(', ')} | ${params.entrepriseName}`;
    },
    getBody: (params: EmailParams) => {
        // Grouper les déchets par date de collecte
        const wastesByDate = params.wasteLines.reduce((acc, line) => {
            const date = line.collectDate || 'Dès que possible';
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(line);
            return acc;
        }, {} as { [key: string]: typeof params.wasteLines });

        // Construire l'adresse complète du point de collecte
        const collectAddress = params.emitter.workSite.fullAddress || 
            `${params.emitter.workSite.address || ''} ${params.emitter.workSite.postalCode || ''} ${params.emitter.workSite.city || ''}`.trim();

        return `Bonjour,
Je souhaite organiser des collectes de déchets pour ${params.entrepriseName} ${collectAddress ? `à l'adresse suivante : ${collectAddress}` : ''}.


Voici la liste des collectes attendues :
${Object.entries(wastesByDate).map(([date, lines]) => `
${date === 'Dès que possible' ? 'Dès que possible' : `Le ${date.split('-')[2]}/${date.split('-')[1]}/${date.split('-')[0]}`}
${lines.map(line => {
    const container = line.container; //+ (line.volume ? ` - ${line.volume} ${line.volumeUnit}` : '');
    return `• 1 ${container} ${line.description ? `de ${line.description}` : ''} ${line.code ? `(${line.code})` : ''}`;
}).join('\n')}`).join('\n')}

${params.mention.toMentionned ? (
    params.mention.mentionType === 'recipient' ? `L'installation de destination prévu est ${params.mention.mentionCompany} à l'adresse suivante : ${params.mention.mentionAddress}` 
                                                : `Le transporteur qui collectera les déchets pour vous sera ${params.mention.mentionCompany}`
) : ''}


Merci de me confirmer la prise en charge de toutes les demandes de collecte ci-dessus.


Cordialement,

${params.emitter.contact}
${params.entrepriseGlobalName}
${params.emitter.phone ? `Tél : ${params.emitter.phone}` : ''}
${params.emitter.email ? `Email : ${params.emitter.email}` : ''}

Email envoyé depuis FLEAP
Merci de « Répondre à tous » pour la confirmation`;
    }
};

const NewDemandeMailComponent: React.FC<MailComponentProps> = ({ 
    params, 
    pastBrouillon = false, 
    onMobile = false,
    onUpdateRecipientEmail
}) => {
    const [to, setTo] = useState<string>(params.destinataire || '');
    const [cc, setCc] = useState<string>('');
    const [ccList, setCcList] = useState<string[]>([params.emitter.email]);
    const [replyTo, setReplyTo] = useState<string>(params.emitter.email || '');
    const [subject, setSubject] = useState<string>('');
    const [emailBody, setEmailBody] = useState<string>('');
    const { setIsValidMail, setSendMailFunction } = useMailContext();
    const [userEditedBody, setUserEditedBody] = useState<boolean>(false);

    useEffect(() => {
        setTo(params.destinataire || '');
        setReplyTo(params.emitter.email || '');
        if (params.emitter.email) {
            const emails = [params.emitter.email, params.adminEmail].filter(email => email && email.trim() !== '');
            setCcList(Array.from(new Set([...ccList, ...emails])));
        }
    }, [params.destinataire, params.adminEmail]);

    useEffect(() => {
        onUpdateRecipientEmail(to);
    }, [to, onUpdateRecipientEmail]);

    useEffect(() => {
        const getSubject = async () => {
            const subject = await emailTemplate.subject(params);
            setSubject(subject);
        };
        getSubject();
        
        if (!userEditedBody) {
            setEmailBody(emailTemplate.getBody(params));
        }
    }, [params, userEditedBody]);

    useEffect(() => {
        if(!to || !replyTo || !subject || !emailBody){
            setIsValidMail(false);
        } else {
            setIsValidMail(true);
        }
    }, [to, replyTo, subject, emailBody]);

    const handleAddCc = () => {
        if (cc && !ccList.includes(cc) && cc!="") {
            setCcList([...ccList, cc]);
            setCc('');
        }
    };

    const handleRemoveCc = (email: string) => {
        setCcList(ccList.filter(item => item !== email));
    };

    const handleSubmit = useCallback(async (): Promise<void> => {
        try {
            const response = await fetch('/api/send_mail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to,
                    cc: [...ccList, "contact.prestataire.fleap@gmail.com"].join(','),
                    replyTo,
                    subject,
                    text: emailBody
                }),
            });

            if (response.ok) {
                toast.success('Email envoyé avec succès !');
            } else {
                toast.error('Erreur lors de l\'envoi de l\'email');
            }
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Erreur lors de l\'envoi de l\'email');
        }
    }, [to, cc, replyTo, subject, emailBody, ccList]);

    useEffect(() => {
        setSendMailFunction(handleSubmit);
    }, [handleSubmit]);

    const handleEmailBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEmailBody(e.target.value);
        setUserEditedBody(true);
    };

    const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSubject(e.target.value);
    };

    return (
        <div className={`mt-7 ${onMobile ? 'w-full px-3' : 'w-[95%] ml-8'} mb-0`}>
            {pastBrouillon && false && <div className="text-center text-xl text-black font-bold">Brouillon</div>}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden w-full ml-[-10px]">
                <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-1/3 p-3 space-y-2.5 border-b md:border-b-0 md:border-r border-gray-200">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 w-16 md:w-24">À:</label>
                            <input
                                type="email"
                                className="block w-full text-sm py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 w-16 md:w-24">Cc:</label>
                                <div className="flex flex-1 gap-1">
                                    <input
                                        type="email"
                                        className="block flex-1 text-sm py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        value={cc}
                                        onChange={(e) => setCc(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddCc}
                                        className="px-2 py-1 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            {ccList.length > 0 && (
                                <div className="mt-1 ml-16 md:ml-24 space-y-1">
                                    {ccList.map((email) => (
                                        <div key={email} className="flex items-center gap-1 text-sm">
                                            <span className="flex-1 truncate">{email}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCc(email)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 w-16 md:w-24">Répondre à:</label>
                            <input
                                type="email"
                                className="block w-full text-sm py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={replyTo}
                                onChange={(e) => setReplyTo(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 w-16 md:w-24">Objet:</label>
                            <input
                                type="text"
                                className="block w-full text-sm py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={subject}
                                onChange={handleSubjectChange}
                            />
                        </div>
                    </div>

                    <div className="w-full md:w-2/3 flex flex-col">
                        <textarea
                            className="flex-1 w-full p-3 text-sm leading-tight text-black font-sans bg-gray-50 border-0 focus:ring-0 resize-none min-h-[350px] md:min-h-[350px]"
                            value={emailBody}
                            onChange={handleEmailBodyChange}
                            placeholder="Contenu de l'email"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewDemandeMailComponent;

