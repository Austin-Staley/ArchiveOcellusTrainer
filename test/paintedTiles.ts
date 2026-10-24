export function paintedTiles(paint: (context: OffscreenCanvasRenderingContext2D, scale: number) => void): ReadonlySet<string> {
  const painted = new Set<string>();
  const ignored = () => undefined;
  const context = { fillStyle: "", fillRect: (x: number, y: number) => void painted.add(`${x},${y}`), beginPath: ignored, moveTo: ignored, lineTo: ignored, closePath: ignored, fill: ignored };
  paint(context as unknown as OffscreenCanvasRenderingContext2D, 1);
  return painted;
}

type Shape = Readonly<{ style: string; contains: (x: number, y: number) => boolean }>;

function insidePolygon(corners: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  corners.forEach(([ax, ay], i) => {
    const [bx, by] = corners[(i + 1) % corners.length];
    if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) inside = !inside;
  });
  return inside;
}

export function paintedStyleAt(paint: (context: OffscreenCanvasRenderingContext2D, scale: number) => void, scale = 1): (tileX: number, tileY: number) => string | null {
  const shapes: Shape[] = [];
  const state: Record<string | symbol, unknown> = { fillStyle: "", globalAlpha: 1 };
  const saved: Record<string | symbol, unknown>[] = [];
  let path: [number, number][] = [];
  const add = (contains: Shape["contains"]) => {
    if (Number(state.globalAlpha) > 0) shapes.push({ style: String(state.fillStyle), contains });
  };
  const methods: Record<string, (...args: number[]) => void> = {
    fillRect: (x, y, width, height) => add((px, py) => px >= x && px < x + width && py >= y && py < y + height),
    beginPath: () => void (path = []),
    moveTo: (x, y) => void path.push([x, y]),
    lineTo: (x, y) => void path.push([x, y]),
    fill: () => {
      const corners = [...path];
      add((px, py) => insidePolygon(corners, px, py));
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
  paint(context as unknown as OffscreenCanvasRenderingContext2D, scale);
  return (tileX, tileY) => [...shapes].reverse().find((shape) => shape.contains(tileX * scale, tileY * scale))?.style ?? null;
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

function transparent(style: unknown): boolean {
  if (typeof style !== "string") return false;
  const colour = style.trim().toLowerCase();
  if (colour === "transparent") return true;
  const hex = colour.match(/^#(?:[\da-f]{3}([\da-f])|[\da-f]{6}([\da-f]{2}))$/);
  if (hex) return parseInt(hex[1] ?? hex[2], 16) === 0;
  const channels = colour.match(/^(?:rgb|hsl)a?\((.*)\)$/)?.[1].split(/[\s,/]+/).filter(Boolean);
  return channels?.length === 4 && parseFloat(channels[3]) === 0;
}

function sizeOf(image: unknown): readonly [width: number, height: number] {
  return typeof image === "object" && image !== null && "width" in image && "height" in image ? [Number(image.width), Number(image.height)] : [0, 0];
}

function hasVisiblePixel(image: unknown): boolean {
  return typeof image === "object" && image !== null && "data" in image && image.data instanceof Uint8ClampedArray && image.data.some((value, index) => index % 4 === 3 && value > 0);
}

const covers = (width: unknown, height: unknown) => Math.abs(Number(width) * Number(height)) > 0;

type Path = { points: (readonly [x: number, y: number])[]; curved: boolean };

export function drawsVisibly(paint: (context: OffscreenCanvasRenderingContext2D) => void): boolean {
  let drew = false;
  const state: Record<string | symbol, unknown> = { globalAlpha: 1, fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1 };
  const saved: Record<string | symbol, unknown>[] = [];
  let path: Path = { points: [], curved: false };
  const shown = (style: unknown) => Number(state.globalAlpha) > 0 && !transparent(style);
  const filled = () => shown(state.fillStyle);
  const stroked = () => shown(state.strokeStyle) && Number(state.lineWidth) > 0;
  const extent = (): readonly [width: number, height: number] => {
    const xs = path.points.map(([x]) => x);
    const ys = path.points.map(([, y]) => y);
    return xs.length === 0 ? [0, 0] : [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  const point = (x: unknown, y: unknown) => void path.points.push([Number(x), Number(y)]);
  const curve = (...xy: unknown[]) => {
    for (let at = 0; at + 1 < xy.length; at += 2) point(xy[at], xy[at + 1]);
  };
  const rect = (x: unknown, y: unknown, width: unknown, height: unknown) => {
    point(x, y);
    point(Number(x) + Number(width), Number(y) + Number(height));
  };
  const mark = (visible: boolean) => {
    if (visible) drew = true;
  };
  const methods: Record<string, (...args: unknown[]) => void> = {
    beginPath: () => void (path = { points: [], curved: false }),
    moveTo: point,
    lineTo: point,
    quadraticCurveTo: curve,
    bezierCurveTo: curve,
    arcTo: (x1, y1, x2, y2) => curve(x1, y1, x2, y2),
    arc: (x, y, radius) => {
      point(x, y);
      if (Number(radius) > 0) path.curved = true;
    },
    ellipse: (x, y, radiusX, radiusY) => {
      point(x, y);
      if (covers(radiusX, radiusY)) path.curved = true;
    },
    rect,
    roundRect: rect,
    fill: () => mark(filled() && (path.curved || covers(...extent()))),
    stroke: () => mark(stroked() && (path.curved || extent().some((side) => side > 0))),
    fillRect: (_x, _y, width, height) => mark(filled() && covers(width, height)),
    strokeRect: (_x, _y, width, height) => mark(stroked() && (Number(width) !== 0 || Number(height) !== 0)),
    drawImage: (image, ...place) => {
      const [width, height] = sizeOf(image);
      const [sourceWidth, sourceHeight] = place.length >= 8 ? [place[2], place[3]] : [width, height];
      const [drawnWidth, drawnHeight] = place.length >= 8 ? [place[6], place[7]] : place.length >= 4 ? [place[2], place[3]] : [width, height];
      mark(Number(state.globalAlpha) > 0 && covers(width, height) && covers(sourceWidth, sourceHeight) && covers(drawnWidth, drawnHeight));
    },
    fillText: (text, _x, _y, maxWidth) => mark(filled() && String(text).trim() !== "" && (maxWidth === undefined || Number(maxWidth) > 0)),
    strokeText: (text, _x, _y, maxWidth) => mark(stroked() && String(text).trim() !== "" && (maxWidth === undefined || Number(maxWidth) > 0)),
    putImageData: (image, _x, _y, ...dirty) => mark(hasVisiblePixel(image) && (dirty.length < 4 || covers(dirty[2], dirty[3]))),
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
  return drew;
}

export function zeroSizeFillRects(context: OffscreenCanvasRenderingContext2D): OffscreenCanvasRenderingContext2D {
  return new Proxy(context, {
    get: (target, property) => (property === "fillRect" ? (x: number, y: number) => target.fillRect(x, y, 0, 0) : Reflect.get(target, property)),
  });
}
