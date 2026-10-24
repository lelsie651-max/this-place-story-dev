// Pure ESM: shared by the browser preview and the Node generator.
import { resolveHomeElements } from './home-adaptation.js';
export const HOME_FONT_STACK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const ROOT = 'index-page';
const CONTENT = 'index-recommendation-content';
const TYPES = Object.fromEntries([
  ['page', 'root'], ['background-image', 'image'], ['primary-region', 'group'],
  ['primary-button', 'hit'], ['primary-background', 'image'], ['primary-icon', 'icon'],
  ['primary-label', 'text'], ['recommendation-section', 'group'],
  ['recommendation-outer-frame', 'image'], ['recommendation-heading', 'text'],
  ['recommendation-subtitle', 'text'], ['recommendation-content', 'group'],
  ['recommendation-inner-frame', 'image'], ['recommendation-cover', 'image'],
  ['recommendation-tag-group', 'group'], ['recommendation-tag-background', 'decoration'],
  ['recommendation-tag-text', 'text'], ['recommendation-title', 'text'],
  ['recommendation-location', 'text'], ['recommendation-summary', 'text'],
  ['recommendation-action-label', 'text'], ['recommendation-dots', 'group'],
  ['recommendation-dot-1', 'dot'], ['recommendation-dot-2', 'dot'],
  ['recommendation-dot-3', 'dot']
].map(([id, type]) => [`index-${id}`, type]));
const TEXT_BINDINGS = new Set(['label', 'displayTitle', 'locationName', 'displaySummary', 'actionText']);
const IMAGE_TYPES = new Set(['image', 'icon', 'decoration']);
const MODES = new Set(['aspectFill', 'aspectFit', 'scaleToFill']);
const REQUIRED = ['designId', 'name', 'note', 'parentId', 'type', 'visible', 'x', 'y',
  'width', 'height', 'scale', 'imagePath', 'imageMode', 'imageCropX', 'imageCropY',
  'text', 'textBinding', 'fontSize', 'fontWeight', 'color', 'lineHeight', 'textAlign', 'followParent',
  'letterSpacing', 'textShadow', 'opacity', 'fontFamily', 'fontAssetId'];
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const literal = (value) => escape(value).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
const number = (value) => Number(value.toFixed(6));
const safeColor = (value) => typeof value === 'string'
  && /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|transparent|[a-z]+)$/i.test(value);
