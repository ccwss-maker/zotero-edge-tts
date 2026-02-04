# Zotero Edge TTS

A Zotero plugin that reads selected text aloud using Microsoft Edge TTS.

## Features

- **Auto-play**: Automatically reads text when selected in PDF reader
- **Multiple voices**: Supports Chinese, English, Japanese, Korean and more
- **One-click toggle**: Enable/disable auto-play from the reader toolbar
- **Debug mode**: Optional detailed logging for troubleshooting

## Requirements

- **Zotero 7+ / 8+**
- **Linux** (currently)
- **Node.js >20** (Required for building)
- **[edge-tts](https://github.com/rany2/edge-tts)** - Text-to-speech engine
- **[mpv](https://mpv.io/)** - Audio player

> ✅ **Tested on Ubuntu 22.04 with Zotero 7.0.27 (64-bit) and Zotero 8.0.2 (64-bit)**

### Install Dependencies

```bash
# Install mpv player
sudo apt install mpv

# Install edge-tts (use system pip, not conda)
pip install edge-tts
```

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
- **Select voice**: Choose from available TTS voices
- **Test voice**: Play a test sample
- **Enable Debug Mode**: Turn on detailed logging for troubleshooting (disabled by default)

## Troubleshooting

### Chinese Text Not Playing?

1. Enable Debug Mode in settings (`Edit` → `Settings` → `EdgeTTS`)
2. View debug logs: `Help` → `Debug Output Logging` → `View Output`
3. Look for error messages starting with `EdgeTTS:`

The plugin automatically:
- Cleans invalid Unicode characters
- Handles text encoding properly
- Captures error output from edge-tts

## Build from Source

**Important**: Node.js version **>20** is required for building this plugin.

### Step 1: Install Node.js >20

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc for zsh

# Install Node.js 20
nvm install 20
nvm use 20

# Verify installation (must be >20)
node -v  # Should show v22.x.x or higher
npm -v
```

### Step 2: Build the Plugin

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/ccwss-maker/zotero-edge-tts.git
cd zotero-edge-tts

# Install dependencies
npm install

# Build the plugin
npm run build
```

After building, `zotero-edge-tts.xpi` will be generated in the `build/` folder. You can then install it in Zotero.

## License

MIT
