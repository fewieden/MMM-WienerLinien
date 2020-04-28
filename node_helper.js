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
 * @external node_helper
 * @see https://github.com/MichMich/MagicMirror/blob/master/js/node_helper.js
 */
const NodeHelper = require('node_helper');

/**
 * @module node_helper
 * @description Backend for the module to query data from the API provider.
 *
 * @requires external:node-fetch
 * @requires external:node_helper
 */
module.exports = NodeHelper.create({
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
            this.getData();
            setInterval(async () => {
                await this.getData();
            }, this.config.updateInterval);
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

        if (this.config.elevatorStations.length > 0) {
            const url = `${this.baseUrl}/trafficInfoList?name=aufzugsinfo&relatedStop=${this.config.elevatorStations.join('&relatedStop=')}`;

            await this.getAdditionalData(url, 'Elevator');
        }

        if (this.config.incidentLines.length > 0) {
            const incidentType = this.config.incidentShort ? 'stoerungkurz' : 'stoerunglang';
            const url = `${this.baseUrl}/trafficInfoList?name=${incidentType}&relatedLine=${this.config.incidentLines.join('&relatedLine=')}`;

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
            const response = await fetch(`${this.baseUrl}/monitor?rbl=${this.config.stations.join('&rbl=')}`);
            const parsedBody = await response.json();

            if (parsedBody.message.value === 'OK') {
                this.handleData(parsedBody.data.monitors, parsedBody.message.serverTime);
            } else {
                throw new Error('No WienerLinien data');
            }
        } catch (e) {
            console.log('Error getting WienerLinien station data:', e);
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

            if (Object.prototype.hasOwnProperty.call(parsedBody.data, 'trafficInfos')) {
                this[`handle${type}Data`](parsedBody.data.trafficInfos);
            } else {
                throw new Error('No WienerLinien data');
            }
        } catch (e) {
            console.log(`Error getting WienerLinien data for type ${type}:`, e);
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
        const elevators = data
            .map(({ title, description }) => `${title}: ${description}`)
            .sort();

        this.sendSocketNotification('ELEVATORS', elevators);
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
        const incidents = data
            .map(({ relatedLines, description }) => ({
                description,
                lines: relatedLines.join(', ')
            }))
            .sort((a, b) => a.lines.localeCompare(b.lines));

        this.sendSocketNotification('INCIDENTS', incidents);
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

        for (let i = 0; i < data.length; i += 1) {
            if (!Object.prototype.hasOwnProperty.call(stations, data[i].locationStop.properties.name)) {
                stations[data[i].locationStop.properties.name] = {
                    name: data[i].locationStop.properties.title,
                    departures: []
                };
            }
            for (let n = 0; n < data[i].lines.length; n += 1) {
                let metroFlag = false;
                for (let x = 0; x < data[i].lines[n].departures.departure.length; x += 1) {
                    if (Object.keys(data[i].lines[n].departures.departure[x].departureTime).length === 0) {
                        metroFlag = true;
                        break;
                    }

                    const { departureTime } = data[i].lines[n].departures.departure[x];

                    stations[data[i].locationStop.properties.name].departures.push({
                        time: departureTime[Object.prototype.hasOwnProperty.call(departureTime, 'timeReal') ? 'timeReal' : 'timePlanned'],
                        towards: data[i].lines[n].towards,
                        line: data[i].lines[n].name,
                        type: data[i].lines[n].type
                    });
                }
                if (metroFlag) {
                    const departureTimePattern = /[0-9]+/g;
                    const departureTimeMatches = data[i].lines[n].towards.match(departureTimePattern).toString()
                        .split(',');

                    const towardsPattern = /^[a-zäöüß ]+/i;
                    const towardsMatch = data[i].lines[n].towards.match(towardsPattern).toString()
                        .replace(/ {2,}/g, ' ')
                        .trim();

                    for (let x = 0; x < departureTimeMatches.length; x += 1) {
                        const datetime = new Date(time);
                        datetime.setSeconds(0);
                        datetime.setMinutes(datetime.getMinutes() + departureTimeMatches[x]);

                        stations[data[i].locationStop.properties.name].departures.push({
                            time: datetime,
                            towards: towardsMatch,
                            line: data[i].lines[n].name,
                            type: data[i].lines[n].type
                        });
                    }
                }
            }
        }

        const keys = Object.keys(stations);

        for (let i = 0; i < keys.length; i += 1) {
            stations[keys[i]].departures.sort((a, b) => a.time - b.time);
        }

        this.sendSocketNotification('STATIONS', stations);
    }
});
