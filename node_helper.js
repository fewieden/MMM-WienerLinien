/**
 * @file node_helper.js
 *
 * @author fewieden
 * @license MIT
 *
 * @see  https://github.com/fewieden/MMM-WienerLinien
 */

/**
 * @external node-fetch
 * @see https://www.npmjs.com/package/node-fetch
 */
const fetch = require('node-fetch');

/**
 * @external lodash
 * @see https://www.npmjs.com/package/lodash
 */
const _ = require('lodash');

/**
 * @external node_helper
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/node_helper.js
 */
const NodeHelper = require('node_helper');

/**
 * @external logger
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/logger.js
 */
const Log = require('logger');

/**
 * @module node_helper
 * @description Backend for the module to query data from the API provider.
 *
 * @requires external:node-fetch
 * @requires external:lodash
 * @requires external:node_helper
 * @requires external:logger
 */
module.exports = NodeHelper.create({
    /** @member {string} requiresVersion - Specifies minimum required version of MagicMirror². */
    requiresVersion: '2.15.0',

    /** @member {string} baseUrl - Base URL of the API of the data provider. */
    baseUrl: 'https://www.wienerlinien.at/ogd_realtime',

    /**
     * @function socketNotificationReceived
     * @description Receives socket notifications from the module.
     * @async
     * @override
     *
     * @param {string} notification - Notification name
     * @param {*} payload - Detailed payload of the notification.
     *
     * @returns {void}
     */
    socketNotificationReceived(notification, payload) {
        if (notification === 'CONFIG') {
            this.config = payload;
            setInterval(() => {
                this.getData();
            }, this.config.updateInterval);
            this.getData();
        }
    },

    /**
     * @function getData
     * @description Wrapper for all required data set requests.
     * @async
     *
     * @returns {void}
     */
    async getData() {
        await this.getMonitoringData();

        if (!_.isEmpty(this.config.elevatorStations)) {
            const url = `${this.baseUrl}/trafficInfoList?name=aufzugsinfo&relatedStop=${_.join(this.config.elevatorStations, '&relatedStop=')}`;

            await this.getAdditionalData(url, 'Elevator');
        }

        if (!_.isEmpty(this.config.incidentLines.length)) {
            const incidentType = this.config.incidentShort ? 'stoerungkurz' : 'stoerunglang';
            const url = `${this.baseUrl}/trafficInfoList?name=${incidentType}&relatedLine=${_.join(this.config.incidentLines, '&relatedLine=')}`;

            await this.getAdditionalData(url, 'Incident');
        }
    },

    /**
     * @function getMonitoringData
     * @description Requests departures of stations from monitoring service.
     * @async
     *
     * @returns {void}
     */
    async getMonitoringData() {
        try {
            const response = await fetch(`${this.baseUrl}/monitor?stopId=${_.join(this.config.stations, '&stopId=')}`);
            const parsedBody = await response.json();

            if (_.get(parsedBody, 'message.value') === 'OK') {
                this.handleData(parsedBody.data.monitors, parsedBody.message.serverTime);
            } else {
                throw new Error('No WienerLinien data');
            }
        } catch (e) {
            Log.error('Error getting WienerLinien station data:', e);
        }
    },

    /**
     * @function getAdditionalData
     * @description Requests additional data for incidents lines/elevators.
     * @async
     *
     * @param {string} url - URL to API endpoint
     * @param {string} type - Incident type
     *
     * @returns {void}
     */
    async getAdditionalData(url, type) {
        try {
            const response = await fetch(url);
            const parsedBody = await response.json();

            if (_.has(parsedBody.data, 'trafficInfos')) {
                this[`handle${type}Data`](parsedBody.data.trafficInfos);
            } else {
                throw new Error('No WienerLinien data');
            }
        } catch (e) {
            Log.error(`Error getting WienerLinien data for type ${type}:`, e);
        }
    },

    /**
     * @function handleElevatorData
     * @description Maps elevator response and sends it to the module via socket notification.
     *
     * @param {object[]} data - Response from API
     *
     * @returns {void}
     */
    handleElevatorData(data = []) {
        const mappedElevators = _.map(data, ({ title, description }) => `${title}: ${description}`);
        const sortedElevators = _.sortBy(mappedElevators);

        this.sendSocketNotification('ELEVATORS', sortedElevators);
    },

    /**
     * @function handleIncidentData
     * @description Maps incident response and sends it to the module via socket notification.
     *
     * @param {object[]} data - Response from API
     *
     * @returns {void}
     */
    handleIncidentData(data = []) {
        const mappedIncidents = _.map(data, ({ relatedLines, description }) => ({
            description,
            lines: _.join(relatedLines, ', ')
        }));
        const sortedIncidents = _.sortBy(mappedElevators, 'lines');

        this.sendSocketNotification('INCIDENTS', sortedIncidents);
    },

    /**
     * @function handleData
     * @description Maps station departure response and sends it to the module via socket notification.
     *
     * @param {object[]} data - Response from API
     * @param {string} time - server time
     *
     * @returns {void}
     */
    handleData(data, time) {
        const stations = {};

        for (const entry of data) {
            const stationName = _.get(entry, 'locationStop.properties.name');
            if (!_.has(stations, stationName)) {
                stations[stationName] = { name: _.get(entry, 'locationStop.properties.title'), departures: [] };
            }

            for (const {departures, name, towards, type} of entry.lines) {
                let metroFlag = false;

                for (const departure of departures.departure) {
                    if (_.isEmpty(_.keys(departure.departureTime))) {
                        metroFlag = true;
                        break;
                    }

                    const departureTimeProp = _.has(departure.departureTime, 'timeReal') ? 'timeReal' : 'timePlanned';

                    stations[stationName].departures.push({time: departure.departureTime[departureTimeProp], towards, line: name, type});
                }

                if (metroFlag) {
                    const departureTimePattern = /[0-9]+/g;
                    const departureTimeMatches = _.split(towards.match(departureTimePattern).toString(), ',');

                    const towardsPattern = /^[a-zäöüß ]+/i;
                    const towardsMatch = _.trim(_.replace(towards.match(towardsPattern).toString(), / {2,}/g, ' '));

                    for (const timeMatch of departureTimeMatches) {
                        const datetime = new Date(time);
                        datetime.setSeconds(0);
                        datetime.setMinutes(datetime.getMinutes() + timeMatch);

                        stations[stationName].departures.push({
                            time: datetime,
                            towards: towardsMatch,
                            line: name,
                            type
                        });
                    }
                }
            }
        }

        for (const stationName in stations) {
            stations[stationName].departures = _.sortBy(stations[stationName].departures, 'time');
        }

        this.sendSocketNotification('STATIONS', stations);
    }
});
