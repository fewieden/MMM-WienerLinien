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
                    this.handleData(body.data.monitors);
                } else {
                    console.log("Error no WienerLinen data");
                }
            } else {
                console.log("Error getting WienerLinen data " + response.statusCode);
            }
        });
    },

    handleData: function(data){
        var stations = {};

        for(var i = 0; i < data.length; i++){
            if(!stations.hasOwnProperty(data[i].locationStop.properties.name)){
                stations[data[i].locationStop.properties.name] = {
                    name: data[i].locationStop.properties.title,
                    departures: []
                };
            }
            for(var n = 0; n < data[i].lines.length; n++){
                for(var x = 0; x < data[i].lines[n].departures.departure.length; x++){
                    stations[data[i].locationStop.properties.name].departures.push({
                        time: data[i].lines[n].departures.departure[x].departureTime[data[i].lines[n].departures.departure[x].departureTime.hasOwnProperty("timeReal") ? "timeReal" : "timePlanned"],
                        towards: data[i].lines[n].towards,
                        line: data[i].lines[n].name,
                        type: data[i].lines[n].type
                    });
                }
            }
        }

        var keys = Object.keys(stations);

        for(var i = 0; i < keys.length; i++){
            stations[keys[i]].departures.sort(function(a, b){
                return a.time- b.time;
            });
        }

        this.sendSocketNotification("STATIONS", stations);
    }
});