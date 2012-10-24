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
var singleobjstring = { 'LineString': 'Tratta', 'Point': 'Punto'};
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

// boolean: determines if the user is replacing the main map or integrating
// false by default as the first load is ALWAYS a reset of the (non-existing) model
var loadmode_incremental = false;

// geography and details of the current map
var mapdata;
// actual model in use, may be bigger than what is provided by the map data
var modeldata;

// all available models for this session, can include federated ones
var models;

var menufunctions = {
    'menu_integratemap': funcIntegrateMap,
    'menu_integratemodel': funcIntegrateModel,
    'menu_savemap': funcSaveMap,
    'menu_geoshift': funcGeoShift,
    'menu_loadsnap': funcLoadSnap,
    'menu_showmap': funcShowMap,
    'menu_showmodel': funcShowModel,
    'menu_filter': funcCreateFilter
};

// map controls
var snapcontrol;
var drawcontrol;
var editcontrol;
var measurecontrol;
var homecontrol;
var selectcontrol;
// panel with editing/selection controls
var panel;

// id of the feature currently being edited
var cfid;

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


// if this is the first load of the page;
// (first loading screen is closed automatically)
var firstload = true;

function pageInit( req_proxy_id, req_meta_id, req_map_id, req_mode, req_proxy_type, req_manifest, req_proxy_maps, req_models)
{

    freeSelection();

    proxy_id = req_proxy_id;
    proxy_type = req_proxy_type;
    meta_id = req_meta_id;
    map_id = req_map_id;

    console.log("Context: "+proxy_type+" "+proxy_id+"/"+meta_id+"/"+map_id);

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
    models = req_models;



    initMenu();
    initForms();

    // TODO: move inside the clause and avoid rendering
    initMapWidget();
    if (vismode != 'modeledit')
    {
        console.log("Showing map widget");
        setMapControlsNav();
    }
    else
    {
        $("#mapview").hide();
    }



    if (map_id != null)
    {
        if (meta_id != '.create')
        {
            console.log("Starting loading "+meta_id+"/"+map_id);
            getUploadedMap(meta_id, map_id);
        }
        else
        {
            console.log("Creating new map from model "+map_id);
            createNewMap(map_id)
        }

    }




    $(".autocombofield").live('click', openValueSelector);
    $(".autocombofield").live('change keyup mouseup', setPropertyValue);
    $("#model_newpropname").live('change keyup mouseup', toggleAddModelProp);
    $("#autovalueselector").live('change', prefillPropertyValue);
    $("#autovalueselector").live('focusout', removeValueSelector);
    //TODO: better focus handling to remove autovalueselector

    $(".button_modeladdpropvalue").live('click', addModelPropValue);
    $(".button_modelremovepropvalue").live('click', removeModelPropValue);
    $(".button_modelimportpropvalue").live('click', importModelPropValue);
    $(".button_modelremoveprop").live('click', removeModelProp);
    $("#model_addnewprop").live('click', addModelProp);
    $(".textfield_modelpropvalue").live('change keyup mouseup', updateModelPropertyValue);

    $("#savemapto_filename").live("change keyup mouseup", checkSaveMapOverwrite);
    $("#savemapto_dest").live("change", checkSaveMapOverwrite);

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

    $("#progress_mapload").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto"
    });

    $("#progress_datasave").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto"
    });



    $("#form_datasave").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Salva": {
                id : "form_newfile_confirmsave",
                text: "Salva",
                click: trySaveMap
            }
        }
    });

    // bindings for form-connected elements
    $("#newmap_load").live("change", verifyMapLoadSelection);
    $("#uploadfield").live("change", updateUploadSelector);

}



// MENU DRIVEN FUNCTIONS

// all functions have the prefix "func" to distinguish them as menu launchers from actual "system" functions


function funcLoadMap ()
{

    // opens the map loading dialog

    //TODO: placeholder, implement
    console.log("opening map loading dialog");

    // sets to non-incremental for later
    loadmode_incremental = false;

    $("#newmap_load").val("");
    $("#form_loadmap").dialog("open");
    verifyMapLoadSelection();

}

