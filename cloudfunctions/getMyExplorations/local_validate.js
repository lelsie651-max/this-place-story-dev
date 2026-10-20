const assert = require('assert');

const getMyExplorations = require('./index.js');

function createMockDatabase(items) {
  const records = Array.isArray(items) ? items.slice() : [];

  return {
    collection(name) {
      assert.strictEqual(name, 'explorations');

      return {
        where(criteria) {
          const filtered = records.filter(function filterRecord(item) {
            return item.userId === criteria.userId;
          });

          return {
            orderBy(field, direction) {
              assert.strictEqual(field, 'lastExploredAt');
              assert.strictEqual(direction, 'desc');
              const sorted = filtered.slice().sort(function sortByDate(left, right) {
                return String(right.lastExploredAt).localeCompare(String(left.lastExploredAt));
              });

              return {
                limit(maxItems) {
                  return {
                    async get() {
                      return {
                        data: sorted.slice(0, maxItems),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

async function testValidateEventRejectsUserId() {
  assert.throws(function shouldThrow() {
    getMyExplorations._private.validateEvent({
      userId: 'fake-user',
    });
  }, /不接受前端 userId/);
}

async function testListExplorationsByUserSortsAndFilters() {
  const database = createMockDatabase([
    {
      _id: 'exp-1',
      userId: 'openid-a',
      locationId: 'loc-001',
      locationName: '南头古城',
      storyType: 'folk',
      lastExploredAt: '2026-10-20T09:00:00.000Z',
      createdAt: '2026-10-19T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
    },
    {
      _id: 'exp-2',
      userId: 'openid-a',
      locationId: 'loc-002',
      locationName: '西安城墙',
      storyType: 'traveler',
      lastExploredAt: '2026-10-21T09:00:00.000Z',
      createdAt: '2026-10-19T10:00:00.000Z',
      updatedAt: '2026-10-21T09:00:00.000Z',
    },
    {
      _id: 'exp-3',
      userId: 'openid-b',
      locationId: 'loc-003',
      locationName: '岳阳楼',
      storyType: 'ai_comment',
      lastExploredAt: '2026-10-22T09:00:00.000Z',
      createdAt: '2026-10-19T11:00:00.000Z',
      updatedAt: '2026-10-22T09:00:00.000Z',
    },
  ]);
  const items = await getMyExplorations._private.listExplorationsByUser(database, 'openid-a', 100);

  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0]._id, 'exp-2');
  assert.strictEqual(items[1]._id, 'exp-1');
  assert.strictEqual(items[0].locationName, '西安城墙');
}

async function testNormalizeExplorationDoc() {
  const item = getMyExplorations._private.normalizeExplorationDoc({
    _id: 'exp-1',
    userId: 'openid-a',
    locationId: 'loc-001',
    locationName: '南头古城',
    storyType: 'folk',
    lastExploredAt: '2026-10-20T09:00:00.000Z',
  });

  assert.strictEqual(item._id, 'exp-1');
  assert.strictEqual(item.locationId, 'loc-001');
  assert.strictEqual(item.storyType, 'folk');
}

async function run() {
  const tests = [
    ['validateEvent rejects userId', testValidateEventRejectsUserId],
    ['listExplorationsByUser sorts and filters', testListExplorationsByUserSortsAndFilters],
    ['normalizeExplorationDoc keeps core fields', testNormalizeExplorationDoc],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
