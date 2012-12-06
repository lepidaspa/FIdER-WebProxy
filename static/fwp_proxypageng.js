/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/13/12
 * Time: 6:35 PM
 * To change this template use File | Settings | File Templates.
 */

var keycode_ENTER = 13;
var keycode_ESC = 27;

var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";
var gjformat;

var objtypestrings = { 'LineString': 'tratte', 'Point': 'punti'};
var objtypes = [ 'LineString', 'Point' ];

var proxy_id;
var proxy_type;
var proxy_man;
var proxy_maps;
var proxy_meta;

var proxymap;
var proxymap_metalayer;
var proxymap_activemeta;
var proxymap_activemap;
// visualization layer that summarises the contents of the various proxies, canvas rendered as it is NOT interactive
var proxymap_vislayer;
var poilayer;

var cmeta_id;
// used essentially for the conversion table
var cmap_id;


var conv_hasmodels;
var conv_hastable;


var conv_table;
var conv_fields;
var conv_models;


var forcefieldstring = "+";

// which of the maps (by metaid+mapid currently loaded in the assetslist are actually rendered)
var renderedmaps = [];
// data downloaded from the server in the form of featurelists, ordered by meta+mapid
var featuredata = {};

var mapcolors = {};
var allcolors = [
    "#fff700",    "#ff00b3",    "#00D9FF",      "#73DB1E",      "#FF0036",      "#A81BFF",
    "#FFC88A",    "#A6ABFF",      "#D7A1FF",      "#8AFF92"
];
var nextcoloridx = 0;
var proxymap_visstyles = {};


var menufunctions = {
    'menu_removepoi': unsetPOI,
    'menu_findpoi': tryGeoSearchClick
};



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


    $(".metainfo").on('hover', highlightMeta);
    $(".mapcard").on('hover', highlightMap);
    $(".metainfo").on('mouseleave', clearHighlights);
    $(".mapcard").on('mouseleave', clearHighlights);

    $(".newdata").on('click', addNewSource);

    $("#newfile_chooser").change(checkCandidateFilename);
    $("#newremote_mapname").on('mouseup keyup change', checkCandidateMapname);
    $(".removedata").on('click', removeDataSource);


    $(".convert").on('click', loadConversionTable);


    $(".switchmapvis").on('change', switchMapVis);


    $("#conn_name_new").on('mouseup keyup change', checkCandidateQueryparams);
    $("#conn_host_new").on('mouseup keyup change', checkCandidateQueryparams);
    $("#conn_port_new").on('mouseup keyup change', checkCandidateQueryparams);
    $("#conn_db_new").on('mouseup keyup change', checkCandidateQueryparams);
    $("#conn_schema_new").on('mouseup keyup change', checkCandidateQueryparams);
    $("#conn_view_new").on('mouseup keyup change', checkCandidateQueryparams);


    $("#convtable_modelselect").live('change', renderConvTable);
    $(".conv_addpreset").live('click', addConvPreset);
    $(".valueconv_remove").live('click', removeConvPreset);
    $(".valueconv_quit").live('click', closeConversionScreen);
    $(".valueconv_save").live('click', saveConversionTable);

    $("#fieldconv_geometry").live('change', checkGeometryConversion);

    $(".maprecap").live('click', openMapRecap);
    $(".metarecap").live('click', openMetaRecap);

    $(".menuopt").live('click', interceptCallback);
    $("#text_geosearch").live("keyup", tryGeoSearch)

    // fix for Mozilla Firefox quickreload quirk
    $('input[type=checkbox]').attr('checked',false);

}


function interceptCallback ()
{
    var callerid = this.id;
    //console.log("Intercepted callback for "+callerid);
    //console.log(menufunctions[callerid]);

    menufunctions[callerid]();


    // stop propagation
    return false;

}

function initForms ()
{

    $("#form_setconversion").hide();

    $("#infobox_maps").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Chiudi": {
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });

    $("#infobox_metas").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Chiudi": {
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });

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

    $("#progress_convdload").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Chiudi": {
                id: "btn_convdload_close",
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });

    $("#progress_mapload").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Chiudi": {
                id: "btn_loadvis_close",
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });



    $("#progress_convsave").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Chiudi": {
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });



    $("#progress_newdata").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Reset": {
                id : "btn_newdata_resetpage",
                text: "Chiudi",
                click: resetPage
            },
            "Close": {
                text: "Chiudi",
                id : "btn_newdata_closedialog",
                click: function() {$( this ).dialog( "close" );}
            }

        }
    });

    $("#progress_newquery").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Reset": {
                id : "btn_newquery_resetpage",
                text: "Chiudi",
                click: resetPage
            },
            "Close": {
                text: "Chiudi",
                id : "btn_newquery_closedialog",
                click: function() {$( this ).dialog( "close" );}
            }

        }
    });

    $("#progress_removal").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Reset": {
                id : "btn_removal_resetpage",
                text: "Chiudi",
                click: resetPage
            },
            "Close": {
                text: "Chiudi",
                id : "btn_removal_closedialog",
                click: function() {$( this ).dialog( "close" );}
            }

        }
    });

    $("#form_newftp").dialog({
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
                id : "form_newftp_upload",
                text: "Carica",
                click: tryUploadNewFTP
            }
        }
    });
    $(".newftp_param").live('change keyup mouseup', checkCandidateFTPParams);

    $("#form_newwfs").dialog({
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
                id : "form_newwfs_upload",
                text: "Carica",
                click: tryUploadNewRemote
            }
        }
    });

    $("#form_newquery").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Annulla": {
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_newquery_create",
                text: "Crea",
                click: tryCreateQuery
            }
        }
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

