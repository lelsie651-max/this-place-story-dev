const assert = require('assert');

process.env.ADMIN_LOGIN_SECRET = 'legend-secret';

const adminListStories = require('./index.js');

function createToken(expiresAt) {
  const secret = 'legend-secret';
  const payload = Buffer.from(JSON.stringify({
    version: 'adminv1',
    reviewerId: adminListStories._private.createReviewerId(secret),
    issuedAt: expiresAt - 1000,
    expiresAt: expiresAt,
    scope: 'admin_review',
  }), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const signature = adminListStories._private.signPayload(payload, secret);

  return 'adminv1.' + payload + '.' + signature;
}

function createActor() {
  const store = {
    locations: {
      'loc-1': {
        _id: 'loc-1',
        name: '南头古城',
      },
      'loc-2': {
        _id: 'loc-2',
        name: '中山公园',
      },
    },
    stories: [
      {
        _id: 'story-pending',
        title: '等待审核的投稿',
        summary: '待人工审核',
        source: 'user',
        type: 'traveler',
        status: 'pending',
        authorId: 'openid-a',
        locationId: 'loc-1',
        createdAt: '2026-10-21T10:00:00.000Z',
      },
      {
        _id: 'story-published',
        title: '已经公开的投稿',
        summary: '已通过',
        source: 'user',
        type: 'traveler',
        status: 'published',
        authorId: 'openid-b',
        locationId: 'loc-2',
        createdAt: '2026-10-20T10:00:00.000Z',
      },
      {
        _id: 'story-deleted',
        title: '已删除投稿',
        summary: '删除内容',
        source: 'user',
        type: 'traveler',
        status: 'deleted',
        authorId: 'openid-c',
        locationId: 'loc-1',
        createdAt: '2026-10-19T10:00:00.000Z',
      },
      {
        _id: 'story-other-source',
        title: 'AI 生成内容',
        summary: '不应进入后台',
        source: 'deepseek',
        type: 'traveler',
        status: 'pending',
        authorId: 'openid-d',
        locationId: 'loc-1',
        createdAt: '2026-10-18T10:00:00.000Z',
      },
    ],
  };

  return {
    command: {
      neq(value) {
        return {
          __op: 'neq',
          value: value,
        };
      },
    },
    collection(name) {
      if (name === 'locations') {
        return {
          doc(docId) {
            return {
              async get() {
                return {
                  data: store.locations[docId],
                };
              },
            };
          },
        };
      }

      return {
        where(query) {
          const filtered = store.stories.filter(function matchStory(story) {
            return Object.keys(query).every(function matchField(key) {
              const expectedValue = query[key];

              if (expectedValue && expectedValue.__op === 'neq') {
                return story[key] !== expectedValue.value;
              }

              return story[key] === expectedValue;
            });
          });

          return {
            orderBy() {
              const ordered = filtered.slice().sort(function compare(left, right) {
                return String(right.createdAt).localeCompare(String(left.createdAt));
              });

              return {
                skip(offset) {
                  return {
                    limit(limitSize) {
                      return {
                        async get() {
                          return {
                            data: ordered.slice(offset, offset + limitSize),
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
    },
  };
}

function testExpiredTokenRejected() {
  assert.throws(function verifyExpiredToken() {
    adminListStories._private.verifyAdminToken(createToken(Date.now() - 1000), 'legend-secret');
  }, function assertError(error) {
    return error && error.code === 'TOKEN_EXPIRED';
  });
}

function testInvalidTokenRejected() {
  assert.throws(function verifyInvalidToken() {
    adminListStories._private.verifyAdminToken(createToken(Date.now() + 1000) + 'tampered', 'legend-secret');
  }, function assertError(error) {
    return error && error.code === 'FORBIDDEN';
  });
}

async function testListStoriesFiltersUserTravelerAndDeleted() {
  const actor = createActor();
  const result = await adminListStories._private.listStoryDocs(actor, {
    status: 'all',
    pageSize: 20,
    cursor: '',
    keyword: '',
  });
  const locationNameMap = await adminListStories._private.getLocationNameMap(actor, ['loc-1', 'loc-2']);
  const items = result.docs.map(function mapStory(doc) {
    return adminListStories._private.normalizeStoryListItem(doc, locationNameMap);
  });

  assert.strictEqual(items.length, 2);
  assert.deepStrictEqual(items.map(function pickId(item) {
    return item.storyId;
  }), ['story-pending', 'story-published']);
  assert.strictEqual(items[0].authorDisplayId.indexOf('openid-a') === -1, true);
}

async function testPendingAndPublishedListsWork() {
  const actor = createActor();
  const pendingResult = await adminListStories._private.listStoryDocs(actor, {
    status: 'pending',
    pageSize: 20,
    cursor: '',
    keyword: '',
  });
  const publishedResult = await adminListStories._private.listStoryDocs(actor, {
    status: 'published',
    pageSize: 20,
    cursor: '',
    keyword: '',
  });

  assert.deepStrictEqual(pendingResult.docs.map(function pickId(doc) {
    return doc._id;
  }), ['story-pending']);
  assert.deepStrictEqual(publishedResult.docs.map(function pickId(doc) {
    return doc._id;
  }), ['story-published']);
}

async function run() {
  const tests = [
    ['Expired token rejected', testExpiredTokenRejected],
    ['Invalid token rejected', testInvalidTokenRejected],
    ['List stories filters user traveler and deleted', testListStoriesFiltersUserTravelerAndDeleted],
    ['Pending and published lists work', testPendingAndPublishedListsWork],
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
