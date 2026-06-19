// ============================================================================
// lib/pipedrive.ts — Wrapper sur l'API Pipedrive (v2 + notes v1) (J46).
// ============================================================================
// 2ᵉ implémentation CRM derrière l'abstraction J45. Calqué sur lib/hubspot.ts :
// chaque fonction mappe la réponse Pipedrive vers les types `Crm*` de
// lib/crm/types.ts, dégrade vers null/[] sans jamais throw, et ne logge jamais
// le token. L'adaptateur (lib/crm/pipedrive/adapter.ts) résout le couple
// { token, apiDomain } et appelle ces fonctions.
//
// Doc officielle (juin 2026) :
//   - Base : {apiDomain}/api/v2/... (apiDomain propre à la société, cf. OAuth).
//   - Enveloppe : { success, data, additional_data: { next_cursor } }.
//   - Deals : status open|won|lost ; deal.title, value, stage_id, pipeline_id,
//     person_id, org_id, close_time, won_time.
//   - Stages : id, name, pipeline_id, order_nr, deal_probability (0..100). PAS de
//     flag « fermé » (le gagné est un STATUT de deal) → isClosed=false.
//   - Notes : v1 uniquement → POST {apiDomain}/api/v1/notes.
//
// Dégradations J46 (décision Nizar 19/06, cf. plan) : getDealCalls → [],
// getPersonEmailSignals → null, createTimelineEvent → true (no-op).
// ============================================================================

import type {
  CrmContact,
  CrmContactDetails,
  CrmCompany,
  CrmDeal,
  CrmDealCall,
  CrmWonDeal,
  CrmEmailSignals,
  CrmContactContext,
  CrmPipeline,
  CrmTarget,
  CrmConnectionStatus,
  CrmAnalysisSummary,
} from "@/lib/crm/types";

const V2 = "/api/v2";
const V1 = "/api/v1";

