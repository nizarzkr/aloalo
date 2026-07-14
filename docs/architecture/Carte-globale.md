# 🗺️ Carte globale — Aloalo

Vue d'ensemble du système. **Clique une boîte** pour zoomer (ou utilise la liste sous le schéma).

```mermaid
flowchart TD
    subgraph TEL["📞 Téléphonie"]
        RO["Ringover"]
    end

    subgraph PIPE["🤖 Pipeline IA"]
        WHRO["webhook Ringover<br/>/api/webhooks/ringover"]
        TR["transcribe<br/>/api/transcribe"]
        AAI["AssemblyAI<br/>(transcription)"]
        WHAAI["webhook AssemblyAI<br/>/api/webhooks/assemblyai"]
        AN["analyze<br/>/api/analyze"]
        CL["Claude Haiku 4.5<br/>(analyse)"]
    end

    subgraph DB["🗄️ Base de données — Supabase"]
        T_CALLS["calls"]
        T_ANALYSES["analyses"]
        T_USAGE["usage_logs"]
        T_ORG["organizations"]
        T_PROF["profiles"]
        T_INV["invitations"]
    end

    subgraph EXT["🔗 Services externes"]
        HS["HubSpot (CRM)"]
        STR["Stripe (paiement)"]
    end

    subgraph UI["🖥️ Interface"]
        DASH["Dashboard<br/>/dashboard"]
    end

    RO -->|"call.ended — signé HMAC"| WHRO
    WHRO -->|"insert (pending)"| T_CALLS
    WHRO -.->|"déclenche"| TR
    TR -->|"envoie l'audio"| AAI
    AAI -->|"transcription finie"| WHAAI
    WHAAI -->|"texte + statut transcribed"| T_CALLS
    WHAAI -.->|"déclenche"| AN
    AN -->|"transcript"| CL
    CL -->|"scores + conseils"| T_ANALYSES
    AN -->|"note + tâches datées"| HS
    TR -->|"coût estimé"| T_USAGE
    AN -->|"coût réel"| T_USAGE
    T_ANALYSES --> DASH
    T_CALLS --> DASH
    STR -->|"abonnement / plan"| T_ORG
    T_PROF -.->|"appartient à"| T_ORG
    T_INV -.->|"rejoindre une org"| T_PROF

    click T_CALLS "Base-calls" "Détail : table calls"
    click T_ANALYSES "Base-analyses" "Détail : table analyses"
    click T_USAGE "Base-usage_logs" "Détail : table usage_logs"
    click T_ORG "Base-organizations" "Détail : table organizations"
    click T_PROF "Base-profiles" "Détail : table profiles"
    click T_INV "Base-invitations" "Détail : table invitations"
    click WHRO "Pipeline-appel" "Le voyage d'un appel"
    click TR "Pipeline-appel" "Le voyage d'un appel"
    click WHAAI "Pipeline-appel" "Le voyage d'un appel"
    click AN "Pipeline-appel" "Le voyage d'un appel"
```

### 🔎 Zoomer (liste de secours si le clic-boîte ne marche pas)

- **Le voyage d'un appel** → [[Pipeline-appel]]
- **Sécurité & secrets** → [[Securite]]
- Bases : [[Base-calls]] · [[Base-analyses]] · [[Base-organizations]] · [[Base-profiles]] · [[Base-usage_logs]] · [[Base-invitations]]

---

## Comment lire ce schéma

- **Flèche pleine `→`** = une donnée est écrite/transmise.
- **Flèche pointillée `-.->`** = un déclenchement (une étape en lance une autre).
- Un **appel** entre par Ringover, traverse le **pipeline IA** (transcription puis
  analyse), et ressort en **scores + conseils** affichés sur le dashboard et poussés
  dans HubSpot. Chaque étape payante est tracée dans `usage_logs`.

## Relations entre les bases (vue rapide)

```mermaid
erDiagram
    organizations ||--o{ profiles    : "a des membres"
    organizations ||--o{ calls       : "possède"
    organizations ||--o{ usage_logs  : "facture"
    organizations ||--o{ invitations : "émet"
    calls         ||--|| analyses    : "1 analyse / appel"
    calls         ||--o{ usage_logs  : "génère des coûts"
    profiles      ||--o{ calls        : "est le commercial"
```

*Chaque table : voir sa note dédiée pour le détail des colonnes.*
