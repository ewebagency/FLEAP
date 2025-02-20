/*'use client';
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
    };
    destinataire: string;
    entrepriseId: string;
    entrepriseName: string;
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
}

const emailTemplates: EmailTemplate[] = [
    {
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

            return `Bonjour,
Je souhaite organiser des collectes de déchets pour ${params.entrepriseName}, au l'adresse suivante : ${params.emitter.address}

J'aurais besoin de collecter :
${Object.entries(wastesByDate).map(([date, lines]) => `
Le ${date.split('-')[2]}/${date.split('-')[1]}/${date.split('-')[0]}
${lines.map(line => {
    const container = line.container + (line.volume ? ` - ${line.volume} ${line.volumeUnit}` : '');
    return `• 1 ${container} ${line.description ? `de ${line.description}` : ''} ${line.code ? `(${line.code})` : ''}`;
}).join('\n')}`).join('\n')}

Merci et bonne journée,

${params.emitter.contact}
${params.entrepriseName}
${params.emitter.phone ? `Tél : ${params.emitter.phone}` : ''}
${params.emitter.email ? `Email : ${params.emitter.email}` : ''}

Email envoyé depuis FLEAP`;
        }
    },
    {
        name: "Rappel de collecte",
        subject: async (params: EmailParams) => {
            const mappingTable = await getMappingTableFiliere(params.entrepriseId);
            const filieres = new Set(params.wasteLines.map(line => 
                getFiliere(line.code, mappingTable)
            ));
            return `Rappel - Collectes en attente - ${Array.from(filieres).join(', ')} | ${params.entrepriseName}`;
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

            return `Bonjour,

Je vous recontacte concernant les collectes en attente pour ${params.entrepriseName}.

Lieu de collecte : ${params.emitter.address}

Détails des collectes :
${Object.entries(wastesByDate).map(([date, lines]) => `
Date souhaitée : ${date}
${lines.map(line => {
    const container = line.container + (line.volume ? ` - ${line.volume} ${line.volumeUnit}` : '');
    return `• ${container} de ${line.description} ${line.code}`;
}).join('\n')}`).join('\n')}

Ces collectes sont toujours en attente. Merci de me tenir informé de leur avancement.

Cordialement,

${params.emitter.contact}
${params.entrepriseName}
${params.emitter.phone ? `Tél : ${params.emitter.phone}` : ''}
${params.emitter.email ? `Email : ${params.emitter.email}` : ''}

--
Email envoyé depuis FLEAP`;
        }
    }
];

const NewDemandeMailComponent: React.FC<MailComponentProps> = ({ params, pastBrouillon=false, onMobile=false }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<number>(0);
    const [to, setTo] = useState<string>(params.destinataire || '');
    const [cc, setCc] = useState<string>('');
    const [ccList, setCcList] = useState<string[]>(params.emitter.email ? [params.emitter.email] : []);
    const [replyTo, setReplyTo] = useState<string>(params.emitter.email || '');
    const [subject, setSubject] = useState<string>('');
    const [emailBody, setEmailBody] = useState<string>('');
    const { setIsValidMail, setSendMailFunction } = useMailContext();


    useEffect(() => {
        setTo(params.destinataire || '');
        setReplyTo(params.emitter.email || '');
        if (params.emitter.email && !ccList.includes(params.emitter.email)) {
            setCcList([...ccList, params.emitter.email]);
        }
    }, [params.destinataire, params.emitter.email]);

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
                                //required
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
                                //required
                                className="block w-full text-xs py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={replyTo}
                                onChange={(e) => setReplyTo(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 w-24">Objet:</label>
                            <input
                                type="text"
                                //required
                                className="block w-full text-xs py-1 pl-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                value={subject}
                                onChange={handleSubjectChange}
                            />
                        </div>
                    </div>

                    <div className={`${onMobile ? 'order-2' : 'col-span-8'} flex flex-col`}>
                        <textarea
                            //required
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

export default NewDemandeMailComponent;

*/