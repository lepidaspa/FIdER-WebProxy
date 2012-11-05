/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/13/12
 * Time: 6:35 PM
 * To change this template use File | Settings | File Templates.
 */


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


var cmeta_id;
// used essentially for the conversion table
var cmap_id;


var conv_hasmodels;
var conv_hastable;

var conv_table;
var conv_fields;
var conv_models;


var forcefieldstring = "+";


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
    $("#valueconv_save").live('click', saveConversionTable);

    $("#fieldconv_geometry").live('change', checkGeometryConversion);




}

function initForms ()
{

    $("#form_setconversion").hide();

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
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });

    $("#progress_visload").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        height: "auto",
        buttons: {
            "Chiudi": {
                text: "Annulla",
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
                text: "Carica",
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


function switchMapVis()
{
    var prefix = 'mapvis_';
    var dest = this.id.substr(prefix.length).split("-");

    var cmeta_id = dest[0];
    var cmap_id = dest[1];
    var switchstate = $(this).prop('checked');

    console.log("Vis switch for "+cmeta_id+"/"+cmap_id+" modified to "+switchstate);

    if (switchstate)
    {

        //TODO: warning form for heavy data that leads to vismap or unchecks

        // check if the map layer already exists, re-enable it

        // load and show the requested map
        tryVisMap();

    }
    else
    {
        //TODO: placeholder, implement
        // remove the data from the map

        // note: may simply make existing layer invisible
    }

}

function tryVisMap ()
{


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

    $("#progress_visload").dialog("open");
    $("#progress_visload").hide();
    $("#progress_visload .progressinfo").hide();
    $("#progspinner_visload").show();
    $("#progress_stage_visloading").show();

    $.ajax ({
        url:            urlstring,
        async:          true,
        success:        addVisLayer,
        error:          reportFailedVisLoad
    });

}

function addVisLayer(jsondata, textStatus, jqXHR)
{
    $("#progress_visload .progressinfo").hide();
    $("#progspinner_visload").show();
    $("#progress_stage_visrendering").show();

    var layername = cmeta_id+"-"+cmap_id;

    var featurestyle = new OpenLayers.Style ({fillOpacity: 0.3, fillColor: "#ffffff", strokeColor: "#ffffff", strokeWidth: 2, strokeDashstyle: "solid"});
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    var proxymap_newvislayer = new OpenLayers.Layer.Vector(layername, {name: layername, styleMap: featurestylemap});


    renderGeoJSONCanvas(jsondata, proxymap_newvislayer);

    proxymap.addLayer(proxymap_newvislayer);
}

function renderGeoJSONCanvas(jsondata, layer)
{

    //todo: placeholder, implement

}

function reportFailedVisLoad()
{
    //todo: placeholder, implement

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

    $.ajax({
        url: "/fwp/conversion/"+proxy_id+"/"+cmeta_id+"/"+cmap_id+"/",
        async: false
    }).done(function (jsondata) {

            if (conv_hasmodels !== false)
            {
                $("#progress_convdload .progressinfo").hide();
                prepareConversions (jsondata);
            }


        }).fail(function (data)
        {

            $("#progress_convdload .progressinfo").hide();
            $("#progspinner_convdload").hide();
            $("#convdload_fail").show();
            $("#convdloadfail_explain").val(data);
            $("#convdloadfail_explain").show();
            $("#btn_convdload_close").show();
        });

    // loading the models available from the main server

    $.ajax({
        url: "/fwp/valueconv/",
        async: true
    }).done(function (jsondata) {

            if (conv_hastable !== false)
            {
                $("#progress_convdload .progressinfo").hide();
                prepareModels (jsondata);
            }

        }).fail(function (data)
        {

            $("#progress_convdload .progressinfo").hide();
            $("#progspinner_convdload").hide();
            $("#convdload_fail").show();
            $("#convdloadfail_explain").val(data);
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
    $("#form_setconversion").show();
    $("#convtable_headers").hide();
    $("#valueconv_save").hide();
    $("#valueconv_quit").hide();

}

function saveConversionTable()
{

    // saves the current conversion setting

    console.log("Saving conversion table");


    // UI dialog init
    $("#progress_convsave").dialog("open");
    $("#progress_convsave .progressinfo").hide();
    $("#progspinner_convsave").show();
    $("#progress_stage_convsaving").show();




    var conversion = { "fields": {}, "forcedfields": {}};

    // find the model currently in use

    var model_id = $("#convtable_modelselect").val();

    conversion ['modelid'] = model_id;


    var fprefix;
    fprefix = "fieldconv_";

    var vprefix;
    vprefix = "conv_preset_";

    for (var fieldname in conv_models[model_id]['properties'])
    {
        var sourcefield = $("#"+fprefix+fieldname).val();

        if (sourcefield =="")
        {
            continue;
        }

        var isforced = (sourcefield == forcefieldstring);

        var valueconv = {};

        var base = $("#"+vprefix+fieldname);

        if (base.length == 0)
        {
            // skip if we are not in a field that allows for presets
            // TODO: move this to the fieldname iterator, continuing if the property does not have an array under itself
            continue;
        }

        var convrows = base.find('.valueconv_combo_'+fieldname);

        // filling the value conversion dictionary
        for (var i = 0; i < convrows.length; i++)
        {
            var convfrom = convrows[i].find('.valueconv_valuefrom').val();
            var convto = convrows[i].find('.valueconv_valueto').val();

            valueconv [convfrom] = convto;
        }

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
                rebuildShapeData(cmeta_id, cmap_id);
            }

            $("#progspinner").hide();


        },
        error: function (data) {

            $("#progress_convsave .progressinfo").hide();
            $("#progspinner_convsave").hide();
            $("#convsave_fail").show();


        }
    });




}

function closeConversionScreen()
{
    //TODO: placeholder, implement
    // empties the conversion widget and returns to map
    $("#convtable_modelselect").empty();
    $("#convtable_datasets").empty();
    $("#form_setconversion").hide();
    $("#proxymap").show();
}

function renderConvSelection (jsondata)
{
    // renders the conversion table for a jsondata set
    $("#progress_convdload").dialog("close");


    console.log("Rendering conversion table from data");
    console.log(jsondata);

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

    // TODO: handle autoselect in case a model was already registered

    if (modlist.length == 1)
    {
        // preselecting and locking the result if there is only one model
        modelselector.val(modlist[0]);
        modelselector.change();
        renderConvTable();
        modelselector.prop('disabled', true);
    }


}


function renderConvTable()
{

    // TODO: handle autoselect and fill for fields in case a model was already registered

    // renders the conversion table according to the model_id chosen in the model selector
    var model_id = $("#convtable_modelselect").val();

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

    // map fields list
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


    $("#convtable_headers").show();
    $("#valueconv_save").show();
    $("#valueconv_save").prop('disabled', false);

    $("#valueconv_quit").show();

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
            // TODO: implement more thorough check
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
                $("#uploadfail_explain").append(data['report']);
                $("#uploadfail_explain").show();
                $("#btn_newdata_closedialog").show();
            }

        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").append(data);
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
                $("#creationfail_explain").append(data['report']);
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
                $("#uploadfail_explain").append(data['report']);
                $("#uploadfail_explain").show();
                $("#btn_newdata_closedialog").show();
            }
        },
        error: function (data)
        {
            $("#progress_newdata .progressinfo").hide();
            $("#progspinner_newdata").hide();
            $("#uploadfinished_fail").show();
            $("#uploadfail_explain").append(data);
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
            $("#uploadfail_explain").append(data);
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
            $("#creationfail_explain").append(data);
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

    proxymap = new OpenLayers.Map('proxymap', {
        controls: []
    });

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

    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': proxymap.getProjectionObject()});

    var osmlayer = new OpenLayers.Layer.OSM();
    proxymap.addLayer(osmlayer);


    var featurestyle = new OpenLayers.Style ({fillOpacity: 0.2, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid"});
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

function resetPage()
{
    // callback for forms that need to have the page reloaded after the user reads the feedback
    window.location = window.location.pathname;
}