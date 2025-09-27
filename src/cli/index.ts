#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MCPConfig {
  browserType: 'chrome' | 'firefox';
  headless: boolean;
  maxSessions: number;
  sessionTimeout: number;
  logLevel: string;
  authEnabled: boolean;
  port: number;
}

class MCPBrowserControlCLI {
  private program: Command;
  private config: MCPConfig;

  constructor() {
    this.program = new Command();
    this.config = this.loadDefaultConfig();
    this.setupCommands();
  }

  private loadDefaultConfig(): MCPConfig {
    return {
      browserType: 'chrome',
      headless: true,
      maxSessions: 5,
      sessionTimeout: 600000,
      logLevel: 'info',
      authEnabled: false,
      port: 3000
    };
  }

  private setupCommands(): void {
    this.program
      .name('mcp-browser-control')
      .description('CLI for MCP Browser Control Server')
      .version('1.0.0');

    // Server management commands
    this.program
      .command('start')
      .description('Start the MCP Browser Control Server')
      .option('-p, --port <port>', 'Server port', '3000')
      .option('-c, --config <file>', 'Configuration file')
      .option('-d, --daemon', 'Run as daemon')
      .action(this.startServer.bind(this));

    this.program
      .command('stop')
      .description('Stop the MCP Browser Control Server')
      .action(this.stopServer.bind(this));

    this.program
      .command('restart')
      .description('Restart the MCP Browser Control Server')
      .action(this.restartServer.bind(this));

    this.program
      .command('status')
      .description('Show server status')
      .action(this.showStatus.bind(this));

    // Session management commands
    this.program
      .command('sessions')
      .description('Manage browser sessions')
      .option('-l, --list', 'List active sessions')
      .option('-k, --kill <sessionId>', 'Kill specific session')
      .option('-c, --cleanup', 'Clean up idle sessions')
      .action(this.manageSessions.bind(this));

    // Configuration commands
    this.program
      .command('config')
      .description('Manage configuration')
      .option('-s, --show', 'Show current configuration')
      .option('-e, --edit', 'Edit configuration interactively')
      .option('-v, --validate', 'Validate configuration')
      .action(this.manageConfig.bind(this));

    // Testing commands
    this.program
      .command('test')
      .description('Run diagnostic tests')
      .option('-t, --tool <name>', 'Test specific tool')
      .option('-a, --audio', 'Test audio capabilities')
      .option('-n, --network', 'Test network connectivity')
      .action(this.runTests.bind(this));

    // Metrics commands
    this.program
      .command('metrics')
      .description('View server metrics')
      .option('-w, --watch', 'Watch metrics in real-time')
      .option('-f, --format <format>', 'Output format (json|prometheus)', 'json')
      .action(this.showMetrics.bind(this));

    // Log commands
    this.program
      .command('logs')
      .description('View server logs')
      .option('-f, --follow', 'Follow log output')
      .option('-n, --lines <number>', 'Number of lines to show', '100')
      .option('-l, --level <level>', 'Filter by log level')
      .action(this.showLogs.bind(this));

    // Health check commands
    this.program
      .command('health')
      .description('Perform health checks')
      .option('-l, --live', 'Liveness check only')
      .option('-r, --ready', 'Readiness check only')
      .option('-s, --startup', 'Startup check only')
      .action(this.performHealthCheck.bind(this));

    // Installation and setup commands
    this.program
      .command('setup')
      .description('Interactive setup wizard')
      .action(this.setupWizard.bind(this));

    this.program
      .command('install')
      .description('Install system dependencies')
      .option('--chrome', 'Install Chrome browser')
      .option('--drivers', 'Install WebDriver dependencies')
      .action(this.installDependencies.bind(this));
  }

