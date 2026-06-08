export type MockTranscript = {
  id: string
  title: string
  // Phrase courte affichée sous le titre sur /dev/test pour expliquer le
  // scénario joué (pitch, objections principales, type de closing).
  description: string
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
  // Identité CRM optionnelle (J24bis / démo) : normalement remplie par
  // l'enrichissement HubSpot, on peut la pré-câbler ici pour les scénarios de
  // démo. Un `deal_id` commun à plusieurs appels les regroupe en UN seul deal
  // (même si les contacts / numéros diffèrent) sur /dashboard/deals.
  contact_name?: string
  company_name?: string
  deal_name?: string
  deal_id?: string
}

// ---------------------------------------------------------------------------
// buildScenario — convertit une liste de tours [{ speaker, text }] en un
// MockTranscript complet. Les timestamps sont calculés à partir de la longueur
// de chaque texte. CHARS_PER_SEC=10 reflète la vitesse réelle d'un appel
// commercial transcrit, qui inclut les silences et hésitations entre les mots
// (le texte transcrit en strip les "euh...", mais la durée réelle, elle, les
// inclut). GAP_MS=800 modélise le temps moyen entre la fin d'une intervention
// et la réponse de l'autre speaker. Utilisé pour les scénarios longs (J14).
// ---------------------------------------------------------------------------
function buildScenario(opts: {
  id: string
  title: string
  description: string
  caller_number: string
  callee_number: string
  turns: Array<{ speaker: 'A' | 'B'; text: string }>
  // Identité CRM optionnelle (cf. MockTranscript) pré-câblée pour les démos.
  contact_name?: string
  company_name?: string
  deal_name?: string
  deal_id?: string
}): MockTranscript {
  const CHARS_PER_SEC = 10
  const GAP_MS = 800
  let cursor = 0
  const segments = opts.turns.map((t) => {
    const dur = Math.max(2000, Math.round((t.text.length / CHARS_PER_SEC) * 1000))
    const start = cursor
    const end = start + dur
    cursor = end + GAP_MS
    return { speaker: t.speaker, text: t.text, start, end }
  })
  const text = opts.turns.map((t) => t.text).join('\n')
  const lastEnd = segments[segments.length - 1]?.end ?? 0
  return {
    id: opts.id,
    title: opts.title,
    description: opts.description,
    caller_number: opts.caller_number,
    callee_number: opts.callee_number,
    duration_seconds: Math.round(lastEnd / 1000),
    text,
    segments,
    contact_name: opts.contact_name,
    company_name: opts.company_name,
    deal_name: opts.deal_name,
    deal_id: opts.deal_id,
  }
}

// ---------------------------------------------------------------------------
// Scénario A — Flowly vs Monday (l'indécis · closing par démo planifiée)
// Prospect : Julien Berton, directeur de production, agence L'Atelier 109.
// Utilise Monday depuis 2 ans, pas mécontent. Le commercial pivote sur la
// facturation native (vs Zapier) et obtient une démo technique mardi 14h.
// ---------------------------------------------------------------------------
const FLOWLY_SCENARIO_A: MockTranscript = buildScenario({
  id: 'mock-4',
  title: 'Flowly · L\'indécis Monday (démo planifiée)',
  description: 'Flowly vs Monday · prospect convaincu de Monday · pivot sur facturation native · démo technique mardi 14h.',
  caller_number: '+33612009988',
  callee_number: '+33178223344',
  turns: [
    { speaker: 'A', text: "Bonjour Julien, Camille de Flowly. On s'est échangé sur LinkedIn la semaine dernière à propos de votre stack outils. Je vous appelle comme convenu, vous avez bien réservé 30 minutes ?" },
    { speaker: 'B', text: "Oui bonjour Camille. Oui j'ai bien le créneau, allez-y." },
    { speaker: 'A', text: "Super, merci. Pour qu'on soit efficaces, j'aimerais commencer par bien comprendre votre quotidien avant de vous présenter quoi que ce soit. Vous m'aviez dit qu'à L'Atelier 109 vous êtes 12, c'est ça ?" },
    { speaker: 'B', text: "Exact, 12 personnes. On a 8 créas — direction artistique, motion, dev front — 2 chefs de projet, et 2 sur le commercial et l'administratif. Moi je suis directeur de production." },
    { speaker: 'A', text: "D'accord. Et concrètement, qui fait quoi sur la gestion des projets clients ? Comment ça circule entre les équipes ?" },
    { speaker: 'B', text: "Alors les commerciaux ramènent les briefs, les chefs de projet découpent en tâches, et c'est globalement suivi sur un tableau Monday par projet. Chaque créa retrouve ses tâches dans son onglet personnel." },
    { speaker: 'A', text: "Et Monday, vous l'utilisez depuis combien de temps ?" },
    { speaker: 'B', text: "Deux ans à peu près. Avant on était sur Trello mais c'était trop léger quand on est passés les 8 personnes. On est basculés sur Monday et globalement on est plutôt contents pour être franc." },
    { speaker: 'A', text: "OK, donc Monday tient bien la route sur la coordination interne. Et côté facturation client, comment ça se passe ?" },
    { speaker: 'B', text: "Ah ça c'est plus compliqué. On a Pennylane pour la compta et la facturation. Entre Monday et Pennylane c'est mon assistante qui ressaisit. Elle ressort les heures pointées dans Monday, elle fait un Excel par client, et après elle saisit les factures dans Pennylane." },
    { speaker: 'A', text: "Et concrètement, combien de temps elle passe sur ce process chaque semaine, votre assistante ?" },
    { speaker: 'B', text: "Facilement une journée et demie. Donc environ 6 jours par mois. C'est presque 25% de son temps total." },
    { speaker: 'A', text: "Une journée et demie par semaine sur de la double saisie. Et vous, ça vous gêne particulièrement ?" },
    { speaker: 'B', text: "Honnêtement oui, deux choses. D'abord c'est de l'admin pur, on paye une personne à recopier des chiffres d'un outil à l'autre. Et deuxième chose, je suis sûr qu'on perd des heures dans la nature. Les créas ne pointent pas tous les jours, ils rattrapent le vendredi, et là forcément il y a du flou." },
    { speaker: 'A', text: "OK. Donc deux douleurs claires : l'admin chronophage, et le risque de perdre des heures non facturées. Et si je vous demande de chiffrer, vous perdez combien d'heures par mois à votre avis ?" },
    { speaker: 'B', text: "Difficile à dire précisément... Je dirais 10 à 15% des heures réellement faites qui partent à la poubelle. Sur 12 personnes à 35h, c'est facile 70 heures qui ne sont jamais facturées chaque mois." },
    { speaker: 'A', text: "70 heures par mois. À combien vous facturez l'heure créa en moyenne ?" },
    { speaker: 'B', text: "95 euros HT." },
    { speaker: 'A', text: "Donc on parle de 6 600 euros par mois de chiffre d'affaires qui s'évapore. Quasiment 80 000 euros par an." },
    { speaker: 'B', text: "Oui... formulé comme ça c'est moins joli." },
    { speaker: 'A', text: "C'est exactement le sujet sur lequel Flowly est positionné. Est-ce que je peux vous montrer rapidement comment on attaque ce problème ?" },
    { speaker: 'B', text: "Allez-y, mais soyons honnêtes, je suis pas mécontent de Monday, donc il faut vraiment me convaincre." },
    { speaker: 'A', text: "Très bien. En une phrase, Flowly est un outil de gestion de projets fait pour les agences créatives, et la différence majeure avec Monday c'est qu'on a la facturation client native, pas via une intégration tierce. Quand un créa pointe une heure, elle est automatiquement rangée dans une feuille de facturation par client, vous validez en fin de mois, et la facture part vers Pennylane." },
    { speaker: 'B', text: "Donc plus besoin de Pennylane ?" },
    { speaker: 'A', text: "Pennylane reste votre compta générale, on synchronise avec eux automatiquement. Mais c'est zéro double saisie. Votre assistante récupère sa journée et demie par semaine." },
    { speaker: 'B', text: "Hmm. Mais Monday a des intégrations Zapier non, on peut faire la même chose en branchant Monday sur Pennylane ?" },
    { speaker: 'A', text: "Excellente question, c'est l'objection numéro un qu'on entend. Zapier permet la connexion, oui, mais en pratique vous avez trois problèmes. Un, la latence : les Zaps tournent toutes les 15 minutes au mieux, donc le pointage n'est jamais temps réel. Deux, si Monday n'a pas un champ \"facturable / non facturable\" propre par tâche, vous devez quand même faire un tri manuel avant l'export. Et trois, si un Zap plante au milieu du mois, vous découvrez le bug le jour où vous voulez facturer." },
    { speaker: 'B', text: "C'est vrai qu'on a déjà eu des Zaps qui sautaient sans qu'on s'en rende compte... OK ce point là je l'achète." },
    { speaker: 'A', text: "Et chez Flowly tout est natif, donc pas de Zapier à maintenir, pas de cassures silencieuses, et le pointage est en temps réel." },
    { speaker: 'B', text: "D'accord. Maintenant l'autre sujet, c'est qu'on a habitué l'équipe à Monday depuis deux ans. Changer d'outil c'est jamais une partie de plaisir." },
    { speaker: 'A', text: "Question hyper légitime, c'est typiquement la deuxième objection qu'on traite. Concrètement la transition c'est trois choses : un, on importe automatiquement tous vos projets Monday en cours via leur API, vous gardez l'historique complet. Deux, on forme votre équipe en deux sessions d'une heure sur Zoom. Trois, j'ai un chef de projet Flowly qui reste à votre disposition pendant 5 jours pour répondre à toutes les questions de l'équipe en temps réel." },
    { speaker: 'B', text: "Cinq jours dédiés, c'est confortable. Mais pendant ces cinq jours, on continue à bosser comment ? On peut pas se permettre de bloquer les sprints clients en cours." },
    { speaker: 'A', text: "Justement. Pendant la migration on garde Monday en parallèle, vous coupez uniquement quand vous êtes confiants. Pendant deux à trois semaines vos équipes peuvent même continuer à pointer dans Monday si elles préfèrent, on resync. La bascule définitive se fait en douceur, pas en mode big bang." },
    { speaker: 'B', text: "OK ça me rassure. Et niveau prix ?" },
    { speaker: 'A', text: "89 euros par utilisateur et par mois, sans engagement de durée. Pour 12 personnes ça fait 1068 euros mensuels hors taxes. Et avec un engagement annuel vous avez 15% de remise, donc l'équivalent de 907 euros mensuels." },
    { speaker: 'B', text: "D'accord. C'est dans la fourchette que j'avais en tête, ça représente moins d'un sixième de ce qu'on perd actuellement en facturation. Reste à valider techniquement." },
    { speaker: 'A', text: "C'est exactement ce que je vous propose. Je vais bloquer une démo technique avec Mathieu, mon chef de projet senior, qui pourra vous montrer concrètement l'import d'un de vos projets Monday et la facturation associée en direct. Vous préférez plutôt mardi ou jeudi la semaine prochaine ?" },
    { speaker: 'B', text: "Plutôt mardi, jeudi je suis chez un client toute la journée." },
    { speaker: 'A', text: "Mardi 14h heure de Paris, ça vous va ?" },
    { speaker: 'B', text: "Mardi 14h... laissez-moi vérifier... oui c'est bon, je bloque le créneau." },
    { speaker: 'A', text: "Parfait. Je vous envoie l'invitation Google Meet dans l'heure. Et juste avant la démo, je vous demanderai par mail le nom d'un projet Monday en cours que vous voulez voir importé en démo, comme ça Mathieu vous le montre sur de la donnée réelle, pas une fixture." },
    { speaker: 'B', text: "OK super, je vous enverrai un projet client lambda. Merci Camille." },
    { speaker: 'A', text: "Avec plaisir Julien. À mardi alors." },
    { speaker: 'B', text: "À mardi." },
  ],
})

