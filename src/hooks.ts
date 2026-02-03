import { config } from "../package.json";
import { ZoteroToolkit } from "zotero-plugin-toolkit";

let availableVoices: string[] = [];
let edgeTtsInstalled = true;
let edgeTtsPath = "";
let edgePlaybackPath = "";

// 检测操作系统
function isWindows(): boolean {
  return Zotero.isWin;
}

// 获取偏好设置
function getPref(key: string): any {
  return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
}

// 设置偏好
function setPref(key: string, value: any): void {
  Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
}

// 获取当前选择的语音
function getVoice(): string {
  return getPref("voice") || "zh-CN-XiaoxiaoNeural";
}

// 获取自动播放状态（持久化）
function getAutoPlay(): boolean {
  return getPref("autoPlay") === true;
}

// 设置自动播放状态
function setAutoPlay(value: boolean): void {
  setPref("autoPlay", value);
}

// 获取界面语言（跟随 Zotero 系统设置）
function getUILang(): string {
  const locale = Zotero.locale || "en-US";
  return locale.startsWith("zh") ? "zh" : "en";
}

// 查找命令路径
function findCommandPath(command: string): string {
  const possiblePaths: string[] = [];
  const env = Components.classes["@mozilla.org/process/environment;1"]
    .getService(Components.interfaces.nsIEnvironment);

  if (isWindows()) {
    // Windows 路径
    const winCommand = `${command}.exe`;
    const userProfile = env.get("USERPROFILE");
    const localAppData = env.get("LOCALAPPDATA");

    if (userProfile) {
      possiblePaths.push(`${userProfile}\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\${winCommand}`);
      possiblePaths.push(`${userProfile}\\AppData\\Local\\Programs\\Python\\Python310\\Scripts\\${winCommand}`);
      possiblePaths.push(`${userProfile}\\AppData\\Local\\Programs\\Python\\Python39\\Scripts\\${winCommand}`);
      possiblePaths.push(`${userProfile}\\.local\\bin\\${winCommand}`);
    }
    if (localAppData) {
      possiblePaths.push(`${localAppData}\\Programs\\Python\\Python311\\Scripts\\${winCommand}`);
      possiblePaths.push(`${localAppData}\\Programs\\Python\\Python310\\Scripts\\${winCommand}`);
    }
    possiblePaths.push(`C:\\Python311\\Scripts\\${winCommand}`);
    possiblePaths.push(`C:\\Python310\\Scripts\\${winCommand}`);
  } else {
    // Linux/macOS 路径
    possiblePaths.push(`/usr/local/bin/${command}`);
    possiblePaths.push(`/usr/bin/${command}`);
    possiblePaths.push(`${Zotero.Profile.dir}/../.local/bin/${command}`);

    const home = env.get("HOME");
    if (home) {
      possiblePaths.unshift(`${home}/.local/bin/${command}`);
    }
  }

  for (const path of possiblePaths) {
    try {
      const file = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);
      file.initWithPath(path);
      if (file.exists()) {
        return path;
      }
    } catch (e) {
      // continue
    }
  }
  return isWindows() ? `${command}.exe` : command;
}

// 检测 edge-tts 并获取可用语音
async function detectVoices(): Promise<void> {
  return new Promise((resolve) => {
    try {
      edgeTtsPath = findCommandPath("edge-tts");
      edgePlaybackPath = findCommandPath("edge-playback");

      const file = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);

      try {
        file.initWithPath(edgeTtsPath);
        if (!file.exists()) {
          edgeTtsInstalled = false;
          resolve();
          return;
        }
      } catch (e) {
        // 路径可能不是绝对路径，假设已安装
        edgeTtsInstalled = true;
      }

      edgeTtsInstalled = true;

      // 获取语音列表 - 使用临时文件
      const tempFile = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties)
        .get("TmpD", Components.interfaces.nsIFile);
      tempFile.append("edge-tts-voices.txt");

      const shellFile = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);

      const proc = Components.classes["@mozilla.org/process/util;1"]
        .createInstance(Components.interfaces.nsIProcess);

      if (isWindows()) {
        shellFile.initWithPath("C:\\Windows\\System32\\cmd.exe");
        proc.init(shellFile);
        proc.run(true, ["/c", `"${edgeTtsPath}" --list-voices > "${tempFile.path}" 2>&1`], 2);
      } else {
        shellFile.initWithPath("/bin/bash");
        proc.init(shellFile);
        proc.run(true, ["-c", `${edgeTtsPath} --list-voices > ${tempFile.path} 2>&1`], 2);
      }

      // 读取结果
      if (tempFile.exists()) {
        const data = Zotero.File.getContents(tempFile);
        const lines = data.split("\n");
        availableVoices = [];
        for (const line of lines) {
          const match = line.match(/^([a-z]{2}-[A-Z]{2,}-\w+)\s+/i);
          if (match) {
            availableVoices.push(match[1]);
          }
        }
        tempFile.remove(false);
      }

      resolve();
    } catch (e) {
      Zotero.debug(`EdgeTTS: detectVoices error: ${e}`);
      edgeTtsInstalled = true;
      resolve();
    }
  });
}

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // 检测语音
  await detectVoices();

  // 注册设置面板
  registerPrefsPane();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win))
  );
}

