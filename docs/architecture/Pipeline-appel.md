↑ [[Carte-globale]]

# 🤖 Le voyage d'un appel (pipeline)

De la fin d'un appel téléphonique jusqu'aux conseils affichés. Chaque étape change
le **statut** de l'appel dans la table [[Base-calls|calls]] :
`pending → transcribing → transcribed → analyzing → analyzed` (ou `failed`).

```mermaid
flowchart TD
    A["📞 Ringover<br/>l'appel se termine"] -->|"call.ended<br/>(signature HMAC vérifiée)"| B["/api/webhooks/ringover"]
    B -->|"crée la ligne<br/>statut = pending"| C[("calls")]
    B -->|"récupère l'URL audio<br/>via l'API Ringover"| B
    B -.->|"déclenche en arrière-plan"| D["/api/transcribe"]

    D -->|"statut = transcribing"| C
    D -->|"envoie l'audio (https + hôte autorisé)"| E["🎧 AssemblyAI"]
    E -->|"quand c'est prêt"| F["/api/webhooks/assemblyai"]
    F -->|"texte + diarisation<br/>statut = transcribed<br/>audio_url = null (RGPD)"| C
    F -.->|"déclenche"| G["/api/analyze"]

    G -->|"paywall : quota OK ?"| G
    G -->|"statut = analyzing (claim atomique)"| C
    G -->|"transcript + profil IA"| H["🧠 Claude Haiku 4.5"]
    H -->|"scores + forts/faibles<br/>+ conseils + tâches"| I[("analyses")]
    G -->|"statut = analyzed"| C
    G -->|"coût tokens"| J[("usage_logs")]
    G -.->|"si HubSpot connecté"| K["🔗 HubSpot<br/>note + tâches datées"]

    I --> L["🖥️ Dashboard<br/>scores & coaching"]

    click C "Base-calls" "Table calls"
    click I "Base-analyses" "Table analyses"
    click J "Base-usage_logs" "Table usage_logs"
    click K "Securite" "Secrets & gardes"
```

### 🔎 Zoomer

- Table [[Base-calls|calls]] (le statut, le transcript) · Table [[Base-analyses|analyses]] (les scores)
- Table [[Base-usage_logs|usage_logs]] (les coûts) · [[Securite|Sécurité & secrets du pipeline]]

---

## Les garde-fous importants (anti-doublon, anti-fuite)

| Garde-fou | Où | Pourquoi |
|---|---|---|
| **Signature HMAC** | webhook Ringover | Refuse tout appel non signé (`fail-closed`). |
| **Secret interne** `x-aloalo-internal` | `/api/transcribe`, `/api/analyze` | Ces routes écrivent en bypass RLS → appelées **que** par nos webhooks. |
| **Allowlist d'hôtes audio** | `/api/transcribe` | AssemblyAI ne fetch qu'un hôte autorisé (anti-SSRF). |
| **Secret webhook AssemblyAI** | webhook AssemblyAI | On vérifie qu'AssemblyAI nous renvoie bien notre secret. |
| **Idempotence (upsert)** | webhook Ringover | Un même `call.ended` rejoué ne crée pas de doublon ni de transcription payante. |
| **Claim atomique** | transcribe & analyze | `update ... where status = X` : la 1ʳᵉ invocation gagne, les doublons s'arrêtent. |
| **Paywall** | `/api/analyze` | On bloque **avant** d'appeler Claude si le quota du plan est atteint. |
| **Purge audio** | webhook AssemblyAI | `audio_url = null` après transcription : on ne garde que le texte (RGPD). |

## Mode simulation (démo / dev)

En dev (et preview Vercel), `/dev/test` injecte un faux transcript : le pipeline
**saute AssemblyAI** (coût 0) et passe direct de `pending` → `transcribed` → analyse.
Désactivé en production (sauf `ALLOW_DEV_SIMULATE=1` pour une démo ponctuelle).
Détail des secrets : [[Securite]].