// ---------------------------------------------------------------------------
// Scénario B — Flowly · le price-sensitive (validation associé · KO ouvert)
// Prospect : Sarah Dumas, directrice agence Atelier Mira (12 personnes).
// Convaincue produit, bloque sur le prix mensuel. Le commercial chiffre le
// ROI via les heures non facturables, propose le paiement annuel -15%, mais
// la prospect doit valider avec son associé Frank jeudi. Closing négatif
// mais porte ouverte : doc PDF chiffré envoyé pour préparer la réunion.
// ---------------------------------------------------------------------------
const FLOWLY_SCENARIO_B: MockTranscript = buildScenario({
  id: 'mock-5',
  title: 'Flowly · Le price-sensitive (KO mais ouverte)',
  description: 'Flowly · agence 12p · prix bloque (1068€/mois) · ROI chiffré · validation associé jeudi · porte ouverte.',
  caller_number: '+33687554433',
  callee_number: '+33145887766',
  turns: [
    { speaker: 'A', text: "Bonjour Sarah, Camille de Flowly. Ravie de vous retrouver. Comme on s'était dit, j'ai bloqué 30 minutes pour qu'on aille au fond du sujet aujourd'hui. Vous avez bien le créneau ?" },
    { speaker: 'B', text: "Bonjour Camille. Oui c'est bon, je suis devant l'ordi." },
    { speaker: 'A', text: "Parfait. Petit rappel rapide pour qu'on soit calées, et puis je rentre dans le concret. La semaine dernière on s'était parlé pendant 45 minutes, vous m'aviez expliqué que chez Atelier Mira vous êtes 12, vous gérez environ 25 clients actifs, et que vos deux gros points de friction c'étaient d'un côté la facturation client qui prend des plombes chaque mois, et de l'autre le manque de visibilité temps réel sur la rentabilité projet. C'est bien ça ?" },
    { speaker: 'B', text: "Oui parfait, vous avez bien retenu. Rien à ajouter." },
    { speaker: 'A', text: "Top. Aujourd'hui ce que je vous propose c'est : je vous montre 10 minutes de l'interface en mode démo sur un cas type d'agence, on regarde concrètement comment se passe le pointage et la facturation, et après je vous donne toutes les conditions commerciales pour que vous puissiez décider en interne. Ça vous va ?" },
    { speaker: 'B', text: "Allez-y, je vous suis." },
    { speaker: 'A', text: "Donc voilà l'écran d'accueil d'un compte type. Vous voyez ici en haut le pipeline des projets en cours, classés par échéance. Chaque projet a une marge prévisionnelle calculée en temps réel à partir du devis initial et des heures pointées depuis le début. Là par exemple, ce projet en rouge, il a déjà consommé 110% du budget heures prévu, donc l'agence est en train de perdre de l'argent dessus en ce moment même." },
    { speaker: 'B', text: "Hmm. Et le créa il voit ça aussi en rouge ?" },
    { speaker: 'A', text: "Le créa voit son propre temps passé sur sa tâche, oui. Le code couleur global de rentabilité n'est visible que par les chefs de projet et la direction. Vous configurez ça dans les rôles, granulaire." },
    { speaker: 'B', text: "OK ça me plaît. On a régulièrement des projets qui dérivent sans qu'on s'en rende compte avant la facture finale. Là on aurait pu réagir avant." },
    { speaker: 'A', text: "C'est typique. Et ici, en deux clics, on passe sur la vue facturation mensuelle. Vous voyez toutes les heures pointées du mois, regroupées par client, prêtes à être facturées. Vous validez, et la facture part automatiquement vers Pennylane. Plus de tableau Excel intermédiaire, plus de double saisie." },
    { speaker: 'B', text: "D'accord. Ça c'est très clair. Et niveau prix vous m'aviez parlé de 89 euros, c'est bien ça ?" },
    { speaker: 'A', text: "89 euros par utilisateur et par mois, sans engagement de durée. Pour 12 personnes ça fait 1068 euros mensuels hors taxes." },
    { speaker: 'B', text: "1068... [silence] honnêtement Camille, c'est plus que ce que j'imaginais. On est sur un budget outils qui doit tenir dans une enveloppe annuelle, et là on parle de plus de 12 000 euros par an. Mon comptable va me regarder bizarrement." },
    { speaker: 'A', text: "Je comprends, et c'est important qu'on parle franchement de ce point. Avant de défendre le prix, est-ce qu'on peut chiffrer ensemble ce que vous perdez aujourd'hui sur ces deux sujets ? Vous m'aviez dit la semaine dernière que votre assistante passe environ une journée par semaine sur la facturation manuelle." },
    { speaker: 'B', text: "Oui, environ 7 à 8 heures par semaine, c'est ça." },
    { speaker: 'A', text: "Et le pointage des heures par vos créas, à quel point c'est précis ?" },
    { speaker: 'B', text: "Pour être totalement honnête, c'est très approximatif. On a tous tendance à arrondir, à oublier de pointer les petites corrections d'une heure ici ou là, les coups de fil au téléphone avec un client qui durent 20 minutes." },
    { speaker: 'A', text: "Vous avez une estimation des heures réellement effectuées mais non facturées chaque mois, sur l'ensemble de l'équipe ?" },
    { speaker: 'B', text: "Je dirais entre 60 et 80 heures par mois en cumulé. Peut-être plus en réalité, mais disons 70 heures de moyenne." },
    { speaker: 'A', text: "70 heures par mois. À combien vous facturez l'heure créa en moyenne, tous profils confondus ?" },
    { speaker: 'B', text: "100 euros HT en moyenne, ça dépend des profils. Les seniors sont à 120, les juniors à 80, mais le mix donne autour de 100." },
    { speaker: 'A', text: "Donc 7 000 euros de chiffre d'affaires qui n'arrive pas dans vos comptes, chaque mois." },
    { speaker: 'B', text: "Oui, mais c'est aussi qu'on a tendance à pas refacturer certaines reprises mineures aux clients, ça fait partie du jeu de l'agence." },
    { speaker: 'A', text: "Bien sûr, et c'est sain. Mais admettons qu'on récupère uniquement 30% de ces heures perdues : ça fait 21 heures par mois facturables en plus, soit 2 100 euros mensuels de revenus retrouvés. Et la journée de votre assistante qu'on libère, vous la convertissez en quoi côté business ?" },
    { speaker: 'B', text: "Elle a déjà plein d'autres trucs à faire pour moi côté commercial, donc oui ce serait du temps utile, pas du temps perdu." },
    { speaker: 'A', text: "Donc le ROI brut est très clair : 1068 euros de coût mensuel face à 2 100 euros minimum de récupération de chiffre d'affaires, plus le temps libéré de votre assistante. Vous êtes positif dès le premier mois sur l'investissement, et le ROI augmente avec le temps puisque la précision du pointage s'améliore." },
    { speaker: 'B', text: "Sur le papier oui, je le vois. Le problème c'est pas vraiment le ROI à un an, c'est plus le cash flow ici et maintenant. Sortir 1068 euros tous les mois en plus c'est un engagement de plus dans une période où on en a déjà beaucoup." },
    { speaker: 'A', text: "Question légitime, c'est typiquement le sujet qu'on entend en deuxième vague d'objection. On a deux options pour aider sur ce point. Soit on part sur du mensuel sans engagement, comme je vous ai présenté. Soit on part sur l'annuel, et là vous bénéficiez de 15% de remise immédiate, donc on est plutôt à 907 euros mensuels équivalents, mais payés en une fois en début d'année." },
    { speaker: 'B', text: "15% c'est intéressant. Bon écoutez, vraiment, c'est très intéressant ce que vous me montrez. Mais sur un engagement comme celui-là, je ne peux pas décider seule, il faut absolument que je voie avec mon associé Frank avant de signer quoi que ce soit." },
    { speaker: 'A', text: "Bien sûr, c'est tout à fait normal, on est sur un sujet stratégique. Frank, il a quel angle sur l'outillage de l'agence d'habitude ? C'est plutôt lui qui pousse l'innovation, ou plutôt celui qui freine ?" },
    { speaker: 'B', text: "Plutôt prudent disons. Il est très ROI, il aime les chiffres précis, il déteste les engagements pas justifiés." },
    { speaker: 'A', text: "Quand est-ce que vous le voyez la prochaine fois ?" },
    { speaker: 'B', text: "On a notre point hebdo jeudi, en fin de matinée." },
    { speaker: 'A', text: "OK. Ce que je vous propose pour vous aider à porter le sujet : je vous prépare un document récapitulatif pour ce soir, avec le détail de l'offre, et un mini-calcul de ROI personnalisé Atelier Mira basé sur les chiffres exacts que vous m'avez donnés aujourd'hui. Comme ça Frank a tous les éléments factuels pour la conversation jeudi." },
    { speaker: 'B', text: "Ah ça serait parfait. Avec un truc sur une page si possible, il déteste les pavés." },
    { speaker: 'A', text: "Une page maximum, c'est noté. Et si Frank a une question technique précise pendant votre conversation jeudi, n'hésitez pas à me le faire suivre directement par mail, je peux y répondre dans la journée pour ne pas vous bloquer si la conversation avance bien." },
    { speaker: 'B', text: "Super, c'est noté." },
    { speaker: 'A', text: "Et juste pour qu'on cale les attentes côté timing : si jeudi soir c'est un go, je peux démarrer l'onboarding dès la semaine d'après, et vous seriez facturé à partir de mai. Donc même dans ce scénario positif, votre première mensualité tombe fin mai. Ça vous donne environ 6 semaines de visibilité sur votre cash flow." },
    { speaker: 'B', text: "D'accord, c'est correct comme timing." },
    { speaker: 'A', text: "Et si la réponse est non, ou pas tout de suite, ça reste évidemment ouvert. Je vous rappelle en novembre quand vos chiffres du troisième trimestre sont stabilisés, ça vous va comme deal ?" },
    { speaker: 'B', text: "Oui c'est tout à fait correct. Merci Camille en tout cas, c'était utile cet échange." },
    { speaker: 'A', text: "Merci à vous Sarah, à très vite alors." },
    { speaker: 'B', text: "À très vite, bonne fin de journée." },
  ],
})