function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: rootURI + "chrome/content/preferences.xhtml",
    id: config.addonInstance,
    scripts: [],
    stylesheets: [],
  });
}

async function onMainWindowLoad(win: Window): Promise<void> {
  await new Promise<void>((resolve) => {
    if (win.document.readyState !== "complete") {
      win.document.addEventListener("readystatechange", () => {
        if (win.document.readyState === "complete") {
          resolve();
        }
      });
    }
    resolve();
  });

  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  addon.data.ztoolkit = new ZoteroToolkit();

  registerReaderListener();
}

function registerReaderListener() {
  Zotero.Reader._unregisterEventListenerByPluginID(config.addonID);

  const lang = getUILang();
  const autoPlayText = lang === "zh" ? "自动播放" : "Auto Play";

  // 工具栏添加 Auto Play 开关
  Zotero.Reader.registerEventListener(
    "renderToolbar",
    (event) => {
      const { doc, append } = event;
      const autoReadEnabled = getAutoPlay();

      const container = ztoolkit.UI.createElement(doc, "div", {
        styles: {
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 8px",
        },
        children: [
          {
            tag: "button",
            namespace: "html",
            id: "edge-tts-toggle",
            properties: {
              innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>`,
              title: autoPlayText,
            },
            classList: ["toolbar-button"],
            styles: {
              opacity: autoReadEnabled ? "1" : "0.5",
              background: autoReadEnabled ? "#4CAF50" : "transparent",
              borderRadius: "4px",
              transition: "all 0.2s",
            },
            listeners: [
              {
                type: "click",
                listener: (e: Event) => {
                  const newState = !getAutoPlay();
                  setAutoPlay(newState);
                  // 关闭自动播放时立即停止当前播放
                  if (!newState) {
                    stopSpeak();
                  }
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.opacity = newState ? "1" : "0.5";
                  btn.style.background = newState ? "#4CAF50" : "transparent";
                  updateAllToggleButtons();
                },
              },
            ],
          },
          {
            tag: "span",
            namespace: "html",
            properties: {
              textContent: autoPlayText,
            },
            styles: {
              fontSize: "11px",
              fontWeight: "bold",
              color: "#666",
            },
          },
          {
            tag: "span",
            namespace: "html",
            styles: {
              width: "1px",
              height: "20px",
              background: "rgba(0, 0, 0, 0.05)",
              marginLeft: "10px",
            },
          },
        ],
      });

      append(container);
    },
    config.addonID
  );

  // 监听文本选中弹出事件，自动朗读
  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    (event) => {
      const { reader } = event;
      if (getAutoPlay()) {
        const text = ztoolkit.Reader.getSelectedText(reader);
        if (text) {
          speak(text);
        }
      }
    },
    config.addonID
  );

  // 重新加载已打开的 Reader 标签页以显示工具栏按钮
  reloadReaderTabs();
}

function reloadReaderTabs() {
  try {
    const tabs = Zotero_Tabs._tabs.filter((tab: any) => tab.type === "reader");
    if (tabs.length > 0) {
      for (const tab of tabs) {
        const index = Zotero_Tabs._tabs.indexOf(tab);
        Zotero_Tabs.close(tab.id);
        setTimeout(() => {
          Zotero_Tabs.undoClose();
        }, 100 * (index + 1));
      }
    }
  } catch (e) {
    Zotero.debug(`EdgeTTS: reloadReaderTabs error: ${e}`);
  }
}

function updateAllToggleButtons() {
  const autoReadEnabled = getAutoPlay();
  const buttons = document.querySelectorAll("#edge-tts-toggle");
  buttons.forEach((btn) => {
    const button = btn as HTMLButtonElement;
    button.style.opacity = autoReadEnabled ? "1" : "0.5";
    button.style.background = autoReadEnabled ? "#4CAF50" : "transparent";
  });
}

// 停止当前播放
function stopSpeak() {
  try {
    const killFile = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsIFile);

    const proc = Components.classes["@mozilla.org/process/util;1"]
      .createInstance(Components.interfaces.nsIProcess);

    if (isWindows()) {
      killFile.initWithPath("C:\\Windows\\System32\\taskkill.exe");
      proc.init(killFile);
      proc.run(true, ["/F", "/IM", "mpv.exe"], 3);
    } else {
      killFile.initWithPath("/usr/bin/pkill");
      proc.init(killFile);
      proc.run(true, ["-9", "mpv"], 2);
    }
  } catch (e) {
    Zotero.debug(`EdgeTTS: stopSpeak error: ${e}`);
  }
}

function speak(text: string) {
  if (!edgePlaybackPath) return;

  // 终止上一条播放
  stopSpeak();

  const voice = getVoice();

  try {
    const file = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsIFile);
    file.initWithPath(edgePlaybackPath);

    const proc = Components.classes["@mozilla.org/process/util;1"]
      .createInstance(Components.interfaces.nsIProcess);
    proc.init(file);
    proc.runAsync(["--voice", voice, "--text", text], 4);
  } catch (e) {
    Zotero.debug(`EdgeTTS: speak error: ${e}`);
  }
}

// 设置面板加载时调用
async function onPrefsLoad(doc: Document) {
  const statusEl = doc.getElementById(`${config.addonRef}-status`) as HTMLElement;
  const voicePopup = doc.getElementById(`${config.addonRef}-voice-popup`);
  const voiceLabelEl = doc.getElementById(`${config.addonRef}-voice-label`) as HTMLElement;
  const testLabelEl = doc.getElementById(`${config.addonRef}-test-label`) as HTMLElement;
  const lang = getUILang();

  // 设置标签文本
  if (voiceLabelEl) {
    voiceLabelEl.textContent = lang === "zh" ? "语音" : "Voice";
  }
  if (testLabelEl) {
    testLabelEl.textContent = lang === "zh" ? "测试" : "Test";
  }

  // 如果还没检测，先检测
  if (availableVoices.length === 0) {
    await detectVoices();
  }

  // 显示状态
  if (statusEl) {
    if (!edgeTtsInstalled) {
      statusEl.textContent = lang === "zh"
        ? "⚠️ edge-tts 未安装，请运行: pip install edge-tts"
        : "⚠️ edge-tts not installed. Please run: pip install edge-tts";
      statusEl.style.background = "#ffebee";
      statusEl.style.color = "#c62828";
    } else {
      statusEl.textContent = lang === "zh"
        ? `✓ 就绪 (${availableVoices.length} 个语音可用)`
        : `✓ Ready (${availableVoices.length} voices available)`;
      statusEl.style.background = "#e8f5e9";
      statusEl.style.color = "#2e7d32";
    }
  }

  // 填充语音列表
  if (voicePopup && availableVoices.length > 0) {
    while (voicePopup.firstChild) {
      voicePopup.removeChild(voicePopup.firstChild);
    }

    const zhVoices = availableVoices.filter(v => v.startsWith("zh-"));
    const enVoices = availableVoices.filter(v => v.startsWith("en-"));

    if (zhVoices.length > 0) {
      const zhLabel = doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
      zhLabel.setAttribute("label", lang === "zh" ? "── 中文 ──" : "── Chinese ──");
      zhLabel.setAttribute("disabled", "true");
      voicePopup.appendChild(zhLabel);

      for (const voice of zhVoices) {
        const item = doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
        item.setAttribute("label", voice);
        item.setAttribute("value", voice);
        voicePopup.appendChild(item);
      }
    }

    if (enVoices.length > 0) {
      const enLabel = doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
      enLabel.setAttribute("label", lang === "zh" ? "── 英文 ──" : "── English ──");
      enLabel.setAttribute("disabled", "true");
      voicePopup.appendChild(enLabel);

      for (const voice of enVoices) {
        const item = doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
        item.setAttribute("label", voice);
        item.setAttribute("value", voice);
        voicePopup.appendChild(item);
      }
    }
  }
}

// 测试语音
function onTestSpeak() {
  const voice = getVoice();
  let testText: string;
  if (voice.startsWith("zh-")) {
    testText = "你好，这是语音测试";
  } else if (voice.startsWith("ja-")) {
    testText = "こんにちは、これは音声テストです";
  } else if (voice.startsWith("ko-")) {
    testText = "안녕하세요, 음성 테스트입니다";
  } else {
    testText = "Hello, this is a voice test";
  }
  speak(testText);
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-ignore
  delete Zotero[config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsLoad,
  onTestSpeak,
};