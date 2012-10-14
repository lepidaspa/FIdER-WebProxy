/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/13/12
 * Time: 6:35 PM
 * To change this template use File | Settings | File Templates.
 */


var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var objtypes = { 'LineString': 'tratte', 'Points': 'punti'};


var proxy_id;
var proxy_type;
var proxy_man;
var proxy_maps;
var proxy_meta;

var proxymap;
var proxymap_metalayer;
var proxymap_activemeta;
var proxymap_activemap;


var cmeta_id;

function pageInit (req_proxy_id, req_proxy_type, req_manifest, req_proxy_maps)
{

    initForms();

    proxy_id = req_proxy_id;
    proxy_type = req_proxy_type;
    proxy_man = req_manifest;
    proxy_maps = req_proxy_maps;

    proxy_meta = {};
    for (var i in proxy_man['metadata'])
    {
        var cmeta = proxy_man['metadata'][i];
        proxy_meta[cmeta['name']] = cmeta;
    }

    console.log("Data for proxy "+proxy_id);
    console.log(proxy_maps);

    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    buildMapWidget();
    populateMapWidget();


    // TODO: solve flicker when moving between table cells
    $(".metainfo").on('hover', highlightMeta);
    $(".mapcard").on('hover', highlightMap);
    $(".metainfo").on('mouseleave', clearHighlights);
    $(".mapcard").on('mouseleave', clearHighlights);

    $(".newdata").on('click', addNewSource);

    $("#newfile_chooser").change(checkCandidateFilename);
    $(".removedata").on('click', removeDataSource);
}

function initForms ()
{
    $("#form_newfile").dialog({
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
                id : "form_newfile_upload",
                text: "Carica",
                click: tryUploadNewFile
            }
        }
    });

    $("#progress_newdata").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto"
    });

    $("#progress_removal").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto"
    });

    $("#form_newwfs").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false
    });

    $("#form_newquery").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false
    });

    $("#form_removesource").dialog({
        autoOpen:   false,
        modal:      true,
        width:      "auto",
        closeOnEscape: false,
        buttons: {
            "Annulla": {
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Elimina": {
                id : "form_removesource_confirm",
                text: "Elimina",
                click: applyDataRemove
            }
        }
    });

}


function removeDataSource ()
{

    console.log("Asking confirmation to remove data source "+this.id);

    var prefix = 'remove_';
    var dest = this.id.substr(prefix.length).split("-");

    cmeta_id = dest[0];
    var map_id = dest[1];

    var maptype;
    if ($(this).hasClass('remove_file'))
    {
        maptype = "shape";
    }
    else if ($(this).hasClass('remove_wfs'))
    {
        maptype = "WFS";
    }
    if ($(this).hasClass('remove_query'))
    {
        maptype = "query";
    }

    var deletefrom;
    if (cmeta_id != '.st')
    {
        deletefrom = " dal catalogo " + cmeta_id + "?";
    }
    else
    {
        deletefrom = " dall'Area di lavorazione?";
    }

    var removedetails = "" +
        "<br>Eliminare i dati " + maptype + " " + map_id + deletefrom;


    $("#form_removesource").dialog("open");
    $("#dataremove_details").empty();
    $("#dataremove_details").append(removedetails);

    $("#form_removesource_confirm").attr('name', 'remove_'+cmeta_id+"-"+map_id);


}


function applyDataRemove()
{

    var prefix = 'remove_';
    var dest = $("#form_removesource_confirm").attr('name').substr(prefix.length).split("-");

    var meta_id = dest[0];
    var map_id = dest[1];


    console.log("Data removal requested for source "+meta_id+"/"+map_id);

    var controldict = {
        'action': 'delete',
        'proxy_id': proxy_id,
        'meta_id': meta_id,
        'shape_id': map_id
    };

    console.log(controldict);

    $("#form_removesource").dialog("close");
    $("#progress_removal").dialog("open");
    $("#progress_removal .progressinfo").hide();
    $("#progspinner_removal").show();
    $("#progress_stage_removereq").show();


    $.ajax({
        url: "/fwp/control/",
        async: true,
        data: controldict,
        type: 'POST',
        success: function(data)
        {

            $("#progress_stage_removereq").hide();
            $("#progspinner_removal").hide();

            if (data['success'] == true)
            {
                $("#progress_removal .progressinfo").hide();
                $("#removalfinished_success").show();
            }
            else
            {
                $("#progress_removal .progressinfo").hide();
                $("#removalfinished_fail").show();
                $("#removalfail_explain").empty();
                $("#removalfail_explain").append(data['report']);
                $("#removalfail_explain").show();
            }


        },
        error: function (data)
        {
            $("#progspinner_removal").hide();
            $("#progress_removal .progressinfo").hide();
            $("#progress_stage_removereq").hide();
            $("#removalfinished_fail").show();
            $("#removalfail_explain").empty();
            $("#removalfail_explain").append(data['report']);
            $("#removalfail_explain").show();


        }
    });



}

