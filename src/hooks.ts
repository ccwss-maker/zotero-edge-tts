import { config } from "../package.json";
import { ZoteroToolkit } from "zotero-plugin-toolkit";

let availableVoices: string[] = [];
let edgeTtsInstalled = true;
let edgeTtsPath = "";
let edgePlaybackPath = "";

// 获取偏好设置
function getPref(key: string): any {
  return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
}

// 获取调试模式状态
function getDebugEnabled(): boolean {
  return getPref("debugMode") === true;
}

// 条件调试输出 - 只在调试模式开启时输出
function debugLog(message: string): void {
  if (getDebugEnabled()) {
    Zotero.debug(message);
  }
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
  const possiblePaths = [
    `/usr/local/bin/${command}`,
    `/usr/bin/${command}`,
    `${Zotero.Profile.dir}/../.local/bin/${command}`,
    // 从 HOME 环境变量构建路径
  ];

  // 尝试从环境变量获取 HOME
  try {
    const env = Components.classes["@mozilla.org/process/environment;1"]
      .getService(Components.interfaces.nsIEnvironment);
    const home = env.get("HOME");
    if (home) {
      possiblePaths.unshift(`${home}/.local/bin/${command}`);
    }
  } catch (e) {
    // ignore
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
  return command; // 返回命令名，依赖 PATH
}

// 检测 edge-tts 并获取可用语音
async function detectVoices(): Promise<void> {
  return new Promise((resolve) => {
    try {
      debugLog("=== EdgeTTS: detectVoices Start ===");

      edgeTtsPath = findCommandPath("edge-tts");
      edgePlaybackPath = findCommandPath("edge-playback");

      debugLog(`EdgeTTS: edgeTtsPath = ${edgeTtsPath}`);
      debugLog(`EdgeTTS: edgePlaybackPath = ${edgePlaybackPath}`);

      const file = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);

      try {
        file.initWithPath(edgeTtsPath);
        if (!file.exists()) {
          debugLog(`EdgeTTS: edge-tts not found at ${edgeTtsPath}`);
          edgeTtsInstalled = false;
          resolve();
          return;
        }
        debugLog(`EdgeTTS: edge-tts found at ${edgeTtsPath}`);
      } catch (e) {
        // 路径可能不是绝对路径，假设已安装
        debugLog(`EdgeTTS: Could not verify path, assuming edge-tts is installed: ${e}`);
        edgeTtsInstalled = true;
      }

      edgeTtsInstalled = true;

      // 获取语音列表 - 使用临时文件
      const tempFile = Components.classes["@mozilla.org/file/directory_service;1"]
        .getService(Components.interfaces.nsIProperties)
        .get("TmpD", Components.interfaces.nsIFile);
      tempFile.append("edge-tts-voices.txt");

      debugLog(`EdgeTTS: Temp file path: ${tempFile.path}`);

      const bashFile = Components.classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsIFile);
      bashFile.initWithPath("/bin/bash");

      const proc = Components.classes["@mozilla.org/process/util;1"]
        .createInstance(Components.interfaces.nsIProcess);
      proc.init(bashFile);

      const listVoicesCmd = `${edgeTtsPath} --list-voices > ${tempFile.path} 2>&1`;
      debugLog(`EdgeTTS: Running command: ${listVoicesCmd}`);

      proc.run(true, ["-c", listVoicesCmd], 2);

      // 读取结果
      if (tempFile.exists()) {
        const data = Zotero.File.getContents(tempFile);
        debugLog(`EdgeTTS: Voice list data length: ${data.length}`);
        debugLog(`EdgeTTS: Voice list first 500 chars: ${data.substring(0, 500)}`);

        const lines = data.split("\n");
        availableVoices = [];
        for (const line of lines) {
          const match = line.match(/^([a-z]{2}-[A-Z]{2,}-\w+)\s+/i);
          if (match) {
            availableVoices.push(match[1]);
          }
        }

        debugLog(`EdgeTTS: Total voices found: ${availableVoices.length}`);
        debugLog(`EdgeTTS: Chinese voices: ${availableVoices.filter(v => v.startsWith("zh-")).join(", ")}`);

        tempFile.remove(false);
      } else {
        debugLog(`EdgeTTS: Temp file does not exist after running command`);
      }

      debugLog("=== EdgeTTS: detectVoices End ===");
      resolve();
    } catch (e) {
      debugLog(`EdgeTTS: detectVoices error: ${e}`);
      debugLog(`EdgeTTS: Error stack: ${(e as Error).stack || 'No stack trace'}`);
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
      debugLog(`EdgeTTS: Text selection event triggered`);
      debugLog(`EdgeTTS: AutoPlay enabled = ${getAutoPlay()}`);

      if (getAutoPlay()) {
        const text = ztoolkit.Reader.getSelectedText(reader);
        debugLog(`EdgeTTS: Selected text length = ${text ? text.length : 0}`);
        if (text) {
          debugLog(`EdgeTTS: Selected text preview: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
          speak(text);
        } else {
          debugLog(`EdgeTTS: No text selected`);
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
    debugLog(`EdgeTTS: reloadReaderTabs error: ${e}`);
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
    debugLog(`EdgeTTS: stopSpeak() - Killing mpv processes`);

    const pkillFile = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsIFile);
    pkillFile.initWithPath("/usr/bin/pkill");

    const proc = Components.classes["@mozilla.org/process/util;1"]
      .createInstance(Components.interfaces.nsIProcess);
    proc.init(pkillFile);
    proc.run(true, ["-9", "mpv"], 2);

    debugLog(`EdgeTTS: stopSpeak() - mpv processes killed`);
  } catch (e) {
    debugLog(`EdgeTTS: stopSpeak error: ${e}`);
  }
}

// 清理文本中的无效Unicode字符
function cleanText(text: string): string {
  // 移除代理字符对（surrogate pairs）和其他无效字符
  return text.replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')  // 替换控制字符为空格
    .trim();
}

function speak(text: string) {
  debugLog("=== EdgeTTS Debug Start ===");
  debugLog(`EdgeTTS: speak() called`);
  debugLog(`EdgeTTS: edgePlaybackPath = ${edgePlaybackPath}`);

  if (!edgePlaybackPath) {
    debugLog("EdgeTTS: ERROR - edgePlaybackPath is empty!");
    return;
  }

  // 清理文本
  const cleanedText = cleanText(text);
  debugLog(`EdgeTTS: Original text length = ${text.length}`);
  debugLog(`EdgeTTS: Cleaned text length = ${cleanedText.length}`);

  if (!cleanedText) {
    debugLog("EdgeTTS: ERROR - Text is empty after cleaning!");
    return;
  }

  // 终止上一条播放
  stopSpeak();

  const voice = getVoice();

  debugLog(`EdgeTTS: Selected voice = ${voice}`);
  debugLog(`EdgeTTS: Text to speak (length=${cleanedText.length}): ${cleanedText.substring(0, 100)}${cleanedText.length > 100 ? '...' : ''}`);
  debugLog(`EdgeTTS: Text encoding check - first char code: ${cleanedText.charCodeAt(0)}`);

  try {
    // 将文本写入临时文件，避免命令行编码问题
    const tempDir = Components.classes["@mozilla.org/file/directory_service;1"]
      .getService(Components.interfaces.nsIProperties)
      .get("TmpD", Components.interfaces.nsIFile);

    const textFile = tempDir.clone();
    textFile.append("edge-tts-text.txt");
    const stdoutFile = tempDir.clone();
    stdoutFile.append("edge-tts-stdout.txt");
    const stderrFile = tempDir.clone();
    stderrFile.append("edge-tts-stderr.txt");

    // 写入文本到文件（UTF-8编码）
    Zotero.File.putContents(textFile, cleanedText);
    debugLog(`EdgeTTS: Text file: ${textFile.path}`);
    debugLog(`EdgeTTS: stdout file: ${stdoutFile.path}`);
    debugLog(`EdgeTTS: stderr file: ${stderrFile.path}`);

    // 使用bash来运行命令并捕获输出
    const bashFile = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsIFile);
    bashFile.initWithPath("/bin/bash");

    const proc = Components.classes["@mozilla.org/process/util;1"]
      .createInstance(Components.interfaces.nsIProcess);
    proc.init(bashFile);

    // 从文件读取文本
    const cmd = `${edgePlaybackPath} --voice '${voice}' --text "$(cat '${textFile.path}')" > ${stdoutFile.path} 2> ${stderrFile.path}`;

    debugLog(`EdgeTTS: Running command: ${cmd}`);

    proc.runAsync(["-c", cmd], 2, {
      observe: function() {
        // 命令完成后读取输出并清理临时文件
        setTimeout(() => {
          try {
            if (stdoutFile.exists()) {
              const stdout = Zotero.File.getContents(stdoutFile);
              if (stdout.trim()) {
                debugLog(`EdgeTTS: STDOUT: ${stdout}`);
              }
              stdoutFile.remove(false);
            }

            if (stderrFile.exists()) {
              const stderr = Zotero.File.getContents(stderrFile);
              if (stderr.trim()) {
                debugLog(`EdgeTTS: STDERR: ${stderr}`);
              }
              stderrFile.remove(false);
            }

            if (textFile.exists()) {
              textFile.remove(false);
            }
          } catch (e) {
            debugLog(`EdgeTTS: Error reading output files: ${e}`);
          }
        }, 100);
      }
    });

    debugLog(`EdgeTTS: Command launched`);
  } catch (e) {
    debugLog(`EdgeTTS: speak error: ${e}`);
    debugLog(`EdgeTTS: Error stack: ${e.stack || 'No stack trace'}`);
  }

  debugLog("=== EdgeTTS Debug End ===");
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
  debugLog("=== EdgeTTS: onTestSpeak Start ===");

  const voice = getVoice();
  debugLog(`EdgeTTS: Test voice = ${voice}`);

  let testText: string;
  if (voice.startsWith("zh-")) {
    testText = "你好，这是语音测试";
    debugLog(`EdgeTTS: Using Chinese test text`);
  } else if (voice.startsWith("ja-")) {
    testText = "こんにちは、これは音声テストです";
    debugLog(`EdgeTTS: Using Japanese test text`);
  } else if (voice.startsWith("ko-")) {
    testText = "안녕하세요, 음성 테스트입니다";
    debugLog(`EdgeTTS: Using Korean test text`);
  } else {
    testText = "Hello, this is a voice test";
    debugLog(`EdgeTTS: Using English test text`);
  }

  debugLog(`EdgeTTS: Test text = "${testText}"`);
  debugLog(`EdgeTTS: Test text char codes: ${Array.from(testText.substring(0, 10)).map(c => c.charCodeAt(0)).join(', ')}`);

  speak(testText);

  debugLog("=== EdgeTTS: onTestSpeak End ===");
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