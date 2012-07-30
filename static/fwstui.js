/**
 * Created with PyCharm.
 * User: drake
 * Date: 7/28/12
 * Time: 6:51 AM
 * To change this template use File | Settings | File Templates.
 */

// current map data
var mapdata;

// setting globals

var proxy_id;
var proxy_name;
var proxy_bb;
var proxy_manifest;
// list of meta on the proxy
var proxy_meta;

// list of all available maps, stringified as meta_id/map_id or .st/map_id
var maplist;
// of which, federated
var maps_fider;
// and standalone
var maps_st;
// id of the map currently in use in the area/map format : null if no map has been created, .model/typename if based on a model and yet to be saved
var activemap = null;


// dict of all available models, by id
var models;

// full descriptor of the current model (with name and objtype)
var activemodel;

// Projection systems
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

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


// controls needed by the mapview
var snapcontrol;
var measurecontrol;
var editcontrol;
var drawcontrol;

// panel containing the controls
var panel;

function pageInit(req_proxy_id, req_proxy_manifest, req_proxy_meta, req_maps_fider, req_maps_st, req_models)
{

    proxy_id = req_proxy_id;
    proxy_manifest = req_proxy_manifest;
    proxy_meta = req_proxy_meta;

    proxy_name = req_proxy_manifest['name'];
    proxy_bb = req_proxy_manifest['area'];

    maplist = [];
    maps_fider = [];
    maps_st = [];

    var map_id;
    var meta_id;
    for (meta_id in req_maps_fider)
    {
        maps_fider[meta_id] = [];
        for (var m in req_maps_fider[meta_id])
        {
            map_id = req_maps_fider[meta_id][m];

            maplist.push(meta_id+"/"+map_id);
            maps_fider[meta_id].push(map_id);
        }
    }
    for (map_id in req_maps_st)
    {
        maps_st.push(req_maps_st[map_id]);
        maplist.push(".st/"+req_maps_st[map_id]);
    }

    models = req_models;


    uiReset();

    $("#ctx_sel_newmap").live("change", checkFileUpload);
    $("#uploadfield").live("change", updateUploadSelector);
    $("#btn_newmap").live("click", tryUploadMerge);

}

function lockContext()
{
    // disables interactions with the context area until the unlock function is called (e.g. during loadings)
    console.log("Disabling context during load");
    $("#contextloader select").prop('disabled', true);
    $("#contextloader input").prop('disabled', true);
}

function unlockContext()
{
    // re-enables interactions with the context area
    console.log("Re-enabling context during load");
    $("#contextloader select").prop('disabled', false);
    $("#contextloader input").prop('disabled', false);
}

function checkFileUpload()
{
    // triggered by the maploader, checks if the user wants to select a file from disk;
    // in case,it opens the file selection dialog from the hidden #uploadfield

    var upreq = $("#ctx_sel_newmap").val();

    // if the user is on the file selection, we launch the dialog (and have a callback to update the file upload field
    if (upreq.split("/")[0] == ".file")
    {
        $("#uploadfield").trigger('click');
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


function updateUploadSelector ()
{

    //TODO: verify this is ok with Windows browsers
    var filename =  getFilenameFromPath($("#uploadfield").val());

    console.log("Chosen file "+filename);
    $("#ctx_newmap_fileopt").text(filename);
    $("#ctx_newmap_fileopt").val(".file/"+filename);

}


function tryUploadMerge()
{

    console.log($("#sel_action_newmap").val()+" with "+$("#ctx_sel_newmap").val());

    lockContext();

    var contentreq = $("#ctx_sel_newmap").val().split("/");
    console.log(contentreq);

    var urlstring;
    if (contentreq[0] == '.file')
    {
        console.log("Uploading to standalone area");
        // NOTE on FLOW: IF uploaded from disk, first we load the object via ajax to the server, where it is parsed and added to the standalone area, then we load it down (and move the filename to the .st selection)
        uploadFileToStandalone();

    }
    else if (contentreq[0] == '.model')
    {
        // no upload, we simply add/reset the model

    }
    else
    {
        // we load the map from the standalone area/meta

    }

}

function uploadFileToStandalone()
{
    // inserts a file from the user's system in the workflow. What to do with the file will be handled later

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
        success: checkCompleteUpload,
        error: reportFailedUpload
    });

}

function checkCompleteUpload (data, textStatus, jqXHR)
{
    // TODO: placeholder, implement
    console.log("Reporting completed upload of the file in use");
    console.log(data);

    if (data['success'] == true)
    {
        reportFeedback(true, "Caricamento file completato");
        var mapname =  $("#ctx_sel_newmap").val().split("/")[1].replace(".zip","");
        getUploadedMap(".st", mapname);
    }
    else
    {
        reportFeedback(false, "Caricamento file fallito");
        //TODO: re-enable the selection fields
    }
}