// ---------------------------------------------------------------------------
// Scénario C — Flowly · deal chaud · migration Notion+Trello (closing positif)
// Prospect : Mehdi Khelifa, COO Studio Brava (18 personnes). Convaincu produit,
// bloqué uniquement sur la peur de la migration depuis 3 ans de docs Notion +
// 25 tableaux Trello actifs. Le commercial rassure méthodiquement sur les 5
// jours d'accompagnement + migration parallèle 30 jours + formation 2x1h, et
// obtient une signature DocuSign le jour même.
// ---------------------------------------------------------------------------
const FLOWLY_SCENARIO_C: MockTranscript = buildScenario({
  id: 'mock-6',
  title: 'Flowly · Deal chaud · migration Notion+Trello (closing)',
  description: 'Flowly · COO 18p prêt à signer mais stress migration · 5j accompagnement + parallèle 30j · DocuSign envoyé.',
  caller_number: '+33623998877',
  callee_number: '+33189665544',
  turns: [
    { speaker: 'A', text: "Bonjour Mehdi, Camille de Flowly. Comment allez-vous ?" },
    { speaker: 'B', text: "Très bien Camille, et vous ?" },
    { speaker: 'A', text: "Au top, merci. Bon, on est rendus au quatrième échange tous les deux, et la dernière fois vous m'avez dit qu'on touchait à la décision. Où est-ce qu'on en est de votre côté ?" },
    { speaker: 'B', text: "Justement, c'est pour ça que je voulais qu'on se reparle de vive voix aujourd'hui. On est convaincus. Honnêtement vous avez coché toutes nos cases côté produit. Le sponsor au comité de direction la semaine dernière, ça s'est très bien passé, on a le go côté budget et côté gouvernance." },
    { speaker: 'A', text: "C'est une excellente nouvelle, merci Mehdi pour le travail de portage interne que vous avez fait là-dessus. Je sais que c'est jamais une mince affaire de défendre un nouvel outil en comité de direction." },
    { speaker: 'B', text: "Pas de quoi. Mais il y a une chose qui me bloque vraiment, et je veux qu'on en parle aujourd'hui avant que je signe quoi que ce soit." },
    { speaker: 'A', text: "Allez-y, je vous écoute. Pour autant on touche à la fin, c'est important qu'on évacue cette friction." },
    { speaker: 'B', text: "On est sur Notion depuis maintenant trois ans pour toute la documentation projet, et sur Trello depuis bien plus longtemps que ça pour le suivi des kanbans clients au quotidien. On a un historique conséquent. Si on migre vers Flowly et que ça se passe mal, on perd notre opérationnel pendant des semaines. Et chez Studio Brava on est en plein milieu de deux gros sprints clients en parallèle là, on n'a vraiment pas le luxe de s'arrêter ne serait-ce qu'une semaine." },
    { speaker: 'A', text: "C'est une crainte tout à fait légitime, et c'est honnêtement le sujet numéro un qu'on traite avec toutes les agences de votre taille. Avant de vous expliquer comment on attaque ça concrètement, j'aimerais juste bien cerner le volume. Quand vous dites historique conséquent, vous me parlez de quoi en chiffres ?" },
    { speaker: 'B', text: "Sur Notion on doit avoir 80 ou 100 pages de documentation projet active, plus les archives, peut-être 300 pages au total avec les workspaces secondaires. Sur Trello on a 25 tableaux clients actifs, avec une moyenne de 40 à 60 cartes par tableau, et des commentaires qui datent parfois de deux ans." },
    { speaker: 'A', text: "D'accord. Donc on parle d'un volume sérieux mais tout à fait dans la fourchette qu'on a déjà migré pour des clients comparables, agences de 15 à 25 personnes. Je vais vous expliquer concrètement ce qu'on fait. Première chose : Flowly inclut systématiquement 5 jours d'accompagnement migration dans le forfait, sans surcoût. Ces 5 jours sont assurés par un chef de projet dédié de chez nous, qui ne fait que ça à plein temps." },
    { speaker: 'B', text: "Cinq jours c'est cinq jours ouvrés ou cinq jours étalés sur deux semaines ?" },
    { speaker: 'A', text: "Cinq jours ouvrés étalés sur les deux à trois premières semaines, calés sur votre rythme. Concrètement la première journée, votre chef de projet Flowly se connecte avec votre interlocuteur référent côté Brava, on fait un audit complet de l'existant ensemble. On regarde tableau par tableau Trello ce qui doit être migré tel quel, ce qui doit être archivé, ce qui doit être réorganisé." },
    { speaker: 'B', text: "OK. Et techniquement, comment vous récupérez les données ?" },
    { speaker: 'A', text: "Sur Trello c'est complètement automatique via leur API : on importe vos boards, vos listes, vos cartes, les commentaires, les pièces jointes, et l'historique des dates de modification. Zéro perte d'information, on récupère même les votes et les checklists. Sur Notion c'est moins direct parce que leur API est plus restrictive : on passe par un export Markdown que vous générez en deux clics, et on ré-importe en conservant la structure hiérarchique des pages. Les attachments — images, PDFs, vidéos — passent aussi." },
    { speaker: 'B', text: "Et les pages Notion avec des databases embarquées ? On a pas mal de tableaux de suivi imbriqués qui sont quand même la colonne vertébrale de notre process." },
    { speaker: 'A', text: "Très bonne question, c'est typiquement le piège des migrations Notion. Les databases Notion sont importées comme des tables Flowly, avec les colonnes et le contenu intacts. Le seul truc qu'on ne récupère pas, ce sont les relations cross-database très avancées de Notion : type \"rollups\" complexes qui agrègent des données entre plusieurs databases. Mais en général sur une utilisation d'agence, ces fonctionnalités sont marginales, et on les recrée à la main au moment de l'audit." },
    { speaker: 'B', text: "OK, ça je pourrai vérifier de notre côté, on a une ou deux databases liées mais c'est pas critique. Maintenant l'autre crainte que j'ai, c'est plus opérationnelle. Et si pendant la migration certains projets se perdent ou se déforment dans la conversion ? Comment je m'en rends compte avant qu'un client appelle pour gueuler ?" },
    { speaker: 'A', text: "C'est exactement pour ça qu'on fait la migration en parallèle, jamais en remplacement direct. Pendant 30 jours, Notion et Trello continuent à tourner intégralement chez vous, vous ne touchez à rien et vos équipes continuent leur quotidien dessus. On importe dans Flowly à côté, en silence, et vous validez tableau par tableau, projet par projet, sur des sessions de relecture avec votre chef de projet Flowly." },
    { speaker: 'B', text: "Donc je peux pendant 30 jours faire des allers-retours entre les deux outils si besoin sans rien casser ?" },
    { speaker: 'A', text: "Oui, exactement. Vos équipes peuvent même continuer à créer des cartes sur Trello pendant cette période de validation. À la fin des 30 jours, votre chef de projet Flowly fait un dernier audit avec vous, on synchronise les dernières modifications qui ont eu lieu sur Trello pendant la période — il y en a toujours — et c'est à ce moment-là seulement que vous décidez de basculer définitivement et de couper Trello et Notion." },
    { speaker: 'B', text: "D'accord. Ça me rassure beaucoup en fait, je m'attendais à ce que ce soit un \"on bascule un jour J et tant pis si ça plante\", c'est ce que j'ai vécu sur une migration outil dans une boîte précédente." },
    { speaker: 'A', text: "Non, ce serait honnêtement du suicide pour les deux parties. On préfère prendre 30 jours pour bien faire les choses plutôt que de gérer des pertes de données et des clients furieux pendant trois mois après. Maintenant il reste un dernier point sur lequel vous m'aviez questionné la dernière fois : la formation de l'équipe. Vous êtes 18 chez Brava au total, c'est ça ?" },
    { speaker: 'B', text: "18 oui, dont 14 sont quotidiennement sur Notion ou Trello." },
    { speaker: 'A', text: "Ce qu'on propose pour la formation, c'est deux sessions d'une heure en live sur Google Meet. Une session pour les chefs de projet et la direction sur les fonctionnalités avancées et le reporting, et une session pour les contributeurs sur la prise en main quotidienne. Et en complément, on a une bibliothèque de 25 micro-tutos vidéo de 2 à 3 minutes chacun, que les gens regardent à leur rythme dans l'app." },
    { speaker: 'B', text: "Et si quelqu'un a une question pratique pendant les premières semaines, ils contactent qui ?" },
    { speaker: 'A', text: "Le chef de projet Flowly migration reste disponible par Slack ou mail pendant toute la phase d'accompagnement, donc 5 jours étalés, tout est questionnable et il répond dans l'heure typiquement. Et après cette période, vous passez sur le support standard, accessible par chat dans l'app, avec un SLA de réponse de 4 heures ouvrées dans le pire cas." },
    { speaker: 'B', text: "4 heures c'est correct pour notre usage. Bon écoutez Camille, là vous m'avez rassuré sur tous les points que j'avais en tête. Sincèrement." },
    { speaker: 'A', text: "Merci Mehdi, c'est l'objectif. Donc concrètement, où en est-on côté contractuel ? Vous m'aviez dit la semaine dernière que vous attaqueriez la signature dès qu'on aurait levé ces points-là." },
    { speaker: 'B', text: "Oui, je suis prêt. Vous pouvez m'envoyer le contrat ?" },
    { speaker: 'A', text: "Avec grand plaisir. Je vous envoie un DocuSign dans l'heure, vous serez 18 utilisateurs à 89 euros, donc 1602 euros mensuels hors taxes. Engagement annuel pour bénéficier des 15% de remise, ce qui vous met à 1361 euros équivalent mensuel, payable en une fois en début d'année, comme convenu la semaine dernière." },
    { speaker: 'B', text: "Oui c'est exactement l'option qu'on avait validée. Allez-y, envoyez." },
    { speaker: 'A', text: "Parfait. Une fois la signature électronique reçue de votre côté, je vous mets en contact par mail avec Léa, votre chef de projet Flowly migration, qui prendra rendez-vous avec vous pour caler le kickoff. L'idée serait de démarrer la phase d'audit lundi prochain, est-ce que ça vous va comme timing ?" },
    { speaker: 'B', text: "Lundi c'est tout à fait bon. Je suis là toute la matinée." },
    { speaker: 'A', text: "Top. Léa vous proposera deux créneaux possibles sur lundi pour faire le kickoff. Vous lui dites celui qui vous arrange, et on cale." },
    { speaker: 'B', text: "OK super. Merci Camille, c'était vraiment bien mené tout cet échange. Je signe dans la journée, vous aurez ça avant 18h." },
    { speaker: 'A', text: "C'est moi qui vous remercie Mehdi, on est vraiment ravis de vous embarquer chez Brava. À très vite alors." },
    { speaker: 'B', text: "À très vite." },
  ],
})

