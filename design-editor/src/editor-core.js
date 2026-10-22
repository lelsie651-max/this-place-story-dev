import {
  cloneDraft,
  createEmptyDraft,
  removeComponentOverrides,
  removePageOverrides,
  resetDraft,
  serializeDraft,
  upsertAsset,
  upsertOverride
} from '../shared/schema.js';

function createHistoryEntry(draft) {
  return {
    hash: serializeDraft(draft),
    draft: cloneDraft(draft)
  };
}

export function createEditorState() {
  const draft = createEmptyDraft();
  return {
    draft,
    history: [createHistoryEntry(draft)],
    historyIndex: 0,
    lastSavedHash: serializeDraft(draft),
    selectedPageId: 'index',
    selectedComponentId: 'index-page-title',
    selectedDeviceId: 'iphone-6-7-8',
    selectedScale: 'fit'
  };
}

export function pushHistory(state, nextDraft) {
  const nextHash = serializeDraft(nextDraft);
  const currentHash = state.history[state.historyIndex].hash;

  if (nextHash === currentHash) {
    return {
      ...state,
      draft: cloneDraft(nextDraft)
    };
  }

  const trimmedHistory = state.history.slice(0, state.historyIndex + 1);
  trimmedHistory.push(createHistoryEntry(nextDraft));

  return {
    ...state,
    draft: cloneDraft(nextDraft),
    history: trimmedHistory,
    historyIndex: trimmedHistory.length - 1
  };
}

export function applyOverride(state, pageId, designId, propertyKey, value) {
  const nextDraft = upsertOverride(state.draft, pageId, designId, propertyKey, value);
  return pushHistory(state, nextDraft);
}

export function applyAsset(state, assetId, assetInfo) {
  const nextDraft = upsertAsset(state.draft, assetId, assetInfo);
  return pushHistory(state, nextDraft);
}

export function restoreComponent(state, pageId, designId) {
  return pushHistory(state, removeComponentOverrides(state.draft, pageId, designId));
}

export function restorePage(state, pageId) {
  return pushHistory(state, removePageOverrides(state.draft, pageId));
}

export function restoreAll(state) {
  return pushHistory(state, resetDraft());
}

export function undo(state) {
  if (state.historyIndex === 0) {
    return state;
  }

  const nextIndex = state.historyIndex - 1;
  return {
    ...state,
    historyIndex: nextIndex,
    draft: cloneDraft(state.history[nextIndex].draft)
  };
}

export function redo(state) {
  if (state.historyIndex >= state.history.length - 1) {
    return state;
  }

  const nextIndex = state.historyIndex + 1;
  return {
    ...state,
    historyIndex: nextIndex,
    draft: cloneDraft(state.history[nextIndex].draft)
  };
}

export function markSaved(state) {
  return {
    ...state,
    lastSavedHash: serializeDraft(state.draft)
  };
}

export function hasUnsavedChanges(state) {
  return serializeDraft(state.draft) !== state.lastSavedHash;
}

export function selectPage(state, pageId) {
  return {
    ...state,
    selectedPageId: pageId
  };
}

export function selectComponent(state, designId) {
  return {
    ...state,
    selectedComponentId: designId
  };
}

export function selectDevice(state, deviceId) {
  return {
    ...state,
    selectedDeviceId: deviceId
  };
}

export function selectScale(state, scale) {
  return {
    ...state,
    selectedScale: scale
  };
}

export function getOverrideValue(state, pageId, designId, propertyKey) {
  return state.draft.overrides?.[pageId]?.[designId]?.[propertyKey];
}
