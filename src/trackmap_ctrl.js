import L from './leaflet/leaflet.js';
import moment from 'moment';

import appEvents from 'app/core/app_events';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

import './leaflet/leaflet.css!';
import './module.css!';

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
    if (this.hoverTarget && this.hoverTarget === target) {
      return;
    }

    // check for initial show of the marker
    if (this.hoverTarget == null){
      this.hoverMarker.bringToFront()
                      .setStyle({
                        fillColor: this.panel.pointColor,
                        color: 'white'
                      });
    }

    this.hoverTarget = target;

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

  onPanelClear(evt) {
    // clear the highlighted circle
    this.hoverTarget = null;
    if (this.hoverMarker) {
      this.hoverMarker.setStyle({
        fillColor: 'none',
        color: 'none'
      });
    }
  }

  setupMap() {
    // Create the map or get it back in a clean state if it already exists
    if (this.leafMap) {
      if (this.polyline) {
        this.polyline.removeFrom(this.leafMap);
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

    let defaultLayer = L.tileLayer.provider('OpenStreetMap.Mapnik').addTo(map);

    let baseLayers = {
        'OpenStreetMap Default': defaultLayer,
        'OpenStreetMap German Style': L.tileLayer.provider('OpenStreetMap.DE'),
        'OpenStreetMap Black and White': L.tileLayer.provider('OpenStreetMap.BlackAndWhite'),
        'OpenStreetMap H.O.T.': L.tileLayer.provider('OpenStreetMap.HOT'),
        'Thunderforest OpenCycleMap': L.tileLayer.provider('Thunderforest.OpenCycleMap'),
        'Thunderforest Transport': L.tileLayer.provider('Thunderforest.Transport'),
        'Thunderforest Landscape': L.tileLayer.provider('Thunderforest.Landscape'),
        'Hydda Full': L.tileLayer.provider('Hydda.Full'),
        'Stamen Toner': L.tileLayer.provider('Stamen.Toner'),
        'Stamen Terrain': L.tileLayer.provider('Stamen.Terrain'),
        'Stamen Watercolor': L.tileLayer.provider('Stamen.Watercolor'),
        'Esri WorldStreetMap': L.tileLayer.provider('Esri.WorldStreetMap'),
        'Esri DeLorme': L.tileLayer.provider('Esri.DeLorme'),
        'Esri WorldTopoMap': L.tileLayer.provider('Esri.WorldTopoMap'),
        'Esri WorldImagery': L.tileLayer.provider('Esri.WorldImagery'),
        'Esri WorldTerrain': L.tileLayer.provider('Esri.WorldTerrain'),
        'Esri WorldShadedRelief': L.tileLayer.provider('Esri.WorldShadedRelief'),
        'Esri WorldPhysical': L.tileLayer.provider('Esri.WorldPhysical'),
        'Esri OceanBasemap': L.tileLayer.provider('Esri.OceanBasemap'),
        'Esri NatGeoWorldMap': L.tileLayer.provider('Esri.NatGeoWorldMap'),
        'Esri WorldGrayCanvas': L.tileLayer.provider('Esri.WorldGrayCanvas'),
        'Geoportail France Maps': L.tileLayer.provider('GeoportailFrance'),
        'Geoportail France Orthos': L.tileLayer.provider('GeoportailFrance.orthos'),
        'Geoportail France classic maps': L.tileLayer.provider('GeoportailFrance.ignMaps')
    };

    let overlayLayers = {
        'OpenSeaMap': L.tileLayer.provider('OpenSeaMap'),
        'OpenWeatherMap Clouds': L.tileLayer.provider('OpenWeatherMap.Clouds'),
        'OpenWeatherMap CloudsClassic': L.tileLayer.provider('OpenWeatherMap.CloudsClassic'),
        'OpenWeatherMap Precipitation': L.tileLayer.provider('OpenWeatherMap.Precipitation'),
        'OpenWeatherMap PrecipitationClassic': L.tileLayer.provider('OpenWeatherMap.PrecipitationClassic'),
        'OpenWeatherMap Rain': L.tileLayer.provider('OpenWeatherMap.Rain'),
        'OpenWeatherMap RainClassic': L.tileLayer.provider('OpenWeatherMap.RainClassic'),
        'OpenWeatherMap Pressure': L.tileLayer.provider('OpenWeatherMap.Pressure'),
        'OpenWeatherMap PressureContour': L.tileLayer.provider('OpenWeatherMap.PressureContour'),
        'OpenWeatherMap Wind': L.tileLayer.provider('OpenWeatherMap.Wind'),
        'OpenWeatherMap Temperature': L.tileLayer.provider('OpenWeatherMap.Temperature'),
        'OpenWeatherMap Snow': L.tileLayer.provider('OpenWeatherMap.Snow'),
        'Geoportail France Parcels': L.tileLayer.provider('GeoportailFrance.parcels')
    };

    L.control.layers(baseLayers, overlayLayers, {collapsed: false}).addTo(this.leafMap);

    // Dummy hovermarker
    this.hoverMarker = L.circleMarker(L.latLng(0, 0), {
      color: 'none',
      fillColor: 'none',
      fillOpacity: 1,
      weight: 2,
      radius: 7
    }).addTo(this.leafMap);

    // Last pos marker
    this.lastPosMarker = L.circleMarker(L.latLng(0, 0), {
        color: 'none',
        fillColor: 'none',
        fillOpacity: 1,
        weight: 2,
        radius: 7
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

    if(this.coords.length > 0) {
      this.lastPosMarker.bringToFront()
        .setStyle({
          fillColor: this.panel.pointColor,
          color: 'white'}
      );

      const lastIdx = this.coords.length - 1;
      this.lastPosMarker.setLatLng(this.coords[lastIdx].position);
    }
    else {
      if (this.lastPosMarker) {
        this.lastPosMarker.setStyle({
          fillColor: 'none',
          color: 'none'
        });
      }
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

    if (data.length === 0 || data.length !== 2) {
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
    this.addDataToMap();
  }
}

TrackMapCtrl.templateUrl = 'module.html';
