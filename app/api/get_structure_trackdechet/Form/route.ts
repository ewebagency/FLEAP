/*import { supabase } from "@/app/database/supabaseClient";
import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client/core";
import fetch from "cross-fetch";

const client = new ApolloClient({
  link: new HttpLink({
    uri: process.env.TRACKDECHETS_URL_SANDBOX,
    fetch,
    headers: {
      Authorization: `Bearer ${process.env.TRACKDECHETS_TOKEN_SANDBOX}`,
    },
  }),
  cache: new InMemoryCache(),
});

async function getTypeDetails(typeName) {
  if (!typeName) return null;
  const query = gql`
    query($typeName: String!) {
      __type(name: $typeName) {
        name
        kind
        fields {
          name
          description
          type {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
        possibleTypes {
          name
        }
      }
    }
  `;
  const result = await client.query({ query, variables: { typeName } });
  return result.data.__type || null;
}

async function exploreSchema(typeName, visited = new Set()) {
  if (visited.has(typeName) || !typeName) return {};
  visited.add(typeName);

  const typeDetails = await getTypeDetails(typeName);
  if (!typeDetails || typeDetails.kind === "SCALAR") return typeDetails?.name || "Unknown";

  const result = {};
  if (typeDetails.fields) {
    for (const field of typeDetails.fields) {
      const fieldType = field.type.ofType?.ofType?.name || field.type.ofType?.name || field.type.name;
      const fieldKind = field.type.ofType?.ofType?.kind || field.type.ofType?.kind || field.type.kind;
      const isNonNull = field.type.kind === "NON_NULL" || field.type.ofType?.kind === "NON_NULL";

      const fieldDetails = {
        type: fieldType,
        kind: fieldKind,
        isRequired: isNonNull,
        description: field.description || null,
      };

      if (fieldKind === "SCALAR") {
        result[field.name] = fieldDetails;
      } else if (fieldKind === "OBJECT" || fieldKind === "INTERFACE") {
        fieldDetails.subFields = await exploreSchema(fieldType, visited);
        result[field.name] = fieldDetails;
      } else if (fieldKind === "LIST") {
        fieldDetails.subFields = await exploreSchema(fieldType, visited);
        result[field.name] = fieldDetails;
      }
    }
  }

  if (typeDetails.possibleTypes) {
    // Si le type est une union ou une interface, introspecter les implémentations
    for (const possibleType of typeDetails.possibleTypes) {
      result[`possibleType:${possibleType.name}`] = await exploreSchema(possibleType.name, visited);
    }
  }

  return result;
}

// Fonction simplifiée pour explorer le schéma en mode "nom des champs"
async function exploreSchemaSimple(typeName, visited = new Set()) {
    if (visited.has(typeName) || !typeName) return {};
    visited.add(typeName);
  
    const typeDetails = await getTypeDetails(typeName);
    if (!typeDetails) return {};
  
    const result = {};
    if (typeDetails.fields) {
      for (const field of typeDetails.fields) {
        result[field.name] = null; // On garde uniquement le nom du champ
        if (field.type.kind === "OBJECT" || field.type.kind === "INTERFACE" || field.type.kind === "LIST") {
          // Si c'est un objet, on explore ses sous-champs
          result[field.name] = await exploreSchemaSimple(field.type.ofType?.name || field.type.name, visited);
        }
      }
    }
  
    if (typeDetails.possibleTypes) {
      // Si le type est une union ou une interface, introspecter les implémentations
      for (const possibleType of typeDetails.possibleTypes) {
        result[`possibleType:${possibleType.name}`] = await exploreSchemaSimple(possibleType.name, visited);
      }
    }
  
    return result;
  }
  

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const typeName = url.searchParams.get("type") || "Form";
    const mode = url.searchParams.get("mode") || "full"; // "full" par défaut, sinon "simple" pour les noms

    let schema;
    if (mode === "simple") {
      // Mode simple, on ne garde que les noms des champs
      schema = await exploreSchemaSimple(typeName);
    } else {
      // Mode complet, exploration avec tous les détails
      schema = await exploreSchema(typeName);
    }
    
    return new Response(JSON.stringify(schema, null, 2), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

function transformJSON(json, fieldName) {
    // Fonction récursive pour parcourir le JSON
    function traverse(obj) {
      if (typeof obj !== 'object' || obj === null) return obj; // Retourner l'objet tel quel s'il n'est pas un objet ou est nul
  
      const result = {};
  
      // Parcours des clés de l'objet
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const field = obj[key];
  
          // Si le champ est un SCALAR, on le transforme
          if (field.kind === 'SCALAR') {
            let transformedValue = field.type;
            if (field.isRequired) {
              transformedValue += '!'; // Ajout de "!" si isRequired est true
            }
            result[key] = transformedValue;
          } else if (field.kind === 'OBJECT' || field.kind === 'LIST') {
            // Si c'est un objet ou une liste, on continue à creuser récursivement
            result[key] = traverse(field.subFields || field);
          } else {
            result[key] = field; // Si ce n'est pas un SCALAR, un objet ou une liste, on le garde tel quel
          }
        }
      }
      return result;
    }
  
    // On commence la transformation par le champ de niveau supérieur
    return traverse(json[fieldName]);
  }

async function getCEDs() {
  const result = await supabase
  .from('bsd')
  .select('infos_json');
  console.log(result.data);
  if (result.data) {
    const ceds = result.data.map((bsd) => bsd.infos_json.formAPI.createFormInput.wasteDetails.code);
    const ced_unique = Array.from(new Set(ceds));
    console.log(ced_unique);
    return ced_unique;
  }
  return [];
}
*/