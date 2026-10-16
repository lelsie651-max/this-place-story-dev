const favoriteService = require('../../services/favoriteService');
const userService = require('../../services/userService');

Page({
  data: {
    favoriteCount: 0,
    magnifyingGlass: 0,
    menuItems: [
      { key: 'atlas', label: '我的图鉴', icon: '🗺', route: '/pages/atlas/atlas' },
      { key: 'favorites', label: '我的收藏', icon: '🤍', route: '/pages/favorites/favorites' },
      { key: 'stories', label: '我的故事', icon: '📖' },
      { key: 'language', label: '语言设置', icon: '🌐' },
      { key: 'settings', label: '设置', icon: '⚙️' },
    ],
  },

  onShow() {
    this.loadFavoriteCount();
    this.loadProfileAsset();
  },

  async loadFavoriteCount() {
    try {
      const favorites = await favoriteService.getFavorites(favoriteService.TEST_USER_ID);

      this.setData({
        favoriteCount: favorites.length,
      });
    } catch (error) {
      console.warn('Failed to load favorite count:', error);
      this.setData({
        favoriteCount: 0,
      });
    }
  },

  async loadProfileAsset() {
    try {
      const profile = await userService.getCurrentUserProfile();

      this.setData({
        magnifyingGlass: profile.magnifyingGlass || 0,
      });
    } catch (error) {
      console.warn('Failed to load profile asset:', error);
      this.setData({
        magnifyingGlass: 0,
      });
    }
  },

  handleMenuTap(event) {
    const route = event.currentTarget.dataset.route;

    if (route) {
      wx.navigateTo({
        url: route,
      });
      return;
    }

    wx.showToast({
      title: '功能准备中',
      icon: 'none',
    });
  },
});
