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

        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
        add_shortcode('artasia_atlas', array($this, 'render_shortcode'));
    }

    /**
     * Enqueue CSS and JS assets from the assets folder
     */
    public function enqueue_assets()
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

        // Enqueue CSS files
        foreach ($css_files as $index => $css_file) {
            wp_enqueue_style(
                'artasia-atlas-css-' . $index,
                $css_file,
                array(),
                filemtime($assets_dir . basename($css_file)),
                'all'
            );
        }

        // Enqueue JS files
        foreach ($js_files as $index => $js_file) {
            wp_enqueue_script(
                'artasia-atlas-js-' . $index,
                $js_file,
                array(),
                filemtime($assets_dir . basename($js_file)),
                true // Load in footer
            );
        }
    }

    /**
     * Render the shortcode
     */
    public function render_shortcode($atts = array(), $content = null)
    {
        $atts = shortcode_atts(array(
            'id' => 'artasia-atlas-app',
            'class' => ''
        ), $atts, 'artasia_atlas');

        $id = esc_attr($atts['id']);
        $class = !empty($atts['class']) ? ' class="' . esc_attr($atts['class']) . '"' : '';

        return '<div id="' . $id . '"' . $class . '></div>';
    }
}

// Initialize the plugin
new ArtasiaAtlas();
