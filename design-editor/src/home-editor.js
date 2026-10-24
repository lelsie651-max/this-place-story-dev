import homeElements from '../../design/home-index-elements.json';
import { validateHomeConfig, renderHomePreview, HOME_FONT_STACK } from '../shared/home-layout.js';
import { getAvailableRect, fitHome, resolveHomeElements } from '../shared/home-adaptation.js';
import { PAGE_SAMPLE_DATA } from '../shared/preview-data.js';
import './home-editor.css';

const CONFIG_URL = '/__design_editor/home-config';
const UPLOAD_URL = '/__design_editor/home-upload';
const ASSET_URL = '/__design_editor/home-asset';
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const PREVIEW_SIZES = [
  { width: 360, height: 720 },
  { width: 375, height: 750 },
  { width: 390, height: 780 },
  { width: 414, height: 828 }
];
const BUTTON_BACKGROUND_ID = 'index-primary-background';
const IMAGE_FIELDS = new Set(['imagePath', 'runtimeImagePath', 'editorDebugImagePath']);
const PADDING_SIDES = [['top', '上边'], ['right', '右边'], ['bottom', '下边'], ['left', '左边']];
class EditorMessage extends Error {}

function errorMessage(error, fallback) {
  return error instanceof EditorMessage ? error.message : fallback;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function editableConfig(source) {
  return syncGeometry(clone(source));
}

function resolvedElements(config) {
  return resolveHomeElements(config);
}

function syncGeometry(config) {
  // Store the shared derivation too, so submitted JSON has no stale hit geometry.
  config.elements = resolvedElements(config);
  return config;
}

function imageUrl(path) {
  const value = String(path || '').trim().replace(/\\/g, '/');
  if (!value) return '';
  if (value.startsWith(`${ASSET_URL}?path=`) || /^https:\/\//i.test(value)) return value;
  const projectPath = value.replace(/^\/@fs\//, '').replace(/^\/assets\//, 'miniprogram/assets/').replace(/^\.?\//, '');
  if (!projectPath.startsWith('miniprogram/') || projectPath.split('/').includes('..')) return '';
  return `${ASSET_URL}?path=${encodeURIComponent(projectPath)}`;
}

function validation(config) {
  try {
    if (config.version !== 2 || config.unit !== 'design') return { valid: false, warningCount: 0 };
    const result = validateHomeConfig({ ...config, elements: resolvedElements(config) });
    const errors = Array.isArray(result) ? result : result?.errors || [];
    return {
      valid: result !== false && result?.valid !== false && result?.ok !== false && errors.length === 0,
      warningCount: Array.isArray(result?.warnings) ? result.warnings.length : 0
    };
  } catch {
    return { valid: false, warningCount: 0 };
  }
}

function readEnvelope(payload) {
  if (!payload || !Array.isArray(payload.config?.elements) || payload.revision == null) {
    throw new EditorMessage('读取结果不完整，请稍后重试。');
  }
  const config = editableConfig(payload.config);
  const elements = config.elements;
  // The source catalog owns membership and hierarchy, never the editor controls.
  if (elements.length !== homeElements.elements.length || homeElements.elements.some((item) => {
    const matches = elements.filter((entry) => entry.designId === item.designId);
    return matches.length !== 1 || matches[0].parentId !== item.parentId || matches[0].type !== item.type;
  }) || !validation(config).valid) {
    throw new EditorMessage('首页配置无法使用，请检查配置后重新读取。');
  }
  return { config, revision: payload.revision, persisted: JSON.stringify(payload.config) };
}

/** Mount synchronously; loading is asynchronous. dispose() is idempotent. */
export function mountHomeEditor(host, { onExit } = {}) {
  if (!host || typeof host.append !== 'function') throw new TypeError('请提供首页编辑器容器。');
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const previousFocus = doc.activeElement;
  const controller = new win.AbortController();
  const { signal } = controller;
  const root = doc.createElement('section');
  root.className = 'home-editor';
  root.lang = 'zh-CN';
  root.setAttribute('aria-label', '首页编辑器');
  root.innerHTML = `
    <header class="he-header">
      <div><h1>首页编辑</h1><p>独立调整每一个元素，实时查看首页效果</p></div>
      <div class="he-actions">
        <span class="he-dirty" role="status" aria-live="polite"></span>
        <button type="button" data-action="reload">重新读取</button>
        <button type="button" data-action="save" class="he-primary">保存首页</button>
        <button type="button" data-action="exit">退出编辑</button>
      </div>
    </header>
    <aside class="he-limit">背景 PNG 图片中的按钮、标题、推荐框、封面和装饰仍然内嵌在整张图片中；隐藏或清除独立元素不能删除这些像素，需要替换背景图片。首页保持单屏，越界内容不会通过滚动显示。</aside>
      <p class="he-notice" role="status" aria-live="polite"></p>
    <div class="he-workspace">
      <nav class="he-panel he-tree-panel" aria-label="首页元素">
        <h2>首页元素</h2><p class="he-help">按父子关系选择，子项可以独立调整。</p>
        <div class="he-tree"></div>
      </nav>
      <section class="he-preview-panel" aria-label="首页预览">
        <div class="he-preview-controls">
          <label>模拟可用尺寸<select data-preview="device">${PREVIEW_SIZES.map((size, index) => `<option value="${index}" ${index === 1 ? 'selected' : ''}>模拟可用 ${size.width} × ${size.height}</option>`).join('')}<option value="custom">自定义或实测窗口</option></select></label>
          <label>可用窗口宽度（像素）<input data-preview="width" type="number" required min="1" max="10000" step="any" value="375"></label>
          <label>可用窗口高度（像素）<input data-preview="height" type="number" required min="1" max="10000" step="any" value="750"></label>
          <label>预览状态<select data-preview="mode"><option value="ready">推荐内容</option><option value="loading">加载中</option><option value="empty">空状态</option></select></label>
          <label>推荐数量<select data-preview="count"><option value="0">零条</option><option value="1">一条</option><option value="2">两条</option><option value="3" selected>三条</option></select></label>
          <label>当前项<select data-preview="current"></select></label>
        </div>
        <details class="he-window-import"><summary>导入实测窗口信息</summary>
          <label class="he-field"><span>粘贴真机 wx.getWindowInfo() 返回的 JSON</span><textarea data-preview-json rows="5" spellcheck="false" placeholder='{"windowWidth":375,"windowHeight":750}'></textarea></label>
          <button type="button" data-action="import-window">导入并预览</button>
          <p class="he-help">直接使用可用窗口信息交给共享适配模块，不用屏幕尺寸或固定导航栏高度推算；导入后修改宽高会切换为手动可用尺寸。</p>
        </details>
        <p class="he-window-status he-help" role="status">模拟可用尺寸，仅用于预览，不保存到首页配置。</p>
        <p class="he-help he-sample-note">样例来自内置预览数据，第三条复用第一条；不修改真实推荐。</p>
        <div class="he-stage"><iframe class="he-preview" title="首页效果预览" tabindex="-1" sandbox="allow-same-origin"></iframe></div>
        <p class="he-preview-state" role="status"></p>
        <p class="he-help">四档宽度均为模拟可用尺寸，不代表具体机型。蓝色虚线为点击命中范围，橙色为当前选中点击层；描边仅供编辑，不改变点击功能。</p>
        <div class="he-warnings" role="status" aria-live="polite"></div>
      </section>
      <aside class="he-panel he-inspector-panel" aria-label="元素属性"><h2>元素属性</h2><fieldset class="he-inspector"></fieldset></aside>
    </div>`;
  host.append(root);

  const find = (selector) => root.querySelector(selector);
  const tree = find('.he-tree');
  const inspector = find('.he-inspector');
  const frame = find('.he-preview');
  let windowInfo = { windowWidth: 375, windowHeight: 750 };
  let config = editableConfig(homeElements);
  let revision = null;
  let saved = '';
  let selectedId = homeElements.elements[0].designId;
  let loading = false;
  let saving = false;
  let uploading = false;
  let disposed = false;
  let reader = null;
  let previewTimer = null;
  let measureTimer = null;
  let renderWarnings = 0;
  let previewFailed = false;
  let invalidDraft = false;
  let mode = 'ready';
  let count = 3;
  let current = 0;
  const dirty = () => revision !== null && (invalidDraft || JSON.stringify(config) !== saved);
  const busy = () => loading || saving || uploading;
  const selected = () => config.elements.find((item) => item.designId === selectedId);
  const ordered = () => homeElements.elements.map((item) => config.elements.find((entry) => entry.designId === item.designId));
  const name = (item) => item?.name || '未命名元素';

  function notice(message, error = false) {
    find('.he-notice').textContent = message;
    find('.he-notice').classList.toggle('he-error', error);
  }

  function updateStatus() {
    if (disposed) return;
    find('.he-dirty').textContent = loading ? '正在读取' : saving ? '正在保存' : uploading ? '正在上传' : revision === null ? '尚未读取配置' : dirty() ? '有未保存的修改' : '已保存';
    find('.he-dirty').classList.toggle('is-dirty', dirty());
    find('[data-action="save"]').disabled = busy() || revision === null || !dirty() || !validation(config).valid || invalidDraft;
    find('[data-action="reload"]').disabled = busy();
    inspector.disabled = busy() || revision === null;
    root.setAttribute('aria-busy', String(busy()));
  }

  function renderTree() {
    const items = ordered();
    const branch = (parentId) => `<ul>${items.filter((item) => item.parentId === parentId).map((item) => `
      <li><button type="button" data-select="${items.indexOf(item)}" aria-pressed="${item.designId === selectedId}" class="he-tree-item${item.designId === selectedId ? ' is-selected' : ''}">
        <span>${escape(name(item))}</span><small>${item.visible ? '显示' : '隐藏'}</small></button>
        ${items.some((child) => child.parentId === item.designId) ? branch(item.designId) : ''}</li>`).join('')}</ul>`;
    tree.innerHTML = branch(null);
  }

  function field(key, label, type = 'text', attributes = '', source = selected()) {
    const value = source[key] ?? '';
    return `<label class="he-field"><span>${label}</span><input data-field="${key}" type="${type}" value="${escape(value)}" ${attributes}></label>`;
  }

  function selectField(key, label, values) {
    return `<label class="he-field"><span>${label}</span><select data-field="${key}">${values.map(([value, text]) => `<option value="${escape(value)}" ${selected()[key] === value ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></label>`;
  }

  function imageControl(key, label) {
    return `<section class="he-image-control" data-image-control="${key}">
      <h3>${label}</h3>
      <label class="he-field"><span>${label}路径</span><textarea data-field="${key}" rows="3" spellcheck="false">${escape(selected()[key])}</textarea></label>
      <div class="he-image-preview" data-image-preview="${key}"></div>
      <div class="he-actions he-image-actions"><button type="button" data-action="upload" data-image-field="${key}">上传并替换</button><button type="button" data-action="clear-image" data-image-field="${key}">清除图片</button><button type="button" data-action="default-image" data-image-field="${key}">恢复默认图片</button></div>
      <input class="he-file" data-image-field="${key}" type="file" accept=".png,.jpg,.jpeg,.webp" aria-label="选择${label}" hidden>
    </section>`;
  }

  function defaultImage(item, key) {
    if (key === 'imagePath') return config.defaultImages?.[item.designId] ?? '';
    if (key === 'runtimeImagePath') return config.defaultRuntimeImages?.[item.designId] ?? '';
    if (key === 'editorDebugImagePath') return config.defaultEditorImages?.[item.designId] ?? '';
    return '';
  }

  function renderHitGeometry() {
    if (selected().type !== 'hit') return;
    let derived;
    try { derived = resolvedElements(config).find((item) => item.designId === selectedId); } catch { /* Keep invalid geometry visibly unavailable. */ }
    for (const input of inspector.querySelectorAll('[data-derived]')) {
      input.value = derived?.[input.dataset.field] ?? '';
    }
    find('.he-hit-status').textContent = derived ? '以下几何由共享解析器根据底图和四边扩展量派生，只读；编辑和保存时同步写入配置，不维护第二套坐标。' : '命中几何暂不可用，请检查底图关联与共享适配模块。';
  }

  function renderInspector() {
    const item = selected();
    invalidDraft = false;
    const hasImage = ['image', 'icon', 'decoration'].includes(item.type);
    const hasText = ['text', 'icon'].includes(item.type);
    const isHit = item.type === 'hit';
    const isRoot = item.type === 'root';
    const isButtonImage = item.designId === BUTTON_BACKGROUND_ID;
    const geometry = isHit ? {} : isRoot ? { x: 0, y: 0, width: config.designWidth, height: config.designHeight, scale: 1 } : item;
    const readOnly = isHit ? 'readonly data-derived' : isRoot ? 'readonly' : '';
    const imageKeys = isButtonImage ? ['runtimeImagePath', 'editorDebugImagePath'] : ['imagePath'];
    inspector.innerHTML = `
      <legend class="he-sr-only">编辑所选元素</legend>
      <h3>页面设置</h3>
      <div class="he-grid">
        <label class="he-field"><span>设计宽度</span><input value="${escape(config.designWidth)}" readonly aria-label="设计宽度"></label>
        <label class="he-field"><span>设计高度</span><input value="${escape(config.designHeight)}" readonly aria-label="设计高度"></label>
      </div>
      <label class="he-field"><span>页面底色</span><input data-config="pageBackground" value="${escape(config.pageBackground)}" required></label>
      <p class="he-help">配置版本为 2，单位为设计像素（design）。设计画布为 ${escape(config.designWidth)} × ${escape(config.designHeight)}；适配后的留白与画布使用同一页面底色，窗口输入仅影响预览。</p>
      <h3>元素设置</h3>
      ${field('name', '名称', 'text', 'required maxlength="80"')}
      <label class="he-field"><span>备注</span><textarea data-field="note" rows="3" maxlength="1000">${escape(item.note)}</textarea></label>
      <label class="he-checkbox"><input type="checkbox" data-field="visible" ${item.visible ? 'checked' : ''}>显示此元素</label>
      ${item.type === 'group' ? '<p class="he-help">隐藏此组仅控制组自身，不隐藏任何子项；移动或缩放仍按父子关系作用。</p>' : ''}
      ${field('opacity', '不透明度（零为透明，一为不透明）', 'number', 'required min="0" max="1" step="any"')}
      <p class="he-help">不透明度只作用于元素自身视觉，不隐藏或淡化组内后代；组与根节点不叠加整体透明度，点击功能不受影响。</p>
      ${isHit ? `<p class="he-help">显隐只控制辅助标记，不禁用原有点击功能。调整底图或扩展量会同步更新命中范围。</p>
        ${selectField('followsElementId', '跟随底图', config.elements.filter((entry) => entry.type === 'image' && entry.parentId === item.parentId).map((entry) => [entry.designId, name(entry)]))}
        <h3>命中范围扩展</h3><p class="he-help">四边独立设置，单位为设计像素；零表示贴合底图。</p>
        <div class="he-grid">${PADDING_SIDES.map(([side, label]) => `<label class="he-field"><span>${label}扩展</span><input type="number" data-padding="${side}" value="${escape(item.hitPadding?.[side] ?? 0)}" required min="0" step="any"></label>`).join('')}</div>
        <p class="he-help he-hit-status" role="status"></p>` : ''}
      <h3>位置与尺寸${isHit || isRoot ? '（只读）' : ''}</h3><p class="he-help">位置相对父项，正数向右或向下。尺寸以固定设计像素为单位；点击层位置与尺寸跟随底图派生。</p>
      <div class="he-grid">
        ${field('x', '左右位置', 'number', `required step="any" ${readOnly}`, geometry)}
        ${field('y', '上下位置', 'number', `required step="any" ${readOnly}`, geometry)}
        ${field('width', '宽度', 'number', `required min="0.01" step="any" ${readOnly}`, geometry)}
        ${field('height', '高度', 'number', `required min="0.01" step="any" ${readOnly}`, geometry)}
        ${field('scale', '缩放倍数', 'number', `required min="0.01" step="any" ${readOnly}`, geometry)}
      </div>
      ${hasText ? `<h3>文字样式</h3>
        ${item.textBinding ? `${field('text', '展示替换文本（可选）')}<p class="he-help">默认留空，显示当前推荐文字；填写后仅替换展示内容，不修改故事或业务数据。</p>` : field('text', item.type === 'icon' ? '备用字符' : '文字内容')}
        <div class="he-grid">${field('fontSize', '字号', 'number', 'required min="1" step="any"')}${field('fontWeight', '字重', 'number', 'required min="100" max="900" step="100"')}${field('lineHeight', '行高倍数', 'number', 'required min="0.1" step="any"')}</div>
        ${field('letterSpacing', '字间距（设计像素）', 'number', 'required step="any"')}
        ${field('textShadow', '文字阴影（样式字符串，可留空）')}
        <p class="he-help">阴影示例：0 2px 4px rgba(0,0,0,0.3)。留空表示无阴影，字间距允许负数。</p>
        ${field('color', '文字颜色')}${selectField('textAlign', '文字对齐', [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']])}
        ${field('fontFamily', '字体名称（空值预留）', 'text', 'readonly')}${field('fontAssetId', '字体资源标识（空值预留）', 'text', 'readonly')}
        <p class="he-help">字体字段当前仅预留，不上传或加载字体资源；预览使用与小程序一致的苹方、冬青黑体、微软雅黑及无衬线字体栈。</p>` : ''}
      ${['decoration', 'dot'].includes(item.type) ? `<h3>颜色</h3>${field('color', item.type === 'dot' ? '普通颜色' : '备用底色')}${item.type === 'dot' ? field('selectedColor', '选中颜色') : ''}` : ''}
      ${hasImage ? `
        ${isButtonImage ? '<p class="he-help he-image-note">正式图片用于发布；路径为空就不显示正式底图，绝不回退旧图片。恢复默认分别读取配置中的正式图片和辅助图片默认映射。辅助图片仅在编辑预览中显示，不进入正式页面；两套图片分别上传、清除和恢复默认，均不改变底图位置或命中跟随关系。</p><label class="he-checkbox"><input type="checkbox" data-field="editorDebugVisible" ' + (item.editorDebugVisible ? 'checked' : '') + '>显示编辑辅助图片</label>' : ''}
        ${item.type === 'icon' ? '<p class="he-help">填写图片路径即可替换备用字符；清除后不显示备用字符。</p>' : ''}
        ${item.type === 'decoration' ? '<p class="he-help">填写图片路径即可替换备用底色；清除后不显示备用底色。</p>' : ''}
        ${item.imageBinding ? '<p class="he-help">真实推荐封面优先，当前路径作为回退图片。样例不含动态封面，便于查看替换效果。</p>' : ''}
        ${imageKeys.map((key) => imageControl(key, key === 'runtimeImagePath' ? '正式按钮底图' : key === 'editorDebugImagePath' ? '编辑辅助底图' : '元素图片')).join('')}
        <p class="he-help">支持透明图片、照片和网页图片，每张不超过八兆字节。先暂存，保存后才复制到小程序；发布前仍须核对包体大小。清除与恢复默认均不改变显隐。</p>
        ${selectField('imageMode', '图片适配', [['aspectFit', '完整显示'], ['aspectFill', '填满裁切'], ['scaleToFill', '拉伸铺满']])}
        <p class="he-help">裁切仅在填满裁切模式生效，五十为居中；偏离中心会放大取景以避免露白，并非标准焦点定位或原图像素坐标。</p>
        <div class="he-grid">${field('imageCropX', '横向裁切（百分比）', 'number', 'required min="0" max="100" step="any"')}${field('imageCropY', '纵向裁切（百分比）', 'number', 'required min="0" max="100" step="any"')}</div>` : ''}`;
    renderImage();
    renderHitGeometry();
    updateStatus();
  }

  function renderImage() {
    const item = selected();
    for (const container of inspector.querySelectorAll('[data-image-preview]')) {
      const key = container.dataset.imagePreview;
      const cleared = key === 'imagePath' && item.imageCleared;
      const path = cleared ? '' : key === 'imagePath' ? item.imagePath || defaultImage(item, key) : item[key];
      const url = imageUrl(path);
      container.replaceChildren();
      const message = doc.createElement('p');
      message.className = 'he-help';
      message.textContent = cleared ? '图片已清除，备用外观也不显示。' : !url ? (path ? '路径无效，请使用项目图片路径或安全网页地址。' : key === 'runtimeImagePath' ? '正式图片为空，不回退旧底图。' : key === 'editorDebugImagePath' ? '未设置辅助图片。' : '未设置图片，使用默认备用外观（如有）。') : '当前图片预览';
      if (url) {
        const image = doc.createElement('img');
        image.alt = key === 'runtimeImagePath' ? '正式按钮底图预览' : key === 'editorDebugImagePath' ? '编辑辅助底图预览' : '所选元素图片预览';
        image.addEventListener('error', () => { message.textContent = '图片无法加载，请检查完整路径或重新上传。'; }, { once: true, signal });
        image.src = url;
        container.append(image);
      }
      container.append(message);
    }
  }

  function updateCurrentOptions() {
    const effectiveCount = mode === 'ready' ? count : 0;
    current = Math.max(0, Math.min(current, effectiveCount - 1));
    const select = find('[data-preview="current"]');
    select.innerHTML = effectiveCount ? Array.from({ length: effectiveCount }, (_, index) => `<option value="${index}">第${['一', '二', '三'][index]}条</option>`).join('') : '<option value="0">无当前项</option>';
    select.value = String(current);
    select.disabled = !effectiveCount;
    find('[data-preview="count"]').disabled = mode !== 'ready';
  }

  function renderPreview() {
    if (disposed) return;
    win.clearTimeout(previewTimer);
    updateCurrentOptions();
    const effectiveCount = mode === 'ready' ? count : 0;
    const samples = PAGE_SAMPLE_DATA.index.recommendationCards;
    const sample = samples[current % samples.length];
    const record = effectiveCount && sample ? {
      ...sample,
      displayTitle: sample.displayTitle ?? sample.title,
      locationName: sample.locationName ?? sample.location,
      displaySummary: sample.displaySummary ?? sample.summary,
      actionText: sample.actionText ?? sample.cta
    } : { previewLoading: mode === 'loading', recommendationEmptyText: '推荐内容正在整理中' };
    // Only the ephemeral preview record changes; bindings and business data stay intact.
    if (effectiveCount) {
      for (const item of config.elements) {
        if (item.textBinding && item.text) record[item.textBinding] = item.text;
      }
    }
    find('.he-preview-state').textContent = mode === 'loading' ? '正在加载推荐内容' : effectiveCount ? `共${effectiveCount}条推荐，当前为第${current + 1}条` : '暂无推荐内容';
    try {
      const rect = getAvailableRect(windowInfo);
      const { scale, offsetX, offsetY } = fitHome(config, rect);
      if (![rect.width, rect.height, scale].every((value) => Number.isFinite(value) && value > 0)
        || ![offsetX, offsetY].every(Number.isFinite)) throw new Error('共享适配结果无效');
      frame.width = windowInfo.windowWidth;
      frame.height = windowInfo.windowHeight;
      frame.style.width = `${windowInfo.windowWidth}px`;
      frame.style.height = `${windowInfo.windowHeight}px`;
      frame.style.background = config.pageBackground;
      // All homepage markup and geometry come from the shared renderer.
      const rendered = renderHomePreview(config, record, current, effectiveCount);
      const html = typeof rendered === 'string' ? rendered : rendered?.html;
      if (typeof html !== 'string') throw new Error('预览暂不可用');
      renderWarnings = Array.isArray(rendered?.warnings) ? rendered.warnings.length : 0;
      const css = typeof rendered?.css === 'string' ? rendered.css.replace(/<\/style/gi, '<\\/style') : '';
      const page = new win.DOMParser().parseFromString(html, 'text/html');
      page.documentElement.lang = 'zh-CN';
      const canvas = page.body.querySelector('.home-preview') || page.body.firstElementChild;
      if (!canvas) throw new Error('共享预览缺少设计根节点');
      canvas.classList.add('he-design-canvas');
      Object.assign(canvas.style, {
        position: 'absolute', left: `${offsetX}px`, top: `${offsetY}px`,
        width: `${config.designWidth}px`, height: `${config.designHeight}px`,
        transform: `scale(${scale})`, transformOrigin: '0 0',
        background: config.pageBackground, fontFamily: HOME_FONT_STACK
      });
      for (const element of resolvedElements(config).filter((item) => item.type === 'hit')) {
        const node = Array.from(canvas.querySelectorAll('[data-design-id], [data-home-id]')).find((entry) => (entry.dataset.designId || entry.dataset.homeId) === element.designId);
        if (!node || !element.visible) continue;
        const outline = page.createElement('div');
        outline.className = 'he-hit-outline';
        outline.dataset.selected = String(element.designId === selectedId);
        outline.setAttribute('aria-label', `${name(element)}命中范围`);
        Object.assign(outline.style, {
          left: `${element.x}px`, top: `${element.y}px`, width: `${element.width}px`,
          height: `${element.height}px`, transform: `scale(${element.scale})`,
          outlineWidth: `${2 / scale}px`
        });
        node.parentElement.append(outline);
      }
      for (const image of page.querySelectorAll('img[src]')) {
        const src = imageUrl(image.getAttribute('src'));
        if (src) image.setAttribute('src', src);
        else image.removeAttribute('src');
      }
      for (const node of page.querySelectorAll('[aria-label]')) {
        if (node.classList.contains('he-hit-outline')) continue;
        const item = config.elements.find((entry) => entry.designId === node.getAttribute('data-design-id'));
        node.setAttribute('aria-label', item ? name(item) : '首页预览内容');
      }
      const base = page.createElement('base');
      base.href = new URL('/', win.location.href).href;
      page.head.prepend(base);
      const style = page.createElement('style');
      style.textContent = `${css}
        html,body{margin:0;width:100%;height:100%;overflow:hidden}
        .he-hit-outline{position:absolute;box-sizing:border-box;transform-origin:0 0;pointer-events:none;z-index:2147483647;outline:2px dashed #087bcc;outline-offset:-1px;background:rgba(8,123,204,.1)}
        .he-hit-outline[data-selected="true"]{outline-color:#bd4d00;background:rgba(255,145,0,.15)}`;
      page.head.append(style);
      for (const node of [page.documentElement, page.body]) {
        node.style.background = config.pageBackground;
        node.style.fontFamily = HOME_FONT_STACK;
      }
      frame.srcdoc = `<!doctype html>${page.documentElement.outerHTML}`;
      previewFailed = false;
    } catch {
      previewFailed = true;
      frame.srcdoc = '<!doctype html><html lang="zh-CN"><body><p>预览暂不可用，请检查配置或稍后重试。</p></body></html>';
    }
    showWarnings();
  }

  function showWarnings() {
    if (disposed) return;
    const result = validation(config);
    const warnings = [];
    if (!result.valid || invalidDraft) warnings.push('部分属性不符合要求，请检查输入后再保存。');
    if (previewFailed) warnings.push('预览暂不可用，当前效果尚未核实。');
    if (result.warningCount || renderWarnings) warnings.push('共享检查发现需要注意的配置，请核对画面边缘与元素尺寸。');
    // Measure shared output instead of duplicating parent transforms or layout rules.
    const previewDoc = frame.contentDocument;
    if (previewDoc && !previewFailed) {
      const out = new Set();
      // Overscanned images are intentionally larger than their clipped element.
      for (const node of previewDoc.body?.querySelectorAll('[data-design-id], [data-home-id]') || []) {
        const style = frame.contentWindow.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (rect.left < -1 || rect.top < -1 || rect.right > frame.clientWidth + 1 || rect.bottom > frame.clientHeight + 1) {
          const id = node.getAttribute('data-design-id') || node.getAttribute('data-home-id');
          const item = config.elements.find((entry) => entry.designId === id);
          out.add(item ? name(item) : '预览内容');
        }
      }
      if (out.size) warnings.push(`越界警告：${Array.from(out).join('、')}超出首页可视范围，请调整位置、尺寸或缩放。`);
    }
    find('.he-warnings').textContent = warnings.join(' ');
    find('.he-warnings').hidden = warnings.length === 0;
  }

  function changed({ inspectorChanged = false } = {}) {
    try {
      syncGeometry(config);
      notice('修改尚未保存，请确认预览后保存首页。');
    } catch {
      notice('命中范围无法派生，请检查关联底图和四边扩展量后再保存。', true);
    }
    renderTree();
    if (inspectorChanged) renderInspector();
    else renderHitGeometry();
    updateStatus();
    win.clearTimeout(previewTimer);
    previewTimer = win.setTimeout(renderPreview, 120);
  }

  async function request(url, body) {
    const response = await win.fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin', cache: 'no-store', signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) {
      if (response.status === 409) throw new EditorMessage('配置已被其他窗口更新。当前修改仍保留，请记录修改后重新读取，再进行保存。');
      if (response.status === 413) throw new EditorMessage('图片过大，请压缩后重新上传。');
      throw new EditorMessage('请求未成功，请确认首页服务已接入后重试。');
    }
    try { return await response.json(); } catch { throw new EditorMessage('服务返回内容无法读取，请稍后重试。'); }
  }

  async function load() {
    if (busy() || disposed) return;
    if (dirty() && !win.confirm('有未保存的修改，重新读取会丢弃这些修改。是否继续？')) return;
    loading = true;
    updateStatus();
    notice('正在读取首页配置。');
    try {
      const payload = readEnvelope(await request(CONFIG_URL));
      if (disposed) return;
      config = payload.config;
      revision = payload.revision;
      saved = payload.persisted;
      renderTree();
      renderInspector();
      renderPreview();
      notice(dirty() ? '首页配置已读取，派生几何已同步到草稿，请确认后保存。' : '首页配置已读取。');
    } catch (error) {
      if (!disposed) notice(errorMessage(error, '读取失败，请检查连接后重新读取。'), true);
    } finally {
      loading = false;
      updateStatus();
    }
  }

  async function save() {
    if (busy() || disposed || revision === null || !dirty()) return;
    if (invalidDraft || !validation(config).valid) {
      inspector.querySelector(':invalid')?.reportValidity();
      notice('部分属性不符合要求，请检查输入后再保存。', true);
      return;
    }
    saving = true;
    updateStatus();
    notice('正在保存首页。');
    try {
      const submission = syncGeometry(clone(config));
      if (!validation(submission).valid) throw new EditorMessage('派生后的首页配置无效，请修正后再保存。');
      const payload = readEnvelope(await request(CONFIG_URL, { config: submission, revision }));
      if (disposed) return;
      config = payload.config;
      revision = payload.revision;
      saved = payload.persisted;
      renderTree();
      renderInspector();
      renderPreview();
      notice(dirty() ? '服务返回配置与派生结果不一致，修正仍保留在草稿中，请核对共享保存接口。' : '首页已保存。', dirty());
    } catch (error) {
      if (!disposed) notice(errorMessage(error, '保存失败，修改仍保留，请检查连接后重试。'), true);
    } finally {
      saving = false;
      updateStatus();
    }
  }

  async function upload(file, imageField) {
    if (!file || !IMAGE_FIELDS.has(imageField) || busy() || revision === null || disposed) return;
    if (!IMAGE_TYPES.has(file.type) || !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      notice('请选择支持的透明图片、照片或网页图片文件。', true);
      return;
    }
    if (!file.size || file.size > MAX_IMAGE_SIZE) {
      notice('图片不能为空，且每张不能超过八兆字节。', true);
      return;
    }
    const target = selected();
    uploading = true;
    updateStatus();
    notice('正在上传图片，上传完成后仍需保存首页。');
    try {
      const base64 = await new Promise((resolve, reject) => {
        reader = new win.FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new EditorMessage('图片读取失败，请重新选择。'));
        reader.onabort = () => reject(new EditorMessage('图片读取已取消。'));
        reader.readAsDataURL(file);
      });
      const payload = await request(UPLOAD_URL, { fileName: file.name, base64 });
      if (disposed) return;
      if (typeof payload?.imagePath !== 'string' || !imageUrl(payload.imagePath)) throw new EditorMessage('上传结果缺少有效图片路径，请重新上传。');
      target[imageField] = payload.imagePath;
      target.imageCleared = false;
      changed({ inspectorChanged: true });
      notice('图片已替换，尚未保存首页。');
    } catch (error) {
      if (!disposed) notice(errorMessage(error, '图片上传失败，原图片未改变，请重试。'), true);
    } finally {
      reader = null;
      uploading = false;
      updateStatus();
    }
  }

  // Stop delegated main-page handlers before any callback can unmount this root.
  for (const type of ['click', 'dblclick', 'input', 'change', 'keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'focusin', 'focusout', 'submit']) {
    root.addEventListener(type, (event) => {
      event.stopPropagation();
      if (type === 'submit') event.preventDefault();
    }, { signal });
  }

  root.addEventListener('input', (event) => {
    const input = event.target.closest('[data-field], [data-config], [data-padding]');
    if (!input || input.readOnly || busy() || revision === null) return;
    if (input.dataset.config === 'pageBackground') {
      input.setCustomValidity(win.CSS.supports('background-color', input.value) ? '' : '请输入有效的页面底色，例如 #efe4d2。');
    }
    if (input.dataset.field === 'textShadow') {
      input.setCustomValidity(!input.value || win.CSS.supports('text-shadow', input.value) ? '' : '请输入有效的文字阴影，或清空此字段。');
    }
    invalidDraft = !!inspector.querySelector(':invalid');
    if (!input.checkValidity()) {
      notice('输入不完整或超出允许范围，请修正后继续。', true);
      updateStatus();
      showWarnings();
      return;
    }
    const item = selected();
    const key = input.dataset.field;
    const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? input.valueAsNumber : input.value;
    if (input.dataset.config) config[input.dataset.config] = value;
    else if (input.dataset.padding) item.hitPadding[input.dataset.padding] = value;
    else item[key] = value;
    if (IMAGE_FIELDS.has(key)) {
      item.imageCleared = false;
      renderImage();
    }
    changed();
  }, { signal });

  root.addEventListener('change', (event) => {
    if (event.target.matches('.he-file')) {
      const file = event.target.files?.[0];
      event.target.value = '';
      void upload(file, event.target.dataset.imageField);
    }
    const key = event.target.dataset.preview;
    if (!key) return;
    if (key === 'device') {
      const size = PREVIEW_SIZES[Number(event.target.value)];
      if (!size) return;
      windowInfo = { windowWidth: size.width, windowHeight: size.height };
      find('[data-preview="width"]').value = size.width;
      find('[data-preview="height"]').value = size.height;
      find('.he-window-status').textContent = '模拟可用尺寸，仅用于预览，不代表机型实测数据。';
      find('.he-window-status').classList.remove('he-error');
    }
    if (key === 'width' || key === 'height') {
      const width = find('[data-preview="width"]');
      const height = find('[data-preview="height"]');
      if (!width.reportValidity() || !height.reportValidity()) return;
      windowInfo = { windowWidth: width.valueAsNumber, windowHeight: height.valueAsNumber };
      find('[data-preview="device"]').value = 'custom';
      find('.he-window-status').textContent = '手动可用尺寸，仅用于预览；不推断导航栏或安全区高度。';
      find('.he-window-status').classList.remove('he-error');
    }
    if (key === 'mode') mode = event.target.value;
    if (key === 'count') count = Number(event.target.value);
    if (key === 'current') current = Number(event.target.value);
    renderPreview();
  }, { signal });

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.select !== undefined) {
      if (busy()) return;
      if (invalidDraft) {
        inspector.querySelector(':invalid')?.reportValidity();
        return;
      }
      selectedId = ordered()[Number(button.dataset.select)].designId;
      renderTree();
      renderInspector();
      renderPreview();
      return;
    }
    const action = button.dataset.action;
    if (action === 'import-window') {
      const status = find('.he-window-status');
      try {
        const info = JSON.parse(find('[data-preview-json]').value);
        if (!info || Array.isArray(info) || typeof info !== 'object'
          || ![info.windowWidth, info.windowHeight].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10000)) {
          throw new EditorMessage('窗口信息必须包含正数 windowWidth 和 windowHeight，最大为一万像素。');
        }
        const rect = getAvailableRect(info);
        if (![rect.width, rect.height].every((value) => Number.isFinite(value) && value > 0)) throw new EditorMessage('共享模块未能解析有效的可用窗口。');
        windowInfo = clone(info);
        find('[data-preview="width"]').value = info.windowWidth;
        find('[data-preview="height"]').value = info.windowHeight;
        find('[data-preview="device"]').value = 'custom';
        status.textContent = '已导入实测窗口信息，完整 JSON 交给共享模块处理；仅影响预览，不保存到首页配置。';
        status.classList.remove('he-error');
        renderPreview();
      } catch (error) {
        status.textContent = errorMessage(error, 'JSON 无法解析，请粘贴完整的 wx.getWindowInfo() 返回对象；仍保留上一次预览。');
        status.classList.add('he-error');
      }
    } else if (action === 'exit') {
      if ((dirty() || busy()) && !win.confirm('有未保存的修改或正在处理的操作，退出可能丢失修改。是否退出？')) return;
      dispose();
      if (typeof onExit === 'function') onExit();
    } else if (action === 'save') void save();
    else if (action === 'reload') void load();
    else if (!busy() && revision !== null) {
      if (invalidDraft) {
        inspector.querySelector(':invalid')?.reportValidity();
        return;
      }
      const imageField = button.dataset.imageField;
      if (!IMAGE_FIELDS.has(imageField)) return;
      if (action === 'upload') inspector.querySelector(`.he-file[data-image-field="${imageField}"]`)?.click();
      if (action === 'clear-image' || action === 'default-image') {
        const item = selected();
        item[imageField] = action === 'clear-image' ? '' : defaultImage(item, imageField);
        if (imageField === 'imagePath') item.imageCleared = action === 'clear-image';
        else if (action === 'default-image') item.imageCleared = false;
        changed({ inspectorChanged: true });
      }
    }
  }, { signal });

  frame.addEventListener('load', () => {
    if (disposed) return;
    showWarnings();
    for (const image of frame.contentDocument?.images || []) image.addEventListener('load', showWarnings, { once: true, signal });
    win.clearTimeout(measureTimer);
    measureTimer = win.setTimeout(showWarnings, 300);
  }, { signal });

  win.addEventListener('beforeunload', (event) => {
    if (!dirty() && !saving && !uploading) return;
    event.preventDefault();
    event.returnValue = '';
  }, { signal });

  function dispose() {
    if (disposed) return;
    const restoreFocus = root.contains(doc.activeElement);
    disposed = true;
    controller.abort();
    if (reader?.readyState === 1) reader.abort();
    win.clearTimeout(previewTimer);
    win.clearTimeout(measureTimer);
    root.remove();
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }

  renderTree();
  renderInspector();
  renderPreview();
  void load();
  return dispose;
}
