// Transient UI state (not persisted, not synced).
export const ui = {
  organizeFor: null, // idea id with the Organize panel open
  organized: null, // last AI organize: { id, loading | s | note }
  wiz: null, // new-project wizard
  onb: { step: 0, text: '', ideaId: null },
  discoverTab: 'foryou',
  discoverDifferent: new Set(), // For you cards from outside your interests (pill)
  discoverGroup: 'all',
  discoverLimit: 12,
  discoverShown: [], // ids on screen, marked seen on refresh
  ideasFilter: '',
  justMoved: null, // idea id to animate after a move
};
export const resetOnboarding = () => { ui.onb = { step: 0, text: '', ideaId: null }; };
