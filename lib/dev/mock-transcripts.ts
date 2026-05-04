export type MockTranscript = {
  id: string
  title: string
  duration_seconds: number
  caller_number: string
  callee_number: string
  text: string
  segments: Array<{
    speaker: string
    text: string
    start: number
    end: number
  }>
}

export const MOCK_TRANSCRIPTS: MockTranscript[] = [
  {
    id: 'mock-1',
    title: 'Appel avec objection prix — PME logistique',
    duration_seconds: 312,
    caller_number: '+33612345678',
    callee_number: '+33145678901',
    text: `Bonjour, je suis Thomas Mercier de chez Aloalo. Je vous appelle suite à votre demande de démo sur notre solution d'analyse d'appels commerciaux. Vous avez quelques minutes ?
Oui bonjour Thomas, je suis Sophie Renard, directrice commerciale chez TransLog. Oui j'ai quelques minutes.
Parfait. Avant de vous présenter la solution, j'aimerais mieux comprendre votre contexte. Combien de commerciaux avez-vous dans votre équipe actuellement ?
On est une équipe de 12 personnes. On fait beaucoup d'appels sortants, facilement 40 à 50 appels par commercial par semaine.
D'accord, donc environ 500 appels par semaine au total. Et aujourd'hui, comment vous évaluez la performance de vos équipes sur ces appels ?
Honnêtement, on fait des écoutes aléatoires, mais c'est très chronophage. Je peux en écouter 5 ou 6 par semaine maximum. Le reste, on n'a aucune visibilité.
C'est exactement le problème qu'on résout. Avec Aloalo, 100% de vos appels sont analysés automatiquement. Vous recevez un score et des conseils de coaching pour chaque appel, sans rien écouter manuellement.
Ça m'intéresse. Quel est le tarif ?
On est sur un abonnement à 299 euros par mois pour votre taille d'équipe, tout compris.
Hm, c'est plus que ce que j'imaginais. On a déjà des outils CRM, j'ai du mal à justifier un budget supplémentaire auprès de ma direction.
Je comprends. Est-ce que vous savez combien vous coûte actuellement le fait de ne pas identifier les mauvaises pratiques sur vos appels ? Un commercial qui rate ses qualifications, ça se traduit souvent par des cycles de vente 2 fois plus longs.
C'est vrai que j'ai deux commerciaux qui signent beaucoup moins que les autres, et je ne sais pas vraiment pourquoi.
C'est exactement le cas d'usage numéro un de nos clients. En général, ils identifient le problème en moins de deux semaines. Est-ce qu'on peut faire une démo avec vos vrais appels la semaine prochaine ?
Oui, pourquoi pas. Plutôt en début de semaine si possible.
Mardi 10h ça vous irait ?
Mardi 10h c'est parfait.`,
    segments: [
      { speaker: 'A', text: "Bonjour, je suis Thomas Mercier de chez Aloalo. Je vous appelle suite à votre demande de démo sur notre solution d'analyse d'appels commerciaux. Vous avez quelques minutes ?", start: 0, end: 12000 },
      { speaker: 'B', text: "Oui bonjour Thomas, je suis Sophie Renard, directrice commerciale chez TransLog. Oui j'ai quelques minutes.", start: 12500, end: 20000 },
      { speaker: 'A', text: "Parfait. Avant de vous présenter la solution, j'aimerais mieux comprendre votre contexte. Combien de commerciaux avez-vous dans votre équipe actuellement ?", start: 20500, end: 30000 },
      { speaker: 'B', text: "On est une équipe de 12 personnes. On fait beaucoup d'appels sortants, facilement 40 à 50 appels par commercial par semaine.", start: 30500, end: 40000 },
      { speaker: 'A', text: "D'accord, donc environ 500 appels par semaine au total. Et aujourd'hui, comment vous évaluez la performance de vos équipes sur ces appels ?", start: 40500, end: 51000 },
      { speaker: 'B', text: "Honnêtement, on fait des écoutes aléatoires, mais c'est très chronophage. Je peux en écouter 5 ou 6 par semaine maximum. Le reste, on n'a aucune visibilité.", start: 51500, end: 63000 },
      { speaker: 'A', text: "C'est exactement le problème qu'on résout. Avec Aloalo, 100% de vos appels sont analysés automatiquement. Vous recevez un score et des conseils de coaching pour chaque appel, sans rien écouter manuellement.", start: 63500, end: 77000 },
      { speaker: 'B', text: "Ça m'intéresse. Quel est le tarif ?", start: 77500, end: 81000 },
      { speaker: 'A', text: "On est sur un abonnement à 299 euros par mois pour votre taille d'équipe, tout compris.", start: 81500, end: 88000 },
      { speaker: 'B', text: "Hm, c'est plus que ce que j'imaginais. On a déjà des outils CRM, j'ai du mal à justifier un budget supplémentaire auprès de ma direction.", start: 88500, end: 100000 },
      { speaker: 'A', text: "Je comprends. Est-ce que vous savez combien vous coûte actuellement le fait de ne pas identifier les mauvaises pratiques sur vos appels ? Un commercial qui rate ses qualifications, ça se traduit souvent par des cycles de vente 2 fois plus longs.", start: 100500, end: 116000 },
      { speaker: 'B', text: "C'est vrai que j'ai deux commerciaux qui signent beaucoup moins que les autres, et je ne sais pas vraiment pourquoi.", start: 116500, end: 126000 },
      { speaker: 'A', text: "C'est exactement le cas d'usage numéro un de nos clients. En général, ils identifient le problème en moins de deux semaines. Est-ce qu'on peut faire une démo avec vos vrais appels la semaine prochaine ?", start: 126500, end: 140000 },
      { speaker: 'B', text: "Oui, pourquoi pas. Plutôt en début de semaine si possible.", start: 140500, end: 146000 },
      { speaker: 'A', text: "Mardi 10h ça vous irait ?", start: 146500, end: 149000 },
      { speaker: 'B', text: "Mardi 10h c'est parfait.", start: 149500, end: 152000 },
    ]
  },
  {
    id: 'mock-2',
    title: 'Appel raté — mauvaise qualification',
    duration_seconds: 198,
    caller_number: '+33687654321',
    callee_number: '+33156789012',
    text: `Allô bonjour, c'est Kevin de chez Aloalo, j'appelle pour vous présenter notre solution. Vous avez le temps là ?
Euh... oui enfin j'ai 5 minutes.
Super. Donc on fait de l'analyse d'appels par IA, c'est vraiment top, tous nos clients adorent. Je voulais vous montrer notre démo.
D'accord mais on utilise quoi comme téléphonie ?
On s'intègre avec Ringover et Aircall principalement.
On est sur Teams.
Ah. Bah écoutez on a peut-être une intégration Teams aussi, je suis pas sûr, je vais me renseigner.
Vous n'êtes pas sûr ? C'est votre produit non ?
Oui oui bien sûr, c'est juste que les intégrations c'est pas mon domaine. En tout cas notre solution est vraiment puissante, on a des scores, des analyses, du coaching...
Écoutez je vais être honnête, si vous n'avez pas d'intégration native Teams ça m'intéresse pas vraiment. On a 200 personnes sur Teams, on va pas changer.
Je comprends. On pourrait peut-être quand même faire une démo pour voir ?
Non je pense pas, merci quand même.
D'accord, bonne journée.`,
    segments: [
      { speaker: 'A', text: "Allô bonjour, c'est Kevin de chez Aloalo, j'appelle pour vous présenter notre solution. Vous avez le temps là ?", start: 0, end: 8000 },
      { speaker: 'B', text: "Euh... oui enfin j'ai 5 minutes.", start: 8500, end: 12000 },
      { speaker: 'A', text: "Super. Donc on fait de l'analyse d'appels par IA, c'est vraiment top, tous nos clients adorent. Je voulais vous montrer notre démo.", start: 12500, end: 22000 },
      { speaker: 'B', text: "D'accord mais on utilise quoi comme téléphonie ?", start: 22500, end: 26000 },
      { speaker: 'A', text: "On s'intègre avec Ringover et Aircall principalement.", start: 26500, end: 30000 },
      { speaker: 'B', text: "On est sur Teams.", start: 30500, end: 33000 },
      { speaker: 'A', text: "Ah. Bah écoutez on a peut-être une intégration Teams aussi, je suis pas sûr, je vais me renseigner.", start: 33500, end: 41000 },
      { speaker: 'B', text: "Vous n'êtes pas sûr ? C'est votre produit non ?", start: 41500, end: 45000 },
      { speaker: 'A', text: "Oui oui bien sûr, c'est juste que les intégrations c'est pas mon domaine. En tout cas notre solution est vraiment puissante, on a des scores, des analyses, du coaching...", start: 45500, end: 57000 },
      { speaker: 'B', text: "Écoutez je vais être honnête, si vous n'avez pas d'intégration native Teams ça m'intéresse pas vraiment. On a 200 personnes sur Teams, on va pas changer.", start: 57500, end: 69000 },
      { speaker: 'A', text: "Je comprends. On pourrait peut-être quand même faire une démo pour voir ?", start: 69500, end: 75000 },
      { speaker: 'B', text: "Non je pense pas, merci quand même.", start: 75500, end: 79000 },
      { speaker: 'A', text: "D'accord, bonne journée.", start: 79500, end: 82000 },
    ]
  },
  {
    id: 'mock-3',
    title: 'Appel excellent — closing réussi',
    duration_seconds: 425,
    caller_number: '+33698765432',
    callee_number: '+33167890123',
    text: `Bonjour Monsieur Dumont, c'est Laura Petit d'Aloalo. On s'était échangé des messages sur LinkedIn la semaine dernière au sujet de l'analyse de vos appels commerciaux. C'est toujours un bon moment ?
Oui bonjour Laura, tout à fait. J'avais regardé votre profil, ça m'avait l'air intéressant.
Merci. Pour qu'on soit efficaces, j'ai quelques questions rapides. Vous utilisez bien Ringover avec votre équipe ?
Oui, on est passés sur Ringover il y a 6 mois. On a 8 commerciaux.
Et aujourd'hui, qu'est-ce qui vous a poussé à regarder des solutions comme la nôtre ? Quel est le problème concret que vous cherchez à résoudre ?
On a un turnover assez fort chez les juniors. Ils arrivent, on les forme pendant 3 mois, et on n'a pas vraiment de visibilité sur pourquoi certains accrochent et d'autres non. On perd du temps et de l'argent.
Je comprends. Et quand vous dites pas de visibilité, vous écoutez les appels aujourd'hui ?
Très peu. Mon responsable commercial écoute peut-être 2-3 appels par semaine mais c'est tout. C'est très subjectif aussi.
Très bien. Et si vous deviez quantifier, c'est quoi le coût d'un junior qui ne passe pas sa période d'essai chez vous ?
Entre le recrutement, la formation, et le manque à gagner... facilement 15 à 20 000 euros par recrue ratée.
Et vous en perdez combien par an en moyenne ?
L'année dernière on en a eu 4 qui sont partis dans les 6 mois.
Donc potentiellement 60 à 80 000 euros par an. C'est exactement ce que nos clients résolvent. Je vais vous montrer concrètement comment ça marche. [pause démo] Vous voyez ici le score d'un appel de junior : il ne fait pas de next step clair à la fin de ses appels. C'est un pattern qu'on détecte sur 80% de ses conversations. En une semaine de coaching ciblé, ce genre de problème se corrige.
C'est impressionnant. Et le tarif c'est quoi ?
Pour 8 commerciaux, on est à 199 euros par mois. Avec l'essai gratuit 14 jours, vous pouvez tester sur vos vrais appels sans engagement.
Franchement ça me semble raisonnable par rapport au problème. Je peux démarrer l'essai aujourd'hui ?
Tout à fait. Je vous envoie le lien d'inscription dans la foulée, et je vous propose un point de suivi jeudi pour voir les premiers résultats. Ça vous va ?
Parfait, j'attends votre mail.`,
    segments: [
      { speaker: 'A', text: "Bonjour Monsieur Dumont, c'est Laura Petit d'Aloalo. On s'était échangé des messages sur LinkedIn la semaine dernière au sujet de l'analyse de vos appels commerciaux. C'est toujours un bon moment ?", start: 0, end: 14000 },
      { speaker: 'B', text: "Oui bonjour Laura, tout à fait. J'avais regardé votre profil, ça m'avait l'air intéressant.", start: 14500, end: 22000 },
      { speaker: 'A', text: "Merci. Pour qu'on soit efficaces, j'ai quelques questions rapides. Vous utilisez bien Ringover avec votre équipe ?", start: 22500, end: 30000 },
      { speaker: 'B', text: "Oui, on est passés sur Ringover il y a 6 mois. On a 8 commerciaux.", start: 30500, end: 37000 },
      { speaker: 'A', text: "Et aujourd'hui, qu'est-ce qui vous a poussé à regarder des solutions comme la nôtre ? Quel est le problème concret que vous cherchez à résoudre ?", start: 37500, end: 48000 },
      { speaker: 'B', text: "On a un turnover assez fort chez les juniors. Ils arrivent, on les forme pendant 3 mois, et on n'a pas vraiment de visibilité sur pourquoi certains accrochent et d'autres non. On perd du temps et de l'argent.", start: 48500, end: 63000 },
      { speaker: 'A', text: "Je comprends. Et quand vous dites pas de visibilité, vous écoutez les appels aujourd'hui ?", start: 63500, end: 70000 },
      { speaker: 'B', text: "Très peu. Mon responsable commercial écoute peut-être 2-3 appels par semaine mais c'est tout. C'est très subjectif aussi.", start: 70500, end: 80000 },
      { speaker: 'A', text: "Très bien. Et si vous deviez quantifier, c'est quoi le coût d'un junior qui ne passe pas sa période d'essai chez vous ?", start: 80500, end: 89000 },
      { speaker: 'B', text: "Entre le recrutement, la formation, et le manque à gagner... facilement 15 à 20 000 euros par recrue ratée.", start: 89500, end: 100000 },
      { speaker: 'A', text: "Et vous en perdez combien par an en moyenne ?", start: 100500, end: 104000 },
      { speaker: 'B', text: "L'année dernière on en a eu 4 qui sont partis dans les 6 mois.", start: 104500, end: 111000 },
      { speaker: 'A', text: "Donc potentiellement 60 à 80 000 euros par an. C'est exactement ce que nos clients résolvent. Je vais vous montrer concrètement comment ça marche. [pause démo] Vous voyez ici le score d'un appel de junior : il ne fait pas de next step clair à la fin de ses appels. C'est un pattern qu'on détecte sur 80% de ses conversations. En une semaine de coaching ciblé, ce genre de problème se corrige.", start: 111500, end: 145000 },
      { speaker: 'B', text: "C'est impressionnant. Et le tarif c'est quoi ?", start: 145500, end: 150000 },
      { speaker: 'A', text: "Pour 8 commerciaux, on est à 199 euros par mois. Avec l'essai gratuit 14 jours, vous pouvez tester sur vos vrais appels sans engagement.", start: 150500, end: 162000 },
      { speaker: 'B', text: "Franchement ça me semble raisonnable par rapport au problème. Je peux démarrer l'essai aujourd'hui ?", start: 162500, end: 170000 },
      { speaker: 'A', text: "Tout à fait. Je vous envoie le lien d'inscription dans la foulée, et je vous propose un point de suivi jeudi pour voir les premiers résultats. Ça vous va ?", start: 170500, end: 183000 },
      { speaker: 'B', text: "Parfait, j'attends votre mail.", start: 183500, end: 187000 },
    ]
  }
]
