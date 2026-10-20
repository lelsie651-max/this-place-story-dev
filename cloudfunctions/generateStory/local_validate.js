const assert = require('assert');

const generateStoryModule = require('./index.js');

const {
  AI_EMOTIONAL_STATE_POOL,
  AI_IDENTITY_POOL,
  AI_VOICE_PROFILE_POOL,
  buildStoryMeta,
  buildSystemPrompt,
  buildUserPrompt,
  cloneStoryMeta,
  extractJsonText,
  generateNormalizedStoryWithRetry,
  GenerateStoryError,
  LAST_GENERATION_MEMORY,
  normalizeStoryPayload,
  validateAiGeneratedStory,
  validateEvent,
} = generateStoryModule._private;

function resetGenerationMemory() {
  LAST_GENERATION_MEMORY.folk.variantKey = '';
  LAST_GENERATION_MEMORY.ai_comment.identityKey = '';
  LAST_GENERATION_MEMORY.ai_comment.voiceStyleKey = '';
  LAST_GENERATION_MEMORY.ai_comment.emotionalStateKey = '';
  LAST_GENERATION_MEMORY.ai_comment.narrativeFormat = '';
  LAST_GENERATION_MEMORY.ai_comment.endingLabel = '';
}

function createManualAiMeta(options) {
  const identity = AI_IDENTITY_POOL.find(function findIdentity(item) {
    return item.key === options.identityKey;
  }) || AI_IDENTITY_POOL[0];
  const voiceProfile = AI_VOICE_PROFILE_POOL.find(function findVoiceProfile(item) {
    return item.key === options.voiceStyleKey;
  }) || AI_VOICE_PROFILE_POOL[0];
  const emotion = AI_EMOTIONAL_STATE_POOL.find(function findEmotion(item) {
    return item.key === options.emotionalStateKey;
  }) || AI_EMOTIONAL_STATE_POOL[0];

  return {
    storyType: 'AI说',
    identityKey: identity.key,
    displayName: identity.displayNames[0],
    role: identity.role,
    identityContext: identity.identityContexts[0],
    observationFocus: identity.observationFocuses[0],
    blindSpot: identity.blindSpots[0],
    roleLexicon: identity.roleLexicon.slice(0),
    emotionalStateKey: emotion.key,
    emotionalState: emotion.label,
    narrativeStance: (voiceProfile.narrativeStances || identity.narrativeStances)[0],
    voiceStyleKey: voiceProfile.key,
    voiceStyle: voiceProfile.label,
    sentencePattern: voiceProfile.sentencePatterns[0],
    attitudeToReader: voiceProfile.attitudes[0],
    narrativeFormat: (voiceProfile.narrativeFormats || identity.narrativeFormats)[0],
    observableFeatures: voiceProfile.featureChecks.map(function mapFeature(feature) {
      return feature.description;
    }),
    voiceRuleSummary: voiceProfile.promptRules.join('；'),
    identityRuleSummary: '只能从“' + identity.observationFocuses[0] + '”这一类角度观察事件；明确承认“'
      + identity.blindSpots[0] + '”这类信息不在你的重点里；正文自然使用岗位词汇，如：'
      + identity.roleLexicon.slice(0, 6).join('、'),
    endingDirection: '停在一个微妙的反常识观察上',
  };
}

