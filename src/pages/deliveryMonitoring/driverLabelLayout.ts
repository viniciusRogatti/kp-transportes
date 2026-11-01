import type { GoogleDriverLocation } from './googleMapAdapter';

export const driverFirstName = (name: string) => name.trim().split(/\s+/)[0] || 'Motorista';

export const driverMarkerMetrics = (zoom: number) => ({
  size: Math.round(16 + Math.max(0, Math.min(10, zoom - 8))),
  fontSize: 10 + Math.max(0, Math.min(2, (zoom - 8) / 4)),
});

export type DriverLabelLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};
type Rect = { x: number; y: number; width: number; height: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x
  && a.y < b.y + b.height + 3 && a.y + a.height + 3 > b.y;

// Lay out only the name tags in screen pixels. Vehicle anchors stay at the GPS
// coordinate; a leader line connects a displaced tag back to its vehicle.
export function layoutDriverLabels(
  drivers: GoogleDriverLocation[], zoom: number,
  measureText: (text: string, fontSize: number) => number = (text, size) => text.length * size * 0.75,
): Map<string, DriverLabelLayout> {
  const { size, fontSize } = driverMarkerMetrics(zoom);
  const scale = 256 * 2 ** zoom;
  const points = drivers.map(driver => {
    const sine = Math.sin(Math.max(-85, Math.min(85, driver.lat)) * Math.PI / 180);
    return { driver, x: (driver.lng + 180) / 360 * scale,
      y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale };
  }).sort((a, b) => a.driver.id.localeCompare(b.driver.id, 'en', { numeric: true }));
  const occupied: Rect[] = points.map(point => ({ x: point.x - size / 2, y: point.y - size / 2, width: size, height: size }));
  const result = new Map<string, DriverLabelLayout>();
  points.forEach(point => {
    const width = Math.ceil(measureText(driverFirstName(point.driver.driverName), fontSize)) + 12;
    const height = Math.ceil(fontSize) + 6;
    const gap = size / 2 + 4;
    const candidates: Array<Rect & { distance: number }> = [];
    // Search both axes so dense groups spread around their vehicles instead of
    // sending a name far above or below the group in a single vertical column.
    for (let row = 0; row <= points.length; row += 1) {
      const offsets = row === 0 ? [0] : [-row * (height + 4), row * (height + 4)];
      for (const dy of offsets) {
        for (let column = 0; column < 4; column += 1) {
          const distanceX = gap + column * (width + 4);
          for (const dx of [distanceX, -distanceX - width]) {
            candidates.push({ x: point.x + dx, y: point.y - height / 2 + dy, width, height,
              distance: distanceX ** 2 + dy ** 2 });
          }
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const chosen = candidates.find(candidate => !occupied.some(rect => overlaps(candidate, rect)));
    const label = chosen || { x: point.x + gap, y: point.y - height / 2, width, height };
    occupied.push(label);
    result.set(point.driver.id, { ...label, x: label.x - point.x, y: label.y - point.y, fontSize });
  });
  return result;
}
