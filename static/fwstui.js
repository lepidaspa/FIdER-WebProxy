/**
 * Created with PyCharm.
 * User: drake
 * Date: 7/28/12
 * Time: 6:51 AM
 * To change this template use File | Settings | File Templates.
 */

var defaultobjtype = {
    'LineString': 'Tratta',
    'Point': 'Punto'
};




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
var homecontrol;

// panel containing the controls
var panel;

// id of the current feature being edited
// note that this is the INTERNAL id used by OpenLayers
var cfid;

var propprefix = 'setfeatureprop_';

// global to keep the filter request value in case the user changes the text but does not turn the filter on/off and there is a call to applyFilter
var filtercriteria_propname;
var filtercriteria_propval;

function pageInit(req_proxy_id, req_proxy_manifest, req_proxy_meta, req_maps_fider, req_maps_st, req_models)
{

    OpenLayers.Lang.setCode("it");

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
    $("#btn_destroyfeature").live("click", destroyFeature);

    $(".btn_removeprop").live("click", removeProperty);
    $(".btn_importpropval").live("click", importPropertyValue);
    $("#model_newpropname").live("change mouseup keyup", checkNewPropName);
    $("#btn_addprop").live("click", addProperty);
    $("#btn_filter_apply").live("change mouseup", applyFilterByClick);

    $("#sel_filter_propname").live("change", resetFilterSuggestions);

    $(".ctx_propvalues").live("change mouseup keyup", setModelPropForm);
    $(".btn_extendpropval").live("click", extendPropVal);

    $("#hr_viewfilter").hide();

    $("#txt_filter_propvalue").live("change mouseup keyup", unsetFilterCheckbox);

    $("#xlate_move_x").live("change mouseup keyup", checkXlateFields);
    $("#xlate_move_y").live("change mouseup keyup", checkXlateFields);
    $("#btn_xlate").live("click", xlateMap);
    checkXlateFields();


    initSearchBox();

}

function checkXlateFields()
{

    var offset_x = parseFloat($("#xlate_move_x").val());
    var offset_y = parseFloat($("#xlate_move_y").val());

    if (isNaN(offset_x) || isNaN(offset_y))
    {
        $("#btn_xlate").prop("disabled", true);
        //console.log("disabling xlate button");
    }
    else
    {
        $("#btn_xlate").prop("disabled", false);
        //console.log("enabling xlate button");
    }

}

function xlateMap ()
{

    var offset_x = parseFloat($("#xlate_move_x").val());
    var offset_y = parseFloat($("#xlate_move_y").val());

    console.log("Trying translation by "+offset_x+","+offset_y);

    if (isNaN(offset_x) || isNaN(offset_y))
    {
        $("#btn_xlate").prop("disabled", true);
        //console.log("disabling xlate button");
        return;
    }

    var f;
    for (f in vislayer.features)
    {
        xlateFeature (vislayer.features[f], offset_x, offset_y);
    }

    for (f in filterlayer.features)
    {
        xlateFeature (filterlayer.features[f], offset_x, offset_y);
    }

    vislayer.redraw();
    vislayer.refresh();
    filterlayer.redraw();
    filterlayer.refresh();

    parseFloat($("#xlate_move_x").val(""));
    parseFloat($("#xlate_move_y").val(""));
    checkXlateFields();
    setSaverHint(true);

}

function xlateFeature (feature, offset_x, offset_y)
{

    console.log("Feature move from");
    console.log(feature);
    feature.geometry.move(offset_x, offset_y);
    console.log("Feature move to");
    console.log(feature);

}


function unsetFilterCheckbox ()
{
    $("#btn_filter_apply").prop("checked", false);
    setExtenders();
}

function initSearchBox()
{
    $("#btn_geosearch").live('click', geosearch);
    $("#search_geo_address").bind('keyup', checkgeosearchEnter);
}

function checkgeosearchEnter(event)
{

    //console.log("keyupevent on geosearch field: "+event.which);
    if (event.which == 13)
    {
        console.log("geosearch launched by keyboard");
        event.preventDefault();
        geosearch();
    }
}

