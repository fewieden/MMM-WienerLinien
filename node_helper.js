/* Magic Mirror
 * Module: MMM-WienerLinien
 *
 * By fewieden https://github.com/fewieden/MMM-WienerLinien
 * MIT Licensed.
 */

const request = require("request");
const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({

    baseUrl: "https://www.wienerlinien.at/ogd_realtime/monitor?",

    start: function() {
        console.log("Starting module: " + this.name);
    },

    socketNotificationReceived: function(notification, payload) {
        if(notification === "CONFIG"){
            this.config = payload;
            this.getData();
            setInterval(() => {
                this.getData();
            }, this.config.updateInterval);
        }
    },

    getData: function() {
        var options = {
            url: this.baseUrl +
            "sender=" + this.config.api_key +
            "&rbl=" + this.config.stations.join("&rbl=")
        };
        request(options, (error, response, body) => {
            if (response.statusCode === 200) {
                body = JSON.parse(body);
                if(body.message.value === "OK") {
                    this.handleData(body.data.monitors, body.message.serverTime);
                } else {
                    console.log("Error no WienerLinen data");
                }
            } else {
                console.log("Error getting WienerLinen data " + response.statusCode);
            }
        });
    },

    handleData: function(data, time){
        var stations = {};

        for(var i = 0; i < data.length; i++){
            if(!stations.hasOwnProperty(data[i].locationStop.properties.name)){
                stations[data[i].locationStop.properties.name] = {
                    name: data[i].locationStop.properties.title,
                    departures: []
                };
            }
            for(var n = 0; n < data[i].lines.length; n++){
                var metroFlag = false;
                for(var x = 0; x < data[i].lines[n].departures.departure.length; x++){
                    if(Object.keys(data[i].lines[n].departures.departure[x].departureTime).length == 0){
                        metroFlag = true;
                        break;
                    }

                    stations[data[i].locationStop.properties.name].departures.push({
                        time: data[i].lines[n].departures.departure[x].departureTime[data[i].lines[n].departures.departure[x].departureTime.hasOwnProperty("timeReal") ? "timeReal" : "timePlanned"],
                        towards: data[i].lines[n].towards,
                        line: data[i].lines[n].name,
                        type: data[i].lines[n].type
                    });
                }
                if(metroFlag){
                    var departureTimePattern = /[0-9]+/g;
                    var departureTimeMatches = data[i].lines[n].towards.match(departureTimePattern).toString().split(",");

                    var towardsPattern = /^[a-zäöüß ]+/i;
                    var towardsMatch = data[i].lines[n].towards.match(towardsPattern).toString().replace(/  +/g, " ").trim();

                    for(var x = 0; x < departureTimeMatches.length; x++){
                        var datetime = new Date(time);
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

        var keys = Object.keys(stations);

        for(var i = 0; i < keys.length; i++){
            stations[keys[i]].departures.sort(function(a, b){
                if(a.time < b.time) return -1;
                if(a.time > b.time) return 1;
                return 0;
            });
        }

        this.sendSocketNotification("STATIONS", stations);
    }
});