const normalizedAssetPath = (value) => String(value || '').replace(/^miniprogram\//, '/').split('/').filter((part) => part && part !== '.').join('/');

function validPath(value) {
  return typeof value === 'string' && (value === '' || (
    !/[\s<>"'{}\\\x00-\x1f]/.test(value)
    && !value.split('/').includes('..')
    && /^(miniprogram\/assets\/|\/assets\/|https:\/\/)/.test(value)
  ));
}

function validShadow(value) {
  if (value === '' || value === 'none') return true;
  if (typeof value !== 'string') return false;
  const match = value.match(/^(-?\d+(?:\.\d+)?(?:px)?)\s+(-?\d+(?:\.\d+)?(?:px)?)\s+(\d+(?:\.\d+)?(?:px)?)\s+(.+)$/);
  return Boolean(match && match.slice(1, 4).every((part) => part.endsWith('px') || Number(part) === 0) && safeColor(match[4]));
}

/** Returns { valid, errors }; never mutates or repairs the source config. */
export function validateHomeConfig(config) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: ['配置必须为对象'] };
  }
  if (config.version !== 2) fail('配置版本必须为 2');
  if (typeof config.pageName !== 'string' || !config.pageName.trim()) fail('pageName 必须为非空字符串');
  if (!Array.isArray(config.notes) || config.notes.some((note) => typeof note !== 'string')) fail('notes 必须为字符串数组');
  if (config.unit !== 'design' || !finite(config.designWidth) || config.designWidth <= 0
    || !finite(config.designHeight) || config.designHeight <= 0 || config.referenceWidth !== config.designWidth) fail('固定设计尺寸无效');
  if (!safeColor(config.pageBackground)) fail('页面底色无效');
  if (!Array.isArray(config.elements)) return { valid: false, errors: [...errors, 'elements 必须为数组'] };
  const byId = new Map();
  if (!config.fixedLayers || typeof config.fixedLayers !== 'object' || Array.isArray(config.fixedLayers)
    || Object.entries(config.fixedLayers).some(([id, value]) => !Object.hasOwn(TYPES, id) || !Number.isInteger(value) || value < 0)) {
    fail('固定图层配置无效');
  }
  for (const e of config.elements) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { fail('元素必须为对象'); continue; }
    const id = e.designId;
    for (const key of REQUIRED) if (!Object.hasOwn(e, key) || e[key] === undefined) fail(`${id}: 缺少必填字段 ${key}`);
    for (const key of ['designId', 'name', 'note', 'text', 'textBinding']) {
      if (typeof e[key] !== 'string' || (['designId', 'name'].includes(key) && !e[key].trim())) fail(`${id}: ${key} 字符串无效`);
    }
    if (!Object.hasOwn(TYPES, id) || TYPES[id] !== e.type) fail(`${id}: 不支持的 designId/type`);
    if (byId.has(id)) fail(`${id}: designId 重复`);
    byId.set(id, e);
    for (const key of ['x', 'y', 'width', 'height', 'scale']) {
      if (!finite(e[key]) || (['width', 'height', 'scale'].includes(key) && e[key] <= 0)) fail(`${id}: ${key} 必须为有效数值，尺寸和缩放必须大于零`);
    }
    for (const key of ['visible', 'followParent']) {
      if (typeof e[key] !== 'boolean') fail(`${id}: ${key} 必须为布尔值`);
    }
    if (id !== ROOT && e.followParent !== true) fail(`${id}: 子项 followParent 必须固定为 true`);
    if (e.heightUnit != null) fail(`${id}: 所有尺寸必须使用同一设计单位`);
    if (!finite(e.letterSpacing) || !finite(e.opacity) || e.opacity < 0 || e.opacity > 1 || !validShadow(e.textShadow)) fail(`${id}: 字间距、阴影或透明度无效`);
    if (e.fontFamily !== '' || e.fontAssetId !== '') fail(`${id}: 字体资源目前仅允许空值预留`);
    if (id === 'index-primary-background') {
      if (e.imagePath !== '' || config.defaultImages?.[id] !== '') fail('按钮不能使用旧图片回退');
      if (!validPath(e.runtimeImagePath) || !validPath(e.editorDebugImagePath) || typeof e.editorDebugVisible !== 'boolean') fail('按钮正式图片或辅助图片配置无效');
      if (e.runtimeImagePath && normalizedAssetPath(e.runtimeImagePath) === normalizedAssetPath(config.defaultEditorImages?.[id])) fail('棕色辅助图不能作为正式图片');
    }
    if (e.type === 'hit') {
      if (e.followsElementId !== 'index-primary-background' || !e.hitPadding
        || ['top', 'right', 'bottom', 'left'].some((side) => !finite(e.hitPadding[side]) || e.hitPadding[side] < 0)) fail('点击范围必须跟随按钮视觉区域并使用非负扩展值');
    }
    if (IMAGE_TYPES.has(e.type)) {
      if (typeof e.imageCleared !== 'boolean') fail(`${id}: imageCleared 为必填布尔值`);
      if (!MODES.has(e.imageMode)) fail(`${id}: imageMode 必须指定受支持的模式`);
      for (const key of ['imageCropX', 'imageCropY']) if (!finite(e[key])) fail(`${id}: ${key} 为必填数值`);
    }
    if (!validPath(e.imagePath)) fail(`${id}: imagePath 无效`);
    if (e.imageMode != null && !MODES.has(e.imageMode)) fail(`${id}: 不支持的 imageMode`);
    for (const key of ['imageCropX', 'imageCropY']) {
      if (e[key] != null && (!finite(e[key]) || e[key] < 0 || e[key] > 100)) fail(`${id}: ${key} 必须为 0..100`);
    }
    for (const key of ['fontSize', 'lineHeight', 'radius']) {
      if (e[key] != null && (!finite(e[key]) || e[key] < 0)) fail(`${id}: ${key} 无效`);
    }
    if (e.fontWeight != null && (!Number.isInteger(e.fontWeight) || e.fontWeight < 100 || e.fontWeight > 900)) fail(`${id}: fontWeight 无效`);
    if (e.maxLines != null && (!Number.isInteger(e.maxLines) || e.maxLines < 1)) fail(`${id}: maxLines 无效`);
    if (e.textAlign != null && !['left', 'center', 'right'].includes(e.textAlign)) fail(`${id}: textAlign 无效`);
    for (const key of ['color', 'selectedColor']) {
      if (e[key] != null && !safeColor(e[key])) fail(`${id}: ${key} 无效`);
    }
    if (e.textBinding && (e.type !== 'text' || !TEXT_BINDINGS.has(e.textBinding))) fail(`${id}: 不支持的 textBinding`);
    if (e.imageBinding != null && (id !== 'index-recommendation-cover' || e.imageBinding !== 'coverImage')) fail(`${id}: 不支持的 imageBinding`);
    if (id === 'index-recommendation-cover' && e.imageBinding !== 'coverImage') fail(`${id}: imageBinding 必须为 coverImage`);
    if (e.type === 'dot' && (e.dotIndex !== Number(String(id).slice(-1)) - 1 || !safeColor(e.color) || !safeColor(e.selectedColor))) fail(`${id}: dotIndex/color/selectedColor 为必填且必须有效`);
    if (['text', 'icon'].includes(e.type)) {
      for (const key of ['fontSize', 'lineHeight']) if (!finite(e[key]) || e[key] <= 0) fail(`${id}: ${key} 为必填正数`);
      if (e.fontWeight == null || e.textAlign == null || !safeColor(e.color)) fail(`${id}: 缺少有效文字样式`);
    }
    if (e.type === 'decoration' && !safeColor(e.color)) fail(`${id}: 缺少有效底色`);
  }
  for (const id of Object.keys(TYPES)) if (!byId.has(id)) fail(`${id}: 缺少元素`);
  for (const e of byId.values()) {
    if (e.designId === ROOT) {
      if (e.parentId !== null || e.followParent !== false || e.x !== 0 || e.y !== 0 || e.scale !== 1
        || e.width !== config.designWidth || e.height !== config.designHeight) fail(`${ROOT}: 根节点配置无效`);
      continue;
    }
    if (typeof e.parentId !== 'string') fail(`${e.designId}: parentId 必须为字符串`);
    if (['index-primary-region', 'index-recommendation-section'].includes(e.designId) && e.parentId !== ROOT) fail(`${e.designId}: 功能区域必须直属根节点`);
    if (e.type === 'hit' && e.parentId !== 'index-primary-region') fail(`${e.designId}: 点击层必须直属按钮区域`);
    const seen = new Set([e.designId]);
    let cursor = e;
    while (cursor.designId !== ROOT) {
      const parent = byId.get(cursor.parentId);
      if (!parent || !['root', 'group'].includes(parent.type)) { fail(`${e.designId}: 父节点无效`); break; }
      if (seen.has(parent.designId)) { fail(`${e.designId}: 父子关系存在循环`); break; }
      seen.add(parent.designId);
      cursor = parent;
    }
    if ((e.textBinding || e.imageBinding) && !seen.has(CONTENT)) fail(`${e.designId}: 动态绑定必须位于推荐内容内`);
    if (e.designId === CONTENT && e.parentId !== 'index-recommendation-section') fail(`${CONTENT}: 必须直属推荐区域`);
    if (e.type === 'hit' && seen.has(CONTENT)) fail('按钮不能位于推荐内容内');
    if (e.type === 'dot' && seen.has(CONTENT)) fail('轮播小点不能位于推荐内容内');
  }
  if (!config.defaultImages || typeof config.defaultImages !== 'object' || Array.isArray(config.defaultImages)) {
    fail('defaultImages 必须为对象');
  } else {
    for (const [id, type] of Object.entries(TYPES)) {
      if (IMAGE_TYPES.has(type) && !Object.hasOwn(config.defaultImages, id)) fail(`${id}: 缺少 defaultImages 默认路径`);
    }
    for (const [id, value] of Object.entries(config.defaultImages)) {
      if (!IMAGE_TYPES.has(TYPES[id]) || !validPath(value)) fail(`${id}: 默认图片路径无效`);
    }
  }
  for (const field of ['defaultRuntimeImages', 'defaultEditorImages']) {
    if (!config[field] || !validPath(config[field]['index-primary-background'])) fail(`${field}: 缺少按钮默认资源定义`);
  }
  if (config.defaultRuntimeImages?.['index-primary-background']) fail('默认正式按钮图片必须为空，不回退辅助图');
  return { valid: errors.length === 0, errors };
}

