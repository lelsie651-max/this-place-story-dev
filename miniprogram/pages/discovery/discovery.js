const locationService = require('../../services/locationService');

function formatLocationText(location) {
  const parts = [location.province, location.city, location.name].filter(Boolean);

  if (parts.length > 0) {
    return parts.join('·');
  }

  return location.name || '未命名地点';
}

function formatLocationMeta(location) {
  if (location.tags && location.tags.length > 0) {
    return location.tags.slice(0, 2).join(' / ');
  }

  if (location.level) {
    return location.level;
  }

  return '等待补充地点说明';
}

Page({
  data: {
    locations: [],
    loading: true,
    emptyState: false,
    emptyMessage: '暂时没有发现新的地点',
  },

  onLoad() {
    this.loadLocations();
  },

  async loadLocations() {
    this.setData({
      loading: true,
      emptyState: false,
      emptyMessage: '暂时没有发现新的地点',
    });

    try {
      const locations = await locationService.getPublishedLocations();

      this.setData({
        locations: locations.map(function mapLocation(location) {
          return {
            id: location.id,
            title: formatLocationText(location),
            description: formatLocationMeta(location),
          };
        }),
        loading: false,
        emptyState: locations.length === 0,
      });
    } catch (error) {
      console.warn('Failed to load published locations:', error);
      this.setData({
        locations: [],
        loading: false,
        emptyState: true,
        emptyMessage: error.message || '地点加载失败，请稍后再试。',
      });
    }
  },

  goToLocation(event) {
    const { locationId } = event.currentTarget.dataset;

    if (!locationId) {
      return;
    }

    wx.navigateTo({
      url: '/pages/location/location?locationId=' + locationId,
    });
  },
});