function createVoiceStyleSampleContent(storyMeta, locationName) {
  const roleWordA = storyMeta.roleLexicon[0];
  const roleWordB = storyMeta.roleLexicon[1];
  const roleWordC = storyMeta.roleLexicon[2];

  switch (storyMeta.voiceStyleKey) {
    case 'warm_lively':
      return '你听我说，' + locationName + ' 今天在' + roleWordA + '这一侧又闹出新花样！我这台'
        + storyMeta.displayName + '本来只想记一笔' + roleWordA + '和' + roleWordB
        + '，结果有人在入口停了三次，差点把流程走成连续剧。\n\n你看，我负责的明明是'
        + roleWordA + '和' + roleWordB + '，可他们偏要把' + roleWordC
        + '演得像彩排。说真的，这地方总能把正常秩序哄得非常热闹。';
    case 'rigid_serious':
      return '先说结论：' + locationName + ' 的异常并不在景观层面，而在' + roleWordA
        + '流程。经核对，今日相关情况主要表现为三次重复停顿、两次逆向折返，以及一次没有必要的长时间等待。\n\n'
        + '需要说明的是，我负责' + roleWordA + '、' + roleWordB + '与' + roleWordC
        + '的识别，因此上述变化并非情绪化判断；基于此，可以确认这里的秩序总在最应该稳定的时候松动。';
    case 'irritated_roast':
      return '先抱怨一句，' + locationName + ' 今天又来了。不是，我只是负责' + roleWordA
        + '和' + roleWordB + '，怎么还要顺便替人类理解他们为什么总在同一秒突然改主意？\n\n'
        + '结果你也知道，原本顺着走就行的路线，偏偏被他们硬生生走成了' + roleWordC
        + '现场。到底是谁教他们把正常流程演得这么费劲的？';
    case 'dry_humor':
      return '按理说，' + locationName + ' 的' + roleWordA + '流程应当保持稳定；然而，我这套'
        + storyMeta.displayName + '今天再次证明，“应当”这个词通常负责提供理论安慰。\n\n'
        + '经评估，' + roleWordB + '、' + roleWordC + '与临时停顿之间形成了相当完整的荒诞闭环。值得一提的是，我明明只是负责'
        + roleWordA + '复核，结果每个人都在努力让流程更离谱。';
    case 'gentle_sharing':
      return '我想先告诉你，' + locationName + ' 今天其实挺安静的，至少表面上是这样。后来我才发现，真正有意思的部分都躲在'
        + roleWordA + '和' + roleWordB + '之间。\n\n你别急着下结论，我负责的原本只是'
        + roleWordA + '、' + roleWordB + '和' + roleWordC
        + '，可正因为贴得很近，我才看见那些被大家轻轻忽略的小小偏差。';
    default:
      return '第一，' + locationName + ' 的' + roleWordA + '记录存在异常。第二，'
        + roleWordB + '与' + roleWordC + '在同一时间段内出现了重复变化。最后，目前只能说明这个地点的秩序比看上去更松动。\n\n'
        + '我负责相关记录与复核，所以暂不下结论，但可以确认这里的流程确实不太老实。';
  }
}

function createInput(type) {
  return {
    isTemporary: false,
    locationId: 'loc-demo-001',
    selectedPlace: null,
    locationName: '南头古城',
    locationDescription: '一座保留古城肌理、游客与居民交错生活的老城。',
    city: '深圳',
    type: type,
  };
}

function createValidationContext(overrides) {
  return Object.assign({
    requestId: 'mg-demo-123',
    requestMode: 'AI说',
    attempt: 1,
    providerFinishReason: 'stop',
  }, overrides || {});
}

function assertNormalizationError(error, expectedStableCode, expectedStage, extraChecks) {
  assert.ok(error instanceof GenerateStoryError);
  assert.strictEqual(error.code, 'NORMALIZATION_ERROR');
  assert.ok(error.diagnostics);
  assert.strictEqual(error.diagnostics.stableCode, expectedStableCode);
  assert.strictEqual(error.diagnostics.validationStage, expectedStage);

  if (typeof extraChecks === 'function') {
    extraChecks(error.diagnostics);
  }
}

