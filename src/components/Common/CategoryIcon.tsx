import React, { useState } from 'react';
import { AVAILABLE_ICONS } from '../../constants/templates';
import { convertedIcon, hasConverted, originalIcon } from '../../constants/icons';

// The icon of a category, and the thing that gets drawn when there is no icon
// to show.
//
// A category carries its icon as a filename, and that filename lives in the
// database rather than in the code, so a category can perfectly well name a
// file that is not in public/Icons: an icon that was removed, a category that
// was written without an icon at all, or a value from a template saved long
// ago. Before this component the participant saw the browser's broken image
// square in that case, on the very screen the invitation link lands on.
//
// The safety net that was supposed to catch it pointed at a general.png that
// does not exist either, and because Netlify answers every unknown path with
// index.html at status 200 the replacement failed exactly like the original
// and could fire the same handler again.
//
// So the fallback here is not a file. It is drawn: the first letter of the
// category name inside a circle tinted with the category colour. There is no
// request to fail. A name that is not one of the known icons never reaches the
// network at all, and a known icon that fails to load falls back once.
//
// The file it asks for is not the one the database names. The GIFs were built
// at 640 by 640 and the largest place any of them is drawn is eighty pixels, so
// each one is rebuilt at 240 as an animated WebP, every frame kept. The stored
// string is untouched and the mapping happens in constants/icons.ts.
//
// See DOCS/PLANING/110-the-fallback-icon-does-not-exist.md and
// DOCS/PLANING/108-category-icons-are-seven-megabytes-of-gif.md.

interface CategoryIconProps {
  /** The filename as the database holds it, for example "meat.gif". */
  icon?: string;
  /** The category name. Its first letter is what the fallback draws. */
  name?: string;
  /** The category colour, as a hex string. Tints the drawn fallback. */
  color?: string;
  /** Sizing and animation come from the call site, exactly as they did on the img. */
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

const NEUTRAL = '#95a5a6';

/** The letter the fallback draws, from the name, or from the filename, or nothing. */
const fallbackLetter = (name?: string, icon?: string): string => {
  const fromName = Array.from((name || '').trim())[0];
  if (fromName) return fromName.toUpperCase();
  const fromIcon = Array.from((icon || '').replace(/\.[^.]+$/, '').trim())[0];
  return fromIcon ? fromIcon.toUpperCase() : '';
};

// Three steps down, and the last one cannot fail. The converted file is what
// every current browser gets. The original GIF is still in the folder and
// catches a browser too old to decode an animated WebP, which also makes a
// rollback a one line change here rather than seventeen files restored. The
// drawn letter catches everything else.
type Step = 'converted' | 'original' | 'drawn';

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  name,
  color,
  className,
  style,
  alt,
}) => {
  // A name with no converted file, which is every PNG, starts one step down.
  const first: Step = icon && hasConverted(icon) ? 'converted' : 'original';

  // The step is remembered against the icon it belongs to, because the organiser
  // can pick a different icon for the same category without this unmounting. A
  // plain piece of state would keep the previous icon's failure and never try
  // the new one.
  const [tried, setTried] = useState<{ icon?: string; step: Step }>({ icon, step: first });
  const step = tried.icon === icon ? tried.step : first;
  const stepDown = () => setTried({ icon, step: step === 'converted' ? 'original' : 'drawn' });

  // A filename the picker does not offer is not asked for. This is what keeps
  // a category with no icon at all from asking for a file named undefined.
  const known = !!icon && AVAILABLE_ICONS.includes(icon);

  if (known && step !== 'drawn') {
    return (
      <img
        src={step === 'converted' ? convertedIcon(icon) : originalIcon(icon)}
        alt={alt || ''}
        className={className}
        style={style}
        onError={stepDown}
      />
    );
  }

  const tint = color || NEUTRAL;
  const letter = fallbackLetter(name, icon);
  const label = alt || name;

  // An SVG so the letter scales with whatever size the call site asked for,
  // from the eighty pixel category card down to the thirty two pixel swatch.
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="50" cy="50" r="48" fill={tint} fillOpacity={0.18} />
      {letter && (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="50"
          fontWeight="700"
          fill={tint}
        >
          {letter}
        </text>
      )}
    </svg>
  );
};

export default CategoryIcon;
