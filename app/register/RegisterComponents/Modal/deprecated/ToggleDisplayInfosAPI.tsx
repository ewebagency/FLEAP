import { BSD_Data_Interface } from "@/app/register/interface/BSD_Interface";

export default function ToggleDisplayInfosAPI({data, onChange}:{data:BSD_Data_Interface, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void}){
    const display = true;
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
                                        <td>{renderInput('site.nom.first', data.site.nom.first)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">SIRET émetteur</td>
                                        <td>{renderInput('site.siret.first', String(data.site.siret.first))}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Filière</td>
                                        <td>{renderInput('filiere.nom.first', data.filiere.nom.first)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Code déchet</td>
                                        <td>{renderInput('dechet_dangereux.ced.first', String(data.dechet_dangereux.ced.first))}</td>
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
                                        <td>{renderInput('dechet_dangereux.denomination.first', data.dechet_dangereux.denomination.first)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Code ONU</td>
                                        <td>{renderInput('dechet_dangereux.onu.first', String(data.dechet_dangereux.onu.first))}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contenant</td>
                                        <td>
                                            {renderInput('contenant.description.first', data.contenant.description.first)}
                                            {renderInput('contenant.unitaire.first', data.contenant.unitaire.first)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Quantité</td>
                                        <td>{renderInput('contenant.indicatif.first', String(data.contenant.indicatif.first))}</td>
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
                                            {renderInput('transporteur.nom.first', data.transporteur.nom.first)}
                                            {renderInput('transporteur.siret.first', String(data.transporteur.siret.first))}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contact transporteur</td>
                                        <td className="space-y-1">
                                            {renderInput('transporteur.firstname.first', data.transporteur.firstname.first)}
                                            {renderInput('transporteur.lastname.first', data.transporteur.lastname.first)}
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
                                            {renderInput('prestataire_final.nom.first', data.prestataire_final.nom.first)}
                                            {renderInput('prestataire_final.siret.first', String(data.prestataire_final.siret.first))}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contact destinataire</td>
                                        <td className="space-y-1">
                                            {renderInput('prestataire_final.firstname.first', data.prestataire_final.firstname.first)}
                                            {renderInput('prestataire_final.lastname.first', data.prestataire_final.lastname.first)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Code traitement</td>
                                        <td>{renderInput('prestataire_final.traitement.first', data.prestataire_final.traitement.first)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">CAP</td>
                                        <td>{renderInput('filiere.cap.first', data.filiere.cap.first)}</td>
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
                                            {renderInput('site.adresse.street.first', data.site.adresse.first.street)}
                                            {renderInput('site.adresse.postal_code.first', data.site.adresse.first.postal_code)}
                                            {renderInput('site.adresse.city.first', data.site.adresse.first.city)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Contact sur site</td>
                                        <td className="space-y-1">
                                            {renderInput('producteur_personne.firstname.first', data.producteur_personne.firstname.first)}
                                            {renderInput('producteur_personne.lastname.first', data.producteur_personne.lastname.first)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Téléphone</td>
                                        <td>{renderInput('producteur_personne.tel.first', data.producteur_personne.tel.first)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Email</td>
                                        <td>{renderInput('producteur_personne.email.first', data.producteur_personne.email.first)}</td>
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