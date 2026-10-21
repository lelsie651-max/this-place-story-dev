function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateLabel(value) {
  if (!value) {
    return '待补充';
  }

  const dateValue = new Date(value);

  if (Number.isNaN(dateValue.getTime())) {
    return typeof value === 'string' ? value : '待补充';
  }

  const pad = function padNumber(number) {
    return number < 10 ? '0' + number : String(number);
  };

  return [
    dateValue.getFullYear(),
    '年',
    pad(dateValue.getMonth() + 1),
    '月',
    pad(dateValue.getDate()),
    '日 ',
    pad(dateValue.getHours()),
    ':',
    pad(dateValue.getMinutes()),
  ].join('');
}

function getModerationModeLabel(story) {
  if (story?.moderationStatus === 'manual_only') {
    return '机器审核：未启用 / 审核方式：人工审核';
  }

  return '机器审核：未启用';
}

function renderActionBar(story) {
  if (!story) {
    return '';
  }

  if (story.status === 'pending') {
    return `
      <div class="detail-actions">
        <button class="primary-button" data-action="approve">通过</button>
        <button class="danger-button" data-action="reject">打回</button>
        <button class="ghost-button" data-action="back">返回列表</button>
      </div>
    `;
  }

  if (story.status === 'published') {
    return `
      <div class="detail-actions">
        <button class="danger-button" data-action="hide">下架（打回）</button>
        <button class="ghost-button" data-action="back">返回列表</button>
      </div>
    `;
  }

  return `
    <div class="detail-actions">
      <button class="ghost-button" data-action="back">返回列表</button>
    </div>
  `;
}

export function renderStoryDetailPage(container, props) {
  const story = props.story;

  container.innerHTML = `
    <main class="page">
      <section class="topbar">
        <div>
          <p class="eyebrow">Legend Review</p>
          <h1>投稿详情</h1>
          <p class="muted">当前登录：${escapeHtml(props.reviewerId || '管理员')}</p>
        </div>
        <button class="ghost-button" id="detail-logout-button">退出登录</button>
      </section>

      <section class="panel">
        ${props.loading ? '<p class="muted">详情加载中...</p>' : ''}
        ${!props.loading && props.errorMessage ? `<p class="form-error">${escapeHtml(props.errorMessage)}</p>` : ''}
        ${!props.loading && story ? `
          <header class="detail-header">
            <div>
              <h2>${escapeHtml(story.title || '未命名投稿')}</h2>
              <p class="muted">${escapeHtml(story.locationName || '地点待补充')}</p>
            </div>
            <span class="status-badge status-badge--${escapeHtml(story.status || 'pending')}">${escapeHtml(story.statusLabel || '')}</span>
          </header>

          <dl class="meta-grid meta-grid--detail">
            <div><dt>地点地址</dt><dd>${escapeHtml(story.placeSnapshot?.address || '待补充')}</dd></div>
            <div><dt>投稿者</dt><dd>${escapeHtml(story.authorDisplayId || '投稿者#未知')}</dd></div>
            <div><dt>投稿时间</dt><dd>${escapeHtml(formatDateLabel(story.createdAt))}</dd></div>
            <div><dt>最近修改</dt><dd>${escapeHtml(formatDateLabel(story.updatedAt || story.createdAt))}</dd></div>
            <div><dt>审核时间</dt><dd>${escapeHtml(formatDateLabel(story.reviewedAt))}</dd></div>
            <div><dt>审核人</dt><dd>${escapeHtml(story.reviewerName || story.reviewerId || '待补充')}</dd></div>
            <div><dt>审核方式</dt><dd>${escapeHtml(getModerationModeLabel(story))}</dd></div>
            <div><dt>是否需要人工审核</dt><dd>${story.manualReviewRequired ? '是' : '否'}</dd></div>
            <div><dt>moderationStatus</dt><dd>${escapeHtml(story.moderationStatus || 'manual_only')}</dd></div>
            <div><dt>拒绝原因</dt><dd>${escapeHtml(story.rejectionReason || story.moderationReason || '暂无')}</dd></div>
          </dl>

          <section class="content-panel">
            <h3>正文</h3>
            <div class="story-content">${escapeHtml(story.content || '暂无正文').replace(/\n/g, '<br />')}</div>
          </section>

          ${renderActionBar(story)}
        ` : ''}
      </section>
    </main>
  `;

  const logoutButton = container.querySelector('#detail-logout-button');

  if (logoutButton) {
    logoutButton.addEventListener('click', function handleLogout() {
      props.onLogout();
    });
  }

  container.querySelectorAll('[data-action]').forEach(function bindAction(button) {
    button.addEventListener('click', function handleActionClick() {
      const action = button.getAttribute('data-action');

      if (action === 'back') {
        props.onBack();
        return;
      }

      props.onAction(action);
    });
  });
}