function openMetaRecap()
{
    var prefix = "metarecap_";
    var cmeta_id = this.id.substr(prefix.length).replace(".","\\.");

    console.log("opening infobox for meta "+cmeta_id);

    $(".metadetails").hide();
    $("#metadetails_"+cmeta_id).show();
    $("#infobox_metas").dialog("open");


}

function openMapRecap()
{
    var prefix = "maprecap_";
    var dest = this.id.substr(prefix.length).split("-");

    var cmeta_id = dest[0].replace(".","\\.");
    var cmap_id = dest[1];

    console.log("opening infobox for map "+cmeta_id+"-"+cmap_id);

    $(".mapdetails").hide();
    $("#mapdetails_"+cmeta_id+"-"+cmap_id).show();
    $("#infobox_maps").dialog("open");


}


function switchMapVis()
{
    var prefix = 'mapvis_';
    var dest = this.id.substr(prefix.length).split("-");

    var cmeta_id = dest[0];
    var cmap_id = dest[1];
    var switchstate = $(this).prop('checked');

    var idstring = proxy_id+"-"+cmeta_id+"-"+cmap_id;

    console.log("Vis switch for "+cmeta_id+"/"+cmap_id+" modified to "+switchstate);

    if (switchstate)
    {

        // check if the map layer already exists, re-enable it
        // featuredata: features grouped by map, renderedmaps: maps currently rendered
        if (!featuredata.hasOwnProperty(idstring))
        {
            loadNakedMap(cmeta_id, cmap_id);
        }
        else
        {
            renderedmaps.push(idstring);
            reVisMap(cmeta_id, cmap_id);
        }

    }
    else
    {
        // remove the data from the map

        var mapidx = renderedmaps.indexOf(idstring);
        renderedmaps.splice(mapidx, 1);
        reVisMap(cmeta_id, cmap_id);

    }

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

function tryGeoSearchClick ()
{
    geosearch($('#text_geosearch').val());
}


function setPOI ()
{

    try
    {
        poilayer.destroy();
    }
    catch (err)
    {
        // ignore, no raster layer in use
    }

    var layeroptions = {
        alwaysInRange: true,
        isBaseLayer: false,
        opacity: 1,
        displayOutsideMaxExtent: true
    };

    var imageurl = "/static/resource/icon_poi.png";

    poilayer= new OpenLayers.Layer.Markers(
        'Punto di riferimento',
        {
            displayInLayerSwitcher: false
        }
    );
    proxymap.addLayer(poilayer);


    var size = new OpenLayers.Size(32, 37);
    var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
    var icon = new OpenLayers.Icon(imageurl, size, offset);
    poilayer.addMarker(new OpenLayers.Marker(proxymap.center ,icon));



}

function unsetPOI()
{
    try
    {
        poilayer.destroy();
    }
    catch (err)
    {
        // nothing to do
    }
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
                proxymap.zoomToExtent(gq);
                setPOI();

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






function loadNakedMap (cmeta_id, cmap_id)
{

    // TODO: placeholder, implement


    var urlstring;
    urlstring = "/fwp/miniget/"+proxy_id+"/"+cmeta_id+"/"+cmap_id+"/";

    console.log("Loading: "+urlstring);

    $("#progress_mapload").dialog("open");
    $("#btn_loadvis_close").hide();
    $("#progress_mapload .formwarning").hide();
    $("#progress_mapload .progressinfo").hide();
    $("#progspinner_mapload").show();
    $("#progress_stage_maploading").show();
    $("#btn_loadprogress_close").hide();

    $.ajax ({
        url:    urlstring,
        async:  true,
        success:    function (data)
        {
            var idstring = proxy_id+"-"+cmeta_id+"-"+cmap_id;

            featuredata [idstring] = data;
            renderedmaps.push(idstring);
            reVisMap (cmeta_id, cmap_id);


        },
        error:  function ()
        {

            //alert("ERROR LOADING MAP");
            $("#progspinner_mapload").hide();
            $(".progressinfo").hide();
            $("#maploadfinished_fail").show();
            $("#btn_loadvis_close").show();

        }
    });
}


function reVisMap (cmeta_id, cmap_id)
{
    // this only handles elements ADDED to the map, removed ones are handled directly by switchMapVis

    $("#progress_mapload").dialog("open");
    $(".progressinfo").hide();
    $("#progspinner_mapload").show();
    $("#progress_stage_rendering").show();



    var idstring = proxy_id+"-"+cmeta_id+"-"+cmap_id;
    // cleaning up to avoid accidental double loads
    proxymap_vislayer.destroyFeatures(proxymap_vislayer.getFeaturesByAttribute("source", idstring));

    if (renderedmaps.indexOf(idstring)==-1)
    {
        // we do not redraw anything in this case;
        $("#progress_mapload").dialog("close");
        return;
    }

    if (!mapcolors.hasOwnProperty(idstring))
    {
        console.log("Setting styler for this map, first time load only");
        mapcolors[idstring] = nextcoloridx;
        nextcoloridx = (nextcoloridx+1)%(allcolors.length);
        var ccolor = allcolors[mapcolors[idstring]];
        proxymap_visstyles [idstring] = {"fillColor": ccolor, "strokeColor": ccolor };
        proxymap_vislayer.styleMap.addUniqueValueRules("default", "source", proxymap_visstyles);
    }



    // escaping the dot in .st
    var jqstring = "#mapcolorcode_"+idstring.replace(".", "\\.");
    $(jqstring).css("background-color", ccolor);

    console.log("Readied styler, ready to render");

    renderGeoJSONCollectionToCanvas (featuredata[idstring], proxymap_vislayer);
    $("#progress_mapload").dialog("close");


}

function renderGeoJSONCollectionToCanvas (jsondata, layer)
{
    layer.setVisibility(false);
    console.log("Rendering (for canvas)"+jsondata['features'].length+" features");

    var fstring = JSON.stringify(jsondata);
    var fmap = gjformat.read(fstring);
    layer.addFeatures(fmap);

    layer.setVisibility(true);

}

/* no longer needed, kept for backup IF any issues come up with canvas renderer */
function renderGeoJSONCollection (jsondata, layer)
{
    // renders a geojson collection to the visualisation layer

    layer.setVisibility(false);

    console.log("Rendering "+jsondata['features'].length+" features");

    var render_errors = [];
    for (var i in jsondata['features'])
    {
        /* used for debug on canvas renderer
        if (i % 50 == 0)
        {
            console.log("Rendered "+i+" features");
        }
        */

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

    console.log("Rendering completed");
    layer.setVisibility(true);

}


function reportFailedVisLoad()
{

    $("#mapvis_"+cmeta_id+"-"+cmap_id).prop('checked', false);

    $("#progress_visload .progressinfo").hide();
    $("#progspinner_visload").hide();
    $("#visload_fail").show();


}

function loadConversionTable()
{

    conv_hasmodels = null;
    conv_hastable = null;

    var prefix = 'convert_';
    var dest = this.id.substr(prefix.length).split("-");

    cmeta_id = dest[0];
    cmap_id = dest[1];


    $("#progress_convdload").dialog("open");
    $("#progress_convdload .progressinfo").hide();
    $("#btn_convdload_close").hide();
    $("#progspinner_convdload").show();
    $("#progress_stage_convloading").show();

    // loading the existing conversions and fields for this map

    var faileddload = false;

    $.ajax({
        url: "/fwp/conversion/"+proxy_id+"/"+cmeta_id+"/"+cmap_id+"/",
        async: false
    }).done(function (jsondata) {

            $("#progress_convdload .progressinfo").hide();

            console.log("Downloaded /fwp/conversion");
            console.log(jsondata);

            prepareConversions (jsondata);



        }).fail(function ()
        {

            console.log("Failed to download /fwp/conversion (call 1)");

            faileddload = true;

            $("#progress_convdload .progressinfo").hide();
            $("#progspinner_convdload").hide();
            $("#convdload_fail").show();
            //$("#convdloadfail_explain").val(data);
            //$("#convdloadfail_explain").show();
            $("#btn_convdload_close").show();
        });

    // loading the models available from the main server



    $.ajax({
        url: "/fwp/valueconv/",
        async: true
    }).done(function (jsondata) {


            console.log("Downloaded /fwp/valueconv");
            console.log(jsondata);

            prepareModels (jsondata);

            $("#progress_convdload").dialog("close");



        }).fail(function (data)
        {

            console.log("Failed to download /fwp/valueconv (call 2)");

            $("#progress_convdload .progressinfo").hide();
            $("#progspinner_convdload").hide();
            $("#convdload_fail").show();
            $("#convdloadfail_explain").empty();
            $("#convdloadfail_explain").append("Errore nel caricamento dei modelli dal server.");
            $("#convdloadfail_explain").show();
            $("#btn_convdload_close").show();

        });

}

function prepareConversions (jsondata)
{
    conv_hastable = true;

    console.log("Received existing conversions");
    console.log(jsondata);

    conv_fields = jsondata['mapfields'];
    conv_table = jsondata['conversion'];

    if (conv_hasmodels)
    {
        openConversionScreen();
        renderConvSelection();
    }

}

function prepareModels (jsondata)
{
    conv_hasmodels = true;

    console.log("Received server models");
    console.log(jsondata);

    conv_models = {};

    var maptype =  proxy_maps[cmeta_id][cmap_id]['type'];

    for (var model_id in jsondata)
    {
        if (jsondata[model_id]['federated'])
        {
            var modeltype = jsondata[model_id]['objtype'];
            if (maptype == null || modeltype == maptype)
            {
                conv_models[model_id] = jsondata[model_id];

                if (proxy_type == 'query')
                {
                    conv_models[model_id]['properties']['geometry']="str";
                }
            }

        }
    }


    console.log("Rebuilt federated models list");
    console.log(conv_models);

    if (conv_hastable)
    {
        openConversionScreen();
        renderConvSelection();
    }

}

function openConversionScreen()
{
    // hides the map widget to show the conversion widget
    $("#proxymap").hide();
    $("#controlsbar").hide();

    $("#form_setconversion").show();
    $("#convtable_headers").hide();
    $("#valueconv_save").hide();
    $("#valueconv_quit").hide();

}

function saveConversionTable()
{

    // saves the current conversion setting

    console.log("Saving conversion table");


    // find the model currently in use
    var model_id = $("#convtable_modelselect").val();
    if (model_id == null || model_id == "" || (proxy_type == 'query' && $("#fieldconv_geometry").val() == ""))
    {
        // conversion table is NOT valid unless the user has selected a base model
        return;
    }

    // UI dialog init
    $("#progress_convsave").dialog("open");
    $("#progress_convsave .progressinfo").hide();
    $("#progspinner_convsave").show();
    $("#progress_stage_convsaving").show();


    var conversion = { "fields": {}, "forcedfields": {}, "unmapped": []};

    conversion ['modelid'] = model_id;

    var fprefix;
    fprefix = "fieldconv_";

    var vprefix;
    vprefix = "conv_presets_";

    console.log(conv_models[model_id]);

    for (var fieldname in conv_models[model_id]['properties'])
    {
        //console.log("Setting "+fieldname);
        var sourcefield = $("#"+fprefix+fieldname).val();

        if (sourcefield == "")
        {
            conversion['unmapped'].push(fieldname);
            continue;
        }

        var isforced = (sourcefield == forcefieldstring);

        var valueconv = {};

        //console.log("#"+vprefix+fieldname);

        var base = $("#"+vprefix+fieldname);


        if (base.length > 0)
        {
            var convrows = base.find('.valueconv_combo_'+fieldname);

            // filling the value conversion dictionary
            for (var i = 0; i < convrows.length; i++)
            {
                var convfrom = $(convrows[i]).find('.valueconv_from').val();
                var convto = $(convrows[i]).find('.valueconv_to').val();

                valueconv [convfrom] = convto;
            }
        }

        //console.log("Values for "+fieldname);
        //console.log(valueconv);

        // adding to the full conversion dict
        if (isforced)
        {
            conversion['forcedfields'][fieldname] = valueconv;
        }
        else
        {
            conversion['fields'][sourcefield] = {
                'to': fieldname,
                'values': valueconv
            }
        }

    }


    console.log("Saving table as:");
    console.log(conversion);

    // saving to filesystem

    var jsondata = {};

    jsondata['convtable'] = conversion;

    jsondata ['proxy_id']  = proxy_id;
    jsondata ['meta_id'] =  cmeta_id;
    jsondata ['shape_id'] = cmap_id;




    $.ajax ({
        url: "/fwp/maketable/",
        async: true,
        data: {
            jsonmessage: JSON.stringify(jsondata)
        },
        type: 'POST',
        success: function(data) {

            $("#progress_convsave .progressinfo").hide();
            $("#progspinner_convsave").hide();
            $("#convsave_success").show();

            if (proxy_type != 'query')
            {
                reconvertMapData(cmeta_id, cmap_id);
            }

        },
        error: function (data) {

            $("#progress_convsave .progressinfo").hide();
            $("#progspinner_convsave").hide();
            $("#convsave_fail").show();


        }
    });

}


function reconvertMapData (meta_id, map_id)
{

    //reconverts a map with the new conversion table SILENTLY
    // we do not know the time span and the issues that can happen, and that will be logged away from this screen anyway (potentially they may be launched from a completely different context), console notification provided just in case

    $.ajax ({
        url: "/fwp/reconvert/"+proxy_id+"/"+meta_id+"/"+map_id+"/",
        async: true,
        success: function(data) {
            console.log("Received feedback on map save for "+proxy_id+"/"+meta_id+"/"+map_id);
            console.log(data);
        },
        error: function (data) {
            console.log("Received feedback on map save for "+proxy_id+"/"+meta_id+"/"+map_id);
            console.log(data);
        }
    });


}

function closeConversionScreen()
{
    // empties the conversion widget and returns to map
    $("#convtable_modelselect").empty();
    $("#convtable_datasets").empty();
    $("#form_setconversion").hide();


    $("#proxymap").show();
    $("#controlsbar").show();
}

function renderConvSelection (jsondata)
{

    $("#conv_mapinfo").empty();
    $("#conv_mapinfo").append("Tabella di conversione per la mappa "+cmap_id);

    // renders the conversion table for a jsondata set
    $("#progress_convdload").dialog("close");

    console.log("Rendering conversion table from data");
    //console.log(jsondata);
    console.log(conv_fields);
    console.log(conv_table);

    var convtable = $("#convtable_datasets");
    convtable.empty();

    var modelselector = $("#convtable_modelselect");
    modelselector.prop('disabled', false);

    modelselector.empty();
    modelselector.append('<option value=""></option>');

    var modlist = [];
    for (var model_id in conv_models)
    {
        modlist.push(model_id);
        modelselector.append(
            '<option value="'+model_id+'">'+conv_models[model_id]['name']+'</option>'
        )
    }



    if (modlist.length > 0 && modlist.indexOf(conv_table['modelid'])!=-1)
    {
        console.log("Several models available, but we have an existing conversion");

        // preselecting existing model that IS STILL federated
        modelselector.val(conv_table['modelid']);


    }
    else if (modlist.length == 1)
    {
        console.log("Just one model available, different from the existing conversion");

        // preselecting and locking the result if there is only one model
        modelselector.val(modlist[0]);
        //modelselector.prop('disabled', true);
    }

    modelselector.change();
    renderConvTable();
    modelselector.prop('disabled', modlist.length == 1);


}


function renderConvTable()
{

    // renders the conversion table according to the model_id chosen in the model selector
    var model_id = $("#convtable_modelselect").val();

    var prefill;
    try
    {
        prefill = model_id == conv_table['modelid'];
    }
    catch (err)
    {
        prefill = false;
    }

    console.log("Prefill option status: "+prefill);


    var convtable = $("#convtable_datasets");
    convtable.empty();

    if (model_id == "")
    {


        return;
    }


    var fields = conv_models[model_id]['properties'];


    // metafields for forced values and unused property
    var fieldchoice_add = '<option value="+">(aggiungi)</option>';
    var fieldchoice_none = '<option value="">(nessuno)</option>';

    // map fields list+
    var proplist = "";
    for (var i in conv_fields)
    {
        proplist += '<option value="'+conv_fields[i]+'">'+conv_fields[i]+'</option>';
    }

    for (var field in fields)
    {

        var fieldname_friendly = field != 'geometry' ? field : 'Geometria';

        var haspresetvalues = $.isArray(fields[field]);

        var selopts = $('<select id="fieldconv_'+field+'"></select>');
        selopts.append(fieldchoice_none);

        if (haspresetvalues)
        {
            selopts.append(fieldchoice_add);
        }

        selopts.append(proplist);

        //var seloptshtml = $('<div></div>').append(selopts.clone()).remove().html();

        var addpresets = $("<td class='addpresetsaction'></td>");
        // adding fixed values, generator only to begin with
        if (haspresetvalues)
        {
            addpresets.append('<img class="imgbutton conv_addpreset" id="conv_addpreset_'+field+'" title="Aggiungi valore" src="/static/resource/visng_model_addvalue.png">');
        }



        var fieldrow = $('<tr class="convtable_fieldrow"></tr>');
        fieldrow.append('<td>'+fieldname_friendly+'</td>');
        fieldrow.append($('<td></td>').append(selopts));


        // adding fixed values, generator only to begin with
        if (haspresetvalues)
        {
            var valuesconv = $('<table class="valueconvtable" cellpadding=0 cellspacing=0 id="conv_presets_'+field+'">' +
                '<thead><tr><td colspan="2"></td><td></td></tr></thead>' +
                '<tbody></tbody>' +
                '</table>');

            fieldrow.append($('<td colspan=2 class="padless"></td>').append(valuesconv));

        }
        else
        {
            fieldrow.append('<td colspan=2 class="padless"></td>');
        }
        fieldrow.append (addpresets);




        convtable.append(fieldrow);

    }

    // PREFILLING


    if (prefill)
    {

        var remap = {};


        var destfield;
        var sourcefield;
        var valuedict;
        for (sourcefield in conv_table['fields'])
        {
            // PREFILLING FIELD SELECTION
            destfield = conv_table['fields'][sourcefield]['to'];
            convtable.find("#fieldconv_"+destfield).val(sourcefield);

            // PREFILLING PRESET VALUES
            valuedict = conv_table['fields'][sourcefield]['values'];
            for (var valuefrom in valuedict)
            {
                var valueto = valuedict[valuefrom];
                $("#conv_addpreset_"+destfield).click();
                var combofield = convtable.find(".valueconv_combo_"+destfield+":last-child");
                $(combofield).find(".valueconv_from").val(valuefrom);
                $(combofield).find(".valueconv_to").val(valueto);
            }

        }

        // setting added fields
        for (destfield in conv_table['forcedfields'])
        {
            // PREFILLING FIELD SELECTION
            convtable.find("#fieldconv_"+destfield).val("+");

            // PREFILLING PRESET VALUES
            valuedict = conv_table['forcedfields'][destfield];
            for (var valuefrom in valuedict)
            {
                var valueto = valuedict[valuefrom];
                $("#conv_addpreset_"+destfield).click();
                var combofield = convtable.find(".valueconv_combo_"+destfield+":last-child");
                $(combofield).find(".valueconv_from").val(valuefrom);
                $(combofield).find(".valueconv_to").val(valueto);
            }
        }




    }






    $("#convtable_headers").show();
    /*
    $("#valueconv_save").show();
    $("#valueconv_save").prop('disabled', false);

    $("#valueconv_quit").show();
    */

    $("#fieldconv_geometry").change();

}

function checkGeometryConversion()
{
    $("#valueconv_save").prop('disabled', $("#fieldconv_geometry").val() == "");
}

function removeConvPreset()
{
    $(this).closest("tr").remove();
}

function addConvPreset()
{
    var prefix = 'conv_addpreset_';
    var model_id = $("#convtable_modelselect").val();
    var fieldname = this.id.substr(prefix.length);

    var population = "";
    for (var i in conv_models[model_id]['properties'][fieldname])
    {
        population += '<option value="'+conv_models[model_id]['properties'][fieldname][i]+'">'+conv_models[model_id]['properties'][fieldname][i]+'</option>';
    }

    var fieldconvrow = $('<tr class="valueconv_combo_'+fieldname+'">' +
            '<td class="halffield">' +
                '<input type="text" class="valueconv_from">' +
            '</td>' +
            '<td class="halffield">' +
                '<select class="valueconv_to">' +
                    population+
                '</select>' +
            '</td>' +
            '<td>' +
                '<img class="imgbutton valueconv_remove" title="Elimina valore" src="/static/resource/visng_model_deletevalue.png">' +
            '</td>' +
        '</tr>');

    $("#conv_presets_"+fieldname+">tbody").append(fieldconvrow);

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
    $("#btn_removal_closedialog").hide();
    $("#btn_removal_resetpage").hide();
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

                $("#btn_removal_resetpage").show();

            }
            else
            {
                $("#progress_removal .progressinfo").hide();
                $("#removalfinished_fail").show();
                $("#removalfail_explain").empty();
                $("#removalfail_explain").append(data['report']);
                $("#removalfail_explain").show();
                $("#btn_removal_closedialog").show();
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
            $("#btn_removal_closedialog").show();


        }
    });



}

