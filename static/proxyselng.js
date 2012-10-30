/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/25/12
 * Time: 3:24 PM
 * To change this template use File | Settings | File Templates.
 */

var proxies;

var keycode_ENTER = 13;
var keycode_ESC = 27;

var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var defaultLon = 11.1;
var defaultLat = 44.5;

var newproxymap;
var newmetamap;
var hpmap;



function pageInit(proxylist)
{

    proxies = proxylist;

    $("#tabsel_proxy").live('click', showSelProxy);
    $("#tabsel_standalone").live('click', showSelStandalone)

    showSelProxy();
    initForms();

    OpenLayers.Lang.setCode("it");
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

}

function showSelProxy ()
{
    $("#tabsel_standalone").addClass("unseltab");
    $("#tabsel_proxy").removeClass("unseltab");
    $("#instances_proxy").show();
    $("#instances_standalone").hide();
}


function showSelStandalone ()
{
    $("#tabsel_standalone").removeClass("unseltab");
    $("#tabsel_proxy").addClass("unseltab");
    $("#instances_proxy").hide();
    $("#instances_standalone").show();
}

function initForms()
{

    $("#btn_newdatasource_linker").live('click', initCreateLinked);
    $("#btn_newdatasource_standalone").live('click', initCreateStandalone);
    $("#btn_newdatasource_networked").live('click', initCreateReadWrite);
    $("#btn_newdatasource_query").live('click', initCreateQuery);


    $("#proxycreate_readwrite").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_readwrite",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_readwrite",
                text: "Crea",
                click: tryCreateReadWrite
            }
        }
    });
    $("#btn_newmetarw_create").button();


    $("#proxycreate_query").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_query",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_query",
                text: "Crea",
                click: tryCreateQuery
            }
        }
    });
    $("#btn_newmetaquery_create").button();

    $("#proxycreate_linked").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_linked",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_linked",
                text: "Crea",
                click: tryCreateLinked
            }
        }
    });

    $("#proxycreate_standalone").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_standalone",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_standalone",
                text: "Crea",
                click: tryCreateStandalone
            }
        }
    });

}

function initCreateReadWrite ()
{
    //TODO: placeholder, implement
    $(".tablemap").empty();
    $("#proxycreate_readwrite").dialog("open");
    newproxymap = initMiniMap("map_createreadwrite");
    newmetamap = initMiniMap("map_metareadwrite");
}




function tryCreateReadWrite()
{
    //TODO: placeholder, implement

}

function initCreateQuery ()
{
    //TODO: placeholder, implement
    $(".tablemap").empty();
    $("#proxycreate_query").dialog("open");
    newproxymap = initMiniMap("map_createquery");
    newmetamap = initMiniMap("map_metaquery");
}

function tryCreateQuery ()
{
    //TODO: placeholder, implement

}

function initCreateLinked ()
{
    //TODO: placeholder, implement
    $(".tablemap").empty();
    $("#proxycreate_linked").dialog("open");
}

function tryCreateLinked()
{
    //TODO: placeholder, implement
}

function initCreateStandalone()
{
    //TODO: placeholder, implement
    $(".tablemap").empty();
    $("#proxycreate_standalone").dialog("open");
    initMiniMap("map_createstandalone");
    initMiniMap("map_metastandalone");

}

function tryCreateStandalone()
{
    //TODO: placeholder, implement
}

function initMiniMap (eid)
{
    // creates a mini map with reduced controls on a specific div

    console.log("Setting map on element with id "+eid);

    // resetting the widget in case there is an older map and we are loading a new one
    //$("#"+eid).empty();
    //$(".tablemap").empty();

    var mapview = new OpenLayers.Map(eid, {controls: []});
    mapview.projection = proj_WGS84;
    mapview.displayProjection = new OpenLayers.Projection(proj_WGS84);

    //Base Maps from Google
    /*
    mapview.addLayer(new OpenLayers.Layer.Google("Google Physical", {

        type : google.maps.MapTypeId.TERRAIN,
        visibility : true,
        baselayer:  true
    }));
    */

    var osmlayer  = new OpenLayers.Layer.OSM();
    mapview.addLayer(osmlayer);

    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});

    var tracelayer = new OpenLayers.Layer.Vector("BoundingBox", {styleMap: featurestylemap});
    //console.log(tracelayer);
    //console.log(mapview);
    mapview.addLayer(tracelayer);

    zoomToCenter (mapview, defaultLon, defaultLat, 6);

    return mapview;
}


function zoomToCenter (widget, lon, lat, zoom)
{

    var lonlat = new OpenLayers.LonLat (lon, lat);
    var projected = lonlat.transform(new OpenLayers.Projection(proj_WGS84), widget.getProjectionObject());

    widget.setCenter(projected, zoom);

}