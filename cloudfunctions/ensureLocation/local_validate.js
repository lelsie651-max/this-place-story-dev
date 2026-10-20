const assert = require('assert');
const Module = require('module');
const path = require('path');

function createMockCloudEnvironment(seed) {
  const state = {
    collections: Object.assign({
      locations: {},
    }, seed || {}),
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function materialize(value) {
    if (value && typeof value === 'object' && value.__serverDate === true) {
      return '2099-01-01T00:00:00.000Z';
    }

    if (Array.isArray(value)) {
      return value.map(materialize);
    }

    if (value && typeof value === 'object') {
      return Object.keys(value).reduce(function assignField(result, key) {
        result[key] = materialize(value[key]);
        return result;
      }, {});
    }

    return value;
  }

  function matchesQuery(doc, query) {
    return Object.keys(query || {}).every(function matchField(key) {
      const expected = query[key];

      if (expected && typeof expected === 'object' && expected.__op === 'in') {
        return expected.values.indexOf(doc[key]) !== -1;
      }

      return doc[key] === expected;
    });
  }

  function createCollectionApi(collectionName) {
    if (!state.collections[collectionName]) {
      state.collections[collectionName] = {};
    }

    const store = state.collections[collectionName];

    return {
      doc(docId) {
        return {
          async get() {
            if (!store[docId]) {
              throw new Error('document.get:fail');
            }

            return {
              data: clone(store[docId]),
            };
          },
          async set(options) {
            store[docId] = Object.assign({
              _id: docId,
            }, materialize(options && options.data ? options.data : {}));
            return {
              _id: docId,
            };
          },
          async update(options) {
            if (!store[docId]) {
              throw new Error('document.get:fail');
            }

            store[docId] = Object.assign({}, store[docId], materialize(options && options.data ? options.data : {}), {
              _id: docId,
            });
            return {
              updated: 1,
            };
          },
        };
      },
      where(query) {
        return {
          limit(count) {
            return {
              async get() {
                const matched = Object.keys(store)
                  .map(function mapDocId(docId) {
                    return clone(store[docId]);
                  })
                  .filter(function filterDoc(doc) {
                    return matchesQuery(doc, query || {});
                  })
                  .slice(0, count);

                return {
                  data: matched,
                };
              },
            };
          },
          async get() {
            return {
              data: Object.keys(store)
                .map(function mapDocId(docId) {
                  return clone(store[docId]);
                })
                .filter(function filterDoc(doc) {
                  return matchesQuery(doc, query || {});
                }),
            };
          },
        };
      },
    };
  }

  const mockDb = {
    command: {
      in(values) {
        return {
          __op: 'in',
          values: values.slice(0),
        };
      },
    },
    collection(collectionName) {
      return createCollectionApi(collectionName);
    },
    serverDate() {
      return {
        __serverDate: true,
      };
    },
    async runTransaction(callback) {
      return callback({
        collection(collectionName) {
          return createCollectionApi(collectionName);
        },
      });
    },
  };

  return {
    state: state,
    sdk: {
      DYNAMIC_CURRENT_ENV: 'mock-env',
      init() {},
      database() {
        return mockDb;
      },
      getWXContext() {
        return {
          OPENID: 'openid-demo',
        };
      },
    },
  };
}

function loadEnsureLocationModule(seed) {
  const targetPath = path.join(__dirname, 'index.js');
  const originalLoad = Module._load;
  const mockCloud = createMockCloudEnvironment(seed);

  delete require.cache[targetPath];

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'wx-server-sdk') {
      return mockCloud.sdk;
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return {
      module: require(targetPath),
      state: mockCloud.state,
    };
  } finally {
    Module._load = originalLoad;
    delete require.cache[targetPath];
  }
}

function createInput(overrides) {
  return Object.assign({
    source: 'wechat_chooseLocation',
    name: '南头古城',
    address: '深圳市南山区南头古城',
    city: '深圳',
    province: '广东',
    latitude: 22.543096,
    longitude: 113.929424,
    poiid: 'poi-demo-001',
  }, overrides || {});
}

async function testValidateEventNormalizesFields() {
  const loaded = loadEnsureLocationModule();
  const privateApi = loaded.module._private;
  const normalized = privateApi.validateEvent(createInput({
    name: ' 南头古城 ',
    address: ' 深圳市南山区南头古城 ',
  }));

  assert.strictEqual(normalized.name, '南头古城');
  assert.strictEqual(normalized.city, '深圳');
  assert.strictEqual(normalized.normalizedName, '南头古城');
  assert.ok(normalized.normalizedAddress);
}

