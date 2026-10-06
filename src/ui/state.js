// Transient UI state (not persisted, not synced).
export const ui = {
  organizeFor: null, // idea id with the Organize panel open
  wiz: null, // new-project wizard
  onb: { step: 0, text: '', ideaId: null },
  discoverTab: 'foryou',
  discoverGroup: 'all',
  discoverLimit: 12,
  discoverShown: [], // ids on screen, marked seen on refresh
  ideasFilter: '',
  justMoved: null, // idea id to animate after a move
};
export const resetOnboarding = () => { ui.onb = { step: 0, text: '', ideaId: null }; };