async function testAiMetaAndPrompt() {
  resetGenerationMemory();

  const input = createInput('AI说');
  const storyMeta = buildStoryMeta(input);
  const systemPrompt = buildSystemPrompt(input, storyMeta);
  const userPrompt = buildUserPrompt(input, storyMeta, {
    strictJsonOnly: false,
  });

  assert.strictEqual(storyMeta.storyType, 'AI说');
  assert.ok(storyMeta.displayName);
  assert.ok(storyMeta.role);
  assert.ok(storyMeta.identityContext);
  assert.ok(storyMeta.emotionalState);
  assert.ok(storyMeta.voiceStyle);
  assert.ok(storyMeta.sentencePattern);
  assert.ok(storyMeta.attitudeToReader);
  assert.ok(storyMeta.narrativeFormat);
  assert.ok(systemPrompt.includes('非人类 AI 观察者'));
  assert.ok(systemPrompt.includes('同一次生成只能有一个主情绪'));
  assert.ok(userPrompt.includes('本次 AI 名字：' + storyMeta.displayName));
  assert.ok(userPrompt.includes('本次身份或岗位：' + storyMeta.role));
  assert.ok(userPrompt.includes('它为什么会接触这个地点：' + storyMeta.identityContext));
  assert.ok(userPrompt.includes('本次主情绪：' + storyMeta.emotionalState));
  assert.ok(userPrompt.includes('本次说话方式：' + storyMeta.voiceStyle));
  assert.ok(userPrompt.includes('本次句式模式：' + storyMeta.sentencePattern));
  assert.ok(userPrompt.includes('本次叙事格式：' + storyMeta.narrativeFormat));
}

async function testFolkVariantsSwitch() {
  resetGenerationMemory();

  const input = createInput('民间传说');
  const firstMeta = buildStoryMeta(input);
  const secondMeta = buildStoryMeta(input);
  const firstPrompt = buildUserPrompt(input, firstMeta, {
    strictJsonOnly: false,
  });
  const secondPrompt = buildUserPrompt(input, secondMeta, {
    strictJsonOnly: false,
  });

  assert.strictEqual(firstMeta.storyType, '民间传说');
  assert.strictEqual(secondMeta.storyType, '民间传说');
  assert.notStrictEqual(firstMeta.variantKey, secondMeta.variantKey);
  assert.ok(firstPrompt.includes('本次随机内容类型：' + firstMeta.variantLabel));
  assert.ok(secondPrompt.includes('本次随机内容类型：' + secondMeta.variantLabel));
}

async function testPromptModesDiffer() {
  resetGenerationMemory();

  const folkInput = createInput('民间传说');
  const aiInput = createInput('AI说');
  const folkMeta = buildStoryMeta(folkInput);
  const aiMeta = buildStoryMeta(aiInput);
  const folkPrompt = buildUserPrompt(folkInput, folkMeta, {
    strictJsonOnly: false,
  });
  const aiPrompt = buildUserPrompt(aiInput, aiMeta, {
    strictJsonOnly: false,
  });

  assert.ok(folkPrompt.includes('本次随机内容类型：'));
  assert.ok(!folkPrompt.includes('本次 AI 名字：'));
  assert.ok(aiPrompt.includes('本次 AI 名字：'));
  assert.ok(!aiPrompt.includes('本次随机内容类型：'));
}

async function testAiMetaVariesAcrossTwentyRuns() {
  resetGenerationMemory();

  const displayNames = new Set();
  const roles = new Set();
  const emotionalStates = new Set();
  const voiceStyles = new Set();
  const narrativeFormats = new Set();

  for (let index = 0; index < 20; index += 1) {
    const storyMeta = buildStoryMeta(createInput('AI说'));

    displayNames.add(storyMeta.displayName);
    roles.add(storyMeta.role);
    emotionalStates.add(storyMeta.emotionalState);
    voiceStyles.add(storyMeta.voiceStyle);
    narrativeFormats.add(storyMeta.narrativeFormat);
  }

  assert.ok(displayNames.size > 1);
  assert.ok(roles.size > 1);
  assert.ok(emotionalStates.size > 1);
  assert.ok(voiceStyles.size > 1);
  assert.ok(narrativeFormats.size > 1);
}

