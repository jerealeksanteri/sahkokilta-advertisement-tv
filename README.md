# Sähkökilta ry Advertisement TV

A professional MagicMirror²-based advertisement display system designed for Sähkökilta ry (Finnish electrical engineering student guild). Features guild branding and rotating sponsor carousel optimized for Raspberry Pi and Info TV displays.

## Features

- **Guild Branding**: Prominent display of Sähkökilta ry visual identity
- **Sponsor Carousel**: Rotating display of sponsor advertisements with smooth transitions
- **Raspberry Pi Optimized**: Efficient performance on Pi hardware with auto-start capabilities
- **TV Display Ready**: Optimized for Info TV displays with responsive layout
- **Hot-Reloading**: Automatic content updates without system restart
- **Professional Architecture**: Modular design with comprehensive testing and logging

## Quick Start

### Prerequisites

- Node.js 16+ and npm 8+
- Raspberry Pi OS (recommended) or any Linux distribution
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sahkokilta/advertisement-tv.git
   cd advertisement-tv
   ```

2. **Install dependencies and MagicMirror²**
   ```bash
   npm run setup
   ```

3. **Configure the system**
   ```bash
   # Copy sample configurations
   cp config/branding.json config/branding.local.json
   cp config/sponsors.json config/sponsors.local.json
   cp config/system.json config/system.local.json
   
   # Edit configurations as needed
   nano config/branding.local.json
   nano config/sponsors.local.json
   ```

4. **Add your assets**
   ```bash
   # Add guild logo
   cp /path/to/sahkokilta-logo.png assets/images/
   
   # Add sponsor logos
   cp /path/to/sponsor-logos/* assets/images/sponsors/
   ```

5. **Start the application**
   ```bash
   npm start
   ```

## Development

### Project Structure

```
sahkokilta-advertisement-tv/
├── modules/                    # MagicMirror² custom modules
│   ├── MMM-SahkokiltaBranding/   # Guild branding module
│   ├── MMM-SponsorCarousel/       # Sponsor carousel module
│   └── MMM-LayoutManager/         # Display layout manager
├── services/                   # Core services
│   ├── ContentService.js          # Content management
│   └── LoggingService.js          # Centralized logging
├── config/                     # Configuration files
│   ├── branding.json             # Guild branding settings
│   ├── sponsors.json             # Sponsor configuration
│   └── system.json               # System settings
├── assets/                     # Static assets
│   └── images/                   # Images and logos
├── tests/                      # Test suites
│   ├── unit/                     # Unit tests
│   └── integration/              # Integration tests
└── logs/                       # Application logs
```

### Development Commands

```bash
# Development
npm run dev                     # Start in development mode
npm run test                    # Run all tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Generate coverage report

# Code Quality
npm run lint                   # Check code style
npm run lint:fix              # Fix linting issues
npm run format                # Format code with Prettier
npm run format:check          # Check code formatting

# Build
npm run build                  # Run linting and tests
```

### Testing

The project includes comprehensive testing with Jest:

- **Unit Tests**: Test individual modules and services
- **Integration Tests**: Test module interactions and data flow
- **Coverage Target**: Minimum 80% code coverage required

```bash
# Run specific test suites
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=integration

# Run tests for specific module
npm test -- modules/MMM-SponsorCarousel
```

### Configuration

#### Branding Configuration (`config/branding.json`)

```json
{
  "logo": {
    "path": "assets/images/sahkokilta-logo.png",
    "position": "top-left",
    "size": { "width": 200, "height": 100 }
  },
  "theme": {
    "colors": {
      "primary": "#0066cc",
      "secondary": "#004499",
      "accent": "#ffcc00"
    }
  }
}
```

#### Sponsor Configuration (`config/sponsors.json`)

```json
{
  "sponsors": [
    {
      "id": "sponsor-1",
      "name": "Sponsor Name",
      "logoPath": "assets/images/sponsors/sponsor-logo.png",
      "displayDuration": 10000,
      "priority": 1,
      "active": true
    }
  ],
  "settings": {
    "defaultDuration": 10000,
    "transitionType": "fade"
  }
}
```

## Deployment

### Raspberry Pi Setup

1. **Install Raspberry Pi OS**
   - Use Raspberry Pi Imager with Raspberry Pi OS Lite
   - Enable SSH and configure WiFi during imaging

2. **System Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Git
   sudo apt install git -y
   ```

3. **Application Deployment**
   ```bash
   # Clone and setup
   git clone https://github.com/sahkokilta/advertisement-tv.git
   cd advertisement-tv
   npm run setup
   
   # Configure for production
   cp config/system.json config/system.local.json
   # Edit system.local.json for your setup
   ```

4. **Auto-start Configuration**
   ```bash
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Start application with PM2
   pm2 start npm --name "advertisement-tv" -- start
   pm2 save
   pm2 startup
   ```

### Display Configuration

For optimal TV display:

1. **Configure display resolution** in `config/system.local.json`
2. **Set up kiosk mode** for fullscreen display
3. **Configure auto-login** for unattended operation

## Troubleshooting

### Common Issues

**Application won't start**
- Check Node.js version: `node --version` (requires 16+)
- Verify MagicMirror² installation: `ls MagicMirror/`
- Check logs: `tail -f logs/application.log`

**Sponsor images not displaying**
- Verify image paths in `config/sponsors.json`
- Check file permissions: `ls -la assets/images/sponsors/`
- Ensure supported formats: PNG, JPG, WebP

**Performance issues on Raspberry Pi**
- Reduce image sizes and optimize formats
- Adjust `displayDuration` in sponsor config
- Monitor system resources: `htop`

### Logs

Application logs are stored in the `logs/` directory:
- `application.log`: General application logs
- `error.log`: Error-specific logs
- `performance.log`: Performance metrics

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Run quality checks: `npm run build`
5. Commit changes: `git commit -m "Add new feature"`
6. Push to branch: `git push origin feature/new-feature`
7. Create a Pull Request

### Code Standards

- Follow ESLint configuration
- Maintain 80%+ test coverage
- Use Prettier for code formatting
- Write clear commit messages
- Document new features

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/sahkokilta/advertisement-tv/issues)
- **Documentation**: [Wiki](https://github.com/sahkokilta/advertisement-tv/wiki)
- **Contact**: Sähkökilta ry IT Team

---

**Sähkökilta ry** - Finnish Electrical Engineering Student Guild