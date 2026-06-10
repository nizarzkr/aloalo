// Le simulateur d'appels est un outil DEV : actif en local et sur les preview
// Vercel, désactivé en production. VERCEL_ENV vaut 'production' uniquement sur
// le déploiement de prod (undefined en local). Flag d'échappement optionnel
// pour une démo ponctuelle en prod : ALLOW_DEV_SIMULATE=1.
export function isSimulatorEnabled(): boolean {
  if (process.env.ALLOW_DEV_SIMULATE === "1") return true;
  return process.env.VERCEL_ENV !== "production";
}
