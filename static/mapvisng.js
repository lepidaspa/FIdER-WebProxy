/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/17/12
 * Time: 11:36 AM
 * To change this template use File | Settings | File Templates.
 */


var keycode_ENTER = 13;
var keycode_ESC = 27;

var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var objtypestrings = { 'LineString': 'tratte', 'Point': 'nodi'};
var singleobjstring = { 'LineString': 'Tratta', 'Point': 'Nodo'};
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
    'menu_loadsnapmap': funcLoadSnap,
    'menu_showmap': funcShowMap,
    'menu_showmodel': funcShowModel,
    'menu_filter': funcCreateFilter,
    'menu_dloadimage': tryExportView,
    'menu_dloadmapdata': tryExportMapData
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
// layer used for WMS background
var rasterlayer;

// format used to translate and output coordinates from the map
var gjformat;


// if this is the first load of the page;
// (first loading screen is closed automatically)
var firstload = true;

// used to keep track of which export provider is in use through the callback flow since different providers (g/osm) have different canvas sizes
var exportprovider;

// viewportsize
var viewportWidth;
var viewportHeight;

// final size of the viewport in map rendering, except resampling (e.g. google x 2)
var vpCropWidth;
var vpCropHeight;

// variables used to control sizes and resample according to the provider
var limitHeight;
var limitWidth;
var sizeMultip;




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
            createNewMap(map_id);
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

    $("#button_removefeature").live("click", removeCurrentFeature);

    $("body").live("keyup", tryUnselectMode);

    $("#text_geosearch").live("keyup", tryGeoSearch)

}

function tryExportMapData()
{
    console.log("Trying to export the full map in geojson format");

    $("#maptojson").dialog("open");

    var linkstring = $("<a>Scarica mappa</a>");
    var metadesc = meta_id == ".st" ? "Lavorazione" : meta_id;

    linkstring.attr('href', "/fwp/getng/"+proxy_id+"/"+meta_id+"/"+map_id+"/src/");
    linkstring.attr('download', proxy_name+"_"+meta_id+"_"+map_id+".geojson");

    $("#mapdloadlinkjson").empty().append(linkstring);


}


function tryExportView()
{

    $("#progress_imagerender").dialog("open");
    $("#progress_imagerender .progspinner").show();
    $("#progress_imagerender .formbrieding").show();
    $("#renderfinished_fail").hide();
    $("#btn_renderprogress_close").hide();


    console.log("Trying to export the viewport");


    var drawcenter = new OpenLayers.LonLat(mapview.getCenter().lon, mapview.getCenter().lat).transform(mapview.getProjectionObject(), new OpenLayers.Projection(proj_WGS84));

    viewportWidth = $(mapview.div).width();
    viewportHeight = $(mapview.div).height();

    //console.log(drawcenter);
    //console.log(drawcenter.lon);
    //console.log(drawcenter.lat);
    drawcenter = [drawcenter.lat, drawcenter.lon];
    var drawzoom = mapview.getZoom();

    console.log("Getting map background with zoom "+drawzoom);



    //$("#btn_downloadMapRender").hide();

    var provider;
    var maptype;
    if (mapview.baseLayer.name == 'OpenStreetMap')
    {
        provider = 'osm';
        maptype = 'mapnik';
    }
    else
    {
        provider = 'google';
        maptype = mapview.baseLayer.name.split(" ",2)[1].toLowerCase();

    }

    limitHeight = provider == 'google' ? 640 : 1280;
    limitWidth = provider == 'google' ? 640 : 1280;

    vpCropWidth = Math.min(viewportWidth, limitWidth);
    vpCropHeight = Math.min(viewportHeight, limitHeight);

    // hardcoded: can switch to 2 but gives problems in rebuilding vector geometry later
    var googleMultip = 1;

    sizeMultip = provider == 'google' ? googleMultip : 1;

    $("#exportcanvas").empty().append('<canvas id="drawingarea" height='+vpCropHeight*sizeMultip+' width='+vpCropWidth*sizeMultip+'></canvas>');

    console.log("Parameters for map call");

    exportprovider = provider;
    var parameters = {
        'provider': provider,
        'maptype': maptype,
        'drawcenter': drawcenter,
        'drawzoom': drawzoom,
        'drawsize': [vpCropWidth, vpCropHeight]
    };


    console.log(parameters);

    $.ajax ({
        url: '/fwp/staticdl/',
        data:   {jsondata: JSON.stringify(parameters)},
        async: true,
        type: 'POST',
        success: function (data)
        {

            $("#progress_imagerender").dialog("close");
            $("#mapdloadlinkpng").empty().append("L'operazione di rendering può richiedere tempi elevati.<br>In caso di interruzione da parte del browser, premere il pulsante Continua.");
            $("#btn_maptoimage_close").hide();
            $("#maptoimage").dialog("open");


            renderExportableMap(data);




        },
        error: function () {

            $("#progress_imagerender .progspinner").hide();
            $("#progress_imagerender .formbrieding").hide();
            $("#renderfinished_fail").show();
            $("#btn_renderprogress_close").show();
            console.log("ERROR received");
        }
    });

}