function addNewSource ()
{

    if ($(this).hasClass('new_file'))
    {
        addNewSource_File(this.id);
    }
    else if ($(this).hasClass('new_wfs'))
    {
        addNewSource_WFS(this.id);
    }
    else if ($(this).hasClass('new_ftp'))
    {
        addNewSource_FTP(this.id);
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

function addNewSource_FTP (callerid)
{

    var prefix = 'new_ftp_';
    var dest = callerid.substr(prefix.length).split("-");

    cmeta_id = dest[1];

    $("#form_newftp").dialog("open");
    checkCandidateFTPParams();
}


function addNewSource_WFS (callerid)
{
    var prefix = 'new_file_';
    var dest = callerid.substr(prefix.length).split("-");

    cmeta_id = dest[1];

    $("#form_newwfs").dialog("open");
    checkCandidateMapname();

}


function addNewSource_Query (callerid)
{

    var prefix = 'new_query_';
    var dest = callerid.substr(prefix.length).split("-");

    console.log(callerid);
    cmeta_id = dest[1];

    $("#form_newquery").dialog("open");
    checkCandidateQueryparams();

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


function stringStartsWith (candidate, reference)
{
    return candidate.slice(0, reference.length) == reference;
}

function isValidUrl (candidate)
{
    var prefix_https = "https://";
    var prefix_http = "http://";

    if (stringStartsWith(candidate, prefix_http) || stringStartsWith(candidate, prefix_https))
    {
        try
        {
            var hostname = candidate.split("//")[1];
            if (hostname.length > 0)
            {
                return true;
            }
            else
            {
                return false;
            }
        }
        catch (ex)
        {
            return false;
        }

    }
    else
    {
        return false;
    }
}

function checkCandidateFTPParams()
{
    var cansend = true;

    // cannot send request if
    // 1. no host
    // 2. no file path
    // 3. has password but no username (while no user (anonymous) or passless user is acceptable)

    $("#warning_ftpoverwrite").hide();
    var newmappath = $("#newremote_ftppath").val();
    try
    {
        var newmapsplit = newmappath.split("/");
        var newmapfilename = newmapsplit[newmapsplit.length-1];
        var newmapname = newmapfilename.substr(0,newmapfilename.length-4);

        var maplist = [];
        for (var map_id in proxy_maps[cmeta_id])
        {
            maplist.push(map_id);
        }

        if (maplist.indexOf(newmapname) != -1)
        {
            console.log("Map id "+newmapname+" found in maplist ");
            console.log(maplist);
            $("#warning_ftpoverwrite").show();
        }

    }
    catch (err)
    {

    }




    if ( ($("#newremote_ftphost").val()=="") || (newmappath=="") || ($("#newremote_ftppass").val()!="" && $("#newremote_ftpusernanme").val()=="") )
    {
        cansend = false;
    }

    $("#form_newftp_upload").prop('disabled', !cansend);


}

function checkCandidateMapname()
{
    // same as checkCandidateFilename but for WFS, we are accessing  different elements hence the different function; plus we don't check the format
    $("#warning_wfsoverwrite").hide();
    var newmapname = $("#newremote_mapname").val();

    console.log("Verifying new remote map name "+newmapname+" compared to existing maps for meta "+cmeta_id);

    if (newmapname.length == 0 || !isValidUrl($("#newremote_url").val()))
    {
        $("#form_newwfs_upload").prop("disabled", true);
    }
    else
    {
        $("#form_newwfs_upload").prop("disabled", false);
    }



    var maplist = [];
    for (var map_id in proxy_maps[cmeta_id])
    {
        maplist.push(map_id);
    }


    if (maplist.indexOf(newmapname) != -1)
    {
        console.log("Map id "+newmapname+" found in maplist ");
        console.log(maplist);
        $("#warning_wfsoverwrite").show();
    }


}



function checkCandidateFilename()
{

    $("#warning_fileoverwrite").hide();
    $("#warning_fileformatwrong").hide();

    var mapfilepath = $("#newfile_chooser").val();
    var mapfilename = getMapIdFromPath(mapfilepath);

    console.log("Verifying new filename "+mapfilepath+" ("+mapfilename+") compared to existing maps for meta "+cmeta_id);

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
        console.log("Map id "+mapfilename+" found in maplist ");
        console.log(maplist);
        $( "#warning_fileoverwrite").show();
    }

    $("#form_newfile_upload").prop("disabled", false);

}

function tryUploadNewFTP()
{
    var urlstring = "/fwp/ftpdload/"+proxy_id+"/"+cmeta_id+"/";

    var ftpparams = {};

    ftpparams['host'] = $("#newremote_ftphost").val();
    ftpparams['user'] = $("#newremote_ftpusername").val();
    ftpparams['pass'] = $("#newremote_ftppassword").val();
    ftpparams['path'] = $("#newremote_ftppath").val();

    var map_id = ftpparams['path'];

    if (ftpparams['user'] == "")
    {
        ftpparams['user'] = null;
    }
    if (ftpparams['pass'] == "")
    {
        ftpparams['pass'] = null;
    }



    $("#form_newftp").dialog("close");
    $("#progress_newdata").dialog("open");

    $("#btn_newdata_resetpage").hide();
    $("#btn_newdata_closedialog").hide();

    $("#progress_newdata .progressinfo").hide();
    $("#progspinner_newdata").show();
    $("#progress_stage_uploading").show();


    $.ajax ({
        url: urlstring,
        data: ftpparams,
        async: true,
        type: 'POST',
        success: function(data) {

            if (data['success'] == true)
            {
                $("#progress_newdata .progressinfo").hide();
                map_id = map_id.replace(/[^\w._]+/,"");

                rebuildShapeData(cmeta_id, map_id);
            }
            else
            {
                $("#progress_newdata .progressinfo").hide();
                $("#progspinner_newdata").hide();
                $("#uploadfinished_fail").show();
                $("#uploadfail_explain").empty().append(data['report']);
                $("#uploadfail_explain").show();
                $("#btn_newdata_closedialog").show();
            }

        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").empty().append(data);
            $("#uploadfail_explain").show();
            $("#btn_newdata_closedialog").show();
        }
    });



}

function tryUploadNewRemote()
{

    var urlstring = "/fwp/download/"+proxy_id+"/"+cmeta_id+"/";


    var wfsparams = {};



    wfsparams['url'] = $("#newremote_url").val();
    wfsparams['user'] = $("#newremote_username").val();
    wfsparams['pass'] = $("#newremote_password").val();
    wfsparams['layer'] = $("#newremote_mapname").val();

    var map_id = wfsparams['layer'];

    if (wfsparams['user'] == "")
    {
        wfsparams['user'] = null;
    }
    if (wfsparams['pass'] == "")
    {
        wfsparams['pass'] = null;
    }



    $("#form_newwfs").dialog("close");
    $("#progress_newdata").dialog("open");

    $("#btn_newdata_resetpage").hide();
    $("#btn_newdata_closedialog").hide();

    $("#progress_newdata .progressinfo").hide();
    $("#progspinner_newdata").show();
    $("#progress_stage_uploading").show();


    $.ajax ({
        url: urlstring,
        data: wfsparams,
        async: true,
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
                $("#uploadfail_explain").empty().append(data['report']);
                $("#uploadfail_explain").show();
                $("#btn_newdata_closedialog").show();
            }

        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").empty().append(data);
            $("#uploadfail_explain").show();
            $("#btn_newdata_closedialog").show();
        }
    });
}



