/*import { supabase } from "@/app/database/supabaseClient";
import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client/core";
import fetch from "cross-fetch";

// Initialisation du client Apollo
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

// Fonction pour obtenir les détails d'un type d'entrée (InputObject)
async function getInputTypeDetails(typeName) {
  if (!typeName) return null;

  const query = gql`
    query($typeName: String!) {
      __type(name: $typeName) {
        name
        kind
        inputFields {
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
      }
    }
  `;

  try {
    const result = await client.query({ query, variables: { typeName } });
    return result.data.__type || null;
  } catch (error) {
    console.error(`Error fetching type details for ${typeName}:`, error.message);
    return null;
  }
}

// Exploration complète des InputObjects
async function exploreInputSchema(typeName, visited = new Set()) {
  if (visited.has(typeName) || !typeName) return {};
  visited.add(typeName);

  const typeDetails = await getInputTypeDetails(typeName);
  if (!typeDetails || typeDetails.kind === "SCALAR") return typeDetails?.name || "Unknown";

  const result = {};
  if (typeDetails.inputFields) {
    for (const field of typeDetails.inputFields) {
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
      } else if (fieldKind === "INPUT_OBJECT" || fieldKind === "OBJECT") {
        fieldDetails.subFields = await exploreInputSchema(fieldType, visited);
        result[field.name] = fieldDetails;
      } else if (fieldKind === "LIST") {
        fieldDetails.subFields = await exploreInputSchema(fieldType, visited);
        result[field.name] = fieldDetails;
      }
    }
  }

  return result;
}

// Exploration simplifiée pour extraire uniquement les noms des champs
async function exploreInputSchemaSimple(typeName, visited = new Set()) {
  if (visited.has(typeName) || !typeName) return {};
  visited.add(typeName);

  const typeDetails = await getInputTypeDetails(typeName);
  if (!typeDetails) return {};

  const result = {};
  if (typeDetails.inputFields) {
    for (const field of typeDetails.inputFields) {
      result[field.name] = null; // On conserve uniquement les noms des champs
      if (field.type.kind === "INPUT_OBJECT" || field.type.kind === "LIST") {
        result[field.name] = await exploreInputSchemaSimple(field.type.ofType?.name || field.type.name, visited);
      }
    }
  }

  return result;
}

// Fonction principale pour traiter les requêtes GET
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const typeName = url.searchParams.get("type") || "FormInput";
    const mode = url.searchParams.get("mode") || "full"; // Modes : "full" ou "simple"

    let schema;
    if (mode === "simple") {
      schema = await exploreInputSchemaSimple(typeName);
    } else {
      schema = await exploreInputSchema(typeName);
    }

    return new Response(JSON.stringify(schema, null, 2), { status: 200 });
  } catch (error) {
    console.error("Error in GET handler:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Fonction pour transformer un JSON avec champs d'entrée
function transformInputJSON(json, fieldName) {
  // Fonction récursive pour transformer le JSON
  function traverse(obj) {
    if (typeof obj !== "object" || obj === null) return obj;

    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const field = obj[key];

        if (field.kind === "SCALAR") {
          let transformedValue = field.type;
          if (field.isRequired) {
            transformedValue += "!"; // Ajouter "!" pour les champs requis
          }
          result[key] = transformedValue;
        } else if (field.kind === "INPUT_OBJECT" || field.kind === "LIST") {
          result[key] = traverse(field.subFields || field);
        } else {
          result[key] = field;
        }
      }
    }
    return result;
  }

  return traverse(json[fieldName]);
}
*/

export async function GET(req: Request) {
  return new Response(JSON.stringify({ message: 'Hello, world!' }), { status: 200 });
}