function geosearch()
{

    var jg;
    var path = '/external/maps.googleapis.com/maps/api/geocode/json?sensor=false&address='
        + $('#search_geo_address').val();

    console.log("Recentering map by search: "+path);


    $.getJSON(path, function(gqdata){
        console.log(gqdata);
        if(gqdata.status == "OK"){
            if (gqdata.results.length > 0){

                console.log("Results found");

                gq = new OpenLayers.Bounds();
                gq.extend(new
                    OpenLayers.LonLat(gqdata.results[0].geometry.viewport.southwest.lng,
                    gqdata.results[0].geometry.viewport.southwest.lat).transform(proj_WGS84,
                    proj_900913));
                gq.extend(new
                    OpenLayers.LonLat(gqdata.results[0].geometry.viewport.northeast.lng,
                    gqdata.results[0].geometry.viewport.northeast.lat).transform(proj_WGS84,
                    proj_900913));
                mapview.zoomToExtent(gq);
                closeFeedback();

            }
            else
            {

                console.log("No location found");
                reportFeedback(false, "Impossibile individuare la locazione specificata.");
                console.log(gqdata.results);
            }
        }
        else
        {
            console.log("No location found");
            reportFeedback(false, "Impossibile individuare la locazione specificata.");
            console.log(gqdata.results);
        }
    });

    console.log("DEBUG: codewise after getJSON function, possibly waiting for return value");


}

function extendPropVal(caller)
{

    var prefix = "btn_extendpropval_";
    var propname = caller.srcElement.id.substring(prefix.length);
    var propval = $("#setfeatureprop_"+propname).val();

    console.log("Extending value "+propval+" for property "+propname);


    var featurelist = [];
    if (filterlayer.features.length > 0)
    {
        for (var i in filterlayer.features)
        {
            featurelist.push (vislayer.getFeatureById(filterlayer.features[i]['attributes']['$clonedfrom']));
        }

    }
    else
    {
        featurelist = vislayer.features;
    }

    for (var f in featurelist)
    {
        featurelist[f].attributes[propname] = propval;
    }





}

function setExtenders()
{
    // sets the label and status (enabled/disabled) on the extendpropval buttons for better UI clarity (i.e. the user knows if he is going to extend the value to ALL objects or only to a selection

    if ($("#btn_filter_apply").prop("checked"))
    {

        // extend to selection only
        $(".btn_extendpropval").val('Replica');

        // extenders are active only if there are items to extend the value to (potentially, we do not check if they already have this value
        if (filterlayer.features.length > 1)
        {
            $(".btn_extendpropval").prop('disabled', false);
        }
        else
        {
            $(".btn_extendpropval").prop('disabled', true);
        }

    }
    else
    {
        $(".btn_extendpropval").prop('disabled', true);
    }


    /* Removed, too risky
    else
    {
        //extend to ALL objects on map
        $(".btn_extendpropval").val('>>Tutti');
        $(".btn_extendpropval").prop('disabled', false);

    }
    */




}

function preloadMap (req_meta, req_map)
{
    // preloads a map from the federated maps list
    // fails silently if the map is not in the list

    console.log("Trying to preload map "+req_meta+"/"+req_map);

    var mapstring = req_meta+"/"+req_map;
    if (maplist.indexOf(mapstring) != -1)
    {
        $("#ctx_sel_newmap").val(req_meta+"/"+req_map);
        $("#ctx_sel_newmap").change();
        $("#btn_newmap").click();
        checkSnapLoad();
    }




}

function applyFilterByClick()
{
    //called when we apply/disable the filter via its own button, so we set the value of the global

    var req = $("#btn_filter_apply").prop("checked");
    if (req)
    {
        filtercriteria_propname = $("#sel_filter_propname").val();
        filtercriteria_propval = $("#txt_filter_propvalue").val();
    }
    else
    {
        filtercriteria_propname = null;
        filtercriteria_propval = null;
    }
    applyFilter();

}

function applyFilter()
{

    var req = $("#btn_filter_apply").prop("checked");
    filterlayer.destroyFeatures();

    if (!req)
    {
        setExtenders();
        return
    }

    // if the checkbox is activated, we (try to) render the requested features

    var propname = filtercriteria_propname;
    var propval  = filtercriteria_propval;

    var forcopy;
    if (propval.indexOf(";") == -1)
    {
        forcopy = vislayer.getFeaturesByAttribute(propname, propval);
    }
    else
    {
        // multiple selection (but on one field only)
        forcopy = [];
        var propvals = propval.split(";");
        for (var i in propvals)
        {
            forcopy = forcopy.concat(vislayer.getFeaturesByAttribute(propname, propvals[i]));
        }

    }


    if (forcopy && forcopy.length > 0)
    {
        console.log("Copying features to highlight layer");


        for (var i in forcopy)
        {
            console.log(forcopy[i]);

            // $clonedfrom is needed to trace back to the original feature  when working on the filter layer

            var clonedfrom = forcopy[i].id;
            console.log("Adding feature "+clonedfrom+"/"+forcopy[i].id);
            var clonefeature = forcopy[i].clone();
            clonefeature.attributes['$clonedfrom'] = clonedfrom;
            filterlayer.addFeatures(clonefeature);

        }


    }

    setExtenders();


}