function renderExportableMap (rawimagedata)
{
    console.log("succeeded downloading remote map");
    //console.log(data);

    // cleaning the context
    var canvas = document.getElementById('drawingarea');
    var context = canvas.getContext('2d');
    context.clearRect(0, 0, vpCropWidth*sizeMultip, vpCropHeight*sizeMultip);

    console.log("Ready to render");
    //console.log(typeof data);

    $("#exportcanvasshadow").attr("src", "data:image/png;base64," + rawimagedata);
    $("#exportcanvasshadow")[0].onload = function ()
    {
        console.log("Export shadow info");
        console.log($("#exportcanvasshadow"));

        context.drawImage($("#exportcanvasshadow")[0], 0, 0, vpCropWidth*sizeMultip, vpCropHeight*sizeMultip, 0, 0, vpCropWidth*sizeMultip, vpCropHeight*sizeMultip);
        //console.log(canvas.toDataURL());
        renderVectorLayerToCanvas(vislayer, canvas);


        var linkstring = $("<a>Scarica mappa</a>");
        linkstring.attr('href', canvas.toDataURL());
        linkstring.attr('download', map_id+".png");
        $("#mapdloadlinkpng").empty().append(linkstring);

        //$("#btn_downloadMapRender").show();
        $("#btn_maptoimage_close").show();


    };





}

function renderVectorLayerToCanvas (layerfrom, destcanvas)
{

    console.log("Copying "+vislayer.features.length+" features to draw layer");

    var featurestyle = new OpenLayers.Style ( {fillOpacity: 0.3, fillColor: "#FF9900", strokeColor: "#FF9900", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6,strokeLinecap: "round" });
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    var renderlayer = new OpenLayers.Layer.Vector("drawlayer", {name: "drawlayer", styleMap: featurestylemap, renderers: ["Canvas"]});
    renderlayer.id = "rendercanvas";
    //(($(renderlayer.div)).find("canvas")[0]).lineCap="round";
    //(($(renderlayer.div)).find("canvas")[0]).lineJoin="round";

    renderlayer.display(false);



    /* V2: much slower in theory but should scale */

    console.log("Copying renderer canvas to output");
    var element = ($(renderlayer.div)).find("canvas")[0];
    var context = destcanvas.getContext('2d');
    console.log(element);

    var offsetX = (vpCropWidth - viewportWidth)/2;
    var offsetY = (vpCropHeight - viewportHeight)/2;
    mapview.addLayer(renderlayer);

    for (var f in layerfrom.features)
    {

        /*
        if (f % 100 == 0)
        {
            console.log("Rendered "+f+" of "+layerfrom.features.length);
        }
        */

        var geom = layerfrom.features[f].geometry;

        if (cfeature.hasOwnProperty('_sketch') && cfeature._sketch === true)
        {
            continue;
        }


            if (layerfrom.features[f].onScreen())
        {
            renderlayer.addFeatures(new OpenLayers.Feature.Vector(geom));
            context.drawImage(element, offsetX, offsetY);
            renderlayer.destroyFeatures();
        }



    }
    renderlayer.destroy();


}

function downloadMap ()
{
    // downloads the map from the rendering canvas element;

    // kept as backup, currently the map is downloaded straight from a URL

    window.location =  document.getElementById('drawingarea').toDataURL();

}



// FILTER SECTION
function initFiltersForm()
{

    var proplist = [];
    for (var propname in modeldata['properties'])
    {
        if (modeldata['properties'].hasOwnProperty(propname))
        {
            proplist.push(propname);
        }
    }

    var fieldselectors = $(".filter_fieldcriteria");
    for (var i = 0; i < fieldselectors.length; i++)
    {
        var cselect = $(fieldselectors[i]);
        cselect.empty();
        cselect.append('<option value=""></option>');
        for (var p = 0; p < proplist.length; p++)
        {
            cselect.append('<option value="'+proplist[p]+'">'+proplist[p]+'</option>')
        }
    }

    fieldselectors.change();

}

function funcCreateFilter()
{
    $("#form_filter").dialog("open");
}

function addFilterCriteria()
{

    var count = ($(".filter_fieldcriteria").length)+1;


    var proplist = [];
    for (var propname in modeldata['properties'])
    {
        if (modeldata['properties'].hasOwnProperty(propname))
        {
            proplist.push(propname);
        }
    }
    var cselect = '<option value=""></option>';
    for (var p = 0; p < proplist.length; p++)
    {
        cselect += '<option value="'+proplist[p]+'">'+proplist[p]+'</option>';
    }

    var newrow = $('<tr><td><select class="filter_fieldcriteria" id="filter_fieldcriteria_'+count+'">'+cselect+'</select> </td> <td class="layout_filterfield"> <select class="filter_valuecriteria" id="filter_valuecriteria_'+count+'" disabled></select></td><td><img class="imgbutton btn_removefilter" src="/static/resource/visng_model_deleteproperty.png" title="Elimina criterio"></td></tr>');

    $("#layout_filter").append(newrow);
}

function removeFilterCriteria()
{
    $(this).closest('tr').remove();
}

function initFilterValueList()
{
    var base = $(this);
    var propname = base.val();
    var dest = base.closest('tr').find(".filter_valuecriteria");

    dest.empty();

    if (propname == "")
    {
        dest.prop('disabled', true);
        return;
    }

    dest.append('<option value="">(non definito)</option>');
    var existing = [];
    for (var i = 0; i < vislayer.features.length; i++)
    {
        var cfeature = vislayer.features[i];

        if (cfeature.hasOwnProperty('_sketch') && cfeature._sketch === true)
        {
            //console.log("Found highlighter as feature "+fid);
            // avoiding highlighters
            continue;
        }

        //console.log("Checking feature "+vislayer.features[i]);

        try
        {
            var cvalue = cfeature.attributes[propname];
            if (existing.indexOf(cvalue)==-1 && cvalue != null && typeof cvalue != 'undefined')
            {
                existing.push(cvalue);
                dest.append('<option value="'+cvalue+'">'+cvalue+'</option>');
            }

        }
        catch (ex)
        {
            //console.log(ex);
            //ignoring, feature is missing
        }

    }

    //console.log("Total values available: "+existing);
    dest.prop('disabled', existing.length == 0);

}