function getUploadedMap (meta_id, map_id)
{

    // gets a map from either a metadata or the standalone area, then takes the action chosen earlier in the selector

    var urlstring;
    if (meta_id == ".st")
    {
        urlstring = "/fwst/"+proxy_id+"/"+map_id;
    }
    else
    {
        urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id;
    }

    $.ajax ({
        url:    urlstring,
        async:  true,
        success:    applyNewMap,
        error:  reportFailedDownload
    });

}

function applyNewMap (newdata, textStatus, jqXHR)
{

    reportFeedback(true, "Applicazione file completata");

    // takes the json data from the just downloaded map and applies it to the normal map or creates a new one as needed

    //actions are 'open' and 'merge'
    var action = $("#sel_action_newmap");
    console.log(newdata);
    console.log(action);

    // if no map is available, we always create
    if (activemap == null)
    {
        action = 'open';
    }



}


function reportFeedback (positive, message)
{

    $("#statemessage").empty();
    if (positive)
    {
        $("#statemessage").addClass("goodnews");
        $("#statemessage").removeClass("badnews");
    }
    else
    {
        $("#statemessage").removeClass("goodnews");
        $("#statemessage").addClass("badnews");
    }
    $("#statemessage").text(message);


}

function reportFailedUpload (xhr,err)
{
    // TODO: placeholder, implement
    console.log("Reporting failed upload of the file in use");
    console.log("readyState: "+xhr.readyState+"\nstatus: "+xhr.status);
    console.log("responseText: "+xhr.responseText);
    console.log(err);
}

function reportFailedDownload (xhr, err)
{
    // TODO: placeholder, implement
    console.log("Reporting failed download of the requested file");
    console.log("readyState: "+xhr.readyState+"\nstatus: "+xhr.status);
    console.log("responseText: "+xhr.responseText);
    console.log(err);
}

    function uiReset()
{
    // rebuilds the UI elements; does NOT reinit the elements and variables

    buildContext();
    buildLoader();

    buildMapWidget();
    buildSnapChooser();
    setMapControlsNav();

    if (activemap)
    {
        setMapControlsEdit();
    }

    $("#statemessage").empty();

}


function parseMapString (mapstring)
{
    return mapstring.split("/");
}


function buildContext()
{
    // renders the view_context div, with summary (data on what we are currently working on)
    // and the modifier selectors


    var ctx_main = $('<div class="ctx_fieldname">Mappa</div><div class="ctx_fieldval"></div>');

    if (activemap != null)
    {
        var contextdesc = proxy_id;
        var mapdesc = parseMapString(activemap);

        if (mapdesc[0] == '.st')
        {
            contextdesc += ' : ' + 'Area Standalone' + ' : ' + mapdesc[1];

        }
        else if (mapdesc[0] == '.model')
        {
            contextdesc = 'Nuova mappa (' + activemodel['name'] + ')';
        }
        else if (mapdesc[0] == '.file')
        {
            contextdesc = 'Da file: '+activemap;
        }
        else
        {
            contextdesc += " : " + mapdesc[0] + " : " + mapdesc[1];
        }
        ctx_main.children('ctx_fieldval').text(contextdesc);

    }
    else
    {
        ctx_main.children('ctx_fieldval').text('');
    }

    $("#contextsummary").empty();
    $("#contextsummary").append(ctx_main);

}


function buildMapList ()
{
    // returns the optgroups of maps currently available as jQuery object

    var ctx_mapsel = $('<optgroup label="Area Standalone"></optgroup>');
    for (var m in maps_st)
    {
        ctx_mapsel.append('<option value=".st/"'+maps_st[m]+'>'+maps_st[m]+'</option>');
    }

    for (var meta_id in maps_fider)
    {

        console.log("Adding maps for meta "+meta_id);
        console.log(maps_fider[meta_id]);

        var ctx_metamapsel = $('<optgroup label="'+meta_id+'"></optgroup>');
        for (m in maps_fider[meta_id])
        {

            var map_id = maps_fider[meta_id][m];
            ctx_metamapsel.append('<option value="'+meta_id+'/'+map_id+'">'+map_id+'</option>');
        }

        ctx_mapsel.append(ctx_metamapsel);
    }

    return ctx_mapsel;

}