function assertConfig(config) {
  const result = validateHomeConfig(config);
  if (!result.valid) throw new TypeError(`首页配置无效：\n${result.errors.join('\n')}`);
}

/** Design pixels are transformed once by the fitted root in both renderers. */
export function elementStyle(element, unit = 'px') {
  if (unit !== 'px') throw new TypeError('设计单位只输出 px，由根区域统一缩放');
  const e = element;
  const css = [
    'position:absolute', 'box-sizing:border-box', 'margin:0', 'padding:0',
    `left:${number(e.x)}${unit}`, `top:${number(e.y)}${unit}`,
    `width:${number(e.width)}${unit}`, `height:${number(e.height)}${unit}`,
    `transform:scale(${number(e.scale)})`, 'transform-origin:0 0',
    `overflow:${['group', 'root'].includes(e.type) ? 'visible' : 'hidden'}`
  ];
  css.push(`pointer-events:${e.type === 'hit' ? 'auto' : 'none'}`);
  if (e.layer != null) css.push(`z-index:${e.layer}`);
  if (e.radius != null) css.push(`border-radius:${e.radius}${unit}`);
  if (e.fontSize != null) css.push(`font-size:${e.fontSize}${unit}`);
  if (e.fontWeight != null) css.push(`font-weight:${e.fontWeight}`);
  if (e.lineHeight != null) css.push(`line-height:${e.lineHeight}`);
  if (e.textAlign) css.push(`text-align:${e.textAlign}`);
  if (e.color && e.type !== 'decoration' && e.type !== 'dot') css.push(`color:${e.color}`);
  if (['text', 'icon'].includes(e.type)) {
    css.push(`letter-spacing:${number(e.letterSpacing)}px`, `text-shadow:${e.textShadow || 'none'}`);
  }
  if (!['group', 'root', 'hit'].includes(e.type)) css.push(`opacity:${number(e.opacity)}`);
  if (e.maxLines === 1) css.push('white-space:nowrap', 'text-overflow:ellipsis');
  if (e.maxLines > 1) css.push('display:-webkit-box', '-webkit-box-orient:vertical', `-webkit-line-clamp:${e.maxLines}`, 'text-overflow:ellipsis');
  if (!e.visible && !['group', 'hit', 'root'].includes(e.type)) css.push('display:none');
  return `${css.join(';')};`;
}

