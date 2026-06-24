var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DataviewGraphSyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var BLOCK_START = "%%dataview-graph-links";
var BLOCK_END = "dataview-graph-links%%";
var BLOCK_REGEX = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`);
var QUERY_REGEX = /```dataview\n([\s\S]*?)```/g;
var FROM_REGEX = /FROM\s+([\s\S]+?)(?=\n(?:WHERE|SORT|LIMIT|GROUP|FLATTEN)\b|$)/i;
var DataviewGraphSyncPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.syncing = false;
    this.debounceTimer = null;
  }
  onload() {
    return __async(this, null, function* () {
      this.app.workspace.onLayoutReady(() => {
        setTimeout(() => this.syncAll(), 3e3);
      });
      this.registerEvent(this.app.vault.on("create", () => this.scheduleSyncAll()));
      this.registerEvent(this.app.vault.on("delete", () => this.scheduleSyncAll()));
      this.registerEvent(this.app.vault.on("rename", () => this.scheduleSyncAll()));
      this.registerEvent(
        this.app.metadataCache.on("changed", () => this.scheduleSyncAll())
      );
    });
  }
  scheduleSyncAll() {
    if (this.debounceTimer)
      clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.syncAll(), 1500);
  }
  getDataviewApi() {
    var _a, _b, _c, _d;
    return (_d = (_c = (_b = (_a = this.app.plugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["dataview"]) == null ? void 0 : _c.api) != null ? _d : null;
  }
  syncAll() {
    return __async(this, null, function* () {
      const dv = this.getDataviewApi();
      if (!dv) {
        console.warn("Dataview Graph Sync: Dataview plugin not found.");
        return;
      }
      for (const file of this.app.vault.getMarkdownFiles()) {
        yield this.syncFile(file, dv);
      }
    });
  }
  syncFile(file, dv) {
    return __async(this, null, function* () {
      if (this.syncing)
        return;
      const content = yield this.app.vault.read(file);
      const sources = [];
      let match;
      QUERY_REGEX.lastIndex = 0;
      while ((match = QUERY_REGEX.exec(content)) !== null) {
        const source = this.extractSource(match[1]);
        if (source)
          sources.push(source);
      }
      if (sources.length === 0) {
        if (!BLOCK_REGEX.test(content))
          return;
        yield this.writeFile(file, content.replace(BLOCK_REGEX, ""));
        return;
      }
      const linkedNames = /* @__PURE__ */ new Set();
      for (const source of sources) {
        try {
          dv.pages(source).forEach((page) => {
            if (page.file.path !== file.path) {
              linkedNames.add(page.file.name.replace(/\.md$/, ""));
            }
          });
        } catch (e) {
        }
      }
      const links = [...linkedNames].map((name) => `[[${name}]]`).join(" ");
      const newBlock = links ? `${BLOCK_START}
${links}
${BLOCK_END}` : "";
      let newContent;
      if (BLOCK_REGEX.test(content)) {
        newContent = newBlock ? content.replace(BLOCK_REGEX, newBlock + "\n") : content.replace(BLOCK_REGEX, "");
      } else if (newBlock) {
        newContent = content.trimEnd() + "\n\n" + newBlock + "\n";
      } else {
        return;
      }
      if (newContent !== content) {
        yield this.writeFile(file, newContent);
      }
    });
  }
  writeFile(file, content) {
    return __async(this, null, function* () {
      this.syncing = true;
      try {
        yield this.app.vault.modify(file, content);
      } finally {
        this.syncing = false;
      }
    });
  }
  extractSource(query) {
    const match = query.match(FROM_REGEX);
    return match ? match[1].trim() : null;
  }
};