function addNewSource ()
{
    /*
        TODO LIST (mode support):
        - WFS                   new_wfs
        - QUERY                 new_query
    */



    if ($(this).hasClass('new_file'))
    {
        addNewSource_File(this.id);
    }
    else if ($(this).hasClass('new_wfs'))
    {
        addNewSource_WFS(this.id);
    }
    else if ($(this).hasClass('new_query'))
    {
        addNewSource_Query(this.id);
    }

}

function addNewSource_File(callerid)
{
    var prefix = 'new_file_';
    var dest = callerid.substr(prefix.length).split("-");

    cmeta_id = dest[1];

    $("#warning_fileoverwrite").hide();
    $("#warning_fileformatwrong").hide();
    $("#newfile_chooser").val(null);
    $("#form_newfile_upload").prop("disabled", true);
    $("#form_newfile").dialog("open");

}

function getMapIdFromPath (filepath)
{

    var splitpath = filepath.split("\\");
    if (splitpath.length == 1)
    {
        splitpath = splitpath[0].split("/");
    }

    // removing any extensions too
    var map_id= splitpath[splitpath.length-1].split(".")[0];

    return map_id;

}

function checkCandidateFilename()
{

    $("#warning_fileoverwrite").hide();
    $("#warning_fileformatwrong").hide();

    var mapfilepath = $("#newfile_chooser").val();
    var mapfilename = getMapIdFromPath(mapfilepath);

    console.log("Veryfing new filename "+mapfilepath+" ("+mapfilename+") compared to existing maps for meta "+cmeta_id);

    var pathextension = mapfilepath.split(".");

    if (pathextension[pathextension.length-1] != 'zip')
    {
        console.log("New file has extension "+mapfilepath.split(".")[-1]);
        $("#warning_fileformatwrong").show();
        $("#form_newfile_upload").prop("disabled", true);
        return;
    }


    var maplist = [];
    for (var map_id in proxy_maps[cmeta_id])
    {
        maplist.push(map_id);
    }

    if (maplist.indexOf(mapfilename) != -1)
    {
        console.log("Map id "+map_id+" found in maplist ");
        console.log(maplist);
        $( "#warning_fileoverwrite").show();
    }

    $("#form_newfile_upload").prop("disabled", false);

}


function tryUploadNewFile()
{

    var filepath = $("#newfile_chooser").val();
    var map_id = getMapIdFromPath(filepath);
    var urlstring = "/fwp/upload/"+proxy_id+"/"+cmeta_id+"/";

    // and now for some black magic...

    var fd = new FormData();
    fd.append('shapefile', $('#newfile_chooser')[0].files[0]);
    $("#form_newfile").dialog("close");
    $("#progress_newdata").dialog("open");
    $("#progress_newdata .progressinfo").hide();
    $("#progspinner_newdata").show();
    $("#progress_stage_uploading").show();

    $.ajax ({
        url: urlstring,
        data:   fd,
        async: true,
        processData:    false,
        contentType:    false,
        type: 'POST',
        success: function(data) {
            if (data['success'] == true)
            {
                $("#progress_newdata .progressinfo").hide();
                rebuildShapeData(cmeta_id, map_id);
            }
            else
            {
                $("#progress_newdata .progressinfo").hide();
                $("#progspinner_newdata").hide();
                $("#uploadfinished_fail").show();
                $("#uploadfail_explain").append(data['report']);
                $("#uploadfail_explain").show();
            }
        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").append(data['report']);
            $("#uploadfail_explain").show();
        }

    });

}

function rebuildShapeData (meta_id, map_id)
{

    $("#progspinner_newdata").show();
    $("#progress_stage_uploading").hide();
    $("#progress_stage_adapting").show();

    // launches an ajax request to the server for re-parsing a map in the upload directory

    var urlstring;
    urlstring = "/fwp/rebuild/"+proxy_id+"/"+meta_id+"/"+map_id+"/";

    $.ajax ({
        url:            urlstring,
        async:          true,
        success: function(data) {
            $("#progspinner_newdata").hide();
            $("#progress_newdata .progressinfo").hide();
            $("#uploadfinished_success").show();

        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").append(data['report']);
            $("#uploadfail_explain").show();
        }
    });



}


