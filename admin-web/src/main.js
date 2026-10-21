import './styles/global.css';

import { getStoryDetail, isAuthError, listStories, login, reviewStory } from './api/adminApi';
import { getLoginErrorMessage, performAdminLogin } from './auth/loginFlow';
import { clearSession, getSession, isSessionExpired, saveSession } from './auth/session';
import { renderLoginPage } from './pages/LoginPage';
import { renderStoryDetailPage } from './pages/StoryDetailPage';
import { renderStoryListPage } from './pages/StoryListPage';

const appElement = document.querySelector('#app');
const PAGE_SIZE = 20;

const state = {
  session: null,
  view: 'login',
  login: {
    loading: false,
    errorMessage: '',
  },
  list: {
    loading: false,
    errorMessage: '',
    stories: [],
    status: 'pending',
    keyword: '',
    cursor: '',
    previousCursors: [],
    nextCursor: '',
    hasMore: false,
    pageSize: PAGE_SIZE,
  },
  detail: {
    loading: false,
    errorMessage: '',
    storyId: '',
    story: null,
  },
};

function resetSession() {
  clearSession();
  state.session = null;
  state.view = 'login';
  state.login.loading = false;
  state.login.errorMessage = '';
  state.detail = {
    loading: false,
    errorMessage: '',
    storyId: '',
    story: null,
  };
}

function getErrorMessage(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (isAuthError(error)) {
    resetSession();
    renderApp();
    return '';
  }

  return error.message || fallbackMessage;
}

function renderApp() {
  if (!appElement) {
    return;
  }

  if (!state.session || isSessionExpired(state.session)) {
    resetSession();
    renderLoginPage(appElement, {
      loading: state.login.loading,
      errorMessage: state.login.errorMessage,
      onLogin: handleLogin,
    });
    return;
  }

  if (state.view === 'detail') {
    renderStoryDetailPage(appElement, {
      reviewerId: state.session.reviewerId,
      loading: state.detail.loading,
      errorMessage: state.detail.errorMessage,
      story: state.detail.story,
      onBack: function onBack() {
        state.view = 'list';
        renderApp();
      },
      onAction: handleDetailAction,
      onLogout: resetAndRender,
    });
    return;
  }

  renderStoryListPage(appElement, {
    reviewerId: state.session.reviewerId,
    loading: state.list.loading,
    errorMessage: state.list.errorMessage,
    stories: state.list.stories,
    hasMore: state.list.hasMore,
    hasPrevious: state.list.previousCursors.length > 0,
    filters: {
      status: state.list.status,
      keyword: state.list.keyword,
    },
    onFilterChange: function onFilterChange(status) {
      state.list.status = status;
      state.list.cursor = '';
      state.list.previousCursors = [];
      loadStoryList();
    },
    onSearch: function onSearch(keyword) {
      state.list.keyword = String(keyword || '').trim();
      state.list.cursor = '';
      state.list.previousCursors = [];
      loadStoryList();
    },
    onNextPage: function onNextPage() {
      if (!state.list.nextCursor) {
        return;
      }

      state.list.previousCursors = state.list.previousCursors.concat([state.list.cursor]);
      state.list.cursor = state.list.nextCursor;
      loadStoryList();
    },
    onPreviousPage: function onPreviousPage() {
      if (state.list.previousCursors.length === 0) {
        return;
      }

      const nextHistory = state.list.previousCursors.slice();
      state.list.cursor = nextHistory.pop() || '';
      state.list.previousCursors = nextHistory;
      loadStoryList();
    },
    onOpenStory: openStoryDetail,
    onQuickAction: handleQuickAction,
    onLogout: resetAndRender,
  });
}

function resetAndRender() {
  resetSession();
  renderApp();
}