function resetFilterSuggestions()
{

    $("#txt_filter_propvalue").removeClass("datalisted");
    $("#filter_suggested").empty();
    var propfilter = $("#sel_filter_propname").val();
    console.log("Updating filter suggestions for "+propfilter);
    if (!propfilter || propfilter=="")
    {
        $("#btn_filter_apply").prop('disabled', true);
        return;
    }
    else
    {
        $("#btn_filter_apply").prop('disabled', false);
    }

    var choices = [];
    if ($.isArray(activemodel.properties[propfilter]))
    {
        choices = choices.concat(activemodel.properties[propfilter]);
    }

    console.log("Forced choices "+choices.length);

    var morechoices = [];
    for (var i in vislayer.features)
    {
        var current = vislayer.features[i].attributes[propfilter];
        if (current && current != "" && morechoices.indexOf(current) == -1 && choices.indexOf(current) == -1)
        {
            morechoices.push(current);

        }

        if (morechoices.length>100)
        {
            break;
        }
    }

    choices = choices.concat(morechoices);
    console.log("Found "+choices.length+" suggestions");

    for (i in choices)
    {
        $("#filter_suggested").append('<option value="'+choices[i]+'">');
    }

    if (choices.length > 0)
    {
        $("#txt_filter_propvalue").addClass("datalisted");
    }

}




function checkNewPropName ()
{

    var cname = $("#model_newpropname").val();
    var cprops = Object.getOwnPropertyNames(activemodel.properties);
    if (cname.match(/^[A-Za-z0-9_]+$/)==null || cprops.indexOf(cname) != -1)
    {
        console.log("Non valid property name"+cname);
        $("#btn_addprop").prop('disabled', true);
    }
    else
    {
        $("#btn_addprop").prop('disabled', false);

    }
}

function addProperty()
{

    var newpropname = $("#model_newpropname").val();
    if (!$("#model_newpropname").val())
    {
        return;
    }

    if (!$("#model_newpropname").val())
    {
        newpropvals = "str";
    }
    else
    {
        var rawpropvals = $("#model_newpropvals").val().split(";");

        var newpropvals = [];
        for (var i in rawpropvals)
        {
            var trimmed = $.trim(rawpropvals[i]);

            if (trimmed != "")
            {
                newpropvals.push(trimmed);
            }
        }

        if (newpropvals.length == 0)
        {
            newpropvals = "str";
        }
    }


    activemodel.properties[newpropname] = newpropvals;

    console.log("Added property "+newpropname+": "+activemodel.properties[newpropname]);

    // we also save any other change that has been made on the same form
    $(".ctx_propvalues").each(setModelPropForm);

    renderMapCard();

}

function importPropertyValue ()
{

    var prefix = "btn_importpropval_";
    var cid = $(this).prop('id');

    var propname = cid.slice(prefix.length);

    console.log("Importing prop vals for property "+propname);

    var mapvalues = [];
    for (var i in vislayer.features)
    {
        var current = vislayer.features[i].attributes[propname];
        if (current && current != "" && mapvalues.indexOf(current) == -1)
        {
            mapvalues.push(current);
        }

    }

    if (mapvalues.length > 0)
    {
        if (!$.isArray(activemodel['properties'][propname]))
        {
            activemodel['properties'][propname] = [];
        }


        activemodel['properties'][propname] = activemodel['properties'][propname].concat(mapvalues);
    }


    renderMapCard();

}

function removeProperty()
{
    var prefix = "btn_removeprop_";
    var cid = $(this).prop('id');

    var propname = cid.slice(prefix.length);

    delete activemodel.properties[propname];

    renderMapCard();
    renderFilterMask();

}

