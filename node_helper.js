/* Magic Mirror
 * Module: MMM-WienerLinien
 *
 * By fewieden https://github.com/fewieden/MMM-WienerLinien
 * MIT Licensed.
 */

/* eslint-env node */

const request = require('request');
const NodeHelper = require('node_helper');

module.exports = NodeHelper.create({

    baseUrl: 'https://www.wienerlinien.at/ogd_realtime/',

    start() {
        console.log(`Starting module helper: ${this.name}`);
    },

    socketNotificationReceived(notification, payload) {
        if (notification === 'CONFIG') {
            this.config = payload;
            this.getData();
            setInterval(() => {
                this.getData();
            }, this.config.updateInterval);
        }
    },

    getData() {
        const options = {
            url: `${this.baseUrl}monitor?sender=${this.config.api_key}&rbl=${this.config.stations.join('&rbl=')}`
        };

        request(options, (error, response, body) => {
            if (response.statusCode === 200) {
                const parsedBody = JSON.parse(body);
                if (parsedBody.message.value === 'OK') {
                    this.handleData(parsedBody.data.monitors, parsedBody.message.serverTime);
                } else {
                    console.log('Error no WienerLinen data');
                }
            } else {
                console.log(`Error getting WienerLinen data ${response.statusCode}`);
            }
        });

        // Get elevator info
        if (this.config.elevatorStations.length > 0) {
            options.url = `${this.baseUrl}trafficInfoList?sender=${this.config.api_key}&name=aufzugsinfo&relatedStop=${this.config.elevatorStations.join('&relatedStop=')}`;

            this.getAdditionalData(options, 'Elevator');
        }

        // Get incident info
        if (this.config.incidentLines.length > 0) {
            let type = '&name=stoerunglang';
            if (this.config.incidentShort) {
                type += '&name=stoerungkurz';
            }

            options.url = `${this.baseUrl}trafficInfoList?sender=${this.config.api_key}${type}&relatedLine=${this.config.incidentLines.join('&relatedLine=')}`;

            this.getAdditionalData(options, 'Incident');
        }
    },

    getAdditionalData(options, type) {
        request(options, (error, response, body) => {
            if (response.statusCode === 200) {
                const parsedBody = JSON.parse(body);
                if (Object.prototype.hasOwnProperty.call(parsedBody.data, 'trafficInfos')) {
                    this[`handle${type}Data`](parsedBody.data.trafficInfos);
                } else {
                    console.log(`Info: no WienerLinen ${type} data available.`);
                }
            } else {
                console.log(`Error getting WienerLinen ${type} data ${response.statusCode}`);
            }
        });
    },

    handleElevatorData(data) {
        const elevators = [];
        for (let i = 0; i < data.length; i += 1) {
            elevators.push(`${data[i].title}: ${data[i].description}`);
        }
        elevators.sort();

        this.sendSocketNotification('ELEVATORS', elevators);
    },

    handleIncidentData(data) {
        const incidents = [];
        for (let i = 0; i < data.length; i += 1) {
            const lines = data[i].relatedLines.join(', ');
            const description = data[i].description;
            incidents.push({ lines, description });
        }
        incidents.sort((a, b) => {
            const nameA = a.lines.toUpperCase();
            const nameB = b.lines.toUpperCase();
            if (nameA < nameB) {
                return -1;
            } else if (nameA > nameB) {
                return 1;
            }
            return 0;
        });

        this.sendSocketNotification('INCIDENTS', incidents);
    },

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

                    const departureTime = data[i].lines[n].departures.departure[x].departureTime;

		    //Standard barrier free value
		    let barrierFree = data[i].lines[n].barrierFree
		    if(data[i].lines[n].departures.departure[x].vehicle) {
			//barrier free value per vehicle
			barrierFree = data[i].lines[n].departures.departure[x].vehicle.barrierFree
                    }

		    stations[data[i].locationStop.properties.name].departures.push({
                        time: departureTime[Object.prototype.hasOwnProperty.call(departureTime, 'timeReal') ? 'timeReal' : 'timePlanned'],
                        towards: data[i].lines[n].towards,
                        line: data[i].lines[n].name,
                        type: data[i].lines[n].type,
                    	barrierFree,
                    });
                }
                if (metroFlag) {
                    const departureTimePattern = /[0-9]+/g;
                    const departureTimeMatches = data[i].lines[n].towards.match(departureTimePattern).toString().split(',');

                    const towardsPattern = /^[a-zäöüß ]+/i;
                    const towardsMatch = data[i].lines[n].towards.match(towardsPattern).toString().replace(/ {2,}/g, ' ').trim();

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
            stations[keys[i]].departures.sort((a, b) => {
                if (a.time < b.time) {
                    return -1;
                } else if (a.time > b.time) {
                    return 1;
                }
                return 0;
            });
        }

        this.sendSocketNotification('STATIONS', stations);
    }
});
