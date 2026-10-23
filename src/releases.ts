export type ReleaseVersion = `${number}.${number}.${number}` | `${number}.${number}.${number}.${number}`;

export type ReleaseNotes =
  | readonly [string, string]
  | readonly [string, string, string]
  | readonly [string, string, string, string]
  | readonly [string, string, string, string, string];

export type Release = Readonly<{ version: ReleaseVersion; notes: ReleaseNotes }>;

/** Newest release first. */
export type Changelog = readonly [Release, ...Release[]];

export function releaseDate(version: ReleaseVersion): string {
  return version.split(".").slice(0, 3).join("-");
}