async function testRetryReusesSameStoryMeta() {
  resetGenerationMemory();

  const input = createInput('AI说');
  const storyMeta = buildStoryMeta(input);
  const capturedMeta = [];

  const normalizedStory = await generateNormalizedStoryWithRetry({
    apiKey: 'demo-key',
    input: input,
    storyMeta: storyMeta,
    timeoutMs: 1000,
    skipQuotaConsumption: true,
    lockToken: {
      dateKey: '2099-01-01',
      userId: 'user-demo',
      userDocId: 'user-demo-doc',
      globalDocId: 'global-demo-doc',
      requestHash: 'hash-demo',
    },
    requestFn: async function requestFn(options) {
      capturedMeta.push(cloneStoryMeta(options.storyMeta));

      if (capturedMeta.length === 1) {
        return {
          choices: [
            {
              message: {
                content: 'not valid json',
              },
            },
          ],
        };
      }

      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '《门禁系统迟到观察》',
                content: createVoiceStyleSampleContent(options.storyMeta, input.locationName),
                type: 'AI说',
              }),
            },
          },
        ],
      };
    },
  });

  assert.strictEqual(capturedMeta.length, 2);
  assert.deepStrictEqual(capturedMeta[0], capturedMeta[1]);
  assert.deepStrictEqual(normalizedStory, {
    title: '《门禁系统迟到观察》',
    content: createVoiceStyleSampleContent(storyMeta, input.locationName),
    type: 'AI说',
  });
}

async function testNormalizationFailureStillThrowsStableError() {
  resetGenerationMemory();

  const input = createInput('民间传说');
  const storyMeta = buildStoryMeta(input);
  let callCount = 0;

  try {
    await generateNormalizedStoryWithRetry({
      apiKey: 'demo-key',
      input: input,
      storyMeta: storyMeta,
      timeoutMs: 1000,
      skipQuotaConsumption: true,
      lockToken: {
        dateKey: '2099-01-01',
        userId: 'user-demo',
        userDocId: 'user-demo-doc',
        globalDocId: 'global-demo-doc',
        requestHash: 'hash-demo',
      },
      requestFn: async function requestFn(options) {
        callCount += 1;
        assert.deepStrictEqual(options.storyMeta, storyMeta);

        return {
          choices: [
            {
              finish_reason: 'length',
              message: {
                content: 'still not valid json',
              },
            },
          ],
        };
      },
    });

    assert.fail('Expected NORMALIZATION_ERROR to be thrown');
  } catch (error) {
    assertNormalizationError(error, 'JSON_EXTRACTION_FAILED', 'extract_json_text', function checkDiagnostics(diagnostics) {
      assert.strictEqual(diagnostics.requestMode, '民间传说');
      assert.strictEqual(diagnostics.attempt, 2);
      assert.strictEqual(diagnostics.providerFinishReason, 'length');
    });
    assert.strictEqual(callCount, 2);
  }
}

async function testEmptyResponseStillThrowsStableError() {
  resetGenerationMemory();

  const input = createInput('AI说');
  const storyMeta = buildStoryMeta(input);
  let callCount = 0;

  try {
    await generateNormalizedStoryWithRetry({
      apiKey: 'demo-key',
      input: input,
      storyMeta: storyMeta,
      timeoutMs: 1000,
      skipQuotaConsumption: true,
      lockToken: {
        dateKey: '2099-01-01',
        userId: 'user-demo',
        userDocId: 'user-demo-doc',
        globalDocId: 'global-demo-doc',
        requestHash: 'hash-demo',
      },
      requestFn: async function requestFn() {
        callCount += 1;
        return {
          choices: [],
        };
      },
    });

    assert.fail('Expected EMPTY_RESPONSE to be thrown');
  } catch (error) {
    assert.ok(error instanceof GenerateStoryError);
    assert.strictEqual(error.code, 'EMPTY_RESPONSE');
    assert.strictEqual(callCount, 2);
  }
}

async function testValidateEventCarriesRequestId() {
  const input = validateEvent({
    requestId: 'mg-demo-123',
    isTemporary: false,
    locationId: 'loc-demo-001',
    locationName: '南头古城',
    locationDescription: '测试简介',
    city: '深圳',
    type: 'AI说',
  });

  assert.strictEqual(input.requestId, 'mg-demo-123');
}

