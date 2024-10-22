//api/demande_collecte
import { NextResponse } from 'next/server';
import axios from 'axios';


const url = 'https://api.sandbox.trackdechets.beta.gouv.fr';
const token = 'tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV';



export async function POST(request: Request) {
    //const token_sandbox = "tCJJTq0Da55LuoJMc35QEqwomMRDwl10xT1hI2UV";
    const data = await request.json();
    console.log("Données reçues :", data);
    who_am_i();
    createBSD();

    return NextResponse.json({ message: 'Données reçues avec succès', data });
}



const createBSD = async () => {
    const mutation = `
        mutation CreateForm($createFormInput: CreateFormInput!) {
            createForm(createFormInput: $createFormInput) {
                id
                status
            }
        }
    `;
        
    const variables = {
        createFormInput: {
            emitter: {
                type: "PRODUCER",
                workSite: {
                    address: "5 rue du chantier",
                    postalCode: "75010",
                    city: "Paris",
                    infos: "Site de stockage de boues"
                },
                company: {
                    siret: "00000063963334",
                    name: "FLEAP",
                    address: "1 rue de paradis, 75010 PARIS",
                    contact: "Jean Dupont",
                    phone: "01 00 00 00 00",
                    mail: "test.blabla@dechets.org"
                }
            },
            recipient: {
                processingOperation: "D 10",
                cap: "CAP",
                company: {
                    siret: "57202552610945",
                    name: "Veolia - entreprise de traitement de déchet",
                    address: "1 avenue de l'incinérateur 67100 Strasbourg",
                    contact: "Thomas Largeron",
                    phone: "03 00 00 00 00",
                    mail: "thomas.largeron@incinerateur.fr"
                }
            },
            transporter: {
                company: {
                    siret: "30832792300014",
                    name: "Transport & Co trouvé sur internet",
                    address: "1 rue des 6 chemins, 07100 ANNONAY",
                    contact: "Claire Dupuis",
                    mail: "claire.dupuis@transportco.fr",
                    phone: "04 00 00 00 00"
                }
            },
            wasteDetails: {
                code: "06 05 02*",
                onuCode: "Non Soumis",
                name: "Boues",
                packagingInfos: [
                    {
                        type: "CITERNE",
                        quantity: 1
                    }
                ],
                quantity: 1,
                quantityType: "ESTIMATED",
                consistence: "LIQUID"
            }
        }
    };
  
    try {
        const response = await axios.post(
            url,
            { 
                query: mutation, // Changer 'mutation' en 'query'
                variables 
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`, // Authentification par jeton
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(response.data);
    } catch (error) {
        console.error('Erreur lors de la création du BSD :', error);
    }
};



  async function who_am_i() {
    const query = "query { me { name } }";
    try {
      const response = await axios.post(
        url,
        { query },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error('Error:', error);
    }
  }