function funcIntegrateMap ()
{
    //TODO: placeholder, implement
    console.log("opening map integration dialog");

    // set for later applyMap function to use
    loadmode_incremental = true;
    $("#newmap_load").val("");
    $("#form_loadmap").dialog("open");
    verifyMapLoadSelection();

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
    $("#form_datasave").dialog("open");
    $("#form_datasave .progressinfo").hide();


    var today = new Date();

    var day = today.getDay()>10 ? today.getDay().toString() : "0"+today.getDay().toString();
    var month = today.getMonth()<10 ? "0"+today.getDay().toString() : today.getDay().toString();
    var year = today.getFullYear().toString();


    var basesavename = map_id;
    if (map_id.length > 9 && map_id.substring(map_id.length-9).match(/_[0-9]{8}/))
    {
        basesavename = map_id.substring(0,map_id.length-9);
    }

    try
    {
        $("#savemapto_filename").val(basesavename+"_"+day+month+year);
    }
    catch (err)
    {
        $("#savemapto_filename").val("");
    }

    $("#savemapto_filename").change();



}

function checkSaveMapOverwrite()
{
    //TODO: placeholder, implement
    // put real check

    $("#warning_mapsaveoverwrite").hide();
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
    console.log("switching to map display");

    //$("#standalonebar").show();
    $("#modelstruct tbody").empty();
    $("#modelview").hide();
    $("#mapview").show();

}

function funcShowModel ()
{
    console.log("switching to model display");
    //$("#standalonebar").hide();
    $("#mapview").hide();
    $("#modelview").show();
    $("#modelstruct tbody").empty();
    initModelWidget();

}

function funcCreateFilter()
{
    //TODO: placeholder, implement
    console.log("creating a filter for view");
}

// END OF MENU FUNCTIONS


function trySaveMap ()
{

    $("#form_datasave").dialog("close");

    $("#progress_datasave").dialog("open");
    $("#progress_datasave .progressinfo").hide();
    $("#progspinner_datasave").show();
    $("#progress_stage_datasaving").show();

    //TODO: placeholder, implement

    var mapname = $("#savemapto_filename").val();
    var mapmeta = $("#savemapto_dest").val();

    var mapjson = layerToJSON(vislayer, mapname);

    var urlstring = "/fwst/saveng/"+proxy_id+"/"+mapmeta+"/"+mapname+"/";

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
    // TODO: PLACEHOLDER, IMPLEMENT

    console.log("Reporting successful save callback")
    console.log(data);

    $("#progress_datasave .progressinfo").hide();
    $("#progspinner_datasave").hide();

    if (data['success'])
    {
        $("#datasave_success").show();


    }
    else
    {
        $("#datasave_fail").show();
        $("#datasavefail_explain").append(data['report']);
        $("#datasavefail_explain").show();

    }


    //TODO: FIX LOADER LIST

}

function reportFailedSave (err, xhr)
{
    // TODO: PLACEHOLDER, IMPLEMENT
    $("#progspinner_datasave").hide();

    $("#progress_datasave .progressinfo").hide();
    $("#datasave_fail").show();
    $("#datasavefail_explain").append(data['report']);
    $("#datasavefail_explain").show();

}