// ---------------------------------------------------------------------------
// Lot de 5 contacts à intégrer dans HubSpot (matching par callee_number).
// Une PAIRE partage le même deal (Brio Studio) : Hugo (champion) puis Élise
// (DAF/budget) — utile pour tester le multi-contact sur une même affaire.
// Les 3 autres sont des deals distincts. Vendeur = Léa de Flowly (speaker A).
// ---------------------------------------------------------------------------

// 1/5 — Brio Studio · Hugo Marchand (Directeur des opérations, champion).
//        Deal « Brio Studio — refonte stack outils » (1er contact).
const BRIO_HUGO: MockTranscript = buildScenario({
  id: 'mock-7',
  title: 'Flowly · Brio Studio · Hugo (découverte, doit valider avec la DAF)',
  description:
    'Brio Studio (agence, 18 pers.) · fuite facturation ~30k€/an · forte découverte · doit boucler la DAF Élise · démo à 3 jeudi 11h. Même deal qu\'Élise.',
  caller_number: '+33600112233',
  callee_number: '+33611223344',
  turns: [
    { speaker: 'A', text: "Bonjour Hugo, Léa de Flowly. On avait calé 20 minutes aujourd'hui pour parler de votre organisation chez Brio Studio, c'est toujours bon pour vous ?" },
    { speaker: 'B', text: "Oui bonjour Léa, parfait, j'ai le créneau, allez-y." },
    { speaker: 'A', text: "Super. Avant de vous montrer quoi que ce soit, j'aimerais comprendre comment vous fonctionnez. Vous êtes combien dans l'équipe, et comment vous suivez les projets clients aujourd'hui ?" },
    { speaker: 'B', text: "On est 18 chez Brio Studio, une agence créative. Aujourd'hui on jongle entre Monday pour les tâches et un tableur Excel pour la facturation. C'est l'Excel qui nous pose problème, on perd un temps fou et surtout on oublie de facturer des prestations." },
    { speaker: 'A', text: "D'accord. Et ces oublis de facturation, si vous deviez les chiffrer, ça représente combien sur une année ?" },
    { speaker: 'B', text: "Franchement ? On a fait le calcul l'an dernier, on estime avoir oublié de facturer environ 30 000 euros sur l'année. Pour une boîte de notre taille c'est énorme." },
    { speaker: 'A', text: "C'est précisément le genre de fuite que Flowly stoppe : la facturation est native, rattachée à chaque tâche, donc rien ne passe à la trappe. Aujourd'hui, comment se fait le passage d'une tâche terminée à la facture ?" },
    { speaker: 'B', text: "C'est manuel. Un chef de projet doit penser à reporter dans l'Excel, et souvent il oublie ou il le fait trop tard." },
    { speaker: 'B', text: "Du coup une question concrète : combien de temps ça prend de migrer depuis Monday ? On a deux ans d'historique, je ne veux rien perdre." },
    { speaker: 'A', text: "Très bonne question. La reprise depuis Monday est automatique via leur API : tableaux, tâches, commentaires, historique des dates. On fait ça en général en deux jours, sans perte de données." },
    { speaker: 'B', text: "Ok, ça me rassure. Par contre je ne décide pas seul sur ce type d'outil : il faut que j'en parle à Élise, notre DAF, parce que c'est elle qui valide le budget." },
    { speaker: 'A', text: "Tout à fait, c'est important qu'elle soit dans la boucle dès maintenant. On cale une démo à trois la semaine prochaine, avec Élise ? Je préparerais un cas chiffré sur votre fuite de facturation." },
    { speaker: 'B', text: "Oui, très bien. Disons jeudi prochain à 11h, je l'invite de mon côté." },
    { speaker: 'A', text: "Parfait, jeudi 11h, je vous envoie l'invitation avec un ordre du jour clair. Merci Hugo, à jeudi." },
  ],
})

