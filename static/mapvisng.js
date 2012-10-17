/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/17/12
 * Time: 11:36 AM
 * To change this template use File | Settings | File Templates.
 */


var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var objtypestrings = { 'LineString': 'tratte', 'Point': 'punti'};
var objtypes = [ 'LineString', 'Point' ];



var proxy_id;
var meta_id;
var map_id;

// bounding boxes
var bb_proxy;
var bb_meta;
var bb_map;

var proxy_name;
var proxy_type;
var proxy_meta;
var proxy_man;

var proxy_maps;

var vismode;


// geography and details of the current map
var mapdata;




var menufunctions = {
    'menu_createnewmap': funcCreateMap,
    'menu_loadmap': funcLoadMap,
    'menu_integratemap': funcIntegrateMap,
    'menu_integratemodel': funcIntegrateModel,
    'menu_savemap': funcSaveMap,
    'menu_geoshift': funcGeoShift,
    'menu_loadsnap': funcLoadSnap,
    'menu_showmap': funcShowMap,
    'menu_showmodel': funcShowModel
}




// map widget used with OpenLayers
var mapview;
// vector layer on the map
var vislayer;
// vector layer used for alignment
var snaplayer;
// vector layer used for highlighting features, goes UNDER vislayer and OVER snaplayer
var filterlayer;

// format used to translate and output coordinates from the map
var gjformat;



function pageInit( req_proxy_id, req_meta_id, req_map_id, req_mode, req_proxy_type, req_manifest, req_proxy_maps)
{

    proxy_id = req_proxy_id;
    proxy_type = req_proxy_type;
    meta_id = req_meta_id;
    map_id = req_map_id;

    vismode = req_mode;

    proxy_man = req_manifest;

    proxy_name = proxy_man['name'];
    proxy_meta = {};
    for (var i in proxy_man['metadata'])
    {
        var cmeta = proxy_man['metadata'][i];
        proxy_meta[cmeta['name']] = cmeta;
    }

    bb_proxy = proxy_man['area'];


    bb_meta = {};
    for (var cmeta_id in proxy_meta)
    {
        bb_meta[cmeta_id] = proxy_meta[cmeta_id]['area'];
    }

    proxy_maps = req_proxy_maps;




    initMenu();
    initForms();

    if (vismode != 'modeler')
    {
        console.log("Showing map widget");
        initMapWidget();
        setMapControlsNav();
    }
    else
    {
        $("#mapview").hide();
    }




}


function initMenu()
{
    // flexmenu submenu menuopt
    $(".submenu").live('click', toggleMenuItems);
    $(".menuopt").live('click', interceptCallback);

    var menusections = $("#opsmenu>.submenu");

    for (var i = 0; i < menusections.length; i++)
    {
        $(menusections[i]).children().hide();
    }
}

function toggleMenuItems ()
{

    console.log(this);

    var visibles = $(this).children(":visible");
    var hidden = $(this).children(":hidden");

    visibles.hide();
    hidden.show();
}

function interceptCallback ()
{
    var callerid = this.id;
    console.log("Intercepted callback for "+callerid);
    //console.log(menufunctions[callerid]);

    menufunctions[callerid]();


    // stop propagation
    return false;

}

// generic forms to be activated later by the user (or programmatically)

function initForms()
{

    $("#form_loadmap").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Carica": {
                id : "form_newfile_confirmload",
                text: "Carica",
                click: tryLoadMap
            }
        }
    });



    $("#progress_upload").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto"
    });


    // bindings for form-connected elements
    $("#newmap_load").live("change", verifyMapLoadSelection);
    $("#uploadfield").live("change", updateUploadSelector);

}


// MENU DRIVEN FUNCTIONS

// all functions have the prefix "func" to distinguish them as menu launchers from actual "system" functions

function funcCreateMap ()
{
    //TODO: placeholder, implement
    console.log("opening map creation dialog");
}

function funcLoadMap ()
{

    // opens the map loading dialog

    //TODO: placeholder, implement
    console.log("opening map loading dialog");

    $("#newmap_load").val("");
    $("#form_loadmap").dialog("open");
    verifyMapLoadSelection();

}

function funcIntegrateMap ()
{
    //TODO: placeholder, implement
    console.log("opening map integration dialog");
}

function funcIntegrateModel ()
{
    //TODO: placeholder, implement
    console.log("opening model integration dialog");
}

function funcSaveMap ()
{
    //TODO: placeholder, implement
    console.log("opening map saving dialog");
}

function funcGeoShift ()
{
    //TODO: placeholder, implement
    console.log("opening geoshifting dialog");
}

