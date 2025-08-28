# Artasia Atlas WordPress Plugin

This is a WordPress plugin that embeds the Artasia Atlas interactive visualization into WordPress pages using a shortcode.

## Installation

1. Build the project using `npm run build` (this creates the `dist` folder)
2. Copy the entire `dist` folder to your WordPress `wp-content/plugins/` directory
3. Rename the `dist` folder to `artasia-atlas` (or any name you prefer)
4. Activate the plugin in WordPress admin under Plugins

## Usage

Add the shortcode `[artasia_atlas]` to any WordPress page or post to embed the atlas.

### Shortcode Options

- `id`: Custom ID for the container div (default: "artasia-atlas-app")
- `class`: Additional CSS classes for the container

Example:
```
[artasia_atlas id="my-atlas" class="custom-atlas"]
```

## File Structure

The plugin automatically detects and enqueues all CSS and JS files from the `assets/` folder. The `sites.csv` data file should remain in the plugin root directory for the JavaScript to access it.

## Development

To update the plugin:

1. Make changes to the source code
2. Run `npm run build`
3. Copy the new `dist` folder contents to your WordPress plugins directory
4. The plugin will automatically use the updated assets
