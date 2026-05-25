// ============================================================================
// lib/hubspot.ts — Wrapper minimal sur l'API CRM HubSpot v3 (J15).
// ============================================================================
// Contexte (décision archi 2026-05-25, même logique que lib/ringover.ts) :
// pas de compte HubSpot central. Chaque client connecte son propre portail en
// collant son « Private App token » dans /dashboard/settings. Ce token sert
// ici à lire/écrire des objets CRM (contacts, deals, notes, tâches, emails)
// dans le portail du client.
//
// Doc HubSpot : https://developers.hubspot.com/docs/api/crm/
// Authentification : header `Authorization: Bearer <private app token>`.
//
// Règle de robustesse : on ne fait JAMAIS planter l'app si HubSpot est down.
// Chaque fonction est en try/catch et dégrade vers `null` (ou `true` pour le
// stub timeline). On ne logge JAMAIS le token.
// ============================================================================

const HUBSPOT_API_BASE = "https://api.hubapi.com";

// ----------------------------------------------------------------------------
// Types de retour simplifiés — on n'expose que ce dont l'app a besoin, pas la
// réponse HubSpot brute (qui est verbeuse et peut changer de forme).
// ----------------------------------------------------------------------------
export type HubspotContact = {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  phone: string | null;
};

export type HubspotDeal = {
  id: string;
  dealname: string | null;
  dealstage: string | null;
  amount: string | null;
  closedate: string | null;
};

// Résultat du test de connexion (cf. testHubspotConnection plus bas).
export type HubspotConnectionStatus = "connected" | "invalid" | "unknown";

// ----------------------------------------------------------------------------
// IDs d'association HUBSPOT_DEFINED (objet → contact). Ces IDs sont des
// constantes du référentiel HubSpot, pas des valeurs propres à notre portail.
//   note  → contact : 202
//   task  → contact : 204
//   email → contact : 198
// Une « association » lie un objet (note/tâche/email) à un contact pour qu'il
// apparaisse dans la timeline de ce contact côté HubSpot.
// ----------------------------------------------------------------------------
const ASSOC_NOTE_TO_CONTACT = 202;
const ASSOC_TASK_TO_CONTACT = 204;
const ASSOC_EMAIL_TO_CONTACT = 198;

