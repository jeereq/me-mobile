import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconeNom = 'cloche' | 'livre' | 'agenda' | 'onde' | 'reglages' | 'profil' | 'retour' | 'vide' | 'eclair' | 'trophee' | 'portefeuille' | 'stats' | 'jour' | 'relances' | 'taches' | 'habitudes' | 'panneau' | 'loupe' | 'projets' | 'etiquette' | 'equipe' | 'micro' | 'calendrier' | 'mail' | 'crayon' | 'repondre' | 'trombone' | 'ouvrir' | 'actualiser' | 'envoyer';

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
      {nom === 'equipe' && (
        <>
          <Circle cx="9" cy="9" r="3.2" {...p} />
          <Path d="M3 19a6 6 0 0 1 12 0" {...p} />
          <Path d="M16 6.3a3.2 3.2 0 0 1 0 5.4M17.5 14.2A6 6 0 0 1 21 19" {...p} />
        </>
      )}
      {nom === 'retour' && <Path d="M15 5l-7 7 7 7" {...p} />}
      {nom === 'jour' && (
        <>
          <Circle cx="12" cy="12" r="8.5" {...p} />
          <Circle cx="12" cy="12" r="3.5" {...p} />
        </>
      )}
      {nom === 'mail' && (
        <>
          <Rect x="3" y="5.5" width="18" height="13" rx="2.5" {...p} />
          <Path d="M4 7.5l8 6 8-6" {...p} />
        </>
      )}
      {nom === 'envoyer' && <Path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" {...p} />}
      {nom === 'crayon' && <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" {...p} />}
      {nom === 'repondre' && <Path d="M10 5L4 11l6 6M4 11h10a6 6 0 0 1 6 6v1" {...p} />}
      {nom === 'trombone' && <Path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7" {...p} />}
      {nom === 'ouvrir' && <Path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" {...p} />}
      {nom === 'actualiser' && <Path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4" {...p} />}
      {nom === 'relances' && <Path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" {...p} />}
      {nom === 'taches' && (
        <>
          <Rect x="4" y="4" width="16" height="16" rx="3" {...p} />
          <Path d="M8 12l3 3 5-6" {...p} />
        </>
      )}
      {nom === 'habitudes' && <Path d="M4 17l5-5 4 4 7-8M15 8h5v5" {...p} />}
      {nom === 'loupe' && (
        <>
          <Circle cx="11" cy="11" r="6.5" {...p} />
          <Path d="M16 16l4 4" {...p} />
        </>
      )}
      {nom === 'panneau' && (
        <>
          <Rect x="3.5" y="4.5" width="17" height="15" rx="2.5" {...p} />
          <Path d="M9.5 4.5v15" {...p} />
        </>
      )}
      {nom === 'calendrier' && (
        <>
          <Rect x="3.5" y="5" width="17" height="15" rx="2.5" {...p} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...p} />
          <Circle cx="8" cy="14" r="0.9" fill={color} stroke="none" />
          <Circle cx="12" cy="14" r="0.9" fill={color} stroke="none" />
          <Circle cx="16" cy="14" r="0.9" fill={color} stroke="none" />
          <Circle cx="8" cy="17.2" r="0.9" fill={color} stroke="none" />
          <Circle cx="12" cy="17.2" r="0.9" fill={color} stroke="none" />
        </>
      )}
      {nom === 'projets' && <Path d="M4 6h8M7 12h10M11 18h9M4 3v18" {...p} />}
      {nom === 'etiquette' && (
        <>
          <Path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8l-6.1 6.1a2 2 0 0 1-2.8 0l-6.8-6.8a2 2 0 0 1-.6-1.4z" {...p} />
          <Circle cx="8.5" cy="8.5" r="1.3" {...p} />
        </>
      )}
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
      {nom === 'micro' && (
        <>
          <Rect x="9" y="3" width="6" height="11" rx="3" {...p} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" {...p} />
        </>
      )}
    </Svg>
  );
}