function destroyFeature()
{

    var feature = vislayer.getFeatureById(cfid);
    vislayer.removeFeatures([feature]);
    vislayer.destroyFeatures([feature]);

    editcontrol.deactivate();
    editcontrol.activate();


    freeSelection();
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

    $("body").addClass("passive");

    try
    {
        freeSelection();
    }
    catch (err)
    {
        console.log("No feature selected at the moment");
    }

    // disables interactions with the context area until the unlock function is called (e.g. during loadings)
    console.log("Disabling context during load");
    $("#view_context select").prop('disabled', true);
    $("#view_context input").prop('disabled', true);

    $("#progspinner").show();
    $("#hr_stateview").show();

}

function unlockContext()
{
    // re-enables interactions with the context area
    console.log("Re-enabling context after load");
    $("#progspinner").hide();

    $("#mod_xlate").show();
    $("#hr_shifter").show();


    $("#view_context select").prop('disabled', false);
    $("#view_context input").prop('disabled', false);
    checkSaveName();

    // temporary fix for SnapMap button being activated even with an empty field after preloading a map
    checkSnapLoad();

    //NOTE: bad
    if (activemodel)
    {
        setMapControlsEdit();
        renderMapCard();
    }

    checkXlateFields();

    $("body").removeClass("passive");
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
    if (upreq == ".file")
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

    // cleaning up all options that are NOT the hint, then append
    $('#ctx_newmap_file_grp').empty();

    $('#ctx_newmap_file_grp').append('<option id="ctx_newmap_fileopt" value=".file">Seleziona...</option>');
    if (filename != "")
    {
        $('#ctx_newmap_file_grp').append('<option id="ctx_newmap_filename" value=".file/'+filename+'">'+filename+'</option>');
        $("#ctx_sel_newmap").val(".file/"+filename);
    }
    else
    {
        $("#ctx_sel_newmap").val("");
    }


    checkFileUpload();


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
        urlstring = "/fwst/maps/"+proxy_id+"/"+map_id+"/";
    }
    else
    {
        urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id+"/";
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
    $("#hr_stateview").hide();
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


        vislayer.destroyFeatures();
        console.log("Erased features");
        console.log(vislayer.features);
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
        $("#hr_stateview").hide();

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

    //console.log("save process closed");
    //console.log(data);
    //console.log(textStatus);

    if (data['success'] == true)
    {
        reportFeedback(true, "Mappa salvata correttamente");
        setSaverHint(false);
    }
    else
    {
        reportFeedback(false, "Salvataggio fallito: "+data['report']);
    }

    // adding save  target to choosers if needed
    var saveto = $("#ctx_saveto").val();
    if (maps_st.indexOf(saveto) == -1)
    {
        maps_st.push(saveto);
    }


    var currentsel;
    currentsel = $("#ctx_sel_newmap").val();
    buildLoader();
    $("#ctx_sel_newmap").val(currentsel);

    currentsel = $("#ctx_sel_snapmap").val();
    buildSnapChooser();
    $("#ctx_sel_snapmap").val(currentsel);



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

        // safety check to avoid inconsistencies being introduced during editing by OpenLayers
        var badfeaturescount = 0;
        if (geom['type'] == maptype)
        {
            jsondata['features'].push({
                'type': "Feature",
                'geometry': geom,
                'properties': props
            });
        }
        else
        {
            badfeaturescount++;
        }

        console.log("Removed "+badfeaturescount+" incompatible features");


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

    var savetypesel = '<select id="ctx_savewhat" disabled><option value="data">mappa</option><option value="model">modello</option></select>';

    var savewidget = $('<div class="ctx_fieldname">Salva ('+savetypesel+')</div><div class="ctx_fieldval"><input id="ctx_saveto" type="text" value="'+defaultname+'"></div><div class="ctx_fieldact"><input type="button" value="&gt;&gt;" id="btn_savemap"></div>');

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
    console.log("Reporting (tentatively) completed upload of the file in use");
    //console.log(data);

    if (data['success'] == true)
    {
        reportFeedback(true, "Caricamento file completato");
        var mapname =  $("#ctx_sel_newmap").val().split("/")[1].replace(".zip","");
        getUploadedMap(".st", mapname);
    }
    else
    {
        console.log(data);
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
        urlstring = "/fwst/maps/"+proxy_id+"/"+map_id+"/";
    }
    else
    {
        urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id+"/";
    }

    console.log("Loading: "+urlstring);

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


        mapview.zoomToExtent(vislayer.getDataExtent());


        integrateMapModel(mapmodel, cleanup);
        if (action == 'open')
        {
            $("#ctx_saveto").val($("#ctx_sel_newmap").val().split("/")[1]);
        }

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

    //console.log("Extracting model from json data:");
    //console.log(jsondata);
    if (jsondata.hasOwnProperty('model'))
    {

        console.log("Has model:");
        console.log(jsondata.model);

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


    var geojson_format = new OpenLayers.Format.GeoJSON({'externalProjection':new OpenLayers.Projection(proj_WGS84), 'internalProjection':layer.map.getProjectionObject()});
    /* REPLACING WITH SAFER METHOD for undesidered geometries
    var stringmap = JSON.stringify(jsondata);
    var formatmap = gjformat.read(stringmap);
    //console.log(formatmap);
    layer.addFeatures(formatmap);
    */

    var render_errors = [];
    for (var i in jsondata['features'])
    {
        try
        {
            var info2d = jsondata['features'][i];

            var objtype = info2d['geometry']['type'];
            if (objtype.toUpperCase() == "LINESTRING")
            {

                for (var pt in info2d['geometry']['coordinates'])
                {
                    info2d['geometry']['coordinates'][pt] = info2d['geometry']['coordinates'][pt].slice(0,2);
                }

            }
            else if (objtype.toUpperCase() == "POINT")
            {
                info2d['geometry']['coordinates'] = info2d['geometry']['coordinates'].slice(0,2);

            }

            var fstring = JSON.stringify(info2d);
            var fmap = geojson_format.read(fstring);
            layer.addFeatures(fmap);
        }
        catch (err)
        {
            if (render_errors.length < 100)
            {
                console.log(err);
            }
            render_errors.push(i);
        }

    }
    console.log ("Rendered with "+render_errors.length+" errors");
    if (render_errors.length > 0)
    {
        console.log("Error sample:");
        console.log(render_errors[0]);
    }



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
    $("#statemessage").show();
    $("#hr_stateview").show();

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
    $("#hr_stateview").hide();



    // rebuilds the UI elements; does NOT reinit the elements and variables

    //buildContext();
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
    $("#hr_stateview").hide();
    $("#mod_xlate").hide();
    $("#hr_shifter").hide();

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
            contextdesc = ': '+activemap;
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

    var container = $("<select><option></option></select>");

    var ctx_mapsel = $('<optgroup label="Archivio"></optgroup>');
    for (var m in maps_st)
    {
        ctx_mapsel.append('<option value=".st/'+maps_st[m]+'">'+maps_st[m]+'</option>');
    }

    container.append(ctx_mapsel);

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

        container.append(ctx_metamapsel);
    }

    return container.children("optgroup");

}