function applyFilters()
{

    filterlayer.destroyFeatures();

    var conditions = [];
    var fieldsels = $(".filter_fieldcriteria");
    console.log("Creating filter");

    var emptyfilter = true;
    for (var f = 0; f < fieldsels.length; f++)
    {
        var fieldselval = $(fieldsels[f]).val();

        if (fieldselval != '')
        {
            emptyfilter = false;
            var valueselval = $(fieldsels[f]).closest('tr').find(".filter_valuecriteria").val();

            console.log ("Adding condition on "+fieldselval+" -> "+valueselval);
            conditions.push({'field':fieldselval, 'value':valueselval});
            if (valueselval == '')
            {
                conditions.push({'field':fieldselval, 'value':null});
            }
        }

    }

    if (emptyfilter)
    {
        console.log("No real filtering in use");
        return;
    }

    console.log(conditions);

    var featurelist = [];

    for (var cf in vislayer.features)
    {

        var cfeature = vislayer.features[cf];

        if (cfeature.hasOwnProperty('_sketch') && cfeature._sketch === true)
        {
            //console.log("Found highlighter as feature "+fid);
            // avoiding highlighters
            continue;
        }

        // creating the verification array;
        var verified = {};
        for (i in conditions)
        {
            verified [conditions[i]['field']] = false;
        }

        // actual verification
        for (i in conditions)
        {
            var pkey = conditions[i]['field'];
            var pval = conditions[i]['value'];

            if (!verified[pkey])
            {

                if (pval != null)
                {
                    if (cfeature.attributes[pkey] == pval)
                    {
                        verified[pkey] = true;
                    }
                }
                else
                {
                    if (!cfeature.attributes.hasOwnProperty(pkey) || cfeature.attributes[pkey] == null)
                    {
                        verified[pkey] = true;
                    }
                }

            }
        }

        // recap and final confirmation
        var verifiedall = true;
        for (i in conditions)
        {
            if (!verified[conditions[i]['field']])
            {
                verifiedall = false;
                break;
            }
        }

        if (verifiedall)
        {
            featurelist.push(cfeature);
        }

    }



    console.log("Got "+featurelist.length+" features to clone");

    for (var i in featurelist)
    {
        //console.log(featurelist[i]);

        // $clonedfrom is needed to trace back to the original feature  when working on the filter layer

        var clonedfrom = featurelist[i].id;
        //console.log("Adding feature "+clonedfrom+"/"+featurelist[i].id);
        var clonefeature = featurelist[i].clone();
        clonefeature.attributes['$clonedfrom'] = clonedfrom;
        filterlayer.addFeatures(clonefeature);

    }

    console.log("Filtered "+filterlayer.features.length+" features");


}

function realignFilter (event)
{
    // re-aligns the highlight of a feature on the filter layer when the feature is moved on the vislayer

    console.log("Checking for a feature to re-align in the filterlayer");

    var feature = event.feature;
    for (var i in filterlayer.features)
    {
        var cclone = filterlayer.features[i];
        if (cclone.attributes['$clonedfrom'] == feature.id)
        {
            console.log("Realigning feature "+filterlayer.features[i].id+" to feature "+feature.id);
            var newclone = feature.clone();
            newclone.attributes['$clonedfrom'] = feature.id;
            filterlayer.destroyFeatures(cclone);
            filterlayer.addFeatures(newclone);
        }
    }


}

function removeAllFilters()
{

    $(".filter_fieldcriteria").val("");
    $(".filter_fieldcriteria").change();
    filterlayer.destroyFeatures();

}

function replicatePropValue()
{

    if (filterlayer.features.length == 0)
    {
        alert("Per replicare i valori è necessario impostare un filtro");
        return;
    }

    var base = $(this).closest('tr');

    var prefix = 'textfield_';
    var propname = base.find('.feature_propvalue').attr('id').substr(prefix.length);
    var value = base.find('.feature_propvalue').val();

    console.log("Replicating "+propname+" as "+value);


    for (var i in filterlayer.features)
    {
        var destid = filterlayer.features[i]['attributes']['$clonedfrom'];
        vislayer.getFeatureById(destid)['attributes'][propname] = value;

    }

    console.log("Updated "+filterlayer.length+" features");

    applyFilters();

}


function tryGeoSearch (event)
{
    if (event.keyCode == keycode_ENTER)
    {
        //console.log("Enter pressed, launching geosearch");
        geosearch($('#text_geosearch').val());
        event.preventDefault();
    }

}

function reverseGeoSearch (featuregeom, writetoid)
{
    /*
    http://maps.googleapis.com/maps/api/geocode/json?latlng=40.714224,-73.961452&sensor=true_or_false
     */

    var coords = new OpenLayers.LonLat(featuregeom.x, featuregeom.y).transform(mapview.getProjectionObject(), new OpenLayers.Projection(proj_WGS84));


    //console.log("Trying reverse geocoding for coordinates");
    //console.log(coords);

    //console.log("Writing result to ID");
    //console.log(writetoid);

    var dest = $("#"+writetoid);
    //console.log(dest);

    var path = '/external/maps.googleapis.com/maps/api/geocode/json?latlng='+coords.lat+','+coords.lon+'&sensor=false&language=it';



    $.getJSON(path, function(gqdata)
    {
        //console.log(gqdata);
        if(gqdata.status == "OK")
        {
            if (gqdata.results.length > 0)
            {

                //console.log("Results found");
                var locstring = gqdata['results'][0]['formatted_address'];
                dest.append(locstring);
            }
            else
            {
                //console.log("No results found");
                dest.html("(posizione sconosciuta)");
            }
        }
        else
        {
            //console.log("Transmission error");
            dest.html("(posizione non disponibile)");
        }
    });



}

