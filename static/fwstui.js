/**
 * Created with PyCharm.
 * User: drake
 * Date: 7/28/12
 * Time: 6:51 AM
 * To change this template use File | Settings | File Templates.
 */

// current map data

//TODO: remove, used only for setting the bounding box, which will be wrecked anyway as soon as we merge two maps and should be handled differently
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

// fid of the current feature being edited
var cfid;

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
    $("#ctx_sel_snapmap").live("change", checkSnapLoad);
    $("#uploadfield").live("change", updateUploadSelector);
    $("#btn_newmap").live("click", tryUploadMerge);
    $("#btn_newsnap").live("click", tryLoadShadow);
    $("#btn_savemap").live("click", trySaveMap);
    $("#ctx_saveto").live("mouseup keyup change", checkSaveName);



}

function checkSnapLoad()
{
    var mapreq = $("#ctx_sel_snapmap").val();
    if (mapreq == "")
    {
        $("#btn_newsnap").prop("disabled", true);
    }
    else
    {
        $("#btn_newsnap").prop("disabled", false);
    }
}

function checkSaveName()
{
    // checks if the save widget has a valid name
    // ADDITION: now also checks if there is an activemap to be saved

    var cname = $("#ctx_saveto").val();

    if (cname.match(/^[A-Za-z0-9_]+$/)==null || !activemap)
    {
        console.log("Non valid filename "+cname);
        $("#btn_savemap").prop('disabled', true);
    }
    else
    {
        $("#btn_savemap").prop('disabled', false);

    }



}

function lockContext()
{
    // disables interactions with the context area until the unlock function is called (e.g. during loadings)
    console.log("Disabling context during load");
    $("#view_context select").prop('disabled', true);
    $("#view_context input").prop('disabled', true);

    $("#progspinner").show();

}

function unlockContext()
{
    // re-enables interactions with the context area
    console.log("Re-enabling context after load");
    $("#progspinner").hide();
    $("#view_context select").prop('disabled', false);
    $("#view_context input").prop('disabled', false);
    checkSaveName();

    //NOTE: bad
    if (activemodel)
    {
        setMapControlsEdit();
    }
}