function buildLoader()
{
    // creates the mask to load/add files and models to the current map

    var ctx_actionsel = '<select id="sel_action_newmap">' +
        '<option value="open">Nuovo</option>' +
        '<option value="merge">Aggiungi</option>' +
        '</select>';

    var ctx_loadnew = $('<div class="ctx_fieldname">'+ctx_actionsel+'</div><div class="ctx_fieldval"><select id="ctx_sel_newmap"><option value=""></option><optgroup id="ctx_newmap_file_grp" label="Da file"><option id="ctx_newmap_fileopt" value=".file">Seleziona...</option></optgroup></select></div><div class="ctx_fieldact"><input type="button" value="&gt;&gt;" id="btn_newmap"></div>');

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
    var ctx_snapchooser = $('<div class="ctx_fieldname">Allineamento</div><div class="ctx_fieldval"><select id="ctx_sel_snapmap"><option value=""></option></select></div><div class="ctx_fieldact"><input type="button" value="&gt;&gt;" id="btn_newsnap"></div>');
    ctx_snapchooser.children('#ctx_sel_snapmap').append(buildMapList());

    $("#view_shadow").empty();
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


    //Base Maps from Google
    mapview.addLayer(new OpenLayers.Layer.Google("Google Satellite", {
        type : google.maps.MapTypeId.SATELLITE,
        numZoomLevels : 20
    }));
    mapview.addLayer(new OpenLayers.Layer.Google("Google Physical", {
        type : google.maps.MapTypeId.TERRAIN,

        visibility : false
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




    // setting the format to translate geometries out of the map
    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': mapview.getProjectionObject()});

    var featurestyle;
    var featurestylemap;









    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#888888", strokeColor: "#888888", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 8});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "background" layer
    snaplayer= new OpenLayers.Layer.Vector("Allineamento", {styleMap: featurestylemap});
    //mapview.addLayer(snaplayer);


    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#188E01", strokeColor: "#188E01", strokeWidth: 6, strokeDashstyle: "solid", pointRadius: 10});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "background" layer
    filterlayer = new OpenLayers.Layer.Vector("Filtro", {styleMap: featurestylemap});
    //mapview.addLayer(filterlayer);


    // setting style
    //featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    //featurestylemap = new OpenLayers.StyleMap(featurestyle);
    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#FF9900", strokeColor: "#FF9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});
    // adding the "state" layer
    vislayer= new OpenLayers.Layer.Vector("Mappa", {styleMap: featurestylemap});
    //mapview.addLayer(vislayer);

    mapview.addLayers([snaplayer, filterlayer, vislayer]);

    autoZoom(mapview);


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
    };

    ItaLayerSwitcher.prototype.loadContents = function()                                 // redefine Method
    {
        OpenLayers.Control.LayerSwitcher.prototype.loadContents.call(this);         // Call super-class method
        this.baseLbl.innerHTML = 'Sfondi';                                   //change title for base layers
        this.dataLbl.innerHTML = 'Livelli';                                   //change title for overlays (empty string "" is an option, too)
    };

    var switcher = new ItaLayerSwitcher();



    mapview.addControl(switcher);



}

function setMapControlsEdit ()
{

    try
    {
        snapcontrol.deactivate();
        drawcontrol.deactivate();
        editcontrol.deactivate();
        measurecontrol.deactivate();
    }
    catch (err)
    {
        console.log("No active controls yet");
    }



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
        displayClass: "olControlEditingToolbar",
        allowDepress: true
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
                }
                /*featureAdded: (createNewFeature) */
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

    homecontrol = new OpenLayers.Control.Button(
        {
        displayClass: "olLabsControlRebase",
            trigger: autoZoom,
            title: "Reimposta inquadratura"
    });


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
        drawcontrol, editcontrol, measurecontrol, homecontrol
    ]);

    // binding controls to the map
    mapview.addControl(panel);


    vislayer.events.register('featureselected', mapview, renderFeatureCard);
    vislayer.events.register('featureunselected', mapview, freeSelection);


}