async function testComputeDedupeKeyPrefersPoiid() {
  const loaded = loadEnsureLocationModule();
  const privateApi = loaded.module._private;
  const normalized = privateApi.validateEvent(createInput());
  const dedupeKey = privateApi.computeDedupeKey(normalized);

  assert.ok(dedupeKey.indexOf('ensure_location:v1:poiid:') === 0);
}

async function testComputeDedupeKeyFallsBackToText() {
  const loaded = loadEnsureLocationModule();
  const privateApi = loaded.module._private;
  const normalized = privateApi.validateEvent(createInput({
    poiid: '',
  }));
  const dedupeKey = privateApi.computeDedupeKey(normalized);

  assert.ok(dedupeKey.indexOf('ensure_location:v1:text:') === 0);
}

async function testEnsureLocationIdentityReusesExistingPoiidLocation() {
  const loaded = loadEnsureLocationModule({
    locations: {
      'loc-existing-001': {
        _id: 'loc-existing-001',
        name: '南头古城',
        address: '深圳市南山区南头古城',
        city: '深圳',
        province: '广东',
        latitude: 22.543096,
        longitude: 113.929424,
        poiid: 'poi-demo-001',
        status: 'published',
      },
    },
  });
  const privateApi = loaded.module._private;
  const result = await privateApi.ensureLocationIdentity(
    privateApi.validateEvent(createInput()),
    'openid-demo'
  );

  assert.strictEqual(result.isTemporary, false);
  assert.strictEqual(result.locationId, 'loc-existing-001');
  assert.strictEqual(result.reused, true);
  assert.ok(result.matchReason.indexOf('poiid') !== -1);
}

async function testEnsureLocationIdentityCreatesCandidateForNewPlace() {
  const loaded = loadEnsureLocationModule();
  const privateApi = loaded.module._private;
  const result = await privateApi.ensureLocationIdentity(
    privateApi.validateEvent(createInput({
      poiid: '',
    })),
    'openid-demo'
  );

  assert.strictEqual(result.isTemporary, false);
  assert.strictEqual(result.created, true);
  assert.ok(result.locationId);
  assert.ok(loaded.state.collections.locations[result.locationId]);
  assert.strictEqual(loaded.state.collections.locations[result.locationId].status, 'candidate');
}

async function testEnsureLocationIdentityReusesSameCandidateByDedupeKey() {
  const loaded = loadEnsureLocationModule();
  const privateApi = loaded.module._private;
  const firstInput = privateApi.validateEvent(createInput({
    poiid: '',
  }));
  const secondInput = privateApi.validateEvent(createInput({
    poiid: '',
  }));
  const firstResult = await privateApi.ensureLocationIdentity(firstInput, 'openid-demo');
  const secondResult = await privateApi.ensureLocationIdentity(secondInput, 'openid-demo');

  assert.strictEqual(firstResult.locationId, secondResult.locationId);
  assert.strictEqual(Object.keys(loaded.state.collections.locations).length, 1);
  assert.strictEqual(secondResult.reused, true);
}

async function testEnsureLocationFallsBackWhenDedupeKeyCannotBeBuilt() {
  const loaded = loadEnsureLocationModule();
  const privateApi = loaded.module._private;
  const result = await privateApi.ensureLocationIdentity(
    privateApi.validateEvent(createInput({
      poiid: '',
      address: '',
      city: '',
      province: '',
    })),
    'openid-demo'
  );

  assert.strictEqual(result.isTemporary, true);
  assert.strictEqual(result.locationId, null);
  assert.ok(result.fallbackReason);
}

async function run() {
  const tests = [
    ['Validate event normalizes fields', testValidateEventNormalizesFields],
    ['Compute dedupe key prefers poiid', testComputeDedupeKeyPrefersPoiid],
    ['Compute dedupe key falls back to text', testComputeDedupeKeyFallsBackToText],
    ['Ensure location reuses existing poiid location', testEnsureLocationIdentityReusesExistingPoiidLocation],
    ['Ensure location creates candidate for new place', testEnsureLocationIdentityCreatesCandidateForNewPlace],
    ['Ensure location reuses same candidate by dedupe key', testEnsureLocationIdentityReusesSameCandidateByDedupeKey],
    ['Ensure location falls back when dedupe key cannot be built', testEnsureLocationFallsBackWhenDedupeKeyCannotBeBuilt],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }

  console.log('[PASS] ensureLocation validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
