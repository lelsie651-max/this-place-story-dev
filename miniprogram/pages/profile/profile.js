Page({
  data: {
    menuItems: [
      { key: 'atlas', label: '我的图鉴', icon: '🗺' },
      { key: 'favorites', label: '我的收藏', icon: '🤍' },
      { key: 'stories', label: '我的故事', icon: '📖' },
      { key: 'magnifier', label: '放大镜', icon: '🔎' },
      { key: 'language', label: '语言设置', icon: '🌐' },
      { key: 'settings', label: '设置', icon: '⚙️' },
    ],
  },

  showComingSoon() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none',
    });
  },
});
