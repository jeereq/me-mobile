import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconeNom = 'cloche' | 'livre' | 'agenda' | 'onde' | 'reglages' | 'profil' | 'retour' | 'vide' | 'eclair' | 'trophee' | 'portefeuille' | 'stats';

/** Pictogrammes au trait, dans le style des onglets. */
export function Icone({ nom, color, size = 20 }: { nom: IconeNom; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {nom === 'cloche' && <Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20a2 2 0 0 0 4 0" {...p} />}
      {nom === 'livre' && <Path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15zM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6" {...p} />}
      {nom === 'agenda' && (
        <>
          <Rect x="3.5" y="5" width="17" height="15" rx="2.5" {...p} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...p} />
        </>
      )}
      {nom === 'onde' && <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" {...p} />}
      {nom === 'reglages' && (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...p} />
          <Circle cx="15" cy="7" r="2" {...p} />
          <Circle cx="9" cy="17" r="2" {...p} />
        </>
      )}
      {nom === 'profil' && (
        <>
          <Circle cx="12" cy="8.5" r="3.5" {...p} />
          <Path d="M5 20a7 7 0 0 1 14 0" {...p} />
        </>
      )}
      {nom === 'retour' && <Path d="M15 5l-7 7 7 7" {...p} />}
      {nom === 'vide' && (
        <>
          <Circle cx="12" cy="12" r="8" {...p} strokeDasharray="3 3" />
          <Path d="M9 12h6" {...p} />
        </>
      )}
      {nom === 'trophee' && <Path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" {...p} />}
      {nom === 'portefeuille' && <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3M4 7.5V17a2 2 0 0 0 2 2h13V8H6.5A2.5 2.5 0 0 1 4 7.5zM15.5 13.5h.01" {...p} />}
      {nom === 'stats' && <Path d="M4 20h16M6.5 16v-4M11 16V7M15.5 16v-6M20 16V4" {...p} />}
      {nom === 'eclair' && <Path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" {...p} />}
    </Svg>
  );
}
