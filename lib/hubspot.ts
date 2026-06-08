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
// IDs d'association HUBSPOT_DEFINED (objet → contact / objet → deal). Ces IDs
// sont des constantes du référentiel HubSpot, pas des valeurs propres à notre
// portail.
//   note  → contact : 202     note  → deal : 214
//   task  → contact : 204     task  → deal : 216
// Une « association » lie un objet (note/tâche) à un contact OU à un deal pour
// qu'il apparaisse dans la timeline de cet objet côté HubSpot.
//
// Choix produit (J18bis) : on rattache en priorité au DEAL (l'affaire en cours),
// avec repli sur le CONTACT si le contact n'a aucun deal associé.
// ----------------------------------------------------------------------------
const ASSOC_NOTE_TO_CONTACT = 202;
const ASSOC_TASK_TO_CONTACT = 204;
const ASSOC_NOTE_TO_DEAL = 214;
const ASSOC_TASK_TO_DEAL = 216;

// Cible d'un rattachement note/tâche : soit un contact, soit un deal.
export type HubspotTarget = { type: "contact" | "deal"; id: string };

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

// Construit le bloc d'association standard objet → (contact|deal) attendu par
// l'API v3. On choisit l'associationTypeId selon le type de la cible.
function targetAssociation(
  target: HubspotTarget,
  toContactTypeId: number,
  toDealTypeId: number,
) {
  return [
    {
      to: { id: target.id },
      types: [
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId:
            target.type === "deal" ? toDealTypeId : toContactTypeId,
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
// 1ter. getContactCompany — entreprise (company) associée à un contact.
// ============================================================================
// Chemin : association v4 contacts→companies → 1er ID → on lit son `name`.
// Un contact peut être associé à 0, 1 ou plusieurs entreprises ; on prend la
// première (cas dominant = 1 entreprise par contact). @returns {id, name} ou null.
export type HubspotCompany = { id: string; name: string | null };

export async function getContactCompany(
  contactId: string,
  token: string,
): Promise<HubspotCompany | null> {
  if (!contactId || !token) return null;

  const assocRes = await hubspotFetch(
    `/crm/v4/objects/contacts/${encodeURIComponent(contactId)}/associations/companies?limit=1`,
    token,
  );
  if (!assocRes || !assocRes.ok) return null;

  let companyId = "";
  try {
    const data = (await assocRes.json()) as {
      results?: Array<{ toObjectId?: string | number }>;
    };
    const first = data.results?.[0];
    companyId = first?.toObjectId != null ? String(first.toObjectId) : "";
  } catch {
    return null;
  }
  if (!companyId) return null;

  const res = await hubspotFetch(
    `/crm/v3/objects/companies/${encodeURIComponent(companyId)}?properties=name`,
    token,
  );
  if (!res || !res.ok) return null;

  try {
    const data = (await res.json()) as {
      id: string;
      properties?: Record<string, string | null>;
    };
    return { id: data.id, name: data.properties?.name ?? null };
  } catch {
    return null;
  }
}

// ============================================================================
// 1quater. getMostRecentDealForContact — deal le plus récent du contact.
// ============================================================================
// Choix produit (J18bis) : quand un contact a plusieurs deals, on prend le plus
// récemment modifié (tri sur hs_lastmodifieddate desc), y compris s'il est déjà
// gagné/perdu. Chemin : association v4 contacts→deals → batch read des deals →
// tri local. @returns le deal le plus récent ou null (aucun deal / erreur).
export async function getMostRecentDealForContact(
  contactId: string,
  token: string,
): Promise<HubspotDeal | null> {
  if (!contactId || !token) return null;

  // 1. IDs des deals associés au contact.
  const assocRes = await hubspotFetch(
    `/crm/v4/objects/contacts/${encodeURIComponent(contactId)}/associations/deals?limit=100`,
    token,
  );
  if (!assocRes || !assocRes.ok) return null;

  let dealIds: string[] = [];
  try {
    const data = (await assocRes.json()) as {
      results?: Array<{ toObjectId?: string | number }>;
    };
    dealIds = (data.results ?? [])
      .map((r) => (r.toObjectId != null ? String(r.toObjectId) : ""))
      .filter((id) => id.length > 0);
  } catch {
    return null;
  }
  if (dealIds.length === 0) return null;

  // 2. Batch read des deals avec la date de dernière modif pour trier.
  const readRes = await hubspotFetch("/crm/v3/objects/deals/batch/read", token, {
    method: "POST",
    body: {
      properties: [
        "dealname",
        "dealstage",
        "amount",
        "closedate",
        "hs_lastmodifieddate",
      ],
      inputs: dealIds.map((id) => ({ id })),
    },
  });
  if (!readRes || !readRes.ok) return null;

  try {
    const data = (await readRes.json()) as {
      results?: Array<{ id: string; properties?: Record<string, string | null> }>;
    };
    const deals = data.results ?? [];
    if (deals.length === 0) return null;

    // Tri décroissant par date de dernière modif (le plus récent en tête).
    deals.sort((a, b) => {
      const ta = Date.parse(a.properties?.hs_lastmodifieddate ?? "") || 0;
      const tb = Date.parse(b.properties?.hs_lastmodifieddate ?? "") || 0;
      return tb - ta;
    });

    const top = deals[0];
    const p = top.properties ?? {};
    return {
      id: top.id,
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
// 1quinquies. resolveContactContext — résout un numéro vers contact + entreprise
//             + deal le plus récent, en une seule passe (J18bis).
// ============================================================================
// Sert à la fois à l'enrichissement d'affichage (nom/entreprise/deal dans Aloalo)
// ET au choix de la cible des notes/tâches (deal en priorité, sinon contact).
// Tout est dégradé : si une sous-requête échoue, le champ correspondant est null.
// @returns { contact, company, deal } ; contact=null si aucun contact pour ce numéro.
export type ContactContext = {
  contact: HubspotContact | null;
  company: HubspotCompany | null;
  deal: HubspotDeal | null;
};

export async function resolveContactContext(
  phone: string,
  token: string,
): Promise<ContactContext> {
  const empty: ContactContext = { contact: null, company: null, deal: null };
  if (!phone || !token) return empty;

  const contact = await searchContactByPhone(phone, token);
  if (!contact) return empty;

  // Entreprise + deal en parallèle (indépendants l'un de l'autre).
  const [company, deal] = await Promise.all([
    getContactCompany(contact.id, token),
    getMostRecentDealForContact(contact.id, token),
  ]);

  return { contact, company, deal };
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
// 2ter. getDealCalls — appels (call engagements) associés à un deal.
// ============================================================================
// Pour la carte CRM scopée au deal : on lit l'association `deals → calls` que
// HubSpot tient déjà à jour (un appel passé depuis Ringover/Aircall via le deal
// y est rattaché). On récupère, pour chaque appel, son numéro appelé et son
// horodatage — la seule clé de jointure dispo vers nos appels Aloalo, faute de
// `hs_call_external_id` exposé côté portail (cf. décision archi carte deal).
//
// 2 requêtes :
//   1. v4 associations deals→calls → liste d'IDs de call engagements.
//   2. v3 batch read des calls → (hs_call_to_number, hs_timestamp).
//
// @returns liste de { id, toNumber, timestampMs } ou [] (deal sans appel OU
//          erreur — on dégrade silencieusement, la carte gère le cas vide).
export type HubspotDealCall = {
  id: string;
  toNumber: string | null;
  timestampMs: number | null;
};

// Plafond volontaire : un deal a rarement >100 appels, et ça borne le batch read.
const DEAL_CALLS_LIMIT = 100;

export async function getDealCalls(
  dealId: string,
  token: string,
): Promise<HubspotDealCall[]> {
  if (!dealId || !token) return [];

  // 1. IDs des appels associés au deal (association v4).
  const assocRes = await hubspotFetch(
    `/crm/v4/objects/deals/${encodeURIComponent(dealId)}/associations/calls?limit=${DEAL_CALLS_LIMIT}`,
    token,
  );
  if (!assocRes || !assocRes.ok) {
    if (assocRes) {
      console.error("[hubspot] getDealCalls associations failed", {
        dealId,
        status: assocRes.status,
      });
    }
    return [];
  }

  let callIds: string[] = [];
  try {
    const data = (await assocRes.json()) as {
      results?: Array<{ toObjectId?: string | number }>;
    };
    callIds = (data.results ?? [])
      .map((r) => (r.toObjectId != null ? String(r.toObjectId) : ""))
      .filter((id) => id.length > 0);
  } catch {
    return [];
  }
  if (callIds.length === 0) return [];

  // 2. Batch read des call engagements → numéro appelé + horodatage.
  const readRes = await hubspotFetch("/crm/v3/objects/calls/batch/read", token, {
    method: "POST",
    body: {
      properties: ["hs_call_to_number", "hs_timestamp"],
      inputs: callIds.map((id) => ({ id })),
    },
  });
  if (!readRes || !readRes.ok) {
    if (readRes) {
      console.error("[hubspot] getDealCalls batch read failed", {
        dealId,
        status: readRes.status,
      });
    }
    return [];
  }

  try {
    const data = (await readRes.json()) as {
      results?: Array<{ id: string; properties?: Record<string, string | null> }>;
    };
    return (data.results ?? []).map((r) => {
      const ts = r.properties?.hs_timestamp ?? null;
      const ms = ts ? Date.parse(ts) : NaN;
      return {
        id: r.id,
        toNumber: r.properties?.hs_call_to_number ?? null,
        timestampMs: Number.isFinite(ms) ? ms : null,
      };
    });
  } catch {
    return [];
  }
}

// ============================================================================
// 2quater. getContactEmailSignals — signaux off-call email d'un contact (J23).
// ============================================================================
// Pour le « momentum » du deal : on lit les emails loggués sur le contact côté
// HubSpot et on en dérive deux signaux de refroidissement :
//   - velocity_hours : délai entre le 1er email SORTANT (commercial) et la 1re
//     réponse ENTRANTE (prospect). Un délai qui s'allonge = prospect qui refroidit.
//   - multi_threading : nb d'adresses distinctes côté prospect (to + cc), indice
//     d'un décideur/DAF mis en copie (engagement plus fort).
//
// Vérifié le 8 juin 2026 : l'objet EMAIL et ces propriétés sont lisibles avec une
// Private App en tier gratuit — PAS besoin de Sales Hub Pro. En revanche
// `hs_email_open_count` / `hs_email_click_count` existent au schéma mais ne sont
// alimentés que si le tracking email est actif → on les lit « si dispo » et on
// renvoie null sinon (cf. mémoire project_hubspot_email_tier_j23).
//
// 2 requêtes (association v4 contacts→emails, puis batch read). Tout est dégradé
// vers null : pas d'email loggué (cas des données simulées) → on renvoie null,
// jamais d'erreur. @returns DealCrmSignals ou null.
export type DealCrmEmailSignals = {
  velocity_hours: number | null
  multi_threading: number | null
  total_opens: number | null
  total_clicks: number | null
};

const CONTACT_EMAILS_LIMIT = 100;

export async function getContactEmailSignals(
  contactId: string,
  token: string,
): Promise<DealCrmEmailSignals | null> {
  if (!contactId || !token) return null;

  // 1. IDs des emails associés au contact.
  const assocRes = await hubspotFetch(
    `/crm/v4/objects/contacts/${encodeURIComponent(contactId)}/associations/emails?limit=${CONTACT_EMAILS_LIMIT}`,
    token,
  );
  if (!assocRes || !assocRes.ok) return null;

  let emailIds: string[] = [];
  try {
    const data = (await assocRes.json()) as {
      results?: Array<{ toObjectId?: string | number }>;
    };
    emailIds = (data.results ?? [])
      .map((r) => (r.toObjectId != null ? String(r.toObjectId) : ""))
      .filter((id) => id.length > 0);
  } catch {
    return null;
  }
  if (emailIds.length === 0) return null;

  // 2. Batch read des emails avec les propriétés confirmées (tier gratuit).
  const readRes = await hubspotFetch("/crm/v3/objects/emails/batch/read", token, {
    method: "POST",
    body: {
      properties: [
        "hs_timestamp",
        "hs_email_direction",
        "hs_email_to_email",
        "hs_email_cc_email",
        "hs_email_open_count",
        "hs_email_click_count",
      ],
      inputs: emailIds.map((id) => ({ id })),
    },
  });
  if (!readRes || !readRes.ok) return null;

  try {
    const data = (await readRes.json()) as {
      results?: Array<{ properties?: Record<string, string | null> }>;
    };
    const emails = (data.results ?? []).map((r) => r.properties ?? {});
    if (emails.length === 0) return null;

    // Tri chronologique pour calculer la velocity sortant → 1re réponse.
    const dated = emails
      .map((p) => ({
        ts: p.hs_timestamp ? Date.parse(p.hs_timestamp) : NaN,
        // Direction HubSpot : EMAIL (sortant, envoyé par le commercial) vs
        // INCOMING_EMAIL (réponse du prospect).
        incoming: (p.hs_email_direction ?? "").toUpperCase().includes("INCOMING"),
        recipients: [p.hs_email_to_email, p.hs_email_cc_email]
          .filter((v): v is string => Boolean(v))
          .flatMap((v) => v.split(";"))
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean),
        opens: Number(p.hs_email_open_count ?? ""),
        clicks: Number(p.hs_email_click_count ?? ""),
      }))
      .filter((e) => Number.isFinite(e.ts))
      .sort((a, b) => a.ts - b.ts);

    // velocity : 1er sortant → 1re réponse entrante qui suit.
    let velocityHours: number | null = null;
    const firstOutbound = dated.find((e) => !e.incoming);
    if (firstOutbound) {
      const firstReply = dated.find((e) => e.incoming && e.ts > firstOutbound.ts);
      if (firstReply) {
        velocityHours = (firstReply.ts - firstOutbound.ts) / 3_600_000;
      }
    }

    // multi_threading : nb d'adresses distinctes touchées (hors null).
    const distinct = new Set<string>();
    for (const e of dated) for (const r of e.recipients) distinct.add(r);
    const multiThreading = distinct.size > 0 ? distinct.size : null;

    // Ouvertures / clics : somme « si dispo » (NaN = champ vide/non tracké → null).
    const sumOpens = dated.reduce((s, e) => s + (Number.isFinite(e.opens) ? e.opens : 0), 0);
    const sumClicks = dated.reduce((s, e) => s + (Number.isFinite(e.clicks) ? e.clicks : 0), 0);
    const anyOpens = dated.some((e) => Number.isFinite(e.opens));
    const anyClicks = dated.some((e) => Number.isFinite(e.clicks));

    return {
      velocity_hours: velocityHours,
      multi_threading: multiThreading,
      total_opens: anyOpens ? sumOpens : null,
      total_clicks: anyClicks ? sumClicks : null,
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
// 4. createNote — crée une note associée à un contact OU à un deal.
// ============================================================================
// `hs_timestamp` est OBLIGATOIRE pour une note (date d'horodatage). On utilise
// l'instant présent. @param target — { type:'contact'|'deal', id }.
// @returns l'ID de la note créée ou null.
export async function createNote(
  target: HubspotTarget,
  content: string,
  token: string,
): Promise<string | null> {
  if (!target?.id || !token) return null;

  const res = await hubspotFetch("/crm/v3/objects/notes", token, {
    method: "POST",
    body: {
      properties: {
        hs_note_body: content,
        hs_timestamp: Date.now(),
      },
      associations: targetAssociation(
        target,
        ASSOC_NOTE_TO_CONTACT,
        ASSOC_NOTE_TO_DEAL,
      ),
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
// 5. createTask — crée une tâche (à faire) associée à un contact OU à un deal.
// ============================================================================
// @param target — { type:'contact'|'deal', id } : objet sur lequel poser la tâche.
// @param dueDateMs — échéance en millisecondes epoch (hs_timestamp).
// @param body — contexte de la tâche (hs_task_body), optionnel. Sert à donner
//   au commercial le « pourquoi » de la tâche (raison déduite de l'appel).
// @returns l'ID de la tâche créée ou null.
export async function createTask(
  target: HubspotTarget,
  title: string,
  dueDateMs: number,
  token: string,
  body?: string,
): Promise<string | null> {
  if (!target?.id || !token) return null;

  const res = await hubspotFetch("/crm/v3/objects/tasks", token, {
    method: "POST",
    body: {
      properties: {
        hs_task_subject: title,
        hs_task_status: "NOT_STARTED",
        hs_timestamp: dueDateMs,
        ...(body ? { hs_task_body: body } : {}),
      },
      associations: targetAssociation(
        target,
        ASSOC_TASK_TO_CONTACT,
        ASSOC_TASK_TO_DEAL,
      ),
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
