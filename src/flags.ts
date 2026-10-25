export type BuildFlags = Readonly<{ p3: boolean }>;

/** webpack's EnvironmentPlugin writes ARCHIVE_P3 into the bundle at build time, "off" unless the build environment sets it. */
export function readBuildFlags(): BuildFlags {
  return { p3: process.env.ARCHIVE_P3 === "on" };
}
