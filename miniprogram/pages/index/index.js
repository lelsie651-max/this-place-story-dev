function getTopBarStyle() {
  try {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menuButtonRect = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    const statusBarHeight = windowInfo && windowInfo.statusBarHeight ? windowInfo.statusBarHeight : 0;
    const top = menuButtonRect && menuButtonRect.bottom
      ? menuButtonRect.bottom + 4
      : statusBarHeight + 44;
    return 'top:' + top + 'px;';
  } catch (error) {
    return '';
  }
}

Page({
  data: {
    topBarStyle: '',
  },

  onLoad() {
    this.setData({
      topBarStyle: getTopBarStyle(),
    });
  },

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
