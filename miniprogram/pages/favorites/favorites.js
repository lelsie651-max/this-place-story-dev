const favoriteService = require('../../services/favoriteService');
const locationService = require('../../services/locationService');
const storyService = require('../../services/storyService');

function isUnavailableStoryError(error) {
  const code = error && error.code ? String(error.code) : '';
  const message = error && error.message ? String(error.message) : '';

  return code === 'CONTENT_NOT_AVAILABLE' || message.indexOf('该内容暂不可查看') !== -1;
}

function formatLocationText(location) {
  if (!location) {
    return '地点信息暂不可用';
  }

  if (location.city) {
    return location.city + '·' + location.name;
  }

  return location.name;
}

Page({
  data: {
    favoriteItems: [],
    loading: true,
    errorMessage: '',
  },

  onShow() {
    this.loadFavorites();
  },

  async loadFavorites() {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const favorites = await favoriteService.getFavorites(favoriteService.TEST_USER_ID);
      const favoriteItems = (await Promise.all(
        favorites.map(async function buildFavoriteItem(favorite) {
          const storyId = favorite.storyId || favorite.id;
          let story = null;

          try {
            story = await storyService.getStoryById(storyId);
          } catch (error) {
            if (isUnavailableStoryError(error)) {
              return null;
            }

            throw error;
          }

          let location = null;

          try {
            location = await locationService.getLocationById(story.locationId);
          } catch (locationError) {
            console.warn('Failed to load favorite location:', locationError);
          }

          return {
            id: favorite.id,
            storyId: storyId,
            title: story.title,
            location: formatLocationText(location),
          };
        })
      )).filter(Boolean);

      this.setData({
        favoriteItems: favoriteItems,
        loading: false,
      });
    } catch (error) {
      this.setData({
        favoriteItems: [],
        loading: false,
        errorMessage: error.message || '收藏内容加载失败，请稍后再试。',
      });
    }
  },

  goToStoryDetail(event) {
    const storyId = event.currentTarget.dataset.storyId;

    if (!storyId) {
      wx.showToast({
        title: '故事ID缺失',
        icon: 'none',
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/story/story?storyId=' + storyId,
    });
  },
});