function checkFileUpload()
{
    // triggered by the maploader, checks if the user wants to select a file from disk;
    // in case,it opens the file selection dialog from the hidden #uploadfield

    var upreq = $("#ctx_sel_newmap").val();
    var action = $("#sel_action_newmap").val();

    if (upreq == "")
    {
        $("#btn_newmap").prop('disabled', true);
        return;
    }

    // if the user is on the file selection, we launch the dialog (and have a callback to update the file upload field
    if (upreq.split("/")[0] == ".file")
    {
        $("#uploadfield").trigger('click');
    }
    else
    {
        if (action == 'merge' && upreq == activemap)
        {
            $("#btn_newmap").prop('disabled', true);

        }
        else
        {
            $("#btn_newmap").prop('disabled', false);
        }
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


function tryLoadShadow ()
{
    console.log($("#ctx_sel_snapmap").val());

    lockContext();
    var contentreq = $("#ctx_sel_snapmap").val().split("/");
    var meta_id = contentreq[0];
    var map_id = contentreq[1];

    var urlstring;
    if (meta_id == ".st")
    {
        urlstring = "/fwst/maps/"+proxy_id+"/"+map_id;
    }
    else
    {
        urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id;
    }

    $.ajax ({
        url:    urlstring,
        async:  true,
        success:    applyNewSnap,
        error:  reportFailedDownload
    });

}


function applyNewSnap (data, textStatus, jqXHR)
{

    renderGeoJSONCollection(data, snaplayer, true);
    unlockContext();

}


function tryUploadMerge()
{

    console.log($("#sel_action_newmap").val()+" with "+$("#ctx_sel_newmap").val());

    lockContext();

    var actionreq = $("#sel_action_newmap").val();
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
        setNewMapModel (contentreq[1], actionreq);
    }
    else
    {
        // we load the map from the standalone area/meta
        getUploadedMap(contentreq[0], contentreq[1]);

    }

}

function setNewMapModel (model_id, method)
{

    // creates a new map of the requested model or adds the model to the current one, according to the method. Currently works with "open" (create new) and "merge" (add to current)

    //TODO: de-hardcode open and merge values to global constant

    var newmodel = models[model_id];

    if (activemap == null)
    {
        method = 'open';
    }

    var success = true;
    if (method == 'open')
    {
        // erase current map and create a new one setting newmodel as activemodel
        vislayer.removeAllFeatures();
        integrateMapModel(newmodel, true);

        activemap = newmodel['name'];
        $("#ctx_saveto").val(activemap);
        checkSaveName();

    }
    else if (method == 'merge')
    {
        // only integrate
        console.log("Integrating "+newmodel.objtype+" vs "+activemodel.objtype);
        if (newmodel.objtype == activemodel.objtype)
        {
            integrateMapModel(newmodel, false);
        }
        else
        {
            success = false;
            reportFeedback(false, "Modello non compatibile");
        }

    }

    if (success)
    {
        setSaverHint(true);
    }

    unlockContext();

}

function setSaverHint (haschanges)
{

    // sets the class of the saver widget so that the user can see if there are changes to be saved

    if (haschanges)
    {
        $("#contextsaver").addClass("savehint");
    }
    else
    {
        $("#contextsaver").removeClass("savehint");
    }

}




function trySaveMap ()
{

    lockContext();

    //launches the process to save the current map in the standalone area with the name in the ctx_saveto field; any map in the standalone area that has the same name will be overwritten

    // gathers all data from the OpenLayers map then launches a callback chain for the actual upload process

    var mapname = $("#ctx_saveto").val();
    var mapjson = layerToJSON (vislayer, mapname);
    //todo: implement upload

    var urlstring = "/fwst/save/"+proxy_id+"/"+mapname+"/";


    reportFeedback(true, "Salvataggio in corso");

    $.ajax (
        {
            url:    urlstring,
            data:   {
                'mapname': mapname,
                'jsondata': JSON.stringify(mapjson)
            },
            async:  true,
            type:   'POST',
            success: confirmSave,
            error: reportFailedSave
        }
    );

}

function confirmSave (data, textStatus, jqXHR)
{

    if (data['success'] == true)
    {
        reportFeedback(true, "Mappa salvata con successo");
        setSaverHint(false);
    }
    else
    {
        reportFeedback(false, "Salvataggio fallito: "+data['report']);
    }
    unlockContext();

}

function reportFailedSave (err, xhr)
{

    reportFeedback(false, "Errore durante il salvataggio ("+JSON.stringify(err)+")");
    unlockContext();

}

function layerToJSON (layer, mapid)
{

    var jsondata = {
        'type': 'FeatureCollection',
        'model': activemodel,
        'features': []
    };

    if (mapid)
    {
        jsondata['id'] = mapid;
    }

    var geom;
    var props;
    for (var fid in layer.features)
    {
        geom = JSON.parse(gjformat.write(layer.features[fid].geometry));
        props = layer.features[fid].attributes;

        for (var propname in activemodel['properties'])
        {
            // we add empty values for any property that should not be already created in the feature
            if (!props.hasOwnProperty(propname))
            {
                props[propname] = "";
            }
        }

        // we do not specify an ID since the geoid is not actually relevant for our use and can change and/or be erased on merges.
        jsondata['features'].push({
            'type': "Feature",
            'geometry': geom,
            'properties': props
        });
    }

    return jsondata;


}


function buildSaver()
{
    var defaultname = "";
    if (activemap)
    {
        defaultname = activemap;
    }

    var savewidget = $('<div class="ctx_fieldname">Salva</div><div class="ctx_fieldval"><input id="ctx_saveto" type="text" value="'+defaultname+'"></div><div class="ctx_fieldact"><input type="button" value="&gt;&gt;" id="btn_savemap"></div>');

    $("#contextsaver").empty();
    $("#contextsaver").append(savewidget);
    checkSaveName();
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
    //console.log(data);

    if (data['success'] == true)
    {
        reportFeedback(true, "Caricamento file completato");
        var mapname =  $("#ctx_sel_newmap").val().split("/")[1].replace(".zip","");
        getUploadedMap(".st", mapname);
    }
    else
    {
        reportFeedback(false, "Caricamento file fallito");
        unlockContext();
    }
}

function getUploadedMap (meta_id, map_id)
{

    // gets a map from either a metadata or the standalone area, then takes the action chosen earlier in the selector

    var urlstring;
    if (meta_id == ".st")
    {
        urlstring = "/fwst/maps/"+proxy_id+"/"+map_id;
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
    var action = $("#sel_action_newmap").val();
    //console.log(newdata);
    console.log(action);

    // if no map is available, we always create
    if (activemap == null)
    {
        action = 'open';

    }

    var cleanup = false;
    if (action == 'open')
    {
        // cleanup before rendering
        cleanup = true;
    }

    var canintegrate = true;

    var mapmodel;
    try
    {
        mapmodel = extractMapModel (newdata);

        // we check for model consistency ONLY in case of merge, so we already know activemodel and activemap have been set
        if (action == 'merge')
        {
            console.log(mapmodel.objtype);
            console.log(activemodel.objtype);

            if (mapmodel.objtype != activemodel.objtype)
            {
                console.log("model object type mismatch "+mapmodel.objtype+" vs "+activemodel.objtype);
                canintegrate = false;
                reportFeedback(false, "Modelli non compatibili");
            }

        }
    }
    catch (error)
    {
        console.log("Errore: "+error);
        canintegrate = false;
        reportFeedback(false, "Modello della nuova mappa non valido o compatibile");
    }

    if (canintegrate)
    {
        renderGeoJSONCollection(newdata, vislayer, cleanup);
        integrateMapModel(mapmodel, cleanup);

    }


    unlockContext();

}


function integrateMapModel (newmodel, cleanup)
{

    // if cleanup is true, we replace the current model with the new one, otherwise we only add any new properties we find

    // we don't check or change the type of data used by each property

    if (cleanup)
    {
        activemodel = {};
        activemodel = newmodel;
        if (!newmodel['name'])
        {
            var modelname = $("#ctx_sel_newmap").text();
        }
    }
    else
    {
        for (var propname in newmodel['properties'])
        {

            if (!activemodel['properties'].hasOwnProperty(propname))
            {
                activemodel['properties'][propname] = newmodel['properties'][propname];
            }
        }
    }





}

function extractMapModel (jsondata)
{
    // extracts model data from a FeatureCollection json dict.

    var model = {};
    model.objtype = null;
    model.name = null;
    model.properties = {};

    // we check for the model notation in the dict itself, to start with
    // if any element other than name is missing, we ignore this
    var validmodel = false;
    if (jsondata.hasOwnProperty('model'))
    {

        if (jsondata.model.hasOwnProperty('objtype') && jsondata.model.hasOwnProperty('properties'))
        {
            validmodel = true;
            model.objtype = jsondata.model.objtype;
            model.properties = jsondata.model.properties;
            if (jsondata.model.hasOwnProperty('name'))
            {
                model.name = jsondata.model.name;
            }
        }

    }

    if (!validmodel && (!jsondata.hasOwnProperty('features') || jsondata.features.length == 0))
    {
        throw "EmptyModel";
    }

    for (var f in jsondata['features'])
    {

        var fmodel = jsondata['features'][f]['geometry']['type'];

        if (model.objtype != fmodel)
        {
            if (model.objtype == null)
            {
                model.objtype = fmodel;
            }
            else
            {
                throw "ObjTypeMismatch";
            }
        }

        var fprops = jsondata['features'][f]['properties'];
        for (var pname in fprops)
        {
            if (!model.properties.hasOwnProperty(pname))
            {
                // we do not do a consistency check on the type of each property inside the file, for now
                model.properties[pname] = typeof(fprops[pname]);
            }
        }
    }


    return model;




}


function renderGeoJSONCollection (jsondata, layer, cleanup)
{

    // renders the content of jsondata on the requested layer.
    // if cleanup is true, erase everything before rendering
    // (allows for merging with existing data, note that the merge does not include the mapdata in other variables)

    if (cleanup === true)
    {
        layer.removeAllFeatures();
    }

    if (!activemap)
    {
        activemap = $("#ctx_sel_newmap").val();
        $("#ctx_saveto").val(activemap.split("/")[1]);
    }



    var stringmap = JSON.stringify(jsondata);
    var formatmap = gjformat.read(stringmap);

    //console.log(formatmap);

    layer.addFeatures(formatmap);



    if (cleanup !== true)
    {
        setSaverHint(true);
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

    unlockContext();
}

function reportFailedDownload (xhr, err)
{
    // TODO: placeholder, implement
    console.log("Reporting failed download of the requested file");
    console.log("readyState: "+xhr.readyState+"\nstatus: "+xhr.status);
    console.log("responseText: "+xhr.responseText);
    console.log(err);

    unlockContext();


}

function uiReset()
{

    $("#progspinner").hide();

    // rebuilds the UI elements; does NOT reinit the elements and variables

    buildContext();
    buildLoader();
    buildSaver();

    buildMapWidget();
    buildSnapChooser();
    setMapControlsNav();

    if (activemap)
    {
        setMapControlsEdit();
    }

    $("#statemessage").empty();

    checkFileUpload();
    checkSnapLoad();
    checkSaveName();

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
        ctx_mapsel.append('<option value=".st/'+maps_st[m]+'">'+maps_st[m]+'</option>');
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
        '<option value="open">Crea</option>' +
        '<option value="merge">Integra</option>' +
        '</select>';

    var ctx_loadnew = $('<div class="ctx_fieldname">'+ctx_actionsel+'</div><div class="ctx_fieldval"><select id="ctx_sel_newmap"><option value=""></option><optgroup label="Da file"><option id="ctx_newmap_fileopt" value=".file">Seleziona...</option></optgroup></select></div><div class="ctx_fieldact"><input type="button" value="&gt;&gt;" id="btn_newmap"></div>');

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
    var ctx_snapchooser = $('<div class="ctx_fieldname">Allinea a</div><div class="ctx_fieldval"><select id="ctx_sel_snapmap"><option value=""></option></select></div><div class="ctx_fieldact"><input type="button" value="&gt;&gt;" id="btn_newsnap"></div>');
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

    maptype = activemodel['objtype'];

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
                    }
                    /* featureAdded: (createNewFeature) */
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


function hideDistance()
{
    //TODO: placeholder, implement
}

function handleMeasure()
{
    //TODO: placeholder, implement
}

function renderFeatureCard(caller)
{
    //TODO: set CFID
    // #view_feature

    var feature = caller['feature'];

    var featurecard = $('<div class="ctx_topic"><div class="ctx_fieldname"></div><div class="ctx_fieldval"></div></div>');

    for (var propname in activemodel['properties'])
    {

        var datalist = "";
        var listref = "";
        if ($.isArray(activemodel['properties'][propname] == 'array'))
        {
            datalist = $('<datalist id="modprop_'+propname+'"></datalist>');
            listref = ' list="modprop_'+propname+'"';
            for (var i in activemodel['properties'][propname])
            {
                datalist.append('<option value="'+activemodel['properties'][propname][i]+'">');
            }

            //TODO: if range of values, add option to set a button to set the same property to ALL elements (very careful...)
        }

        var propval = "";
        if (feature['attributes'].hasOwnProperty(propname))
        {
              propval = feature['attributes'][propname];
        }
        // TODO: verify if we should use .fid or .id
        var cprop = $('<div class="ctx_fieldname">'+propname+'</div>' +
            '<div class="ctx_fieldval featureedit" id="setfeatureprop_'+feature.id+'_'+propname+'"'+listref+'>'+propval+'</div>' + datalist +
            '<div class="ctx_fieldact"></div>');
    }

}

function freeSelection (caller)
{
    // applies changes to the properties (so we avoid a change for every keypress
    // NOTE: this call should be FORCED whenever needed

    var fieldlist = $(".featureedit");
    var newprops;
    for (var i in fieldlist)
    {
       //TODO: implement
    }

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