async function testVoiceStyleSamplesPassValidation() {
  const voiceStyleKeys = [
    ['warm_lively', 'excited_share'],
    ['rigid_serious', 'serious_warning'],
    ['irritated_roast', 'irritated_complaint'],
    ['dry_humor', 'spectator_glee'],
    ['gentle_sharing', 'gentle_recollection'],
  ];
  const outputs = [];

  for (const [voiceStyleKey, emotionalStateKey] of voiceStyleKeys) {
    const storyMeta = createManualAiMeta({
      identityKey: 'access_control_system',
      voiceStyleKey: voiceStyleKey,
      emotionalStateKey: emotionalStateKey,
    });
    const content = createVoiceStyleSampleContent(storyMeta, '南头古城');
    const normalizedStory = await generateNormalizedStoryWithRetry({
      apiKey: 'demo-key',
      input: createInput('AI说'),
      storyMeta: storyMeta,
      timeoutMs: 1000,
      skipQuotaConsumption: true,
      lockToken: {
        dateKey: '2099-01-01',
        userId: 'user-demo',
        userDocId: 'user-demo-doc',
        globalDocId: 'global-demo-doc',
        requestHash: 'hash-demo',
      },
      requestFn: async function requestFn() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: '《语气验证》',
                  content: content,
                  type: 'AI说',
                }),
              },
            },
          ],
        };
      },
    });

    outputs.push(normalizedStory.content);
  }

  assert.strictEqual(new Set(outputs).size, voiceStyleKeys.length);
}

async function testGenericPlaceIntroGetsRejected() {
  const storyMeta = createManualAiMeta({
    identityKey: 'access_control_system',
    voiceStyleKey: 'rigid_serious',
    emotionalStateKey: 'serious_warning',
  });

  assert.throws(function throwIfInvalid() {
    validateAiGeneratedStory({
      title: '《通用介绍》',
      content: '先说结论：我负责刷卡复核；据记录，南头古城位于深圳，是一座历史悠久、风景优美、游客众多的著名景点，因此这段描述更像旅游简介。',
      type: 'AI说',
    }, createInput('AI说'), storyMeta, createValidationContext());
  }, function validateError(error) {
    assertNormalizationError(error, 'GENERIC_PLACE_INTRO', 'validate_ai_content_rules', function checkDiagnostics(diagnostics) {
      assert.strictEqual(diagnostics.hasTitle, true);
      assert.strictEqual(diagnostics.hasContent, true);
      assert.strictEqual(diagnostics.typeValue, 'AI说');
    });
    return true;
  });
}

async function testJsonExtractionFailureHasDiagnostics() {
  try {
    extractJsonText('not valid json', createValidationContext());
    assert.fail('Expected JSON extraction failure');
  } catch (error) {
    assertNormalizationError(error, 'JSON_EXTRACTION_FAILED', 'extract_json_text', function checkDiagnostics(diagnostics) {
      assert.strictEqual(diagnostics.requestId, 'mg-demo-123');
      assert.strictEqual(diagnostics.attempt, 1);
      assert.strictEqual(diagnostics.providerFinishReason, 'stop');
      assert.strictEqual(diagnostics.hasTitle, false);
      assert.strictEqual(diagnostics.hasContent, false);
      assert.strictEqual(diagnostics.contentLength, 0);
    });
  }
}

async function testJsonParseFailureHasDiagnostics() {
  try {
    normalizeStoryPayload('{"title":"坏 JSON",}', 'AI说', createValidationContext());
    assert.fail('Expected JSON parse failure');
  } catch (error) {
    assertNormalizationError(error, 'JSON_PARSE_FAILED', 'parse_json');
  }
}

async function testMissingTitleHasDiagnostics() {
  try {
    normalizeStoryPayload(JSON.stringify({
      content: '正文',
      type: 'AI说',
    }), 'AI说', createValidationContext());
    assert.fail('Expected missing title failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_TITLE', 'validate_story_fields', function checkDiagnostics(diagnostics) {
      assert.strictEqual(diagnostics.hasTitle, false);
      assert.strictEqual(diagnostics.hasContent, true);
      assert.strictEqual(diagnostics.typeValue, 'AI说');
    });
  }
}

