Page({
  goToExplore() {
    wx.navigateTo({
      url: '/pages/explore/explore',
    });
  },

  goToAtlas() {
    wx.navigateTo({
      url: '/pages/profile/profile',
    });
  },
});
