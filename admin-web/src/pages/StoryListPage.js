const STATUS_OPTIONS = [
  { value: 'pending', label: '待人工审核' },
  { value: 'published', label: '已通过' },
  { value: 'rejected', label: '已打回' },
  { value: 'hidden', label: '已下架' },
  { value: 'all', label: '全部' },
];

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

  if (typeof value === 'string' && value.includes('年')) {
    return value;
  }

  const dateValue = new Date(value);

  if (Number.isNaN(dateValue.getTime())) {
    return '待补充';
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

function renderActions(story) {
  if (story.status === 'pending') {
    return `
      <button class="ghost-button" data-action="open" data-story-id="${escapeHtml(story.storyId)}">人工审核</button>
      <button class="danger-button" data-action="reject" data-story-id="${escapeHtml(story.storyId)}">打回</button>
    `;
  }

  if (story.status === 'published') {
    return `
      <button class="ghost-button" data-action="open" data-story-id="${escapeHtml(story.storyId)}">查看</button>
      <button class="danger-button" data-action="hide" data-story-id="${escapeHtml(story.storyId)}">下架（打回）</button>
    `;
  }

  return `
    <button class="ghost-button" data-action="open" data-story-id="${escapeHtml(story.storyId)}">查看</button>
  `;
}

function renderStoryCard(story) {
  return `
    <article class="story-card">
      <div class="story-card__header">
        <div>
          <h3>${escapeHtml(story.title || '未命名投稿')}</h3>
          <p class="muted">${escapeHtml(story.locationName || '地点待补充')}</p>
        </div>
        <span class="status-badge status-badge--${escapeHtml(story.status || 'pending')}">${escapeHtml(story.statusLabel || '')}</span>
      </div>
      <dl class="meta-grid">
        <div>
          <dt>投稿者</dt>
          <dd>${escapeHtml(story.authorDisplayId || '投稿者#未知')}</dd>
        </div>
        <div>
          <dt>投稿时间</dt>
          <dd>${escapeHtml(formatDateLabel(story.createdAt))}</dd>
        </div>
        <div>
          <dt>最近修改</dt>
          <dd>${escapeHtml(formatDateLabel(story.updatedAt || story.createdAt))}</dd>
        </div>
        <div>
          <dt>审核方式</dt>
          <dd>${story.moderationStatus === 'manual_only' ? '人工审核' : escapeHtml(story.moderationStatus || '未启用')}</dd>
        </div>
      </dl>
      <div class="story-card__actions">
        ${renderActions(story)}
      </div>
    </article>
  `;
}

export function renderStoryListPage(container, props) {
  container.innerHTML = `
    <main class="page">
      <section class="topbar">
        <div>
          <p class="eyebrow">Legend Review</p>
          <h1>网友投稿审核</h1>
          <p class="muted">当前登录：${escapeHtml(props.reviewerId || '管理员')}</p>
        </div>
        <button class="ghost-button" id="logout-button">退出登录</button>
      </section>

      <section class="panel">
        <div class="toolbar">
          <div class="filter-group" id="status-filter-group">
            ${STATUS_OPTIONS.map(function renderOption(option) {
              const activeClass = option.value === props.filters.status ? 'filter-chip--active' : '';
              return `
                <button
                  class="filter-chip ${activeClass}"
                  type="button"
                  data-filter-status="${option.value}"
                >${option.label}</button>
              `;
            }).join('')}
          </div>
          <form class="search-form" id="search-form">
            <input
              class="text-input"
              id="keyword-input"
              type="text"
              maxlength="30"
              placeholder="按标题关键词筛选"
              value="${escapeHtml(props.filters.keyword || '')}"
            />
            <button class="ghost-button" type="submit">筛选</button>
          </form>
        </div>

        <div class="list-feedback">
          ${props.loading ? '<p class="muted">列表加载中...</p>' : ''}
          ${!props.loading && props.errorMessage ? `<p class="form-error">${escapeHtml(props.errorMessage)}</p>` : ''}
          ${!props.loading && !props.errorMessage && props.stories.length === 0 ? '<p class="muted">当前筛选下暂无投稿。</p>' : ''}
        </div>

        <section class="story-list" id="story-list">
          ${props.stories.map(renderStoryCard).join('')}
        </section>

        <div class="pagination">
          <button class="ghost-button" id="prev-button" ${props.hasPrevious ? '' : 'disabled'}>上一页</button>
          <button class="ghost-button" id="next-button" ${props.hasMore ? '' : 'disabled'}>下一页</button>
        </div>
      </section>
    </main>
  `;

  const logoutButton = container.querySelector('#logout-button');
  const prevButton = container.querySelector('#prev-button');
  const nextButton = container.querySelector('#next-button');
  const searchForm = container.querySelector('#search-form');
  const keywordInput = container.querySelector('#keyword-input');

  if (logoutButton) {
    logoutButton.addEventListener('click', function handleLogout() {
      props.onLogout();
    });
  }

  container.querySelectorAll('[data-filter-status]').forEach(function bindFilter(button) {
    button.addEventListener('click', function handleFilterClick() {
      props.onFilterChange(button.getAttribute('data-filter-status') || 'pending');
    });
  });

  container.querySelectorAll('[data-action]').forEach(function bindAction(button) {
    button.addEventListener('click', function handleActionClick() {
      const action = button.getAttribute('data-action');
      const storyId = button.getAttribute('data-story-id');

      if (!storyId) {
        return;
      }

      if (action === 'open') {
        props.onOpenStory(storyId);
        return;
      }

      props.onQuickAction(action, storyId);
    });
  });

  if (prevButton) {
    prevButton.addEventListener('click', function handlePrevClick() {
      props.onPreviousPage();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', function handleNextClick() {
      props.onNextPage();
    });
  }

  if (searchForm) {
    searchForm.addEventListener('submit', function handleSearch(event) {
      event.preventDefault();
      props.onSearch(keywordInput ? keywordInput.value : '');
    });
  }
}
