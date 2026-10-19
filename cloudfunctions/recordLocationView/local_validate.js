const assert = require('assert');

const recordLocationView = require('./index.js');

const helpers = recordLocationView._private;

function createActor(initialDocs) {
  const documents = Object.assign({}, initialDocs || {});

  return {
    collection(name) {
      assert.strictEqual(name, helpers.LOCATIONS_COLLECTION);

      return {
        doc(id) {
          return {
            async get() {
              if (!Object.prototype.hasOwnProperty.call(documents, id)) {
                const error = new Error('document.get:fail document does not exist');
                throw error;
              }

              return {
                data: Object.assign({
                  _id: id,
                }, documents[id]),
              };
            },
            async update(payload) {
              if (!Object.prototype.hasOwnProperty.call(documents, id)) {
                const error = new Error('document.update:fail document does not exist');
                throw error;
              }

              const nextDoc = Object.assign({}, documents[id]);
              const data = payload && payload.data ? payload.data : {};

              Object.keys(data).forEach(function applyField(key) {
                const value = data[key];

                if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '$inc')) {
                  const currentValue = Number(nextDoc[key]);
                  const baseValue = Number.isFinite(currentValue) ? currentValue : 0;
                  nextDoc[key] = baseValue + Number(value.$inc);
                  return;
                }

                nextDoc[key] = value;
              });

              documents[id] = nextDoc;
              return {
                stats: {
                  updated: 1,
                },
              };
            },
          };
        },
      };
    },
    getDocument(id) {
      return documents[id];
    },
  };
}

function testRejectEmptyLocationId() {
  assert.throws(function shouldThrow() {
    helpers.validateEvent({
      locationId: '',
    });
  }, function verify(error) {
    return error && error.code === 'INVALID_INPUT';
  });
}

function testRejectNullStringLocationId() {
  assert.throws(function shouldThrow() {
    helpers.validateEvent({
      locationId: 'null',
    });
  }, function verify(error) {
    return error && error.code === 'INVALID_INPUT';
  });
}

async function testRejectMissingLocation() {
  const actor = createActor({});

  await assert.rejects(
    helpers.incrementLocationView(actor, 'loc-missing'),
    function verify(error) {
      return error && error.code === 'LOCATION_NOT_FOUND';
    }
  );
}

async function testRejectNonPublishedLocation() {
  const actor = createActor({
    'loc-draft': {
      status: 'draft',
      viewCount: 3,
    },
  });

  await assert.rejects(
    helpers.incrementLocationView(actor, 'loc-draft'),
    function verify(error) {
      return error && error.code === 'LOCATION_NOT_PUBLISHED';
    }
  );
}

async function testIncrementPublishedLocation() {
  const actor = createActor({
    'loc-published': {
      status: 'published',
      viewCount: 9,
    },
  });
  const result = await helpers.incrementLocationView(actor, 'loc-published');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.locationId, 'loc-published');
  assert.strictEqual(result.viewCount, 10);
  assert.strictEqual(actor.getDocument('loc-published').viewCount, 10);
}

async function testMissingViewCountStartsFromOne() {
  const actor = createActor({
    'loc-new-count': {
      status: 'published',
    },
  });
  const result = await helpers.incrementLocationView(actor, 'loc-new-count');

  assert.strictEqual(result.viewCount, 1);
  assert.strictEqual(actor.getDocument('loc-new-count').viewCount, 1);
}

function testNormalizeViewCountBoundaries() {
  assert.strictEqual(helpers.normalizeViewCount(undefined), 0);
  assert.strictEqual(helpers.normalizeViewCount(null), 0);
  assert.strictEqual(helpers.normalizeViewCount('abc'), 0);
  assert.strictEqual(helpers.normalizeViewCount(-3), 0);
  assert.strictEqual(helpers.normalizeViewCount(1000), 1000);
  assert.strictEqual(helpers.normalizeViewCount(1001), 1001);
}

function testHotBoundaryPayload() {
  const atBoundary = helpers.buildSuccess('loc-001', 1000);
  const overBoundary = helpers.buildSuccess('loc-001', 1001);

  assert.strictEqual(atBoundary.isHot, false);
  assert.strictEqual(overBoundary.isHot, true);
}

async function run() {
  testRejectEmptyLocationId();
  testRejectNullStringLocationId();
  await testRejectMissingLocation();
  await testRejectNonPublishedLocation();
  await testIncrementPublishedLocation();
  await testMissingViewCountStartsFromOne();
  testNormalizeViewCountBoundaries();
  testHotBoundaryPayload();

  console.log('[PASS] recordLocationView local validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
