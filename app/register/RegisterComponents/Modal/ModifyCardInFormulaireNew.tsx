import { useEffect, useState } from "react";
import { parseAddress, extractSiret, getRaisonSocial, sendData_to_Cloud } from "./utils_new";
import { Company, FormInput } from "../../interface/BSD_Interface";
import { toast } from "react-hot-toast";
import { useSession } from "@/app/component/SessionProvider";
import { useModalContextNew } from "./ContextModal";
import Swal from 'sweetalert2';
import { useMailContext } from "../../MailComponents/MailContext";

// Ajout des types nécessaires en haut du fichier
type NestedKeyOf<ObjectType extends object> = {
    [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
        ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
        : `${Key}`
}[keyof ObjectType & (string | number)];

type FormPath = string;//NestedKeyOf<FormInput>;

// Ajout d'un type utilitaire pour gérer les objets imbriqués
type NestedObject = {
    [key: string]: NestedObject | string | number | boolean | null | undefined;
};

// Fonction pour vérifier si le code CED contient une étoile
const checkADR = (code: string) => {
  return code.includes('*');
};

// Composant générique pour les champs d'input
const LabelInput = ({
  label,
  value,
  onChange,
  path,
  placeholder,
  type = "text",
  options = []
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  onChange: (path: FormPath, value: string) => void;
  path: FormPath;
  placeholder: string;
  type?: "text" | "select";
  options?: { value: string | boolean; label: string }[];
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange(path, e.target.value);
  };

  return (
    <div className="flex items-center text-xs mb-1">
      <span className="font-medium text-gray-700 w-[100px] text-right mr-2">{label}: </span>
      {type === "select" ? (
        <select
          value={value?.toString() ?? ''}
          onChange={handleChange}
          className="text-gray-600 rounded-md px-2 py-1 w-[200px]"
        >
          <option value="">Sélectionner...</option>
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value?.toString() ?? ''}
          onChange={handleChange}
          placeholder={placeholder}
          className="text-gray-600 rounded-md px-2 py-1 w-[200px]"
        />
      )}
    </div>
  );
};

// Mise à jour du type des fields dans SectionForm
type SectionFormProps = {
  title: string;
  fields: {
    label: string;
    path: FormPath;
    placeholder: string;
    type?: "text" | "select";
    options?: { value: string | boolean; label: string }[];
  }[];
  dataText: FormInput;
  handleLocalChange: (path: FormPath, value: string) => void;
};

export const SectionForm = ({
  title,
  fields,
  dataText,
  handleLocalChange,
}: SectionFormProps) => (
    <div className="p-2 bg-gray-50 rounded border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-2 text-sm">{title}</h3>
        {fields.map((field) => {
            let value: string | number | boolean | null | undefined;

            // Cas spécial pour packagingInfos
            if (field.path.includes('packagingInfos[0]')) {
                const [, property] = field.path.split('packagingInfos[0].');
                value = dataText.wasteDetails?.packagingInfos?.[0]?.[property as keyof typeof dataText.wasteDetails.packagingInfos[0]];
            } else {
                // Cas général pour les autres champs
                value = field.path.split('.').reduce<NestedObject>(
                    (obj, key) => {
                        if (obj && typeof obj === 'object') {
                            return obj[key] as NestedObject;
                        }
                        return {};
                    }, 
                    dataText as unknown as NestedObject
                )?.toString();
            }
            
            return (
                <LabelInput
                    key={field.path}
                    {...field}
                    value={value}
                    onChange={handleLocalChange}
                />
            );
        })}
    </div>
);