// 2/5 — Brio Studio · Élise Fontaine (DAF, décideuse budget).
//        MÊME deal que Hugo « Brio Studio — refonte stack outils ».
const BRIO_ELISE: MockTranscript = buildScenario({
  id: 'mock-8',
  title: 'Flowly · Brio Studio · Élise (DAF, budget & ROI)',
  description:
    'Brio Studio · DAF · focalisée chiffres · vraie objection (Monday+Zapier moins cher) traitée par fiabilité · pilote mesurable au 1er. MÊME deal qu\'Hugo.',
  caller_number: '+33600112233',
  callee_number: '+33611223355',
  turns: [
    { speaker: 'A', text: "Bonjour Élise, Léa de Flowly. Hugo m'a dit que c'est vous qui pilotez le budget outils chez Brio Studio. Merci de prendre le temps." },
    { speaker: 'B', text: "Bonjour Léa. Oui, Hugo m'a parlé de Flowly, il est plutôt emballé. Mais moi je regarde surtout les chiffres, donc soyons concrets." },
    { speaker: 'A', text: "Avec plaisir. Hugo m'a indiqué environ 30 000 euros de prestations oubliées à la facturation l'an dernier. Vous confirmez cet ordre de grandeur ?" },
    { speaker: 'B', text: "Oui, c'est même peut-être un peu sous-estimé. C'est ça qui m'intéresse, pas la liste des fonctionnalités." },
    { speaker: 'A', text: "Alors parlons-en. Flowly rattache la facturation à chaque tâche : dès qu'une prestation est livrée, elle est prête à être facturée. Sur 30 000 euros de fuite, même en n'en récupérant que la moitié, l'outil est rentabilisé plusieurs fois sur l'année." },
    { speaker: 'B', text: "Le calcul se tient. Mais soyons clairs : Monday avec un connecteur Zapier fait à peu près la même chose pour moins cher. Pourquoi je paierais plus chez vous ?" },
    { speaker: 'A', text: "Question légitime. La différence c'est que Zapier n'est pas temps réel et casse régulièrement : vous découvrez le bug le jour où vous facturez. Avec Flowly c'est natif, donc fiable à 100%. Sur de la facturation, la fiabilité n'est pas une option. Quel budget mensuel aviez-vous en tête ?" },
    { speaker: 'B', text: "On est prêts à mettre autour de 250 euros par mois si la valeur est vraiment au rendez-vous." },
    { speaker: 'A', text: "On est exactement dans cette fourchette pour 18 personnes. Je vous propose de démarrer par un mois pilote facturé, pour que vous mesuriez la récupération réelle sur vos prochaines factures. Si les chiffres sont là, on continue." },
    { speaker: 'B', text: "Ça me va, un pilote mesurable c'est exactement ce qu'il me faut. On peut démarrer début de mois prochain ?" },
    { speaker: 'A', text: "Parfait. Je cale le lancement au 1er, et je vous envoie le récap avec les indicateurs qu'on suivra ensemble. Je mets Hugo en copie." },
    { speaker: 'B', text: "Très bien, merci Léa, j'attends votre mail." },
  ],
})

