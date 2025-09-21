/* MagicMirror² Config Sample
 *
 * For more information on how you can configure this file
 * see https://docs.magicmirror.builders/configuration/introduction.html
 * and https://docs.magicmirror.builders/modules/configuration.html
 */
let config = {
  address: 'localhost', // Address to listen on, can be:
  port: 8080,
  basePath: '/', // The URL path where MagicMirror² is hosted. If you're using a Reverse proxy
  ipWhitelist: ['127.0.0.1', '::ffff:127.0.0.1', '::1'], // Set [] to allow all IP addresses

  useHttps: false, // Support HTTPS or not, default "false" will use HTTP
  httpsPrivateKey: '', // HTTPS private key path, only require when useHttps is true
  httpsCertificate: '', // HTTPS Certificate path, only require when useHttps is true

  language: 'en',
  locale: 'en-US',
  logLevel: ['INFO', 'LOG', 'WARN', 'ERROR'], // Add "DEBUG" for even more logging
  timeFormat: 24,
  units: 'metric',

  modules: [
    {
      module: 'MMM-SahkokiltaBranding',
      position: 'top_left',
      config: {
        configPath: 'config/branding.json',
        updateInterval: 60000, // Check for config updates every minute
      },
    },
    {
      module: 'MMM-SponsorCarousel',
      position: 'middle_center',
      config: {
        configPath: 'config/sponsors.json',
        updateInterval: 30000, // Check for config updates every 30 seconds
      },
    },
    {
      module: 'MMM-LayoutManager',
      position: 'fullscreen_below',
      config: {
        configPath: 'config/system.json',
        displayMode: 'tv',
      },
    },
  ],
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== 'undefined') {
  module.exports = config;
}