const LOCATION_MODEL = {
  collection: 'locations',
  fields: {
    name: '地点名称',
    city: '城市',
    province: '省份',
    country: '国家',
    latitude: '纬度',
    longitude: '经度',
    level: '地点等级，例如 landmark / historic',
    tags: '标签数组',
  },
};

module.exports = {
  LOCATION_MODEL,
};
