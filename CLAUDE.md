# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the MCPBroControl project - an MCP (Model Context Protocol) Browser Control Server implementation. The repository currently contains specification and planning documents for building a comprehensive browser automation server using TypeScript, Selenium WebDriver, and the MCP SDK.

## Project Structure

The repository consists of two main planning documents:

- `mcp-browser-control-spec.md` - Complete technical specification and requirements document
- `mcp-browser-sprint-plan.md` - Detailed 5-sprint implementation plan (10 weeks total)

## Implementation Status

This is currently a **planning/design phase** repository. No code has been implemented yet. The project is designed to be built incrementally over 5 sprints:

1. **Sprint 1** (Weeks 1-2): Foundation & Basic Navigation
2. **Sprint 2** (Weeks 3-4): Element Interaction & Basic Extraction
3. **Sprint 3** (Weeks 5-6): Audio Testing & Advanced Features
4. **Sprint 4** (Weeks 7-8): Advanced Extraction & Multi-Window Support
5. **Sprint 5** (Weeks 9-10): Production Readiness & Optimization

## Technology Stack (Planned)

- **Runtime**: Node.js (v18.0.0 or higher)
- **Language**: TypeScript (v5.0.0 or higher)
- **MCP SDK**: @modelcontextprotocol/sdk (latest stable version)
- **Browser Automation**: Selenium WebDriver (v4.x)
- **Testing**: Vitest with comprehensive test coverage
- **Supported Browsers**: Chrome, Firefox, Safari, Edge

## Key Features (Planned)

- Complete browser control via MCP protocol
- Advanced audio testing capabilities (critical requirement)
- Multi-window and iframe support
- Network monitoring and performance profiling
- Production-ready with authentication, monitoring, and observability
- Docker deployment with Kubernetes support

## Audio Testing Focus

This project has a special emphasis on audio testing capabilities, including:
- Real-time audio playback detection
- Audio performance analysis
- Audio event monitoring
- Cross-browser audio testing support

## Next Steps

When beginning implementation:

1. Follow the sprint plan in `mcp-browser-sprint-plan.md`
2. Use the detailed LLM prompts provided for each sprint
3. Refer to the technical specification in `mcp-browser-control-spec.md`
4. Start with Sprint 1: Foundation & Basic Navigation

## Development Approach

- Each sprint includes comprehensive prompts designed for Claude Sonnet with 1M context
- Implementation should follow TypeScript best practices
- Comprehensive testing required (minimum 80% coverage)
- Security-first approach with input validation and sanitization
- Production-ready code from the start

## Important Notes

- This is not a generic web scraping tool - it's specifically an MCP server for browser automation
- Audio testing capabilities are a critical differentiator
- The server must handle concurrent browser sessions efficiently
- All browser operations should be reliable and include proper error handling
- Code should be production-ready, not just functional prototypes