function layerToJSON(layer, mapid)
{

    var bbox;
    try
    {
        if (layer.getDataExtent() != null)
        {

            bbox = layer.getDataExtent().toArray();

            console.log("Tried getting bbox from map extent, had");
            console.log(bbox);

            var endA = reprojPoint(bbox[0], bbox[1], mapview);
            console.log(endA);
            var endB = reprojPoint(bbox[2], bbox[3], mapview);
            console.log(endB);

            bbox = [endA.x, endA.y, endB.x, endB.y];

            console.log("Bbox from map data");
        }
        else
        {

            bbox = bb_meta;
            console.log("Bbox from meta");
        }
    }
    catch (ex)
    {
        console.log("Exception while trying to set the bbox");
        console.log(ex);
        bbox = bb_proxy;
        console.log("Bbox from proxy");
    }

    var jsondata = {
        'type': 'FeatureCollection',
        'model': modeldata,
        'features': [],
        'bbox': bbox
    };

    if (mapid)
    {
        jsondata['id'] = mapid;
    }

    var geom;
    var props;

    var badfeaturescount = 0;
    for (var fid in layer.features)
    {

        if (layer.features[fid].hasOwnProperty('_sketch') && layer.features[fid]._sketch === true)
        {
            //console.log("Found highlighter as feature "+fid);
            // avoiding highlighters
            continue;
        }


        geom = JSON.parse(gjformat.write(layer.features[fid].geometry));
        props = layer.features[fid].attributes;

        for (var propname in modeldata['properties'])
        {
            // we add empty values for any property that should not be already created in the feature
            if (!props.hasOwnProperty(propname))
            {
                props[propname] = "";
            }
        }

        // we do not specify an ID since the geoid is not actually relevant for our use and can change and/or be erased on merges.

        // safety check to avoid inconsistencies being introduced during editing by OpenLayers
        if (geom['type'] == modeldata['objtype'])
        {
            jsondata['features'].push({
                'type': "Feature",
                'geometry': geom,
                'properties': props
            });
        }
        else
        {
            console.log("Conflict: "+geom['type']+" against "+modeldata['objtype']);
            //console.log(layer.features[fid]);
            badfeaturescount++;
        }


    }
    console.log("Removed "+badfeaturescount+" incompatible features");

    return jsondata;




}

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
        // TODO: placeholder, implement as getUploadedMap
        // should simply need a getUploadedMap with the correct parameters

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
        error: reportFailedUpload
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

    $("#progress_mapload").dialog("open");
    $("#progress_mapload .formwarning").hide();
    $("#progress_mapload .progressinfo").hide();
    $("#progspinner_mapload").show();
    $("#progress_stage_maploading").show();

    $.ajax ({
        url:    urlstring,
        async:  true,
        success:    applyNewMap,
        error:  reportFailedDownload
    });

}

function resetMap ()
{

    // note: this should maybe go implicitly BEFORE the loading rather than being conditionally activated after the user tried to load the data.

    mapdata = null;

    vislayer.destroyFeatures();
    filterlayer.destroyFeatures();
    // we assume that a reset of the mapview implies that we won't likely use the same snaplayer
    snaplayer.destroyFeatures();

}

function resetModel()
{
    modeldata = {};
}


function applyNewMap(newdata, textStatus, jqXHR)
{
    $("#progress_stage_maploading").hide();
    $("#progress_stage_rendering").show();

    // TODO: implement rendering

    console.log("Rendering map data");
    console.log(newdata);

    if (!loadmode_incremental)
    {

        resetMap();
        resetModel();

        modeldata = getMapModel(newdata);

        // set here because the result depends on the model
        if (vismode != 'modeledit')
        {
            setMapControlsEdit();
        }

    }

    // TODO: workaround to avoid full render
    renderGeoJSONCollection(newdata, vislayer);
    autoZoom(mapview);

    $("#progress_stage_rendering").hide();
    $("#progspinner_mapload").hide();
    $("#maploadfinished_success").show();


    if (firstload)
    {
        $("#progress_mapload").dialog("close");
        firstload = false;
    }

    if (vismode == 'modeledit')
    {
        funcShowModel();
    }

}


function createNewMap (modelname)
{

    resetMap();
    resetModel();



    console.log("Getting model "+modelname);
    modeldata = models[modelname];
    setMapControlsEdit();

    autoZoom(mapview);

}


function getMapModel (jsondata)
{
    // extracts the model from the map data, if needed tries a heuristic on the features

    // the model ON the map
    var localmodel = {};
    var localprops = [];

    // first we need to determine the basic model
    if (jsondata && jsondata.hasOwnProperty('model'))
    {
        localmodel = jsondata['model'];
        for (var propname in localmodel['properties'])
        {
            localprops.push(propname);
        }
    }
    else
    {
        localmodel ['objtype'] = jsondata['features'][0]['geometry']['type'];
        localmodel ['properties'] = {};
        localmodel ['name'] = null;

    }

    // then we run through the map properties in case the model details have not been set up correctly
    for (var i in jsondata['features'])
    {
        for (var propname in jsondata['features'][i]['properties'])
        {
            if (localprops.indexOf(propname)==-1)
            {
                localprops.push(propname);
                localmodel['properties'][propname] = "string";
            }
        }
    }

    console.log("Extracted model");
    console.log(localmodel);



     return localmodel;


}

