import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CacheRender, ControlPanelController, SETTINGS_STORAGE_KEY, Settings, SoundCache, TrainerInstance, TrainerLoadingState, Viewport } from "osrs-sdk";
import type { Item, SettingsState } from "osrs-sdk";
import { GameOverlay, TrainerApp, TrainerLoadingSplash, useSettingsSnapshot } from "osrs-sdk-react";
import { OcellusRegion } from "./content/ocellus/js/OcellusRegion";
import type { DrillConfig } from "./content/ocellus/js/OcellusTimings";
import { OCELLUS_P4, parseDrillRequest } from "./content/ocellus/js/OcellusTimings";
import type { FightLog, FightSnapshot, RunState } from "./content/ocellus/js/P4Types";
import { CHANGELOG } from "./content/ocellus/changelog";
import type { ReleaseVersion } from "./releases";
import { releaseDate } from "./releases";
import { keepHoverTextOnCanvas } from "./hoverText";

keepHoverTextOnCanvas();
// Desktop browsers start the SDK's AudioContext suspended until a user gesture, and the SDK never resumes it.
window.addEventListener("pointerdown", () => void SoundCache.context?.resume(), { capture: true });

export const CREDIT_LINE =
  "Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.";

declare global {
  interface Window {
    __archiveOcellusProbe?: Readonly<{
      snapshot(): VerificationProbeSnapshot;
      log(): FightLog;
      tileCentre(at: Readonly<{ x: number; y: number }>): Readonly<{ x: number; y: number }> | null;
    }>;
  }
}

type VerificationProbeSnapshot = Readonly<{
  ticking: boolean;
  tick: number;
  player: Readonly<{ x: number; y: number }> | null;
  destination: Readonly<{ x: number; y: number }> | null;
  fight: FightSnapshot | null;
  rejected: readonly string[];
  panel: Readonly<{ tab: string | null; keys: Readonly<Record<"inventory" | "spellbook" | "prayer" | "equipment" | "combat", string>> }>;
  menu: readonly string[] | null;
  icons: Readonly<Record<string, Readonly<{ path: string; size: string }>>>;
}>;

function drawnIcons(items: readonly (Item | null | undefined)[]): VerificationProbeSnapshot["icons"] {
  return Object.fromEntries(
    items.flatMap((item) => {
      if (!item || typeof item.cacheItemId !== "number" || !(item.inventorySprite instanceof HTMLImageElement)) return [];
      const { src, naturalWidth, naturalHeight } = item.inventorySprite;
      return [[item.cacheItemId, { path: new URL(src).pathname, size: `${naturalWidth}x${naturalHeight}` }]];
    }),
  );
}

function exposeVerificationProbe(trainer: TrainerInstance, region: OcellusRegion, rejected: readonly string[]) {
  window.__archiveOcellusProbe = Object.freeze({
    snapshot(): VerificationProbeSnapshot {
      const { player, world } = trainer.getSnapshot();
      const { contextMenu } = Viewport.viewport;
      return {
        ticking: !world.isPaused,
        tick: world.globalTickCounter,
        player: player ? { x: player.location.x, y: player.location.y } : null,
        destination: player?.destinationLocation ? { x: player.destinationLocation.x, y: player.destinationLocation.y } : null,
        fight: region.snapshot(),
        rejected,
        panel: {
          tab: Object.entries(ControlPanelController.controls).find(([, control]) => control === ControlPanelController.controller.selectedControl)?.[0] ?? null,
          keys: { inventory: Settings.inventory_key, spellbook: Settings.spellbook_key, prayer: Settings.prayer_key, equipment: Settings.equipment_key, combat: Settings.combat_key },
        },
        menu: contextMenu.isActive ? contextMenu.menuOptions.map((option) => option.text.map((block) => `${block.text}`).join("")) : null,
        icons: player ? drawnIcons([...player.inventory, ...Object.values(player.equipment)]) : {},
      };
    },
    log: () => region.fightLog(),
    tileCentre: (at) => Viewport.viewport.projectTile(at, trainer.getSnapshot().world),
  });
}

const SOUNDS_START_ON = true;

type SoundChoice = Partial<Pick<SettingsState, "playsAudio" | "playsAreaAudio">>;

function savedSoundChoice(): SoundChoice {
  let stored: unknown;
  try {
    stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null");
  } catch {
    return {};
  }
  const values: unknown = typeof stored === "object" && stored !== null && "values" in stored ? stored.values : null;
  if (typeof values !== "object" || values === null) return {};
  return {
    ...("playsAudio" in values && typeof values.playsAudio === "boolean" && { playsAudio: values.playsAudio }),
    ...("playsAreaAudio" in values && typeof values.playsAreaAudio === "boolean" && { playsAreaAudio: values.playsAreaAudio }),
  };
}

function readSettings() {
  // The SDK saves its own off defaults on a first load and turns sound off on every mobile load, so the player's choice is read before it loads.
  const saved = savedSoundChoice();
  Settings.readFromStorage();
  Settings.set({ playsAudio: saved.playsAudio ?? SOUNDS_START_ON, playsAreaAudio: saved.playsAreaAudio ?? SOUNDS_START_ON });
}

