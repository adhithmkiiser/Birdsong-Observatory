export function getSpeciesGradientColor(count: number, minCount: number, maxCount: number): string {
  if (maxCount <= minCount) return '#10b981'; // Green fallback
  const t = Math.max(0, Math.min(1, (count - minCount) / (maxCount - minCount)));
  
  // Interpolate RGB from Forest/Emerald Green (16, 185, 129) to Amber Yellow (245, 158, 11) to Crimson Red (239, 68, 68)
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const localT = t * 2; // 0 to 1
    // Green (16, 185, 129) -> Yellow (245, 158, 11)
    r = Math.round(16 + localT * (245 - 16));
    g = Math.round(185 + localT * (158 - 185));
    b = Math.round(129 + localT * (11 - 129));
  } else {
    const localT = (t - 0.5) * 2; // 0 to 1
    // Yellow (245, 158, 11) -> Red (239, 68, 68)
    r = Math.round(245 + localT * (239 - 245));
    g = Math.round(158 + localT * (68 - 158));
    b = Math.round(11 + localT * (68 - 11));
  }
  return `rgb(${r}, ${g}, ${b})`;
}
