Page({
  data: {
    menuItems: [
      { key: 'atlas', label: '我的图鉴', icon: '🗺', route: '/pages/atlas/atlas' },
      { key: 'favorites', label: '我的收藏', icon: '🤍', route: '/pages/favorites/favorites' },
      { key: 'stories', label: '我的故事', icon: '📖' },
      { key: 'language', label: '语言设置', icon: '🌐' },
      { key: 'settings', label: '设置', icon: '⚙️' },
    ],
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
      title: '功能开发中',
      icon: 'none',
    });
  },
});