function createTrainer() {
  CacheRender.configure(new URL("osrs-assets/manifest.json", window.location.href).href);
  readSettings();
  const { config, invincible, rejected } = parseDrillRequest(new URL(window.location.href), () => crypto.getRandomValues(new Uint32Array(1))[0]);
  const region = new OcellusRegion(config);
  region.invincible = invincible;
  const trainer = new TrainerInstance(region);
  if (process.env.NODE_ENV !== "production") exposeVerificationProbe(trainer, region, rejected);
  return { trainer, region, config };
}

const SETUP_KEYS = Object.keys(OCELLUS_P4.choices.setup.options);
const FOCUS_KEYS = Object.keys(OCELLUS_P4.choices.focus.options);
const label = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " ");

type RunRequest = Readonly<{ setup: string; focus: string; seed: string | null; invincible: boolean }>;

function startRun({ setup, focus, seed, invincible }: RunRequest) {
  const url = new URL(window.location.href);
  url.searchParams.set("setup", setup);
  url.searchParams.set("focus", focus);
  if (seed !== null) url.searchParams.set("seed", seed);
  else url.searchParams.delete("seed");
  if (invincible) url.searchParams.set("invincible", "on");
  else url.searchParams.delete("invincible");
  window.location.assign(url.href);
}

const [LATEST_RELEASE] = CHANGELOG;
const SEEN_RELEASE_KEY = "archive-ocellus:seen-release";

function seenRelease(): string | null {
  try {
    return localStorage.getItem(SEEN_RELEASE_KEY);
  } catch {
    return null;
  }
}

function rememberSeenRelease(version: ReleaseVersion) {
  try {
    localStorage.setItem(SEEN_RELEASE_KEY, version);
  } catch {}
}

const UnseenDot = () => <span className="unseen_dot" role="img" aria-label="new" />;

type MenuView = "closed" | "settings" | "whats-new";

function DrillControls({ config, region }: Readonly<{ config: DrillConfig; region: OcellusRegion }>) {
  const [setup, setSetup] = useState<string>(config.choices.setup.key);
  const [typedSeed, setTypedSeed] = useState<string | null>(null);
  const [view, setView] = useState<MenuView>("closed");
  const [unseen, setUnseen] = useState(() => seenRelease() !== LATEST_RELEASE.version);
  const form = useRef<HTMLFormElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const whatsNewTitle = useRef<HTMLHeadingElement>(null);
  const { playsAudio, playsAreaAudio } = useSettingsSnapshot();
  const restart = (focus: string) => startRun({ setup, focus, seed: typedSeed?.trim() || null, invincible: region.invincible });

  const openWhatsNew = () => {
    rememberSeenRelease(LATEST_RELEASE.version);
    flushSync(() => {
      setView("whats-new");
      setUnseen(false);
    });
    whatsNewTitle.current?.focus();
  };

  const closeWhatsNew = () => {
    setView("closed");
    settingsButton.current?.focus();
  };

  useEffect(() => {
    if (view === "closed") return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (view === "whats-new") closeWhatsNew();
      else setView("closed");
    };
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !form.current?.contains(event.target)) setView("closed");
    };
    // Capture, because the seed box and the SDK canvas stop their events from bubbling.
    document.addEventListener("keydown", closeOnEscape, true);
    document.addEventListener("pointerdown", closeOutside, true);
    return () => {
      document.removeEventListener("keydown", closeOnEscape, true);
      document.removeEventListener("pointerdown", closeOutside, true);
    };
  }, [view]);

  return (
    <form id="drill_controls" ref={form} onSubmit={(event) => { event.preventDefault(); restart(config.choices.focus.key); }}>
      <div id="settings_menu" hidden={view !== "settings"}>
        <label>
          Setup{" "}
          <select id="setup" value={setup} onChange={(event) => setSetup(event.target.value)}>
            {SETUP_KEYS.map((key) => <option key={key} value={key}>{label(key)}</option>)}
          </select>
        </label>
        <label>
          Focus{" "}
          <select id="focus" value={config.choices.focus.key} onChange={(event) => restart(event.target.value)}>
            {FOCUS_KEYS.map((key) => <option key={key} value={key}>{label(key)}</option>)}
          </select>
        </label>
        <label>
          Seed <input id="seed" inputMode="numeric" value={typedSeed ?? String(config.seed)} onInput={(event) => setTypedSeed(event.currentTarget.value)} onKeyDown={(event) => event.stopPropagation()} />
        </label>
        <button id="keybinds" type="button" onClick={() => ControlPanelController.controller.setActiveControl("SETTINGS")}>Keybinds</button>
        <label>
          Sound effects <input id="sound" type="checkbox" checked={playsAudio} onChange={(event) => Settings.set({ playsAudio: event.target.checked })} />
        </label>
        <label>
          Area sounds <input id="area_sound" type="checkbox" checked={playsAreaAudio} onChange={(event) => Settings.set({ playsAreaAudio: event.target.checked })} />
        </label>
        <label>
          Invincible <input id="invincible" type="checkbox" defaultChecked={region.invincible} onChange={(event) => { region.invincible = event.target.checked; }} />
        </label>
        <button id="whats_new" type="button" onClick={openWhatsNew}>What's new{unseen && <UnseenDot />}</button>
      </div>
      <section id="whats_new_panel" role="dialog" aria-labelledby="whats_new_title" hidden={view !== "whats-new"}>
        <h2 id="whats_new_title" ref={whatsNewTitle} tabIndex={-1}>What's new</h2>
        {CHANGELOG.map(({ version, notes }) => (
          <article key={version}>
            <h3><time dateTime={releaseDate(version)}>{version}</time></h3>
            <ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </article>
        ))}
        <button id="whats_new_close" type="button" onClick={closeWhatsNew}>Close</button>
      </section>
      <button id="settings" ref={settingsButton} type="button" aria-expanded={view !== "closed"} aria-controls="settings_menu" onClick={() => setView((shown) => (shown === "closed" ? "settings" : "closed"))}>
        ⚙ Settings{unseen && <UnseenDot />}
      </button>
      <button id="restart" type="submit">Restart</button>
    </form>
  );
}