function geosearch(locationdesc)
{

    var jg;
    var path = '/external/maps.googleapis.com/maps/api/geocode/json?sensor=false&address='
        + locationdesc;

    console.log("Recentering map by search: "+path);


    $.getJSON(path, function(gqdata){
        //console.log(gqdata);
        if(gqdata.status == "OK"){
            if (gqdata.results.length > 0){

                //console.log("Results found");

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

            }
            else
            {

                //console.log("No location found");
                alert("Impossibile individuare la posizione richiesta.");
                //console.log(gqdata.results);
            }
        }
        else
        {
            //console.log("No location found");
            alert("Impossibile individuare la posizione richiesta.");
            //console.log(gqdata.results);
        }
    });

    //console.log("DEBUG: codewise after getJSON function, possibly waiting for return value");


}


function tryUnselectMode (event)
{

    console.log(event);

    if (event.keyCode == keycode_ESC)
    {
        //console.log("ESC pressed, checking  launched by keyboard");

        var alleditcontrols = [snapcontrol, drawcontrol, editcontrol, measurecontrol, homecontrol, selectcontrol];

        for (var i in alleditcontrols)
        {
            try
            {
                alleditcontrols[i].deactivate();
            }
            catch (err)
            {
                //console.log("Control n."+i+" (see code) not active yet");
            }
        }

        // IF the event reaches body as per bindings in initPage
        // this should not be needed, but leaving it here in case
        // a different point of entry is chosen and/or different effects
        // are desired
        event.preventDefault();

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

    //console.log(this);

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

    $("#maptoimage").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: true,
        width:  "auto",
        buttons: {
            /*"Download": {
                id: "btn_downloadMapRender",
                text: "Scarica mappa",
                click: downloadMap
            },*/

            "Chiudi": {
                id: "btn_maptoimage_close",
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }


        }
    });

    $("#maptojson").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: true,
        width:  "auto",
        buttons: {
            "Chiudi": {
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }


        }
    });

    $("#form_importmodel").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: true,
        width:  "auto",
        buttons: {
            "Annulla": {
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Carica": {
                id : "form_shadow_confirmload",
                text: "Integra",
                click: tryIntegrateModel
            }
        }
    });

    $("#form_filter").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                text: "Rimuovi filtro",
                click: function() {
                    removeAllFilters();
                    $( this ).dialog( "close" );
                }
            },
            "Applica": {
                id : "Conferma",
                text: "Applica",
                click: function () {
                    applyFilters();
                    $ (this).dialog("close");

                }
            }
        }
    });
    $(".filter_fieldcriteria").live('change', initFilterValueList);
    $(".button_replicatevalue").live('click', replicatePropValue);
    $("#btn_addfilter").live('click', addFilterCriteria);
    $(".btn_removefilter").live('click', removeFilterCriteria);


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

    $("#form_loadsnap").dialog({
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
                id : "form_shadow_confirmload",
                text: "Carica",
                click: tryLoadShadow
            }
        }
    });

    $("#progress_imagerender").dialog({
            autoOpen: false,
            modal: true,
            closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Chiudi": {
                id: "btn_renderprogress_close",
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
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
        width:  "auto",
        buttons: {
            "Chiudi": {
                id: "btn_loadprogress_close",
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });

    $("#progress_datasave").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Chiudi": {
                id: "btn_saveprogress_close",
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
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

    $("#form_geoshift").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Trasla": {
                id : "form_xlatemap_confirm",
                text: "Esegui",
                click: xlateMap
            }
        }
    });

    // bindings for form-connected elements
    $("#newmap_load").live("change", verifyMapLoadSelection);
    $("#uploadfield").live("change", updateUploadSelector);
    $(".geoshift_floatfield").live("keyup mouseup change", checkXlateValues);
}



// MENU DRIVEN FUNCTIONS

// all functions have the prefix "func" to distinguish them as menu launchers from actual "system" functions



function funcLoadMap ()
{

    // opens the map loading dialog

    //console.log("opening map loading dialog");

    // sets to non-incremental for later
    loadmode_incremental = false;

    $("#newmap_load").val("");
    $("#form_loadmap").dialog("open");
    verifyMapLoadSelection();

}

function funcIntegrateMap ()
{
    //console.log("opening map integration dialog");

    // set for later applyMap function to use
    loadmode_incremental = true;
    $("#newmap_load").val("");
    $("#form_loadmap").dialog("open");
    verifyMapLoadSelection();

}

function funcIntegrateModel ()
{
    //TODO: remove, superceded by loading a featureless modeled map
    //console.log("opening model integration dialog");

    $("#form_importmodel").dialog("open");
}

function funcSaveMap ()
{

    //console.log("opening map saving dialog");
    $("#form_datasave").dialog("open");
    $("#form_datasave .progressinfo").hide();


    var today = new Date();

    var day = today.getDate()>10 ? today.getDate().toString() : "0"+today.getDate().toString();
    var month = (today.getMonth()+1)<10 ? "0"+(today.getMonth()+1).toString() : (today.getMonth()+1).toString();
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
    //console.log("opening geoshifting dialog");

    $("#form_geoshift").dialog("open");

}

function funcLoadSnap ()
{

    //console.log("opening shadow map loading dialog");

    $("#form_loadsnap").dialog("open");

}

function funcShowMap ()
{
    //console.log("switching to map display");

    //$("#standalonebar").show();
    $("#modelstruct tbody").empty();
    $("#modelview").hide();
    $("#mapview").show();


}

function funcShowModel ()
{
    //console.log("switching to model display");
    //$("#standalonebar").hide();
    $("#mapview").hide();
    $("#modelview").show();
    $("#modelstruct tbody").empty();
    initModelWidget();

}



