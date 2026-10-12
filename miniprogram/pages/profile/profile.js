const userService = require('../../services/userService');

Page({
  data: {
    atlasItems: [],
  },

  onLoad() {
    this.loadAtlasItems();
  },

  loadAtlasItems() {
    const self = this;

    userService.getAtlasItems().then(function handleItems(atlasItems) {
      self.setData({
        atlasItems,
      });
    });
  },
});
