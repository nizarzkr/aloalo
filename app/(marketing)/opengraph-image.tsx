// ============================================================================
// Image de partage (Open Graph / X) de la page d'accueil
// ============================================================================
// Générée à la construction par next/og. Reprend la DA : canvas gris, titre
// condensé noir, un seul surlignage menthe.
//
// La police Barlow Condensed est récupérée chez Google Fonts au build ; si le
// réseau n'est pas disponible, on retombe sur la police par défaut plutôt que
// de faire échouer la construction pour une image.
// ============================================================================

import { ImageResponse } from "next/og";

export const alt =
  "Aloalo — Vos appels commerciaux se notent tout seuls";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadBarlowCondensed(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700",
      // User-Agent « ancien » : Google renvoie alors du woff (lisible par
      // satori) plutôt que du woff2, qu'il ne sait pas décompresser.
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64)" } },
    ).then((r) => r.text());

    const url = css.match(/src: url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const barlow = await loadBarlowCondensed();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#e5e7eb",
          padding: 72,
          fontFamily: barlow ? "Barlow Condensed" : "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: -0.6,
            color: "#6b6b6b",
          }}
        >
          ALOALO · CONVERSATION INTELLIGENCE
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 104,
            lineHeight: 1,
            letterSpacing: -3,
            color: "#000000",
          }}
        >
          <span>Vos appels commerciaux</span>
          <span
            style={{
              display: "flex",
              alignSelf: "flex-start",
              backgroundColor: "#d1ffca",
              padding: "4px 10px",
              marginTop: 8,
            }}
          >
            se notent tout seuls.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: -0.6,
            color: "#000000",
          }}
        >
          Ringover · Aircall · Google Meet · HubSpot · Pipedrive — hébergé en
          Europe
        </div>
      </div>
    ),
    {
      ...size,
      fonts: barlow
        ? [{ name: "Barlow Condensed", data: barlow, weight: 700, style: "normal" }]
        : undefined,
    },
  );
}
