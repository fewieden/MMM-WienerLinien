/* Magic Mirror
 * Module: MMM-WienerLinien
 *
 * By fewieden https://github.com/fewieden/MMM-WienerLinien
 * MIT Licensed.
 */

Module.register("MMM-WienerLinien", {

    index: 0,

    types: {
        "ptBusCity": "fa-bus",
        "ptTram": "fa-train",
        "ptTramWLB": "fa-train",
        "ptMetro": "fa-subway"
    },

    defaults: {
        max: 5,
        rotateInterval: 20 * 1000,
        updateInterval: 5 * 60 * 1000
    },

    getTranslations: function () {
        return {
            en: "translations/en.json",
            de: "translations/de.json"
        };
    },

    getScripts: function() {
        return ["moment.js"];
    },

    getStyles: function () {
        return ["font-awesome.css", "MMM-WienerLinien.css"];
    },

    start: function () {
        Log.info("Starting module: " + this.name);
        moment.locale(config.language);
        this.maxIndex = this.config.stations.length;
        setInterval(() => {
            this.updateDom(300);
            this.index++;
            if(this.index >= this.maxIndex){
                this.index = 0;
            }
        }, this.config.rotateInterval);
        this.sendSocketNotification("CONFIG", this.config);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "STATIONS") {
            this.stations = payload;
            this.updateDom(300);
        }
    },

    getDom: function () {

        var wrapper = document.createElement("div");
        var header = document.createElement("header");
        header.classList.add("align-left");
        var logo = document.createElement("i");
        logo.classList.add("fa", "fa-bus", "logo");
        header.appendChild(logo);
        var name = document.createElement("span");
        name.innerHTML = "WienerLinien";
        header.appendChild(name);
        wrapper.appendChild(header);

        if (!this.stations) {
            var text = document.createElement("div");
            text.innerHTML = this.translate("LOADING");
            text.classList.add("dimmed", "light");
            wrapper.appendChild(text);
        } else {
            var keys = Object.keys(this.stations);
            this.maxIndex = keys.length;
            if(this.index >= this.maxIndex){
                this.index = 0;
            }
            var station = document.createElement("div");
            station.classList.add("align-left");
            station.innerHTML = this.stations[keys[this.index]].name;
            wrapper.appendChild(station);
            var table = document.createElement("table");
            table.classList.add("small", "table", "align-left");

            table.appendChild(this.createLabelRow());

            for (var i = 0; i < Math.min(this.stations[keys[this.index]].departures.length, this.config.max); i++) {
                this.appendDataRow(this.stations[keys[this.index]].departures[i], table);
            }

            wrapper.appendChild(table);
        }

        return wrapper;
    },

    createLabelRow: function () {
        var labelRow = document.createElement("tr");

        var typeIconLabel = document.createElement("th");
        typeIconLabel.classList.add("centered");
        var typeIcon = document.createElement("i");
        typeIcon.classList.add("fa", "fa-info");
        typeIconLabel.appendChild(typeIcon);
        labelRow.appendChild(typeIconLabel);

        var lineIconLabel = document.createElement("th");
        lineIconLabel.classList.add("centered");
        var lineIcon = document.createElement("i");
        lineIcon.classList.add("fa", "fa-tag");
        lineIconLabel.appendChild(lineIcon);
        labelRow.appendChild(lineIconLabel);

        var directionIconLabel = document.createElement("th");
        directionIconLabel.classList.add("centered");
        var directionIcon = document.createElement("i");
        directionIcon.classList.add("fa", "fa-compass");
        directionIconLabel.appendChild(directionIcon);
        labelRow.appendChild(directionIconLabel);

        var timeIconLabel = document.createElement("th");
        timeIconLabel.classList.add("centered");
        var timeIcon = document.createElement("i");
        timeIcon.classList.add("fa", "fa-clock-o");
        timeIconLabel.appendChild(timeIcon);
        labelRow.appendChild(timeIconLabel);

        return labelRow;
    },

    appendDataRow: function (data, appendTo) {
        var row = document.createElement("tr");

        var type = document.createElement("td");
        type.classList.add("centered");
        var typeIcon = document.createElement("i");
        typeIcon.classList.add("fa", this.types.hasOwnProperty(data.type) ? this.types[data.type] : "fa-question");
        type.appendChild(typeIcon);
        row.appendChild(type);

        var line = document.createElement("td");
        line.classList.add("centered");
        line.innerHTML = data.line;
        row.appendChild(line);

        var towards = document.createElement("td");
        towards.innerHTML = data.towards;
        row.appendChild(towards);

        var time = document.createElement("td");
        time.classList.add("centered");
        time.innerHTML = moment().to(data.time);
        row.appendChild(time);

        appendTo.appendChild(row);
    }
});