function checkCandidateQueryparams()
{

    var queryname = $("#conn_name_new").val();
    var host = $("#conn_host_new").val();
    var port = $("#conn_port_new").val();
    var db = $("#conn_db_new").val();
    var schema = $("#conn_schema_new").val();
    var view = $("#conn_view_new").val();

    var notready = false;
    $("#warning_queryoverwrite").hide();

    if (queryname.length == 0)
    {
        notready = true;
    }
    else if (queryname.indexOf(" ")!=-1)
    {
        notready = true;
    }
    else
    {

        var maplist = [];
        for (var map_id in proxy_maps[cmeta_id])
        {
            maplist.push(map_id);
        }

        if (maplist.indexOf(queryname) != -1)
        {
            $("#warning_queryoverwrite").show();
        }

    }

    if (isNaN(port) || db.length == 0 || schema.length == 0 || view.length == 0 || host.length == 0)
    {
        notready = true;
    }



    $("#form_newquery_create").prop("disabled", notready);


}


function tryCreateQuery()
{

    var conn_name = $("#conn_name_new").val();

    var conn_host = $("#conn_host_new").val();
    var conn_port = $("#conn_port_new").val();
    var conn_user = $("#conn_user_new").val();
    var conn_pass = $("#conn_pass_new").val();

    if (conn_user == "")
    {
        conn_user = null;
    }
    if (conn_pass == "")
    {
        conn_pass = null;
    }

    var conn_db = $("#conn_db_new").val();
    var conn_schema = $("#conn_schema_new").val();
    var conn_view = $("#conn_view_new").val();


    // testing the connection (through Python) and retrieving the table structure
    var urlstring = "/fwp/newqueryconn/";

    var connectiondata = {
        'name': conn_name,
        'connection':
        {
            'host': conn_host,
            'port': conn_port,
            'dbname': conn_db,
            'user': conn_user,
            'password': conn_pass
        },
        'query':
        {
            'schema': conn_schema,
            'view': conn_view
        }


    };


    $("#form_newquery").dialog("close");
    $("#progress_newquery").dialog("open");
    $("#progress_newquery .progressinfo").hide();
    $("#btn_newquery_resetpage").hide();
    $("#btn_newquery_closedialog").hide();
    $("#progspinner_newquery").show();
    $("#progress_stage_probing").show();



    $.ajax ({
        url: urlstring,
        async: true,
        data: {jsonmessage: JSON.stringify(connectiondata)},
        type: 'POST',
        success: function(data) {


            if (data['success'])
            {

                console.log("SQL probe successful");
                $("#progress_newquery .progressinfo").hide();

                saveConnection(connectiondata);

            }
            else
            {

                $("#progress_newquery .progressinfo").hide();
                $("#progspinner_newquery").hide();
                $("#creationfinished_fail").show();
                $("#creationfail_explain").empty().append(data['report']);
                $("#creationfail_explain").show();
                $("#btn_newquery_closedialog").show();


            }
        },
        error: function (data) {

            $("#progress_newquery .progressinfo").hide();
            $("#progspinner_newquery").hide();
            $("#creationfinished_fail").show();
            $("#creationfail_explain").append(data);
            $("#creationfail_explain").show();
            $("#btn_newquery_closedialog").show();

        }



    });



}