// END OF MENU FUNCTIONS


function trySaveMap ()
{

    $("#form_datasave").dialog("close");

    $("#progress_datasave").dialog("open");
    $("#btn_saveprogress_close").hide();
    $("#progress_datasave .progressinfo").hide();
    $("#progspinner_datasave").show();
    $("#progress_stage_datasaving").show();

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

    //console.log("Reporting successful save callback")
    //console.log(data);

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

    $("#btn_saveprogress_close").show();


}

function reportFailedSave (err, xhr)
{
    // TODO: PLACEHOLDER, IMPLEMENT
    $("#progspinner_datasave").hide();

    $("#progress_datasave .progressinfo").hide();
    $("#datasave_fail").show();
    $("#datasavefail_explain").append(err);
    $("#datasavefail_explain").show();
    $("#btn_saveprogress_close").show();

}


function layerToJSON(layer, mapid)
{

    var bbox;
    try
    {
        if (layer.getDataExtent() != null)
        {

            bbox = layer.getDataExtent().toArray();

            //console.log("Tried getting bbox from map extent, had");
            //console.log(bbox);

            var endA = reprojPoint(bbox[0], bbox[1], mapview);
            //console.log(endA);
            var endB = reprojPoint(bbox[2], bbox[3], mapview);
            //console.log(endB);

            bbox = [endA.x, endA.y, endB.x, endB.y];

            //console.log("Bbox from map data");
        }
        else
        {

            bbox = bb_meta;
            //console.log("Bbox from meta");
        }
    }
    catch (ex)
    {
        //console.log("Exception while trying to set the bbox");
        //console.log(ex);
        bbox = bb_proxy;
        //console.log("Bbox from proxy");
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

        // NOTE: changed since the user can delete stuff via form even if the data is still in the map
        //props = layer.features[fid].attributes;
        props = [];

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
            //console.log("Conflict: "+geom['type']+" against "+modeldata['objtype']);
            //console.log(layer.features[fid]);
            badfeaturescount++;
        }


    }
    console.log("Removed "+badfeaturescount+" incompatible features");

    return jsondata;




}

function tryLoadShadow()
{

    // NOTE: cloned from getUploadedMap

    $("#form_loadsnap").dialog("close");

    var mapname =  $("#newsnap_load").val().split("/");
    var snapmeta = mapname[0];
    var snapname = mapname[1];

    var urlstring;
    if (snapmeta == ".st")
    {
        urlstring = "/fwst/maps/"+proxy_id+"/"+snapname+"/";
    }
    else
    {
        urlstring = "/fwp/maps/"+proxy_id+"/"+snapmeta+"/"+snapname+"/";
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
        success:    applyNewSnap,
        error:  reportFailedDownload
    });

}


function loadRasterLayer()
{


    try
    {
        rasterlayer.destroy();
    }
    catch (err)
    {
        // ignore, no raster layer in use
    }

    //var wmsidx = mapview.layers.indexOf(rasterlayer);

    var testmap = 'http://eusoils.jrc.ec.europa.eu/wrb/wms_Primary.asp?&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&SRS=EPSG:3035&BBOX=1988372,1400000,6411627,5400000&FORMAT=image/png&WIDTH=1200&HEIGHT=900';
    var testlayer = 'PEAT';


    //console.log("Replacing WMS layer in position "+wmsidx);

    /*
    rasterlayer = new OpenLayers.Layer.WMS( "Boston",
        "http://boston.freemap.in/cgi-bin/mapserv?",
        {map: '/www/freemap.in/boston/map/gmaps.map', layers: 'border,water,roads', format: 'png', 'transparent': false});
        */

    rasterlayer = new OpenLayers.Layer.WMS( "Cartografia esterna",
        testmap, {layers: testlayer} );
    rasterlayer.isBaseLayer = false;



    mapview.addLayer(rasterlayer);

    mapview.setLayerIndex(rasterlayer, 0);

}

function tryIntegrateModel()
{

    console.log("Trying to integrate model");

    $("#form_importmodel").dialog("close");

    var modreq = $("#models_available").val().split("/");

    var model_area = modreq[0];
    var model_id = modreq[1];

    console.log(model_area+"/"+model_id);

    if (model_area == ".mdl")
    {
        // Integrate at once, we already have the data stored
        integrateMapModel(models[model_id]);
    }
    else
    {
        // load and then integrate

        var urlstring = '/fwp/getmodelng/'+proxy_id+'/'+model_area+'/'+model_id+'/';

        $("#progress_mapload").dialog("open");
        $("#progress_mapload .formwarning").hide();
        $("#progress_mapload .progressinfo").hide();
        $("#progspinner_mapload").show();
        $("#progress_stage_maploading").show();

        $.ajax ({
            url:    urlstring,
            async:  true,
            success:    function (data)
            {

                $("#progress_mapload").dialog("close");
                integrateMapModel(data);

            },
            error:  function ()
            {

                $("#progress_mapload .progressinfo").hide();
                $("#progspinner_mapload").hide();
                $("#maploadfinished_fail").show();
                $("#btn_loadprogress_close").show();
            }
        });
    }

}

function reintegrateModel(mapdata)
{

    console.log("Integrating map model from data");

    //extracts the model from a map and integrates with the current one
    var proplist;

    if (mapdata.hasOwnProperty('model'))
    {
        proplist = mapdata['model']['properties'];
    }


    for (var cfeature in mapdata['features'])
    {

        for (var propname in cfeature['properties'])
        {

            if (proplist.indexOf(propname)==-1 && cfeature['properties'][propname] != "")
            {
                proplist[propname] = cfeature['properties'][propname];
            }
        }

    }

    var newmodel = {'properties': proplist};
    integrateMapModel(newmodel);


    console.log("End of reintegration code");

}