function addNewSource_WFS (callerid)
{

    var prefix = 'new_wfs_';
    var dest = callerid.substr(prefix.length).split("-");

    var dest_proxy = dest[0];
    var dest_meta = dest[1];

    $( "#form_newwfs" ).dialog( "open" );

}

function addNewSource_Query (callerid)
{

    var prefix = 'new_query_';
    var dest = callerid.substr(prefix.length).split("-");

    var dest_proxy = dest[0];
    var dest_meta = dest[1];

    $("#form_newquery").dialog("open");

}




function clearHighlights ()
{
    proxymap_activemeta.destroyFeatures();
    proxymap_activemap.destroyFeatures();
}

function highlightMeta()
{

    var prefix = "metacard_";
    var track_meta = this.id.substr(prefix.length).split("-");

    //console.log("Id for metacard: "+this.id);
    //console.log(track_meta);

    proxymap_activemeta.destroyFeatures();
    var bbox = getBbox (track_meta[1]);
    proxymap_activemeta.addFeatures(bboxToFeature(bbox, proxymap));


}

function highlightMap()
{

    var prefix = "mapcard_";
    var track_map = this.id.substr(prefix.length).split("-");

    //console.log("Id for mapcard: "+this.id);
    //console.log(track_map);

    proxymap_activemap.destroyFeatures();
    var bbox = getBbox (track_map[1], track_map[2]);
    proxymap_activemap.addFeatures(bboxToFeature(bbox, proxymap));

    proxymap_activemeta.destroyFeatures();
    var bbox = getBbox (track_map[1]);
    proxymap_activemeta.addFeatures(bboxToFeature(bbox, proxymap));


}




function getBbox (meta_id, map_id)
{

    try
    {
        if (proxy_maps[meta_id][map_id]['bbox'])
        {
            return proxy_maps[meta_id][map_id]['bbox'];
        }
        else
        {
            return proxy_meta[meta_id]['area'];
        }
    }
    catch (ex)
    {
        try
        {
            return proxy_meta[meta_id]['area'];
        }
        catch (ex)
        {
            return proxy_man['area'];
        }

    }

}


function populateMapWidget()
{

    /*
    Draws the bounding box for each metadata on the map
     */

    var bboxes = [];
    for (var meta_id in proxy_maps)
    {
        //var metabbox = proxy_meta[meta_id]['area'];
        var metabbox = getBbox (meta_id);

        console.log("Rendering bbox for "+meta_id);
        console.log(metabbox);

        bboxes.push(bboxToFeature(metabbox, proxymap));
    }

    proxymap_metalayer.addFeatures(bboxes);

}


function buildMapWidget()
{

    proxymap = new OpenLayers.Map('proxymap', {controls: []});
    proxymap.projection = proj_WGS84;
    proxymap.displayProjection = new OpenLayers.Projection(proj_WGS84);


    //Base Maps from Google
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Physical", {
        type : google.maps.MapTypeId.TERRAIN,

        visibility : false
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Streets", {
        numZoomLevels : 20,
        visibility : false
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Hybrid", {
        type : google.maps.MapTypeId.HYBRID,
        numZoomLevels : 20,
        visibility : false
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Satellite", {
        type : google.maps.MapTypeId.SATELLITE,
        numZoomLevels : 20
    }));



    var osmlayer = new OpenLayers.Layer.OSM();
    proxymap.addLayer(osmlayer);


    var featurestyle = new OpenLayers.Style ({fillOpacity: 0.2, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "dash"});
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_metalayer = new OpenLayers.Layer.Vector("Cataloghi", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_metalayer);

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.2, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_activemeta = new OpenLayers.Layer.Vector("Catalogo attivo", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_activemeta);

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#009900", strokeColor: "#009900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_activemap = new OpenLayers.Layer.Vector("Mappa attiva", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_activemap);

    proxymap.addControl(new OpenLayers.Control.Navigation());
    proxymap.addControl(new OpenLayers.Control.PanZoomBar());
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
    proxymap.addControl(switcher);

    zoomToBBox(proxymap, proxy_man['area']);

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


function bboxToFeature (bbox, olmap)
{

    var points = [
        reprojPoint(bbox[0], bbox[1], olmap),
        reprojPoint(bbox[2], bbox[1], olmap),
        reprojPoint(bbox[2], bbox[3], olmap),
        reprojPoint(bbox[0], bbox[3], olmap)
    ];
    var ring = new OpenLayers.Geometry.LinearRing(points);
    var polygon = new OpenLayers.Geometry.Polygon([ring]);

    return new OpenLayers.Feature.Vector(polygon, {});
}