function tryUploadNewFile()
{

    var filepath = $("#newfile_chooser").val();
    var map_id = getMapIdFromPath(filepath);

    var urlstring;
    if (cmeta_id != ".st")
    {
        urlstring = "/fwp/upload/"+proxy_id+"/"+cmeta_id+"/";
    }
    else
    {
        urlstring = "/fwst/upload/"+proxy_id+"/";
    }

    // and now for some black magic...

    var fd = new FormData();
    fd.append('shapefile', $('#newfile_chooser')[0].files[0]);
    $("#form_newfile").dialog("close");
    $("#progress_newdata").dialog("open");
    $("#progress_newdata .progressinfo").hide();
    $("#btn_newdata_resetpage").hide();
    $("#btn_newdata_closedialog").hide();
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
                if (cmeta_id != ".st")
                {
                    map_id = map_id.replace(/[^\w._]+/,"");
                    console.log("Rebuilding "+map_id);
                    rebuildShapeData(cmeta_id, map_id);

                }
                else
                {
                    $("#progspinner_newdata").hide();
                    $("#progress_newdata .progressinfo").hide();
                    $("#uploadfinished_success").show();
                    $("#btn_newdata_resetpage").show();
                }
            }
            else
            {
                $("#progress_newdata .progressinfo").hide();
                $("#progspinner_newdata").hide();
                $("#uploadfinished_fail").show();
                $("#uploadfail_explain").empty().append(data['report']);
                $("#uploadfail_explain").show();
                $("#btn_newdata_closedialog").show();
            }
        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").empty().append(data);
            $("#uploadfail_explain").show();
            $("#btn_newdata_closedialog").show();
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
            $("#btn_newdata_resetpage").show();


        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").empty().append(data);
            $("#uploadfail_explain").show();
            $("#btn_newdata_resetpage").show();
        }
    });



}