// 3/5 — Vinea Distribution · Nadia Cherif (Directrice commerciale).
//        Deal « Vinea Distribution — outillage équipe » (price-sensitive).
const VINEA_NADIA: MockTranscript = buildScenario({
  id: 'mock-9',
  title: 'Flowly · Vinea Distribution · Nadia (price-sensitive)',
  description:
    'Vinea Distribution · prospect focalisée prix · objection « Trello est gratuit » · découverte écourtée · next step mou (plaquette, rappel dans 2 semaines).',
  caller_number: '+33600112233',
  callee_number: '+33622334455',
  turns: [
    { speaker: 'A', text: "Bonjour Nadia, Léa de Flowly. Vous aviez demandé des informations sur notre outil pour votre équipe commerciale chez Vinea, c'est bien ça ?" },
    { speaker: 'B', text: "Oui bonjour. Alors écoutez, surtout je voudrais savoir combien ça coûte, parce que je n'ai pas beaucoup de temps." },
    { speaker: 'A', text: "Bien sûr, j'y viens. Juste pour vous donner le bon tarif : vous seriez combien à l'utiliser ?" },
    { speaker: 'B', text: "On serait 10. Mais vraiment, le prix d'abord." },
    { speaker: 'A', text: "Pour 10 personnes on est à 150 euros par mois, tout compris." },
    { speaker: 'B', text: "Ah. C'est cher quand même. On a déjà Trello et c'est gratuit." },
    { speaker: 'A', text: "Je comprends. Trello est très bien pour des tâches simples, mais dès qu'on parle de facturation ou de suivi de rentabilité par client, il montre vite ses limites. La rentabilité par client, c'est un sujet pour vous ?" },
    { speaker: 'B', text: "Mouais, un peu, mais bon. Honnêtement à ce prix-là je ne sais pas. Envoyez-moi une plaquette, je regarderai avec mon associé et je reviens vers vous." },
    { speaker: 'A', text: "D'accord, je vous envoie une présentation. Je peux vous rappeler vendredi pour en discuter de vive voix ?" },
    { speaker: 'B', text: "On verra, rappelez plutôt dans deux semaines, là c'est très chargé." },
    { speaker: 'A', text: "Très bien, je note et je reviens vers vous dans deux semaines. Bonne journée Nadia." },
  ],
})

// 4/5 — Atelier Nord · Marc Dubreuil (Fondateur).
//        Deal « Atelier Nord — abonnement » (fin d'essai, closing).
const ATELIER_MARC: MockTranscript = buildScenario({
  id: 'mock-10',
  title: 'Flowly · Atelier Nord · Marc (fin d\'essai, closing signé)',
  description:
    'Atelier Nord · fin d\'essai très positive · buying signals forts (sièges au prorata, export des données) · interruption constructive · signature, démarrage lundi.',
  caller_number: '+33600112233',
  callee_number: '+33633445566',
  turns: [
    { speaker: 'A', text: "Bonjour Marc, Léa de Flowly. On se retrouve comme convenu après vos deux semaines d'essai. Alors, ce test ?" },
    { speaker: 'B', text: "Franchement Léa, très convaincu. L'équipe a adopté l'outil tout de suite, et la facturation native nous a déjà fait gagner un temps fou." },
    { speaker: 'A', text: "Ravie de l'entendre. Vous voyez des points bloquants avant qu'on aille plus loin ?" },
    { speaker: 'B', text: "Attendez, juste avant — comment ça se passe pour ajouter des utilisateurs en cours de mois ? On va recruter deux personnes en septembre." },
    { speaker: 'A', text: "Très simple : vous ajoutez un siège quand vous voulez, c'est facturé au prorata, sans engagement à l'année sur le nombre de sièges." },
    { speaker: 'B', text: "Parfait. Et au niveau des données, si un jour on veut partir, on récupère tout ?" },
    { speaker: 'A', text: "Oui, export complet à tout moment, vos données vous appartiennent, aucune rétention de notre côté." },
    { speaker: 'B', text: "Nickel. Bon, pour moi c'est oui. Comment on signe ?" },
    { speaker: 'A', text: "Excellent. Je vous envoie le bon de commande aujourd'hui pour 12 sièges. Vous le signez en ligne et je bascule votre compte d'essai en compte payant sans interruption." },
    { speaker: 'B', text: "Top. Je signe dès que je l'ai. On peut démarrer officiellement lundi ?" },
    { speaker: 'A', text: "Lundi c'est parfait. Je vous envoie tout ça d'ici une heure. Bienvenue chez Flowly, Marc." },
    { speaker: 'B', text: "Merci à vous, à lundi." },
  ],
})

// 5/5 — Helia Santé · Sophie Vasseur (Responsable des opérations).
//        Deal « Helia Santé — pilote » (prospect désengagé, fausse objection).
const HELIA_SOPHIE: MockTranscript = buildScenario({
  id: 'mock-11',
  title: 'Flowly · Helia Santé · Sophie (désengagée, fausse objection)',
  description:
    'Helia Santé · prospect peu engagée (réponses courtes) · fausse objection « pas le temps, on est en réorg » · aucun buying signal · next step flou « à la rentrée ».',
  caller_number: '+33600112233',
  callee_number: '+33644556677',
  turns: [
    { speaker: 'A', text: "Bonjour Sophie, Léa de Flowly. Je vous appelle suite à votre inscription à notre webinaire de la semaine dernière. Vous avez deux minutes ?" },
    { speaker: 'B', text: "Oui, deux minutes." },
    { speaker: 'A', text: "Super. Je voulais comprendre ce qui vous avait intéressée dans le webinaire — vous cherchez à mieux organiser vos projets chez Helia ?" },
    { speaker: 'B', text: "Oui, enfin, c'était surtout par curiosité." },
    { speaker: 'A', text: "D'accord. Aujourd'hui vous utilisez quoi pour suivre vos projets et les plannings d'équipe ?" },
    { speaker: 'B', text: "On a un peu de tout, des fichiers partagés surtout. Ça va à peu près." },
    { speaker: 'A', text: "Beaucoup d'équipes nous disent ça, puis se rendent compte qu'elles perdent des heures chaque semaine en recopie et en allers-retours. Est-ce que ça vous parle ?" },
    { speaker: 'B', text: "Peut-être, mais honnêtement on n'a pas le temps de changer d'outil en ce moment. On est en pleine réorganisation." },
    { speaker: 'A', text: "Je comprends. Justement, un outil comme le nôtre peut aider à clarifier les choses pendant une réorganisation. On prévoit un point quand ce sera plus calme ?" },
    { speaker: 'B', text: "Oui, peut-être à la rentrée. Envoyez-moi un mail, on verra à ce moment-là." },
    { speaker: 'A', text: "Très bien, je vous recontacte à la rentrée. Merci Sophie, bonne journée." },
    { speaker: 'B', text: "Merci, au revoir." },
  ],
})

