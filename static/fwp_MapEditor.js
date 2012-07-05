/**
 * Created with PyCharm.
 * User: drake
 * Date: 7/5/12
 * Time: 8:22 AM
 * To change this template use File | Settings | File Templates.
 */

// Projection systems
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

// data needed to load the map we are working on
var proxy_id;
var meta_id;
var map_id;
var proxy_name;

// list of all the maps available in the same metadata, to be used as additional layer and for snapping
var maps;

// the static corner map that show the general area of interest of the current file
// (does not include background files added to it)
var minimap;

// the map used for the actual editing work, in the center of the screen
var mapview;

// full json data for the main (editable) map
var coredata;
// full json data for the background map used for snap only
var snapdata;


// layer where we draw the current state of the main map
var vislayer;
// layer where we show the changes to the main map in realtime (single feature), once confirmed a change is moved to the vislayer
var modlayer;
// layer where we draw any additional map used for snapping purposes
var snaplayer;

var drawcontrol;
var editcontrol;
var snapcontrol;
var panel;

function pageInit (req_proxy, req_meta, req_map, req_maplist)
{
/*
Loads the main map and the list of additional maps
 */

    $("#renderingstate").hide();


    proxy_id = req_proxy;
    meta_id = req_meta;
    map_id = req_map;

    maps = jQuery.parseJSON(req_maplist);


    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    setLoadingState();
    loadMainMap();


    $("#sel_setshadow").change(setShadowLayer);




}

function setLoadingState()
{
    $("#loadingstate").show();



}

function unsetLoadingState()
{
    $("#loadingstate").hide();
}


function loadMainMap()
{
    /*
    Loads the json data of the map to be edited as an async operation, then renders it on the mini and main map
     */

    var urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id;


    $.ajax ({
        url:    urlstring,
        async:  true
    }).done(function (jsondata) {


        coredata = jsondata;



        //alert ("Loaded map "+map_id+"\n"+JSON.stringify(coredata));
        renderMiniMap('minimap');
        renderMainMap('mapview');
        unsetLoadingState();

    });



}


function renderMiniMap (widgetid)
{


    minimap = new OpenLayers.Map(widgetid, {controls: []});
    minimap.projection = proj_WGS84;
    minimap.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var layer = new OpenLayers.Layer.OSM();

    minimap.addLayer(layer);

    var bbox = (coredata['bbox']);
    zoomToBBox(minimap, bbox);

}

function setShadowLayer()
{
    // removes the current background layer and, if needed loads the new one

    snaplayer.removeAllFeatures();
    var newshadow = $("#sel_setshadow").val();
    if (newshadow != "")
    {
        loadShadowLayer(newshadow);
    }


}

function loadShadowLayer (map_id)
{
    /*
    Loads the "background" vector for the main map
     */


    var urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id;

    $.ajax ({
        url:    urlstring,
        async:  true
    }).done(function (jsondata) {

                snapdata = jsondata;


                renderGeoJSON (snapdata, mapview, snaplayer);


            });


}


function renderMainMap (widgetid)
{

    var maptype = coredata['features'][0]['geometry']['type'];
    //alert("Map type: "+maptype);

    mapview = new OpenLayers.Map('mapview', {controls: []});
    mapview.projection = proj_WGS84;
    mapview.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var baselayer = new OpenLayers.Layer.OSM();
    mapview.addLayer(baselayer);

    var featurestyle;
    var featurestylemap;

    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#ff0000", strokeColor: "#ff0000", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "background" layer
    snaplayer= new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    mapview.addLayer(snaplayer);

    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "state" layer
    vislayer= new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    mapview.addLayer(vislayer);


    renderGeoJSON (coredata, mapview, vislayer);


    /* TODO: check if we can work directly on the  vislayer layer
    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#00aaff", strokeColor: "#00aaff", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "work" layer
    modlayer= new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    mapview.addLayer(modlayer);
    */



    // add snap control
    snapcontrol = new OpenLayers.Control.Snapping ({
        layer: vislayer,
        targets: [vislayer, snaplayer],
        greedy: false
    });
    mapview.addControl(snapcontrol);
    snapcontrol.activate();


    // Adding editing controls
    panel = new OpenLayers.Control.Panel({
        displayClass: "olControlEditingToolbar"
    });

    if (maptype == "Point")
    {
        drawcontrol = new OpenLayers.Control.DrawFeature(
                vislayer, OpenLayers.Handler.Point,
                {displayClass: "olControlDrawFeaturePoint", title: "Draw Features", handlerOptions: {holeModifier: "altKey"}}
        );
    }
    else
    {
        drawcontrol = new OpenLayers.Control.DrawFeature(
                vislayer, OpenLayers.Handler.Path,
                {displayClass: "olControlDrawFeaturePoint", title: "Draw Features", handlerOptions: {holeModifier: "altKey"}}
        );
    }



    editcontrol = new OpenLayers.Control.ModifyFeature(
            vislayer, {displayClass: "olControlModifyFeature", title: "Modify Features"}
    );
    panel.addControls([
        new OpenLayers.Control.Navigation({title: "Navigate"}),
        drawcontrol, editcontrol
    ]);

    mapview.addControl(panel);









    var bbox = (coredata['bbox']);
    zoomToBBox(mapview, bbox);


    //alert(mapview.controls);

}

function renderGeoJSON (shapedata, map, maplayer)
{


    var geojson_format = new OpenLayers.Format.GeoJSON({'externalProjection':new OpenLayers.Projection(proj_WGS84), 'internalProjection':map.getProjectionObject()});

    var stringmap = JSON.stringify(shapedata);
    var formatmap = geojson_format.read(stringmap);
    maplayer.addFeatures(formatmap);


}



function zoomToBBox (olmap, bbox)
{
    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());
    olmap.zoomToExtent (bounds, true);


}


function reprojPoint (pointX, pointY, olmap)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());


    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}