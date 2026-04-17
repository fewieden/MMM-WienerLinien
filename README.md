[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://raw.githubusercontent.com/fewieden/MMM-WienerLinien/master/LICENSE) [![Build Status](https://travis-ci.org/fewieden/MMM-WienerLinien.svg?branch=master)](https://travis-ci.org/fewieden/MMM-WienerLinien) [![Code Climate](https://codeclimate.com/github/fewieden/MMM-WienerLinien/badges/gpa.svg?style=flat)](https://codeclimate.com/github/fewieden/MMM-WienerLinien) [![Known Vulnerabilities](https://snyk.io/test/github/fewieden/mmm-wienerlinien/badge.svg)](https://snyk.io/test/github/fewieden/mmm-wienerlinien)

# MMM-WienerLinien

Public Transport of Vienna/Austria Module for MagicMirror²

## Examples

### Classic View

Periodically rotates between different stations.

![Station 1](.github/example.jpg) ![Station 2](.github/example2.jpg)

### Compact View

Shows all stations in one view without rotating.

![CompactView](.github/example4.png)

### Incidents

Shows incident data (classic view only).

![Incidents](.github/example3.png)

## Dependencies

-   An installation of [MagicMirror<sup>2</sup>](https://github.com/MichMich/MagicMirror)
-   npm
-   [lodash](https://www.npmjs.com/package/lodash)
-   [node-fetch](https://www.npmjs.com/package/node-fetch)

## Installation

-   Clone this repo into `~/MagicMirror/modules` directory.
-   Configure your `~/MagicMirror/config/config.js`:

```js
{
    module: 'MMM-WienerLinien',
    position: 'top_right',
    config: {
        stations: ['2545', '1668'],
        // all your config options, which are different than their default values
    }
}
```

-   Run command `npm i --production` in `~/MagicMirror/modules/MMM-WienerLinien` directory.

## Config Options

| **Option**           | **Default**       | **Description**                                                                                                                                                                                            |
| -------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stations`           | REQUIRED          | Insert here the station ids you want to display data from [How to find an ID?](https://till.mabe.at/rbl/).                                                                                                 |
| `view`               | `classic`         | Switch between `classic` and `compact` view. (See examples)                                                                                                                                                |
| `lines`              | []                | Set a filter to only show your favorite lines (e.g. `["U4", "U1"]`). Leave empty to show all.                                                                                                              |
| `header`             | `WienerLinien`    | Set the header above the module. Leave empty to hide the header.                                                                                                                                           |
| `displayIcons`       | `true`            | Display or hide the icons above the table.                                                                                                                                                                 |
| `max`                | `5`               | How many departures should be displayed.                                                                                                                                                                   |
| `shortenStation`     | `false`           | After how many characters the station name should be cut. Default: show full name.                                                                                                                         |
| `shortenDestination` | `false`           | After how many characters the destination name should be cut. Default: show full name.                                                                                                                     |
| `rotateInterval`     | `20000` (20 sec)  | How fast should be switched between the stations.                                                                                                                                                          |
| `updateInterval`     | `300000` (5 mins) | How often should the data be fetched.                                                                                                                                                                      |
| `animationSpeed`     | `300` (300 ms)    | How fast should the animation on data changes run.                                                                                                                                                         |
| `elevatorStations`   | EMPTY             | Insert the station ids where you would like to know elevator disruptions.                                                                                                                                  |
| `incidentLines`      | EMPTY             | Insert the line names for which you would like to know disruptions.                                                                                                                                        |
| `incidentShort`      | `false`           | If true, also the changes to lines are displayed (AZBLinienspezialtext [see documentation](https://data.wien.gv.at/pdf/wienerlinien-echtzeitdaten-dokumentation.pdf)), otherwise only current disruptions. |