// ---------------------------------------------------------------------------
// Trajectoire « deal qui décroche sur 3 appels » (J23)
// Prospect : Pauline Garnier, COO de Helios Studio. MÊME callee_number sur les
// 3 appels → ils se regroupent en un seul deal côté /dashboard/deals.
// L'engagement décline d'un appel à l'autre (c'est le but) :
//   1/3 chaud   : le prospect pose des questions d'implémentation, propose une
//                 date lui-même (next step ferme), signaux d'achat clairs.
//   2/3 tiède   : réponses plus courtes, « envoyez-moi des infos » (next step mou).
//   3/3 froid   : prospect quasi muet, objection « fausse » (désengagement poli),
//                 aucun next step.
// ⚠️ À simuler DANS L'ORDRE 1 → 2 → 3 pour que created_at soit croissant (le
// simulateur n'horodate pas dans le passé).
// ---------------------------------------------------------------------------
const HELIOS_CALLER = '+33600110011'
const HELIOS_CALLEE = '+33170000123'

const HELIOS_DECLINE_1: MockTranscript = buildScenario({
  id: 'mock-12',
  title: 'Helios · Décrochage 1/3 — découverte chaleureuse',
  description: 'Trajectoire deal (1/3) · prospect engagé · questions d\'implémentation · next step ferme proposé par le prospect.',
  caller_number: HELIOS_CALLER,
  callee_number: HELIOS_CALLEE,
  turns: [
    { speaker: 'A', text: "Bonjour Pauline, Camille de Flowly. Merci d'avoir bloqué ce créneau. Avant de vous montrer quoi que ce soit, j'aimerais comprendre comment vous pilotez vos équipes aujourd'hui. Vous êtes combien chez Helios Studio ?" },
    { speaker: 'B', text: "Bonjour Camille. On est une trentaine, dont une équipe commerciale de huit personnes. C'est justement là que ça coince : je n'ai aucune visibilité sur la qualité de leurs appels, et on recrute deux juniors le mois prochain." },
    { speaker: 'A', text: "Je comprends. Et concrètement, qu'est-ce qui vous ferait dire dans trois mois que vous avez réglé le problème ?" },
    { speaker: 'B', text: "Si je pouvais voir en un coup d'œil quels commerciaux décrochent et sur quoi, sans devoir réécouter des heures d'appels. Aujourd'hui je fais ça au feeling et c'est intenable. Comment ça se passe concrètement le déploiement chez vous ? C'est long à mettre en place ?" },
    { speaker: 'A', text: "Très bonne question. On se branche sur votre téléphonie, et dès le lendemain vos appels sont analysés automatiquement. Aucune installation côté commerciaux." },
    { speaker: 'B', text: "D'accord, et ça s'intègre avec notre CRM ? Parce que mes commerciaux vivent dedans, s'il faut qu'ils aillent ailleurs ils ne le feront pas." },
    { speaker: 'A', text: "Oui, tout remonte dans la fiche du contact. Vos commerciaux ne changent rien à leurs habitudes." },
    { speaker: 'B', text: "C'est exactement ce qu'il me faut. Écoutez, je veux avancer. On peut se caler une démo avec mon responsable commercial mardi prochain à 14h ? Je le préviens dès aujourd'hui." },
    { speaker: 'A', text: "Parfait, je bloque mardi 14h et je vous envoie l'invitation. Merci Pauline, à mardi." },
    { speaker: 'B', text: "Très bien, à mardi, j'ai hâte." },
  ],
})

const HELIOS_DECLINE_2: MockTranscript = buildScenario({
  id: 'mock-13',
  title: 'Helios · Décrochage 2/3 — refroidissement',
  description: 'Trajectoire deal (2/3) · réponses plus courtes · moins de questions · next step mou (« envoyez-moi des infos »).',
  caller_number: HELIOS_CALLER,
  callee_number: HELIOS_CALLEE,
  turns: [
    { speaker: 'A', text: "Bonjour Pauline, Camille de Flowly, comme convenu après la démo de mardi. Vous avez pu en discuter avec votre responsable commercial ?" },
    { speaker: 'B', text: "Bonjour. Oui, vite fait. C'était bien dans l'ensemble." },
    { speaker: 'A', text: "Content que ça vous ait plu. Qu'est-ce qui vous a le plus parlé de votre côté ?" },
    { speaker: 'B', text: "Le scoring des appels, je pense. Après il faut voir." },
    { speaker: 'A', text: "Bien sûr. Sur le déploiement et l'intégration au CRM, vous aviez des points à clarifier ?" },
    { speaker: 'B', text: "Non, ça avait l'air clair." },
    { speaker: 'A', text: "Parfait. Pour avancer, je vous propose qu'on cale un point de décision la semaine prochaine avec les chiffres pour votre équipe. Jeudi à 11h ?" },
    { speaker: 'B', text: "Écoutez, là c'est compliqué de m'engager sur une date. Envoyez-moi plutôt un récapitulatif par mail avec les tarifs, je regarderai ça au calme." },
    { speaker: 'A', text: "Pas de souci, je vous prépare ça aujourd'hui. Je me permettrai de revenir vers vous en fin de semaine prochaine pour avoir votre retour." },
    { speaker: 'B', text: "Oui, voilà, c'est ça. Merci." },
  ],
})

const HELIOS_DECLINE_3: MockTranscript = buildScenario({
  id: 'mock-14',
  title: 'Helios · Décrochage 3/3 — prospect qui ghoste',
  description: 'Trajectoire deal (3/3) · prospect quasi muet · objection « fausse » (désengagement poli) · aucun next step.',
  caller_number: HELIOS_CALLER,
  callee_number: HELIOS_CALLEE,
  turns: [
    { speaker: 'A', text: "Bonjour Pauline, c'est Camille de Flowly. Je me permets de revenir vers vous suite au récapitulatif que je vous ai envoyé la semaine dernière. Vous avez pu y jeter un œil ?" },
    { speaker: 'B', text: "Ah oui, bonjour. Euh, rapidement, oui." },
    { speaker: 'A', text: "Super. Est-ce que les tarifs correspondaient à ce que vous aviez en tête, et est-ce qu'il y a des points sur lesquels je peux vous aider à avancer en interne ?" },
    { speaker: 'B', text: "Honnêtement il faut que j'en rediscute avec la direction, là on a d'autres priorités en ce moment." },
    { speaker: 'A', text: "Je comprends tout à fait. Souvent dans ces cas-là, ce qui aide c'est de chiffrer le coût de ne rien faire — sur vos deux recrutements à venir notamment. Est-ce qu'on prend vingt minutes pour le poser ensemble ?" },
    { speaker: 'B', text: "C'est gentil mais ce n'est pas le bon moment. Je reviens vers vous." },
    { speaker: 'A', text: "Bien sûr. Pour que je ne vous relance pas dans le vide, vous voyez ça plutôt à quelle échéance ?" },
    { speaker: 'B', text: "Je ne sais pas trop, je vous recontacte. Merci, bonne journée." },
  ],
})

// ---------------------------------------------------------------------------
// DÉMO 08/06 — 3 appels, 3 contacts, 2 deals (croisement des infos)
// ---------------------------------------------------------------------------
// Deal A « Acme Corp » (deal_id partagé) : DEUX contacts → un seul deal sur
// /dashboard/deals (multi-threading : un champion + le décideur financier).
//   - mock-15 : Camille Roux (Head of Sales, championne)
//   - mock-16 : Thomas Vidal (DAF, décideur) — MÊME deal_id que mock-15
// Deal B « Lumen Studio » : un contact, un autre deal.
//   - mock-17 : Sarah Benali (fondatrice)
// À jouer en live ; les titres commencent par « Démo 08/06 ».
// ---------------------------------------------------------------------------
const DEMO_CALLER = '+33600220022'
const DEMO_ACME_DEAL_ID = 'demo-acme-0806'
const DEMO_LUMEN_DEAL_ID = 'demo-lumen-0806'