function integrateMapModel(newdata)
{

    console.log("New model to integrate:");
    console.log(newdata);

    console.log("Integrating into model:");
    console.log(modeldata);

    // the model is associated with this map only by name too
    modeldata['name'] = map_id;

    for (var propname in newdata['properties'])
    {

        // does this have suggested values?
        var hasvalues = $.isArray(newdata['properties'][propname]);

        if (!modeldata['properties'].hasOwnProperty(propname))
        {
            //checking to see if we have to add the property at all
            modeldata['properties'][propname] = newdata['properties'][propname];
        }
        else
        {

            if (hasvalues)
            {
                // field exists but we could have preselected values to add
                if (!$.isArray(modeldata['properties'][propname]))
                {
                    modeldata['properties'][propname] = newdata['properties'][propname];
                }
                else
                {
                    for (var i = 0; i < newdata['properties'][propname].length; i++)
                    {
                        var cval = newdata['properties'][propname][i];
                        if (modeldata['properties'][propname].indexOf(cval) == -1)
                        {
                            modeldata['properties'][propname].push(cval);
                        }
                    }
                }
            }

        }


    }

    initFiltersForm();

    if ((!firstload) && $("#modelview").is(":visible"))
    {
        console.log("Seeing the old model after integration, and we are not on first load");

        funcShowModel();
    }
}

function tryLoadMap ()
{



    $("#form_loadmap").dialog("close");
    var upreq = $("#newmap_load").val();
    var contentreq = upreq.split("/");

    console.log("Loading/integrating map: "+upreq);

    if (contentreq[0] == '.file/')
    {
        // load from file
        uploadFileToStandalone();
    }
    else
    {
        // load from instance
        // should simply need a getUploadedMap with the correct parameters
        getUploadedMap(contentreq[0], contentreq[1]);
    }


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
        urlstring = "/fwp/getng/"+proxy_id+"/"+meta_id+"/"+map_id+"/src/";
    }

    console.log("Loading: "+urlstring);

    $("#progress_mapload").dialog("open");
    $("#progress_mapload .formwarning").hide();
    $("#progress_mapload .progressinfo").hide();
    $("#progspinner_mapload").show();
    $("#progress_stage_maploading").show();
    $("#btn_loadprogress_close").hide();

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

function applyNewSnap (newdata, textStatus, jqXHR)
{
    $("#progress_stage_maploading").hide();
    $("#progress_stage_rendering").show();


    console.log("Rendering map data on shadow layer");
    //console.log(newdata);

    snaplayer.destroyFeatures();
    renderGeoJSONCollection(newdata, snaplayer);


    $("#progress_stage_rendering").hide();
    $("#progspinner_mapload").hide();
    $("#maploadfinished_success").show();


    $("#progress_mapload").dialog("close");



}


function applyNewMap(newdata, textStatus, jqXHR)
{
    $("#progress_stage_maploading").hide();
    $("#progress_stage_rendering").show();


    console.log("Rendering map data");
    //console.log(newdata);

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

    renderGeoJSONCollection(newdata, vislayer);
    reintegrateModel(newdata);
    autoZoom(mapview);

    $("#progress_stage_rendering").hide();
    $("#progspinner_mapload").hide();
    $("#maploadfinished_success").show();
    $("#btn_loadprogress_close").show();


    if (firstload)
    {
        $("#progress_mapload").dialog("close");
        firstload = false;
    }

    if (vismode == 'modeledit')
    {
        funcShowModel();
    }

    initFiltersForm();


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

    console.log("Reporting failed upload of the requested file");
    console.log("readyState: "+xhr.readyState+"\nstatus: "+xhr.status);
    //console.log("responseText: "+xhr.responseText);
    console.log(err);

    $("#uploadfail_explain").append("Errore "+xhr.status);

}


function reportFailedDownload (xhr,err)
{
    $("#progress_mapload .progressinfo").hide();
    $("#progspinner_mapload").hide();
    $("#maploadfinished_fail").show();

    console.log("Reporting failed download of the requested file");
    console.log("readyState: "+xhr.readyState+"\nstatus: "+xhr.status);
    // console.log("responseText: "+xhr.responseText);
    console.log(err);

    $("#maploadfail_explain").append("Errore "+xhr.status);

    if (firstload)
    {
        $("#btn_loadprogress_close").unbind();
        $("#btn_loadprogress_close").click(backToProxy);
    }
    $("#btn_loadprogress_close").show();

    // TODO: implement closing button on the dialog as BACK action of the browser in case we are in single-map mode (MAPEDIT, MAPVIEW)

}


function initModelWidget()
{



    var base = $("#modelstruct tbody");
    for (var propname in modeldata['properties'])
    {
        base.append('<tr class="modelprop_widget" id="modelprop_widget_'+propname+'">' +
            '<td><b>' + propname + '</b></td>' +
            '<td class="valuetabletd"></td>' +
            '<td><img id="modeladdpropvalue_'+propname+'" class="button_modeladdpropvalue imgbtn" src="/static/resource/visng_model_addvalue.png" title="Aggiungi valore"> <img id="modelimportpropvalue_'+propname+'" class="button_modelimportpropvalue imgbtn" src="/static/resource/visng_model_importvalues.png" title="Importa i valori della mappa"> <img class="button_modelremoveprop imgbtn" id="modelremoveprop_'+propname+'" src="/static/resource/visng_model_deleteproperty.png" title="Elimina proprietà"></td>' +
            '</tr>' +
            '<tr id="modelpropval_widget_'+propname+'"><td></td><td class="modelprop_valtable" id="valtable_'+propname+'"></td><td></td></tr>');

    }

    for ( propname in modeldata['properties'])
    {
        var setvalues = modeldata['properties'][propname];

        //console.log("Values for "+propname);
        //console.log(setvalues);

        if ($.isArray(setvalues))
        {
            console.log("Adding "+setvalues.length+" values for "+propname);
            for (var i in setvalues)
            {
                addSetModelPropValue(propname, setvalues[i], false)
            }
        }
    }

    rebuildModelFromForm();


}

