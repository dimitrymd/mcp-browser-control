# Selenium WebDriver Setup Guide

This guide provides comprehensive instructions for setting up Selenium WebDriver with Chrome browser on macOS, Windows, and Linux for the MCP Browser Control Server.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [macOS Setup](#macos-setup)
3. [Windows Setup](#windows-setup)
4. [Linux Setup](#linux-setup)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)
8. [Docker Setup](#docker-setup)

## Prerequisites

### General Requirements
- **Node.js 18+** - Required for the MCP Browser Control Server
- **Chrome Browser** - Latest stable version recommended
- **Internet Connection** - For downloading ChromeDriver and dependencies

### Version Compatibility
- **Chrome Browser**: Latest stable (recommended) or ESR versions
- **ChromeDriver**: Automatically managed by selenium-webdriver
- **Selenium WebDriver**: 4.18.0+ (as specified in package.json)

---

## macOS Setup

### Method 1: Automatic Setup (Recommended)

The MCP Browser Control Server uses `selenium-webdriver` which automatically manages ChromeDriver downloads. Simply ensure Chrome is installed:

#### 1. Install Chrome Browser
```bash
# Option A: Download from Google
# Visit https://www.google.com/chrome/ and download the installer

# Option B: Using Homebrew
brew install --cask google-chrome

# Verify installation
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version
```

#### 2. Install MCP Browser Control Server
```bash
# Clone the repository
git clone https://github.com/dimitrymd/mcp-browser-control.git
cd mcp-browser-control

# Install dependencies (includes selenium-webdriver)
npm install

# The selenium-webdriver package will automatically manage ChromeDriver
```

#### 3. Set Environment Variables
```bash
# Create .env file
cp .env.example .env

# Edit .env file
BROWSER_TYPE=chrome
HEADLESS=true
MAX_CONCURRENT_SESSIONS=5
SESSION_TIMEOUT=600000
LOG_LEVEL=info
```

### Method 2: Manual ChromeDriver Setup

If you prefer manual control over ChromeDriver:

#### 1. Check Chrome Version
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version
```

#### 2. Download Matching ChromeDriver
```bash
# Visit https://chromedriver.chromium.org/downloads
# Download version matching your Chrome browser

# Or use npm package
npm install -g chromedriver

# Or use Homebrew
brew install chromedriver
```

#### 3. Set PATH (if using manual download)
```bash
# Add to ~/.zshrc or ~/.bash_profile
export PATH="$PATH:/path/to/chromedriver"

# Or move to system PATH
sudo mv chromedriver /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver
```

#### 4. Remove Quarantine (macOS Gatekeeper)
```bash
# Remove quarantine attribute if needed
sudo xattr -d com.apple.quarantine /usr/local/bin/chromedriver
```

### macOS-Specific Considerations

#### Security & Permissions
```bash
# Grant terminal access to control Chrome if needed
# System Preferences > Security & Privacy > Privacy > Accessibility
# Add Terminal or your IDE

# For screen recording (screenshots)
# System Preferences > Security & Privacy > Privacy > Screen Recording
# Add Terminal or your IDE
```

#### Multiple Chrome Versions
```bash
# For Chrome Beta/Dev/Canary testing
# Install additional Chrome versions
brew install --cask google-chrome-beta
brew install --cask google-chrome-dev
brew install --cask google-chrome-canary

# Use specific Chrome binary in driver options
CHROME_BINARY="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"
```

---

## Windows Setup

### Method 1: Automatic Setup (Recommended)

#### 1. Install Chrome Browser
```powershell
# Option A: Download from Google
# Visit https://www.google.com/chrome/ and run installer

# Option B: Using Chocolatey
choco install googlechrome

# Option C: Using winget
winget install Google.Chrome

# Verify installation
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

#### 2. Install MCP Browser Control Server
```powershell
# Clone repository
git clone <your-repo-url>
cd mcp-browser-control

# Install dependencies
npm install

# ChromeDriver will be automatically managed
```

#### 3. Configure Environment
```powershell
# Copy environment file
copy .env.example .env

# Edit .env file with Windows paths if needed
$env:BROWSER_TYPE="chrome"
$env:HEADLESS="true"
$env:LOG_LEVEL="info"
```

### Method 2: Manual ChromeDriver Setup

#### 1. Check Chrome Version
```powershell
# Check Chrome version
reg query "HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon" /v version

# Or check in Chrome: chrome://version/
```

#### 2. Download ChromeDriver
```powershell
# Visit https://chromedriver.chromium.org/downloads
# Download matching version for Windows

# Extract to a permanent location
# Example: C:\WebDrivers\chromedriver.exe
```

#### 3. Set PATH Environment Variable
```powershell
# Add to system PATH
$env:PATH += ";C:\WebDrivers"

# Or set permanently
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\WebDrivers", "User")
```

### Windows-Specific Considerations

#### Windows Security
```powershell
# Windows Defender may flag ChromeDriver as suspicious
# Add exclusion if needed:
# Windows Security > Virus & threat protection > Exclusions
# Add folder: C:\WebDrivers

# For Windows 11, ensure execution policy allows scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Windows Subsystem for Linux (WSL)
```bash
# If using WSL, install Chrome for Linux instead
# See Linux setup instructions below

# Or use Windows Chrome from WSL (advanced)
export CHROME_BIN="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
```

---

## Linux Setup

### Ubuntu/Debian Setup

#### 1. Install Chrome Browser
```bash
# Update package list
sudo apt update

# Install dependencies
sudo apt install -y wget gnupg

# Add Google Chrome repository
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# Install Chrome
sudo apt update
sudo apt install -y google-chrome-stable

# Verify installation
google-chrome --version
```

#### 2. Install Additional Dependencies
```bash
# Install additional libraries needed for headless Chrome
sudo apt install -y \
    libnss3 \
    libgconf-2-4 \
    libxi6 \
    libxcomposite1 \
    libxss1 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0

# For audio testing support
sudo apt install -y pulseaudio
```

#### 3. Install MCP Browser Control Server
```bash
# Clone and setup
git clone <your-repo-url>
cd mcp-browser-control
npm install

# Set environment variables
cp .env.example .env
```

### Red Hat/CentOS/Fedora Setup

#### 1. Install Chrome Browser
```bash
# Add Google Chrome repository
sudo tee /etc/yum.repos.d/google-chrome.repo <<EOF
[google-chrome]
name=google-chrome
baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF

# Install Chrome
sudo dnf install -y google-chrome-stable
# OR for older systems:
# sudo yum install -y google-chrome-stable

# Verify installation
google-chrome --version
```

#### 2. Install Dependencies
```bash
# Install required libraries
sudo dnf install -y \
    nss \
    atk \
    cups-libs \
    gtk3 \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXss \
    libXtst \
    alsa-lib \
    at-spi2-atk

# For audio support
sudo dnf install -y pulseaudio
```

### Arch Linux Setup

#### 1. Install Chrome
```bash
# Using AUR helper (yay)
yay -S google-chrome

# Or manual AUR installation
git clone https://aur.archlinux.org/google-chrome.git
cd google-chrome
makepkg -si
```

#### 2. Install Dependencies
```bash
# Install required packages
sudo pacman -S nss gtk3 libxss alsa-lib
```

### Linux-Specific Considerations

#### Display Server Setup
```bash
# For headless servers, set up virtual display
sudo apt install -y xvfb

# Start virtual display
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x24 &

# Or use in your application
xvfb-run -a npm start
```

#### Audio Setup for Testing
```bash
# Set up PulseAudio for audio testing
# Start PulseAudio
pulseaudio --start

# Create virtual audio device
pactl load-module module-null-sink sink_name=virtual_audio

# Set as default
pactl set-default-sink virtual_audio

# Verify audio setup
pactl info
```

#### Permissions and Security
```bash
# Add user to audio group for audio testing
sudo usermod -a -G audio $USER

# Set Chrome to run without sandbox (development only)
export CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage"

# Or configure in .env
echo 'CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage"' >> .env
```

---

## Verification

### Test Chrome Installation
```bash
# Test Chrome directly
google-chrome --version
google-chrome --headless --dump-dom https://www.google.com

# On macOS:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version
```

### Test ChromeDriver
```bash
# If manually installed
chromedriver --version

# Test with Node.js
node -e "
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async () => {
  const options = new chrome.Options();
  options.addArguments('--headless');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  await driver.get('https://www.google.com');
  const title = await driver.getTitle();
  console.log('Page title:', title);

  await driver.quit();
  console.log('✅ Selenium setup successful!');
})().catch(console.error);
"
```

### Test MCP Browser Control Server
```bash
# Test the server can start
npm run build
npm start &

# Test basic functionality
echo '{"tool": "create_session", "arguments": {"browserType": "chrome", "headless": true}}' | npm start

# Kill the test server
pkill -f "npm start"
```

---

## Troubleshooting

### Common Issues

#### Chrome Binary Not Found
```bash
# Set Chrome binary path explicitly
export CHROME_BIN="/path/to/chrome"

# In code (src/drivers/manager.ts):
chromeOptions.setChromeBinaryPath('/path/to/chrome');
```

#### ChromeDriver Version Mismatch
```bash
# Check Chrome version
google-chrome --version

# Check ChromeDriver version
chromedriver --version

# Download matching version from:
# https://chromedriver.chromium.org/downloads

# Or let selenium-webdriver handle it automatically (recommended)
```

#### Permission Denied Errors
```bash
# Make ChromeDriver executable
chmod +x /path/to/chromedriver

# On macOS, remove quarantine
sudo xattr -d com.apple.quarantine /path/to/chromedriver

# On Linux, check SELinux context
ls -Z /path/to/chromedriver
```

#### Audio Testing Issues
```bash
# Ensure audio subsystem is available
# Linux:
pulseaudio --check -v

# macOS:
system_profiler SPAudioDataType

# Windows:
Get-WmiObject -Class Win32_SoundDevice
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Chrome flags for memory optimization
export CHROME_FLAGS="--memory-pressure-off --max_old_space_size=4096"
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=selenium-webdriver
export LOG_LEVEL=debug

# Run with verbose output
npm start 2>&1 | tee selenium-debug.log
```

### Network Issues
```bash
# Test internet connectivity
curl -I https://chromedriver.storage.googleapis.com/

# Check proxy settings if behind corporate firewall
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Configure Chrome proxy
export CHROME_FLAGS="--proxy-server=http://proxy.company.com:8080"
```

---

## Advanced Configuration

### Chrome Options for Audio Testing
```javascript
// Enhanced Chrome configuration for audio testing
const chromeOptions = new chrome.Options();

// Audio-specific flags
chromeOptions.addArguments(
  '--autoplay-policy=no-user-gesture-required',
  '--disable-background-media-suspend',
  '--disable-media-suspend',
  '--enable-features=WebRTC-HideLocalIpsWithMdns',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=TranslateUI',
  '--no-default-browser-check',
  '--no-first-run',
  '--disable-default-apps',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection'
);

// Performance optimization for testing
chromeOptions.addArguments(
  '--memory-pressure-off',
  '--max_old_space_size=4096',
  '--disable-dev-shm-usage', // Overcome limited resource problems
  '--disable-gpu', // Applicable to Windows and Linux
  '--no-sandbox', // Development only - remove for production
  '--disable-web-security' // Development only - remove for production
);
```

### Firefox Alternative Setup
```bash
# Install Firefox (alternative to Chrome)
# macOS:
brew install --cask firefox

# Linux (Ubuntu):
sudo apt install firefox

# Windows:
winget install Mozilla.Firefox

# Configure for audio testing
const firefoxOptions = new firefox.Options();
firefoxOptions.setPreference('media.autoplay.default', 0);
firefoxOptions.setPreference('media.autoplay.blocking_policy', 0);
```

### Custom Chrome Installation Paths

#### macOS
```bash
# Standard installation
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Chrome Beta
CHROME_BIN="/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta"

# Chrome Canary
CHROME_BIN="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
```

#### Windows
```bash
# Standard installation (64-bit)
CHROME_BIN="C:\Program Files\Google\Chrome\Application\chrome.exe"

# Standard installation (32-bit)
CHROME_BIN="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

# User installation
CHROME_BIN="%USERPROFILE%\AppData\Local\Google\Chrome\Application\chrome.exe"
```

#### Linux
```bash
# Standard installation
CHROME_BIN="/usr/bin/google-chrome"

# Alternative locations
CHROME_BIN="/opt/google/chrome/chrome"
CHROME_BIN="/usr/bin/google-chrome-stable"
```

---

## Docker Setup

### Dockerfile for Chrome + Selenium
```dockerfile
FROM node:18-bullseye

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

# Add Chrome repository
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Install Chrome and dependencies
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    libnss3 \
    libgconf-2-4 \
    libxi6 \
    libxcomposite1 \
    libxss1 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up audio for testing
RUN apt-get update && apt-get install -y pulseaudio && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy application files
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Create non-root user for security
RUN groupadd -r mcpuser && useradd -r -g mcpuser -s /bin/bash mcpuser
RUN chown -R mcpuser:mcpuser /app

USER mcpuser

# Set environment variables
ENV BROWSER_TYPE=chrome
ENV HEADLESS=true
ENV CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage"

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose with Selenium Grid
```yaml
version: '3.8'

services:
  selenium-hub:
    image: selenium/hub:4.15.0
    ports:
      - "4444:4444"
    environment:
      - GRID_MAX_SESSION=5
      - GRID_BROWSER_TIMEOUT=300
      - GRID_TIMEOUT=300

  chrome-node:
    image: selenium/node-chrome:4.15.0
    depends_on:
      - selenium-hub
    environment:
      - HUB_HOST=selenium-hub
      - NODE_MAX_INSTANCES=2
      - NODE_MAX_SESSION=2
    volumes:
      - /dev/shm:/dev/shm
    ports:
      - "5900:5900" # VNC for debugging

  mcp-browser-control:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SELENIUM_GRID_URL=http://selenium-hub:4444
      - BROWSER_TYPE=chrome
      - HEADLESS=true
      - MAX_CONCURRENT_SESSIONS=5
    depends_on:
      - selenium-hub
      - chrome-node
```

---

## Performance Optimization

### Chrome Flags for Production
```bash
# Production-ready Chrome flags
CHROME_FLAGS="
  --disable-blink-features=AutomationControlled
  --disable-extensions
  --disable-plugins
  --disable-images
  --disable-javascript-harmony-shipping
  --disable-background-timer-throttling
  --disable-renderer-backgrounding
  --disable-backgrounding-occluded-windows
  --disable-ipc-flooding-protection
  --memory-pressure-off
  --aggressive-cache-discard
  --max_old_space_size=4096
"
```

### Audio Testing Optimization
```bash
# Audio-specific Chrome flags
AUDIO_CHROME_FLAGS="
  --autoplay-policy=no-user-gesture-required
  --disable-background-media-suspend
  --disable-media-suspend
  --enable-logging=stderr
  --log-level=0
  --enable-features=WebRTC-HideLocalIpsWithMdns
  --force-color-profile=srgb
  --disable-accelerated-video-decode
  --disable-accelerated-video-encode
"
```

### Memory Management
```bash
# Node.js memory optimization
export NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=128"

# Chrome memory limits
export CHROME_FLAGS="$CHROME_FLAGS --memory-pressure-off --max_old_space_size=4096"

# Monitor memory usage
# macOS:
memory_pressure

# Linux:
free -h
cat /proc/meminfo

# Windows:
Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
```

---

## Continuous Integration Setup

### GitHub Actions
```yaml
name: MCP Browser Control Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Chrome (Ubuntu)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y google-chrome-stable

      - name: Setup Chrome (macOS)
        if: runner.os == 'macOS'
        run: |
          brew install --cask google-chrome

      - name: Setup Chrome (Windows)
        if: runner.os == 'Windows'
        run: |
          choco install googlechrome

      - name: Run tests
        run: npm test
        env:
          HEADLESS: true
          BROWSER_TYPE: chrome
```

### Jenkins Pipeline
```groovy
pipeline {
    agent any

    environment {
        HEADLESS = 'true'
        BROWSER_TYPE = 'chrome'
        LOG_LEVEL = 'info'
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run build'
                sh 'npm test'
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh 'docker build -t mcp-browser-control .'
                sh 'docker run -d -p 3000:3000 mcp-browser-control'
            }
        }
    }

    post {
        always {
            publishTestResults testResultsPattern: 'test-results.xml'
            archiveArtifacts artifacts: 'logs/*.log', allowEmptyArchive: true
        }
    }
}
```

---

## Security Considerations

### Production Security
```bash
# Remove development flags in production
# DO NOT USE in production:
--no-sandbox
--disable-web-security
--disable-dev-shm-usage # Only for containers

# Use secure flags:
--disable-extensions
--disable-plugins
--disable-background-networking
--disable-background-timer-throttling
```

### Network Security
```bash
# Restrict network access if needed
iptables -A OUTPUT -p tcp --dport 80,443 -j ACCEPT
iptables -A OUTPUT -p tcp -j DROP

# Configure proxy for corporate environments
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1
```

---

## Additional Resources

### Official Documentation
- [Selenium WebDriver](https://selenium-webdriver.readthedocs.io/)
- [ChromeDriver](https://chromedriver.chromium.org/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

### Useful Tools
- [Selenium Grid](https://selenium-grid.readthedocs.io/) - For distributed testing
- [BrowserStack](https://www.browserstack.com/) - Cloud testing platform
- [Sauce Labs](https://saucelabs.com/) - Cloud testing platform

### Community Resources
- [Selenium Community](https://selenium.dev/community/)
- [WebDriver W3C Specification](https://w3c.github.io/webdriver/)
- [Chrome Developer Tools](https://developers.google.com/web/tools/chrome-devtools)

---

## Platform-Specific Quick Start

### macOS Quick Start
```bash
# One-command setup for macOS
brew install node google-chrome
git clone <repo-url> && cd mcp-browser-control
npm install && npm run build && npm test
```

### Ubuntu Quick Start
```bash
# One-command setup for Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs google-chrome-stable
git clone <repo-url> && cd mcp-browser-control
npm install && npm run build && npm test
```

### Windows Quick Start
```powershell
# PowerShell setup for Windows
winget install OpenJS.NodeJS Google.Chrome
git clone <repo-url>; cd mcp-browser-control
npm install; npm run build; npm test
```

---

**Setup Complete!** Your Selenium WebDriver with Chrome is now ready for the MCP Browser Control Server with full audio testing capabilities.

For specific MCP Browser Control Server configuration, see the main [README.md](./README.md) file.