const DEMO_ACME_CAMILLE: MockTranscript = buildScenario({
  id: 'mock-15',
  title: 'Démo 08/06 · Acme Corp — Camille Roux (championne)',
  description: 'Deal Acme (1/2) · Head of Sales · découverte engagée · propose une démo avec le DAF.',
  caller_number: DEMO_CALLER,
  callee_number: '+33180000201',
  contact_name: 'Camille Roux',
  company_name: 'Acme Corp',
  deal_name: 'Acme Corp — Déploiement Q3',
  deal_id: DEMO_ACME_DEAL_ID,
  turns: [
    { speaker: 'A', text: "Bonjour Camille, Camille de Flowly également ! Merci pour le créneau. Avant de vous montrer l'outil, j'aimerais comprendre comment votre équipe commerciale fonctionne aujourd'hui chez Acme. Vous êtes combien ?" },
    { speaker: 'B', text: "Bonjour ! Oui avec plaisir. On est quinze commerciaux répartis sur deux sites. Mon vrai sujet, c'est que je n'ai aucune visibilité homogène sur la qualité des appels d'une équipe à l'autre." },
    { speaker: 'A', text: "Et qu'est-ce qui vous ferait dire dans trois mois que c'est réglé ?" },
    { speaker: 'B', text: "Pouvoir comparer objectivement les deux sites et repérer qui a besoin de coaching, sans réécouter des heures. Aujourd'hui je le fais au feeling, et ça crée des tensions managériales." },
    { speaker: 'A', text: "Très clair. L'outil analyse 100 % des appels automatiquement et remonte les signaux par commercial et par équipe. Concrètement vous verriez le différentiel entre vos deux sites dès la première semaine." },
    { speaker: 'B', text: "Ça c'est exactement ce qu'il me faut. Par contre la décision budget ne passe pas que par moi, il faut que notre DAF, Thomas Vidal, valide. Comment on fait ?" },
    { speaker: 'A', text: "Parfait, c'est même mieux de l'embarquer tôt. Je vous propose une démo à trois la semaine prochaine, je prépare un mini-business case chiffré pour lui. Vous avez une dispo mardi ou jeudi ?" },
    { speaker: 'B', text: "Jeudi 11h ça marche. Je préviens Thomas et je vous mets en copie tous les deux." },
    { speaker: 'A', text: "Excellent, je bloque jeudi 11h et je vous envoie l'invitation avec le business case. Merci Camille !" },
    { speaker: 'B', text: "Merci à vous, à jeudi." },
  ],
})

const DEMO_ACME_THOMAS: MockTranscript = buildScenario({
  id: 'mock-16',
  title: 'Démo 08/06 · Acme Corp — Thomas Vidal (DAF, même deal)',
  description: 'Deal Acme (2/2) · décideur financier · creuse le ROI · valide le budget, propose une date de signature.',
  caller_number: DEMO_CALLER,
  callee_number: '+33180000202',
  contact_name: 'Thomas Vidal',
  company_name: 'Acme Corp',
  deal_name: 'Acme Corp — Déploiement Q3',
  deal_id: DEMO_ACME_DEAL_ID,
  turns: [
    { speaker: 'A', text: "Bonjour Thomas, merci de prendre le temps après la démo de jeudi. Camille m'a dit que vous vouliez creuser le retour sur investissement, c'est exactement ce que je veux qu'on regarde ensemble." },
    { speaker: 'B', text: "Bonjour. Oui, la démo était convaincante côté usage. Moi ce qui m'intéresse c'est le chiffre : qu'est-ce que ça nous rapporte concrètement ?" },
    { speaker: 'A', text: "Sur vos quinze commerciaux, en réduisant ne serait-ce que de 10 % les cycles de vente grâce au coaching ciblé, on est sur plusieurs dizaines de milliers d'euros par trimestre. Vous estimez votre cycle moyen à combien aujourd'hui ?" },
    { speaker: 'B', text: "Autour de soixante jours. Si on gagne dix jours dessus de façon fiable, le calcul est vite vu, c'est rentable dès le premier trimestre." },
    { speaker: 'A', text: "C'est exactement ça. Et le coût de l'abonnement est très inférieur à ce gain. Est-ce qu'il reste un point qui vous bloque pour avancer ?" },
    { speaker: 'B', text: "Non, le budget est validable de mon côté. Il me faut juste le contrat avec un engagement clair sur l'hébergement des données en Europe." },
    { speaker: 'A', text: "Tout est hébergé en Europe, je vous mets la clause noir sur blanc dans le contrat. On vise une signature pour quelle date ?" },
    { speaker: 'B', text: "Envoyez-moi le contrat cette semaine, je le signe avant la fin du mois. Disons le 27." },
    { speaker: 'A', text: "Parfait, je vous envoie le contrat aujourd'hui et je note la signature au 27. Merci Thomas, ravi qu'on avance ensemble." },
    { speaker: 'B', text: "Merci à vous, bonne journée." },
  ],
})

const DEMO_LUMEN_SARAH: MockTranscript = buildScenario({
  id: 'mock-17',
  title: 'Démo 08/06 · Lumen Studio — Sarah Benali (autre deal)',
  description: 'Deal Lumen · fondatrice · petite équipe · découverte + essai gratuit lancé.',
  caller_number: DEMO_CALLER,
  callee_number: '+33180000203',
  contact_name: 'Sarah Benali',
  company_name: 'Lumen Studio',
  deal_name: 'Lumen Studio — Pilote',
  deal_id: DEMO_LUMEN_DEAL_ID,
  turns: [
    { speaker: 'A', text: "Bonjour Sarah, Camille de Flowly. Vous m'aviez contactée via le site, vous cherchez à structurer vos appels commerciaux chez Lumen Studio, c'est ça ?" },
    { speaker: 'B', text: "Bonjour, oui exactement. On est une petite équipe de quatre, on grandit vite et je veux poser de bonnes bases avant de recruter." },
    { speaker: 'A', text: "Très sain comme réflexe. Aujourd'hui, comment vous formez les nouveaux sur la partie appel ?" },
    { speaker: 'B', text: "Honnêtement, sur le tas. C'est moi qui montre, mais je n'ai pas le temps de tout suivre. J'aimerais un outil qui objective ce qui marche dans nos appels." },
    { speaker: 'A', text: "C'est pile l'usage. L'outil analyse chaque appel et fait ressortir les bonnes pratiques de votre meilleur closer pour que les nouveaux s'en inspirent. Vous voulez tester sur vos vrais appels ?" },
    { speaker: 'B', text: "Oui carrément. C'est quoi les conditions pour essayer ?" },
    { speaker: 'A', text: "Essai gratuit quatorze jours, sans engagement, je vous envoie le lien d'inscription tout de suite. On fait un point jeudi prochain pour regarder vos premiers résultats ensemble ?" },
    { speaker: 'B', text: "Parfait, j'attends le lien et on dit jeudi prochain." },
    { speaker: 'A', text: "Top, lien envoyé dans la foulée. Merci Sarah, à jeudi !" },
    { speaker: 'B', text: "Merci, à jeudi." },
  ],
})

export const MOCK_TRANSCRIPTS: MockTranscript[] = [
  {
    id: 'mock-1',
    title: 'Appel avec objection prix — PME logistique',
    description: 'Aloalo vs TransLog · objection budget gérée par discovery ROI · closing par démo planifiée mardi 10h.',
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
    description: 'Cold call sans découverte · pitch générique · prospect sur Teams · closing négatif sec.',
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
    description: 'Inbound LinkedIn · discovery quantifiée 60-80K€/an · pitch tarif aligné · essai gratuit démarré.',
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
  },
  FLOWLY_SCENARIO_A,
  FLOWLY_SCENARIO_B,
  FLOWLY_SCENARIO_C,
  BRIO_HUGO,
  BRIO_ELISE,
  VINEA_NADIA,
  ATELIER_MARC,
  HELIA_SOPHIE,
  HELIOS_DECLINE_1,
  HELIOS_DECLINE_2,
  HELIOS_DECLINE_3,
  DEMO_ACME_CAMILLE,
  DEMO_ACME_THOMAS,
  DEMO_LUMEN_SARAH,
]
