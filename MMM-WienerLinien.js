
/**
 * @file MMM-WienerLinien.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-WienerLinien
 */

/* global Module Log moment config */

/**
 * @external Module
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/module.js
 */

/**
 * @external Log
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/logger.js
 */

/**
 * @external moment
 * @see https://www.npmjs.com/package/moment
 */

/**
 * @module MMM-WienerLinien
 * @description Frontend for the module to display data.
 *
 * @requires external:Module
 * @requires external:Log
 * @requires external:moment
 */
Module.register('MMM-WienerLinien', {
    /** @member {number} index - Is used to determine which station gets rendered. */
    index: 0,

    /** @member {Object} types - Mapping of transportation types to icons. */
    types: {
        ptBusCity: 'fa-bus',
        ptBusNight: 'fa-bus',
        ptTram: 'fa-train',
        ptTramWLB: 'fa-train',
        ptMetro: 'fa-subway'
    },

    /**
     * @member {Object} defaults - Defines the default config values.
     * @property {int} max - Amount of departure times to display.
     * @property {boolean|number} shortenStation - Maximum characters for station name.
     * @property {boolean|number} shortenDestination - Maximum characters for destination name.
     * @property {int} rotateInterval - Speed of rotation.
     * @property {int} updateInterval - Speed of update.
     * @property {string[]} elevatorStations - Station IDs that should be checked for elevator incidents.
     * @property {string[]} incidentLines - Lines that should be checked for incidents.
     * @property {boolean} incidentShort - Short or long incident description.
     */
    defaults: {
        max: 5,
        shortenStation: false,
        shortenDestination: false,
        rotateInterval: 20 * 1000,
        updateInterval: 5 * 60 * 1000,
        elevatorStations: [],
        incidentLines: [],
        incidentShort: false
    },

    /**
     * @function getTranslations
     * @description Translations for this module.
     * @override
     *
     * @returns {Object.<string, string>} Available translations for this module (key: language code, value: filepath).
     */
    getTranslations() {
        return {
            en: 'translations/en.json',
            de: 'translations/de.json'
        };
    },

    /**
     * @function getScripts
     * @description Script dependencies for this module.
     * @override
     *
     * @returns {string[]} List of the script dependency filepaths.
     */
    getScripts() {
        return ['moment.js'];
    },

    /**
     * @function getStyles
     * @description Style dependencies for this module.
     * @override
     *
     * @returns {string[]} List of the style dependency filepaths.
     */
    getStyles() {
        return ['font-awesome.css', 'MMM-WienerLinien.css'];
    },

    /**
     * @function getTemplate
     * @description Nunjuck template.
     * @override
     *
     * @returns {string} Path to nunjuck template.
     */
    getTemplate() {
        return 'templates/MMM-WienerLinien.njk';
    },

    /**
     * @function getTemplateData
     * @description Dynamic data that gets rendered in the nunjuck template.
     * @override
     *
     * @returns {object} Data for the nunjuck template.
     */
    getTemplateData() {
        if (!this.stations) {
            return {};
        }

        const keys = Object.keys(this.stations);
        this.maxIndex = keys.length;
        if (this.index >= this.maxIndex) {
            this.index = 0;
        }

        const station = this.stations[keys[this.index]];
        const { name, departures: allDepartures } = station;
        const departures = allDepartures.slice(0, Math.min(allDepartures.length, this.config.max));

        return {
            departures,
            name,
            config: this.config,
            elevators: this.elevators,
            incidents: this.incidents
        };
    },

    /**
     * @function start
     * @description Sets nunjuck filters and starts station rotation interval.
     * @override
     *
     * @returns {void}
     */
    start() {
        Log.info(`Starting module: ${this.name}`);
        moment.locale(config.language);

        this.maxIndex = this.config.stations.length;
        setInterval(() => {
            this.updateDom(300);
            this.index += 1;
            if (this.index >= this.maxIndex) {
                this.index = 0;
            }
        }, this.config.rotateInterval);

        this.sendSocketNotification('CONFIG', this.config);

        this.addFilters();
    },

    /**
     * @function socketNotificationReceived
     * @description Handles incoming messages from node_helper.
     * @override
     *
     * @param {string} notification - Notification name
     * @param {*} payload - Detailed payload of the notification.
     */
    socketNotificationReceived(notification, payload) {
        if (notification === 'STATIONS') {
            this.stations = payload;
        } else if (notification === 'ELEVATORS') {
            this.elevators = payload;
        } else if (notification === 'INCIDENTS') {
            this.incidents = payload;
        }
        this.updateDom(300);
    },

    /**
     * @function addFilters
     * @description Adds custom filters used by the nunjuck template.
     *
     * @returns {void}
     */
    addFilters() {
        this.nunjucksEnvironment().addFilter('timeUntil', time => moment().to(time));

        this.nunjucksEnvironment().addFilter('icon', type => this.types[type] || 'fa-question');

        this.nunjucksEnvironment().addFilter('isEmpty', array => !array || array.length < 1);

        this.nunjucksEnvironment().addFilter('shortenText', (text, maxLength) => {
            if (!maxLength || text.length < maxLength) {
                return text;
            }

            return `${text.slice(0, maxLength)}&#8230;`;
        });
    }
});