function saveConnection(currentconn)
{

    $("#progspinner_newquery").show();
    $("#progress_stage_saving").show();

    console.log("Saving connection data to filesystem");

    var jsondata = {'connection': currentconn};
    var urlstring = "/fwp/registerquery/"+proxy_id+"/"+cmeta_id+"/";

    $.ajax ({
        url: urlstring,
        data:   {jsonmessage: JSON.stringify(jsondata)},
        async: true,
        type: 'POST',
        success: function(data) {
            $("#progress_stage_saving").hide();
            $("#progspinner_newquery").hide();
            $("#progress_newdata .progressinfo").hide();
            $("#creationfinished_success").show();
            $("#btn_newquery_resetpage").show();


        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progress_stage_saving").hide();
            $("#progspinner_newquery").hide();
            $("#creationfinished_fail").show();
            $("#creationfail_explain").empty().append(data);
            $("#creationfail_explain").show();
            $("#btn_newquery_closedialog").show();
        }
    });

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
    for (var cmeta_id in proxy_maps)
    {
        //var metabbox = proxy_meta[meta_id]['area'];
        var metabbox = getBbox (cmeta_id);

        console.log("Rendering bbox for "+cmeta_id);
        console.log(metabbox);

        bboxes.push(bboxToFeature(metabbox, proxymap));
    }

    proxymap_metalayer.addFeatures(bboxes);

}


