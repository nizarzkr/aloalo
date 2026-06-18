// ============================================================================
// Test unitaire — normalisation des entrées de transcription Meet (J43).
// Comment lancer : npm test
// Fige la fonction PURE normalizeMeetEntries : tri, horodatages relatifs au
// début (ms), texte assemblé « Nom: phrase », durée, startedAt — sans I/O.
// ============================================================================

import { describe, it, expect } from "vitest";

import { normalizeMeetEntries } from "@/lib/google-meet";

// Résolveur de noms factice (en prod : participants.get).
const names: Record<string, string> = {
  "conferenceRecords/c1/participants/p1": "Nizar",
  "conferenceRecords/c1/participants/p2": "Julie",
};
const nameOf = (p: string | undefined) => (p ? names[p] ?? "Participant" : "Participant");

describe("normalizeMeetEntries", () => {
  it("trie, met les temps en relatif (ms) et assemble le texte", () => {
    const result = normalizeMeetEntries(
      [
        {
          name: "e2",
          participant: "conferenceRecords/c1/participants/p2",
          text: "Bonjour à vous",
          startTime: "2026-06-18T10:00:10Z",
          endTime: "2026-06-18T10:00:13Z",
        },
        {
          name: "e1",
          participant: "conferenceRecords/c1/participants/p1",
          text: "Bonjour Julie",
          startTime: "2026-06-18T10:00:00Z",
          endTime: "2026-06-18T10:00:04Z",
        },
      ],
      nameOf,
    );

    // Trié par startTime : Nizar (origine) puis Julie.
    expect(result.segments.map((s) => s.speaker)).toEqual(["Nizar", "Julie"]);
    // 1er segment à l'origine (0 ms).
    expect(result.segments[0].start).toBe(0);
    expect(result.segments[0].end).toBe(4000);
    // 2e segment : +10 s après l'origine.
    expect(result.segments[1].start).toBe(10000);
    expect(result.segments[1].end).toBe(13000);
    // Texte assemblé dans l'ordre, préfixé du nom.
    expect(result.text).toBe("Nizar: Bonjour Julie\nJulie: Bonjour à vous");
    // Durée = du début à la dernière fin = 13 s.
    expect(result.durationSeconds).toBe(13);
    expect(result.startedAt).toBe("2026-06-18T10:00:00Z");
  });

  it("liste vide → résultat vide neutre", () => {
    const result = normalizeMeetEntries([], nameOf);
    expect(result.segments).toEqual([]);
    expect(result.text).toBe("");
    expect(result.durationSeconds).toBe(0);
    expect(result.startedAt).toBeNull();
  });

  it("participant inconnu → libellé de repli", () => {
    const result = normalizeMeetEntries(
      [
        {
          name: "e1",
          participant: "conferenceRecords/c1/participants/unknown",
          text: "Heu",
          startTime: "2026-06-18T10:00:00Z",
          endTime: "2026-06-18T10:00:01Z",
        },
      ],
      nameOf,
    );
    expect(result.segments[0].speaker).toBe("Participant");
  });
});
