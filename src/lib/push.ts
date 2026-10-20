import { Platform } from 'react-native';

import { api } from './api';

/**
 * Notifications push du navigateur (version web) : le serveur les envoie à l'heure du rappel,
 * même quand me est fermée. Sur iPhone, seulement pour l'app ajoutée à l'écran d'accueil (iOS 16.4+).
 */
export type EtatPush = 'indisponible' | 'a_installer' | 'refuse' | 'inactif' | 'actif';

const web = Platform.OS === 'web' && typeof window !== 'undefined';
const supporte = () => web && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iosNonInstalle = () =>
  web && /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone);

/** Enregistre le service worker au démarrage : il affiche les push et ouvre l'app au clic. */
export function enregistrerServiceWorker() {
  if (!web || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

async function abonnementActuel() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function etatPush(): Promise<EtatPush> {
  if (!supporte()) return iosNonInstalle() ? 'a_installer' : 'indisponible';
  if (Notification.permission === 'denied') return 'refuse';
  return (await abonnementActuel().catch(() => null)) ? 'actif' : 'inactif';
}

// La clé VAPID arrive en base64url ; le navigateur la veut en octets.
function octets(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const nomAppareil = () => {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Navigateur';
  return `${os} · ${/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''}`.replace(/ · $/, '');
};

/** Demande l'autorisation puis abonne ce navigateur. À appeler depuis un appui (exigé par Safari). */
export async function activerPush(token: string) {
  if (!supporte()) throw new Error(iosNonInstalle() ? "Ajoute d'abord me à l'écran d'accueil (Partager > Sur l'écran d'accueil), puis ouvre-la depuis son icône." : 'Ce navigateur ne gère pas les notifications push.');
  const { cle } = await api<{ cle: string | null }>('/notifications/push', { token });
  if (!cle) throw new Error("Les notifications push ne sont pas encore configurées sur le serveur (clés VAPID).");
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications refusées. Autorise-les dans les réglages du navigateur pour ce site.');
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const abo = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(cle) }));
  const json = abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api('/notifications/push', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys, appareil: nomAppareil() }, token });
}

export async function couperPush(token: string) {
  if (!supporte()) return;
  const abo = await abonnementActuel();
  if (!abo) return;
  await api('/notifications/push', { method: 'DELETE', body: { endpoint: abo.endpoint }, token }).catch(() => {});
  await abo.unsubscribe();
}