function imagePath(config, e, target) {
  if (e.imageCleared) return '';
  const value = e.designId === 'index-primary-background'
    ? (target === 'preview' && e.editorDebugVisible && e.editorDebugImagePath ? e.editorDebugImagePath : e.runtimeImagePath)
    : e.imagePath || config.defaultImages[e.designId] || '';
  if (target === 'wxml') return value.replace(/^miniprogram\//, '/');
  return previewSource(value);
}

function previewSource(value) {
  if (!value) return '';
  const projectPath = value.startsWith('/assets/') ? `miniprogram${value}` : value;
  return `/__design_editor/home-asset?path=${encodeURIComponent(projectPath)}`;
}

function cropStyle(e) {
  const x = e.imageCropX ?? 50;
  const y = e.imageCropY ?? 50;
  // Overscan keeps native aspectFill cropping opaque without image-load handlers.
  const extra = (e.imageMode || 'aspectFill') === 'aspectFill' ? 2 * Math.max(Math.abs(x - 50), Math.abs(y - 50)) : 0;
  return `position:absolute;display:block;width:${100 + extra}%;height:${100 + extra}%;left:${number(-extra * x / 100)}%;top:${number(-extra * y / 100)}%;pointer-events:none;`;
}

function imageMarkup(config, e, target, record) {
  if (e.imageCleared) return '';
  const local = imagePath(config, e, target);
  let source = local;
  if (target === 'wxml' && e.imageBinding) source = `{{item.${e.imageBinding} || '${local}'}}`;
  if (target === 'preview' && e.imageBinding) source = record[e.imageBinding] ? previewSource(String(record[e.imageBinding])) : local;
  if (!source) {
    if (e.type === 'icon') return literal(e.text);
    if (e.type === 'decoration') return `<${target === 'wxml' ? 'view' : 'div'} style="width:100%;height:100%;background:${escape(e.color || 'transparent')};"></${target === 'wxml' ? 'view' : 'div'}>`;
    return '';
  }
  const style = cropStyle(e);
  if (target === 'wxml') return `<image src="${e.imageBinding ? source : escape(source)}" mode="${e.imageMode || 'aspectFill'}" style="${style}" />`;
  const fit = { aspectFill: 'cover', aspectFit: 'contain', scaleToFill: 'fill' }[e.imageMode || 'aspectFill'];
  return `<img src="${escape(source)}" alt="" draggable="false" style="${style}object-fit:${fit};" />`;
}

function node(config, e, target, record = {}, current = 0, count = 3, children = '') {
  const preview = target === 'preview';
  const tag = e.type === 'hit' ? 'button' : preview ? 'div' : 'view';
  let extra = '';
  let body = children;
  let style = preview ? elementStyle(e, 'px') : '';
  if (e.type === 'root') return '';
  if (e.type === 'hit') {
    extra = preview ? ' type="button" aria-label="寻找传说" data-action="goToExplore"' : ' bindtap="goToExplore" aria-label="寻找传说"';
    style += `z-index:${config.fixedLayers[e.designId] ?? 0};pointer-events:auto;background:transparent;border:0;box-shadow:none;min-height:0;`;
  } else {
    style += 'pointer-events:none;';
  }
  if (e.type === 'group') extra += ` data-group-visible="${e.visible}"`;
  if (e.type === 'text') {
    body = e.text !== '' ? literal(e.text) : !preview && e.textBinding
      ? `{{item.${e.textBinding}}}` : literal(e.textBinding ? record[e.textBinding] ?? '' : '');
  }
  if (IMAGE_TYPES.has(e.type)) body = imageMarkup(config, e, target, record);
  if (e.type === 'dot') {
    if (preview && e.dotIndex >= count) style += 'display:none;';
    if (!preview) extra += ` wx:if="{{!recommendationLoading && recommendationCards.length > ${e.dotIndex}}}"`;
    const color = preview ? (current === e.dotIndex ? e.selectedColor : e.color)
      : `{{currentRecommendationIndex === ${e.dotIndex} ? '${e.selectedColor || e.color}' : '${e.color}'}}`;
    style += `background:${color || 'transparent'};`;
  }
  const attributeStyle = !preview && e.type === 'dot' ? style : escape(style);
  return `<${tag} class="home-element ${e.designId}" data-design-id="${e.designId}"${extra} style="${attributeStyle}">${body}</${tag}>`;
}

function render(config, target, record = {}, current = 0, count = 3) {
  assertConfig(config);
  const elements = resolveHomeElements(config).map((element) => ({ ...element, layer: config.fixedLayers[element.designId] }));
  const root = elements.find((e) => e.designId === ROOT);
  const preview = target === 'preview';
  const childrenByParent = new Map();
  for (const e of elements) {
    if (!childrenByParent.has(e.parentId)) childrenByParent.set(e.parentId, []);
    childrenByParent.get(e.parentId).push(e);
  }
  function renderNode(e) {
    const children = (childrenByParent.get(e.designId) || []).map(renderNode).join('\n');
    if (e.designId !== CONTENT) return node(config, e, target, record, current, count, children);
    if (preview) {
      const wrapper = count > 0 ? `<div class="home-swiper" style="position:relative;width:100%;height:100%;pointer-events:auto;overflow:hidden;"><div class="home-slide" data-action="goToRecommendation" data-story-id="${escape(record.storyId || '')}" style="position:relative;width:100%;height:100%;pointer-events:auto;overflow:hidden;">${children}</div></div>` : `<div class="home-state" style="position:relative;width:100%;height:100%;overflow:hidden;">${record.previewLoading ? '推荐加载中' : literal(record.recommendationEmptyText || '推荐内容正在整理中')}</div>`;
      return node(config, e, target, record, current, count, wrapper);
    }
    const wrapper = `
  <view wx:if="{{recommendationLoading}}" class="home-state" aria-label="推荐加载中">推荐加载中</view>
  <swiper wx:elif="{{recommendationCards.length > 0}}" class="home-swiper" current="{{currentRecommendationIndex}}" bindchange="onRecommendationChange" indicator-dots="{{false}}" autoplay="{{false}}" circular="{{false}}" display-multiple-items="1">
    <swiper-item wx:for="{{recommendationCards}}" wx:key="storyId">
      <view class="home-slide" bindtap="goToRecommendation" data-story-id="{{item.storyId}}">
${children}
      </view>
    </swiper-item>
  </swiper>
  <view wx:else class="home-state">{{recommendationEmptyText}}</view>`;
    return node(config, e, target, record, current, count, wrapper);
  }
  const output = (childrenByParent.get(ROOT) || []).map(renderNode).join('\n');
  if (preview) {
    const style = elementStyle(root).replace('position:absolute', 'position:relative');
    return `<div class="home-preview" data-design-id="${ROOT}" style="${style}">${output}</div>`;
  }
  return `<!-- Generated from design/home-index-elements.json; do not edit. -->\n<view class="home-window" style="width:{{homeWindowWidth}}px;height:{{homeWindowHeight}}px;">\n<view wx:if="{{homeLayoutReady}}" class="home-layout ${ROOT}" data-design-id="${ROOT}" style="left:{{homeOffsetX}}px;top:{{homeOffsetY}}px;transform:scale({{homeScale}});">\n${output}\n</view>\n</view>\n`;
}

/** Returns HTML at design-pixel size; the host owns zoom, selection and image serving. */
export function renderHomePreview(config, record = {}, current = 0, count = 3) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || !Number.isInteger(count) || count < 0 || !Number.isInteger(current) || current < 0) {
    throw new TypeError('record 必须为对象，current/count 必须为非负整数');
  }
  return render(config, 'preview', record, current, count);
}

