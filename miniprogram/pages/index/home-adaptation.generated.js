// Generated from the shared adaptation module and home configuration; do not edit.
// Pure ESM; coordinates are window pixels or parent-local design units.
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, max) => Math.min(max, Math.max(0, value));

function dimension(value, name, allowZero = false) {
  if (!finite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new TypeError(`${name} must be a finite ${allowZero ? 'nonnegative' : 'positive'} number`);
  }
  return value;
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

/** Window-local { x, y, width, height, fallback, diagnostics }.
 * Without screenTop, use the whole window rather than guess its screen origin.
 * windowHeight already excludes native UI; statusBarHeight is diagnostic only.
 */
function getAvailableRect(info) {
  const width = dimension(info.windowWidth, 'windowWidth', true);
  const height = dimension(info.windowHeight, 'windowHeight', true);
  const hasScreenTop = finite(info.screenTop);
  const safe = info.safeArea;
  const hasSafeArea = safe && ['left', 'top', 'right', 'bottom'].every((key) => finite(safe[key]))
    && safe.right >= safe.left && safe.bottom >= safe.top;
  const diagnostics = {
    screenTop: hasScreenTop ? info.screenTop : null,
    statusBarHeight: finite(info.statusBarHeight) ? info.statusBarHeight : null,
    fallbackReason: !hasScreenTop ? 'missing-screen-top' : !hasSafeArea ? 'missing-safe-area' : null
  };
  if (!hasScreenTop || !hasSafeArea) {
    return { x: 0, y: 0, width, height, fallback: true, diagnostics };
  }
  const x = clamp(safe.left, width);
  const y = clamp(safe.top - info.screenTop, height);
  const right = clamp(safe.right, width);
  const bottom = clamp(safe.bottom - info.screenTop, height);
  return { x, y, width: right - x, height: bottom - y, fallback: false, diagnostics };
}

/** Contain a fixed design canvas; offsets include the available rect origin. */
function fitHome(design, rect) {
  const width = dimension(design.designWidth, 'designWidth');
  const height = dimension(design.designHeight, 'designHeight');
  dimension(rect.width, 'rect.width', true);
  dimension(rect.height, 'rect.height', true);
  const x = rect.x ?? 0;
  const y = rect.y ?? 0;
  if (!finite(x) || !finite(y)) throw new TypeError('rect.x/y must be finite numbers');
  const scale = Math.min(rect.width / width, rect.height / height);
  return {
    scale,
    offsetX: x + (rect.width - width * scale) / 2,
    offsetY: y + (rect.height - height * scale) / 2
  };
}

/** Return cloned elements, retaining parent-local coordinates and visibility.
 * hitPadding is in unscaled visual design units, with missing sides equal to 0.
 */
function resolveHomeElements(config) {
  const width = dimension(config.designWidth, 'designWidth');
  const height = dimension(config.designHeight, 'designHeight');
  const elements = clone(config.elements);
  const byId = new Map(elements.map((element) => [element.designId, element]));
  for (const element of elements) {
    if (element.type !== 'root') continue;
    Object.assign(element, { x: 0, y: 0, width, height, scale: 1 });
    delete element.heightUnit;
  }
  for (const hit of elements) {
    if (hit.type !== 'hit') continue;
    const followsElementId = hit.followsElementId ?? 'index-primary-background';
    const visual = byId.get(followsElementId);
    if (!visual || visual === hit || visual.type === 'hit' || visual.parentId !== hit.parentId) {
      throw new TypeError(`${hit.designId}: followsElementId must reference a visual element with the same parentId`);
    }
    const scale = dimension(visual.scale, `${visual.designId}.scale`);
    const padding = hit.hitPadding ?? {};
    const [top, right, bottom, left] = ['top', 'right', 'bottom', 'left'].map((side) =>
      dimension(padding[side] ?? 0, `hitPadding.${side}`, true));
    // Width/height are scaled by the renderer; only the local origin needs scale here.
    Object.assign(hit, {
      followsElementId,
      x: visual.x - left * scale,
      y: visual.y - top * scale,
      width: visual.width + left + right,
      height: visual.height + top + bottom,
      scale
    });
    delete hit.heightUnit;
  }
  return elements;
}

module.exports = { getAvailableRect, fitHome, resolveHomeElements, design: {"designWidth":750,"designHeight":1500} };
