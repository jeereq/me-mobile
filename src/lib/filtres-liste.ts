/** Les critères d'une liste longue (dépenses, opérations) : un groupe par critère, posé dans une fenêtre. */
export type OptionFiltre = { key: string; label: string; compte?: number };
/** Un critère : ses choix, celui qui est posé, et la valeur qui veut dire « pas de filtre ». */
export type GroupeFiltre = { cle: string; titre: string; options: OptionFiltre[]; valeur: string; defaut: string; onChange: (v: string) => void };

/** Un critère qui s'allume ou s'éteint : « Pas encore démarrés ». */
export type BasculeFiltre = { cle: string; label: string; valeur: boolean; onChange: (v: boolean) => void };

/** Les critères posés, dans l'ordre des groupes puis des bascules : les étiquettes à montrer, et ce que compte le bouton. */
export const filtresPoses = (groupes: GroupeFiltre[], bascules: BasculeFiltre[] = []) => [
  ...groupes.filter((g) => g.valeur !== g.defaut).map((g) => ({ cle: g.cle, label: g.options.find((o) => o.key === g.valeur)?.label ?? g.titre, effacer: () => g.onChange(g.defaut) })),
  ...bascules.filter((b) => b.valeur).map((b) => ({ cle: b.cle, label: b.label, effacer: () => b.onChange(false) })),
];