async function handleLogin(secret) {
  state.login.loading = true;
  state.login.errorMessage = '';
  renderApp();

  try {
    state.session = await performAdminLogin(secret, {
      login: login,
      saveSession: saveSession,
      getSession: getSession,
    });
    state.view = 'list';
    state.list.cursor = '';
    state.list.previousCursors = [];
    state.login.loading = false;
    renderApp();
    await loadStoryList();
  } catch (error) {
    state.login.loading = false;
    state.login.errorMessage = getLoginErrorMessage(error);
    renderApp();
  }
}

async function loadStoryList() {
  if (!state.session) {
    resetAndRender();
    return;
  }

  state.view = 'list';
  state.list.loading = true;
  state.list.errorMessage = '';
  renderApp();

  try {
    const result = await listStories(state.session, {
      status: state.list.status,
      keyword: state.list.keyword,
      cursor: state.list.cursor,
      pageSize: state.list.pageSize,
    });

    state.list.loading = false;
    state.list.stories = result.stories;
    state.list.nextCursor = result.nextCursor;
    state.list.hasMore = !!result.hasMore;
    renderApp();
  } catch (error) {
    state.list.loading = false;
    state.list.stories = [];
    state.list.nextCursor = '';
    state.list.hasMore = false;
    state.list.errorMessage = getErrorMessage(error, '投稿列表读取失败，请稍后再试。');
    renderApp();
  }
}

async function openStoryDetail(storyId) {
  state.view = 'detail';
  state.detail.storyId = storyId;
  state.detail.loading = true;
  state.detail.errorMessage = '';
  state.detail.story = null;
  renderApp();

  try {
    const story = await getStoryDetail(state.session, storyId);
    state.detail.loading = false;
    state.detail.story = story;
    renderApp();
  } catch (error) {
    state.detail.loading = false;
    state.detail.errorMessage = getErrorMessage(error, '投稿详情读取失败，请稍后再试。');
    renderApp();
  }
}

function getActionReason(action) {
  if (action === 'reject') {
    return window.prompt('请输入打回原因');
  }

  if (action === 'hide') {
    return window.prompt('请输入下架原因');
  }

  return '';
}

function getExpectedStatusForAction(action, story) {
  if (action === 'approve' || action === 'reject') {
    return 'pending';
  }

  if (action === 'hide') {
    return 'published';
  }

  return story?.status || '';
}

async function submitReview(action, story) {
  const reason = getActionReason(action);

  if ((action === 'reject' || action === 'hide') && !String(reason || '').trim()) {
    window.alert('原因不能为空。');
    return;
  }

  try {
    await reviewStory(state.session, {
      storyId: story.storyId,
      action: action,
      expectedStatus: getExpectedStatusForAction(action, story),
      reason: String(reason || '').trim(),
    });

    window.alert('操作成功。');
    state.view = 'list';
    state.list.cursor = '';
    state.list.previousCursors = [];
    renderApp();
    await loadStoryList();
  } catch (error) {
    const safeMessage = getErrorMessage(error, '审核提交失败，请稍后再试。');

    if (safeMessage) {
      window.alert(safeMessage);
    }
  }
}

async function handleQuickAction(action, storyId) {
  const story = state.list.stories.find(function findStory(item) {
    return item.storyId === storyId;
  });

  if (!story) {
    return;
  }

  if (action !== 'reject' && action !== 'hide') {
    return;
  }

  await submitReview(action, story);
}

async function handleDetailAction(action) {
  if (!state.detail.story) {
    return;
  }

  if (action === 'approve' || action === 'reject' || action === 'hide') {
    await submitReview(action, state.detail.story);
  }
}

function bootstrap() {
  const session = getSession();

  if (session && !isSessionExpired(session)) {
    state.session = session;
    state.view = 'list';
    renderApp();
    loadStoryList();
    return;
  }

  resetSession();
  renderApp();
}

window.setInterval(function watchSessionExpiry() {
  if (state.session && isSessionExpired(state.session)) {
    resetAndRender();
  }
}, 30 * 1000);

bootstrap();