// ----------------------------------------------------------------------------
// Helper réseau unique. Renvoie la Response (pour inspecter le status) ou null
// en cas d'échec réseau/timeout. Ne logge jamais le token.
// ----------------------------------------------------------------------------
async function pipedriveFetch(
  apiDomain: string,
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<Response | null> {
  try {
    return await fetch(`${apiDomain}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error("[pipedrive] request threw", {
      path,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

// Enveloppe v2 : { success, data, additional_data: { next_cursor } }.
type V2Envelope<T> = {
  success?: boolean;
  data?: T;
  additional_data?: { next_cursor?: string | null };
};

// Lit une collection v2 paginée par curseur (cap de pages pour borner les coûts).
// Utilisé pour pipelines/stages (volumes faibles). @returns le tableau agrégé.
async function fetchAllV2<T>(
  apiDomain: string,
  basePath: string,
  token: string,
  maxPages = 5,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null | undefined = undefined;
  for (let page = 0; page < maxPages; page++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const path = `${basePath}${sep}limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await pipedriveFetch(apiDomain, path, token);
    if (!res || !res.ok) break;
    let json: V2Envelope<T[]>;
    try {
      json = (await res.json()) as V2Envelope<T[]>;
    } catch {
      break;
    }
    if (Array.isArray(json.data)) out.push(...json.data);
    cursor = json.additional_data?.next_cursor;
    if (!cursor) break;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Formes Pipedrive partielles (on ne déclare que ce qu'on lit).
// ----------------------------------------------------------------------------
type PdPhone = { value?: string; primary?: boolean; label?: string };
type PdPerson = {
  id: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phones?: PdPhone[];
  emails?: Array<{ value?: string; primary?: boolean }>;
  org_id?: number | { value?: number } | null;
};
type PdDeal = {
  id: number;
  title?: string | null;
  stage_id?: number | null;
  pipeline_id?: number | null;
  value?: number | string | null;
  status?: string | null;
  close_time?: string | null;
  won_time?: string | null;
};

// Téléphone « principal » : celui marqué primary, sinon le 1er non vide.
function primaryPhone(phones: PdPhone[] | undefined): string | null {
  if (!phones || phones.length === 0) return null;
  const prim = phones.find((p) => p.primary && p.value);
  return (prim?.value ?? phones.find((p) => p.value)?.value) ?? null;
}

// Téléphone « mobile » : labellisé mobile/cell, sinon null (≠ phone principal).
function mobilePhone(phones: PdPhone[] | undefined): string | null {
  if (!phones) return null;
  const mob = phones.find(
    (p) => p.value && /mobile|cell|portable/i.test(p.label ?? ""),
  );
  return mob?.value ?? null;
}

// Découpe un nom complet « Prénom Nom » si first/last absents.
function splitName(person: PdPerson): { firstname: string | null; lastname: string | null } {
  if (person.first_name || person.last_name) {
    return { firstname: person.first_name ?? null, lastname: person.last_name ?? null };
  }
  const parts = (person.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: null, lastname: null };
  if (parts.length === 1) return { firstname: parts[0], lastname: null };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

function orgIdOf(person: PdPerson): string | null {
  const o = person.org_id;
  if (o == null) return null;
  if (typeof o === "number") return String(o);
  return o.value != null ? String(o.value) : null;
}

// Mappe un deal Pipedrive vers la forme CrmDeal (commune aux CRM).
function toCrmDeal(d: PdDeal): CrmDeal {
  return {
    id: String(d.id),
    dealname: d.title ?? null,
    dealstage: d.stage_id != null ? String(d.stage_id) : null,
    amount: d.value != null ? String(d.value) : null,
    closedate: d.won_time ?? d.close_time ?? null,
  };
}

// ============================================================================
// 1. searchPersonByPhone — trouve une personne par téléphone (search v2).
// ============================================================================
export async function searchPersonByPhone(
  apiDomain: string,
  token: string,
  phone: string,
): Promise<CrmContact | null> {
  if (!phone) return null;
  const params = new URLSearchParams({
    term: phone,
    fields: "phone",
    exact_match: "false",
    limit: "1",
  });
  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/persons/search?${params.toString()}`,
    token,
  );
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as V2Envelope<{
      items?: Array<{ item?: PdPerson }>;
    }>;
    const item = json.data?.items?.[0]?.item;
    if (!item) return null;
    return getPersonContact(apiDomain, token, String(item.id));
  } catch {
    return null;
  }
}

// ============================================================================
// 2. getPerson — détails d'une personne par id (téléphones + nom).
// ============================================================================
export async function getPerson(
  apiDomain: string,
  token: string,
  personId: string,
): Promise<CrmContactDetails | null> {
  if (!personId) return null;
  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/persons/${encodeURIComponent(personId)}`,
    token,
  );
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as V2Envelope<PdPerson>;
    const p = json.data;
    if (!p) return null;
    const { firstname, lastname } = splitName(p);
    return {
      id: String(p.id),
      firstname,
      lastname,
      phone: primaryPhone(p.phones),
      mobilephone: mobilePhone(p.phones),
    };
  } catch {
    return null;
  }
}

// Variante interne renvoyant la forme « contact » (email/phone) pour le contexte.
async function getPersonContact(
  apiDomain: string,
  token: string,
  personId: string,
): Promise<CrmContact | null> {
  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/persons/${encodeURIComponent(personId)}`,
    token,
  );
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as V2Envelope<PdPerson>;
    const p = json.data;
    if (!p) return null;
    const { firstname, lastname } = splitName(p);
    const email =
      p.emails?.find((e) => e.primary && e.value)?.value ??
      p.emails?.find((e) => e.value)?.value ??
      null;
    return { id: String(p.id), firstname, lastname, email, phone: primaryPhone(p.phones) };
  } catch {
    return null;
  }
}

// ============================================================================
// 3. getPersonOrganization — entreprise (org) liée à une personne.
// ============================================================================
export async function getPersonOrganization(
  apiDomain: string,
  token: string,
  personId: string,
): Promise<CrmCompany | null> {
  const person = await pipedriveFetch(
    apiDomain,
    `${V2}/persons/${encodeURIComponent(personId)}`,
    token,
  );
  if (!person || !person.ok) return null;
  let orgId: string | null = null;
  try {
    const json = (await person.json()) as V2Envelope<PdPerson>;
    orgId = json.data ? orgIdOf(json.data) : null;
  } catch {
    return null;
  }
  if (!orgId) return null;

  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/organizations/${encodeURIComponent(orgId)}`,
    token,
  );
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as V2Envelope<{ id: number; name?: string | null }>;
    if (!json.data) return null;
    return { id: String(json.data.id), name: json.data.name ?? null };
  } catch {
    return null;
  }
}

// ============================================================================
// 4. getMostRecentDealForPerson — deal le plus récemment modifié d'une personne.
// ============================================================================
export async function getMostRecentDealForPerson(
  apiDomain: string,
  token: string,
  personId: string,
): Promise<CrmDeal | null> {
  if (!personId) return null;
  const params = new URLSearchParams({
    person_id: personId,
    sort_by: "update_time",
    sort_direction: "desc",
    limit: "1",
  });
  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/deals?${params.toString()}`,
    token,
  );
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as V2Envelope<PdDeal[]>;
    const d = json.data?.[0];
    return d ? toCrmDeal(d) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 5. resolvePersonContext — numéro → personne + entreprise + deal récent.
// ============================================================================
export async function resolvePersonContext(
  apiDomain: string,
  token: string,
  phone: string,
): Promise<CrmContactContext> {
  const empty: CrmContactContext = { contact: null, company: null, deal: null };
  if (!phone) return empty;

  // 1. Identifier la personne par téléphone (search v2).
  const params = new URLSearchParams({
    term: phone,
    fields: "phone",
    exact_match: "false",
    limit: "1",
  });
  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/persons/search?${params.toString()}`,
    token,
  );
  if (!res || !res.ok) return empty;
  let personId = "";
  try {
    const json = (await res.json()) as V2Envelope<{
      items?: Array<{ item?: { id: number } }>;
    }>;
    const id = json.data?.items?.[0]?.item?.id;
    personId = id != null ? String(id) : "";
  } catch {
    return empty;
  }
  if (!personId) return empty;

  const [contact, company, deal] = await Promise.all([
    getPersonContact(apiDomain, token, personId),
    getPersonOrganization(apiDomain, token, personId),
    getMostRecentDealForPerson(apiDomain, token, personId),
  ]);
  if (!contact) return empty;
  return { contact, company, deal };
}

// ============================================================================
// 6. getDeal — un deal par id.
// ============================================================================
export async function getDeal(
  apiDomain: string,
  token: string,
  dealId: string,
): Promise<CrmDeal | null> {
  if (!dealId) return null;
  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/deals/${encodeURIComponent(dealId)}`,
    token,
  );
  if (!res || !res.ok) return null;
  try {
    const json = (await res.json()) as V2Envelope<PdDeal>;
    return json.data ? toCrmDeal(json.data) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 7. getRecentWonDeals — échantillon de deals GAGNÉS (status=won).
// ============================================================================
export async function getRecentWonDeals(
  apiDomain: string,
  token: string,
  limit = 15,
): Promise<CrmWonDeal[]> {
  const params = new URLSearchParams({
    status: "won",
    sort_by: "update_time",
    sort_direction: "desc",
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });
  const res = await pipedriveFetch(
    apiDomain,
    `${V2}/deals?${params.toString()}`,
    token,
  );
  if (!res || !res.ok) return [];
  try {
    const json = (await res.json()) as V2Envelope<PdDeal[]>;
    return (json.data ?? []).map((d) => ({
      id: String(d.id),
      dealname: d.title ?? null,
      amount: d.value != null ? String(d.value) : null,
      dealstage: d.stage_id != null ? String(d.stage_id) : null,
      pipeline: d.pipeline_id != null ? String(d.pipeline_id) : null,
      closedate: d.won_time ?? d.close_time ?? null,
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// 8. getPipelinesAndStages — carte du tunnel (pipelines + stages) → CrmPipeline[].
// ============================================================================
type PdPipeline = { id: number; name?: string | null; order_nr?: number | null };
type PdStage = {
  id: number;
  name?: string | null;
  pipeline_id?: number | null;
  order_nr?: number | null;
  deal_probability?: number | null;
};

// Fonction PURE (testable) : assemble les pipelines + stages Pipedrive dans la
// forme CrmPipeline commune. Pipedrive n'a pas de stage « fermé » (le gagné est
// un statut de deal) → isClosed=false ; probabilité ramenée de 0..100 à 0..1.
export function mapPipelinesAndStages(
  pipelines: PdPipeline[],
  stages: PdStage[],
): CrmPipeline[] {
  const mapped: CrmPipeline[] = pipelines.map((p) => ({
    id: String(p.id),
    label: p.name ?? String(p.id),
    displayOrder: Number(p.order_nr) || 0,
    stages: stages
      .filter((s) => s.pipeline_id === p.id)
      .map((s) => ({
        id: String(s.id),
        label: s.name ?? String(s.id),
        displayOrder: Number(s.order_nr) || 0,
        isClosed: false,
        probability:
          s.deal_probability != null && Number.isFinite(Number(s.deal_probability))
            ? Number(s.deal_probability) / 100
            : null,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder),
  }));
  return mapped.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getPipelinesAndStages(
  apiDomain: string,
  token: string,
): Promise<CrmPipeline[]> {
  const [pipelines, stages] = await Promise.all([
    fetchAllV2<PdPipeline>(apiDomain, `${V2}/pipelines`, token),
    fetchAllV2<PdStage>(apiDomain, `${V2}/stages`, token),
  ]);
  if (pipelines.length === 0) return [];
  return mapPipelinesAndStages(pipelines, stages);
}

// ============================================================================
// 9. createNote — note attachée à un deal OU une personne (API v1).
// ============================================================================
export async function createNote(
  apiDomain: string,
  token: string,
  target: CrmTarget,
  content: string,
): Promise<string | null> {
  if (!target?.id) return null;
  const body =
    target.type === "deal"
      ? { content, deal_id: Number(target.id) }
      : { content, person_id: Number(target.id) };
  const res = await pipedriveFetch(apiDomain, `${V1}/notes`, token, {
    method: "POST",
    body,
  });
  if (!res || !res.ok) {
    if (res) console.error("[pipedrive] createNote failed", { status: res.status });
    return null;
  }
  try {
    const json = (await res.json()) as V2Envelope<{ id?: number }>;
    return json.data?.id != null ? String(json.data.id) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 10. createTask — activité de type « task » liée à un deal OU une personne (v2).
// ============================================================================
// La personne se lie via `participants` (le champ person_id est read-only en v2).
export async function createTask(
  apiDomain: string,
  token: string,
  target: CrmTarget,
  title: string,
  dueDateMs: number,
  body?: string,
): Promise<string | null> {
  if (!target?.id) return null;
  const dueDate = new Date(dueDateMs).toISOString().slice(0, 10); // YYYY-MM-DD
  const payload: Record<string, unknown> = {
    subject: title,
    type: "task",
    due_date: dueDate,
    done: false,
    ...(body ? { note: body } : {}),
  };
  if (target.type === "deal") {
    payload.deal_id = Number(target.id);
  } else {
    payload.participants = [{ person_id: Number(target.id), primary: true }];
  }
  const res = await pipedriveFetch(apiDomain, `${V2}/activities`, token, {
    method: "POST",
    body: payload,
  });
  if (!res || !res.ok) {
    if (res) console.error("[pipedrive] createTask failed", { status: res.status });
    return null;
  }
  try {
    const json = (await res.json()) as V2Envelope<{ id?: number }>;
    return json.data?.id != null ? String(json.data.id) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 11. testConnection — valide le couple token/api_domain (≠ recherche métier).
// ============================================================================
export async function testConnection(
  apiDomain: string,
  token: string,
): Promise<CrmConnectionStatus> {
  if (!apiDomain || !token) return "invalid";
  const res = await pipedriveFetch(apiDomain, `${V1}/users/me`, token);
  if (!res) return "unknown"; // réseau down : on ne tranche pas
  if (res.status === 401) return "invalid";
  return res.ok ? "connected" : "unknown";
}

// ============================================================================
// Dégradations J46 (cf. plan) — features HubSpot non encore mappées sur Pipedrive.
// ============================================================================

// Historique d'appels rattachés à un deal : les activités Pipedrive type « call »
// ne portent pas de numéro composé fiable → jointure vers nos appels Aloalo non
// faite pour l'instant. TODO (jour ultérieur) : explorer activities?type=call.
export async function getDealCalls(): Promise<CrmDealCall[]> {
  return [];
}

// Signaux email (vélocité de réponse, multi-threading) : nécessitent l'API
// Mailbox de Pipedrive, souvent restreinte par plan. TODO (jour ultérieur).
export async function getPersonEmailSignals(): Promise<CrmEmailSignals | null> {
  return null;
}

// Timeline event : pas d'équivalent direct côté Pipedrive (la note de synthèse
// joue ce rôle). No-op cohérent avec le stub HubSpot.
export async function createTimelineEvent(
  contactId: string,
  analysis: CrmAnalysisSummary,
): Promise<boolean> {
  // On consomme les paramètres pour respecter le contrat CrmAdapter sans rien
  // envoyer (no-op assumé).
  void contactId;
  void analysis;
  return true;
}