function buildLoader()
{
    // creates the mask to load/add files and models to the current map

    var ctx_actionsel = '<select id="sel_action_newmap">' +
        '<option value="open">Apri/Crea</option>' +
        '<option value="merge">Integra</option>' +
        '</select>';

    var ctx_loadnew = $('<div class="ctx_fieldname">'+ctx_actionsel+'</div><div class="ctx_fieldval"><select id="ctx_sel_newmap"><option value=""></option><optgroup label="Da file"><option id="ctx_newmap_fileopt" value=".file">Seleziona...</option></optgroup></select><input type="button" value="&gt;&gt;" id="btn_newmap"></div>');

    var ctx_modelsel = $('<optgroup label="Modello"></optgroup>');
    for (var model_id in models)
    {
        ctx_modelsel.append('<option value=".model/'+model_id+'">'+models[model_id]['name']+'</option>');
    }


    ctx_loadnew.children('#ctx_sel_newmap').append(ctx_modelsel);
    ctx_loadnew.children('#ctx_sel_newmap').append(buildMapList());


    $("#contextloader").empty();
    $("#contextloader").append(ctx_loadnew);


}

function buildSnapChooser ()
{
    var ctx_snapchooser = $('<div class="ctx_fieldname">Allinea a</div><div class="ctx_fieldval"><select id="ctx_sel_snapmap"><option value=""></option></select><input type="button" value="&gt;&gt;" id="btn_newsnap"></div>');
    ctx_snapchooser.children('#ctx_sel_snapmap').append(buildMapList());

    $("#view_shadow").append(ctx_snapchooser);
}



function buildMapWidget()
{

    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    // resetting the widget in case there is an older map and we are loading a new one
    $("#view_map").empty();

    mapview = new OpenLayers.Map("view_map", {controls: []});
    mapview.projection = proj_WGS84;
    mapview.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var baselayer = new OpenLayers.Layer.OSM();
    mapview.addLayer(baselayer);

    // setting the format to translate geometries out of the map
    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': mapview.getProjectionObject()});

    var featurestyle;
    var featurestylemap;

    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#888888", strokeColor: "#888888", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "background" layer
    snaplayer= new OpenLayers.Layer.Vector("Riferimento", {styleMap: featurestylemap});
    mapview.addLayer(snaplayer);

    // setting style
    //featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    //featurestylemap = new OpenLayers.StyleMap(featurestyle);
    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#FF9900", strokeColor: "#FF9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});
    // adding the "state" layer
    vislayer= new OpenLayers.Layer.Vector("Mappa", {styleMap: featurestylemap});
    mapview.addLayer(vislayer);


    autoZoom(mapview);


}

function setMapControlsNav ()
{
    // draws the generic nav controls, contextual controls are in another function
    mapview.addControl(new OpenLayers.Control.Navigation());
    mapview.addControl(new OpenLayers.Control.PanZoomBar());
    mapview.addControl(new OpenLayers.Control.MousePosition());

}

function setMapControlsEdit ()
{

    // draws the editing controls that change by context (lines or points)
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
            {
                displayClass: "olLabsControlDrawFeaturePoint",
                title: "Aggiungi",
                handlerOptions:
                {
                    holeModifier: "altKey"
                },
                featureAdded: (createNewFeature)
            }
        );
    }
    else if (maptype == "LineString")
    {
        drawcontrol = new OpenLayers.Control.DrawFeature
            (
                vislayer, OpenLayers.Handler.Path,
                {
                    displayClass: "olLabsControlDrawFeaturePath",
                    title: "Aggiungi",
                    handlerOptions:
                    {
                        holeModifier: "altKey"
                    },
                    featureAdded: (createNewFeature)
                }
            );
    }



    editcontrol = new OpenLayers.Control.ModifyFeature(
        vislayer, {
            displayClass: "olLabsControlModifyFeature",
            title: "Modifica"
        }
    );


    measurecontrol = new OpenLayers.Control.Measure(

        OpenLayers.Handler.Path, {
            eventListeners:
            {
                'measure': handleMeasure,
                'measurepartial': handleMeasure,
                'deactivate': hideDistance
            },
            handlerOptions:
            {
                persist: true,
                immediate: true
            },
            displayClass: 'olLabsControlMeasure',
            displayUnits: 'm',
            title: "Misura"

        });



    // setting panel-based controls
    panel.addControls([
        //new OpenLayers.Control.Navigation({title: "Navigate"}),
        drawcontrol, editcontrol, measurecontrol
    ]);

    // binding controls to the map
    mapview.addControl(panel);


    vislayer.events.register('featureselected', mapview, renderFeatureCard);
    vislayer.events.register('featureunselected', mapview, freeSelection);


}



function autoZoom (olmap)
{
    /*
     Checks if we have an active map and if it has a bbox. If not, zooms to the bbox of the proxy
     */

    //console.log("Checking bbox, map and proxy");
    //console.log(olmap);
    if (activemap)
    {
        console.log(mapdata['bbox']);
    }

    console.log(proxy_bb);

    var zoomto = proxy_bb;
    if (activemap)
    {
        if (mapdata.hasOwnProperty['bbox'])
        {
            zoomto = mapdata['bbox'];
        }

    }

    zoomToBBox(olmap, zoomto);

}

function zoomToBBox (olmap, bbox)
{
    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());
    olmap.zoomToExtent (bounds, true);

}
