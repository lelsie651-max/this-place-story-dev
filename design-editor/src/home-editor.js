import homeElements from '../../design/home-index-elements.json';
import { validateHomeConfig, renderHomePreview } from '../shared/home-layout.js';
import { PAGE_SAMPLE_DATA, DEVICE_PRESETS, DEFAULT_DEVICE_ID, getDeviceMetrics } from '../shared/preview-data.js';
import './home-editor.css';

const CONFIG_URL = '/__design_editor/home-config';
const UPLOAD_URL = '/__design_editor/home-upload';
const ASSET_URL = '/__design_editor/home-asset';
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
class EditorMessage extends Error {}

function errorMessage(error, fallback) {
  return error instanceof EditorMessage ? error.message : fallback;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

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
    const result = validateHomeConfig(config);
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
  const elements = payload.config.elements;
  // The source catalog owns membership and hierarchy, never the editor controls.
  if (elements.length !== homeElements.elements.length || homeElements.elements.some((item) => {
    const matches = elements.filter((entry) => entry.designId === item.designId);
    return matches.length !== 1 || matches[0].parentId !== item.parentId || matches[0].type !== item.type;
  }) || !validation(payload.config).valid) {
    throw new EditorMessage('首页配置无法使用，请检查配置后重新读取。');
  }
  return { config: clone(payload.config), revision: payload.revision };
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
          <label>预览设备<select data-preview="device">${DEVICE_PRESETS.map((device, index) => `<option value="${index}" ${device.id === DEFAULT_DEVICE_ID ? 'selected' : ''}>设备${index + 1}（${device.width} × ${device.height}）</option>`).join('')}</select></label>
          <label>预览状态<select data-preview="mode"><option value="ready">推荐内容</option><option value="loading">加载中</option><option value="empty">空状态</option></select></label>
          <label>推荐数量<select data-preview="count"><option value="0">零条</option><option value="1">一条</option><option value="2">两条</option><option value="3" selected>三条</option></select></label>
          <label>当前项<select data-preview="current"></select></label>
        </div>
        <p class="he-help he-sample-note">样例来自内置预览数据，第三条复用第一条；不修改真实推荐。</p>
        <div class="he-stage"><iframe class="he-preview" title="首页效果预览" tabindex="-1" sandbox="allow-same-origin"></iframe></div>
        <p class="he-preview-state" role="status"></p>
        <p class="he-help">预览不包含原生导航栏和底部导航，尺寸为模拟值，以真机显示为准。</p>
        <div class="he-warnings" role="status" aria-live="polite"></div>
      </section>
      <aside class="he-panel he-inspector-panel" aria-label="元素属性"><h2>元素属性</h2><fieldset class="he-inspector"></fieldset></aside>
    </div>`;
  host.append(root);

  const find = (selector) => root.querySelector(selector);
  const tree = find('.he-tree');
  const inspector = find('.he-inspector');
  const frame = find('.he-preview');
  let deviceId = DEFAULT_DEVICE_ID;
  let config = clone(homeElements);
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

  function field(key, label, type = 'text', attributes = '') {
    const value = selected()[key] ?? '';
    return `<label class="he-field"><span>${label}</span><input data-field="${key}" type="${type}" value="${escape(value)}" ${attributes}></label>`;
  }

  function selectField(key, label, values) {
    return `<label class="he-field"><span>${label}</span><select data-field="${key}">${values.map(([value, text]) => `<option value="${value}" ${selected()[key] === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
  }

  function renderInspector() {
    const item = selected();
    invalidDraft = false;
    const hasImage = ['image', 'icon', 'decoration'].includes(item.type);
    const hasText = ['text', 'icon'].includes(item.type);
    inspector.innerHTML = `
      <legend class="he-sr-only">编辑所选元素</legend>
      ${field('name', '名称', 'text', 'required maxlength="80"')}
      <label class="he-field"><span>备注</span><textarea data-field="note" rows="3" maxlength="1000">${escape(item.note)}</textarea></label>
      <label class="he-checkbox"><input type="checkbox" data-field="visible" ${item.visible ? 'checked' : ''}>显示此元素</label>
      ${item.type === 'group' ? '<p class="he-help">隐藏此组仅控制组自身，不隐藏任何子项；移动或缩放仍按父子关系作用。</p>' : ''}
      ${item.type === 'hit' ? '<p class="he-help">显隐只控制辅助标记，不禁用原有点击功能。</p>' : ''}
      <h3>位置与尺寸</h3><p class="he-help">位置相对父项，正数向右或向下。尺寸以设计宽度七百五十为基准。</p>
      <div class="he-grid">
        ${field('x', '左右位置', 'number', 'required step="any"')}
        ${field('y', '上下位置', 'number', 'required step="any"')}
        ${field('width', '宽度', 'number', 'required min="0" step="any"')}
        ${field('height', item.heightUnit === 'vh' ? '高度（窗口百分比）' : '高度', 'number', 'required min="0" step="any"')}
        ${field('scale', '缩放倍数', 'number', 'required min="0.01" step="any"')}
      </div>
      ${hasText ? `<h3>文字样式</h3>
        ${item.textBinding ? `${field('text', '展示替换文本（可选）')}<p class="he-help">默认留空，显示当前推荐文字；填写后仅替换展示内容，不修改故事或业务数据。</p>` : field('text', item.type === 'icon' ? '备用字符' : '文字内容')}
        <div class="he-grid">${field('fontSize', '字号', 'number', 'required min="1" step="any"')}${field('fontWeight', '字重', 'number', 'required min="100" max="900" step="100"')}${field('lineHeight', '行高倍数', 'number', 'required min="0.1" step="any"')}</div>
        ${field('color', '文字颜色')}${selectField('textAlign', '文字对齐', [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']])}` : ''}
      ${['decoration', 'dot'].includes(item.type) ? `<h3>颜色</h3>${field('color', item.type === 'dot' ? '普通颜色' : '备用底色')}${item.type === 'dot' ? field('selectedColor', '选中颜色') : ''}` : ''}
      ${hasImage ? `<h3>图片</h3>
        ${item.type === 'icon' ? '<p class="he-help">填写图片路径即可替换备用字符；清除后不显示备用字符。</p>' : ''}
        ${item.type === 'decoration' ? '<p class="he-help">填写图片路径即可替换备用底色；清除后不显示备用底色。</p>' : ''}
        ${item.imageBinding ? '<p class="he-help">真实推荐封面优先，当前路径作为回退图片。样例不含动态封面，便于查看替换效果。</p>' : ''}
        <p class="he-help">当前图片路径：${escape(item.imageCleared ? '无图片（已清除）' : item.imagePath || config.defaultImages[item.designId] || '未设置独立图片，使用临时外观')}</p>
        <label class="he-field"><span>替换图片路径</span><textarea data-field="imagePath" rows="3" spellcheck="false">${escape(item.imagePath)}</textarea></label>
        <div class="he-image-preview"></div>
        <div class="he-actions he-image-actions"><button type="button" data-action="upload">上传并替换</button><button type="button" data-action="clear-image">清除图片</button><button type="button" data-action="default-image">恢复默认图片</button></div>
        <input class="he-file" type="file" accept=".png,.jpg,.jpeg,.webp" aria-label="选择要上传的图片" hidden>
        <p class="he-help">支持透明图片、照片和网页图片，每张不超过八兆字节。先暂存，保存后才复制到小程序；发布前仍须核对包体大小。清除与恢复默认均不改变显隐。</p>
        ${selectField('imageMode', '图片适配', [['aspectFit', '完整显示'], ['aspectFill', '填满裁切'], ['scaleToFill', '拉伸铺满']])}
        <p class="he-help">裁切仅在填满裁切模式生效，五十为居中；偏离中心会放大取景以避免露白，并非标准焦点定位或原图像素坐标。</p>
        <div class="he-grid">${field('imageCropX', '横向裁切（百分比）', 'number', 'required min="0" max="100" step="any"')}${field('imageCropY', '纵向裁切（百分比）', 'number', 'required min="0" max="100" step="any"')}</div>` : ''}`;
    renderImage();
    updateStatus();
  }

  function renderImage() {
    const container = find('.he-image-preview');
    if (!container) return;
    const item = selected();
    const url = item.imageCleared ? '' : imageUrl(item.imagePath || config.defaultImages[item.designId]);
    container.replaceChildren();
    const message = doc.createElement('p');
    message.className = 'he-help';
    message.textContent = item.imageCleared ? '图片已清除，备用外观也不显示。' : !url ? '未设置图片，使用默认备用外观（如有）。' : '图片预览';
    if (url) {
      const image = doc.createElement('img');
      image.alt = '所选元素图片预览';
      image.addEventListener('error', () => { message.textContent = '图片无法加载，请检查完整路径或重新上传。'; }, { once: true, signal });
      image.src = url;
      container.append(image);
    }
    container.append(message);
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
    const metrics = getDeviceMetrics(deviceId);
    const scale = metrics.viewportWidth / 750;
    const availableHeight = metrics.viewportHeight - metrics.topChromeHeight - metrics.bottomBarHeight;
    const designHeight = availableHeight / scale;
    frame.width = metrics.viewportWidth;
    frame.height = availableHeight;
    frame.style.width = `${metrics.viewportWidth}px`;
    frame.style.height = `${availableHeight}px`;
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
      // All homepage markup and geometry come from the shared renderer.
      const rendered = renderHomePreview(config, record, current, effectiveCount);
      const html = typeof rendered === 'string' ? rendered : rendered?.html;
      if (typeof html !== 'string') throw new Error('预览暂不可用');
      renderWarnings = Array.isArray(rendered?.warnings) ? rendered.warnings.length : 0;
      const css = typeof rendered?.css === 'string' ? rendered.css.replace(/<\/style/gi, '<\\/style') : '';
      const page = new win.DOMParser().parseFromString(html, 'text/html');
      page.documentElement.lang = 'zh-CN';
      page.documentElement.style.setProperty('--home-preview-height', `${designHeight}px`);
      for (const image of page.querySelectorAll('img[src]')) {
        const src = imageUrl(image.getAttribute('src'));
        if (src) image.setAttribute('src', src);
        else image.removeAttribute('src');
      }
      for (const node of page.querySelectorAll('[aria-label]')) {
        const item = config.elements.find((entry) => entry.designId === node.getAttribute('data-design-id'));
        node.setAttribute('aria-label', item ? name(item) : '首页预览内容');
      }
      const canvas = page.createElement('div');
      canvas.className = 'he-design-canvas';
      canvas.style.cssText = `position:relative;width:750px;height:${designHeight}px;transform:scale(${scale});transform-origin:0 0;`;
      canvas.append(...page.body.childNodes);
      page.body.append(canvas);
      const base = page.createElement('base');
      base.href = new URL('/', win.location.href).href;
      page.head.prepend(base);
      const style = page.createElement('style');
      style.textContent = `html,body{margin:0;width:100%;height:100%;overflow:hidden} ${css}`;
      page.head.append(style);
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
    notice('修改尚未保存，请确认预览后保存首页。');
    renderTree();
    if (inspectorChanged) renderInspector();
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
      saved = JSON.stringify(config);
      renderTree();
      renderInspector();
      renderPreview();
      notice('首页配置已读取。');
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
      const payload = readEnvelope(await request(CONFIG_URL, { config: clone(config), revision }));
      if (disposed) return;
      config = payload.config;
      revision = payload.revision;
      saved = JSON.stringify(config);
      renderTree();
      renderInspector();
      renderPreview();
      notice('首页已保存。');
    } catch (error) {
      if (!disposed) notice(errorMessage(error, '保存失败，修改仍保留，请检查连接后重试。'), true);
    } finally {
      saving = false;
      updateStatus();
    }
  }

  async function upload(file) {
    if (!file || busy() || revision === null || disposed) return;
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
      target.imagePath = payload.imagePath;
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
    const input = event.target.closest('[data-field]');
    if (!input || busy() || revision === null) return;
    invalidDraft = !!inspector.querySelector(':invalid');
    if (!input.checkValidity()) {
      notice('输入不完整或超出允许范围，请修正后继续。', true);
      updateStatus();
      showWarnings();
      return;
    }
    const item = selected();
    const key = input.dataset.field;
    item[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? input.valueAsNumber : input.value;
    if (key === 'imagePath') {
      item.imageCleared = false;
      renderImage();
    }
    changed();
  }, { signal });

  root.addEventListener('change', (event) => {
    if (event.target.matches('.he-file')) {
      const file = event.target.files?.[0];
      event.target.value = '';
      void upload(file);
    }
    const key = event.target.dataset.preview;
    if (!key) return;
    if (key === 'device') {
      const device = DEVICE_PRESETS[Number(event.target.value)];
      if (!device) return;
      deviceId = device.id;
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
      return;
    }
    const action = button.dataset.action;
    if (action === 'exit') {
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
      if (action === 'upload') find('.he-file')?.click();
      if (action === 'clear-image' || action === 'default-image') {
        const item = selected();
        item.imagePath = action === 'clear-image' ? '' : (config.defaultImages[item.designId] ?? '');
        item.imageCleared = action === 'clear-image';
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