function funcLoadSnap ()
{
    //TODO: placeholder, implement
    console.log("opening shadow map loading dialog");
}

function funcShowMap ()
{
    //TODO: placeholder, implement
    console.log("switching to map display");
}

function funcShowModel ()
{
    //TODO: placeholder, implement
    console.log("switching to model display");
}

// END OF MENU FUNCTIONS

function tryLoadMap ()
{

    $("#form_loadmap").dialog("close");
    var upreq = $("#newmap_load").val();
    var contentreq = upreq.split("/");

    if (contentreq[0] == '.file/')
    {
        // load from file
        uploadFileToStandalone();
    }
    else
    {
        // load from instance
    }


    //TODO: placeholder, implement
}


function uploadFileToStandalone()
{
    // inserts a file from the user's system in the workflow. What to do with the file will be handled later

    $("#progress_upload").dialog("open");
    $("#progress_upload .progressinfo").hide();
    $("#progspinner_upload").show();
    $("#progress_stage_uploading").show();

    var urlstring = "/fwst/upload/"+proxy_id+"/";

    var fd = new FormData();
    var uploadfilename = $('#uploadfield').val();
    fd.append('shapefile', $('#uploadfield')[0].files[0]);

    $.ajax ({
        url: urlstring,
        data:   fd,
        async: true,
        processData:    false,
        contentType:    false,
        type: 'POST',
        success: verifyUploadToStandalone,
        error: function() {
            $("#progress_upload .progressinfo").hide();
            $("#progspinner_upload").hide();
            $("#upload_fail").show();
        }
    });

}

function verifyUploadToStandalone (data, textStatus, jqXHR) {
    $("#progress_upload .progressinfo").hide();
    $("#progspinner_upload").hide();


    if (data['success'] == true)
    {
        $("#upload_success").show();
        var mapname =  $("#newmap_load").val().split("/")[1].replace(".zip","");
        getUploadedMap(".st", mapname);

        // TODO: add to list of files on the file picker for maps

    }
    else
    {
        $("#upload_fail").show();
        $("#uploadfail_explain").append(data);
    }

}

function getUploadedMap(meta_id, map_id)
{
    $("#progress_upload").dialog("close");




}


function initMapWidget()
{



    OpenLayers.Lang.setCode("it");
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    // resetting the widget in case there is an older map and we are loading a new one
    $("#mapview").empty();

    mapview = new OpenLayers.Map("mapview", {controls: []});
    mapview.projection = proj_WGS84;
    mapview.displayProjection = new OpenLayers.Projection(proj_WGS84);




    //Base Maps from Google
    mapview.addLayer(new OpenLayers.Layer.Google("Google Physical", {
        type : google.maps.MapTypeId.TERRAIN,
        numZoomLevels : 20,
        visibility : false
    }));
    mapview.addLayer(new OpenLayers.Layer.Google("Google Satellite", {
        type : google.maps.MapTypeId.SATELLITE,
        numZoomLevels : 20
    }));
    mapview.addLayer(new OpenLayers.Layer.Google("Google Streets", {
        numZoomLevels : 20,
        visibility : false
    }));
    mapview.addLayer(new OpenLayers.Layer.Google("Google Hybrid", {
        type : google.maps.MapTypeId.HYBRID,
        numZoomLevels : 20,
        visibility : false
    }));


    var osmlayer = new OpenLayers.Layer.OSM();
    mapview.addLayer(osmlayer);



    // setting the format to translate geometries out of the map
    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': mapview.getProjectionObject()});

    var featurestyle;
    var featurestylemap;


    // styling the layers


    // SNAP layer
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#888888", strokeColor: "#888888", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 8});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    snaplayer= new OpenLayers.Layer.Vector("Allineamento", {styleMap: featurestylemap});

    // FILTER layer
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#188E01", strokeColor: "#188E01", strokeWidth: 6, strokeDashstyle: "solid", pointRadius: 10});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    filterlayer = new OpenLayers.Layer.Vector("Filtro", {styleMap: featurestylemap});

    // VIS layer
    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#FF9900", strokeColor: "#FF9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});
    vislayer= new OpenLayers.Layer.Vector("Mappa", {styleMap: featurestylemap});

    mapview.addLayers([snaplayer, filterlayer, vislayer]);



    autoZoom(mapview);







    // TODO: set controls according to vismode

    // mapview has navigation and geocoding only
    // model has no map widget so we do not care

}

