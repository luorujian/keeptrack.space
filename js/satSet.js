/* /////////////////////////////////////////////////////////////////////////////

(c) 2016-2020, Theodore Kruczek
(c) 2015-2016, James Yoder

satSet.js is the primary interface between sat-cruncher and the main application.
It manages all interaction with the satellite catalogue.
http://keeptrack.space

Original source code released by James Yoder at https://github.com/jeyoder/ThingsInSpace/
under the MIT License. Please reference http://keeptrack.space/license/thingsinspace.txt

All additions and modifications of original code is Copyright © 2016-2020 by
Theodore Kruczek. All rights reserved. No part of this web site may be reproduced,
published, distributed, displayed, performed, copied or stored for public or private
use, without written permission of the author.

No part of this code may be modified or changed or exploited in any way used
for derivative works, or offered for sale, or used to construct any kind of database
or mirrored at any other location without the express written permission of the author.

///////////////////////////////////////////////////////////////////////////// */

// var multThreadCruncher1 = {};
// var multThreadCruncher2 = {};
// var multThreadCruncher3 = {};
// var multThreadCruncher4 = {};
// var multThreadCruncher5 = {};
// var multThreadCruncher6 = {};
// var multThreadCruncher7 = {};
// var multThreadCruncher8 = {};

var satSensorMarkerArray = [];