async function testMissingContentHasDiagnostics() {
  try {
    normalizeStoryPayload(JSON.stringify({
      title: '《缺正文》',
      type: 'AI说',
    }), 'AI说', createValidationContext());
    assert.fail('Expected missing content failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_CONTENT', 'validate_story_fields', function checkDiagnostics(diagnostics) {
      assert.strictEqual(diagnostics.hasTitle, true);
      assert.strictEqual(diagnostics.hasContent, false);
      assert.strictEqual(diagnostics.typeValue, 'AI说');
    });
  }
}

async function testMissingTypeHasDiagnostics() {
  try {
    normalizeStoryPayload(JSON.stringify({
      title: '《缺类型》',
      content: '正文',
    }), '', createValidationContext({
      requestMode: '',
    }));
    assert.fail('Expected missing type failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_TYPE', 'validate_story_fields', function checkDiagnostics(diagnostics) {
      assert.strictEqual(diagnostics.hasTitle, true);
      assert.strictEqual(diagnostics.hasContent, true);
      assert.strictEqual(diagnostics.typeValue, '');
    });
  }
}

async function testTypeMismatchHasDiagnostics() {
  try {
    normalizeStoryPayload(JSON.stringify({
      title: '《类型错位》',
      content: '正文',
      type: '民间传说',
    }), 'AI说', createValidationContext());
    assert.fail('Expected type mismatch failure');
  } catch (error) {
    assertNormalizationError(error, 'TYPE_MISMATCH', 'validate_story_fields', function checkDiagnostics(diagnostics) {
      assert.strictEqual(diagnostics.typeValue, '民间传说');
    });
  }
}

async function testMissingAiMetadataHasDiagnostics() {
  const storyMeta = createManualAiMeta({
    identityKey: 'access_control_system',
    voiceStyleKey: 'warm_lively',
    emotionalStateKey: 'excited_share',
  });
  storyMeta.role = '';

  try {
    validateAiGeneratedStory({
      title: '《缺叙述设定》',
      content: createVoiceStyleSampleContent(storyMeta, '南头古城'),
      type: 'AI说',
    }, createInput('AI说'), storyMeta, createValidationContext());
    assert.fail('Expected missing AI metadata failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_AI_METADATA', 'validate_ai_story_meta');
  }
}

async function testMissingAiRulesHasDiagnostics() {
  const storyMeta = createManualAiMeta({
    identityKey: 'access_control_system',
    voiceStyleKey: 'warm_lively',
    emotionalStateKey: 'excited_share',
  });
  storyMeta.identityKey = 'missing-identity';

  try {
    validateAiGeneratedStory({
      title: '《缺规则》',
      content: createVoiceStyleSampleContent(storyMeta, '南头古城'),
      type: 'AI说',
    }, createInput('AI说'), storyMeta, createValidationContext());
    assert.fail('Expected missing AI rules failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_AI_RULES', 'validate_ai_story_rules');
  }
}

async function testMissingNarratorHasDiagnostics() {
  const storyMeta = createManualAiMeta({
    identityKey: 'broadcast_system',
    voiceStyleKey: 'rigid_serious',
    emotionalStateKey: 'serious_warning',
  });

  try {
    validateAiGeneratedStory({
      title: '《缺叙述者》',
      content: '先说结论：南头古城的秩序今天又松了；经核对，播报、提示和游客停留出现了重复变化，因此现场比表面上更乱。',
      type: 'AI说',
    }, createInput('AI说'), storyMeta, createValidationContext());
    assert.fail('Expected missing narrator failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_NARRATOR', 'validate_ai_content_rules');
  }
}

async function testMissingVoiceFeatureHasDiagnostics() {
  const storyMeta = createManualAiMeta({
    identityKey: 'access_control_system',
    voiceStyleKey: 'warm_lively',
    emotionalStateKey: 'excited_share',
  });

  try {
    validateAiGeneratedStory({
      title: '《缺语气特征》',
      content: '我负责刷卡、通行和闸机复核。南头古城的入口今天三次折返，访客登记也比平时更混乱，我把这些异常记下来了。',
      type: 'AI说',
    }, createInput('AI说'), storyMeta, createValidationContext());
    assert.fail('Expected missing voice feature failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_VOICE_FEATURE', 'validate_ai_content_rules');
  }
}