function setMapControlsNav ()
{
    // draws the generic nav controls, contextual controls are in another function
    mapview.addControl(new OpenLayers.Control.Navigation());
    mapview.addControl(new OpenLayers.Control.PanZoomBar());
    mapview.addControl(new OpenLayers.Control.MousePosition());


    //Inheriting of OpenLayers.Control.LayerSwitcher
    ItaLayerSwitcher.prototype = new OpenLayers.Control.LayerSwitcher;           // Define sub-class
    ItaLayerSwitcher.prototype.constructor = ItaLayerSwitcher;
    function ItaLayerSwitcher()
    {
        OpenLayers.Control.LayerSwitcher.call(this, { displayClass: "olLabsLayerSwitcher"});                                         // derived constructor = call super-class constructor
    }

    ItaLayerSwitcher.prototype.loadContents = function()                                 // redefine Method
    {
        OpenLayers.Control.LayerSwitcher.prototype.loadContents.call(this);         // Call super-class method
        this.baseLbl.innerHTML = 'Sfondi';                                   //change title for base layers
        this.dataLbl.innerHTML = 'Livelli';                                   //change title for overlays (empty string "" is an option, too)
    };

    var switcher = new ItaLayerSwitcher();



    mapview.addControl(switcher);



}



function autoZoom (olmap)
{
    /*
     Checks if we have an active map and if it has a bbox. If not, zooms to the bbox of the meta, if we have it, or of the proxy itself
     */

    // used when called by the home button
    if (!olmap)
    {
        olmap = mapview;
    }

    console.log(bb_proxy);

    // pattern: we check for a "current" bbox, then we check for the loaded map bbox, or meta bbox, finally the proxy

    var zoomto;

    if (mapdata && mapdata.hasOwnProperty('bbox'))
    {
        console.log("Getting bbox from current data");
        zoomto = mapdata['bbox'];
    }
    else if (map_id != null)
    {

        try
        {
            if (proxy_maps[meta_id][map_id]['bbox']!=null)
            {
                console.log("Getting bbox from loaded map");
                zoomto = proxy_maps[meta_id][map_id]['bbox'];
            }
            else
            {
                console.log("Getting bbox from loaded map meta");
                zoomto = bb_meta[meta_id];
            }
        }
        catch (ex)
        {
            console.log("Getting bbox from proxy");
            zoomto = bb_proxy;
        }

    }
    else
    {
        console.log("Getting bbox from proxy");
        zoomto = bb_proxy;
    }


    zoomToBBox(olmap, zoomto);

}

function zoomToBBox (olmap, bbox)
{
    console.log("Moving to");
    console.log(bbox);

    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());
    olmap.zoomToExtent (bounds, true);

}


function verifyMapLoadSelection ()
{


    var upreq = $("#newmap_load").val();
    $("#warning_maploadwrongformat").hide();

    console.log("Checking maploader selection: "+upreq);


    if (upreq == "")
    {
        console.log("No selection, disabling");
        $("#form_newfile_confirmload").prop('disabled', true);
        return;
    }

    // if the user is on the file selection, we launch the dialog (and have a callback to update the file upload field
    if (upreq == ".file")
    {
        console.log("Opening client file selector");
        $("#uploadfield").trigger('click');
    }
    else if (upreq.substr(0,6)==".file/")
    {
        var splitstring = upreq.substr(6).split(".");
        var extension = splitstring[splitstring.length-1];
        console.log("Heuristic file format check on "+upreq+": "+extension);
        if (extension != 'zip')
        {
            $("#form_newfile_confirmload").prop('disabled', true);
            $("#warning_maploadwrongformat").show();
        }
        else
        {
            var fullname = splitstring[0];
            //TODO: add warning for overwrite
            $("#form_newfile_confirmload").prop('disabled', false);
        }
    }
    else
    {

        $("#form_newfile_confirmload").prop('disabled', false);
    }

}

function getFilenameFromPath (filepath)
{

    var splitpath = filepath.split("\\");
    if (splitpath.length == 1)
    {
        splitpath = splitpath[0].split("/");
    }

    return splitpath[splitpath.length-1];

}

function updateUploadSelector()
{

    console.log("updating uploader selection");
    var filename =  getFilenameFromPath($("#uploadfield").val());
    console.log(filename);
    // removing previously selected file

    $("#newmap_fileselection").remove();
    if (filename != "")
    {
        $("#newmap_section_fromfile").append('<option id="newmap_fileselection" value=".file/'+filename+'">'+filename+'</option>');
        $("#newmap_load").val(".file/"+filename);
    }
    else
    {
        $("#newmap_load").val("");
    }

    verifyMapLoadSelection();


}
