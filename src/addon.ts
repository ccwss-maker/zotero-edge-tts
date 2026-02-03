import { ZoteroToolkit } from "zotero-plugin-toolkit";
import hooks from "./hooks";

class Addon {
  public data: {
    alive: boolean;
    ztoolkit: ZoteroToolkit;
  };
  public hooks: typeof hooks;

  constructor() {
    this.data = {
      alive: true,
      ztoolkit: new ZoteroToolkit(),
    };
    this.hooks = hooks;
  }
}

export default Addon;
