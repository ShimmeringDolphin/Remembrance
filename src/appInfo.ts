// The app's version, read from app.json at build time; no native module and no permission needed.
import app from '../app.json';

export const APP_VERSION: string = app.expo.version;
