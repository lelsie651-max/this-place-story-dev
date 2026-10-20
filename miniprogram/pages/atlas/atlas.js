const explorationService = require('../../services/explorationService');

function padNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '00';
  }

  return numericValue < 10 ? '0' + numericValue : String(numericValue);
}

function formatExplorationTime(timestamp) {
  const numericValue = Number(timestamp);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '时间未知';
  }

  const date = new Date(numericValue);

  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  return [
    date.getFullYear(), '年',
    padNumber(date.getMonth() + 1), '月',
    padNumber(date.getDate()), '日 ',
    padNumber(date.getHours()), ':',
    padNumber(date.getMinutes()),
  ].join('');
}

function normalizeAtlasItem(item) {
  return {
    id: item.id || '',
    locationId: item.locationId || '',
    locationName: item.locationName || '',
    storyType: item.storyType || '',
    storyTypeLabel: item.storyTypeLabel || '未知类型',
    lastExploredAt: item.lastExploredAt || 0,
    lastExploredAtText: formatExplorationTime(item.lastExploredAt),
  };
}

Page({
  data: {
    atlasItems: [],
    loading: false,
    errorMessage: '',
    empty: false,
  },

  onShow() {
    this.loadAtlasItems();
  },

  async loadAtlasItems() {
    this.setData({
      loading: true,
      errorMessage: '',
      empty: false,
    });

    try {
      const atlasItems = (await explorationService.getMyExplorations()).map(normalizeAtlasItem);

      this.setData({
        atlasItems: atlasItems,
        loading: false,
        errorMessage: '',
        empty: atlasItems.length === 0,
      });
    } catch (error) {
      this.setData({
        atlasItems: [],
        loading: false,
        errorMessage: '足迹加载失败，请稍后再试。',
        empty: false,
      });
    }
  },

  handleAtlasItemTap(event) {
    const locationId = event.currentTarget.dataset.locationId;

    if (!locationId) {
      return;
    }

    wx.navigateTo({
      url: '/pages/location/location?locationId=' + locationId,
    });
  },
});
