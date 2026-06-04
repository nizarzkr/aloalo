// ============================================================================
// AloaloCard.tsx — App Card affichée sur la fiche contact HubSpot.
// ============================================================================
// Elle appelle DIRECTEMENT notre endpoint Next.js via `hubspot.fetch()` (pas de
// fonction serverless HubSpot : celle-ci exigerait un abonnement Enterprise, non
// dispo sur le portail). `hubspot.fetch` :
//   - n'autorise que les URLs déclarées dans `permittedUrls.fetch` (app-hsmeta) ;
//   - ne transmet PAS de header custom, MAIS signe la requête avec le client
//     secret de l'app (header `X-HubSpot-Signature-v3`) → l'endpoint vérifie
//     cette signature au lieu d'un secret partagé ;
//   - ajoute tout seul les query params `portalId`, `userId`, `userEmail`,
//     `appId` → on récupère `portalId` gratuitement, on n'ajoute que contactId.
//
// La carte ne fait QUE de l'affichage.
//
// Données reçues (forme = JSON de /api/hubspot/card-data) :
//   { lastScore, callCount, lastCallLabel, axe, lastCallId }  ← appels analysés
//   { message }                                               ← état vide
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

// Données affichables d'un appel analysé.
type CardData = {
  lastScore: number | null;
  callCount: number;
  lastCallLabel: string;
  axe: string;
  lastCallId: string;
};
// Soit des données, soit un message expliquant l'absence de données.
type CardResult = CardData | { message: string };

hubspot.extend<'crm.record.tab'>(({ context }) => <AloaloCard context={context} />);

const AloaloCard = ({ context }: { context: CrmContext }) => {
  const [result, setResult] = useState<CardResult | null>(null);

  // contactId = fiche ouverte. portalId est ajouté automatiquement par
  // hubspot.fetch dans la query string (inutile de le passer nous-mêmes).
  const contactId =
    context.crm?.objectId != null ? String(context.crm.objectId) : '';

  useEffect(() => {
    hubspot
      .fetch(`${CARD_DATA_URL}?contactId=${encodeURIComponent(contactId)}`, {
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
  }, [contactId]);

  if (!result) return <LoadingSpinner label="Chargement de l'historique Aloalo…" />;
  if ('message' in result) return <Text>{result.message}</Text>;

  return (
    <>
      <Heading>Historique Aloalo</Heading>
      <DescriptionList direction="row">
        <DescriptionListItem label="Dernier score">
          <Text>
            {result.lastScore != null ? `${result.lastScore}/100` : '—'}
          </Text>
        </DescriptionListItem>
        <DescriptionListItem label="Appels analysés">
          <Text>{String(result.callCount)}</Text>
        </DescriptionListItem>
        <DescriptionListItem label="Dernier appel">
          <Text>{result.lastCallLabel}</Text>
        </DescriptionListItem>
        <DescriptionListItem label="Axe prioritaire">
          <Text>{result.axe}</Text>
        </DescriptionListItem>
      </DescriptionList>
      <Divider />
      <Link href={`${ALOALO_BASE_URL}/dashboard/calls/${result.lastCallId}`}>
        Voir le détail sur Aloalo
      </Link>
    </>
  );
};
