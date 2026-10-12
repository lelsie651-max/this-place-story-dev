Page({
  goToExplore() {
    wx.navigateTo({
      url: '/pages/explore/explore',
    });
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile',
    });
  },

  showComingSoon() {
    wx.showToast({
      title: '功能即将开放',
      icon: 'none',
    });
  },
});
