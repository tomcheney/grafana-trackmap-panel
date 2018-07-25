import L from './leaflet/leaflet.js';
import moment from 'moment';

import appEvents from 'app/core/app_events';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

import './leaflet/leaflet.css!';
import './module.css!';
import './leaflet/leaflet.rotatedMarker.js';

const panelDefaults = {
    maxDataPoints: 500,
    autoZoom: true,
    lineColor: 'red',
    pointColor: 'royalblue',
};

export class TrackMapCtrl extends MetricsPanelCtrl {
    constructor($scope, $injector) {
        super($scope, $injector);
        _.defaults(this.panel, panelDefaults);

        this.timeSrv = $injector.get('timeSrv');
        this.coords = [];
        this.headings = [];
        this.leafMap = null;
        this.polyline = null;
        this.lastPosMarker = null;
        this.hoverMarker = null;
        this.hoverTarget = null;

        // Panel events
        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
        this.events.on('panel-teardown', this.onPanelTeardown.bind(this));
        this.events.on('data-received', this.onDataReceived.bind(this));

        // Global events
        appEvents.on('graph-hover', this.onPanelHover.bind(this));
        appEvents.on('graph-hover-clear', this.onPanelClear.bind(this));
    }

    onInitEditMode() {
        this.addEditorTab('Options', 'public/plugins/grafana-trackmap-panel/editor.html', 2);
    }

    onPanelTeardown() {
        this.$timeout.cancel(this.nextTickPromise);
    }

    onPanelHover(evt) {
        if (this.coords.length === 0) {
            return;
        }

        // check if we are already showing the correct hoverMarker
        let target = Math.floor(evt.pos.x);
        // if (this.hoverTarget && this.hoverTarget === target) {
        //     return;
        // }

        // check for initial show of the marker
        if (this.hoverTarget == null){
            this.hoverMarker.setOpacity(0.5);
        }

        this.hoverTarget = target;

        {
            // Find the currently selected time and move the hoverMarker to it
            // Note that an exact match isn't always going to work due to rounding so
            // we clean that up later (still more efficient)
            let min = 0;
            let max = this.coords.length - 1;
            let idx = null;
            let exact = false;
            while (min <= max) {
                idx = Math.floor((max + min) / 2);
                if (this.coords[idx].timestamp === this.hoverTarget) {
                    exact = true;
                    break;
                }
                else if (this.coords[idx].timestamp < this.hoverTarget) {
                    min = idx + 1;
                }
                else {
                    max = idx - 1;
                }
            }

            // Correct the case where we are +1 index off
            if (!exact && idx > 0 && this.coords[idx].timestamp > this.hoverTarget) {
                idx--;
            }
            this.hoverMarker.setLatLng(this.coords[idx].position);
        }

        {
            let minH = 0;
            let maxH = this.headings.length - 1;
            let idxH = null;
            let exactH = false;
            while (minH <= maxH) {
                idxH = Math.floor((maxH + minH) / 2);
                if (this.headings[idxH].timestamp === this.hoverTarget) {
                    exactH = true;
                    break;
                }
                else if (this.headings[idxH].timestamp < this.hoverTarget) {
                    minH = idxH + 1;
                }
                else {
                    maxH = idxH - 1;
                }
            }

            // Correct the case where we are +1 index off
            if (!exactH && idxH > 0 && this.headings[idxH].timestamp > this.hoverTarget) {
                idxH--;
            }
            this.hoverMarker.setRotationAngle(this.headings[idxH].heading)
        }
    }

    onPanelClear(evt) {
        // clear the highlighted circle
        this.hoverTarget = null;
        if (this.hoverMarker) {
            this.hoverMarker.setOpacity(0);
        }
    }