// ----------------------------------------------------------------------------
// Helper interne : un seul point de sortie réseau vers HubSpot.
// Renvoie la Response (pour que l'appelant inspecte le status si besoin) ou
// null en cas d'échec réseau / timeout. Ne logge jamais le token.
// ----------------------------------------------------------------------------
async function hubspotFetch(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<Response | null> {
  try {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      // Garde-fou réseau : on ne bloque pas indéfiniment si HubSpot ne répond pas.
      signal: AbortSignal.timeout(10_000),
    });
    return res;
  } catch (err) {
    // Réseau down, timeout… on dégrade silencieusement vers null.
    console.error("[hubspot] request threw", {
      path,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

// Construit le bloc d'association standard objet → contact attendu par l'API v3.
function contactAssociation(contactId: string, associationTypeId: number) {
  return [
    {
      to: { id: contactId },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId,
        },
      ],
    },
  ];
}

// ============================================================================
// 1. searchContactByPhone — trouve un contact par son numéro de téléphone.
// ============================================================================
// NB : la recherche CRM HubSpot est un POST (et non un GET), avec un body
// `filterGroups`. Deux filterGroups = OR logique → on matche `phone` OU
// `mobilephone`. On ne ramène que le 1er contact trouvé.
//
// @returns { id, firstname, lastname, email, phone } ou null
//          (aucun contact trouvé OU erreur — indistinguables ici à dessein ;
//           pour tester la validité du token, utiliser testHubspotConnection).
export async function searchContactByPhone(
  phone: string,
  token: string,
): Promise<HubspotContact | null> {
  if (!phone || !token) return null;

  const res = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: {
      filterGroups: [
        { filters: [{ propertyName: "phone", operator: "EQ", value: phone }] },
        {
          filters: [
            { propertyName: "mobilephone", operator: "EQ", value: phone },
          ],
        },
      ],
      properties: ["firstname", "lastname", "email", "phone"],
      limit: 1,
    },
  });

  if (!res || !res.ok) {
    if (res) {
      console.error("[hubspot] searchContactByPhone failed", {
        status: res.status,
      });
    }
    return null;
  }

  try {
    const data = (await res.json()) as {
      results?: Array<{ id: string; properties?: Record<string, string | null> }>;
    };
    const first = data.results?.[0];
    if (!first) return null;

    const p = first.properties ?? {};
    return {
      id: first.id,
      firstname: p.firstname ?? null,
      lastname: p.lastname ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 2. getDeal — récupère un deal par son ID avec les propriétés essentielles.
// ============================================================================
// @returns { id, dealname, dealstage, amount, closedate } ou null.
export async function getDeal(
  dealId: string,
  token: string,
): Promise<HubspotDeal | null> {
  if (!dealId || !token) return null;

  const props = "dealname,dealstage,amount,closedate";
  const res = await hubspotFetch(
    `/crm/v3/objects/deals/${encodeURIComponent(dealId)}?properties=${props}`,
    token,
  );

  if (!res || !res.ok) {
    if (res) {
      console.error("[hubspot] getDeal failed", {
        dealId,
        status: res.status,
      });
    }
    return null;
  }

  try {
    const data = (await res.json()) as {
      id: string;
      properties?: Record<string, string | null>;
    };
    const p = data.properties ?? {};
    return {
      id: data.id,
      dealname: p.dealname ?? null,
      dealstage: p.dealstage ?? null,
      amount: p.amount ?? null,
      closedate: p.closedate ?? null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 2bis. getContact — récupère un contact par son ID (J16, pour la CRM Card).
// ============================================================================
// À l'ouverture d'une fiche contact, HubSpot nous transmet l'ID du contact.
// On en lit le téléphone pour retrouver les appels Aloalo correspondants.
// On ramène `phone` ET `mobilephone` : un contact peut n'avoir renseigné que
// l'un des deux, et l'appel peut avoir été passé sur l'un ou l'autre.
// @returns { id, firstname, lastname, phone, mobilephone } ou null.
export type HubspotContactDetails = {
  id: string;
  firstname: string | null;
  lastname: string | null;
  phone: string | null;
  mobilephone: string | null;
};

export async function getContact(
  contactId: string,
  token: string,
): Promise<HubspotContactDetails | null> {
  if (!contactId || !token) return null;

  const props = "phone,mobilephone,firstname,lastname";
  const res = await hubspotFetch(
    `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}?properties=${props}`,
    token,
  );

  if (!res || !res.ok) {
    if (res) {
      console.error("[hubspot] getContact failed", {
        contactId,
        status: res.status,
      });
    }
    return null;
  }

  try {
    const data = (await res.json()) as {
      id: string;
      properties?: Record<string, string | null>;
    };
    const p = data.properties ?? {};
    return {
      id: data.id,
      firstname: p.firstname ?? null,
      lastname: p.lastname ?? null,
      phone: p.phone ?? null,
      mobilephone: p.mobilephone ?? null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// 3. createTimelineEvent — STUB en attendant J16.
// ============================================================================
// Les Timeline Events HubSpot exigent un `eventTemplateId` créé via une app
// HubSpot (CRM Card), qu'on configurera en J16. Pour l'instant on se contente
// de construire + logger le payload (sans le token) et de renvoyer true, pour
// pouvoir brancher l'appel dans le pipeline d'analyse dès maintenant.
export async function createTimelineEvent(
  contactId: string,
  analysisData: { score: number; strengths: string[]; improvements: string[] },
  token: string,
): Promise<boolean> {
  // Payload qu'on enverra réellement en J16 (forme indicative).
  const payload = {
    objectId: contactId,
    tokens: {
      score: analysisData.score,
      strengths: analysisData.strengths.join(" • "),
      improvements: analysisData.improvements.join(" • "),
    },
  };
  // On logge la présence du token (jamais sa valeur) — utile pour vérifier que
  // l'appelant le transmet bien dès maintenant, avant le branchement réel J16.
  console.info("[hubspot] createTimelineEvent (stub J16)", {
    ...payload,
    hasToken: Boolean(token),
  });
  return true;
}

// ============================================================================
// 4. createNote — crée une note associée à un contact.
// ============================================================================
// `hs_timestamp` est OBLIGATOIRE pour une note (date d'horodatage). On utilise
// l'instant présent. @returns l'ID de la note créée ou null.
export async function createNote(
  contactId: string,
  content: string,
  token: string,
): Promise<string | null> {
  if (!contactId || !token) return null;

  const res = await hubspotFetch("/crm/v3/objects/notes", token, {
    method: "POST",
    body: {
      properties: {
        hs_note_body: content,
        hs_timestamp: Date.now(),
      },
      associations: contactAssociation(contactId, ASSOC_NOTE_TO_CONTACT),
    },
  });

  if (!res || !res.ok) {
    if (res) {
      console.error("[hubspot] createNote failed", { status: res.status });
    }
    return null;
  }

  try {
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// 5. createTask — crée une tâche (à faire) associée à un contact.
// ============================================================================
// @param dueDateMs — échéance en millisecondes epoch (hs_timestamp).
// @returns l'ID de la tâche créée ou null.
export async function createTask(
  contactId: string,
  title: string,
  dueDateMs: number,
  token: string,
): Promise<string | null> {
  if (!contactId || !token) return null;

  const res = await hubspotFetch("/crm/v3/objects/tasks", token, {
    method: "POST",
    body: {
      properties: {
        hs_task_subject: title,
        hs_task_status: "NOT_STARTED",
        hs_timestamp: dueDateMs,
      },
      associations: contactAssociation(contactId, ASSOC_TASK_TO_CONTACT),
    },
  });

  if (!res || !res.ok) {
    if (res) {
      console.error("[hubspot] createTask failed", { status: res.status });
    }
    return null;
  }

  try {
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// 6. createEmailDraft — crée un email au statut DRAFT associé à un contact.
// ============================================================================
// `hs_timestamp` est obligatoire pour un objet email. @returns l'ID ou null.
export async function createEmailDraft(
  contactId: string,
  subject: string,
  body: string,
  token: string,
): Promise<string | null> {
  if (!contactId || !token) return null;

  const res = await hubspotFetch("/crm/v3/objects/emails", token, {
    method: "POST",
    body: {
      properties: {
        hs_email_subject: subject,
        hs_email_text: body,
        hs_email_status: "DRAFT",
        hs_timestamp: Date.now(),
      },
      associations: contactAssociation(contactId, ASSOC_EMAIL_TO_CONTACT),
    },
  });

  if (!res || !res.ok) {
    if (res) {
      console.error("[hubspot] createEmailDraft failed", {
        status: res.status,
      });
    }
    return null;
  }

  try {
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// testHubspotConnection — vérifie qu'un token est valide (≠ recherche métier).
// ============================================================================
// Pourquoi une fonction dédiée : searchContactByPhone renvoie `null` aussi bien
// pour « token invalide (401) » que pour « aucun contact ». Pour le badge de
// connexion dans les settings, on a besoin de distinguer les deux. On tape donc
// le même endpoint de recherche, mais on inspecte le STATUS HTTP :
//   - 401 → token invalide
//   - réponse réseau OK (toute autre réponse) → token accepté par HubSpot
//   - pas de réponse (réseau down) → "unknown" (on ne tranche pas)
export async function testHubspotConnection(
  token: string,
): Promise<HubspotConnectionStatus> {
  if (!token) return "invalid";

  const res = await hubspotFetch("/crm/v3/objects/contacts/search", token, {
    method: "POST",
    body: {
      filterGroups: [
        { filters: [{ propertyName: "phone", operator: "EQ", value: "test" }] },
      ],
      limit: 1,
    },
  });

  if (!res) return "unknown"; // réseau down / timeout : on ne se prononce pas
  if (res.status === 401) return "invalid";
  return "connected";
}
