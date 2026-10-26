export type BuildFlags = Readonly<{ p3: boolean; p2: boolean; p1: boolean; full: boolean }>;

/** webpack's EnvironmentPlugin writes the four flags into the bundle. The three phase flags stay on unless the build sets them off. ARCHIVE_FULL stays off unless the build sets it on. The Netlify script turns all four on. */
export function readBuildFlags(): BuildFlags {
  return { p3: process.env.ARCHIVE_P3 === "on", p2: process.env.ARCHIVE_P2 === "on", p1: process.env.ARCHIVE_P1 === "on", full: process.env.ARCHIVE_FULL === "on" };
}

export const onlyP4Playable = (flags: BuildFlags): boolean => !Object.values(flags).includes(true);
