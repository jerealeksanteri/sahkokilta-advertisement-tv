# Adding Sponsors to Sähkökilta Advertisement TV

## Quick Start

To add sponsors to the advertisement TV, you need to:

1. **Add sponsor logos** to the `assets/images/sponsors/` directory
2. **Update the configuration** in `config/sponsors.json`
3. **The system will automatically reload** the new sponsors

## Step-by-Step Guide

### 1. Add Sponsor Logo Files

Place sponsor logo files in the `assets/images/sponsors/` directory:

```
assets/images/sponsors/
├── company-a-logo.png
├── company-b-logo.svg
├── sponsor-brand.jpg
└── ...
```

**Logo Requirements:**

- **Formats**: PNG, JPG, SVG, WebP
- **Resolution**: 1920x1080 or higher recommended
- **File size**: Under 2MB for best performance
- **Background**: Transparent PNG preferred
- **Quality**: High resolution for TV display

### 2. Update Sponsor Configuration

Edit `config/sponsors.json` to add your sponsors:

```json
{
  "sponsors": [
    {
      "id": "unique-sponsor-id",
      "name": "Sponsor Company Name",
      "logoPath": "assets/images/sponsors/company-logo.png",
      "displayDuration": 10000,
      "priority": 1,
      "active": true,
      "metadata": {
        "addedDate": "2024-01-15",
        "contactInfo": "contact@company.com",
        "expiryDate": "2024-12-31"
      }
    }
  ],
  "settings": {
    "defaultDuration": 10000,
    "transitionType": "fade",
    "transitionDuration": 1000,
    "shuffleOrder": false,
    "respectPriority": true,
    "autoReload": true
  }
}
```

### 3. Sponsor Configuration Fields

#### Required Fields:

- **`id`**: Unique identifier for the sponsor
- **`name`**: Display name of the sponsor
- **`logoPath`**: Path to the logo file
- **`active`**: Whether to show this sponsor (true/false)

#### Optional Fields:

- **`displayDuration`**: How long to show (milliseconds, default: 10000)
- **`priority`**: Display order (1 = highest priority)
- **`metadata`**: Additional information (contact, dates, etc.)

### 4. Display Settings

Configure how sponsors are displayed:

- **`defaultDuration`**: Default display time (10000ms = 10 seconds)
- **`transitionType`**: Animation type ("fade", "slide", "zoom")
- **`transitionDuration`**: Animation speed (1000ms = 1 second)
- **`shuffleOrder`**: Randomize sponsor order (true/false)
- **`respectPriority`**: Show by priority order (true/false)
- **`autoReload`**: Automatically reload when config changes (true/false)

## Examples

### Adding a New Sponsor

1. Save logo as `assets/images/sponsors/newcompany-logo.png`

2. Add to `config/sponsors.json`:

```json
{
  "id": "newcompany-2024",
  "name": "New Company Ltd",
  "logoPath": "assets/images/sponsors/newcompany-logo.png",
  "displayDuration": 12000,
  "priority": 1,
  "active": true,
  "metadata": {
    "addedDate": "2024-03-15",
    "contactInfo": "marketing@newcompany.fi",
    "expiryDate": "2024-12-31"
  }
}
```

3. The system will automatically reload and show the new sponsor!

### Temporarily Hiding a Sponsor

Set `"active": false` in the sponsor configuration:

```json
{
  "id": "temporary-sponsor",
  "name": "Temporary Sponsor",
  "logoPath": "assets/images/sponsors/temp-logo.png",
  "active": false,
  "metadata": {
    "note": "Temporarily disabled for maintenance"
  }
}
```

### Changing Display Order

Use the `priority` field (1 = highest priority):

```json
{
  "sponsors": [
    {
      "id": "main-sponsor",
      "name": "Main Sponsor",
      "priority": 1
    },
    {
      "id": "secondary-sponsor",
      "name": "Secondary Sponsor",
      "priority": 2
    }
  ]
}
```

## Hot Reloading

The system automatically watches for changes to:

- `config/sponsors.json`
- Files in `assets/images/sponsors/`

Changes are applied within 30 seconds without restarting the application.

## Troubleshooting

### Sponsor Not Showing

- Check that `"active": true`
- Verify the logo file path is correct
- Ensure the logo file exists and is readable
- Check the console for error messages

### Logo Not Loading

- Verify file format is supported (PNG, JPG, SVG, WebP)
- Check file permissions
- Ensure file size is under 2MB
- Try a different image format

### Configuration Errors

- Validate JSON syntax using a JSON validator
- Check that all required fields are present
- Ensure `id` values are unique
- Verify file paths use forward slashes

## File Structure

```
project/
├── config/
│   └── sponsors.json          # Sponsor configuration
├── assets/
│   └── images/
│       └── sponsors/          # Sponsor logo files
│           ├── company-a.png
│           ├── company-b.svg
│           └── ...
└── docs/
    └── adding-sponsors.md     # This documentation
```

## Need Help?

- Check the application logs for error messages
- Validate your JSON configuration
- Ensure logo files are in the correct directory
- Test with a simple sponsor first before adding multiple sponsors
