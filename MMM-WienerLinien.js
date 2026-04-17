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
        ptMetro: 'fa-subway',
    },

    /**
     * @member {Object} defaults - Defines the default config values.
     * @property {string} view - Change the view between 'classic' and 'compact'.
     * @property {string[]} lines - Favorite lines to display. Leave empty to display all.
     * @property {string} header - Header that is shown on top of the module. Leave blank to hide.
     * @property {string} displayIcons - Show or hide the icons of the table.
     * @property {int} max - Amount of departure times to display.
     * @property {boolean|number} shortenStation - Maximum characters for station name.
     * @property {boolean|number} shortenDestination - Maximum characters for destination name.
     * @property {int} rotateInterval - Interval of rotation in ms.
     * @property {int} updateInterval - Interval of update in ms.
     * @property {int} animationSpeed - Speed of the template animation in ms.
     * @property {string[]} elevatorStations - Station IDs that should be checked for elevator incidents.
     * @property {string[]} incidentLines - Lines that should be checked for incidents.
     * @property {boolean} incidentShort - Short or long incident description.
     */
    defaults: {
        view: 'classic',
        lines: [],
        header: 'WienerLinien',
        displayIcons: true,
        max: 5,
        shortenStation: false,
        shortenDestination: false,
        rotateInterval: 20 * 1000,
        updateInterval: 5 * 60 * 1000,
        animationSpeed: 300,
        elevatorStations: [],
        incidentLines: [],
        incidentShort: false,
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
            de: 'translations/de.json',
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

        if (this.config.view === 'compact') {
            return this.getCompactView();
        }

        return this.getClassicView();
    },

    /**
     * @function getClassicView
     * @description Get all relevant data for template in classic view mode.
     *
     * @returns {object} Transformed data object for the classic view.
     */
    getClassicView() {
        const keys = Object.keys(this.stations);
        this.maxIndex = keys.length;
        if (this.index >= this.maxIndex) {
            this.index = 0;
        }

        const station = this.stations[keys[this.index]];
        const { name, departures: allDepartures } = station;
        const { lines, max } = this.config;

        const departures = allDepartures
            .filter(dep => lines.length === 0 || lines.includes(dep.line))
            .slice(0, Math.min(allDepartures.length, max));

        return {
            departures,
            name,
            config: this.config,
            elevators: this.elevators,
            incidents: this.incidents,
        };
    },

    /**
     * @function getCompactView
     * @description Get all relevant data for template in compact view mode.
     *
     * @returns {object} Transformed data object for the compact view.
     */
    getCompactView() {
        const stationData = [];

        Object.values(this.stations).forEach(station => {
            const { name, departures: allDepartures } = station;
            const transformed = this.transformDepartures(allDepartures);
            stationData.push({ name, departures: transformed });
        });

        return {
            stationData,
            config: this.config,
            elevators: this.elevators,
            incidents: this.incidents,
        };
    },

    /**
     * @function transformDepartures
     * @description Transform the departures object for the compact view.
     *
     * @param {object} allDepartures - Object of all departures
     * @returns {object} Array of transformed departures.
     */
    transformDepartures(allDepartures) {
        const newData = new Map();
        const { lines, max } = this.config;

        // Filter and accumulate data into the map
        for (const dep of allDepartures) {
            if (lines.length === 0 || lines.includes(dep.line)) {
                const key = JSON.stringify({
                    towards: dep.towards,
                    line: dep.line,
                    type: dep.type,
                });
                if (!newData.has(key)) {
                    newData.set(key, []);
                }
                newData.get(key).push(dep.time);
            }
        }

        // Transform map entries into the final array format
        const transformed = [];
        for (const [key, times] of newData.entries()) {
            transformed.push({
                ...JSON.parse(key),
                time: times.slice(0, max),
            });
        }

        return transformed.sort(
            (a, b) =>
                a.line.localeCompare(b.line)
                || a.towards.localeCompare(b.towards)
        );
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

        if (this.config.view === 'classic') {
            this.maxIndex = this.config.stations.length;
            setInterval(() => {
                this.updateDom(this.config.animationSpeed);
                this.index += 1;
                if (this.index >= this.maxIndex) {
                    this.index = 0;
                }
            }, this.config.rotateInterval);
        }

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
        this.updateDom(this.config.animationSpeed);
    },

    /**
     * @function addFilters
     * @description Adds custom filters used by the nunjuck template.
     *
     * @returns {void}
     */
    addFilters() {
        this.nunjucksEnvironment().addFilter('timeUntil', time =>
            moment().to(time)
        );

        this.nunjucksEnvironment().addFilter(
            'timeShort',
            time => moment(time).diff(moment(), 'minutes') + "'"
        );

        this.nunjucksEnvironment().addFilter('titlecase', text =>
            text.replace(
                /\w\S*/g,
                text =>
                    text.charAt(0).toUpperCase()
                    + text.substring(1).toLowerCase()
            )
        );

        this.nunjucksEnvironment().addFilter(
            'icon',
            type => this.types[type] || 'fa-question'
        );

        this.nunjucksEnvironment().addFilter(
            'isEmpty',
            array => !array || array.length < 1
        );

        this.nunjucksEnvironment().addFilter(
            'shortenText',
            (text, maxLength) => {
                if (!maxLength || text.length < maxLength) {
                    return text;
                }

                return `${text.slice(0, maxLength)}&#8230;`;
            }
        );
    },
});