function addModelPropValue ()
{
    var prefix = "modeladdpropvalue_";
    var propname = this.id.substr(prefix.length);

    addSetModelPropValue (propname, "", true);

}

function addSetModelPropValue (propname, propvalue, rebuild)
{


    $("#valtable_"+propname).append('<div class="valtable_propvalue"><input type="text" class="textfield_modelpropvalue textfield_modelpropvalue_'+propname+'" value="'+propvalue+'"><img src="/static/resource/visng_model_deletevalue.png" title="Elimina valore" class="button_modelremovepropvalue imgbtn"></div>');

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

    console.log("Removing property "+propname);

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

    //console.log("Adding new model property");

    var newpropname = $("#model_newpropname").val();
    if (newpropname != null && newpropname != "" && !modeldata.properties.hasOwnProperty(newpropname))
    {
        modeldata.properties[newpropname] = "string";
    }

    // in this case we add to the model and re-render the whole table
    // TODO: consider reversing the process
    funcShowModel();

    initFiltersForm();

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
        for (var v = 0; v < formvalues.length; v++)
        {
            var cval = $(formvalues[v]).val();

            if (cval != null && formpropvalues.indexOf(cval) == -1)
            {
                formpropvalues.push(cval);
            }
        }
    }
    catch (err)
    {
        // do nothing, no existing values set for this property
        console.log("Values import issue: ");
        console.log(err);
    }


    for (var f in vislayer.features)
    {
        try
        {
            cval = vislayer.features[f]['attributes'][propname];
            if (cval != null && formpropvalues.indexOf(cval)==-1 && mappropvalues.indexOf(cval)==-1)
            {
                mappropvalues.push(cval);
            }
        }
        catch (err)
        {
            // feature does not have the requested property
            continue;
        }



    }


    //console.log("Values to add for "+propname);
    //console.log(mappropvalues);
    //console.log("Existing values:");
    //console.log(formpropvalues);

    for (var i in mappropvalues)
    {

        addSetModelPropValue(propname, mappropvalues[i], false);
    }

    rebuildModelFromForm();
}

function updateModelPropertyValue()
{
    // rebuilds only the single section of the model for this particular property

    //console.log("Updating model prop value");
    var base = $(this).closest(".modelprop_valtable");
    var prefix = "valtable_";
    var propname = base[0].id.substr(prefix.length);

    var valuelist = $(".textfield_modelpropvalue_"+propname);

    var vals = [];
    for (var v = 0; v < valuelist.length; v++)
    {
        vals.push($(valuelist[v]).val());
    }

    modeldata['properties'][propname] = vals;

    console.log("Updated model data for property "+propname);
    //console.log(modeldata['properties'][propname]);
}

function rebuildModelFromForm()
{

    // modified models always take the name of the map itself
    modeldata['name'] = map_id;

    // rebuilds the property section of the model according to the contents of the model form

    var prefix = "modelprop_widget_";
    var modelform = $(".modelprop_widget");
    var newprops = {};

    console.log("Saving "+modelform.length+" properties");
    for (var i = 0; i < modelform.length; i++)
    {

        var cid = modelform[i].id;
        //console.log("Adding property "+cid);
        var propname = cid.substr(prefix.length);

        var valuelist = $(".textfield_modelpropvalue_"+propname);
        //console.log("Values for "+propname+": "+valuelist.length);

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
            if (modeldata['properties'].hasOwnProperty(propname) && !$.isArray(modeldata['properties'][propname]))
            {
                vals = modeldata['properties'][propname];
            }
            else
            {
                vals = "string";
            }
        }
        newprops[propname] = vals;

    }

    modeldata['properties'] = newprops;
    var totprops = 0;
    for (var propname in modeldata['properties'])
    {
        totprops++;
    }
    console.log("Saved "+totprops+" properties");



    /*
    console.log("New model properties and values");
    console.log(modeldata);
    */

    initFiltersForm();

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
    mapview.addLayer(new OpenLayers.Layer.Google("Google Terrain", {
        type : google.maps.MapTypeId.TERRAIN,
        visibility : false
    }));
    mapview.addLayer(new OpenLayers.Layer.Google("Google Satellite", {
        type : google.maps.MapTypeId.SATELLITE,
        numZoomLevels : 20
    }));
    mapview.addLayer(new OpenLayers.Layer.Google("Google Roadmap", {
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

    //rasterlayer = new OpenLayers.Layer.WMS();
    //mapview.addLayer(rasterlayer);

    // setting the format to translate geometries out of the map
    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': mapview.getProjectionObject()});

    var featurestyle;
    var featurestylemap;


    // styling the layers


    // SNAP layer
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.3, fillColor: "#FF33FC", strokeColor: "#FF33FC", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 8});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    snaplayer= new OpenLayers.Layer.Vector("Allineamento", {styleMap: featurestylemap});

    // FILTER layer
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.3, fillColor: "#188E01", strokeColor: "#188E01", strokeWidth: 6, strokeDashstyle: "solid", pointRadius: 10});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    filterlayer = new OpenLayers.Layer.Vector("Filtro", {styleMap: featurestylemap});

    // VIS layer
    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.3, fillColor: "#FF9900", strokeColor: "#FF9900", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.3, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.3, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6});
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
        this.baseLbl.innerHTML = 'Cartografia';                                   //change title for base layers
        this.dataLbl.innerHTML = 'Mappe';                                   //change title for overlays (empty string "" is an option, too)
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
    vislayer.events.register('featuremodified', mapview, realignFilter);
}