function hideDistance()
{
    //TODO: placeholder, implement
    $("#view_measure").empty();
}

function handleMeasure(event)
{
    //TODO: placeholder, implement
    freeSelection();

    //var geometry = event.geometry;
    var units = event.units;

    var precision;
    if (units == 'm')
    {
        precision = 2;
    }
    else
    {
        precision = 3;
    }

    console.log("Measure data");
    //console.log(event);
    //console.log(event.geometry.getBounds());

    var measure = event.measure.toFixed(precision);
    var bbox = event.geometry.getBounds();

    console.log(bbox);

    var span_x = bbox['right'] - bbox ['left'];
    var unitx = "m";
    var precisionx = 2;
    if (span_x > 1000)
    {
        span_x /= 1000;
        unitx = "km";
        precisionx = 3;
    }

    var span_y = bbox['top'] - bbox ['bottom'];
    var unity = "m";
    var precisiony = 2;
    if (span_y > 1000)
    {
        span_y /= 1000;
        unity = "km";
        precisiony = 3;
    }

    var measureinfo = "<table>" +
        "<tr><td>Distanza totale</td><td>"+measure+" "+units+"</td></tr>" +
        "<tr><td>Ampiezza est-ovest</td><td>"+span_x.toFixed(precisionx)+" "+unitx+"</td></tr>" +
        "<tr><td>Ampiezza nord-sud</td><td>"+span_y.toFixed(precisiony)+" "+unity+"</td></tr>" +
        "</table>";


    console.log(measure);

    $("#view_measure").append(measureinfo)

}

function resetViewDetail()
{
    $("#view_mapmodel").empty();
    $("#view_feature").empty();
    $("#view_measure").empty();
}

function getMapTypeName ()
{

    if (activemodel.hasOwnProperty('name') && activemodel['name']!=null)
    {
        return activemodel['name'];
    }
    else
    {
        return defaultobjtype[activemodel['objtype']];
    }

}

