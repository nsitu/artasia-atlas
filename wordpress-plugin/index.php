<?php

/**
 * @package Artasia_Atlas
 * @version 1.0
 */
/*
Plugin Name: Artasia Atlas
Plugin URI: https://artsforall.co
Description: A plugin to embed the Artasia Atlas into WordPress via a shortcode.
Author: Harold Sikkema
Version: 1.0
Author URI: https://nsitu.ca
*/

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class ArtasiaAtlas
{

    private $plugin_dir;
    private $plugin_url;

    public function __construct()
    {
        $this->plugin_dir = plugin_dir_path(__FILE__);
        $this->plugin_url = plugin_dir_url(__FILE__);

        add_action('init', array($this, 'register_assets'));
        add_shortcode('artasia_atlas', array($this, 'render_shortcode'));
    }

    /**
     * Register CSS and JS assets
     */
    public function register_assets()
    {
        $assets_dir = $this->plugin_dir . 'assets/';

        // Check if assets directory exists
        if (!is_dir($assets_dir)) {
            return;
        }

        // Scan assets directory for CSS and JS files
        $assets_files = scandir($assets_dir);

        if (!$assets_files) {
            return;
        }

        $css_files = array();
        $js_files = array();

        foreach ($assets_files as $file) {
            if ($file === '.' || $file === '..') {
                continue;
            }

            $file_path = $assets_dir . $file;
            $file_url = $this->plugin_url . 'assets/' . $file;

            if (is_file($file_path)) {
                if (pathinfo($file, PATHINFO_EXTENSION) === 'css') {
                    $css_files[] = $file_url;
                } elseif (pathinfo($file, PATHINFO_EXTENSION) === 'js') {
                    $js_files[] = $file_url;
                }
            }
        }

        // Register CSS files
        foreach ($css_files as $index => $css_file) {
            wp_register_style(
                'artasia-atlas-css-' . $index,
                $css_file,
                array(),
                filemtime($assets_dir . basename($css_file)),
                'all'
            );
        }

        // Register JS files and localize with CSV URL
        foreach ($js_files as $index => $js_file) {
            wp_register_script(
                'artasia-atlas-js-' . $index,
                $js_file,
                array(),
                filemtime($assets_dir . basename($js_file)),
                true // Load in footer
            );

            // Localize the script with data needed by JavaScript
            wp_localize_script(
                'artasia-atlas-js-' . $index,
                'artasiaAtlasData',
                array(
                    'csvUrl' => $this->plugin_url . 'sites.csv',
                    'pluginUrl' => $this->plugin_url
                )
            );
        }
    }

    /**
     * Render the shortcode
     */
    public function render_shortcode($atts = array(), $content = null)
    {
        // Enqueue assets when shortcode is rendered
        $this->enqueue_assets();

        $atts = shortcode_atts(array(
            'class' => ''
        ), $atts, 'artasia_atlas');

        $class = !empty($atts['class']) ? ' class="' . esc_attr($atts['class']) . '"' : '';

        return '<div id="artasia-atlas-app"' . $class . '></div>';
    }

    /**
     * Enqueue registered assets
     */
    private function enqueue_assets()
    {
        // Get all registered styles and scripts
        global $wp_styles, $wp_scripts;

        // Enqueue all registered CSS files for this plugin
        if (isset($wp_styles->registered)) {
            foreach ($wp_styles->registered as $handle => $style) {
                if (strpos($handle, 'artasia-atlas-css-') === 0) {
                    wp_enqueue_style($handle);
                }
            }
        }

        // Enqueue all registered JS files for this plugin
        if (isset($wp_scripts->registered)) {
            foreach ($wp_scripts->registered as $handle => $script) {
                if (strpos($handle, 'artasia-atlas-js-') === 0) {
                    wp_enqueue_script($handle);
                }
            }
        }
    }
}

// Initialize the plugin
new ArtasiaAtlas();