function handleMeasure(event)
{

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

    //console.log("Measure data");
    //console.log(event);
    //console.log(event.geometry.getBounds());


    var measure = event.measure.toFixed(precision);
    var bbox = event.geometry.getBounds();

    //console.log(bbox);

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


    $("#measure_overall").empty().append(measure+" "+units);
    $("#measure_ns").empty().append(span_y.toFixed(precisiony).toLocaleString()+" "+unity);
    $("#measure_ew").empty().append(span_x.toFixed(precisionx).toLocaleString()+" "+unitx);

    $("#measuredetails").show()


}

function hideDistance() {

    $("#measuredetails").hide();

}

function renderFeatureCard(caller)
{

    freeSelection();

    var feature = caller['feature'];
    cfid  = feature.id;

    console.log("Viewing/editing feature "+cfid);
    console.log(feature);


    var isline = feature.geometry.hasOwnProperty('components');
    var desthtml;
    if (isline)
    {
        var idstart = "pos_"+cfid.replace(/\./g, "_")+"_from";
        var idend = "pos_"+cfid.replace(/\./g, "_")+"_to";

        desthtml = '<span class=textlabel>Posizione iniziale</span>: <span id='+idstart+'></span><br>' +
            '<span class=textlabel>Posizione finale</span>: <span id='+idend+'></span>';

        $("#featureloc").append(desthtml);

        var endA = feature.geometry.components[0];
        var endB = feature.geometry.components[feature.geometry.components.length-1];
        var posA = reverseGeoSearch(endA, idstart);
        var posB = reverseGeoSearch(endB, idend);

    }
    else
    {

        var idpos = "pos_"+cfid.replace(/\./g, "_");
        desthtml = '<span class="textlabel">Posizione</span>: <span id='+idpos+'></span>';
        $("#featureloc").append(desthtml);
        var pos = reverseGeoSearch(feature.geometry, idpos);
    }



    $("#featuredetails").append("<span class=textlabel>Oggetto selezionato</span>: "+singleobjstring[modeldata['objtype']]);

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
                '<td><img src="/static/resource/visng_controls_replicateproperty.png" title="Replica il valore negli elementi filtrati" class="imgbtn button_replicatevalue"></td>' +
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
        dest.val($(this).val());1
        dest.change();
    }
}

function removeValueSelector()
{
    try
    {
        $("#autovalueselector").remove();
    }
    catch (err)
    {
        console.log("autovalue already removed?");
        console.log(err);
    }

}

function setPropertyValue()
{

    var prefix = 'textfield_';
    var propname = this.id.substr(prefix.length);

    console.log("Setting "+propname+" property value to "+$(this).val());

    var cfeature = vislayer.getFeatureById(cfid);

    vislayer.getFeatureById(cfid)['attributes'][propname] = $(this).val();
    removeValueSelector();

    console.log("Reapplying filters (if needed)");

    applyFilters();



}




function checkReplicationChance()
{
    // checks if replication buttons can be active (i.e. if there is a filter to >1 object
    // TODO: implement, placeholder
    // currently off by default
    $(".button_replicatevalue").prop('disable', filterlayer.features.length == 0);
}

function freeSelection()
{
    $("#featuredetails").empty();
    $("#featureloc").empty();
    $("#measuredetails").hide();
    $("#featuredesc tbody").empty();
    $("#featurecard").hide();

}


function removeCurrentFeature()
{

    var feature = vislayer.getFeatureById(cfid);
    vislayer.removeFeatures([feature]);
    vislayer.destroyFeatures([feature]);

    editcontrol.deactivate();
    editcontrol.activate();


    freeSelection();
}


function autoZoom (olmap)
{
    /*
     Checks if we have an active map and if it has a bbox. If not, zooms to the bbox of the meta, if we have it, or of the proxy itself
     */



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
        console.log("Valid selection, enabling");
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

function xlateMap()
{

    var offset_x = parseFloat($("#txt_geoshift_movex").val());
    var offset_y = parseFloat($("#txt_geoshift_movey").val());

    if (isNaN(offset_x) || isNaN(offset_y))
    {
        $("#form_xlatemap_confirm").prop("disabled", true);
        console.log("Non valid translation value");
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

    $("#txt_geoshift_movex").val("0");
    $("#txt_geoshift_movey").val("0");

    $("#form_geoshift").dialog("close");


}

function checkXlateValues()
{

    var offset_x = parseFloat($("#txt_geoshift_movex").val());
    var offset_y = parseFloat($("#txt_geoshift_movey").val());

    if (isNaN(offset_x) || isNaN(offset_y))
    {
        $("#form_xlatemap_confirm").prop("disabled", true);
        console.log("Non valid translation value");
    }
    else
    {
        $("#form_xlatemap_confirm").prop("disabled", false);
    }


}


function xlateFeature (feature, offset_x, offset_y)
{

    //console.log("Feature move from");
    //console.log(feature);
    feature.geometry.move(offset_x, offset_y);
    //console.log("Feature move to");
    //console.log(feature);

}

function backToProxy()
{
    // quick wrapper for buttons
    console.log("Back to proxy summary");
    location.href = "/fwp/proxyng/"+proxy_id+"/";
}

function updateUploadSelector()
{

    console.log("updating uploader selection");
    var filename = getFilenameFromPath($("#uploadfield").val());
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