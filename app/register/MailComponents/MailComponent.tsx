'use client';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useMailContext } from './MailContext';
import { getMappingTableFiliere, getFiliere } from '../RegisterComponents/Modal/FormulaireFull/utils_new';

interface EmailTemplate {
    name: string;
    subject: (params: EmailParams) => Promise<string>;
    getBody: (params: EmailParams) => string;
}

interface EmailParams {
    wasteCode: string;
    responsibleName: string;
    containerType: string;
    collectionAddress: string|undefined;
    destinataire: string;
    emetteur: string;
    entrepriseId: string;
    entrepriseName: string;
    wasteDescription: string;
    containerCount: number;
    collectionInstructions?: string;
    responsiblePhone?: string;
    responsibleEmail?: string;
}

interface MailComponentProps {
    params: EmailParams;
    pastBrouillon?: boolean;
    onMobile?: boolean;
}

const emailTemplates: EmailTemplate[] = [
    {
        name: "Demande de collecte",
        subject: async (params: EmailParams) => {
            const mappingTable = await getMappingTableFiliere(params.entrepriseId);
            const filiere = getFiliere(params.wasteCode, mappingTable);
            return `Demande de collecte - ${filiere} | ${params.entrepriseName}`;
        },
        getBody: (params: EmailParams) => `Bonjour Madame, Monsieur,

Nous souhaitons organiser une collecte de déchets au nom de l'entreprise ${params.entrepriseName} dès que possible.

Détails de la collecte:
Déchet : ${params.wasteDescription} : ${params.wasteCode}
Contenants : ${params.containerCount} ${params.containerType}
Adresse : ${params.collectionAddress}
Date : Dès que possible

Merci de bien vouloir nous confirmer la date prévue pour la collecte.

Dans l'attente de votre retour, je vous souhaite une excellente journée.
Cordialement,
${params.responsibleName}

${params.responsiblePhone ? `${params.responsiblePhone}\n` : ''}${params.responsibleEmail ? `${params.responsibleEmail}\n` : ''}${params.entrepriseName}

E-mail envoyé depuis FLEAP.
        `
    },
    {
        name: "Rappel de collecte",
        subject: async (params: EmailParams) => {
            const mappingTable = await getMappingTableFiliere(params.entrepriseId);
            const filiere = getFiliere(params.wasteCode, mappingTable);
            return `Rappel - Collecte de déchets en attente - ${filiere} | ${params.entrepriseName}`;
        },
        getBody: (params: EmailParams) => `
Bonjour Madame, Monsieur,

Ceci est un rappel de la collecte au nom de l'entreprise${params.entrepriseName} :

Détails de la collecte:
Déchet : ${params.wasteDescription} : ${params.wasteCode}
Contenants : ${params.containerCount} ${params.containerType}
Adresse : ${params.collectionAddress}
Date : Dès que possible

La collecte est toujours en attente de traitement

Merci et bonne journée à vous.
Cordialement,
${params.responsibleName}

${params.responsiblePhone ? `${params.responsiblePhone}\n` : ''}${params.responsibleEmail ? `${params.responsibleEmail}\n` : ''}${params.entrepriseName}

E-mail envoyé depuis FLEAP.
        `
    }
];

const MailComponent: React.FC<MailComponentProps> = ({ params, pastBrouillon=false, onMobile=false }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<number>(0);
    const [to, setTo] = useState<string>(params.destinataire || '');
    const [cc, setCc] = useState<string>('');
    const [ccList, setCcList] = useState<string[]>(params.emetteur ? [params.emetteur] : []);
    const [replyTo, setReplyTo] = useState<string>(params.emetteur || '');
    const [subject, setSubject] = useState<string>('');
    const [emailBody, setEmailBody] = useState<string>('');
    const { setIsValidMail, setSendMailFunction } = useMailContext();

    useEffect(() => {
        setTo(params.destinataire || '');
        setReplyTo(params.emetteur || '');
        if (params.emetteur && !ccList.includes(params.emetteur)) {
            setCcList([...ccList, params.emetteur]);
        }
    }, [params.destinataire, params.emetteur]);

    useEffect(() => {
        const getSubject = async () => {
            const subject = await emailTemplates[selectedTemplate].subject(params);
            setSubject(subject);
        };
        getSubject();
        setEmailBody(emailTemplates[selectedTemplate].getBody(params));
    }, [selectedTemplate, params]);

    useEffect(() => {
        if(!to || !replyTo || !subject || !emailBody){
            setIsValidMail(false);
        } else {
            setIsValidMail(true);
        }
    }, [to, replyTo, subject, emailBody]);

    const handleAddCc = () => {
        if (cc && !ccList.includes(cc)) {
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
                    cc: ccList.join(','),
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
    };

    const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSubject(e.target.value);
    };

    return (
        <div className={`mt-7 ${onMobile ? 'w-full px-3' : 'w-[95%] ml-8'} mb-0`}>
            {pastBrouillon && false && <div className="text-center text-xl text-black font-bold">Brouillon</div>}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className={`${onMobile ? 'flex flex-col' : 'grid grid-cols-12 divide-x divide-gray-200'}`}>
                    <div className={`${onMobile ? 'order-1' : 'col-span-4'} p-3 space-y-2.5`}>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Modèle</label>
                            <select 
                                className="block w-full text-xs py-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(Number(e.target.value))}
                            >
                                {emailTemplates.map((template, index) => (
                                    <option key={index} value={index}>{template.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 w-24">À:</label>
                            <input
                                type="email"
                                required
                                className="block w-full text-xs py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-600 w-24">Cc:</label>
                                <div className="flex flex-1 gap-1">
                                    <input
                                        type="email"
                                        className="block flex-1 text-xs py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        value={cc}
                                        onChange={(e) => setCc(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddCc}
                                        className="px-2 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            {ccList.length > 0 && (
                                <div className="mt-1 ml-24 space-y-1">
                                    {ccList.map((email) => (
                                        <div key={email} className="flex items-center gap-1 text-xs">
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
                            <label className="text-xs text-gray-600 w-24">Répondre à:</label>
                            <input
                                type="email"
                                required
                                className="block w-full text-xs py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={replyTo}
                                onChange={(e) => setReplyTo(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 w-24">Objet:</label>
                            <input
                                type="text"
                                required
                                className="block w-full text-xs py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={subject}
                                onChange={handleSubjectChange}
                            />
                        </div>
                    </div>

                    <div className={`${onMobile ? 'order-2' : 'col-span-8'} flex flex-col`}>
                        <textarea
                            required
                            className="flex-1 w-full p-3 text-xs leading-tight text-black font-sans bg-gray-50 border-0 focus:ring-0 resize-none min-h-[250px]"
                            value={emailBody}
                            onChange={handleEmailBodyChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MailComponent;