  /**
   * Start the server
   */
  private async startServer(options: any): Promise<void> {
    const spinner = ora('Starting MCP Browser Control Server...').start();

    try {
      // Load configuration
      if (options.config) {
        await this.loadConfigFromFile(options.config);
      }

      // Update port if specified
      if (options.port) {
        this.config.port = parseInt(options.port);
      }

      // Check if server is already running
      const isRunning = await this.checkServerRunning();
      if (isRunning) {
        spinner.fail('Server is already running');
        return;
      }

      // Validate configuration
      await this.validateConfig();

      // Start server
      const serverProcess = spawn('node', ['dist/server.js'], {
        stdio: options.daemon ? 'ignore' : 'inherit',
        detached: options.daemon,
        env: {
          ...process.env,
          PORT: this.config.port.toString(),
          BROWSER_TYPE: this.config.browserType,
          HEADLESS: this.config.headless.toString(),
          MAX_CONCURRENT_SESSIONS: this.config.maxSessions.toString(),
          LOG_LEVEL: this.config.logLevel
        }
      });

      if (options.daemon) {
        // Save PID for daemon mode
        await fs.writeFile('.mcp-server.pid', serverProcess.pid!.toString());
        serverProcess.unref();
        spinner.succeed(`Server started as daemon (PID: ${serverProcess.pid})`);
      } else {
        spinner.succeed('Server started successfully');
        console.log(chalk.green('🚀 MCP Browser Control Server is running'));
        console.log(chalk.blue(`📡 Port: ${this.config.port}`));
        console.log(chalk.blue(`🌐 Browser: ${this.config.browserType}`));
        console.log(chalk.blue(`👤 Max Sessions: ${this.config.maxSessions}`));
      }

    } catch (error) {
      spinner.fail('Failed to start server');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Stop the server
   */
  private async stopServer(): Promise<void> {
    const spinner = ora('Stopping MCP Browser Control Server...').start();

    try {
      // Check for PID file
      const pidFile = '.mcp-server.pid';

      try {
        const pidContent = await fs.readFile(pidFile, 'utf-8');
        const pid = parseInt(pidContent.trim());

        if (pid && !isNaN(pid)) {
          process.kill(pid, 'SIGTERM');
          await fs.unlink(pidFile);
          spinner.succeed(`Server stopped (PID: ${pid})`);
        } else {
          spinner.warn('No valid PID found');
        }
      } catch (error) {
        // Try to stop via HTTP endpoint
        try {
          const response = await fetch(`http://localhost:${this.config.port}/admin/shutdown`, {
            method: 'POST'
          });

          if (response.ok) {
            spinner.succeed('Server stopped via admin endpoint');
          } else {
            throw new Error('Shutdown endpoint failed');
          }
        } catch {
          spinner.fail('Server not running or already stopped');
        }
      }

    } catch (error) {
      spinner.fail('Failed to stop server');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Restart the server
   */
  private async restartServer(): Promise<void> {
    console.log(chalk.yellow('🔄 Restarting MCP Browser Control Server...'));
    await this.stopServer();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.startServer({});
  }

  /**
   * Show server status
   */
  private async showStatus(): Promise<void> {
    const spinner = ora('Checking server status...').start();

    try {
      const isRunning = await this.checkServerRunning();

      if (!isRunning) {
        spinner.fail('Server is not running');
        return;
      }

      // Get status from server
      const response = await fetch(`http://localhost:${this.config.port}/health/ready`);
      const healthData = await response.json();

      spinner.succeed('Server is running');

      console.log(chalk.green('\n📊 Server Status:'));
      console.log(`Status: ${this.getStatusIcon(healthData.status)} ${healthData.status}`);
      console.log(`Uptime: ${this.formatDuration(healthData.uptime)}`);
      console.log(`Version: ${healthData.version}`);

      console.log(chalk.blue('\n🔍 Health Checks:'));
      healthData.checks.forEach((check: any) => {
        const icon = this.getStatusIcon(check.status);
        console.log(`  ${icon} ${check.name}: ${check.status}`);
        if (check.message) {
          console.log(chalk.gray(`    ${check.message}`));
        }
      });

      console.log(chalk.blue('\n📈 Summary:'));
      console.log(`  Total: ${healthData.summary.total}`);
      console.log(`  ${chalk.green('Healthy')}: ${healthData.summary.healthy}`);
      console.log(`  ${chalk.yellow('Degraded')}: ${healthData.summary.degraded}`);
      console.log(`  ${chalk.red('Unhealthy')}: ${healthData.summary.unhealthy}`);

    } catch (error) {
      spinner.fail('Failed to get server status');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Manage browser sessions
   */
  private async manageSessions(options: any): Promise<void> {
    try {
      if (options.list) {
        await this.listSessions();
      } else if (options.kill) {
        await this.killSession(options.kill);
      } else if (options.cleanup) {
        await this.cleanupSessions();
      } else {
        // Interactive session management
        await this.interactiveSessionManagement();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Interactive setup wizard
   */
  private async setupWizard(): Promise<void> {
    console.log(chalk.blue('🧙 MCP Browser Control Server Setup Wizard\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'browserType',
        message: 'Select browser type:',
        choices: ['chrome', 'firefox'],
        default: 'chrome'
      },
      {
        type: 'confirm',
        name: 'headless',
        message: 'Run browser in headless mode?',
        default: true
      },
      {
        type: 'number',
        name: 'maxSessions',
        message: 'Maximum concurrent sessions:',
        default: 5,
        validate: (value) => value > 0 && value <= 50
      },
      {
        type: 'list',
        name: 'logLevel',
        message: 'Log level:',
        choices: ['error', 'warn', 'info', 'debug'],
        default: 'info'
      },
      {
        type: 'confirm',
        name: 'authEnabled',
        message: 'Enable authentication?',
        default: false
      },
      {
        type: 'number',
        name: 'port',
        message: 'Server port:',
        default: 3000,
        validate: (value) => value > 1024 && value < 65536
      }
    ]);

    this.config = { ...this.config, ...answers };

    // Save configuration
    await this.saveConfig();

    console.log(chalk.green('\n✅ Configuration saved successfully!'));
    console.log(chalk.blue('To start the server, run: mcp-browser-control start'));
  }

  /**
   * Check if server is running
   */
  private async checkServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/health/live`, {
        signal: AbortSignal.timeout(5000)
      } as any);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfig(): Promise<void> {
    const errors: string[] = [];

    // Check port availability
    try {
      const { stdout } = await execAsync(`lsof -i :${this.config.port}`);
      if (stdout.trim()) {
        errors.push(`Port ${this.config.port} is already in use`);
      }
    } catch {
      // Port is available (lsof returns error if no process is using the port)
    }

    // Check browser availability
    try {
      if (this.config.browserType === 'chrome') {
        await execAsync('google-chrome --version');
      } else {
        await execAsync('firefox --version');
      }
    } catch {
      errors.push(`${this.config.browserType} browser not found`);
    }

    if (errors.length > 0) {
      throw new Error('Configuration validation failed:\n' + errors.join('\n'));
    }
  }

  /**
   * List active sessions
   */
  private async listSessions(): Promise<void> {
    const spinner = ora('Fetching session information...').start();

    try {
      const response = await fetch(`http://localhost:${this.config.port}/admin/sessions`);
      const data = await response.json();

      spinner.succeed('Session information retrieved');

      if (data.sessions.length === 0) {
        console.log(chalk.yellow('No active sessions'));
        return;
      }

      console.log(chalk.blue('\n🖥️  Active Sessions:'));
      console.log('─'.repeat(80));

      data.sessions.forEach((session: any) => {
        const age = this.formatDuration(Date.now() - session.createdAt);
        const status = session.isReady ? chalk.green('Ready') : chalk.red('Not Ready');

        console.log(`${chalk.bold(session.id.substring(0, 8))}... | ${status} | ${session.browserType} | ${age}`);
        console.log(`  URL: ${session.url || 'about:blank'}`);
        console.log(`  Title: ${session.title || 'No title'}`);
        console.log(`  Actions: ${session.totalActions || 0} (${session.successfulActions || 0} successful)`);
        console.log('');
      });

      console.log(chalk.blue('📊 Summary:'));
      console.log(`Total Sessions: ${data.sessions.length}`);
      console.log(`Active: ${data.metrics.activeSessions}`);
      console.log(`Average Age: ${this.formatDuration(data.metrics.averageSessionAge)}`);

    } catch (error) {
      spinner.fail('Failed to fetch session information');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Show metrics
   */
  private async showMetrics(options: any): Promise<void> {
    try {
      if (options.watch) {
        await this.watchMetrics(options.format);
      } else {
        await this.displayMetrics(options.format);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Display metrics once
   */
  private async displayMetrics(format: string): Promise<void> {
    const spinner = ora('Fetching metrics...').start();

    try {
      const response = await fetch(`http://localhost:${this.config.port}/metrics`);
      const data = await response.text();

      spinner.succeed('Metrics retrieved');

      if (format === 'prometheus') {
        console.log(data);
      } else {
        // Parse and format as JSON
        const lines = data.split('\n').filter(line => line && !line.startsWith('#'));
        const metrics: any = {};

        lines.forEach(line => {
          const [nameAndLabels, value] = line.split(' ');
          const [name] = nameAndLabels.split('{');

          if (!metrics[name]) {
            metrics[name] = [];
          }

          metrics[name].push({
            metric: nameAndLabels,
            value: parseFloat(value)
          });
        });

        console.log(JSON.stringify(metrics, null, 2));
      }

    } catch (error) {
      spinner.fail('Failed to fetch metrics');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Watch metrics in real-time
   */
  private async watchMetrics(format: string): Promise<void> {
    console.log(chalk.blue('📊 Watching metrics (Press Ctrl+C to stop)...\n'));

    const interval = setInterval(async () => {
      try {
        console.clear();
        console.log(chalk.blue('📊 MCP Browser Control Server Metrics'));
        console.log(`🕐 ${new Date().toLocaleTimeString()}\n`);

        await this.displayMetrics(format);
      } catch (error) {
        console.error(chalk.red('Error fetching metrics:'), error instanceof Error ? error.message : 'Unknown error');
      }
    }, 5000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.yellow('\n👋 Metrics watching stopped'));
      process.exit(0);
    });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(options: any): Promise<void> {
    const spinner = ora('Performing health check...').start();

    try {
      let endpoint = '/health/ready';
      if (options.live) endpoint = '/health/live';
      if (options.startup) endpoint = '/health/startup';

      const response = await fetch(`http://localhost:${this.config.port}${endpoint}`);
      const healthData = await response.json();

      spinner.succeed('Health check completed');

      const statusIcon = this.getStatusIcon(healthData.status);
      console.log(`\n${statusIcon} Overall Status: ${chalk.bold(healthData.status.toUpperCase())}`);

      console.log(chalk.blue('\n🔍 Detailed Checks:'));
      healthData.checks.forEach((check: any) => {
        const icon = this.getStatusIcon(check.status);
        console.log(`  ${icon} ${check.name}: ${check.status} (${check.duration}ms)`);
        if (check.message) {
          console.log(chalk.gray(`    ${check.message}`));
        }
      });

    } catch (error) {
      spinner.fail('Health check failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(): Promise<void> {
    const configPath = path.join(process.cwd(), '.mcp-config.json');
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFromFile(configFile: string): Promise<void> {
    try {
      const configContent = await fs.readFile(configFile, 'utf-8');
      const fileConfig = JSON.parse(configContent);
      this.config = { ...this.config, ...fileConfig };
    } catch (error) {
      throw new Error(`Failed to load configuration from ${configFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Interactive session management
   */
  private async interactiveSessionManagement(): Promise<void> {
    const choices = [
      'List all sessions',
      'View session details',
      'Kill session',
      'Cleanup idle sessions',
      'Create test session',
      'Back to main menu'
    ];

    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: 'Session management:',
      choices
    });

    switch (action) {
      case 'List all sessions':
        await this.listSessions();
        break;
      case 'Kill session':
        const { sessionId } = await inquirer.prompt({
          type: 'input',
          name: 'sessionId',
          message: 'Enter session ID to kill:'
        });
        await this.killSession(sessionId);
        break;
      // Add other actions as needed
    }
  }

  /**
   * Kill specific session
   */
  private async killSession(sessionId: string): Promise<void> {
    const spinner = ora(`Killing session ${sessionId}...`).start();

    try {
      const response = await fetch(`http://localhost:${this.config.port}/admin/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        spinner.succeed(`Session ${sessionId} killed successfully`);
      } else {
        const error = await response.json();
        spinner.fail(`Failed to kill session: ${error.message}`);
      }

    } catch (error) {
      spinner.fail('Failed to kill session');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Clean up idle sessions
   */
  private async cleanupSessions(): Promise<void> {
    const spinner = ora('Cleaning up idle sessions...').start();

    try {
      const response = await fetch(`http://localhost:${this.config.port}/admin/sessions/cleanup`, {
        method: 'POST'
      });

      const result = await response.json();

      if (response.ok) {
        spinner.succeed(`Cleaned up ${result.cleaned} idle sessions`);
      } else {
        spinner.fail(`Cleanup failed: ${result.message}`);
      }

    } catch (error) {
      spinner.fail('Failed to cleanup sessions');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Utility methods
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Run the CLI
   */
  run(): void {
    this.program.parse();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new MCPBrowserControlCLI();
  cli.run();
}

export default MCPBrowserControlCLI;