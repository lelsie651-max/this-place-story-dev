Page({
  goToExplore() {
    wx.navigateTo({
      url: '/pages/discovery/discovery',
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
