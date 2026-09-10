// Where an icon filename turns into a path.
//
// A category holds its icon as a filename, and that filename lives in the
// database rather than in the code: every event saved so far holds a string
// like "meat.gif", and personal templates hold one too. So the converted files
// could not simply take over the old names, and the stored strings are not
// rewritten. There is also an equality check that compares the icon filename to
// decide whether an event's category list has changed, and rewriting the
// strings would make every existing event look like one whose categories were
// edited.
//
// So the mapping happens here, at the moment of drawing, and nowhere else.
// See DOCS/PLANING/108-category-icons-are-seven-megabytes-of-gif.md.

const IS_GIF = /\.gif$/i;

/** True when a converted file was built for this name. Only the GIFs were. */
export const hasConverted = (icon: string): boolean => IS_GIF.test(icon);

/** The file the screens should ask for first. */
export const convertedIcon = (icon: string): string =>
  `/Icons/${icon.replace(IS_GIF, '.webp')}`;

/** The file the database names, kept as the fallback under the converted one. */
export const originalIcon = (icon: string): string => `/Icons/${icon}`;
