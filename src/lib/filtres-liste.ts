/** Les critères d'une liste longue (dépenses, opérations) : un groupe par critère, posé dans une fenêtre. */
export type OptionFiltre = { key: string; label: string; compte?: number };
/** Un critère : ses choix, celui qui est posé, et la valeur qui veut dire « pas de filtre ». */
export type GroupeFiltre = { cle: string; titre: string; options: OptionFiltre[]; valeur: string; defaut: string; onChange: (v: string) => void };

/** Les critères posés, dans l'ordre des groupes : ce que les étiquettes montrent et ce que compte le bouton. */
export const filtresPoses = (groupes: GroupeFiltre[]) =>
  groupes
    .filter((g) => g.valeur !== g.defaut)
    .map((g) => ({ groupe: g, label: g.options.find((o) => o.key === g.valeur)?.label ?? g.titre }));
