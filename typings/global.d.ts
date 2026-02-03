declare const _globalThis: {
  [key: string]: any;
  Zotero: _ZoteroTypes.Zotero;
  ZoteroPane: _ZoteroTypes.ZoteroPane;
  Zotero_Tabs: typeof Zotero_Tabs;
  window: Window;
  document: Document;
  ztoolkit: import("zotero-plugin-toolkit").ZoteroToolkit;
  addon: import("../src/addon").default;
};

declare const ztoolkit: import("zotero-plugin-toolkit").ZoteroToolkit;
declare const addon: import("../src/addon").default;
declare const __env__: "development" | "production";

declare const Zotero: _ZoteroTypes.Zotero;
declare const ZoteroPane: _ZoteroTypes.ZoteroPane;
declare const Zotero_Tabs: any;
declare const Components: any;
declare const Services: any;
declare const Cc: any;
declare const Cu: any;
declare const rootURI: string;