const ModifyCardInFormulaireNew = ({ 
    onClose, 
    dataText, 
    setDataText,
}: { 
    onClose: () => void, 
    dataText: FormInput, 
    setDataText: React.Dispatch<React.SetStateAction<FormInput>>,
}) => {
  
  const {dataToogle } = useModalContextNew();




  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingMail, setIsSubmittingMail] = useState(false);
  const [isSubmittingBrouillon, setIsSubmittingBrouillon] = useState(false);
  const [showParcelFields, setShowParcelFields] = useState(false);
  const [showTrader, setShowTrader] = useState(false);
  const [showBroker, setShowBroker] = useState(false);
  const [showEcoOrganisme, setShowEcoOrganisme] = useState(false);
  const { isValidMail, sendMail } = useMailContext();

  const {             
    setModalReload, modalReload,
    setDisplayFormulaire } = useModalContextNew();

  const session = useSession();

  const handleLocalChange = (path: FormPath, value: string) => {
    setDataText(prevData => {
        const newData = { ...prevData };
        const keys = path.split('.');

        // Cas spécial pour packagingInfos
        if (path.includes('packagingInfos[0]')) {
            const [, property] = path.split('packagingInfos[0].');
            if (property === 'type') {
                newData.wasteDetails.packagingInfos[0].type = value as "FUT" | "GRV" | "CITERNE" | "BENNE" | "PIPELINE" | "AUTRE";
            } else if (property === 'quantity') {
                newData.wasteDetails.packagingInfos[0].quantity = Number(value);
            }
            return newData;
        }

        // Cas général pour les autres champs
        let current = newData as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key] as Record<string, unknown>;
        }
        
        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;
        
        return newData;
    });
  };

  const handleSubmitHere = async () => {
    if (!isValidMail){
      toast.error('Tous les champs du mail sont obligatoires');
      return;
    }else{
      toast.success('Mail prêt à être envoyé');
    }
    const willSubmit = await Swal.fire({
        title: 'Envoyer à TrackDéchet ?',
        text: "Cette demande sera envoyée à TrackDéchet et par mail",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Envoyer',
        cancelButtonText: 'Annuler'
    });

    if (!willSubmit.isConfirmed) return;

    setIsSubmitting(true);    
    try {
      const newData = { ...dataText };

      const processCompanyData = async (company: Company) => {
        try{
            if (company?.siret) {
            const siret = extractSiret(company.siret);
            const raisonSocial = await getRaisonSocial(siret);
            if (raisonSocial) {
                //company.name = raisonSocial.name;
                const { street, postalCode, city } = parseAddress(raisonSocial.adresse.first);
                let my_city = city;
                let pays = 'FRANCE';
                if(city.includes('FRANCE')){
                  my_city = my_city.split(' FRANCE')[0];
                }else{
                pays = raisonSocial.pays.first;
                }
                company.address = street + ' ' + postalCode + ' ' + my_city;
                company.country = pays;
                company.siret = siret ?? '';
                }
            }
            return company;
        }catch(error){
          console.error('Error processing company data:', error);
          return company;
        }
      };

      const pastDataWorksite = JSON.parse(JSON.stringify(newData.emitter.workSite));
      newData.emitter.company = await processCompanyData(newData.emitter.company);
      newData.emitter.workSite = pastDataWorksite;
      newData.recipient.company = await processCompanyData(newData.recipient.company);
      newData.transporter.company = await processCompanyData(newData.transporter.company);

      if(newData.trader?.company) newData.trader.company = await processCompanyData(newData.trader.company);
      if(newData.broker?.company) newData.broker.company = await processCompanyData(newData.broker.company);
      if(newData.temporaryStorageDetail?.company) newData.temporaryStorageDetail.company = await processCompanyData(newData.temporaryStorageDetail.company);

      const {street, postalCode, city} = parseAddress(newData.emitter.workSite.fullAddress ?? "");
      newData.emitter.workSite.address = street;
      newData.emitter.workSite.postalCode = postalCode;
      newData.emitter.workSite.city = city;
      //delete newData.emitter.workSite.fullAddress;
      newData.wasteDetails.isSubjectToADR = checkADR(newData.wasteDetails.code);
      newData.transporter.isExemptedOfReceipt = newData.transporter.receipt === '';

      //newData.wasteDetails.isDangerous = newData.wasteDetails.isDangerous === true;
      //newData.wasteDetails.pop = newData.wasteDetails.pop === true;
      //newData.wasteDetails.code = newData.wasteDetails.code.replaceAll(' ', '');
      newData.wasteDetails.quantity = Number(newData.wasteDetails.quantity);
      newData.wasteDetails.packagingInfos[0].quantity = Number(newData.wasteDetails.packagingInfos[0].quantity);

      delete newData.emitter.workSite.fullAddress;
      newData.recipient.isTempStorage = newData.recipient.isTempStorage === true;
      if(!newData.recipient.isTempStorage)delete newData.temporaryStorageDetail;
      if(!showTrader)delete newData.trader;
      if(!showBroker)delete newData.broker;
      if(!showEcoOrganisme)delete newData.ecoOrganisme;
      if(!showParcelFields){
        delete newData.wasteDetails.parcelNumbers;
        delete newData.wasteDetails.landIdentifiers;
        delete newData.wasteDetails.sampleNumber;
        delete newData.wasteDetails.analysisReferences;
    }

      const conditions_pour_submit = conditionsPourSubmit(newData);
      if(conditions_pour_submit){
        if(session && session?.entreprise_id && session?.user_id) {
            console.log('Form send Data to Cloud:', newData);  
            const isDraft=false;
            const result = await sendData_to_Cloud(newData, session?.user_id, session?.entreprise_id, isDraft);
            if(result.success) {
                toast.success(result.message);

                setIsSubmittingMail(true);
                console.log('sendMail', sendMail)
                if (sendMail) {
                  await sendMail();
                }
                //toast.success('Envoie du mail réussi');
                setIsSubmittingMail(false);

                setDisplayFormulaire(false);
                setModalReload(!modalReload);
            } else {
                toast.error(result.message);
            }
        }
        //setDataToogle(newData);

        console.log('data toogle modify card in formulaire new', dataToogle);
        //onSubmit();
      };


    } finally {
      setIsSubmitting(false);
      setIsSubmittingBrouillon(false);
    }
  };

  const handleSubmitBrouillon = async () => {
    setIsSubmittingBrouillon(true);
    try {
      const newData = { ...dataText };

      const processCompanyData = async (company: Company) => {
        try{
            if (company?.siret) {
            const siret = extractSiret(company.siret);
            const raisonSocial = await getRaisonSocial(siret);
            if (raisonSocial) {
                //company.name = raisonSocial.name;
                const { street, postalCode, city } = parseAddress(raisonSocial.adresse.first);
                let my_city = city;
                let pays = 'FRANCE';
                if(city.includes('FRANCE')){
                  my_city = my_city.split(' FRANCE')[0];
                }else{
                pays = raisonSocial.pays.first;
                }
                company.address = street + ' ' + postalCode + ' ' + my_city;
                company.country = pays;
                company.siret = siret ?? '';
                }
            }
            return company;
        }catch(error){
          console.error('Error processing company data:', error);
          return company;
        }
      };

      const pastDataWorksite = JSON.parse(JSON.stringify(newData.emitter.workSite));
      newData.emitter.company = await processCompanyData(newData.emitter.company);
      newData.emitter.workSite = pastDataWorksite;
      newData.recipient.company = await processCompanyData(newData.recipient.company);
      newData.transporter.company = await processCompanyData(newData.transporter.company);

      if(newData.trader?.company) newData.trader.company = await processCompanyData(newData.trader.company);
      if(newData.broker?.company) newData.broker.company = await processCompanyData(newData.broker.company);
      if(newData.temporaryStorageDetail?.company) newData.temporaryStorageDetail.company = await processCompanyData(newData.temporaryStorageDetail.company);

      const {street, postalCode, city} = parseAddress(newData.emitter.workSite.fullAddress ?? "");
      newData.emitter.workSite.address = street;
      newData.emitter.workSite.postalCode = postalCode;
      newData.emitter.workSite.city = city;
      //delete newData.emitter.workSite.fullAddress;
      newData.wasteDetails.isSubjectToADR = checkADR(newData.wasteDetails.code);
      newData.transporter.isExemptedOfReceipt = newData.transporter.receipt === '';

      //newData.wasteDetails.isDangerous = newData.wasteDetails.isDangerous === true;
      //newData.wasteDetails.pop = newData.wasteDetails.pop === true;
      //newData.wasteDetails.code = newData.wasteDetails.code.replaceAll(' ', '');
      newData.wasteDetails.quantity = Number(newData.wasteDetails.quantity);
      newData.wasteDetails.packagingInfos[0].quantity = Number(newData.wasteDetails.packagingInfos[0].quantity);

      delete newData.emitter.workSite.fullAddress;
      newData.recipient.isTempStorage = newData.recipient.isTempStorage === true;
      if(!newData.recipient.isTempStorage)delete newData.temporaryStorageDetail;
      if(!showTrader)delete newData.trader;
      if(!showBroker)delete newData.broker;
      if(!showEcoOrganisme)delete newData.ecoOrganisme;
      if(!showParcelFields){
        delete newData.wasteDetails.parcelNumbers;
        delete newData.wasteDetails.landIdentifiers;
        delete newData.wasteDetails.sampleNumber;
        delete newData.wasteDetails.analysisReferences;
    }
  
      if(session && session?.entreprise_id && session?.user_id) {
          const isDraft=true;
          console.log("Save en brouillon")
          const result = await sendData_to_Cloud(newData, session?.user_id, session?.entreprise_id, isDraft);
          if(result.success) {
              toast.success("Brouillon sauvegardé", result.message);
              setDisplayFormulaire(false);
              setModalReload(!modalReload);
          } else {
              toast.error("Erreur avec la sauvegarde du brouillon",result.message);
          }
      }
    } finally {
      setIsSubmittingBrouillon(false);
    }
  };

  const handleMailSubmit = async () => {
    if (!isValidMail) {
        toast.error('Tous les champs du mail sont obligatoires');
        return;
    }

    const willSendMail = await Swal.fire({
        title: 'Envoyer le mail ?',
        text: "Un mail sera envoyé aux destinataires",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Envoyer',
        cancelButtonText: 'Annuler'
    });

    if (!willSendMail.isConfirmed || !sendMail) return;

    setIsSubmittingMail(true);
    await sendMail();
    setIsSubmittingMail(false);
  };

  /*useEffect(() => {
    console.log('dataText', dataText);
  }, [dataText]);*/

  useEffect(() => {
    if(dataText.wasteDetails.code){
      setDataText(prevData => {
        const newData = { ...prevData };
        newData.wasteDetails.isDangerous = dataText.wasteDetails.code.includes("*");
        return newData;
      });
    }
    //console.log('dataText.isDangerous', dataText.wasteDetails.isDangerous);
  }, [dataText.wasteDetails.code]);

  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-4">
        {/* Colonne 1 - Point de collecte et Émetteur */}
        <div className="space-y-4">
          <SectionForm
            title="Point de collecte"
            fields={[
              { label: "Nom usuel", path: "emitter.workSite.name", placeholder: "Usine A" },
              { label: "Adresse", path: "emitter.workSite.fullAddress", placeholder: "Adresse Code Postal Ville" },
              { label: "Infos", path: "emitter.workSite.infos", placeholder: "Infos supplémentaires" },
            ]}
            dataText={dataText}
            handleLocalChange={handleLocalChange}
          />

          <SectionForm
            title="Émetteur"
            fields={[
              { label: "Nom usuel", path: "emitter.company.name", placeholder: "" },
              { label: "SIRET", path: "emitter.company.siret", placeholder: "||| ||| ||| |||||" },
              { label: "Contact", path: "emitter.company.contact", placeholder: "Prénom Nom" },
              { label: "Téléphone", path: "emitter.company.phone", placeholder: "+33 (0)6 00 00 00 00" },
              { label: "Email", path: "emitter.company.mail", placeholder: "emetteur@mail.fr" },
            ]}
            dataText={dataText}
            handleLocalChange={handleLocalChange}
          />
        </div>

        {/* Colonne 2 - Destinataire et Transporteur */}
        <div className="space-y-4">
          <SectionForm
            title="Prochain Destinataire"
            fields={[
              { label: "Nom usuel", path: "recipient.company.name", placeholder: "Recyclage&Co" },
              { label: "SIRET", path: "recipient.company.siret", placeholder: "||| ||| ||| |||||" },

              { label: "Contact", path: "recipient.company.contact", placeholder: "Prénom Nom" },
              { label: "Téléphone", path: "recipient.company.phone", placeholder: "+33 (0)6 00 00 00 00" },
              { label: "Email", path: "recipient.company.mail", placeholder: "destinataire@mail.com" },

              { label: "CAP", path: "recipient.cap", placeholder: "CAP" },
              { label: "Code de traitement", path: "recipient.processingOperation", placeholder: "D/R" },
              { 
                label: "Stockage", 
                path: "recipient.isTempStorage", 
                type: "select",
                placeholder: "Stockage provisoire",
                options: [
                  { value: false, label: "Non" },
                  { value: true, label: "Oui" }
                ]
              },
            ]}
            dataText={dataText}
            handleLocalChange={handleLocalChange}
          />

          <SectionForm
            title="Transporteur"
            fields={[
              { label: "Nom usuel", path: "transporter.company.name", placeholder: "Transport&Co" },
              { label: "SIRET", path: "transporter.company.siret", placeholder: "||| ||| ||| |||||" },
              { label: "Contact", path: "transporter.company.contact", placeholder: "Prénom Nom" },
              { label: "Téléphone", path: "transporter.company.phone", placeholder: "+33 (0)6 00 00 00 00" },
              { label: "Email", path: "transporter.company.mail", placeholder: "transporteur@mail.com" },
              { label: "Récipissé", path: "transporter.receipt", placeholder: "FRXXYYYYZZZZ" },
              { label: "Numéro de plaque", path: "transporter.numberPlate", placeholder: "AA-123-AA" },
              { label: "+ Infos", path: "transporter.customInfo", placeholder: "Pour le transporteur" },
            ]}
            dataText={dataText}
            handleLocalChange={handleLocalChange}
          />
        </div>

        {/* Colonne 3 - Détails du déchet et toggles */}
        <div className="space-y-4">
          <SectionForm
            title="Détails du déchet"
            fields={[
              { label: "Code CED", path: "wasteDetails.code", placeholder: "|| || || (*)" },
              { label: "Description", path: "wasteDetails.name", placeholder: "Déchet plastique.." },
              { label: "Code ONU", path: "wasteDetails.onuCode", placeholder: "||||" },
              { 
                label: "Consistance", 
                path: "wasteDetails.consistence", 
                type: "select",
                placeholder: "Consistance",
                options: [
                  { value: "SOLID", label: "Solide" },
                  { value: "LIQUID", label: "Liquide" },
                  { value: "GASEOUS", label: "Gazeux" },
                  { value: "DOUGHY", label: "Pâteux" }
                ]
              },
              { 
                label: "POP", 
                path: "wasteDetails.pop", 
                type: "select",
                placeholder: "POP",
                options: [
                  { value: false, label: "Non" },
                  { value: true, label: "Oui" }
                ]
              },
              { 
                label: "Dangereux", 
                path: "wasteDetails.isDangerous", 
                type: "select",
                placeholder: "Dangereux",
                options: [
                  { value: false, label: "Non" },
                  { value: true, label: "Oui" }
                ]
              },
              { 
                label: "Contenant", 
                path: "wasteDetails.packagingInfos[0].type", 
                type: "select",
                placeholder: "Contenant",
                options: [
                  { value: "FUT", label: "Fût" },
                  { value: "GRV", label: "GRV" },
                  { value: "CITERNE", label: "Citerne" },
                  { value: "BENNE", label: "Benne" },
                  { value: "PIPELINE", label: "Pipeline" },
                  { value: "AUTRE", label: "Autre" }
                ]
              },
              { label: "Contenants", path: "wasteDetails.packagingInfos[0].quantity", placeholder: "Nombre" },
              { label: "Poids total", path: "wasteDetails.quantity", placeholder: "en tonnes" },
            ]}
            dataText={dataText}
            handleLocalChange={handleLocalChange}
          />

          {/* Toggles groupés */}
          <div className="space-y-2 border-t pt-4">
            {/* Toggle pour les champs de parcelle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showParcelFields}
                onChange={() => setShowParcelFields(!showParcelFields)}
                className="mr-2"
              />
              <span className="text-sm">Informations de parcelle</span>
            </div>

            {/* Toggle pour courtier */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showTrader}
                onChange={() => setShowTrader(!showTrader)}
                className="mr-2"
              />
              <span className="text-sm">Courtier</span>
            </div>

            {/* Toggle pour négociant */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showBroker}
                onChange={() => setShowBroker(!showBroker)}
                className="mr-2"
              />
              <span className="text-sm">Négociant</span>
            </div>

            {/* Toggle pour éco-organisme */}
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={showEcoOrganisme}
                onChange={() => setShowEcoOrganisme(!showEcoOrganisme)}
                className="mr-2"
              />
              <span className="text-sm">Éco-organisme</span>
            </div>
          </div>

          {/* Sections conditionnelles */}
          {showParcelFields && (
            <SectionForm
              title="Informations de parcelle"
              fields={[
                { label: "Ville", path: "wasteDetails.parcelNumbers.city", placeholder: "Ville" },
                { label: "Code postal", path: "wasteDetails.parcelNumbers.postalCode", placeholder: "Code postal" },
                { label: "Préfixe", path: "wasteDetails.parcelNumbers.prefix", placeholder: "Préfixe" },
                { label: "Section", path: "wasteDetails.parcelNumbers.section", placeholder: "Section" },
                { label: "Numéro", path: "wasteDetails.parcelNumbers.number", placeholder: "Numéro" },
                { label: "Références d'analyse", path: "wasteDetails.analysisReferences", placeholder: "Références" },
                { label: "Identifiants terrain", path: "wasteDetails.landIdentifiers", placeholder: "Identifiants" },
                { label: "N° d'échantillon", path: "wasteDetails.sampleNumber", placeholder: "Numéro" },
              ]}
              dataText={dataText}
              handleLocalChange={handleLocalChange}
            />
          )}

          {showTrader && (
            <SectionForm
              title="Courtier"
              fields={[
                { label: "Nom usuel", path: "trader.company.name", placeholder: "Courtier&Co" },
                { label: "SIRET", path: "trader.company.siret", placeholder: "Numéro SIRET" },

                { label: "Contact", path: "trader.company.contact", placeholder: "Nom du contact" },
                { label: "Téléphone", path: "trader.company.phone", placeholder: "Téléphone" },
                { label: "Email", path: "trader.company.mail", placeholder: "Email" },

                { label: "Rcépissé", path: "trader.receipt", placeholder: "Récépissé" },
                { label: "Département", path: "trader.department", placeholder: "Département" },
                { label: "Limite de validité", path: "trader.validityLimit", placeholder: "JJ/MM/AAAA" },
              ]}
              dataText={dataText}
              handleLocalChange={handleLocalChange}
            />
          )}

          {showBroker && (
            <SectionForm
              title="Négociant"
              fields={[
                { label: "Nom usuel", path: "broker.company.name", placeholder: "Négociant&Co" },
                { label: "SIRET", path: "broker.company.siret", placeholder: "Numéro SIRET" },

                { label: "Contact", path: "broker.company.contact", placeholder: "Nom du contact" },
                { label: "Téléphone", path: "broker.company.phone", placeholder: "Téléphone" },
                { label: "Email", path: "broker.company.mail", placeholder: "Email" },

                { label: "Récépissé", path: "broker.receipt", placeholder: "Récépissé" },
                { label: "Département", path: "broker.department", placeholder: "Département" },
                { label: "Limite de validité", path: "broker.validityLimit", placeholder: "JJ/MM/AAAA" },
              ]}
              dataText={dataText}
              handleLocalChange={handleLocalChange}
            />
          )}

          {showEcoOrganisme && (
            <SectionForm
              title="Eco-organisme"
              fields={[
                { label: "Nom usuel", path: "ecoOrganisme.name", placeholder: "Nom de l'éco-organisme" },
                { label: "SIRET", path: "ecoOrganisme.siret", placeholder: "Numéro SIRET" },
              ]}
              dataText={dataText}
              handleLocalChange={handleLocalChange}
            />
          )}

          {/* Destinataire final si stockage provisoire */}
          {String(dataText.recipient.isTempStorage) === "true" && (
            <SectionForm
              title="Destinataire final pour traitement"
              fields={[
                { label: "SIRET", path: "temporaryStorageDetail.company.siret", placeholder: "SIRET" },
                { label: "Contact", path: "temporaryStorageDetail.company.contact", placeholder: "Contact" },
                { label: "Téléphone", path: "temporaryStorageDetail.company.phone", placeholder: "Téléphone" },
                { label: "Email", path: "temporaryStorageDetail.company.mail", placeholder: "Email" },
                { label: "CAP", path: "temporaryStorageDetail.cap", placeholder: "CAP" },
                { label: "Opération", path: "temporaryStorageDetail.processingOperation", placeholder: "Code" },
              ]}
              dataText={dataText}
              handleLocalChange={handleLocalChange}
            />
          )}
        </div>
      </div>

      {/* Boutons */}
      <div className="flex justify-end space-x-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-100"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={() => handleSubmitBrouillon()}
          disabled={isSubmittingBrouillon}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isSubmittingBrouillon ? "En cours..." : "Brouillon"}
        </button>
        {dataText.wasteDetails.isDangerous && <button
          type="button"
          onClick={() => handleSubmitHere()}
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Envoie à TrackDéchet et par mail en cours..." : "Envoyer à TrackDéchet & par Mail"}
        </button>}
        {!dataText.wasteDetails.isDangerous && (
            <button
                type="button"
                onClick={handleMailSubmit}
                disabled={isSubmittingMail}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
                {isSubmittingMail ? "Envoie du mail en cours..." : "Envoyer le mail"}
            </button>
        )}
      </div>
    </div>
  );
};

export default ModifyCardInFormulaireNew;

const conditionsPourSubmit = (newData: FormInput) => {
    if(newData.emitter.company.siret === ''){
        toast.error('Le SIRET de l\'émetteur est requis');
        return false;
    }
    if(newData.recipient.company.siret === ''){
        toast.error('Le SIRET du destinataire est requis');
        return false;
    }
    if(newData.transporter.company.siret === ''){
        toast.error('Le SIRET du transporteur est requis');
        return false;
    }
    if(newData.wasteDetails.code === ''){
        toast.error('Le code CED est requis');
        return false;
    }
    if(newData.emitter.workSite.name === ''){
        toast.error('Le nom du point de collecte est requis');
        return false;
    }
    return true;
}

