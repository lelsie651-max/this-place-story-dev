const { initCloud } = require('./cloud');

const LOCATION_LIST = [
  {
    id: 'loc-nantou',
    name: '南头古城',
    city: '深圳',
    province: '广东',
    country: '中国',
    latitude: 22.5333,
    longitude: 113.9294,
    level: 'historic',
    tags: ['古城', '城市记忆', '步行探索'],
  },
  {
    id: 'loc-xian-wall',
    name: '西安城墙',
    city: '西安',
    province: '陕西',
    country: '中国',
    latitude: 34.2594,
    longitude: 108.9423,
    level: 'landmark',
    tags: ['城墙', '历史地标', '夜游'],
  },
];

function listLocations() {
  initCloud();
  return Promise.resolve(LOCATION_LIST.slice());
}

function getLocationById(locationId) {
  initCloud();
  const location = LOCATION_LIST.find(function findItem(item) {
    return item.id === locationId;
  });

  return Promise.resolve(location || null);
}

module.exports = {
  getLocationById,
  listLocations,
};
