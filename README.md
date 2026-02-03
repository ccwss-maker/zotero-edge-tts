# Zotero Edge TTS

A Zotero plugin that reads selected text aloud using Microsoft Edge TTS.

## Features

- Auto-play: Automatically reads text when selected in PDF reader
- Multiple voices: Supports Chinese, English, Japanese, Korean and more
- One-click toggle: Enable/disable auto-play from the reader toolbar

## Requirements

- Zotero 7+
- Windows or Linux
- [edge-tts](https://github.com/rany2/edge-tts) installed
- [mpv](https://mpv.io/) player installed

> Tested on Ubuntu 22.04 with Zotero 7.0.27 (64-bit)

### Linux
```bash
pip install edge-tts
sudo apt install mpv  # Ubuntu/Debian
```

### Windows
```bash
pip install edge-tts
```
Download and install [mpv](https://mpv.io/installation/) and add it to PATH.

## Installation

1. Download the `.xpi` file from [Releases](https://github.com/ccwss-maker/zotero-edge-tts/releases)
2. In Zotero, go to `Tools` → `Add-ons`
3. Click the gear icon → `Install Add-on From File...`
4. Select the downloaded `.xpi` file

## Usage

1. Open a PDF in Zotero reader
2. Click the play button in the toolbar to enable auto-play
3. Select any text to hear it read aloud

## Configuration

Go to `Edit` → `Settings` → `EdgeTTS` to:
- Select voice
- Test voice playback

## Build

```bash
npm install
npm run build
```

After building, `zotero-edge-tts.xpi` will be generated in the `build/` folder. You can then import it into Zotero.

## License

MIT
