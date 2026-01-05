# Aviation

A monorepo for aviation-related applications and SDKs, organized for efficient parallel development using the beads pattern.

## 🚀 Applications

### [ForeFlight Dashboard](apps/foreflight-dashboard/)
A modern, stateless web application for analyzing ForeFlight logbook data. Upload your ForeFlight CSV exports for comprehensive analysis with advanced validation rules and beautiful visualizations.

**Features:**
- Import & analyze ForeFlight CSV exports
- Smart validation for cross-country flights and time accountability
- Visual distinctions for ground training and night flights
- ICAO aircraft code validation
- Real-time statistics and currency tracking
- Completely stateless - no accounts, no tracking, no data persistence

**Tech Stack:** Python 3.11, FastAPI, React 18, TypeScript, Material-UI, Docker

[📖 Full Documentation](apps/foreflight-dashboard/README.md) | [🚀 Quick Start](apps/foreflight-dashboard/README.md#quick-start)

## 📦 Packages

*Coming soon - shared libraries and SDKs*

## 🏗️ Monorepo Structure

```
Aviation/
├── apps/                          # Applications
│   └── foreflight-dashboard/     # ForeFlight logbook analyzer
├── packages/                      # Shared packages (future)
├── AGENTS.md                     # LLM-friendly guidelines
├── CONTRIBUTING.md               # Development guidelines
└── README.md                     # This file
```

## 🔷 Work Organization with Beads

This monorepo uses the **beads pattern** for organizing work into independent, composable units that can be:

- **Executed in parallel** - Multiple beads can run simultaneously
- **Tested independently** - Each bead has its own test suite
- **Developed separately** - Teams can work on different beads without conflicts
- **Composed together** - Beads combine to create complete workflows

Each application includes a `beads.yaml` file that defines its beads and their dependencies. This enables:
- Optimal parallel execution during development
- Faster CI/CD pipelines
- Clear separation of concerns
- Better scalability as the codebase grows

See [AGENTS.md](AGENTS.md) for detailed information about the beads pattern.

## 🛠️ Development

### Prerequisites

- Docker and Docker Compose (for containerized apps)
- Python 3.11+ (for Python applications)
- Node.js 18+ (for JavaScript/TypeScript applications)
- Git

### Getting Started

Each application is self-contained with its own development environment:

```bash
# Navigate to an application
cd apps/foreflight-dashboard

# Follow the app's README for setup instructions
# Most apps use Docker for easy setup
make start
```

### Repository Guidelines

- **Applications** (`apps/`) - Complete, standalone applications
- **Packages** (`packages/`) - Shared code and libraries
- **Beads** - Independent work units defined in each app's `beads.yaml`

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## 📚 Documentation

- [AGENTS.md](AGENTS.md) - Guidelines for LLM agents and automated tools
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute to this repository
- Individual app READMEs in `apps/*/README.md`

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Code style and conventions
- The beads pattern for work organization
- Testing requirements
- Pull request process

## ✈️ About

This monorepo consolidates aviation-related tools and applications to enable:
- Shared code and dependencies
- Consistent development practices
- Efficient parallel development with beads
- Simplified deployment and maintenance
