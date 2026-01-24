# Garmin G1000 Simulator

> Part of the [Aviation Monorepo](../../README.md)

A comprehensive web-based flight simulator that accurately recreates the functionality, appearance, and user experience of the Garmin G1000 avionics suite. This educational tool provides realistic glass cockpit training for pilots and aviation enthusiasts.

## Overview

The G1000 Simulator features:

- ✈️ **Primary Flight Display (PFD)**: Attitude, airspeed, altitude, heading, navigation data
- 🗺️ **Multi-Function Display (MFD)**: Moving map, terrain, weather, engine monitoring
- 🎯 **Autopilot**: Full autopilot with lateral and vertical modes
- 📋 **Flight Planning**: Complete flight plan management with procedures
- 🎮 **Interactive Controls**: Virtual knobs, buttons, and softkeys
- 📊 **Demo Scenarios**: Pre-recorded flights and training scenarios
- 🔌 **Extensible**: Plugin architecture for custom features

## Architecture

### Technology Stack

**Backend Services:**
- Python (FastAPI) - Flight dynamics, navigation, performance calculations
- TypeScript (Node.js) - Real-time data streaming, WebSocket server
- SQLite/PostgreSQL - Persistence and navigation database

**Frontend:**
- React + TypeScript + Vite
- Canvas API for display rendering
- WebSocket for real-time updates

**New SDKs:**
- `@aviation/avionics-sdk` - AHRS, ADC, GPS, navigation radios, autopilot
- `@aviation/g1000-rendering` - Canvas rendering for PFD and MFD
- `@aviation/flight-dynamics` - Physics-based flight simulation
- `@aviation/nav-data` - Navigation database
- `@aviation/g1000-protocols` - Communication protocols

### Reused Components

- `@aviation/shared-sdk` - Service patterns and utilities
- `@aviation/keystore` - Secure secrets management
- `@aviation/ui-framework` - Multi-tab integration
- `apps/flight-planner` - Route calculation, airport database
- `apps/weather-briefing` - Weather data integration

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- npm 9+

### Installation

```bash
# From monorepo root
npm install

# Navigate to G1000 Simulator
cd apps/g1000-simulator

# Install dependencies (when implemented)
npm install
pip install -r backend/requirements.txt
```

### Development

```bash
# Start backend services
make start-backend

# Start frontend (in another terminal)
make start-frontend

# Run all tests
make test

# Build for production
make build
```

## Features

### Primary Flight Display (PFD)

The PFD displays critical flight information:

- **Attitude Indicator**: Artificial horizon with pitch ladder and roll pointer
- **Airspeed Tape**: IAS, TAS, and V-speeds
- **Altimeter**: Pressure altitude, VSI, barometric setting
- **HSI**: Horizontal situation indicator with CDI and navigation data
- **Engine Data**: RPM, manifold pressure, fuel flow, temperatures
- **Alerts**: Master warning/caution annunciators

**Update Rate**: 20 Hz (50ms intervals)

### Multi-Function Display (MFD)

The MFD provides situational awareness and system information:

- **Moving Map**: Flight plan, airports, navaids, airspace
- **Terrain Overlay**: Color-coded elevation with proximity warnings
- **Weather**: NEXRAD radar, METARs, winds aloft
- **Traffic**: Simulated or real ADS-B traffic
- **Engine Page**: Detailed engine monitoring and fuel management
- **Range Selection**: 0.5nm to 1000nm

**Update Rate**: 5 Hz for map, 1 Hz for engine page

### Autopilot

Full-featured autopilot simulation:

**Lateral Modes:**
- ROL (Roll Hold)
- HDG (Heading Hold)
- NAV (GPS/VOR Navigation)
- APR (Approach Mode)
- BC (Backcourse)

**Vertical Modes:**
- PIT (Pitch Hold)
- VS (Vertical Speed)
- ALT (Altitude Hold)
- ALTS (Altitude Select)
- GS (Glideslope)
- GP (Glidepath)

