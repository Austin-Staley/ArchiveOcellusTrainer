export function paintedTiles(paint: (context: OffscreenCanvasRenderingContext2D, scale: number) => void): ReadonlySet<string> {
  const painted = new Set<string>();
  const context = { fillStyle: "", fillRect: (x: number, y: number) => void painted.add(`${x},${y}`) };
  paint(context as unknown as OffscreenCanvasRenderingContext2D, 1);
  return painted;
}

export type Fill = Readonly<{ style: string; x: number; y: number; width: number; height: number }>;

export function paintedFills(paint: (context: OffscreenCanvasRenderingContext2D) => void): readonly Fill[] {
  const fills: Fill[] = [];
  const state: Record<string | symbol, unknown> = { fillStyle: "", globalAlpha: 1 };
  const saved: Record<string | symbol, unknown>[] = [];
  const methods: Record<string, (...args: number[]) => void> = {
    fillRect: (x, y, width, height) => {
      if (Number(state.globalAlpha) > 0) fills.push({ style: String(state.fillStyle), x, y, width, height });
    },
    save: () => void saved.push({ ...state }),
    restore: () => void Object.assign(state, saved.pop()),
  };
  const context = new Proxy(state, {
    get: (target, property) => (typeof property === "string" && property in methods ? methods[property] : property in target ? target[property] : () => undefined),
    set: (target, property, value) => {
      target[property] = value;
      return true;
    },
  });
  paint(context as unknown as OffscreenCanvasRenderingContext2D);
  return fills;
}