export function renderHomeWxml(config) {
  return render(config, 'wxml');
}

export function renderHomeWxss(config) {
  assertConfig(config);
  const elements = resolveHomeElements(config).map((element) => ({ ...element, layer: config.fixedLayers[element.designId] }));
  const rules = elements.map((e) => `.home-layout.${e.designId}, .home-layout .${e.designId} { ${elementStyle(e)} }`);
  return `/* Generated from design/home-index-elements.json; do not edit. */
page { height:100%; min-height:0; overflow:hidden; background:${config.pageBackground}; }
.home-window { position:fixed; left:0; top:0; overflow:hidden; background:${config.pageBackground}; }
.home-layout { padding:0; margin:0; overflow:visible; transform-origin:0 0; font-family:${HOME_FONT_STACK}; }
.home-element { pointer-events:none; }
.home-swiper, .home-slide { pointer-events:auto; }
.home-swiper, .home-slide, .home-state { position:relative; width:100%; height:100%; margin:0; padding:0; box-sizing:border-box; }
.home-slide { overflow:hidden; }
.home-state { overflow:hidden; pointer-events:none; }
.home-layout .index-primary-button::after { border:0; }
${rules.join('\n')}
`;
}

export function renderHomeGuide(config) {
  assertConfig(config);
  const cell = (value) => escape(value).replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ');
  const rows = resolveHomeElements(config).map((e) => `| ${cell(e.designId)} | ${cell(e.name)} | ${cell(e.parentId || '-')} | ${e.type} | ${e.visible} | ${e.x}, ${e.y} | ${e.width} x ${e.height} ${config.unit} | ${cell(e.imagePath)} | ${cell(config.defaultImages[e.designId] || '')} | ${cell(e.note)} |`);
  return `# 首页布局控制指南

唯一人工维护来源：\`design/home-index-elements.json\`（v2）。WXML、WXSS、本指南与运行时适配模块均为生成产物，不应独立维护。

## 固定画布与安全区

- 当前设计画布为 ${config.designWidth}×${config.designHeight}，unit=design，referenceWidth 仅兼容旧字段且必须等于 designWidth。设计单位输出为 px，再由根区域统一缩放，不是 rpx 或 vh。
- 当前背景目标宽高比为 1:2，对应 750×1500 设计画布；不能仅凭文件名、扩展名或配置认定真实比例。正常生成入口读取本地 PNG 头，检查八字节签名、至少 24 字节长度及偏移 16/20 的非零宽高，再比较 designWidth × 图片高度 / 图片宽度与 designHeight；这不是完整 PNG 解码校验。
- 当前非背景元素的最下边界为推荐区域 650 + 450 = 1100，画布高度 1500 覆盖此边界。以上为设计比例与配置边界推导，不是真机测量，也不代表背景 PNG 头已经校验通过。
- 编辑器与小程序共用 getAvailableRect/fitHome/resolveHomeElements。safeArea 是屏幕坐标，使用 screenTop 转成窗口局部坐标后与窗口相交；缺少有效 screenTop 或 safeArea 时回退整个窗口并记录 diagnostics，不猜测屏幕原点。
- windowHeight 已扣除原生导航栏和 tabBar，不再减 tabBar、高度常量或底部安全区；statusBarHeight 仅供诊断。不能在页面、编辑器和共享函数中重复扣减。
- 统一 contain：scale = min(可用宽 / 设计宽, 可用高 / 设计高)，offsetX/Y = 可用区域起点 + 剩余空间 / 2。整张背景、按钮、推荐及文字共用根变换，背景 aspectFit 保持完整比例，留白使用 pageBackground，不逐个元素重新适配。

## 坐标与显隐

- x/y/width/height 使用固定设计单位，scale 以左上角为原点；不再支持 heightUnit。
- 子项 followParent 固定为 true，只有根节点为 false。WXML/HTML 按 parentId 真实嵌套，x/y 始终为局部坐标，随父级平移和缩放，不累计为根坐标。宽高不重排兄弟节点。
- group.visible 只是编辑标记，不隐藏后代；hit.visible 不禁用原生 button。根节点一直保留。
- 固定单屏，通过 contain 完整容纳设计范围内的内容，不以裁切必要内容代替适配。窗口 overflow 仅用于防止用户将元素移出设计范围后产生滚动；编辑器提示越界。装饰层 pointer-events:none；按钮和轮播功能层 pointer-events:auto。
- 固定层级由配置 fixedLayers 与 elements 数组顺序共同决定：fixedLayers 指定节点层级，同级节点按数组顺序渲染，后项在前项之上。应保持按钮区域高于推荐区域，避免推荐阻挡按钮点击。
- text 非空时覆盖展示；text 为空字符串时继续使用 textBinding 动态数据，预览与小程序保持一致，不修改故事数据。

## 按钮命中与资源隔离

- index-primary-button 的 followsElementId 固定为同父级 index-primary-background；点击几何为只读派生值，不独立维护。hitPadding 四边非负，单位为底图缩放前的设计单位，零表示贴合底图矩形，不按透明像素轮廓命中。
- 设底图缩放为 s：命中 x = 底图 x - left × s，y = 底图 y - top × s，width = 底图 width + left + right，height = 底图 height + top + bottom，scale = s；父级与根缩放继续统一作用。元素清单列出派生后的几何。
- 正式按钮只读取 runtimeImagePath，默认空值不回退旧棕色图；imagePath/defaultImages 的按钮项保持为空。editorDebugImagePath 与 editorDebugVisible 仅供编辑预览，不输出到正式 WXML。
- 恢复按钮默认资源分别读取 defaultRuntimeImages/defaultEditorImages；替换、清除或隐藏辅助图不改变命中跟随关系。底图 visible=false、透明或正式图片为空都不禁用原生按钮，文字和图标仍是独立节点。

## 文字字段

- text/textBinding 控制展示覆盖与动态绑定；fontSize 为设计单位，fontWeight 为 100..900 的整数字重，color 为颜色，lineHeight 为无单位倍数，textAlign 为 left/center/right，maxLines 控制截断行数。
- letterSpacing 为设计单位并允许负值；textShadow 支持单组横向偏移、纵向偏移、非负模糊和颜色，例如 0 2px 4px rgba(0,0,0,0.3)，空值或 none 表示无阴影。它们与文字一起随根区域缩放。
- opacity 为 0..1，只作用于非 group/root/hit 的自身视觉，不叠加淡化组后代，也不关闭点击。
- fontFamily/fontAssetId 当前必须为空，仅预留字段，不上传或加载字体。共用字体栈为 PingFang SC、Hiragino Sans GB、Microsoft YaHei、sans-serif；不同平台字形仍需实测。

## 图片操作

- 隐藏：visible=false；恢复显示：visible=true，路径不变。
- 清除：imageCleared=true，禁止动态图、默认图、字符和底色回退。单改 visible 不会撤销清除。
- 恢复普通元素默认图：imageCleared=false，imagePath 设为 defaultImages[designId]（或留空使用默认图）；保留 visible 原值，不自动显示原本隐藏的元素。按钮使用前述独立默认映射。
- 替换普通图片填 imagePath，按钮正式/辅助图分别填 runtimeImagePath/editorDebugImagePath，并设 imageCleared=false。仅支持 miniprogram/assets/ 项目路径、/assets/ 小程序路径和 HTTPS 地址；固定背景比例核对要求使用本地 PNG。
- 上传图片先暂存供编辑器预览；点击保存后才复制到项目素材目录。上传不等于保存，也不会立即覆盖当前页面素材。
- 封面优先使用 item.coverImage，无动态图时使用本地回退。网络加载失败不自动切换回退图。
- 放大镜字符和标签底色是临时回退，填图片路径即可替换。
- 透明 PNG 应优先选择 aspectFit（完整显示），保留透明像素及整张图片比例，不裁切、不拉伸；透明区域露出下层，不等同于清除背景。aspectFill（填满裁切）可能裁掉透明边缘和画面，scaleToFill（拉伸铺满）可能变形。
- imageMode: aspectFill/aspectFit/scaleToFill。imageCropX/Y=0..100 是放大取景的临时控件限制，不是标准焦点裁切，也不是原图像素裁切。50 为居中；aspectFill 偏离中心时额外放大，最多两倍防止露白，会改变可见范围。其他模式忽略取景值。
- 背景已内嵌的按钮、标题、框和装饰无法通过独立节点开关删除。

## 业务边界

- button 保留 goToExplore；推荐保留 goToRecommendation 和 item.storyId。不修改数据、路由、云函数。
- swiper 绑定 onRecommendationChange/currentRecommendationIndex；仅由 change 事件处理同步当前索引，不修改推荐数据读取函数，也不承诺数据更新时重置索引。此模块仅负责展示与绑定。
- 三个小点按有效推荐数量显示；预览 record 由调用方传入，不是业务数据源。
- 预览以固定设计画布渲染，宿主通过共享适配函数提供缩放和偏移；窗口预设或导入 wx.getWindowInfo() JSON 只影响预览，不写入设计配置。图片 src 统一为 /__design_editor/home-asset?path=编码路径；/assets/ 转为 miniprogram/assets/ 项目路径，HTTPS 地址也经过该入口。

## 配置备注

${config.notes.map((note) => `- ${cell(note)}`).join('\n')}

## 保存、生成与校验

- 编辑器保存时备份将被覆盖的现有文件，复制本次暂存上传素材，并写入唯一配置 \`design/home-index-elements.json\` 及四份产物：\`miniprogram/pages/index/index.wxml\`、\`miniprogram/pages/index/index.wxss\`、\`docs/home-layout-controls-guide.md\`、\`miniprogram/pages/index/home-adaptation.generated.js\`。
- 保存前的编辑和上传仅用于草稿预览；以保存成功结果确认落盘，失败时查看错误和备份，不将预览当作已保存。

\`node scripts/home-generator.js --check\` 先检查本地背景 PNG 头及设计比例，再只读比较四份产物，缺失或不一致时退出码 1。不带 --check 会写入四份产物；该命令不等同于编辑器保存，不负责写回配置、处理暂存上传或创建编辑器保存备份。

运行时模块由 core 读取共享 home-adaptation.js 源码，去掉 export function 的 export，并按 core 格式追加 CommonJS 导出 getAvailableRect、fitHome、resolveHomeElements 和 design 尺寸；不得另写一套适配算法。

若 Node 被宿主策略阻止，不绕过策略；只能按已读取的配置、共享渲染及 core 规则用 apply_patch 精确投影四份产物，并在审计中标注未自动校验。静态投影不等于生成命令或 --check 已通过；恢复正常执行环境后必须补跑。

当前没有 DevTools 或真机验证结论。需补验背景 PNG 头、不同窗口与缺失 screenTop 的回退、tabBar/安全区、留白、透明完整图片、按钮命中、文字截断、推荐轮播和页面跳转；不能将预览或静态配置称作真机验收。

## 元素清单

| designId | 名称 | parentId | type | visible | x, y | width x height | imagePath | defaultImages | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
}
