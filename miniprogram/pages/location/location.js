const locationService = require('../../services/locationService');

const STORY_TYPE_LABELS = {
  ai_comment: 'AI说',
  folk: '民间传说',
  traveler: '网友说',
};

function formatCityText(location) {
  return [location.country, location.province, location.city].filter(Boolean).join(' · ') || '城市信息待补充';
}

function formatLocationIntro(location) {
  if (location.description) {
    return location.description;
  }

  if (location.tags && location.tags.length > 0) {
    return '这里留下的线索包括：' + location.tags.join('、') + '。';
  }

  if (location.level) {
    return '地点类型：' + location.level + '。';
  }

  return '这个地点的简介还在整理中，先看看这里已经公开的故事。';
}

function formatStorySummary(content) {
  if (!content) {
    return '故事内容待补充。';
  }

  const normalized = content.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 52) {
    return normalized;
  }

  return normalized.slice(0, 52) + '...';
}

Page({
  data: {
    locationDetail: null,
    stories: [],
    loading: true,
    errorMessage: '',
  },

  onLoad(options) {
    if (!options || !options.locationId) {
      this.setData({
        loading: false,
        errorMessage: '缺少地点参数，暂时无法查看地点详情。',
      });
      return;
    }

    this.loadLocationDetail(options.locationId);
  },

  async loadLocationDetail(locationId) {
    this.setData({
      loading: true,
      errorMessage: '',
    });

    try {
      const location = await locationService.getLocationById(locationId);

      if (!location) {
        throw new Error('该地点不存在，或暂时无法读取。');
      }

      const stories = await locationService.getStoriesByLocationId(locationId);

      this.setData({
        locationDetail: {
          id: location.id,
          name: location.name || '未命名地点',
          cityText: formatCityText(location),
          intro: formatLocationIntro(location),
          storyCount: stories.length,
        },
        stories: stories.map(function mapStory(story) {
          return {
            id: story.id,
            title: story.title || '未命名故事',
            typeLabel: STORY_TYPE_LABELS[story.type] || story.type || '未分类',
            summary: formatStorySummary(story.content),
          };
        }),
        loading: false,
      });
    } catch (error) {
      this.setData({
        locationDetail: null,
        stories: [],
        loading: false,
        errorMessage: error.message || '地点详情加载失败，请稍后再试。',
      });
    }
  },

  goToStoryDetail(event) {
    const { storyId } = event.currentTarget.dataset;

    if (!storyId) {
      return;
    }

    wx.navigateTo({
      url: '/pages/story/story?storyId=' + storyId,
    });
  },
});
