import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { Filtre } from '@/components/onglets';
import { Pliable } from '@/components/pliable';
import { LignesSquelette, ZoneSquelette } from '@/components/squelettes';
import { Btn, Dialogue, Empty, Header, Input, Panel, Screen, Seg, Sep, T, Tag } from '@/components/ui';
import { fmtPrix } from '@/lib/abonnement';
import { api } from '@/lib/api';
import { detailOffre, DUREES_ADMIN, estAbonne, FILTRES, JOURS_ESSAI_ADMIN, libelleAction, nomOffreMembre, OFFRES_ADMIN, STATUTS_PAIEMENT, type FicheMembre, type FiltreMembres, type LigneMembre, type ReponseGestion, type Revenus } from '@/lib/gestion-membres';
import { useStore } from '@/lib/store';
import { C, F, ombre } from '@/lib/theme';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const couleurOffre = (l: Pick<LigneMembre, 'offre'>) => ({ pro: C.accent, finances: C.normal, essai: C.hebdo, gratuit: C.muted, libre: C.coach })[l.offre];

function Chiffre({ titre, valeur, detail, couleur }: { titre: string; valeur: string; detail?: string; couleur?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '22%', minWidth: 140, gap: 2, padding: 14, borderRadius: 14, backgroundColor: C.surface, ...ombre(), borderWidth: 1, borderColor: C.line }}>
      <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>
        {titre}
      </Text>
      <Text numberOfLines={1} style={{ color: couleur ?? C.ink, fontFamily: F.chiffre, fontSize: 24 }}>
        {valeur}
      </Text>
      {detail ? (
        <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Les revenus par devise : on n'additionne pas des dollars et des francs. */
const texteRevenus = (r: Revenus, champ: 'mois' | 'total') => Object.entries(r).map(([d, v]) => fmtPrix(v[champ], d)).join(' · ') || '0';

function LigneCompte({ l, onOuvrir }: { l: LigneMembre; onOuvrir: () => void }) {
  const detail = detailOffre(l);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${l.nom || l.email}, ${nomOffreMembre(l)}. Ouvrir la fiche`} onPress={onOuvrir} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>
          {l.nom || l.email}
          {l.role === 'ADMIN' ? ' · admin' : ''}
        </Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
          {l.nom ? l.email : `Inscrit le ${dateFr(l.creeLe)}`}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <View style={{ flexDirection: 'row' }}>
          <Tag label={nomOffreMembre(l)} color={couleurOffre(l)} />
        </View>
        {detail ? (
          <Text numberOfLines={1} style={{ color: l.joursRestants !== null && l.joursRestants <= 7 ? C.hebdo : C.muted, fontFamily: F.texte, fontSize: 12 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
    </Pressable>
  );
}

/** La fiche d'un compte : son offre, ce qu'on peut y changer, ses paiements et l'historique. Jamais le contenu de son espace. */
function Fiche({ id, onFermer, onChange }: { id: string; onFermer: () => void; onChange: () => void }) {
  const { session, profil, changerRole } = useStore();
  const token = session?.token;
  const [fiche, setFiche] = useState<FicheMembre | null>(null);
  const [offre, setOffre] = useState('pro');
  const [mois, setMois] = useState('1');
  const [jours, setJours] = useState('14');
  const [note, setNote] = useState('');
  const [confirmer, setConfirmer] = useState<'retirer' | 'supprimer' | null>(null);
  const [emailSaisi, setEmailSaisi] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let fini = false;
    api<FicheMembre>(`/membres/${id}/fiche`, { token, discret: true })
      .then((r) => !fini && setFiche(r))
      .catch((e: Error) => !fini && setErreur(e.message));
    return () => {
      fini = true;
    };
  }, [id, token]);

  const agir = async (corps: Record<string, unknown>, succes: string) => {
    setBusy(true);
    setErreur('');
    setMsg('');
    try {
      setFiche(await api<FicheMembre>(`/membres/${id}/abonnement`, { method: 'POST', token, body: { ...corps, ...(note.trim() ? { note: note.trim() } : {}) } }));
      setMsg(succes);
      setNote('');
      setConfirmer(null);
      onChange();
    } catch (e) {
      setErreur((e as Error).message);
    }
    setBusy(false);
  };

  const m = fiche?.membre;
  const choix = OFFRES_ADMIN.find((o) => o.key === offre)!;
  const moi = m?.id === profil?.id;
  const titre = m ? m.nom || m.email : 'Compte';

  const changerLeRole = async () => {
    if (!m) return;
    setBusy(true);
    setErreur('');
    try {
      await changerRole(m.id, m.role === 'ADMIN' ? 'utilisateur' : 'admin');
      setFiche(await api<FicheMembre>(`/membres/${id}/fiche`, { token, discret: true }));
      onChange();
    } catch (e) {
      setErreur((e as Error).message);
    }
    setBusy(false);
  };
  const supprimer = async () => {
    setBusy(true);
    setErreur('');
    try {
      await api(`/membres/${id}`, { method: 'DELETE', token });
      onChange();
      onFermer();
    } catch (e) {
      setErreur((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialogue titre={titre} onFermer={onFermer} large>
      {!fiche && !erreur ? (
        <ZoneSquelette label="Chargement de la fiche">
          <LignesSquelette n={4} />
        </ZoneSquelette>
      ) : null}
      {m ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Tag label={nomOffreMembre(m)} color={couleurOffre(m)} />
            {detailOffre(m) ? <T small muted>{detailOffre(m)}</T> : null}
          </View>
          <T small muted>
            {m.email}
            {m.emailVerifie ? '' : ' · email non confirmé'} · inscrit le {dateFr(m.creeLe)}
            {fiche?.derniereActivite ? ` · actif le ${dateFr(fiche.derniereActivite)}` : ''}
          </T>
          {msg ? <T small style={{ color: C.coach }}>{msg}</T> : null}

          {m.offre === 'libre' ? null : (
            <>
              <Sep />
              <T style={{ fontWeight: '700' }}>Offrir une formule</T>
              <Seg label="Formule" options={OFFRES_ADMIN.map((o) => ({ key: o.key, label: o.label }))} value={offre} onChange={setOffre} />
              <Seg label="Durée" options={DUREES_ADMIN.map((n) => ({ key: String(n), label: n === 12 ? '1 an' : `${n} mois` }))} value={mois} onChange={setMois} />
              <Input label="Note (visible par les admins)" value={note} onChangeText={setNote} maxLength={300} placeholder="Ex. paiement reçu en espèces" />
              <View style={{ flexDirection: 'row' }}>
                <Btn label={`Offrir ${choix.label} · ${mois === '12' ? '1 an' : `${mois} mois`}`} disabled={busy} onPress={() => agir({ action: 'offrir', formule: choix.formule, palier: choix.palier, mois: Number(mois) }, `${choix.label} offert. Le compte est prévenu.`)} />
              </View>

              {estAbonne(m) ? (
                confirmer === 'retirer' ? (
                  <View style={{ gap: 8 }}>
                    <T small>Retirer l’abonnement maintenant ? Le compte repasse à l’offre gratuite et il est prévenu. Un remboursement se fait à part.</T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Btn kind="danger" label="Oui, retirer" disabled={busy} onPress={() => agir({ action: 'retirer' }, 'Abonnement retiré.')} />
                      <Btn kind="sec" label="Annuler" onPress={() => setConfirmer(null)} />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row' }}>
                    <Btn small kind="danger" label="Retirer l’abonnement…" onPress={() => setConfirmer('retirer')} />
                  </View>
                )
              ) : (
                <>
                  <Sep />
                  <T style={{ fontWeight: '700' }}>Prolonger l’essai</T>
                  <Seg options={JOURS_ESSAI_ADMIN.map((n) => ({ key: String(n), label: `${n} jours` }))} value={jours} onChange={setJours} />
                  <View style={{ flexDirection: 'row' }}>
                    <Btn kind="sec" label={`Ajouter ${jours} jours d’essai`} disabled={busy} onPress={() => agir({ action: 'essai', jours: Number(jours) }, 'Essai prolongé. Le compte est prévenu.')} />
                  </View>
                </>
              )}
            </>
          )}

          <Sep />
          <Pliable titre="Paiements" count={fiche?.paiements.length || undefined}>
            {fiche?.paiements.length ? (
              fiche.paiements.map((p) => (
                <View key={p.reference} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                  <View style={{ flex: 1 }}>
                    <T small>
                      {p.formule === 'finances' ? 'Finances' : p.palier ? `Pro ${p.palier}` : 'Pro'} · {p.periode === 'annuel' ? '1 an' : '1 mois'} · {fmtPrix(p.montant, p.devise)}
                    </T>
                    <T small muted>
                      {dateFr(p.payeLe ?? p.createdAt)} · réf. {p.reference}
                      {p.telephone ? ` · ${p.telephone}` : ''}
                    </T>
                  </View>
                  <Tag label={STATUTS_PAIEMENT[p.statut] ?? p.statut} color={p.statut === 'paye' ? C.coach : p.statut === 'echoue' ? C.agressif : C.muted} />
                </View>
              ))
            ) : (
              <T small muted>Aucun paiement.</T>
            )}
          </Pliable>
          <Pliable titre="Historique de l’admin" count={fiche?.actions.length || undefined}>
            {fiche?.actions.length ? (
              fiche.actions.map((a) => (
                <View key={a.id} style={{ paddingVertical: 4 }}>
                  <T small>{libelleAction(a)}</T>
                  <T small muted>
                    {dateFr(a.createdAt)} · par {a.parNom}
                    {a.finApres ? ` · jusqu’au ${dateFr(a.finApres)}` : ''}
                    {a.note ? ` · ${a.note}` : ''}
                  </T>
                </View>
              ))
            ) : (
              <T small muted>Aucune action.</T>
            )}
          </Pliable>

          <Sep />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn small kind="sec" label={m.role === 'ADMIN' ? 'Retirer le rôle admin' : 'Rendre admin'} disabled={busy} onPress={changerLeRole} />
            {moi ? null : <Btn small kind="danger" label="Supprimer le compte…" onPress={() => setConfirmer('supprimer')} />}
          </View>
          {confirmer === 'supprimer' ? (
            <View style={{ gap: 8 }}>
              <T small>Le compte et toutes ses données seront effacés définitivement. Tape son adresse email pour confirmer.</T>
              <Input label="Email du compte" placeholder={m.email} value={emailSaisi} onChangeText={setEmailSaisi} autoCapitalize="none" keyboardType="email-address" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn kind="danger" label="Supprimer définitivement" disabled={busy || emailSaisi.trim().toLowerCase() !== m.email.toLowerCase()} onPress={supprimer} />
                <Btn kind="sec" label="Annuler" onPress={() => setConfirmer(null)} />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
    </Dialogue>
  );
}

export default function Utilisateurs() {
  const { isAdmin, mode, session } = useStore();
  const token = session?.token;
  const [filtre, setFiltre] = useState<FiltreMembres>('tous');
  const [saisie, setSaisie] = useState('');
  const [q, setQ] = useState('');
  const [liste, setListe] = useState<ReponseGestion | null>(null);
  const [erreur, setErreur] = useState('');
  const [plus, setPlus] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const permis = mode === 'cloud' && isAdmin;

  // On attend la fin de la frappe avant de chercher.
  useEffect(() => {
    const t = setTimeout(() => setQ(saisie.trim()), 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const adresse = useCallback((page: number) => `/membres/gestion?filtre=${filtre}&q=${encodeURIComponent(q)}&page=${page}`, [filtre, q]);
  // La fiche demande de relire la liste après un geste.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!permis) return;
    let fini = false;
    api<ReponseGestion>(adresse(1), { token, discret: true })
      .then((r) => {
        if (fini) return;
        setListe(r);
        setErreur('');
      })
      .catch((e: Error) => !fini && setErreur(e.message));
    return () => {
      fini = true;
    };
  }, [permis, adresse, token, version]);

  const voirPlus = async () => {
    if (!liste) return;
    setPlus(true);
    try {
      const r = await api<ReponseGestion>(adresse(liste.page + 1), { token, discret: true });
      setListe({ ...r, membres: [...liste.membres, ...r.membres] });
    } catch (e) {
      setErreur((e as Error).message);
    }
    setPlus(false);
  };

  if (!permis)
    return (
      <Screen>
        <Header retour title="Utilisateurs" />
        <Empty>{mode === 'cloud' ? 'Réservé aux admins.' : 'Mode local : un seul compte, sur cet appareil.'}</Empty>
      </Screen>
    );

  const s = liste?.stats;
  return (
    <Screen>
      <Header retour eyebrow="Admin" title="Utilisateurs" />
      {liste && !liste.abonnementsActifs ? (
        <Panel>
          <T small muted>
            Abonnements coupés sur le serveur : tout est ouvert à tous pour l’instant.
          </T>
        </Panel>
      ) : null}
      {s ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Chiffre titre="Comptes" valeur={String(s.tous)} />
          <Chiffre titre="Abonnés" valeur={String(s.abonnes)} detail={`${s.essai} en essai`} couleur={C.accent} />
          <Chiffre titre="Sans abonnement" valeur={String(s.sans)} detail={s.anciens ? `dont ${s.anciens} ancien${s.anciens > 1 ? 's' : ''} abonné${s.anciens > 1 ? 's' : ''}` : undefined} />
          <Chiffre titre="Revenus du mois" valeur={texteRevenus(s.revenus, 'mois')} detail={`Total : ${texteRevenus(s.revenus, 'total')}`} />
        </View>
      ) : null}

      <Filtre label="Comptes affichés" options={FILTRES.map((f) => ({ key: f.key, label: f.label, compte: s?.[f.key] || undefined }))} value={filtre} onChange={setFiltre} />
      <Input placeholder="Rechercher un nom ou un email" value={saisie} onChangeText={setSaisie} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Rechercher un compte" />

      <Panel title="Comptes" count={liste?.total || undefined}>
        {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
        {!liste && !erreur ? (
          <ZoneSquelette label="Chargement des comptes">
            <LignesSquelette n={5} />
          </ZoneSquelette>
        ) : null}
        {liste && !liste.membres.length ? <Empty>Aucun compte ici.</Empty> : null}
        {liste?.membres.map((l, i) => (
          <View key={l.id}>
            {i ? <Sep /> : null}
            <LigneCompte l={l} onOuvrir={() => setOuvert(l.id)} />
          </View>
        ))}
        {liste && liste.membres.length < liste.total ? (
          <View style={{ flexDirection: 'row' }}>
            <Btn small kind="sec" label={plus ? 'Chargement…' : `Voir plus (${liste.total - liste.membres.length})`} disabled={plus} onPress={voirPlus} />
          </View>
        ) : null}
      </Panel>

      {ouvert ? <Fiche id={ouvert} onFermer={() => setOuvert(null)} onChange={() => setVersion((v) => v + 1)} /> : null}
    </Screen>
  );
}