    setupMap() {
        // Create the map or get it back in a clean state if it already exists
        if (this.leafMap) {
            if (this.polyline) {
                this.polyline.removeFrom(this.leafMap);
            }
            if (this.lastPosMarker) {
                this.lastPosMarker.removeFrom(this.leafMap);
            }
            this.onPanelClear();
            return;
        }

        // Create the map
        this.leafMap = L.map('trackmap-' + this.panel.id, {
            scrollWheelZoom: false,
            zoomSnap: 0.5,
            zoomDelta: 1,
        });

        // Define layers and add them to the control widget
        L.control.layers({
            'OpenSeaMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                forcedOverlay: L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{
                    attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
                    maxZoom: 19,
                })
            }).addTo(this.leafMap),
            'Black and White': L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
                forcedOverlay: L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{
                    attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
                    maxZoom: 19,
                })
            }),
            'Watercolor': L.tileLayer('http://tile.stamen.com/watercolor/{z}/{x}/{y}.jpg', {
                variant: 'watercolor',
                forcedOverlay: L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{
                    attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
                    maxZoom: 19,
                })
            }),
            'Terrain': L.tileLayer('http://tile.stamen.com/terrain/{z}/{x}/{y}.jpg', {
                variant: 'terrain',
                forcedOverlay: L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{
                    attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
                    maxZoom: 19,
                })
            }),
            'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                forcedOverlay: L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{
                    attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors',
                    maxZoom: 19,
                })
            }),
            'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Imagery &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                // This map doesn't have labels so we force a label-only layer on top of it
                forcedOverlay: L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png', {
                    attribution: 'Labels by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    subdomains: 'abcd',
                    maxZoom: 20,
                })
            })
        }).addTo(this.leafMap);

        // Dummy hovermarker
        this.hoverMarker = L.marker(L.latLng(0, 0), {
            rotationAngle: 0
        }).addTo(this.leafMap);

        // Events
        this.leafMap.on('baselayerchange', this.mapBaseLayerChange.bind(this));
        this.leafMap.on('boxzoomend', this.mapZoomToBox.bind(this));
    }

    mapBaseLayerChange(e) {
        // If a tileLayer has a 'forcedOverlay' attribute, always enable/disable it
        // along with the layer
        if (this.leafMap.forcedOverlay) {
            this.leafMap.forcedOverlay.removeFrom(this.leafMap);
            this.leafMap.forcedOverlay = null;
        }
        let overlay = e.layer.options.forcedOverlay;
        if (overlay) {
            overlay.addTo(this.leafMap);
            overlay.setZIndex(e.layer.options.zIndex + 1);
            this.leafMap.forcedOverlay = overlay;
        }
    }

    mapZoomToBox(e) {
        // Find time bounds of selected coordinates
        const bounds = this.coords.reduce(
            function(t, c) {
                if (e.boxZoomBounds.contains(c.position)) {
                    t.from = Math.min(t.from, c.timestamp);
                    t.to = Math.max(t.to, c.timestamp);
                }
                return t;
            },
            {from: Infinity, to: -Infinity}
        );

        // Set the global time range
        if (isFinite(bounds.from) && isFinite(bounds.to)) {
            // KLUDGE: Create moment objects here to avoid a TypeError that
            // occurs when Grafana processes normal numbers
            this.timeSrv.setTime({
                from: moment.utc(bounds.from),
                to: moment.utc(bounds.to)
            });
        }
    }

    // Add the circles and polyline to the map
    addDataToMap() {
        this.polyline = L.polyline(
            this.coords.map(x => x.position, this), {
                color: this.panel.lineColor,
                weight: 3,
            }
        ).addTo(this.leafMap);

        if(this.coords.length) {
            // Last pos marker
            let angle = 0;
            if(this.headings.length > 0) {
                const lastHdgIdx = this.headings.length - 1;
                angle = this.headings[lastHdgIdx].heading;
            }
            console.log('Angle: ' + angle);

            this.lastPosMarker = L.marker(L.latLng(0, 0), {
                rotationAngle: angle,
                shadowUrl: null
            }).addTo(this.leafMap);

            const lastIdx = this.coords.length - 1;
            this.lastPosMarker.setLatLng(this.coords[lastIdx].position);
        }

        this.zoomToFit();
    }

    zoomToFit(){
        if (this.panel.autoZoom){
            this.leafMap.fitBounds(this.polyline.getBounds());
        }
    }

    refreshColors() {
        if (this.polyline) {
            this.polyline.setStyle({
                color: this.panel.lineColor
            });
        }
    }

    onDataReceived(data) {
        this.setupMap();

        if (data.length < 2) {
            // No data or incorrect data, show a world map and abort
            this.leafMap.setView([0, 0], 1);
            return;
        }

        // Asumption is that there are an equal number of properly matched timestamps
        // TODO: proper joining by timestamp?
        this.coords.length = 0;
        const lats = data[0].datapoints;
        const lons = data[1].datapoints;
        for (let i = 0; i < lats.length; i++) {
            if (lats[i][0] == null || lons[i][0] == null ||
                lats[i][1] !== lats[i][1]) {
                continue;
            }

            this.coords.push({
                position: L.latLng(lats[i][0], lons[i][0]),
                timestamp: lats[i][1]
            });
        }

        this.headings.length = 0;
        if (data.length === 3) {
            const headings = data[2].datapoints;
            for (let i = 0; i < headings.length; i++) {
                if(headings[i][0] ==null) {
                    continue;
                }

                this.headings.push({
                    heading: headings[i][0],
                    timestamp: headings[i][1]
                });
            }
        }
        this.addDataToMap();
    }
}

TrackMapCtrl.templateUrl = 'module.html';