### Flight Planning

Complete flight plan management:

- Create, edit, and activate flight plans
- Insert waypoints (airports, VORs, intersections, user-defined)
- Load procedures (SIDs, STARs, approaches)
- Direct-to navigation
- Import/export FPL and GPX formats

### Demo Scenarios

Pre-recorded flight scenarios for training:

- **Pattern Work**: Takeoff, traffic pattern, landing
- **GPS Approaches**: LNAV, LNAV/VNAV, LPV approaches
- **Cross-Country**: Multi-leg navigation
- **Emergency Procedures**: Engine failure, diversions

## Development Roadmap

See [PLAN.md](PLAN.md) for the comprehensive development plan.

### Phase 1: Foundation (Weeks 1-4)
- Project scaffolding
- Backend/frontend skeleton
- WebSocket communication
- Basic flight model

### Phase 2: Core Avionics (Weeks 5-8)
- PFD display
- Flight physics simulation
- AHRS and ADC
- Input management

### Phase 3: Navigation and MFD (Weeks 9-12)
- MFD display
- Flight plan management
- Map overlays
- Softkey menus

### Phase 4: Autopilot (Weeks 13-16)
- Autopilot implementation
- Approach procedures
- Alert system
- Demo scenarios

### Phase 5: Polish (Weeks 17-20)
- UI refinement
- Performance optimization
- Documentation
- User manual

## Work Organization

This project uses the **Beads** pattern for organizing development work:

- **Epic**: `epic-plan` - Overall project plan
- **Stories**: Individual work items for each component
- See [beads.yaml](beads.yaml) for complete work breakdown

## Documentation

- [Comprehensive Work Plan](PLAN.md) - Detailed architecture and component descriptions
- [User Manual](docs/user-manual.md) - (Coming soon)
- [API Reference](docs/api-reference.md) - (Coming soon)
- [SDK Documentation](docs/sdk-documentation.md) - (Coming soon)
- [Plugin Development Guide](docs/plugin-guide.md) - (Coming soon)

## Testing

```bash
# Run all tests
make test

# Run specific test suites
make test-backend
make test-frontend
make test-integration
make test-e2e
make test-performance
```

**Testing Strategy:**
- Unit tests for backend and frontend
- Integration tests for API and WebSocket
- End-to-end tests for complete flight scenarios
- Performance tests (frame rate, latency, memory)

**Coverage Target**: > 80%

## Security and Compliance

- **Educational Use**: Simulator is for educational purposes only
- **No Proprietary Code**: No reverse-engineered or proprietary Garmin code
- **Open Data**: Uses OurAirports, OpenAIP, and FAA public data
- **Privacy**: No user data collection without consent
- **Accessibility**: WCAG 2.1 AA compliance where practical

## Legal Disclaimer

This is an educational flight simulator inspired by the Garmin G1000 avionics system. It is not affiliated with, endorsed by, or approved by Garmin Ltd. or any of its subsidiaries. This simulator is not approved for use in obtaining flight training credit or for any official aviation purposes.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

### Development Process

1. Review [PLAN.md](PLAN.md) for architecture and component details
2. Check [beads.yaml](beads.yaml) for work organization
3. Pick a story bead to work on
4. Follow the coding standards in [AGENTS.md](../../AGENTS.md)
5. Write tests for your changes
6. Submit a pull request

## License

MIT License - See [LICENSE](../../LICENSE) for details

## Acknowledgments

- **Open Data Sources**: OurAirports, OpenAIP, FAA CIFP
- **Aviation Community**: For feedback and testing
- **Garmin**: For creating the G1000 avionics system that inspired this simulator

## Support

For questions, issues, or feature requests:

- Open an issue in the [Aviation monorepo](https://github.com/jordanhubbard/Aviation/issues)
- Use the beads system: `bd create "Your issue title"`
- Check existing documentation and FAQs

---

**Status**: 🚧 Planning Phase - See [PLAN.md](PLAN.md) for detailed roadmap
