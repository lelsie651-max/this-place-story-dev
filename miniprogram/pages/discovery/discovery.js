const locationService = require('../../services/locationService');

function normalizeSearchKeyword(value) {
  return String(value || '').trim().toLowerCase();
}

function formatLocationText(location) {
  const parts = [location.province, location.city, location.name].filter(Boolean);

  if (parts.length > 0) {
    return parts.join('·');
  }

  return location.name || '未命名地点';
}

function formatLocationMeta(location) {
  if (location.intro) {
    return location.intro;
  }

  if (location.description) {
    return location.description;
  }

  if (location.tags && location.tags.length > 0) {
    return location.tags.slice(0, 2).join(' / ');
  }

  if (location.level) {
    return location.level;
  }

  return '等待补充地点说明';
}

function buildSearchFields(location) {
  return [
    location.name,
    location.city,
    location.province,
    location.country,
    location.intro,
    location.description,
    location.level,
    location.tags && location.tags.length > 0 ? location.tags.join(' ') : '',
  ].filter(Boolean);
}

Page({
  data: {
    allLocations: [],
    filteredLocations: [],
    searchKeyword: '',
    loading: true,
    emptyState: false,
    emptyMessage: '暂时没有发现新的地点',
    errorMessage: '',
  },

  onLoad() {
    this.loadLocations();
  },

  async loadLocations() {
    this.setData({
      loading: true,
      emptyState: false,
      emptyMessage: '暂时没有发现新的地点',
      errorMessage: '',
    });

    try {
      const locations = await locationService.getPublishedLocations();
      const mappedLocations = locations.map(function mapLocation(location) {
        return {
          id: location.id,
          title: formatLocationText(location),
          description: formatLocationMeta(location),
          name: location.name || '',
          city: location.city || '',
          province: location.province || '',
          country: location.country || '',
          intro: location.intro || '',
          rawDescription: location.description || '',
          level: location.level || '',
          tags: location.tags || [],
          searchFields: buildSearchFields(location),
        };
      });

      this.setData({
        allLocations: mappedLocations,
        filteredLocations: mappedLocations,
        loading: false,
        emptyState: locations.length === 0,
        errorMessage: '',
      });
    } catch (error) {
      console.warn('Failed to load published locations:', error);
      this.setData({
        allLocations: [],
        filteredLocations: [],
        loading: false,
        emptyState: false,
        errorMessage: error.message || '地点加载失败，请稍后再试。',
      });
    }
  },

  handleSearchInput(event) {
    const rawValue = event && event.detail ? event.detail.value : '';
    const searchKeyword = String(rawValue || '').trim();
    const normalizedKeyword = normalizeSearchKeyword(rawValue);
    const allLocations = this.data.allLocations || [];
    const filteredLocations = !normalizedKeyword
      ? allLocations.slice()
      : allLocations.filter(function matchLocation(location) {
          return (location.searchFields || []).some(function matchField(fieldValue) {
            return normalizeSearchKeyword(fieldValue).indexOf(normalizedKeyword) !== -1;
          });
        });

    this.setData({
      searchKeyword: searchKeyword,
      filteredLocations: filteredLocations,
      emptyState: !this.data.loading && !this.data.errorMessage && allLocations.length === 0,
      emptyMessage: normalizedKeyword ? '没有找到相关地点' : '暂时没有发现新的地点',
    });
  },

  clearSearchKeyword() {
    const allLocations = this.data.allLocations || [];

    this.setData({
      searchKeyword: '',
      filteredLocations: allLocations.slice(),
      emptyState: !this.data.loading && !this.data.errorMessage && allLocations.length === 0,
      emptyMessage: '暂时没有发现新的地点',
    });
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
