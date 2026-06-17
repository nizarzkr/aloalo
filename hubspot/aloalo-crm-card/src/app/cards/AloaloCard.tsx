// ============================================================================
// AloaloCard.tsx — App Card affichée sur la fiche contact ET la fiche deal.
// ============================================================================
// Elle appelle DIRECTEMENT notre endpoint Next.js via `hubspot.fetch()` (pas de
// fonction serverless HubSpot : celle-ci exigerait un abonnement Enterprise, non
// dispo sur le portail). `hubspot.fetch` :
//   - n'autorise que les URLs déclarées dans `permittedUrls.fetch` (app-hsmeta) ;
//   - ne transmet PAS de header custom, MAIS signe la requête avec le client
//     secret de l'app (header `X-HubSpot-Signature-v3`) → l'endpoint vérifie
//     cette signature au lieu d'un secret partagé ;
//   - ajoute tout seul les query params `portalId`, `userId`, `userEmail`,
//     `appId` → on récupère `portalId` gratuitement, on n'ajoute que l'ID objet.
//
// La carte ne fait QUE de l'affichage. Elle s'adapte à l'objet ouvert via
// `context.crm.objectTypeId` :
//   - contact (`0-1`) → digest GLOBAL de la personne (param `contactId`)
//   - deal    (`0-3`) → digest DU deal (param `dealId`)
//
// Données reçues (forme = JSON de /api/hubspot/card-data) :
//   contact : { lastValidated, lastTotal, callCount, lastCallLabel, axe, lastCallId }
//   deal    : { callCount, avgValidated, lastValidated, lastTotal, lastCallLabel, lastCallId }
//   vide    : { message }
// Depuis J25, plus de score /100 : on affiche le nb de dimensions validées (/5).
// ============================================================================

import { useEffect, useState } from 'react';
import {
  hubspot,
  CrmContext,
  DescriptionList,
  DescriptionListItem,
  Divider,
  Heading,
  Link,
  LoadingSpinner,
  Text,
} from '@hubspot/ui-extensions';

// Endpoint Next.js source de données. hubspot.fetch exige une URL HTTPS absolue
// (les chemins relatifs ne marchent pas) et déclarée dans permittedUrls.fetch.
const ALOALO_BASE_URL = 'https://aloalo-three.vercel.app';
const CARD_DATA_URL = `${ALOALO_BASE_URL}/api/hubspot/card-data`;

// objectTypeId du deal côté HubSpot (le contact est `0-1`).
const DEAL_OBJECT_TYPE_ID = '0-3';

// Digest d'un contact (dernier appel analysé de la personne).
type ContactData = {
  lastValidated: number | null;
  lastTotal: number | null;
  callCount: number;
  lastCallLabel: string;
  axe: string;
  lastCallId: string;
};
// Digest d'un deal (appels rattachés à ce deal).
type DealData = {
  callCount: number;
  avgValidated: number | null;
  lastValidated: number | null;
  lastTotal: number | null;
  lastCallLabel: string;
  lastCallId: string;
};

// Formate « N / T » dimensions validées, ou « — » si indisponible.
const fmtDims = (validated: number | null, total: number | null) =>
  validated != null ? `${validated} / ${total ?? 5}` : '—';
// Soit des données, soit un message expliquant l'absence de données.
type CardResult = ContactData | DealData | { message: string };

hubspot.extend<'crm.record.tab'>(({ context }) => <AloaloCard context={context} />);

const AloaloCard = ({ context }: { context: CrmContext }) => {
  const [result, setResult] = useState<CardResult | null>(null);

  // Objet ouvert. portalId est ajouté automatiquement par hubspot.fetch dans la
  // query string (inutile de le passer nous-mêmes).
  const objectId =
    context.crm?.objectId != null ? String(context.crm.objectId) : '';
  const isDeal = context.crm?.objectTypeId === DEAL_OBJECT_TYPE_ID;

  useEffect(() => {
    // Sur un deal on envoie dealId, sinon contactId → le digest renvoyé diffère.
    const param = isDeal ? 'dealId' : 'contactId';
    hubspot
      .fetch(`${CARD_DATA_URL}?${param}=${encodeURIComponent(objectId)}`, {
        method: 'GET',
      })
      .then((res) => res.json())
      .then((data) => {
        // Réponse exploitable = soit un message d'état, soit des données avec
        // lastCallId. Toute autre forme (ex. 401 { error }) → message lisible
        // plutôt que des champs vides + un lien cassé.
        if (
          data &&
          typeof data === 'object' &&
          ('message' in data || 'lastCallId' in data)
        ) {
          setResult(data as CardResult);
        } else {
          setResult({ message: 'Historique temporairement indisponible' });
        }
      })
      .catch(() =>
        setResult({ message: 'Historique temporairement indisponible' }),
      );
  }, [objectId, isDeal]);

  if (!result) return <LoadingSpinner label="Chargement de l'historique Aloalo…" />;
  if ('message' in result) return <Text>{result.message}</Text>;

  // ---- Rendu DEAL : digest des appels rattachés au deal. -------------------
  if (isDeal) {
    const deal = result as DealData;
    return (
      <>
        <Heading>Performance sur ce deal</Heading>
        <DescriptionList direction="row">
          <DescriptionListItem label="Appels analysés">
            <Text>{String(deal.callCount)}</Text>
          </DescriptionListItem>
          <DescriptionListItem label="Dimensions validées (moy.)">
            <Text>
              {deal.avgValidated != null ? `${deal.avgValidated} / 5` : '—'}
            </Text>
          </DescriptionListItem>
          <DescriptionListItem label="Dernier appel">
            <Text>
              {deal.lastCallLabel}
              {deal.lastValidated != null
                ? ` · ${fmtDims(deal.lastValidated, deal.lastTotal)}`
                : ''}
            </Text>
          </DescriptionListItem>
        </DescriptionList>
        <Divider />
        <Link href={`${ALOALO_BASE_URL}/dashboard/calls/${deal.lastCallId}`}>
          Voir le détail sur Aloalo
        </Link>
      </>
    );
  }

  // ---- Rendu CONTACT : digest global de la personne (inchangé). ------------
  const contact = result as ContactData;
  return (
    <>
      <Heading>Historique Aloalo</Heading>
      <DescriptionList direction="row">
        <DescriptionListItem label="Dimensions validées">
          <Text>{fmtDims(contact.lastValidated, contact.lastTotal)}</Text>
        </DescriptionListItem>
        <DescriptionListItem label="Appels analysés">
          <Text>{String(contact.callCount)}</Text>
        </DescriptionListItem>
        <DescriptionListItem label="Dernier appel">
          <Text>{contact.lastCallLabel}</Text>
        </DescriptionListItem>
        <DescriptionListItem label="Axe prioritaire">
          <Text>{contact.axe}</Text>
        </DescriptionListItem>
      </DescriptionList>
      <Divider />
      <Link href={`${ALOALO_BASE_URL}/dashboard/calls/${contact.lastCallId}`}>
        Voir le détail sur Aloalo
      </Link>
    </>
  );
};
