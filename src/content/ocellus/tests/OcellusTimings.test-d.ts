import { OCELLUS_P4 } from "../js/OcellusTimings";

// Assignability ignores readonly, so this compares the two types for identity instead.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type WritablePaths<T, Path extends string> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? never
  : T extends unknown[]
    ? Path | WritablePaths<T[number], `${Path}[]`>
    : T extends readonly unknown[]
      ? WritablePaths<T[number], `${Path}[]`>
      : {
          [K in keyof T & string]: (Same<Pick<T, K>, Readonly<Pick<T, K>>> extends true ? never : `${Path}.${K}`) | WritablePaths<T[K], `${Path}.${K}`>;
        }[keyof T & string];

type TimingWrites = WritablePaths<typeof OCELLUS_P4, "OCELLUS_P4">;
const timingTablesAreReadonly: [TimingWrites] extends [never] ? true : TimingWrites = true;