const SECONDS_TENTHS_PER_TICK = 6;

function gameTime(ticks: number): string {
  const tenths = ticks * SECONDS_TENTHS_PER_TICK;
  const minutes = Math.floor(tenths / 600);
  const seconds = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
  return `${minutes}:${seconds}`;
}

type RunResult = Extract<RunState, { kind: "ended" }> & Readonly<{ invincible: boolean }>;

function RunResultText({ result }: Readonly<{ result: RunResult }>) {
  switch (result.reason) {
    case "kill":
      return (
        <>
          <h2 id="run_result_title">Ocellus defeated</h2>
          <p id="run_result_time">P4 time: {result.at} ticks ({gameTime(result.at)})</p>
          {result.invincible && <p id="run_result_note">Invincible was on.</p>}
        </>
      );
    case "death":
      return (
        <>
          <h2 id="run_result_title">You died</h2>
          <p id="run_result_time">on P4 tick {result.at}</p>
        </>
      );
    default: {
      const unhandled: never = result.reason;
      return unhandled;
    }
  }
}

const RESULT_POLL_MS = 300;

function RunResultPanel({ config, region }: Readonly<{ config: DrillConfig; region: OcellusRegion }>) {
  const [result, setResult] = useState<RunResult | null>(null);
  useEffect(() => {
    if (result) return;
    const poll = window.setInterval(() => {
      const run = region.snapshot()?.run;
      if (run?.kind !== "ended") return;
      const preventedDeath = region.fightLog().rows.some((row) => row.events.some((event) => event.kind === "death-prevented"));
      setResult({ ...run, invincible: region.invincible || preventedDeath });
    }, RESULT_POLL_MS);
    return () => window.clearInterval(poll);
  }, [region, result]);

  if (!result) return null;
  const again = (seed: string | null) => startRun({ setup: config.choices.setup.key, focus: config.choices.focus.key, seed, invincible: region.invincible });
  return (
    <section id="run_result" role="dialog" aria-labelledby="run_result_title">
      <RunResultText result={result} />
      <button id="result_restart" type="button" onClick={() => again(null)}>Restart</button>
      <button id="result_retry" type="button" onClick={() => again(String(config.seed))}>Retry seed</button>
    </section>
  );
}

const CHAT_LINES_SHOWN = 5;
const CHAT_POLL_MS = 300;

function GameChat({ region }: Readonly<{ region: OcellusRegion }>) {
  const [lines, setLines] = useState<readonly string[]>([]);
  useEffect(() => {
    const poll = window.setInterval(() => setLines((shown) => {
      const latest = region.chat();
      return latest.length === shown.length ? shown : latest;
    }), CHAT_POLL_MS);
    return () => window.clearInterval(poll);
  }, [region]);

  return (
    <ol id="game_chat">
      {lines.slice(-CHAT_LINES_SHOWN).map((line, index) => <li key={index}>{line}</li>)}
    </ol>
  );
}

export function ArchiveOcellusApp() {
  const [{ trainer, region, config }] = useState(createTrainer);
  const [loading, setLoading] = useState<TrainerLoadingState>();

  return (
    <TrainerApp trainer={trainer} onLoadingStateChange={setLoading}>
      <GameOverlay>
        <TrainerLoadingSplash state={loading} />
        <GameChat region={region} />
        <DrillControls config={config} region={region} />
        <RunResultPanel config={config} region={region} />
        <footer id="credits">
          <p id="credit_line">{CREDIT_LINE}</p>
          <p id="app_version">v{LATEST_RELEASE.version}</p>
        </footer>
      </GameOverlay>
    </TrainerApp>
  );
}