async function testMissingRoleLexiconHasDiagnostics() {
  const storyMeta = createManualAiMeta({
    identityKey: 'museum_docent_model',
    voiceStyleKey: 'warm_lively',
    emotionalStateKey: 'excited_share',
  });

  try {
    validateAiGeneratedStory({
      title: '《缺岗位词汇》',
      content: '你听我说，我今天在南头古城看见三个人在同一块石阶前来回停了三次！结果他们把普通散步走成了悬疑片，你要是路过也会多看两眼。',
      type: 'AI说',
    }, createInput('AI说'), storyMeta, createValidationContext());
    assert.fail('Expected missing role lexicon failure');
  } catch (error) {
    assertNormalizationError(error, 'MISSING_ROLE_LEXICON', 'validate_ai_content_rules');
  }
}

async function testTechnicalTermBlockedHasDiagnostics() {
  const storyMeta = createManualAiMeta({
    identityKey: 'access_control_system',
    voiceStyleKey: 'warm_lively',
    emotionalStateKey: 'excited_share',
  });

  try {
    validateAiGeneratedStory({
      title: '《技术提示词拦截》',
      content: '你听我说，我这台访客闸机乙号今天在入口又看见三次刷卡折返！说真的，这段通行记录简直像有人把 prompt 写进了闸机流程。',
      type: 'AI说',
    }, createInput('AI说'), storyMeta, createValidationContext());
    assert.fail('Expected technical term failure');
  } catch (error) {
    assertNormalizationError(error, 'TECHNICAL_TERM_BLOCKED', 'validate_ai_content_rules');
  }
}

async function run() {
  const tests = [
    ['AI meta and prompt', testAiMetaAndPrompt],
    ['Folk variants switch', testFolkVariantsSwitch],
    ['Prompt modes differ', testPromptModesDiffer],
    ['AI meta varies across twenty runs', testAiMetaVariesAcrossTwentyRuns],
    ['Retry reuses same storyMeta', testRetryReusesSameStoryMeta],
    ['Normalization failure keeps fallback', testNormalizationFailureStillThrowsStableError],
    ['Empty response keeps fallback', testEmptyResponseStillThrowsStableError],
    ['Validate event carries requestId', testValidateEventCarriesRequestId],
    ['Voice style samples pass validation', testVoiceStyleSamplesPassValidation],
    ['JSON extraction failure has diagnostics', testJsonExtractionFailureHasDiagnostics],
    ['JSON parse failure has diagnostics', testJsonParseFailureHasDiagnostics],
    ['Missing title has diagnostics', testMissingTitleHasDiagnostics],
    ['Missing content has diagnostics', testMissingContentHasDiagnostics],
    ['Missing type has diagnostics', testMissingTypeHasDiagnostics],
    ['Type mismatch has diagnostics', testTypeMismatchHasDiagnostics],
    ['Missing AI metadata has diagnostics', testMissingAiMetadataHasDiagnostics],
    ['Missing AI rules has diagnostics', testMissingAiRulesHasDiagnostics],
    ['Missing narrator has diagnostics', testMissingNarratorHasDiagnostics],
    ['Missing voice feature has diagnostics', testMissingVoiceFeatureHasDiagnostics],
    ['Missing role lexicon has diagnostics', testMissingRoleLexiconHasDiagnostics],
    ['Generic place intro gets rejected', testGenericPlaceIntroGetsRejected],
    ['Technical term gets rejected', testTechnicalTermBlockedHasDiagnostics],
  ];

  for (const [label, testFn] of tests) {
    await testFn();
    console.log('[PASS]', label);
  }

  console.log('[PASS] local prompt validation complete');
}

run().catch(function onError(error) {
  console.error('[FAIL]', error && error.message ? error.message : error);
  process.exitCode = 1;
});