function buildMapWidget()
{

    proxymap = new OpenLayers.Map('proxymap', {
        controls: []
    });

    proxymap.projection = proj_WGS84;
    proxymap.displayProjection = new OpenLayers.Projection(proj_WGS84);


    //Base Maps from Google
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Hybrid", {
        type : google.maps.MapTypeId.HYBRID,
        numZoomLevels : 20,
        visibility : false
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Physical", {
        type : google.maps.MapTypeId.TERRAIN,
        visibility : false
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Streets", {
        numZoomLevels : 20,
        visibility : false
    }));

    proxymap.addLayer(new OpenLayers.Layer.Google("Google Satellite", {
        type : google.maps.MapTypeId.SATELLITE,
        numZoomLevels : 20
    }));

    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': proxymap.getProjectionObject()});

    var osmlayer = new OpenLayers.Layer.OSM();
    proxymap.addLayer(osmlayer);


    var featurestyle = new OpenLayers.Style ({fillOpacity: 0.1, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid"});
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_metalayer = new OpenLayers.Layer.Vector("Cataloghi", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_metalayer);

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.1, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_activemeta = new OpenLayers.Layer.Vector("Catalogo attivo", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_activemeta);

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.1, fillColor: "#009900", strokeColor: "#009900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_activemap = new OpenLayers.Layer.Vector("Mappa attiva", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_activemap);


    // layer for single map display
    var featurestyle = new OpenLayers.Style ( {fillOpacity: 0.3, fillColor: "#FFFFFF", strokeColor: "#FFFFFF", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6,strokeLinecap: "round" }, {rules: []});
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_vislayer = new OpenLayers.Layer.Vector("Elementi", {name: "Strutture", styleMap: featurestylemap, renderers: ["Canvas", "SVG", "VML"]});
    proxymap.addLayer(proxymap_vislayer);



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

function resetPage()
{
    // callback for forms that need to have the page reloaded after the user reads the feedback
    window.location = window.location.pathname;
}