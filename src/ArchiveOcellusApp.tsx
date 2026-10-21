import React, { useState } from "react";
import { CacheRender, Settings, TrainerInstance, TrainerLoadingState } from "osrs-sdk";
import { GameOverlay, TrainerApp, TrainerLoadingSplash } from "osrs-sdk-react";
import { OcellusRegion } from "./content/ocellus/js/OcellusRegion";

export const CREDIT_LINE =
  "Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.";

function createTrainer() {
  CacheRender.configure(new URL("osrs-assets/manifest.json", window.location.href).href);
  Settings.readFromStorage();
  return new TrainerInstance(new OcellusRegion());
}

export function ArchiveOcellusApp() {
  const [trainer] = useState(createTrainer);
  const [loading, setLoading] = useState<TrainerLoadingState>();

  return (
    <TrainerApp trainer={trainer} onLoadingStateChange={setLoading}>
      <GameOverlay>
        <TrainerLoadingSplash state={loading} />
        <p id="credit_line">{CREDIT_LINE}</p>
      </GameOverlay>
    </TrainerApp>
  );
}
