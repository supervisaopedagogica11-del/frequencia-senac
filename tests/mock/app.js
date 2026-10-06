export const initializeApp = (cfg, name) => ({ name: name || "[DEFAULT]", __sec: !!name });
export const getApps = () => [];
export const getApp = () => ({ name: "[DEFAULT]" });
