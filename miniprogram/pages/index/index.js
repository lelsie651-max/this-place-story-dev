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

  goToPublish() {
    wx.navigateTo({
      url: '/pages/publish/publish',
    });
  },
});
