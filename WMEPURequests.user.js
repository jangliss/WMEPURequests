// ==UserScript==
// @name                WMEPURequests
// @namespace           http://tampermonkey.net/
// @version             0.0.7
// @description         try to take over the world!
// @author              Jonathan Angliss
// @include             /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor.*$/
// @grant        none
// ==/UserScript==

debugger;

var WMEPUR;
(function (WMEPUR) {

    var venues = [];
    var UROPlaceSettings = {};
    var purSplitUpdates = false;
    var purUseUROPlaceOps = false;

    function bootstrap_PlaceUpdateReqs() {
        setTimeout(PlaceUpdateReqs, 2000);
    }

    function PlaceUpdateReqs() {
        console.log("WMEPUR: Initializing...");

        var objectToCheck = [{ o: "Waze.map", s: "wazeMap" },
            { o: "Waze.model", s: "wazeModel" },
            { o: "OpenLayers", s: "OpenLayers" },
            { o: "Waze.vent", s: "wazeVent" },
            { o: "Waze.controller", s: "wazeController" },
            { o: "Waze.model.actionManager", s: "wazeActionManager" },
            { o: "Waze.loginManager.user.isAreaManager", s: "uam" }];
        for (var i = 0; i < objectToCheck.length; i++) {
            var path = objectToCheck[i].o.split(".");
            var object = window;
            for (var j = 0; j < path.length; j++) {
                object = object[path[j]];
                if (typeof object === "undefined" || object === null) {
                    console.log("WMEPUR:   " + path[j] + " NOT OK");
                    window.setTimeout(PlaceUpdateReqs, 2000);
                    return;
                }
            }
            // globals[objectToCheck[i].s] = object;
            console.log("WMEPUR:   " + objectToCheck[i].o + " OK");
        }

        console.log("WMEPUR: Initialized!");

        if (typeof localStorage.purUseUROPlaceOps !== undefined) {
            purUseUROPlaceOps = localStorage.purUseUROPlaceOps;
        }

        if (typeof localStorage.purSplitUpdates !== undefined) {
            purSplitUpdates = localStorage.purSplitUpdates;
        }

        addTab();

    }

    function getAddress(venue) {
        var fullAddress = {};

        var address = venue.getAddress().attributes;

        fullAddress["HN"] = venue.attributes.houseNumber;
        fullAddress["Street"] = address.street && address.street.name || "";
        fullAddress["City"] = address.city && address.city.attributes.name || "";
        fullAddress["State"] = address.state && address.state.name || "";

        return fullAddress;
    }

    function reformatDate(dateVal) {

        var year = dateVal.getFullYear();
        var month = ((dateVal.getMonth() + 1) < 10 ? "0" : "") + (dateVal.getMonth() + 1).toString();
        var day = (dateVal.getDate() < 10 ? "0" : "") + dateVal.getDate().toString();
        var hour = (dateVal.getHours() < 10 ? "0" : "") + dateVal.getHours();
        var minutes = (dateVal.getMinutes() < 10 ? "0" : "") + dateVal.getMinutes();

        return year + "/" + month + "/" + day + " " + hour + ":" + minutes;
    }

    function getVenuePL(venue) {
        var geo = venue.attributes.geometry;
        var x = 0;
        var y = 0;
        if (isNaN(geo.x) || isNaN(geo.y)) {
            x = geo.bounds.centerLonLat.lon;
            y = geo.bounds.centerLonLat.lat;
        } else {
            x = geo.x;
            y = geo.y;
        }

        var latlon = OpenLayers.Layer.SphericalMercator.inverseMercator(x, y);

        return "https://www.waze.com/editor/?env=usa&lon=" + latlon.lon + "&lat=" + latlon.lat + "&zoom=5&venues=" + venue.attributes.id;
    }
    function getId(node) {
        return document.getElementById(node);
    }
    function getElementsByClassName(classname, node) {
        if (!node) {
            node = document.getElementsByClassName("body")[0];
        }
        var a = [];
        var re = new RegExp("\\b" + classname + "\\b");
        var els = node.getElementsByTagName("*");
        for (var i = 0, j = els.length; i < j; i++) {
            if (re.test(els[i].className)) {
                a.push(els[i]);
            }
        }
        return a;
    }
    function addTab() {
        var userTabs = getId("user-info");
        var navTabs = getElementsByClassName("nav-tabs", userTabs)[0];
        var tabContent = getElementsByClassName("tab-content", userTabs)[0];
        var newTab = document.createElement("li");
        newTab.innerHTML = "<a title=\'Place Update Requests\' href=\'#sidepanel-wme-pur\' data-toggle=\'tab\'>PUR</a>";
        navTabs.appendChild(newTab);
        var addon = document.createElement("section");
        var html = "<div><h3>Place Update Request Export</h3>" +
            "<div><button id=\'_purScan\' title=\'Scan\'>Scan</button></div><br />" +
            "<table border=\"0\" style=\"border-collapse: separate; border-spacing: 4px 0px\">" +
            "<tr><td colspan=\"2\"><input id=\"_purUseUROPlaceOps\" type=\"checkbox\">Use URO+ Options</td></tr>" +
            "<tr><td colspan=\"2\"><input id=\"_purSplitUpdates\" type=\"checkbox\">Split Updates</td></tr>" +
            "</table>";
        addon.innerHTML = html;
        addon.id = "sidepanel-wme-pur";
        addon.className = "tab-pane";
        tabContent.appendChild(addon);

        purSplitUpdates = (localStorage.purSplitUpdates == "true" ? true : false);
        purUseUROPlaceOps = (localStorage.purUseUROPlaceOps == "true" ? true : false);

        $("[id=_purSplitUpdates]")[0].checked = purSplitUpdates;
        $("[id=_purSplitUpdates]")[0].onclick = function() {
                localStorage.purSplitUpdates = $("[id=_purSplitUpdates]")[0].checked;
            };
        $("[id=_purUseUROPlaceOps]")[0].checked = purUseUROPlaceOps;
        $("[id=_purUseUROPlaceOps]")[0].onclick = function() {
                localStorage.purUseUROPlaceOps = $("[id=_purUseUROPlaceOps]")[0].checked;
            };

        getId("_purScan").onclick = scanVenues;
    }



    function scanVenues() {

        purSplitUpdates = (localStorage.purSplitUpdates == "true" ? true : false);
        purUseUROPlaceOps = (localStorage.purUseUROPlaceOps == "true" ? true : false);

        if (purUseUROPlaceOps && (typeof localStorage.UROverviewPlacesOptions !== undefined)) {
            var tmpUROSettings = localStorage.UROverviewPlacesOptions.split(":");
            tmpUROSettings.forEach(function(uroSetting) {
                    if (uroSetting !== "") {
                        var tmpSplit = uroSetting.split(',');
                        UROPlaceSettings[tmpSplit[0]] = tmpSplit[1];
                    }
                });
        } else if (purUseUROPlaceOps && (typeof localStorage.UROverviewPlacesOptions === undefined)) {
            purUseUROPlaceOps = false;
        }

        venueLoop:
        for (var mVenue in Waze.map.placeUpdatesLayer.markers) {
            var venue = Waze.model.venues.get(mVenue);

            // Use URO Place Filters //
            if (purUseUROPlaceOps) {

                //if (UROPlaceSettings[_cbFilterPrivatePlaces]  == "true" && venue.attributes.residential) {
                if (($("[id='_cbFilterPrivatePlaces']").length > 0) && $("[id='_cbFilterPrivatePlaces']")[0].checked && venue.attributes.residential) {
                    continue;
                }

                // Skip as uneditable //
                // if (UROPlaceSettings[_cbFilterUneditablePlaceUpdates] == "true" && venue.attributes.lockRank > Waze.loginManager.user.rank) {
                if (($("[id='_cbFilterUneditablePlaceUpdates']").length > 0) && $("[id='_cbFilterUneditablePlaceUpdates']")[0].checked  && venue.attributes.lockRank > Waze.loginManager.user.rank) {
                    continue;
                }

                // Adlocked //
                // if (UROPlaceSettings[_cbHidePlacesAdLocked] == "true" && venue.attributes.adLocked) {
                if (($("[id='_cbHidePlacesAdLocked']").length > 0) && $("[id='_cbHidePlacesAdLocked']")[0].checked && venue.attributes.adLocked) {
                    continue;
                }

                // Filter on Categories //
                if (venue.attributes.categories.length > 0) {
                    catLoop:
                    for(var catIDX = 0; catIDX < venue.attributes.categories.length; catIDX++) {
                        var tCat = venue.attributes.categories[catIDX];
                        var tKey = "_cbPlacesFilter-" + tCat;
                        if (($("[id='" + tKey + "']").length > 0) && $("[id='" + tKey + "']")[0].checked) {
                        //if (UROPlaceSettings[tKey] == "true") {
                            continue venueLoop;
                        }

                    }
                }

            } // End Use URO Place Filters //


            venues.push(venue);
        }


        if (venues.length === 0) {
            console.log("WMEPUR: No venues pending updates");
        } else {
            var lineArray = [];
            var columnArray = ["data:text/csv;charset=utf-8,Name","House Number","Street","City","State","New Place","Type","Lock Level","Permalink"];

            if (purSplitUpdates) {
                columnArray.push("UpdateType");
                columnArray.push("UpdateDate");
            } else {
                columnArray.push("UpdateCount");
                columnArray.push("OldestUpdate");
            }
            lineArray.push(columnArray);
            fileName = "PlaceUpdateReqs.csv";

            for(var idxVenue = 0; idxVenue < venues.length; idxVenue++) {
                var mVenue = venues[idxVenue];
                var pl = getVenuePL(mVenue);
                var venueAddy = getAddress(mVenue);
                mVenue.attributes.venueUpdateRequests.sort(function(a,b) {
                        return (a.attributes.dateAdded - b.attributes.dateAdded);
                    });

                if (!purSplitUpdates) {
                    var lUpdate = new Date(mVenue.attributes.venueUpdateRequests[0].attributes.dateAdded);

                    columnArray = ["\"" + mVenue.attributes.name + "\"", "\"" + (venueAddy.HN || "") + "\""];
                    columnArray.push("\"" + venueAddy.Street + "\"");
                    columnArray.push("\"" + venueAddy.City + "\"");
                    columnArray.push("\"" + venueAddy.State + "\"");
                    columnArray.push("\"" + (mVenue.attributes.venueUpdateRequests[0].attributes.updateType == "ADD_VENUE" ? "True" : "False") + "\"");
                    columnArray.push("\"" + (mVenue.attributes.residential ? "Residential" : mVenue.attributes.categories[0]) + "\"");
                    columnArray.push("\"" + (mVenue.attributes.lockRank + 1) + "\"");
                    columnArray.push("\"" + pl + "\"");
                    columnArray.push("\"" + mVenue.attributes.venueUpdateRequests.length.toString() + "\"");
                    columnArray.push("\"" + reformatDate(lUpdate) + "\"");
                    lineArray.push(columnArray.join(","));
                } else {
                    for (var idxUpdate = 0; idxUpdate < mVenue.attributes.venueUpdateRequests.length; idxUpdate++) {
                        var lUpdate = new Date(mVenue.attributes.venueUpdateRequests[idxUpdate].attributes.dateAdded);

                        columnArray = ["\"" + mVenue.attributes.name + "\"", "\"" + (venueAddy.HN || "") + "\""];
                        columnArray.push("\"" + venueAddy.Street + "\"");
                        columnArray.push("\"" + venueAddy.City + "\"");
                        columnArray.push("\"" + venueAddy.State + "\"");
                        columnArray.push("\"" + (mVenue.attributes.venueUpdateRequests[idxUpdate].attributes.updateType == "ADD_VENUE" ? "True" : "False") + "\"");
                        columnArray.push("\"" + (mVenue.attributes.residential ? "Residential" : mVenue.attributes.categories[0]) + "\"");
                        columnArray.push("\"" + (mVenue.attributes.lockRank + 1) + "\"");
                        columnArray.push("\"" + pl + "\"");
                        columnArray.push("\"" + mVenue.attributes.venueUpdateRequests[idxUpdate].attributes.updateType + "\"");
                        columnArray.push("\"" + reformatDate(lUpdate) + "\"");
                        lineArray.push(columnArray.join(","));
                    }

                }
            }

            var csvContent = lineArray.join("\n");
            var encodedUri = encodeURI(csvContent);
            var link = document.createElement("a");
            link.href = encodedUri;
            link.setAttribute("download",fileName);
            var node = document.body.appendChild(link);
            link.click();
            document.body.removeChild(node);

        }
    }

    bootstrap_PlaceUpdateReqs();

})();
