import React, { useState } from "react";
import InputDeroulant from './InputDeroulant';
import InputText from './InputText';

interface FormData {
        filiere: string,
        site: string,
        adresse_enlevement: string,
        personne_a_contacter_prenom_nom: string,
        personne_a_contacter_email: string,
        personne_a_contacter_tel: string,
        nom_contenant: string,
        nombre_contenant: string,
        prestataire_destinataire: string,
        modele_email: string,
        a: string,
        sujet: string,
        message: string,
}

const ModalCollecteDemande = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {

    const initialFormData: FormData = {
        filiere: '',
        site: '',
        adresse_enlevement: '',
        personne_a_contacter_prenom_nom: '',
        personne_a_contacter_email: '',
        personne_a_contacter_tel: '',
        nom_contenant: '',
        nombre_contenant: '',
        prestataire_destinataire: '',
        modele_email: '',
        a: '',
        sujet: '',
        message: '',
    };

    const [formData, setFormData] = useState<FormData>(initialFormData);

    // Mise à jour de l'état à chaque modification
    const handleChange = (e:React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = async (e:React.ChangeEvent<HTMLFormElement>) => {
        e.preventDefault(); // Empêcher le rechargement de la page
        // Envoi des données à l'API
        try {
            const response = await fetch('/api/demande_collecte', { // Remplacez par votre URL d'API
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de l\'envoi des données');
            }

            // Réinitialiser le formulaire après l'envoi
            setFormData(initialFormData);
            onClose(); // Fermer la modal après l'envoi
        } catch (error) {
            console.error("Erreur lors de l'envoi des données:", error);
        }
    };

    const handleClose = () => {
        setFormData(initialFormData); // Réinitialiser le formulaire
        onClose(); // Fermer la modal
    };

    return (
        <div>
            {isOpen && 
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleClose}>
                <div className="bg-white p-6 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <h3 className="font-bold text-lg">Demande de collecte</h3>
                    <form className="my-2 p-6 border-[1px] border-gray-400 rounded-xl" onSubmit={handleSubmit}>
                        <div className='text-md font-bold'>Demande de collecte</div>
                        <div className='flex justify-start gap-8'>
                            <InputDeroulant 
                                titre="Filière" 
                                placeholder="Sélectionner une filière" 
                                options={['Plastique', 'Carton', 'DEEE']} 
                                width={2} 
                                name="filiere" 
                                value={formData.filiere} 
                                onChange={handleChange} 
                            />
                            <InputDeroulant 
                                titre="Site" 
                                placeholder="Sélectionner un site" 
                                options={['Paris', 'Anger', 'Marseilles']} 
                                width={2} 
                                name="site" 
                                value={formData.site} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className='flex justify-start gap-4 mt-3'>
                            <InputText 
                                titre="Adresse d'enlèvement" 
                                placeholder="Adresse" 
                                type="text" 
                                name="adresse_enlevement" 
                                value={formData.adresse_enlevement} 
                                onChange={handleChange} 
                            />
                            <InputDeroulant 
                                titre="Personne à contacter" 
                                placeholder="Prénom Nom" 
                                options={['Arthur Pouzargue', 'Auguste Holmes', 'Benjamin Steeg']} 
                                name="personne_a_contacter_prenom_nom" 
                                value={formData.personne_a_contacter_prenom_nom} 
                                onChange={handleChange} 
                            />
                            <InputText 
                                titre="Email" 
                                placeholder="exemple@entreprise.fr" 
                                type="email" 
                                name="personne_a_contacter_email" 
                                value={formData.personne_a_contacter_email} 
                                onChange={handleChange} 
                            />
                            <InputText 
                                titre="Téléphone" 
                                placeholder="06 XX XX XX XX" 
                                type="tel" 
                                name="personne_a_contacter_tel" 
                                value={formData.personne_a_contacter_tel} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className='flex justify-start gap-4'>
                            <InputText 
                                titre="Nom du contenant" 
                                placeholder="Nom du contenant" 
                                type="text" 
                                name="nom_contenant" 
                                value={formData.nom_contenant} 
                                onChange={handleChange} 
                            />
                            <InputText 
                                titre="Nombre de contenants" 
                                placeholder="Nombre de contenants" 
                                type="number" 
                                name="nombre_contenant" 
                                value={formData.nombre_contenant} 
                                onChange={handleChange} 
                            />
                        </div>

                        <h3 className="font-bold text-md mt-10">Envoie Mail</h3>
                        <div className='flex justify-start gap-4 items-center'>
                            <div className='mr-2 mt-9 text-md w-[80px]'>Email :</div>
                            <InputDeroulant 
                                titre="Prestataire destinataire" 
                                placeholder="Prestataire" 
                                options={['Incineration&Co', 'RecyclageInc']} 
                                width={1} 
                                name="prestataire_destinataire" 
                                value={formData.prestataire_destinataire} 
                                onChange={handleChange} 
                            />
                            <InputDeroulant 
                                titre="Modèle d'email" 
                                placeholder="Modèle d'email" 
                                options={['Rapide', 'Long']} 
                                width={1} 
                                name="modele_email" 
                                value={formData.modele_email} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className='flex justify-start gap-4 items-center h-[70px]'>
                            <div className='mr-2 mt-0 text-md w-[80px]'>À :</div>
                            <InputText 
                                titre="" 
                                placeholder="exemple@prestataire.fr" 
                                type="email" 
                                width={2} 
                                name="a" 
                                value={formData.a} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className='flex justify-start gap-4 items-center h-[50px]'>
                            <div className='mr-2 mt-0 text-md w-[80px]'>Sujet :</div>
                            <InputText 
                                titre="" 
                                placeholder="Demande de collecte" 
                                type="text" 
                                width={2} 
                                name="sujet" 
                                value={formData.sujet} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className='flex justify-start gap-4 items-center h-[70px] mt-3'>
                            <div className='mr-2 mt-0 text-md w-[80px]'>Message :</div>
                            <textarea 
                                className="input input-bordered w-[460px] h-[72px]" 
                                placeholder="Votre message ici..." 
                                rows={3} 
                                name="message" 
                                value={formData.message} 
                                onChange={handleChange} 
                            ></textarea>
                        </div>
                        <div className="modal-action">
                            <button type="button" className="btn" onClick={handleClose}>Fermer</button>
                            <button type="submit" className="btn">Envoyer</button>
                        </div>
                    </form>
                </div>
            </div>}
        </div>
    )
}

export default ModalCollecteDemande;
