const assert = require('assert');

const recordExploration = require('./index.js');

function createMockDatabase() {
  const store = {
    locations: {
      'loc-001': {
        _id: 'loc-001',
        name: '南头古城',
      },
      'loc-002': {
        _id: 'loc-002',
        name: '西安城墙',
      },
    },
    explorations: {},
  };
  let serverDateSeed = 0;

  return {
    store: store,
    serverDate() {
      serverDateSeed += 1;
      return 'server-date-' + serverDateSeed;
    },
    collection(name) {
      if (!store[name]) {
        store[name] = {};
      }

      return {
        doc(docId) {
          return {
            async get() {
              if (!store[name][docId]) {
                throw new Error('document.get:fail');
              }

              return {
                data: Object.assign({}, store[name][docId]),
              };
            },
            async set(options) {
              store[name][docId] = Object.assign({}, options.data, {
                _id: docId,
              });
              return {
                _id: docId,
              };
            },
            async update(options) {
              if (!store[name][docId]) {
                throw new Error('document.get:fail');
              }

              store[name][docId] = Object.assign({}, store[name][docId], options.data, {
                _id: docId,
              });
              return {};
            },
          };
        },
      };
    },
  };
}

async function testValidateEvent() {
  const input = recordExploration._private.validateEvent({
    locationId: 'loc-001',
    locationName: '南头古城',
    storyType: 'folk',
  });

  assert.strictEqual(input.locationId, 'loc-001');
  assert.strictEqual(input.locationName, '南头古城');
  assert.strictEqual(input.storyType, 'folk');
}

async function testValidateEventRejectsUnsafeInput() {
  assert.throws(function onUserId() {
    recordExploration._private.validateEvent({
      userId: 'fake-user',
      locationId: 'loc-001',
      locationName: '南头古城',
      storyType: 'folk',
    });
  }, /不接受前端 userId/);

  assert.throws(function onTemporary() {
    recordExploration._private.validateEvent({
      isTemporary: true,
      locationId: 'loc-001',
      locationName: '南头古城',
      storyType: 'folk',
    });
  }, /临时地点暂不记录足迹/);

  assert.throws(function onInvalidType() {
    recordExploration._private.validateEvent({
      locationId: 'loc-001',
      locationName: '南头古城',
      storyType: 'preset',
    });
  }, /故事类型无效/);
}

async function testExplorationIdIsStable() {
  const firstId = recordExploration._private.createExplorationId('user-a', 'loc-001', 'folk');
  const secondId = recordExploration._private.createExplorationId('user-a', 'loc-001', 'folk');
  const thirdId = recordExploration._private.createExplorationId('user-a', 'loc-001', 'ai_comment');

  assert.strictEqual(firstId, secondId);
  assert.notStrictEqual(firstId, thirdId);
}

async function testUpsertCreatesAndUpdatesSingleDoc() {
  const database = createMockDatabase();
  const created = await recordExploration._private.upsertExplorationWithActor(
    database,
    database,
    'openid-001',
    {
      locationId: 'loc-001',
      locationName: '南头古城',
      storyType: 'folk',
    }
  );

  assert.strictEqual(created.created, true);
  assert.strictEqual(created.item.locationId, 'loc-001');
  assert.strictEqual(created.item.locationName, '南头古城');
  assert.strictEqual(created.item.storyType, 'folk');
  assert.strictEqual(created.item.createdAt, 'server-date-1');
  assert.strictEqual(created.item.updatedAt, 'server-date-1');
  assert.strictEqual(created.item.lastExploredAt, 'server-date-1');

  const updated = await recordExploration._private.upsertExplorationWithActor(
    database,
    database,
    'openid-001',
    {
      locationId: 'loc-001',
      locationName: '南头古城',
      storyType: 'folk',
    }
  );

  assert.strictEqual(updated.created, false);
  assert.strictEqual(updated.item.createdAt, 'server-date-1');
  assert.strictEqual(updated.item.updatedAt, 'server-date-2');
  assert.strictEqual(updated.item.lastExploredAt, 'server-date-2');
  assert.strictEqual(Object.keys(database.store.explorations).length, 1);
}

async function testEnsureLocationExistsRejectsMissingLocation() {
  const database = createMockDatabase();

  await assert.rejects(async function shouldReject() {
    await recordExploration._private.ensureLocationExists(database, 'loc-missing');
  }, /当前地点不存在/);
}

async function run() {
  const tests = [
    ['validateEvent accepts formal payload', testValidateEvent],
    ['validateEvent rejects unsafe input', testValidateEventRejectsUnsafeInput],
    ['exploration id is stable', testExplorationIdIsStable],
    ['upsert creates and updates single document', testUpsertCreatesAndUpdatesSingleDoc],
    ['ensureLocationExists rejects missing location', testEnsureLocationExistsRejectsMissingLocation],
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
