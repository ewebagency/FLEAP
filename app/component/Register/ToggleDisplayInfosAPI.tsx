import { useModal } from "../context/ModalReloadcontext";

interface FormDataWithoutOptions {
    filiere: {
        first: string;
    };
    dechet: {
        first: {
            ced: string;
            description: string;
        };
    };
    contenant: {
        first: {
            nom: string;
            volume: string;
            nombre: string;
        };
    };
    site: {
        first: {
            nom: string;
            adresse: {
                street: string;
                postal_code: string;
                city: string;
            };
            siret: string;
        };
    };
    adresse_collecte: {
        first: string;
    };
    personne_producteur: {
        first: {
            nom: string;
            prenom: string;
            tel: string;
            email: string;
        };
    };
    prestataire_final: {
        first: {
            code_traitement: string;
            cap: string;
            siret: string;
            nom: string;
            adresse: string;
            personne: {
                nom: string;
                prenom: string;
                tel: string;
                email: string;
            };
        };
    };
    transporteur: {
        first: {
            siret: string;
            nom: string;
            adresse: string;
            personne: {
                nom: string;
                prenom: string;
                email: string;
                tel: string;
            };
        };
    };
    dechet_details: {
        first: {
            ced: string;
            onu: string;
            description: string;
        };
    };
    mail?: {
        destinataire: string;
        cc: string[];
        sujet: string;
        message: string;
    };
}

export default function ToggleDisplayInfosAPI({data, onChange}:{data:FormDataWithoutOptions, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}){
    const display = true;
    const { modalId, modalType } = useModal();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onChange({
            target: {
                name,
                value,
                type: 'text',
                checked: false,
            }
        } as React.ChangeEvent<HTMLInputElement>);
    };

    const renderInput = (name: string, value: string) => (
        <input
            type="text"
            name={name}
            value={value || ''}
            onChange={handleInputChange}
            className="w-full p-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-gray-500 rounded"
        />
    );
    return(
        <div className="mt-8 mb-4 mx-auto max-w-3xl">
            {display &&
                <div className="overflow-x-auto bg-white rounded-lg shadow-lg p-6">
                    <div className="grid grid-cols-2 gap-3 px-3">
                        <div className="space-y-6 w-full max-w-xl mx-auto">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="bg-gray-200 text-lg text-center">Références importantes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="font-semibold w-1/2">Site émetteur</td>
                                        <td>{renderInput('site.first.nom', data.site.first.nom)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">SIRET émetteur</td>
                                        <td>{renderInput('site.first.siret', data.site.first.siret)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Filière</td>
                                        <td>{renderInput('filiere.first', data.filiere.first)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Code déchet</td>
                                        <td>{renderInput('dechet_details.first.ced', data.dechet_details.first.ced)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="bg-gray-200 text-lg text-center">Informations déchet</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="font-semibold w-1/2">Description</td>
                                        <td>{renderInput('dechet_details.first.description', data.dechet_details.first.description)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Code ONU</td>
                                        <td>{renderInput('dechet_details.first.onu', data.dechet_details.first.onu)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contenant</td>
                                        <td>
                                            {renderInput('contenant.first.nom', data.contenant.first.nom)}
                                            {renderInput('contenant.first.volume', data.contenant.first.volume)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Quantité</td>
                                        <td>{renderInput('contenant.first.nombre', data.contenant.first.nombre)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="bg-gray-200 text-lg text-center">Chaîne de prestataires</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="font-semibold w-2/5">Transporteur</td>
                                        <td className="space-y-1">
                                            {renderInput('transporteur.first.nom', data.transporteur.first.nom)}
                                            {renderInput('transporteur.first.siret', data.transporteur.first.siret)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contact transporteur</td>
                                        <td className="space-y-1">
                                            {renderInput('transporteur.first.personne.prenom', data.transporteur.first.personne.prenom)}
                                            {renderInput('transporteur.first.personne.nom', data.transporteur.first.personne.nom)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="space-y-6 w-full max-w-2xl mx-auto">
                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="bg-gray-200 text-lg text-center">Prestataire final</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="font-semibold w-2/5">Destinataire final</td>
                                        <td className="space-y-1">
                                            {renderInput('prestataire_final.first.nom', data.prestataire_final.first.nom)}
                                            {renderInput('prestataire_final.first.siret', data.prestataire_final.first.siret)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contact destinataire</td>
                                        <td className="space-y-1">
                                            {renderInput('prestataire_final.first.personne.prenom', data.prestataire_final.first.personne.prenom)}
                                            {renderInput('prestataire_final.first.personne.nom', data.prestataire_final.first.personne.nom)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Code traitement</td>
                                        <td>{renderInput('prestataire_final.first.code_traitement', data.prestataire_final.first.code_traitement)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">CAP</td>
                                        <td>{renderInput('prestataire_final.first.cap', data.prestataire_final.first.cap)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <table className="table table-zebra w-full">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="bg-gray-200 text-lg text-center">Autres informations</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="font-semibold w-1/2">Adresse d&apos;enlèvement</td>
                                        <td className="space-y-1">
                                            {renderInput('site.first.adresse.street', data.site.first.adresse.street)}
                                            {renderInput('site.first.adresse.postal_code', data.site.first.adresse.postal_code)}
                                            {renderInput('site.first.adresse.city', data.site.first.adresse.city)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contact sur site</td>
                                        <td className="space-y-1">
                                            {renderInput('personne_producteur.first.prenom', data.personne_producteur.first.prenom)}
                                            {renderInput('personne_producteur.first.nom', data.personne_producteur.first.nom)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Téléphone</td>
                                        <td>{renderInput('personne_producteur.first.tel', data.personne_producteur.first.tel)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Email</td>
                                        <td>{renderInput('personne_producteur.first.email', data.personne_producteur.first.email)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            }
        </div>
    )
}