(function () {
  var TAU = 2 * Math.PI;
  var RAD2DEG = 360 / TAU;

  var satCruncher = {};
  var limitSats = settingsManager.limitSats;

  var satSet = {};
  var dotShader;
  var satPosBuf;
  var satColorBuf;

  // Removed to reduce garbage collection
  var buffers;
  var pickColorBuf;
  var pickableBuf;

  var uFOVi;  // Update FOV function iteration i variable
  var uFOVs;  // Update FOV function iteration S variable

  var emptyMat4 = mat4.create();

  var satPos;
  var satVel;
  var satInView;
  var satInSun;
  var satData;
  var satExtraData;
  var hoveringSat = -1;
  // var selectedSat = -1;

  try {
    $('#loader-text').text('Locating ELSETs...');
    satCruncher = new Worker('js/sat-cruncher.js');
    // multThreadCruncher1 = new Worker('js/mSat.js');
    // multThreadCruncher2 = new Worker('js/mSat.js');
    // multThreadCruncher3 = new Worker('js/mSat.js');
    // multThreadCruncher4 = new Worker('js/mSat.js');
    // multThreadCruncher5 = new Worker('js/mSat.js');
    // multThreadCruncher6 = new Worker('js/mSat.js');
    // multThreadCruncher7 = new Worker('js/mSat.js');
    // multThreadCruncher8 = new Worker('js/mSat.js');
  } catch (E) {
    browserUnsupported();
  }

  /**
   * These variables are here rather inside the function because as they
   * loop each iteration it was causing the jsHeap to grow. This isn't noticeable
   * on faster computers because the garbage collector takes care of it, but on
   * slower computers it would noticeably lag when the garbage collector ran.
   *
   * The arbitrary convention used is to put the name of the loop/function the
   * variable is part of at the front of what the name used to be
   * (ex: now --> drawNow) (ex: i --> satCrunchIndex)
  */

  // draw Loop
  var drawNow = 0;
  var lastDrawTime = 0;
  var drawDivisor;
  var drawDt;
  var drawI;

  var satCrunchIndex;
  var satCrunchNow = 0;

  var lastFOVUpdateTime = 0;
  var cruncherReadyCallback;
  var gotExtraData = false;

  satCruncher.onmessage = function (m) {
    if (!gotExtraData) { // store extra data that comes from crunching
      // Only do this once

      satExtraData = JSON.parse(m.data.extraData);

      for (satCrunchIndex = 0; satCrunchIndex < satSet.numSats; satCrunchIndex++) {
        satData[satCrunchIndex].inclination = satExtraData[satCrunchIndex].inclination;
        satData[satCrunchIndex].eccentricity = satExtraData[satCrunchIndex].eccentricity;
        satData[satCrunchIndex].raan = satExtraData[satCrunchIndex].raan;
        satData[satCrunchIndex].argPe = satExtraData[satCrunchIndex].argPe;
        satData[satCrunchIndex].meanMotion = satExtraData[satCrunchIndex].meanMotion;

        satData[satCrunchIndex].semiMajorAxis = satExtraData[satCrunchIndex].semiMajorAxis;
        satData[satCrunchIndex].semiMinorAxis = satExtraData[satCrunchIndex].semiMinorAxis;
        satData[satCrunchIndex].apogee = satExtraData[satCrunchIndex].apogee;
        satData[satCrunchIndex].perigee = satExtraData[satCrunchIndex].perigee;
        satData[satCrunchIndex].period = satExtraData[satCrunchIndex].period;
      }

      gotExtraData = true;
      satExtraData = null;
      return;
    }

    if (m.data.extraUpdate) {
      satExtraData = JSON.parse(m.data.extraData);
      satCrunchIndex = m.data.satId;

      satData[satCrunchIndex].inclination = satExtraData[0].inclination;
      satData[satCrunchIndex].eccentricity = satExtraData[0].eccentricity;
      satData[satCrunchIndex].raan = satExtraData[0].raan;
      satData[satCrunchIndex].argPe = satExtraData[0].argPe;
      satData[satCrunchIndex].meanMotion = satExtraData[0].meanMotion;

      satData[satCrunchIndex].semiMajorAxis = satExtraData[0].semiMajorAxis;
      satData[satCrunchIndex].semiMinorAxis = satExtraData[0].semiMinorAxis;
      satData[satCrunchIndex].apogee = satExtraData[0].apogee;
      satData[satCrunchIndex].perigee = satExtraData[0].perigee;
      satData[satCrunchIndex].period = satExtraData[0].period;
      satData[satCrunchIndex].TLE1 = satExtraData[0].TLE1;
      satData[satCrunchIndex].TLE2 = satExtraData[0].TLE2;
      satExtraData = null;
      return;
    }

    satPos = new Float32Array(m.data.satPos);
    satVel = new Float32Array(m.data.satVel);

    if (typeof m.data.satInView != 'undefined') {
      satInView = new Int8Array(m.data.satInView);
    }
    if (typeof m.data.satInSun != 'undefined') {
      satInSun = new Int8Array(m.data.satInSun);
    }
    if (typeof m.data.sensorMarkerArray != 'undefined') {
      satSensorMarkerArray = m.data.sensorMarkerArray;
    }

    if (settingsManager.isMapMenuOpen || settingsManager.isMapUpdateOverride) {
      satCrunchNow = Date.now();
      if (satCrunchNow > settingsManager.lastMapUpdateTime + 30000) {
        uiController.updateMap();
        settingsManager.lastMapUpdateTime = satCrunchNow;
        settingsManager.isMapUpdateOverride = false;
      } else if (settingsManager.isMapUpdateOverride) {
        uiController.updateMap();
        settingsManager.lastMapUpdateTime = satCrunchNow;
        settingsManager.isMapUpdateOverride = false;
      }
    }

    if (settingsManager.socratesOnSatCruncher) {
      selectSat(settingsManager.socratesOnSatCruncher);
      settingsManager.socratesOnSatCruncher = null;
    }

    // Don't force color recalc if default colors and no sensor for inview color
    if (satellite.checkSensorSelected() || settingsManager.isForceColorScheme) {
      // Don't change colors while dragging
      if (!isDragging) {
        satSet.setColorScheme(settingsManager.currentColorScheme, true); // force color recalc
      }
    }

    if (!settingsManager.cruncherReady) {
      // NOTE:: This is called right after all the objects load on the screen.

      // Version Info Updated
      $('#version-info').html(settingsManager.versionNumber);
      $('#version-info').tooltip({delay: 50, html: settingsManager.versionDate, position: 'top'});

      /** Hide SOCRATES menu if not all the satellites are currently available to view */
      if (limitSats !== '') {
        $('#menu-satellite-collision').hide();
      }

      $('body').attr('style', 'background:black');
      $('#canvas-holder').attr('style', 'display:block');

      mobile.checkMobileMode();

      if (settingsManager.isMobileModeEnabled) { // Start Button Displayed
        $('#mobile-start-button').show();
        $('#spinner').hide();
        $('#loader-text').html('');
      } else { // Loading Screen Resized and Hidden
        if (settingsManager.trusatMode) {
            setTimeout(function () {
              $('#loading-screen').removeClass('full-loader');
              $('#loading-screen').addClass('mini-loader-container');
              $('#logo-inner-container').addClass('mini-loader');
              $('#logo-text').html('');
              $('#logo-trusat').hide();
              $('#loader-text').html('Attempting to Math...');
              $('#loading-screen').fadeOut();
            }, 5000);
        } else {
          $('#loading-screen').removeClass('full-loader');
          $('#loading-screen').addClass('mini-loader-container');
          $('#logo-inner-container').addClass('mini-loader');
          $('#logo-text').html('');
          $('#logo-trusat').hide();
          $('#loader-text').html('Attempting to Math...');
          $('#loading-screen').fadeOut();
        }
      }

      satSet.setColorScheme(settingsManager.currentColorScheme); // force color recalc
      settingsManager.cruncherReady = true;
      if (cruncherReadyCallback) {
        cruncherReadyCallback(satData);
      }

      (function _watchlistInit () {
        var watchlistJSON = (!settingsManager.offline) ? localStorage.getItem("watchlistList") : null;
        if (watchlistJSON !== null) {
          var newWatchlist = JSON.parse(watchlistJSON);
          watchlistInViewList = [];
          for (var i = 0; i < newWatchlist.length; i++) {
            var sat = satSet.getSatExtraOnly(satSet.getIdFromObjNum(newWatchlist[i]));
            if (sat !== null) {
              newWatchlist[i] = sat.id;
              watchlistInViewList.push(false);
            } else {
              console.error('Watchlist File Format Incorret');
              return;
            }
          }
          uiController.updateWatchlist(newWatchlist, watchlistInViewList);
        }
      })();

      if ($(window).width() > $(window).height()) {
        settingsManager.mapHeight = $(window).width(); // Subtract 12 px for the scroll
        $('#map-image').width(settingsManager.mapHeight);
        settingsManager.mapHeight = settingsManager.mapHeight * 3 / 4;
        $('#map-image').height(settingsManager.mapHeight);
        $('#map-menu').width($(window).width());
      } else {
        settingsManager.mapHeight = $(window).height() - 100; // Subtract 12 px for the scroll
        $('#map-image').height(settingsManager.mapHeight);
        settingsManager.mapHeight = settingsManager.mapHeight * 4 / 3;
        $('#map-image').width(settingsManager.mapHeight);
        $('#map-menu').width($(window).width());
      }
    }
  };

  satSet.changeShaders = function (newShaders) {
    gl.detachShader(dotShader, vertShader);
    gl.detachShader(dotShader, fragShader);
    switch (newShaders) {
      case 'var':
        gl.shaderSource(vertShader, shaderLoader.getShaderCode('dot-vertex-var.glsl'));
        break;
      case 12:
        gl.shaderSource(vertShader, shaderLoader.getShaderCode('dot-vertex-12.glsl'));
        break;
      case 6:
        gl.shaderSource(vertShader, shaderLoader.getShaderCode('dot-vertex-6.glsl'));
        break;
      case 2:
        gl.shaderSource(vertShader, shaderLoader.getShaderCode('dot-vertex-2.glsl'));
        break;
    }
    gl.compileShader(vertShader);

    gl.shaderSource(fragShader, shaderLoader.getShaderCode('dot-fragment.glsl'));
    gl.compileShader(fragShader);

    gl.attachShader(dotShader, vertShader);
    gl.attachShader(dotShader, fragShader);
    gl.linkProgram(dotShader);
    dotShader.aPos = gl.getAttribLocation(dotShader, 'aPos');
    dotShader.aColor = gl.getAttribLocation(dotShader, 'aColor');
    dotShader.uMvMatrix = gl.getUniformLocation(dotShader, 'uMvMatrix');
    dotShader.uCamMatrix = gl.getUniformLocation(dotShader, 'uCamMatrix');
    dotShader.uPMatrix = gl.getUniformLocation(dotShader, 'uPMatrix');
  };

  var vertShader;
  var fragShader;

  satSet.init = function (satsReadyCallback) {
    db.log('satSet.init');
    /** Parses GET variables for Possible sharperShaders */
    (function parseFromGETVariables () {
      var queryStr = window.location.search.substring(1);
      var params = queryStr.split('&');
      for (var i = 0; i < params.length; i++) {
        var key = params[i].split('=')[0];
        if (key === 'vertShadersSize') {
          settingsManager.vertShadersSize = 6;
          document.getElementById('settings-shaders').checked = true;
        }
      }
    })();
    dotShader = gl.createProgram();

    vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, shaderLoader.getShaderCode('dot-vertex-var.glsl'));
    gl.compileShader(vertShader);

    fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, shaderLoader.getShaderCode('dot-fragment.glsl'));
    gl.compileShader(fragShader);

    gl.attachShader(dotShader, vertShader);
    gl.attachShader(dotShader, fragShader);
    gl.linkProgram(dotShader);

    dotShader.aPos = gl.getAttribLocation(dotShader, 'aPos');
    dotShader.aColor = gl.getAttribLocation(dotShader, 'aColor');
    dotShader.uMvMatrix = gl.getUniformLocation(dotShader, 'uMvMatrix');
    dotShader.uCamMatrix = gl.getUniformLocation(dotShader, 'uCamMatrix');
    dotShader.uPMatrix = gl.getUniformLocation(dotShader, 'uPMatrix');

    if (!settingsManager.offline) {
      var tleSource = settingsManager.tleSource;
      $.get('' + tleSource + '?v=' + settingsManager.versionNumber)
        .done(function (resp) {
          // if the .json loads then use it
          loadTLEs(resp);
        })
        .fail(function () {
          // Sometimes network firewall's hate .json so use a .js
          $.getScript('/offline/tle.js', function () {
            loadTLEs(jsTLEfile);
          });
        });
      jsTLEfile = null;
    } else {
      loadTLEs(jsTLEfile);
      jsTLEfile = null;
    }

    function loadTLEs (resp) {
      var obslatitude;
      var obslongitude;
      var obsheight;
      var obsminaz;
      var obsmaxaz;
      var obsminel;
      var obsmaxel;
      var obsminrange;
      var obsmaxrange;
      var limitSatsArray = [];

      // Get TruSat TLEs if in TruSat Mode
      if (typeof trusatList == 'undefined' && settingsManager.trusatMode && !settingsManager.trusatOnly) {
        // console.log(`${Date.now()} - TruSat TLEs Loading...`);
        $.getScript('/tle/trusat.js', function () {
          // console.log(`${Date.now()} - TruSat TLEs Loaded!`);
          loadTLEs(resp); // Try again when you have all TLEs
        });
        return; // Stop and Wait for the TruSat TLEs to Load
      }

      /** Parses GET variables for SatCruncher initialization */
      (function parseFromGETVariables () {
        var queryStr = window.location.search.substring(1);
        var params = queryStr.split('&');
        for (var i = 0; i < params.length; i++) {
          var key = params[i].split('=')[0];
          var val = params[i].split('=')[1];
          switch (key) {
            case 'limitSats':
              limitSats = val;
              $('#limitSats').val(val);
              // document.getElementById('settings-limitSats-enabled').checked = true;
              $('#limitSats-Label').addClass('active');
              limitSatsArray = val.split(',');
              break;
            case 'lat':
              if (val >= -90 && val <= 90) obslatitude = val;
              break;
            case 'long':
              if (val >= -180 && val <= 360) obslongitude = val;
              break;
            case 'hei':
              if (val >= -20 && val <= 20) obsheight = val;
              break;
            case 'minaz':
              if (val >= 0 && val <= 360) obsminaz = val;
              break;
            case 'maxaz':
              if (val >= 0 && val <= 360)obsmaxaz = val;
              break;
            case 'minel':
              if (val >= -10 && val <= 180) obsminel = val;
              break;
            case 'maxel':
              if (val >= -10 && val <= 180) obsmaxel = val;
              break;
            case 'minrange':
              if (val >= 0) obsminrange = val;
              break;
            case 'maxrange':
              if (val <= 10000000) obsmaxrange = val;
              break;
          }
        }
      })();

      /**
       * Filters out extra satellites if limitSats is set
       * @param  limitSats Array of satellites
       * @return Returns only requested satellites if limitSats is setobs
       */
      function filterTLEDatabase (limitSatsArray) {
        var tempSatData = [];
        if (limitSatsArray[0] == null) { // If there are no limits then just process like normal
          limitSats = '';
        }

        var year;
        var prefix;
        var rest;

        for (var i = 0; i < resp.length; i++) {
          resp[i].SCC_NUM = pad0(resp[i].TLE1.substr(2, 5).trim(), 5);
          if (limitSats === '') { // If there are no limits then just process like normal
            year = resp[i].TLE1.substr(9, 8).trim().substring(0, 2); // clean up intl des for display
            if (year === '') {
              resp[i].intlDes = 'none';
            } else {
              prefix = (year > 50) ? '19' : '20';
              year = prefix + year;
              rest = resp[i].TLE1.substr(9, 8).trim().substring(2);
              resp[i].intlDes = year + '-' + rest;
            }
            resp[i].id = i;
            resp[i].active = true;
            tempSatData.push(resp[i]);
            continue;
          } else { // If there are limited satellites
            for (var x = 0; x < limitSatsArray.length; x++) {
              if (resp[i].SCC_NUM === limitSatsArray[x]) {
                year = resp[i].TLE1.substr(9, 8).trim().substring(0, 2); // clean up intl des for display
                if (year === '') {
                  resp[i].intlDes = 'none';
                } else {
                  prefix = (year > 50) ? '19' : '20';
                  year = prefix + year;
                  rest = resp[i].TLE1.substr(9, 8).trim().substring(2);
                  resp[i].intlDes = year + '-' + rest;
                }
                resp[i].id = i;
                resp[i].active = true;
                tempSatData.push(resp[i]);
              }
            }
          }
        }
        var isMatchFound = false;
        if (typeof satelliteList !== 'undefined' && settingsManager.offline) { // If extra catalogue
          for (s = 0; s < satelliteList.length; s++) {
            isMatchFound = false;
            for (i = 0; i < tempSatData.length; i++) {
              if (satelliteList[s].SCC == undefined) continue;
              if (satelliteList[s].TLE1 == undefined) continue; // Don't Process Bad Satellite Information
              if (satelliteList[s].TLE2 == undefined) continue; // Don't Process Bad Satellite Information
              if (tempSatData[i].SCC_NUM === satelliteList[s].SCC) {
                tempSatData[i].ON = satelliteList[s].ON;
                tempSatData[i].OT = (typeof satelliteList[s].OT != 'undefined') ? satelliteList[s].OT : null;
                tempSatData[i].TLE1 = satelliteList[s].TLE1;
                tempSatData[i].TLE2 = satelliteList[s].TLE2;
                isMatchFound = true;
                break;
              }
            }
            if (!isMatchFound) {
              if (satelliteList[s].TLE1 == undefined) continue; // Don't Process Bad Satellite Information
              if (satelliteList[s].TLE2 == undefined) continue; // Don't Process Bad Satellite Information
              if (typeof satelliteList[s].ON == 'undefined') { satelliteList[s].ON = "Unknown"; }
              if (typeof satelliteList[s].OT == 'undefined') { satelliteList[s].OT = null; }
              year = satelliteList[s].TLE1.substr(9, 8).trim().substring(0, 2); // clean up intl des for display
              prefix = (year > 50) ? '19' : '20';
              year = prefix + year;
              rest = satelliteList[s].TLE1.substr(9, 8).trim().substring(2);
              extrasSatInfo = {
                static: false,
                missile: false,
                active: false,
                ON: satelliteList[s].ON,
                OT: satelliteList[s].OT,
                C: 'Unknown',
                LV: 'Unknown',
                LS: 'Unknown',
                SCC_NUM: satelliteList[s].SCC.toString(),
                TLE1: satelliteList[s].TLE1,
                TLE2: satelliteList[s].TLE2,
                intlDes: year + '-' + rest,
                type: 'sat',
                id: tempSatData.length
              };
              tempSatData.push(extrasSatInfo);
            }
          }
          satelliteList = null;
        }
        if (typeof satInfoList !== 'undefined' && settingsManager.offline) { // If extra catalogue
          for (s = 0; s < satInfoList.length; s++) {
            isMatchFound = false;
            // NOTE i=s may need to be i=0, but this should be more effecient.
            // There should be some sorting done earlier
            for (i = s; i < tempSatData.length; i++) {
              if (satInfoList[s].SCC === tempSatData[i].SCC_NUM) {
                tempSatData[i].ON = satInfoList[s].ON;
                tempSatData[i].C = satInfoList[s].C;
                tempSatData[i].LV = satInfoList[s].LV;
                tempSatData[i].LS = satInfoList[s].LS;
                tempSatData[i].URL = satInfoList[s].URL;
                isMatchFound = true;
                break;
              }
            }
          }
          satInfoList = null;
        }
        // console.log(`${Date.now()} - Merging TruSat TLEs`);
        if (typeof trusatList !== 'undefined' && settingsManager.trusatMode) { // If extra catalogue
          for (s = 0; s < trusatList.length; s++) {
            if (trusatList[s].TLE1 == undefined) continue; // Don't Process Bad Satellite Information
            if (trusatList[s].TLE2 == undefined) continue; // Don't Process Bad Satellite Information
            if (typeof trusatList[s].ON == 'undefined') { trusatList[s].ON = "Unknown"; }
            if (typeof trusatList[s].OT == 'undefined') { trusatList[s].OT = null; }
            year = trusatList[s].TLE1.substr(9, 8).trim().substring(0, 2); // clean up intl des for display
            prefix = (year > 50) ? '19' : '20';
            year = prefix + year;
            rest = trusatList[s].TLE1.substr(9, 8).trim().substring(2);
            scc = pad0(parseInt(trusatList[s].TLE1.substr(2, 5).trim()).toString(), 5);
            extrasSatInfo = {
              static: false,
              missile: false,
              active: true,
              trusat: true,
              ON: trusatList[s].ON,
              OT: 4, // Amateur Report
              C: 'Unknown',
              LV: 'Unknown',
              LS: 'Unknown',
              SCC_NUM: `T${scc.toString()}`,
              TLE1: trusatList[s].TLE1,
              TLE2: trusatList[s].TLE2,
              intlDes: year + '-' + rest,
              type: 'sat',
              id: tempSatData.length
            };
            tempSatData.push(extrasSatInfo);
          }
          trusatList = null;
        }

        satSet.orbitalSats = tempSatData.length;

        loggerStop = Date.now();
        for (i = 0; i < objectManager.staticSet.length; i++) {
          tempSatData.push(objectManager.staticSet[i]);
        }
        for (i = 0; i < objectManager.analSatSet.length; i++) {
          objectManager.analSatSet[i].id = tempSatData.length;
          tempSatData.push(objectManager.analSatSet[i]);
        }
        for (i = 0; i < objectManager.missileSet.length; i++) {
          tempSatData.push(objectManager.missileSet[i]);
        }

        satSet.missileSats = tempSatData.length;

        for (i = 0; i < objectManager.fieldOfViewSet.length; i++) {
          objectManager.fieldOfViewSet[i].id = tempSatData.length;
          tempSatData.push(objectManager.fieldOfViewSet[i]);
        }
        // console.log(tempSatData.length);
        return tempSatData;
      }

      satData = filterTLEDatabase(limitSatsArray);
      resp = null;
      satSet.satDataString = JSON.stringify(satData);

      timeManager.propRealTime = Date.now(); // assumed same as value in Worker, not passing

      /** If custom sensor set then send parameters to lookangles and satCruncher */
      if (obslatitude !== undefined && obslongitude !== undefined && obsheight !== undefined && obsminaz !== undefined && obsmaxaz !== undefined && obsminel !== undefined &&
          obsmaxel !== undefined && obsminrange !== undefined && obsmaxrange !== undefined) {
        satellite.setobs({
          lat: obslatitude,
          long: obslongitude,
          obshei: obsheight,
          obsminaz: obsminaz,
          obsmaxaz: obsmaxaz,
          obsminel: obsminel,
          obsmaxel: obsmaxel,
          obsminrange: obsminrange,
          obsmaxrange: obsmaxrange
        });

        satCruncher.postMessage({
          typ: 'offset',
          dat: (timeManager.propOffset).toString() + ' ' + (timeManager.propRate).toString(),
          setlatlong: true,
          lat: obslatitude,
          long: obslongitude,
          obshei: obsheight,
          obsminaz: obsminaz,
          obsmaxaz: obsmaxaz,
          obsminel: obsminel,
          obsmaxel: obsmaxel,
          obsminrange: obsminrange,
          obsmaxrange: obsmaxrange
        });
      }

      /** Send satDataString to satCruncher to begin propagation loop */
      satCruncher.postMessage({
        typ: 'satdata',
        dat: satSet.satDataString,
        fieldOfViewSetLength: objectManager.fieldOfViewSet.length,
        isLowPerf: settingsManager.lowPerf
      });
      // multThreadCruncher1.postMessage({type: 'init', data: satSet.satDataString});
      // multThreadCruncher2.postMessage({type: 'init', data: satSet.satDataString});
      // multThreadCruncher3.postMessage({type: 'init', data: satSet.satDataString});
      // multThreadCruncher4.postMessage({type: 'init', data: satSet.satDataString});
      // multThreadCruncher5.postMessage({type: 'init', data: satSet.satDataString});
      // multThreadCruncher6.postMessage({type: 'init', data: satSet.satDataString});
      // multThreadCruncher7.postMessage({type: 'init', data: satSet.satDataString});
      // multThreadCruncher8.postMessage({type: 'init', data: satSet.satDataString});

      // populate GPU mem buffers, now that we know how many sats there are
      satPosBuf = gl.createBuffer();
      satPos = new Float32Array(satData.length * 3);

      var pickColorData = [];
      pickColorBuf = gl.createBuffer();
      for (var i = 0; i < satData.length; i++) {
        var byteR = (i + 1) & 0xff;
        var byteG = ((i + 1) & 0xff00) >> 8;
        var byteB = ((i + 1) & 0xff0000) >> 16;
        pickColorData.push(byteR / 255.0);
        pickColorData.push(byteG / 255.0);
        pickColorData.push(byteB / 255.0);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, pickColorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pickColorData), gl.STATIC_DRAW);

      satSet.numSats = satData.length;
      satSet.setColorScheme(ColorScheme.default, true);
      settingsManager.shadersReady = true;
      if (satsReadyCallback) {
        satsReadyCallback(satData);
        if (!settingsManager.trusatOnly) {
          // If No Visual Magnitudes, Add The VMag Database
          try {
            if (typeof satSet.getSat(satSet.getIdFromObjNum(694)).vmag == 'undefined') {
              satVmagManager.init();
            }
          } catch (e) {
              console.debug('satVmagManager Not Loaded');
          }
        }
      }
    }
  };

  satSet.getSatData = function () {
    db.log('satSet.getSatData');
    return satData;
  };

  satSet.getSatInView = function () {
    db.log('satSet.getSatInView');
    if (typeof satInView == 'undefined') return false;
    return satInView;
  };

  satSet.getSatInSun = function () {
    db.log('satSet.getSatInSun');
    if (typeof satInSun == 'undefined') return false;
    return satInSun;
  };

  satSet.getSatVel = function () {
    db.log('satSet.getSatVel');
    if (typeof satVel == 'undefined') return false;
    return satVel;
  };

  satSet.setColorScheme = function (scheme, isForceRecolor) {
    db.log('satSet.setColorScheme');
    settingsManager.currentColorScheme = scheme;
    buffers = scheme.calculateColorBuffers(isForceRecolor);
    satColorBuf = buffers.colorBuf;
    pickableBuf = buffers.pickableBuf;
  };

  var screenLocation = [];

  satSet.draw = function (pMatrix, camMatrix, drawNow) {
    // NOTE: 640 byte leak.

    if (!settingsManager.shadersReady || !settingsManager.cruncherReady) return;

    drawDivisor = Math.max(timeManager.propRate, 0.001);
    drawDt = Math.min((drawNow - lastDrawTime) / 1000.0, 1.0 / drawDivisor);
    drawDt *= timeManager.propRate; // Adjust drawDt correspond to the propagation rate
    satSet.satDataLenInDraw = satData.length;
    if (!settingsManager.lowPerf && drawDt > settingsManager.minimumDrawDt) {
      if (!settingsManager.isSatOverflyModeOn && !settingsManager.isFOVBubbleModeOn) {
        satSet.satDataLenInDraw -= settingsManager.maxFieldOfViewMarkers;
        for (drawI = 0; drawI < ((satSet.satDataLenInDraw) * 3); drawI++) {
          if (satVel[drawI] != 0) {
            satPos[drawI] += satVel[drawI] * drawDt;
          }
        }
      } else {
        satSet.satDataLenInDraw *= 3;
        for (drawI = 0; drawI < (satSet.satDataLenInDraw); drawI++) {
          if (satVel[drawI] != 0) {
            satPos[drawI] += satVel[drawI] * drawDt;
          }
        }
      }
      lastDrawTime = drawNow;
    }

    // console.log('interp dt=' + dt + ' ' + drawNow);

    gl.useProgram(dotShader);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    //  gl.bindFramebuffer(gl.FRAMEBUFFER, gl.pickFb);

    gl.uniformMatrix4fv(dotShader.uMvMatrix, false, emptyMat4);
    gl.uniformMatrix4fv(dotShader.uCamMatrix, false, camMatrix);
    gl.uniformMatrix4fv(dotShader.uPMatrix, false, pMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, satPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, satPos, gl.STREAM_DRAW);
    gl.vertexAttribPointer(dotShader.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, satColorBuf);
    gl.enableVertexAttribArray(dotShader.aColor);
    gl.vertexAttribPointer(dotShader.aColor, 4, gl.FLOAT, false, 0, 0);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.depthMask(false);

    gl.drawArrays(gl.POINTS, 0, satData.length);

    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // now pickbuffer stuff......
    try {
      gl.useProgram(gl.pickShaderProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, gl.pickFb);
      //  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.uniformMatrix4fv(gl.pickShaderProgram.uMvMatrix, false, emptyMat4);
      gl.uniformMatrix4fv(gl.pickShaderProgram.uCamMatrix, false, camMatrix);
      gl.uniformMatrix4fv(gl.pickShaderProgram.uPMatrix, false, pMatrix);

      gl.enableVertexAttribArray(gl.pickShaderProgram.aColor);
      gl.bindBuffer(gl.ARRAY_BUFFER, pickColorBuf);
      gl.vertexAttribPointer(gl.pickShaderProgram.aColor, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, pickableBuf);
      gl.enableVertexAttribArray(gl.pickShaderProgram.aPickable);
      gl.vertexAttribPointer(gl.pickShaderProgram.aPickable, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, satData.length); // draw pick
    } catch (e) {
      db.log(`satData.length: ${satData.length}`);
      db.log(e);
    }
    // satSet.updateFOV(null, drawNow);

    // Done Drawing
    return true;
  };

  // var uFOVSearchItems;
  // var inViewObs = [];
  // satSet.updateFOV = function (curSCC, now) {
  //   if (now - lastFOVUpdateTime > 1 * 1000 / timeManager.propRate && settingsManager.isBottomMenuOpen === true) { // If it has been 1 seconds since last update that the menu is open
  //     inViewObs = [];
  //     DOMcurObjsHTML.innerHTML = '';
  //     for (uFOVi = 0; uFOVi < (satData.length); uFOVi++) {
  //       if ($('#search').val() === '') {
  //         if (satData[uFOVi].inview) {
  //           inViewObs.push(satData[uFOVi].SCC_NUM);
  //         }
  //       } else {
  //         uFOVSearchItems = $('#search').val().split(',');
  //         for (uFOVs = 0; uFOVs < ($('#datetime-text').length); uFOVs++) {
  //           if (satData[uFOVi].inview && satData[uFOVi].SCC_NUM === uFOVSearchItems[uFOVs]) {
  //             inViewObs.push(satData[uFOVi].SCC_NUM);
  //           }
  //         }
  //       }
  //     }
  //     curObjsHTMLText = '';
  //     for (uFOVi = 0; uFOVi < inViewObs.length; uFOVi++) {
  //       curObjsHTMLText += "<span class='FOV-object link'>" + inViewObs[uFOVi] + '</span>\n';
  //     }
  //     DOMcurObjsHTML.innerHTML = curObjsHTMLText;
  //     lastFOVUpdateTime = now;
  //   }
  // };

  satSet.mergeSat = function (satObject) {
    if (!satData) return null;
    var i = satSet.getIdFromObjNum(satObject.SCC);
    satData[i].ON = satObject.ON;
    satData[i].C = satObject.C;
    satData[i].LV = satObject.LV;
    satData[i].LS = satObject.LS;
    satData[i].R = satObject.R;
    satData[i].URL = satObject.URL;
    satData[i].NOTES = satObject.NOTES;
    satData[i].TTP = satObject.TTP;
    satData[i].FMISSED = satObject.FMISSED;
    satData[i].ORPO = satObject.ORPO;
    satData[i].constellation = satObject.constellation;
    satData[i].associates = satObject.associates;
    satData[i].maneuver = satObject.maneuver;
  };

  satSet.vmagUpdate = function (vmagObject) {
    if (!satData) return null;
    var i = satSet.getIdFromObjNum(vmagObject.satid);
    try {
      satData[i].vmag = vmagObject.vmag;
    } catch (e) {
      // console.warn('Old Satellite in vmagManager: ' + vmagObject.satid);
    }
  };

  satSet.setSat = function (i, satObject) {
    if (!satData) return null;
    satData[i] = satObject;
  };

  satSet.getSat = function (i) {
    db.log('satSet.getSat',true);
    if (!satData) return null;
    if (!satData[i]) return null;
    if (gotExtraData) {
      satData[i].inViewChange = false;
      if (typeof  satInView != 'undefined' &&
          typeof  satInView[i] != 'undefined') {
        if (satData[i].inview !== satInView[i]) satData[i].inViewChange = true;
        satData[i].inview = satInView[i];
      } else {
        satData[i].inview = false;
        satData[i].inViewChange = false;
      }

      if (typeof  satInSun != 'undefined' &&
          typeof  satInSun[i] != 'undefined') {
        if(satData[i].inSun !== satInSun[i]) satData[i].inSunChange = true;
        satData[i].inSun = satInSun[i];
      }

      satData[i].velocity = Math.sqrt(
        satVel[i * 3] * satVel[i * 3] +
        satVel[i * 3 + 1] * satVel[i * 3 + 1] +
        satVel[i * 3 + 2] * satVel[i * 3 + 2]
      );
      satData[i].velocityX = satVel[i * 3];
      satData[i].velocityY = satVel[i * 3 + 1];
      satData[i].velocityZ = satVel[i * 3 + 2];
      satData[i].position = {
        x: satPos[i * 3],
        y: satPos[i * 3 + 1],
        z: satPos[i * 3 + 2]
      };
    }

    return satData[i];
  };

  satSet.getSatInViewOnly = function (i) {
    if (!satData) return null;
    if (!satData[i]) return null;

    satData[i].inview = satInView[i];
    return satData[i];
  };

  satSet.getSatPosOnly = function (i) {
    if (!satData) return null;
    if (!satData[i]) return null;

    if (gotExtraData) {
      satData[i].position = {
        x: satPos[i * 3],
        y: satPos[i * 3 + 1],
        z: satPos[i * 3 + 2]
      };
    }

    return satData[i];
  };

  satSet.getSatExtraOnly = function (i) {
    if (!satData) return null;
    if (!satData[i]) return null;
    return satData[i];
  };

  satSet.getIdFromIntlDes = function (intlDes) {
    for (var i = 0; i < satData.length; i++) {
      if (satData[i].intlDes === intlDes) {
        return i;
      }
    }
    return null;
  };

  function pad0 (str, max) {
    return str.length < max ? pad0('0' + str, max) : str;
  }

  satSet.getSatFromObjNum = function (objNum) {
      var satID = satSet.getIdFromObjNum (objNum);
      return satSet.getSat(satID);
  };

  satSet.getIdFromObjNum = function (objNum) {
    var scc;
    for (var i = 0; i < satData.length; i++) {
      if (satData[i].static || satData[i].missile) {
        continue;
      } else {
        scc = parseInt(satData[i].SCC_NUM);
        // scc = pad0(satData[i].TLE1.substr(2, 5).trim(), 5);
      }

      if (parseInt(objNum) === scc) {
        return i;
      }
    }
    return null;
  };

  satSet.getIdFromStarName = function (starName) {
    for (var i = 0; i < satData.length; i++) {
      if (satData[i].type === 'Star') {
        if (satData[i].name === starName) {
          return i;
        }
      }
    }
    return null;
  };

  satSet.getIdFromSensorName = function (sensorName) {
    if (typeof sensorName != 'undefined') {
      for (var i = 0; i < satData.length; i++) {
        if (satData[i].static === true && satData[i].missile !== true && satData[i].type !== 'Star') {
          if (satData[i].name === sensorName) {
            return i;
          }
        }
      }
    }
    try {
      var now = timeManager.propTime();

      var j = timeManager.jday(now.getUTCFullYear(),
                   now.getUTCMonth() + 1, // Note, this function requires months in range 1-12.
                   now.getUTCDate(),
                   now.getUTCHours(),
                   now.getUTCMinutes(),
                   now.getUTCSeconds());
      j += now.getUTCMilliseconds() * 1.15741e-8; // days per millisecond

      var gmst = satellite.gstime(j);
      cosLat = Math.cos(satellite.currentSensor.lat * DEG2RAD);
      sinLat = Math.sin(satellite.currentSensor.lat * DEG2RAD);
      cosLon = Math.cos((satellite.currentSensor.long * DEG2RAD) + gmst);
      sinLon = Math.sin((satellite.currentSensor.long * DEG2RAD) + gmst);
      var sensor = {};
      sensor.position = {};
      sensor.name = 'Custom Sensor';
      sensor.position.x = (6371 + 0.25 + satellite.currentSensor.obshei) * cosLat * cosLon; // 6371 is radius of earth
      sensor.position.y = (6371 + 0.25 + satellite.currentSensor.obshei) * cosLat * sinLon;
      sensor.position.z = (6371 + 0.25 + satellite.currentSensor.obshei) * sinLat;
      // console.log('No Sensor Found. Using Current Sensor');
      // console.log(sensor);
      return sensor;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  var posVec4;
  satSet.getScreenCoords = function (i, pMatrix, camMatrix, pos) {
    satScreenPositionArray.error = false;
    if (!pos) pos = satSet.getSatPosOnly(i).position;
    posVec4 = vec4.fromValues(pos.x, pos.y, pos.z, 1);
    // var transform = mat4.create();

    vec4.transformMat4(posVec4, posVec4, camMatrix);
    vec4.transformMat4(posVec4, posVec4, pMatrix);

    satScreenPositionArray.x = (posVec4[0] / posVec4[3]);
    satScreenPositionArray.y = (posVec4[1] / posVec4[3]);
    satScreenPositionArray.z = (posVec4[2] / posVec4[3]);

    satScreenPositionArray.x = (satScreenPositionArray.x + 1) * 0.5 * window.innerWidth;
    satScreenPositionArray.y = (-satScreenPositionArray.y + 1) * 0.5 * window.innerHeight;

    if (satScreenPositionArray.x >= 0 && satScreenPositionArray.y >= 0 && satScreenPositionArray.z >= 0 && satScreenPositionArray.z <= 1) {
      // Passed Test
    } else {
      satScreenPositionArray.error = true;
    }
  };

  satSet.searchNameRegex = function (regex) {
    var res = [];
    for (var i = 0; i < satData.length; i++) {
      if (regex.test(satData[i].ON)) {
        res.push(i);
      }
    }
    return res;
  };

  satSet.searchCountryRegex = function (regex) {
    var res = [];
    for (var i = 0; i < satData.length; i++) {
      if (regex.test(satData[i].C)) {
        res.push(i);
      }
    }
    return res;
  };

  satSet.searchAzElRange = function (azimuth, elevation, range, inclination, azMarg, elMarg, rangeMarg, incMarg, period, periodMarg, objtype) {
    var isCheckAz = !isNaN(parseFloat(azimuth)) && isFinite(azimuth);
    var isCheckEl = !isNaN(parseFloat(elevation)) && isFinite(elevation);
    var isCheckRange = !isNaN(parseFloat(range)) && isFinite(range);
    var isCheckInclination = !isNaN(parseFloat(inclination)) && isFinite(inclination);
    var isCheckPeriod = !isNaN(parseFloat(period)) && isFinite(period);
    var isCheckAzMarg = !isNaN(parseFloat(azMarg)) && isFinite(azMarg);
    var isCheckElMarg = !isNaN(parseFloat(elMarg)) && isFinite(elMarg);
    var isCheckRangeMarg = !isNaN(parseFloat(rangeMarg)) && isFinite(rangeMarg);
    var isCheckIncMarg = !isNaN(parseFloat(incMarg)) && isFinite(incMarg);
    var isCheckPeriodMarg = !isNaN(parseFloat(periodMarg)) && isFinite(periodMarg);
    objtype *= 1; // String to Number

    if (!isCheckEl && !isCheckRange && !isCheckAz && !isCheckInclination && !isCheckPeriod) return; // Ensure there is a number typed.

    if (!isCheckAzMarg) { azMarg = 5; }
    if (!isCheckElMarg) { elMarg = 5; }
    if (!isCheckRangeMarg) { rangeMarg = 200; }
    if (!isCheckIncMarg) { incMarg = 1; }
    if (!isCheckPeriodMarg) { periodMarg = 0.5; }
    var res = [];

    var s = 0;
    for (var i = 0; i < satData.length; i++) {
      if (satData[i].static || satData[i].missile || !satData[i].active) { continue; }
      res.push(satData[i]);
      satellite.getTEARR(res[s]);
      res[s].azimuth = satellite.currentTEARR.azimuth;
      res[s].elevation = satellite.currentTEARR.elevation;
      res[s].range = satellite.currentTEARR.range;
      res[s].inview = satellite.currentTEARR.inview;
      s++;
    }

    if (!isCheckInclination && !isCheckPeriod) {
      res = checkInview(res);
    }

    if (objtype !== 0) {
      res = checkObjtype(res);
    }

    if (isCheckAz) {
      azimuth = azimuth * 1; // Convert azimuth to int
      azMarg = azMarg * 1;
      var minaz = azimuth - azMarg;
      var maxaz = azimuth + azMarg;
      res = checkAz(res, minaz, maxaz);
    }

    if (isCheckEl) {
      elevation = elevation * 1; // Convert elevation to int
      elMarg = elMarg * 1;
      var minel = elevation - elMarg;
      var maxel = elevation + elMarg;
      res = checkEl(res, minel, maxel);
    }

    if (isCheckRange) {
      range = range * 1; // Convert range to int
      rangeMarg = rangeMarg * 1;
      var minrange = range - rangeMarg;
      var maxrange = range + rangeMarg;
      res = checkRange(res, minrange, maxrange);
    }

    if (isCheckInclination) {
      inclination = inclination * 1; // Convert inclination to int
      incMarg = incMarg * 1;
      var minInc = inclination - incMarg;
      var maxInc = inclination + incMarg;
      res = checkInc(res, minInc, maxInc);
    }

    if (isCheckPeriod) {
      period = period * 1; // Convert period to int
      periodMarg = periodMarg * 1;
      var minPeriod = period - periodMarg;
      var maxPeriod = period + periodMarg;
      res = checkPeriod(res, minPeriod, maxPeriod);
    }

    function checkInview (possibles) {
      var inviewRes = [];
      for (var i = 0; i < possibles.length; i++) {
        if (possibles[i].inview) {
          inviewRes.push(possibles[i]);
        }
      }
      return inviewRes;
    }

    function checkObjtype (possibles) {
      var objtypeRes = [];
      for (var i = 0; i < possibles.length; i++) {
        if (possibles[i].OT === objtype) {
          objtypeRes.push(possibles[i]);
        }
      }
      return objtypeRes;
    }

    function checkAz (possibles, minaz, maxaz) {
      var azRes = [];
      for (var i = 0; i < possibles.length; i++) {
        if (possibles[i].azimuth < maxaz && possibles[i].azimuth > minaz) {
          azRes.push(possibles[i]);
        }
      }
      return azRes;
    }
    function checkEl (possibles, minel, maxel) {
      var elRes = [];
      for (var i = 0; i < possibles.length; i++) {
        if (possibles[i].elevation < maxel && possibles[i].elevation > minel) {
          elRes.push(possibles[i]);
        }
      }
      return elRes;
    }
    function checkRange (possibles, minrange, maxrange) {
      var rangeRes = [];
      for (var i = 0; i < possibles.length; i++) {
        if (possibles[i].range < maxrange && possibles[i].range > minrange) {
          rangeRes.push(possibles[i]);
        }
      }
      return rangeRes;
    }
    function checkInc (possibles, minInc, maxInc) {
      var incRes = [];
      for (var i = 0; i < possibles.length; i++) {
        if ((possibles[i].inclination * RAD2DEG).toFixed(2) < maxInc && (possibles[i].inclination * RAD2DEG).toFixed(2) > minInc) {
          incRes.push(possibles[i]);
        }
      }
      return incRes;
    }
    function checkPeriod (possibles, minPeriod, maxPeriod) {
      var periodRes = [];
      for (var i = 0; i < possibles.length; i++) {
        if (possibles[i].period < maxPeriod && possibles[i].period > minPeriod && periodRes.length <= 200) { // Don't display more than 200 results - this is because LEO and GEO belt have a lot of satellites
          periodRes.push(possibles[i]);
        }
      }
      if (periodRes.length >= 200) {
        $('#findByLooks-results').text('Limited to 200 Results!');
      }
      return periodRes;
    }
    // $('#findByLooks-results').text('');
    // IDEA: Intentionally doesn't clear previous searches. Could be an option later.
    var sccList = [];
    for (i = 0; i < res.length; i++) {
      // $('#findByLooks-results').append(res[i].SCC_NUM + '<br />');
      if (i < res.length - 1) {
        $('#search').val($('#search').val() + res[i].SCC_NUM + ',');
      } else {
        $('#search').val($('#search').val() + res[i].SCC_NUM);
      }
      sccList.push(res[i].SCC_NUM);
    }
    searchBox.doSearch($('#search').val());
    // console.log(sccList);
    return res;
  };

  satSet.setHover = function (i) {
    if (i === hoveringSat) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, satColorBuf);
    // If Old Select Sat Picked Color it Correct Color
    if (hoveringSat !== -1) {
      gl.bufferSubData(gl.ARRAY_BUFFER, hoveringSat * 4 * 4, new Float32Array(settingsManager.currentColorScheme.colorizer(satSet.getSat(hoveringSat)).color));
    }
    // If New Select Sat Picked Color it
    if (i !== -1) {
      gl.bufferSubData(gl.ARRAY_BUFFER, i * 4 * 4, new Float32Array(settingsManager.hoverColor));
    }
      hoveringSat = i;
  };

  satSet.selectSat = function (i) {
    if (i === selectedSat) return;
    if(isAnalysisMenuOpen && i != -1) { $('#anal-sat').val(satSet.getSat(i).SCC_NUM); }
    adviceList.satelliteSelected();
    satCruncher.postMessage({
      satelliteSelected: [i]
    });
    if (settingsManager.isMobileModeEnabled) mobile.searchToggle(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, satColorBuf);
    // If Old Select Sat Picked Color it Correct Color
    if (selectedSat !== -1) {
      gl.bufferSubData(gl.ARRAY_BUFFER, selectedSat * 4 * 4, new Float32Array(settingsManager.currentColorScheme.colorizer(satSet.getSat(selectedSat)).color));
    }
    // If New Select Sat Picked Color it
    if (i !== -1) {
      isSatView = true;
      gl.bufferSubData(gl.ARRAY_BUFFER, i * 4 * 4, new Float32Array(settingsManager.selectedColor));
    }
    selectedSat = i;

    if (satellite.checkSensorSelected()) {
      $('#menu-lookangles').removeClass('bmenu-item-disabled');
    }
    $('#menu-lookanglesmultisite').removeClass('bmenu-item-disabled');
    $('#menu-satview').removeClass('bmenu-item-disabled');
    $('#menu-map').removeClass('bmenu-item-disabled');
    $('#menu-editSat').removeClass('bmenu-item-disabled');
    $('#menu-sat-fov').removeClass('bmenu-item-disabled');
    $('#menu-newLaunch').removeClass('bmenu-item-disabled');
    $('#menu-breakup').removeClass('bmenu-item-disabled');
  };

  satSet.onCruncherReady = function (cruncherReadyCallback) {
    db.log('satSet.onCruncherReady not ready',true);
    if (settingsManager.cruncherReady) cruncherReadyCallback(); // Prevent cruncher callbacks until cruncher ready.
    db.log('satSet.onCruncherReady ready');
  };

  window.satSet = satSet;
  window.satCruncher = satCruncher;
  window.satPos = satPos;
})();