function renderFeatureCard(caller)
{

    // in case we switch from one feature to another in the openlayers viewport
    freeSelection();

    //TODO: set CFID
    // #view_feature

    var feature = caller['feature'];

    cfid  = feature.id;

    console.log("Selected feature "+cfid);

    resetViewDetail();




    //var button_destroy = '<input type="image" src="/static/resource/fwp_remove.png" id="btn_destroyfeature">';
    var button_destroy = '<input type="button" value="Elimina" id="btn_destroyfeature">';

    $("#view_feature").append('<div class="ctx_topic" id="ctx_deschead"><div class="ctx_fieldname">Elemento</div><div class="ctx_fieldval">'+getMapTypeName()+'</div><div class="ctx_fieldact">'+button_destroy+'</div></div>');


    console.log("Attributes:");
    console.log(feature['attributes']);

    for (var propname in activemodel['properties'])
    {

        var datalist = "";
        var listref = "";
        var listclass = "";

        datalist = $('<datalist id="modprop_'+propname+'"></datalist>');
        listref = ' list="modprop_'+propname+'"';
        listclass = " datalisted";

        // choices from model
        var modelvalues = [];
        if ($.isArray(activemodel['properties'][propname]))
        {
            modelvalues = modelvalues.concat(activemodel['properties'][propname]);
            for (var i in activemodel['properties'][propname])
            {
                datalist.append('<option value="'+activemodel['properties'][propname][i]+'"></option>');

            }
            console.log(datalist);
        }

        // choices from map

        // mining the map on the fly
        var mapvalues = [];
        for (var i in vislayer.features)
        {
            var current = vislayer.features[i].attributes[propname];
            if (current && current != "" && mapvalues.indexOf(current) == -1 && modelvalues.indexOf(current) == -1)
            {
                mapvalues.push(current);
                datalist.append('<option value="'+current+'"></option>');
            }

            if (mapvalues.length > 100)
            {
                break;
            }

        }



        var propval = "";
        if (feature['attributes'].hasOwnProperty(propname))
        {
              propval = feature['attributes'][propname];
        }

        var button_extend = '<input type="button" class="btn_extendpropval" value="Replica" id="btn_extendpropval_'+propname+'">';

        var cprop = $('<div class="ctx_topic"><div class="ctx_fieldname">'+propname+'</div>' +
            '<div class="ctx_fieldval"><input type="text" value="'+propval+'" class="featureedit'+listclass+'" id="'+propprefix+propname+'" '+listref+'>'+
            '</div><div class="ctx_fieldact">'+button_extend+'</div></div>');


        cprop.children(".ctx_fieldval").prepend(datalist);

        $("#view_feature").append(cprop);

    }

    //$("#view_feature").append(featurecard);
    setExtenders();

}

function setModelPropForm ()
{

    // sets the properties in the activemodel from the form for a single field



    var prefix = "txt_propvalues_";
    var propname = $(this).attr('id').slice(prefix.length);


    try
    {
        var rawpropvals = $(this).val().split(";");
    }
    catch (err)
    {
        rawpropvals = [];
        rawpropvals.push($(this).val());
    }
    console.log("Setting prop "+propname);
    console.log(rawpropvals);


    var newpropvals = [];
    for (var i in rawpropvals)
    {
        var trimmed = $.trim(rawpropvals[i]);

        if (trimmed != "")
        {
            newpropvals.push(trimmed);
        }
    }

    if (newpropvals.length == 0)
    {
        newpropvals = "str";
    }
    else
    {
        console.log("Setting "+propname+" to "+JSON.stringify(newpropvals));
        activemodel.properties[propname] = newpropvals;
    }


    setSaverHint(true);
    $("#sel_filter_propname").trigger('change');



}


function freeSelection ()
{
    // applies changes to the properties of the current object
    // (so we avoid a change for every keypress)


    // caller provides the event name via caller['type'], if applicable



    // saves changes to the model, if the model detail was open

    $(".ctx_propvalues").each(setModelPropForm);

    // redrawing the filter widget after setting the new properties
    renderFilterMask();


    // saves changes to the feature properties, if a feature was selected

    var feature = vislayer.getFeatureById(cfid);

    if (feature != null)
    {
        $(".featureedit").each(
            function ()
            {
                var propval = $(this).val();
                var propname = $(this).attr('id').slice(propprefix.length);
                console.log("setting "+propname+" in "+cfid+" to "+propval);

                vislayer.getFeatureById(cfid).attributes[propname] = propval;

            }
        );
    }
    else
    {

    }




    resetViewDetail();

    setSaverHint(true);


    // when we do not render a feature, we draw the map card, unless we are using the measure tool (which triggers a different event anyway)

    if (!measurecontrol.active && !drawcontrol.active)
    {
        renderMapCard();
    }

    //console.log(mapview.getControlsBy('active', true));

    $("#statemessage").empty();
    $("#hr_stateview").hide();
    cfid = null;


    // added here so if we modify the geometry we don't leave a trace on the highlight
    applyFilter();


}

