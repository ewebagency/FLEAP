'use client';
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useMailContext } from './MailContext';

interface EmailTemplate {
    name: string;
    subject: string;
    getBody: (params: EmailParams) => string;
}

interface EmailParams {
    wasteCode: string;
    responsibleName: string;
    containerType: string;
    collectionAddress: string|undefined;
    destinataire: string;
    emetteur: string;
}

interface MailComponentProps {
    params: EmailParams;
}

const emailTemplates: EmailTemplate[] = [
    {
        name: "Demande de collecte",
        subject: "Nouvelle demande de collecte de déchets",
        getBody: (params: EmailParams) => `
Bonjour,

Une nouvelle demande de collecte a été créée avec les détails suivants :
- Code déchet : ${params.wasteCode}
- Responsable : ${params.responsibleName}
- Type de contenant : ${params.containerType}
- Adresse de collecte : ${params.collectionAddress}

Merci de bien vouloir traiter cette demande dans les plus brefs délais.

Cordialement,
        `
    },
    {
        name: "Rappel de collecte",
        subject: "Rappel - Collecte de déchets en attente",
        getBody: (params: EmailParams) => `
Bonjour,

Ceci est un rappel concernant la collecte de déchets suivante :
- Code déchet : ${params.wasteCode}
- Responsable : ${params.responsibleName}
- Type de contenant : ${params.containerType}
- Adresse : ${params.collectionAddress}

La collecte est toujours en attente de traitement.

Cordialement,
        `
    }
];

const MailComponent: React.FC<MailComponentProps> = ({ params }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<number>(0);
    const [to, setTo] = useState<string>(params.destinataire || '');
    const [cc, setCc] = useState<string>('');
    const [ccList, setCcList] = useState<string[]>(params.emetteur ? [params.emetteur] : []);
    const [replyTo, setReplyTo] = useState<string>(params.emetteur || '');
    const [subject, setSubject] = useState<string>(emailTemplates[0].subject);
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
        setEmailBody(emailTemplates[selectedTemplate].getBody(params));
        setSubject(emailTemplates[selectedTemplate].subject);
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
        <div className="mt-8 max-w-5xl mx-auto mb-7">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="grid grid-cols-12 divide-x divide-gray-200">
                    <div className="col-span-4 p-4 space-y-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Modèle</label>
                            <select 
                                className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(Number(e.target.value))}
                            >
                                {emailTemplates.map((template, index) => (
                                    <option key={index} value={index}>{template.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">À:</label>
                            <input
                                type="email"
                                required
                                className="block w-full text-sm pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Cc:</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    className="block flex-1 text-sm pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                            {ccList.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {ccList.map((email) => (
                                        <div key={email} className="flex items-center gap-2 text-sm">
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

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Répondre à:</label>
                            <input
                                type="email"
                                required
                                className="block w-full text-sm pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={replyTo}
                                onChange={(e) => setReplyTo(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Objet:</label>
                            <input
                                type="text"
                                required
                                className="block w-full text-sm pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={subject}
                                onChange={handleSubjectChange}
                            />
                        </div>

                        {/*<div className="pt-4">
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Envoyer l'email
                            </button>
                        </div>*/}
                    </div>

                    <div className="col-span-8 flex flex-col">
                        <textarea
                            required
                            className="flex-1 w-full p-4 text-sm text-gray-800 font-sans leading-relaxed bg-gray-50 border-0 focus:ring-0 resize-none min-h-[250px]"
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