function renderGeoJSONCollection (jsondata, layer)
{
    // renders a geojson collection to the visualisation layer


    var render_errors = [];
    for (var i in jsondata['features'])
    {

        // 3d coordinates are flattened to avoid rendering and saving issues
        // MULTILINE and MULTIPOINT have already been sorted out when uploading and translating the map
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
            var fmap = gjformat.read(fstring);
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


    if (render_errors.length > 0)
    {

        $("#warning_maploadrenderissues").show();


        if (render_errors.length > 100)
        {
            console.log("Error reporting stopped at 100th errors of "+render_errors.length);
        }
        console.log("Error sample:");
        console.log(render_errors[0]);
    }




}

function reportFailedUpload (xhr,err)
{

    $("#progress_upload .progressinfo").hide();
    $("#progspinner_upload").hide();
    $("#upload_fail").show();

    console.log("Reporting failed download of the requested file");
    console.log("readyState: "+xhr.readyState+"\nstatus: "+xhr.status);
    console.log("responseText: "+xhr.responseText);
    console.log(err);

    $("#uploadfail_explain").append(err);

}


function reportFailedDownload (xhr,err)
{
    $("#progress_mapload .progressinfo").hide();
    $("#progspinner_mapload").hide();
    $("#maploadfinished_fail").show();

    console.log("Reporting failed download of the requested file");
    console.log("readyState: "+xhr.readyState+"\nstatus: "+xhr.status);
    console.log("responseText: "+xhr.responseText);
    console.log(err);

    $("#maploadfail_explain").append(err);

    // TODO: implement closing button on the dialog as BACK action of the browser in case we are in single-map mode (MAPEDIT, MAPVIEW)

}


function initModelWidget()
{

    // TODO: add autofill with current SET value (not map-based)

    var base = $("#modelstruct tbody");
    for (var propname in modeldata['properties'])
    {
        base.append('<tr class="modelprop_widget" id="modelprop_widget_'+propname+'">' +
            '<td><b>' + propname + '</b></td>' +
            '<td><input id="modeladdpropvalue_'+propname+'" class="button_modeladdpropvalue" type="button" value="Aggiungi valore"></td>' +
            '<td><input id="modelimportpropvalue_'+propname+'" class="button_modelimportpropvalue" type="button" value="Importa i valori della mappa"></td>' +
            '<td><input type="button" class="button_modelremoveprop" id="modelremoveprop_'+propname+'" value="Elimina proprietà"></td>' +
            '</tr>' +
            '<tr id="modelproval_widget_'+propname+'"><td></td><td colspan=2 class="modelprop_valtable" id="valtable_'+propname+'"></td><td></td></tr>');

        var setvalues = modeldata['properties'][propname]

        if ($.isArray(setvalues))
        {
            for (var i in setvalues)
            {
                addSetModelPropValue(propname, setvalues[i], true)
            }

        }

    }



}

function addModelPropValue ()
{
    var prefix = "modeladdpropvalue_";
    var propname = this.id.substr(prefix.length);

    addSetModelPropValue (propname, "", true);

}

function addSetModelPropValue (propname, propvalue, rebuild)
{


    $("#valtable_"+propname).append('<div class="valtable_propvalue"><input type="text" class="textfield_modelpropvalue textfield_modelpropvalue_'+propname+'" value="'+propvalue+'"><input type="button" value="Elimina valore" class="button_modelremovepropvalue"></div>');

    if (rebuild===true)
    {
        rebuildModelFromForm();
    }


}

function removeModelPropValue ()
{
    $(this).closest(".valtable_propvalue").remove();
    rebuildModelFromForm();
}

function removeModelProp ()
{

    var prefix = "modelremoveprop_";
    var propname = this.id.substr(prefix.length);

    $("#modelprop_widget_"+propname).remove();
    $("#modelpropval_widget_"+propname).remove();
    rebuildModelFromForm();
}

function toggleAddModelProp()
{

    // activates or deactivates the button to add a new property to the model
    $("#model_addnewprop").prop('disable', $("#model_newpropname").val()=="");
}

function addModelProp ()
{
    //adds a new property to the model

    console.log("Adding new model property");

    var newpropname = $("#model_newpropname").val();
    if (newpropname != null && newpropname != "" && !modeldata.properties.hasOwnProperty(newpropname))
    {
        modeldata.properties[newpropname] = "string";
    }

    // in this case we add to the model and re-render the whole table
    // TODO: consider reversing the process
    funcShowModel();

}

function importModelPropValue ()
{

    var prefix = "modelimportpropvalue_";
    var propname = this.id.substr(prefix.length);
    // adds all non-already set values from the map in the form


    var formpropvalues = [];
    var mappropvalues = [];

    try
    {
        var formvalues = $(".textfield_modelpropvalue_"+propname);
        for (var v in formvalues)
        {
            var cval = formvalues[i].val();

            if (cval != null && formpropvalues.indexOf(cval) == -1)
            {
                formpropvalues.push(cval);
            }
        }
    }
    catch (err)
    {
        // do nothing, no existing values set for this property
    }


    for (var f in vislayer.features)
    {
        try
        {
            var cval = vislayer.features[f]['attributes'][propname];
        }
        catch (err)
        {
            // feature does not have the requested property
            continue;
        }

        if (cval != null && formpropvalues.indexOf(cval)==-1 && mappropvalues.indexOf(cval)==-1)
        {
            mappropvalues.push(cval);
        }

    }

    //console.log("Values to add for "+propname);
    //console.log(mappropvalues);

    for (var i in mappropvalues)
    {
        addSetModelPropValue(propname, mappropvalues[i], false);
    }

    rebuildModelFromForm();
}

function updateModelPropertyValue()
{
    // rebuilds only the single section of the model for this particular property

    var base = $(this).closest(".modelprop_valtable");
    var prefix = "valtable_";
    var propname = base.id.substr(prefix.length);

    var valuelist = $(".textfield_modelpropvalue_"+propname);

    var vals = [];
    for (var v = 0; v < valuelist.length; v++)
    {
        vals.push($(valuelist[v]).val());
    }

    modeldata['properties'][propname] = vals;

    console.log("Updated model data for property "+propname);
    console.log(modeldata['properties'][propname]);
}

function rebuildModelFromForm()
{

    // rebuilds the property section of the model according to the contents of the model form

    var prefix = "modelprop_widget_";
    var modelform = $(".modelprop_widget");
    var newprops = {};
    for (var i = 0; i < modelform.length; i++)
    {
        var cid = modelform[i].id;
        var propname = cid.substr(prefix.length);

        newprops[propname] = "string";

        var valuelist = $(".textfield_modelpropvalue_"+propname);

        var vals = [];
        if (valuelist.length > 0)
        {
            for (var v = 0; v < valuelist.length; v++)
            {
                vals.push($(valuelist[v]).val());
            }
            newprops [propname] = vals;

        }
        else
        {
            if (modeldata['properties'].hasOwnProperty(propname) && !$.isArray(modeldata['properties']['propname']))
            {
                newprops[propname] = modeldata['properties'][propname];
            }
        }


    }

    modeldata['properties'] = newprops;

    /*
    console.log("New model properties and values");
    console.log(modeldata);
    */

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
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#888888", strokeColor: "#888888", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 8});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    snaplayer= new OpenLayers.Layer.Vector("Allineamento", {styleMap: featurestylemap});

    // FILTER layer
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#188E01", strokeColor: "#188E01", strokeWidth: 6, strokeDashstyle: "solid", pointRadius: 10});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    filterlayer = new OpenLayers.Layer.Vector("Filtro", {styleMap: featurestylemap});

    // VIS layer
    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#FF9900", strokeColor: "#FF9900", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});
    vislayer= new OpenLayers.Layer.Vector("Mappa", {styleMap: featurestylemap});

    mapview.addLayers([snaplayer, filterlayer, vislayer]);


    if (vismode == "modeledit")
    {
        vislayer.setVisibility(false);
    }

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

function setMapControlsEdit()
{
    // creates the panel controls according to the current vismode

    // mapview has only navigation and selection
    // mapedit has navigation, selection (+editing, but that's on the sidepanel property stuff), modify geo
    // full has nav, sel, modify
    // modeledit has nothing (map is not displayed)

    var alleditcontrols = [snapcontrol, drawcontrol, editcontrol, measurecontrol, homecontrol, selectcontrol];

    for (var i in alleditcontrols)
    {
        try
        {
            alleditcontrols[i].deactivate();
        }
        catch (err)
        {
            console.log("Control n."+i+" (see code) not active yet");
        }
    }

    if (vismode == "modeledit")
    {
        // note that if the page is loaded correctly this step should never be reached
        return;
    }

    var maptype = modeldata['objtype'];

    if (vismode == "mapedit" || vismode == "full")
    {

        // add snap control
        snapcontrol = new OpenLayers.Control.Snapping ({
            layer: vislayer,
            targets: [vislayer, snaplayer],
            greedy: false
        });
        mapview.addControl(snapcontrol);
        snapcontrol.activate();
    }


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
                }
            );
    }

    editcontrol = new OpenLayers.Control.ModifyFeature(
        vislayer, {
            displayClass: "olLabsControlModifyFeature",
            title: "Seleziona"
        }
    );


    homecontrol = new OpenLayers.Control.Button(
    {
        displayClass: "olLabsControlRebase",
        trigger: autoZoom,
        title: "Reimposta inquadratura"
    });


    measurecontrol = new OpenLayers.Control.Measure
    (
        OpenLayers.Handler.Path,
        {
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

    selectcontrol = new OpenLayers.Control.SelectFeature
    (
        vislayer, {
            displayClass: "olLabsControlSelectFeature",
            title: "Seleziona"
        }
    );


    var controlslist;

    if (vismode == "mapedit" || vismode == "full")
    {
        controlslist = [drawcontrol, editcontrol, measurecontrol, homecontrol];
    }
    else if (vismode == "mapview")
    {
        controlslist = [selectcontrol, homecontrol];
    }


    console.log("Adding controls for vismode "+vismode);
    console.log(controlslist);

    // Adding editing controls
    panel = new OpenLayers.Control.Panel({
        displayClass: "olControlEditingToolbar",
        allowDepress: true
    });
    panel.addControls(controlslist);
    mapview.addControl(panel);

    vislayer.events.register('featureselected', mapview, renderFeatureCard);
    vislayer.events.register('featureunselected', mapview, freeSelection);

}

function handleMeasure() {
    //TODO: placeholder, implement
}

function hideDistance() {
    //TODO: placeholder, implement
}

function renderFeatureCard(caller)
{

    freeSelection();

    var feature = caller['feature'];
    cfid  = feature.id;

    console.log("Viewing/editing feature "+cfid);
    console.log(feature);

    $("#featuredetails").append("Oggetto selezionato: "+singleobjstring[modeldata['objtype']]);

    //for (var propname in feature.attributes)
    for (var propname in modeldata['properties'])
    {

        var propvalue;
        try
        {
            propvalue = feature.attributes[propname];
            if (propvalue == null)
            {
                propvalue = "";
            }
        }
        catch (err)
        {
            propvalue = "";
        }



        if (vismode == "mapview")
        {
            $("#featuredesc tbody").append('<tr class="feature_propdata" id="feature_propdata_'+propname+'">' +
                '<td class="feature_propname">'+propname+'</td>' +
                '<td class="feature_propvalue">'+propvalue+'</td>' +
                '<td></td>' +
                '</tr>');
        }
        else
        {

            var inputfield = '<input type="text" class="autocombofield feature_propvalue" id="textfield_'+propname+'" value="'+propvalue+'">';
            $("#featuredesc tbody").append('<tr class="feature_propdata" id="feature_propdata_'+propname+'">' +
                '<td class="feature_propname">'+propname+'</td>' +
                '<td>'+inputfield+'</td>' +
                '<td><input type="button" value="Copia" class="button_replicatevalue"></td>' +
                '</tr>');
        }
    }

    checkReplicationChance();
    $("#featurecard").show();
}


function openValueSelector()
{
    // remove any other open valueselector
    $("#autovalueselector").remove();
    $("#featuredesc br").remove();

    var prefix = 'textfield_';
    var propname = this.id.substr(prefix.length);

    console.log("Checking prefilled values for field "+propname);

    var propvalues = [];

    // TODO: get values from model

    // getting from map
    for (var fid in vislayer['features'])
    {

        var cpropvalue;
        try
        {
            cpropvalue = vislayer['features'][fid]['attributes'][propname];
        }
        catch (err)
        {
            cpropvalue = null;
        }

        if (cpropvalue != null && propvalues.indexOf(cpropvalue) == -1)
        {
            propvalues.push(cpropvalue);
        }
    }

    var valueselector = $('<select id="autovalueselector"><option>Valori disponibili</option></select>');
    for (var i in propvalues)
    {
        valueselector.append('<option value="'+propvalues[i]+'">'+propvalues[i]+'</option>');
    }

    $("#"+this.id).closest("td").append("<br>");
    $("#"+this.id).closest("td").append(valueselector);

}

function prefillPropertyValue()
{
    console.log("Filling current with suggestion");
    if ($(this).val() != "")
    {
        var dest = $($(this).closest("td").find(".autocombofield")[0]);
        dest.val($(this).val());
        dest.change();
    }
}

function removeValueSelector()
{
    $("#autovalueselector").remove();
}

function setPropertyValue()
{

    var prefix = 'textfield_';
    var propname = this.id.substr(prefix.length);

    console.log("Setting "+propname+" property value to "+$(this).val());

    var cfeature = vislayer.getFeatureById(cfid);

    vislayer.getFeatureById(cfid)['attributes'][propname] = $(this).val();
    removeValueSelector();



}




function checkReplicationChance()
{
    // checks if replication buttons can be active (i.e. if there is a filter to >1 object
    // TODO: implement, placeholder
    // currently off by default
    $(".button_replicatevalue").prop('disable', true);
}

function freeSelection()
{
    $("#featuredetails").empty();
    $("#featuredesc tbody").empty();
    $("#featurecard").hide();

}


function autoZoom (olmap)
{
    /*
     Checks if we have an active map and if it has a bbox. If not, zooms to the bbox of the meta, if we have it, or of the proxy itself
     */


    // TODO: verify why zoom right after load and zoom later have different results without changing the feature data

    // to be fixed
    if (vismode == "mapview" || vismode == "full" || vismode == "mapedit")
    {
        try
        {
            if (vislayer.getDataExtent() != null)
            {
                console.log("Auto zoom by mode");
                mapview.zoomToExtent(vislayer.getDataExtent());
                return;
            }

        }
        catch (err)
        {
            console.log("Could not zoom to data extent");
        }
    }

    // actual data extent: if this is smaller than the assigned bounding box, though, we want to keep the larger one
    var actualextent;
    try
    {
        actualextent = vislayer.getDataExtent();
    }
    catch (err)
    {
        actualextent = null;
    }

    console.log("Checking actual data extent");
    console.log(actualextent);

    // used when called by the home button
    if (!olmap)
    {
        console.log("Forcing mapview for zoom");
        olmap = mapview;
    }
    console.log(olmap);

    console.log(bb_proxy);

    // pattern: we check for a "current" bbox, then we check for the loaded map bbox, or meta bbox, finally the proxy

    var zoomto = null;

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


    if (zoomto == null || !$.isArray(zoomto) || zoomto.length!=4)
    {
        console.log("Getting bbox from proxy");
        zoomto = bb_proxy;
    }


    console.log(zoomto);

    //combining bounding boxes
    // TODO: fix the reprojection issue on actualextent
    // (which means we should be able to avoid the separate zoomToExtent call earlier

    /*
    if (actualextent != null)
    {
        if (zoomto[0] > actualextent[0]) { zoomto[0] = actualextent[0]; }
        if (zoomto[1] > actualextent[1]) { zoomto[1] = actualextent[1]; }
        if (zoomto[2] < actualextent[2]) { zoomto[2] = actualextent[2]; }
        if (zoomto[3] < actualextent[3]) { zoomto[3] = actualextent[3]; }
    }
    */

    console.log("Combined bbox");
    console.log(zoomto);

    zoomToBBox(olmap, zoomto);

}

function zoomToBBox (olmap, bbox)
{
    console.log("Moving to");
    console.log(bbox);

    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());

    console.log(olmap.id);
    console.log(bounds);
    olmap.zoomToExtent (bounds, true);
    console.log("Actual viewport extent after zoom");
    console.log(olmap.getExtent());


}


function verifyMapLoadSelection ()
{

    if (loadmode_incremental)
    {
        $("#warning_maploadoverwrite").hide();
        $("#warning_maploadlosechanges").hide();
    }


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

function reprojPoint (pointX, pointY, olmap)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(olmap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84));


    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}