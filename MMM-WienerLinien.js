/* eslint-disable block-scoped-var */
/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-var */
/* eslint-disable vars-on-top */
/* Magic Mirror
 * Module: MMM-WienerLinien
 *
 * By fewieden https://github.com/fewieden/MMM-WienerLinien
 * MIT Licensed.
 */

/* global Module Log moment config */

Module.register('MMM-WienerLinien', {

    index: 0,

    types: {
        ptBusCity: 'fa-bus',
        ptTram: 'fa-train',
        ptTramWLB: 'fa-train',
        ptMetro: 'fa-subway'
    },

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

    getTranslations() {
        return {
            en: 'translations/en.json',
            de: 'translations/de.json'
        };
    },

    getScripts() {
        return ['moment.js'];
    },

    getStyles() {
        return ['font-awesome.css', 'MMM-WienerLinien.css'];
    },

    start() {
        Log.info(`Starting module: ${this.name}`);
        moment.locale(config.language);
        this.maxIndex = this.config.stations.length;
        var self = this;
        setInterval(function () {
            self.updateDom(300);
            self.index += 1;
            if (self.index >= self.maxIndex) {
                self.index = 0;
            }
        }, self.config.rotateInterval);
        this.sendSocketNotification('CONFIG', this.config);
    },

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

    getDom() {
        const wrapper = document.createElement('div');
        const header = document.createElement('header');
        header.classList.add('align-left');
        const logo = document.createElement('i');
        logo.classList.add('fa', 'fa-bus', 'logo');
        header.appendChild(logo);
        const name = document.createElement('span');
        name.innerHTML = 'WienerLinien';
        header.appendChild(name);
        wrapper.appendChild(header);

        if (!this.stations) {
            const text = document.createElement('div');
            text.innerHTML = this.translate('LOADING');
            text.classList.add('dimmed', 'light');
            wrapper.appendChild(text);
        } else {
            const keys = Object.keys(this.stations);
            this.maxIndex = keys.length;
            if (this.index >= this.maxIndex) {
                this.index = 0;
            }

            const station = document.createElement('div');
            station.classList.add('align-left');
            station.innerHTML = this.shortenText(this.stations[keys[this.index]].name, this.config.shortenStation);
            wrapper.appendChild(station);

            if (this.config.display === 'matrix') {
                const table = document.createElement('table');
                table.classList.add('small', 'table', 'align-left');

                table.appendChild(this.createLabelRow());

                // Parse data into destinations and time
                // Rough structure: {destString: {type, line,destination, [times]}}
                var dataTable = {};
                this.stations[keys[this.index]].departures.forEach(function (departure) {
                    var destString = `${departure.line} ${departure.towards}`;
                    const dt = {
                        time: departure.time,
                        barrierFree: departure.barrierFree,
                    };

                    if (dataTable[destString] === undefined) {
                        var dest = {
                            type: departure.type,
                            line: departure.line,
                            towards: departure.towards,
                            times: [dt]
                        };
                        dataTable[destString] = dest;
                    } else {
                        dataTable[destString].times.push(dt);
                    }
                });

                const dataKeys = Object.keys(dataTable).sort();
                for (var j = 0; j < dataKeys.length; j += 1) {
                    var destString = dataKeys[j];
                    var data = dataTable[destString];

                    const row = document.createElement('tr');

                    const type = document.createElement('td');
                    type.classList.add('centered');
                    const typeIcon = document.createElement('i');
                    typeIcon.classList.add('fa', Object.prototype.hasOwnProperty.call(this.types, data.type) ? this.types[data.type] : 'fa-question');
                    type.appendChild(typeIcon);
                    row.appendChild(type);

                    const line = document.createElement('td');
                    line.classList.add('centered');
                    line.innerHTML = data.line;
                    row.appendChild(line);

                    const towards = document.createElement('td');
                    towards.innerHTML = this.shortenText(data.towards, this.config.shortenDestination);
                    row.appendChild(towards);

                    var shown = 0;
                    for (var t = 0; t < data.times.length && shown < this.config.max; t += 1) {
                        const dt = data.times[t];
                        const time = document.createElement('td');
                        time.classList.add('align-right');
                        const delta = moment(dt.time) - moment();
                        // Time in minutes
                        const deltaString = Math.round(delta / 1000 / 60);

                        if(delta > 0) {
                            if (dt.barrierFree) {
                                const u = document.createElement('u');
                                u.innerHTML = deltaString;
                                time.appendChild(u);
                            } else {
                                time.innerHTML = deltaString;
                            }
                        row.appendChild(time);
                        shown += 1;
                        }
                    }
                    table.appendChild(row);
                }
                wrapper.appendChild(table);
            } else {
                const table = document.createElement('table');
                table.classList.add('small', 'table', 'align-left');

                table.appendChild(this.createLabelRow());

                for (var i = 0; i < Math.min(this.stations[keys[this.index]].departures.length, this.config.max); i += 1) {
                    this.appendDataRow(this.stations[keys[this.index]].departures[i], table);
                }

                wrapper.appendChild(table);
            }
        }

        // Create section for line and elevator incidents
        const incidentSection = document.createElement('div');
        const incidentTitle = document.createElement('div');
        incidentTitle.classList.add('align-left', 'small', 'incidents');
        const incidentList = document.createElement('table');
        incidentList.classList.add('align-left', 'table', 'xsmall');

        if ((this.incidents && this.incidents.length > 0) || (this.elevators && this.elevators.length > 0)) {
            incidentTitle.innerHTML = this.translate('INCIDENTS');
            // Elevator disruption info
            if (this.elevators && this.elevators.length > 0) {
                this.appendIncidentData(incidentList, 'elevators');
            }

            // Line incident info
            if (this.incidents && this.incidents.length > 0) {
                this.appendIncidentData(incidentList, 'incidents');
            }
            incidentSection.appendChild(incidentList);
        } else {
            incidentTitle.innerHTML = this.translate('NO_INCIDENTS');
        }

        incidentSection.appendChild(incidentTitle);
        incidentSection.appendChild(incidentList);
        wrapper.appendChild(incidentSection);

        return wrapper;
    },

    createLabelRow() {
        const labelRow = document.createElement('tr');

        const typeIconLabel = document.createElement('th');
        typeIconLabel.classList.add('centered');
        const typeIcon = document.createElement('i');
        typeIcon.classList.add('fa', 'fa-info');
        typeIconLabel.appendChild(typeIcon);
        labelRow.appendChild(typeIconLabel);

        const lineIconLabel = document.createElement('th');
        lineIconLabel.classList.add('centered');
        const lineIcon = document.createElement('i');
        lineIcon.classList.add('fa', 'fa-tag');
        lineIconLabel.appendChild(lineIcon);
        labelRow.appendChild(lineIconLabel);

        const directionIconLabel = document.createElement('th');
        directionIconLabel.classList.add('centered');
        const directionIcon = document.createElement('i');
        directionIcon.classList.add('fa', 'fa-compass');
        directionIconLabel.appendChild(directionIcon);
        labelRow.appendChild(directionIconLabel);

        const timeIconLabel = document.createElement('th');
        timeIconLabel.classList.add('centered');
        const timeIcon = document.createElement('i');
        timeIcon.classList.add('fa', 'fa-clock-o');
        timeIconLabel.appendChild(timeIcon);
        labelRow.appendChild(timeIconLabel);

        return labelRow;
    },

    appendDataRow(data, appendTo) {
        const row = document.createElement('tr');

        const type = document.createElement('td');
        type.classList.add('centered');
        const typeIcon = document.createElement('i');
        typeIcon.classList.add('fa', Object.prototype.hasOwnProperty.call(this.types, data.type) ? this.types[data.type] : 'fa-question');
        type.appendChild(typeIcon);
        row.appendChild(type);

        const line = document.createElement('td');
        line.classList.add('centered');
        line.innerHTML = data.line;
        if (data.barrierFree) {
            const icon = document.createElement('i');
            icon.classList.add('fa', 'fa-wheelchair');
            line.append(icon);
        }
        row.appendChild(line);

        const towards = document.createElement('td');
        towards.innerHTML = this.shortenText(data.towards, this.config.shortenDestination);
        row.appendChild(towards);

        const time = document.createElement('td');
        time.classList.add('align-left');
        time.innerHTML = moment().to(data.time);
        row.appendChild(time);

        appendTo.appendChild(row);
    },

    appendIncidentData(appendTo, type) {
        for (var i = 0; i < this[type].length; i += 1) {
            const row = document.createElement('tr');

            const typeColumn = document.createElement('td');
            typeColumn.classList.add('centered');
            if (type === 'elevators') {
                const typeIcon = document.createElement('i');
                typeIcon.classList.add('fa', 'fa-wheelchair');
                typeColumn.appendChild(typeIcon);
            } else {
                typeColumn.innerHTML = this[type][i].lines;
            }
            row.appendChild(typeColumn);

            const description = document.createElement('td');
            description.classList.add('align-left');
            if (type === 'elevators') {
                description.innerHTML = this[type][i];
            } else {
                description.innerHTML = this[type][i].description;
            }
            row.appendChild(description);

            appendTo.appendChild(row);
        }
    },

    shortenText(text, option) {
        var temp = text;

        if (option && temp.length > option) {
            temp = `${temp.slice(0, option)}&#8230;`;
        }
        return temp;
    }
});
