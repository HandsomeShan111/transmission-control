// Names the build defines, tools/build.ts, and the style sheet import the bundler takes.
declare module "*.css";
/** Files with hashed names, relative to the page: the font, and each sound and track by name. */
declare const __ASSETS__: { font: string; sounds: Record<string, string> };
/** The count service's address; empty, so events wait in the save, MEAS-03. */
declare const __COUNTS__: string;