function renderFilterMask()
{

    var currentprop = $("#sel_filter_propname").val();
    var currentfilter = $("#txt_filter_propvalue").val();
    var isfiltering = $("#btn_filter_apply").prop("checked");


    $("#view_filter").empty();
    $("#hr_viewfilter").hide();

    var chooser = $('<div class="ctx_fieldname"><select id="sel_filter_propname"><option>Filtro</option></select></div>');
    for (var i in Object.getOwnPropertyNames(activemodel.properties))
    {
        var current = Object.getOwnPropertyNames(activemodel.properties)[i];
        chooser.find("#sel_filter_propname").append('<option value="'+current+'">'+current+'</option>');
    }
    var txtinput = $('<div class="ctx_fieldval"><input type=text id="txt_filter_propvalue" list="filter_suggested"><datalist id="filter_suggested"></datalist></div>');
    var applyfilter = '<div class="ctx_fieldact"><input type="checkbox" id="btn_filter_apply"></div>';


    $("#view_filter").append(chooser);
    $("#view_filter").append(txtinput);
    $("#view_filter").append(applyfilter);
    $("#hr_viewfilter").show();



    console.log("re-setting filter mask options");
    $("#sel_filter_propname").val(currentprop);
    $("#txt_filter_propvalue").val(currentfilter);
    $("#btn_filter_apply").prop("checked", isfiltering);

    // and re-apply the filter since it could have been called after removing props or changing values
    applyFilter();


}




function renderMapCard()
{
    // shows all the details about the current map


    // catch-all redraw: since renderMapCard is usually called after changes to the model, we can use this to redraw the filter widget
    renderFilterMask();

    resetViewDetail();

    // showing the map type
    $("#view_mapmodel").append('<div class="ctx_topic"><div class="ctx_fieldname">Tipologia</div><div class="ctx_fieldval"  id="maptypedef">'+getMapTypeName()+'</div>');

    $("#view_mapmodel").append('<div class="ctx_topic"><div class="ctx_fieldname ctx_header">Campi</div><div class="ctx_fieldname ctx_header">Valori consigliati</div></div>');

    for (var propname in activemodel['properties'])
    {

        var button_destroy = '<input type="button" class="btn_modelform btn_removeprop" value="-" id="btn_removeprop_'+propname+'">';
        var button_import = '<input type="button" class="btn_modelform btn_importpropval" value="Importa" id="btn_importpropval_'+propname+'">';
        //var button_destroy = '<input type="image" src="/static/resource/fwp_remove.png" id="btn_removeprop_'+propname+'">';

        var suggestions = "";
        var sep = "";
        var proprange = activemodel['properties'][propname];
        if ($.isArray(proprange))
        {
            // render prop values list
            for (var i in proprange)
            {
                suggestions+=proprange[i]+";";
            }
        }
        $("#view_mapmodel").append('<div class="ctx_topic ctx_mapmodel"><div class="ctx_fieldname">'+propname+'</div><div class="ctx_fieldval"><input class="ctx_propvalues" id="txt_propvalues_'+propname+'" type="text" value="'+suggestions+'"></div><div class="ctx_fieldact">'+button_import+button_destroy+'</div></div>');


    }

    var button_addnew = '<input type="button" class="btn_modelform" value="+" id="btn_addprop">';

    // adding new property
    $("#view_mapmodel").append('<div class="ctx_topic" id="addmodelproperty"><div class="ctx_fieldname"><input type="text" id="model_newpropname"></div><div class="ctx_fieldval"><input type="text" id="model_newpropvals" value=""></div><div class="ctx_fieldact">'+button_addnew+'</div></div>');

    checkNewPropName();


}


function autoZoom (olmap)
{
    /*
     Checks if we have an active map and if it has a bbox. If not, zooms to the bbox of the proxy
     */

    // used when called by the home button
    if (!olmap)
    {
        olmap = mapview;
    }

    //console.log("Checking bbox, map and proxy");
    //console.log(olmap);
    //if (activemap)
    //{
    //    console.log(mapdata['bbox']);
    //}

    console.log(proxy_bb);

    var zoomto = proxy_bb;
    if (activemap)
    {
        try
        {
            zoomto = mapdata['bbox'];
        }
        catch (exception)
        {
            //do nothing, we go with the original zoomto value
        }


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

function closeFeedback()
{

    $("#statemessage").empty();
    $("#hr_stateview").hide();
}