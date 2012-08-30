/**
 * Created with PyCharm.
 * User: drake
 * Date: 6/29/12
 * Time: 10:06 AM
 * To change this template use File | Settings | File Templates.
 */

var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var proxy_id;
var meta_id;
var queries;
var querystrings;
var manifest;
var proxy_type;

var minimap;

// current connection id: the connection we are using now
var cc_id;
// full data of the current connection, both connection and query
var currentconn;

var models;


var currentmap;

function pageInit(req_proxy_id, req_meta_id, req_manifest, req_maps)
{

    unsetLoadingState();
    $("#renderingstate").hide();
    $("#loadingstate").hide();
    $("#serverstate").hide();
    $("#currentops").hide();
    $("#btn_reload").hide();
    $("#proxy_addmap").hide();

    proxy_id = req_proxy_id;
    meta_id = req_meta_id;
    manifest = req_manifest;

    proxy_type = "query";

    queries = jQuery.parseJSON(req_maps);

    //alert(JSON.stringify(manifest['metadata']));

    //TODO: import theme to local and replace this after DEMO (or before?)
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";
    minimap = new OpenLayers.Map('minimap', {controls: []});
    minimap.projection = proj_WGS84;
    minimap.displayProjection = new OpenLayers.Projection(proj_WGS84);
    var layer = new OpenLayers.Layer.OSM();
    minimap.addLayer(layer);

    var bbox = (manifest['area']);
    zoomToBBox(minimap, bbox);

    // moved to registerModels() flow, otherwise it always fails to show the conversion table editor
    //renderQueries();

    $("#btn_addconn").click(renderNewConnMask);
    $(".btn_remove").live("click",renderRemoverMask);
    $(".btn_confirmdelete").live("click",deleteMap);

    $(".btn_convert").live('click', renderConvMask);


}

function setLoadingState()
{
    //activates the spinner, nothing else
    $("#progspinner").show();
}

function unsetLoadingState()
{
    // hides the spinner
    $("#progspinner").hide();


}

function registerModels(req_models)
{

    if (!$.isEmptyObject(req_models))
    {
        console.log("Valid model list loaded");
        models = req_models;
    }
    else
    {
        console.log("Missing valid model list");
        models = null;
        $("#proxy_addconn").empty();
        postFeedbackMessage(false, "Impossibile accedere ai modelli federati. Verificare la connessione con il federatore.", "#proxy_addconn");
        $("#proxy_addconn").append('<span id="btn_reloadpage">Riprova</span>');
        $("#btn_reloadpage").click(function () {window.location = window.location.pathname;});
    }

    renderQueries();


    //alert(JSON.stringify(models));
}

function renderQueries()
{
    // creates the infograph? and launches the card rendering

    //alert(JSON.stringify(queries));

    for (var id in queries)
    {

        var host = queries[id]['connection']['host'];
        var dbname = queries[id]['connection']['dbname'];
        var schema = queries[id]['query']['schema'];
        if (schema)
        {
            schema = schema+".";
        }
        var view = queries[id]['query']['view'];

        var statsstring = '<div class="mapstats"><span class="mapname">'+id+'</span><br>' +
                "DB: "+dbname+'@'+host+"<br>"+
                "Vista: "+schema+view+'</div>';

        var str_btn_convert = "";
        if (models != null)
        {
            str_btn_convert = '<img title="Proprietà" class="btn_convert" id="btn_convert_'+id+'" src="/static/resource/fwp_convert.png"><br>';
        }

        var str_btn_remove = '<img title="Elimina" class="btn_remove" id="btn_remove_'+id+'" src="/static/resource/fwp_remove.png">';

        var mapactions = '<div class="mapactions">'+str_btn_convert+str_btn_remove+'</div>';

        var mapcardstring = '<div class="mapcard" id="map_'+id+'">'+mapactions+statsstring+'<div class="quickcheck" id="details_'+id+'"></div></div>';

        $("#maplisting").append(mapcardstring);



    }





}


function renderNewConnMask()
{
    //TODO: add code to limit input

    closeAllMasks();

    var connmask = '<div class="createquerystring formmask" id="editconn_new">' +
            '<div class="maskfield"><div class="masksubfield">Name</div><div class="masksubfield"><input type="text" id="conn_name_new" name="conn_name_new"></div></div>' +
            '<div class="maskfield"><div class="masksubfield">Host</div><div class="masksubfield"><input type="text" id="conn_host_new" name="conn_host_new"></div></div>' +
            '<div class="maskfield"><div class="masksubfield">Port</div><div class="masksubfield"><input type="text" id="conn_port_new" name="conn_port_new"></div></div>' +
            '<div class="maskfield"><div class="masksubfield">Database</div><div class="masksubfield"><input type="text" id="conn_db_new" name="conn_db_new"></div></div>' +
            '<div class="maskfield"><div class="masksubfield">Schema</div><div class="masksubfield"><input type="text" id="conn_schema_new" name="conn_schema_new"></div></div>' +
            '<div class="maskfield"><div class="masksubfield">View</div><div class="masksubfield"><input type="text" id="conn_view_new" name="conn_view_new"></div></div>' +
            '<div class="maskfield"><div class="masksubfield">User</div><div class="masksubfield"><input type="text" id="conn_user_new" name="conn_user_new"></div></div>' +
            '<div class="maskfield"><div class="masksubfield">Password</div><div class="masksubfield"><input type="text" id="conn_pass_new" name="conn_pass_new"></div></div>' +
            '' +
            '<input type="button" id="connect_new" value="Conferma">'+
                    '</div>' ;


    $("#proxy_addconn").append(connmask);



    $("#connect_new").unbind();
    $("#connect_new").click(createNewConnection);



}


function closeAllMasks()
{
    // closes all information/feedback/creations masks in the navigation area

    $(".formmask").remove();
    $(".feedback").remove();
    $(".removemask").remove();

}

function createNewConnection()
{


    // the number refers to the position in the cards list, -1 is a new one
    cc_id = 'new';

    // testing the connection (through Python) and retrieving the table structure
    var urlstring = "/fwp/newqueryconn/";

    var connectiondata = {
        'name':$("#conn_name_"+cc_id).val(),
        'connection':
        {
            'host': $("#conn_host_"+cc_id).val(),
            'port': $("#conn_port_"+cc_id).val(),
            'dbname': $("#conn_db_"+cc_id).val(),
            'user': $("#conn_user_"+cc_id).val(),
            'password': $("#conn_pass_"+cc_id).val()
        },
        'query':
        {
            'schema': $("#conn_schema_"+cc_id).val(),
            'view': $("#conn_view_"+cc_id).val()
        }


    };

    //alert("Probing: "+JSON.stringify(connectiondata));

    setLoadingState();

    $.ajax ({
        url: urlstring,
        async: true,
        data: {jsonmessage: JSON.stringify(connectiondata)},
        type: 'POST',
        success: function(data) {

            unsetLoadingState();

            if (data['success'])
            {

                console.log("SQL probe successful");

                //postFeedbackMessage(data['success'], "Connessione riuscita, recupero tabelle di conversione.", "#proxy_addconn");
                currentconn = connectiondata;
                saveConnection(currentconn);


            }
            else
            {
                postFeedbackMessage(data['success'], data['report'], "#proxy_addconn");
            }
        },
        error: function () {
            unsetLoadingState();
            postFeedbackMessage(false, "Connessione al database fallita.", "#proxy_addconn");
        }



    });



}

function saveConnection(currentconn)
{

    console.log("Saving connection data to filesystem");

    var jsondata = {'connection': currentconn};
    //alert(JSON.stringify(jsondata));

    var urlstring = "/fwp/registerquery/"+proxy_id+"/"+meta_id+"/";
    var container = "#proxy_addconn";

    setLoadingState();

    $.ajax ({
        url: urlstring,
        data:   {jsonmessage: JSON.stringify(jsondata)},
        async: true,
        type: 'POST',
        success: function(data) {

            // we do NOT unset the loading state so it is clear to the user that the operation is still running, even if it is just for the autorefresh
            //unsetLoadingState();

            //we put the message anyway just in case there's anything to delay the refresh;
            postFeedbackMessage(data['success'], data['report']+"<br>Per accedere ai dati è necessario creare uno schema di conversione.", container);


            // AUTOREFRESH
            //window.location = window.location.pathname;
        },
        error: function (data)
        {
            unsetLoadingState();
            //alert ("FAIL");
            postFeedbackMessage(false, "ERRORE: "+JSON.stringify(data), container);

        }
    });

}


function editExistingTranslation (caller)
{

    var prefix = "btn_convert_";
    var query_id = caller.srcElement.id.substring(prefix.length);
    console.log("Editing conversions for "+query_id);

    var urlstring = "/fwp/reviewqueryconn/"+proxy_id+"/"+meta_id+"/"+query_id;

    setLoadingState();

    $.ajax ({
        url: urlstring,
        async: true,
        type: 'GET',
        success: function(data) {

            unsetLoadingState();

            if (data['success'])
            {
                console.log("Full conversion retrieval");
                // DEPRECATED renderTranslationMask(query_id, data['report']);
                // no message, we only render the mask
                //postFeedbackMessage(data['success'], "Connessione riuscita, recupero tabelle di conversione.", "#details_"+query_id);

                //TODO: launch function for editing


            }
            else
            {
                if ($.isEmptyObject(data['report']))
                {
                    console.log("No file on filesystem, db is unreachable.");
                    postFeedbackMessage(false, "Impossibile ottenere i dati per la conversione.", "#details_"+query_id);
                }
                else
                {
                    console.log("Retrieved from filesystem, db is unreachable.");
                    // DEPRECATED renderTranslationMask(query_id, data['report']);
                    postFeedbackMessage(false, "Impossibile ottenere i dati per la conversione.", "#details_"+query_id, true);
                }
            }
        },
        error: function (data) {

            unsetLoadingState();
            postFeedbackMessage(data['success'], "Impossibile ottenere i dati per la conversione.", "#details_"+query_id);

        }

    });


}


function renderRemoverMask()
{

    var prefix = "btn_remove_";
    var i = this.id.substr(prefix.length);

    closeAllMasks();


    var removestring = '<div class="removemask maskwidget" id="remove_'+i+'">' +
            'Confermi l\'eliminazione della mappa?<br>' +
            '<input type="button" class="btn_confirmdelete" id="btn_confirmdelete_'+i+'" value="Elimina">' +
            '<br>ATTENZIONE: questa azione non può essere annullata.' +
            '</div>';

    $("#map_"+i).append(removestring);


}

function deleteMap ()
{
    var prefix = "btn_confirmdelete_";
    var i = this.id.substr(prefix.length);

    closeAllMasks();

    var container = "#currentops";

    var controldict = {
        'action': 'delete',
        'proxy_id': proxy_id,
        'meta_id': meta_id,
        'shape_id': i
    };

    setLoadingState();


    $.ajax({
        url: "/fwp/control/",
        async: true,
        data: controldict,
        type: 'POST',
        success: function(data)
        {
            unsetLoadingState();
            postFeedbackMessage(data['success'], data['report'], container);
        },
        error: function (data)
        {
            unsetLoadingState();
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container);
        }
    });

    $("#currentops").show();
    $("#serverstate").hide();
    $("#btn_reload").show();
}



function checkConversions()
{

    var in_use = new Array();
    var has_dupes = false;
    var has_geom = false;

    var filter =  $("select#objtype").val();
    var prefix_objtype = "fieldtype_";

    var prefix_selectitem = "fieldconversion_";

    // checking only conversions for the selected type
    $("select."+prefix_objtype+filter).each(
            function (i)
            {

                var currentto = $(this).attr('id').substr(prefix_selectitem.length);
                var currentfrom = $(this).val();
                if (currentfrom != "")
                {
                    if (in_use.indexOf(currentfrom) == -1)
                    {
                        in_use.push(currentfrom);
                    }
                    else
                    {
                        has_dupes = true;
                    }

                    if (currentto == 'geometry')
                    {
                        has_geom = true;
                    }
                }

            }

    );

    if (has_dupes || (in_use.length == 0) || !has_geom)
    {
        $("#newconn_save").prop('disabled', true);
    }
    else
    {
        $("#newconn_save").prop('disabled', false);

    }

}


function saveNewConnection ()
{

    var conversion = {};

    // Getting the value of the main select (i.e. type of object)
    var filter =  $("select#objtype").val();

    var prefix_destfield = "fieldconversion_";
    var prefix_objtype = "fieldtype_";

    $("select."+prefix_objtype+filter).each(
            function (i)
            {
                if ($(this).val()!="")
                {

                    var convfrom = $(this).val();
                    var convto = $(this).attr("id").substr(prefix_destfield.length);

                    conversion[convfrom] = [filter, convto];

                    //alert(convfrom+": "+filter+"."+convto);
                }
            }
    );

    //alert(JSON.stringify(currentconn));
    //alert(JSON.stringify(conversion));

    jsondata = {'connection': currentconn, 'conversion': conversion}
    //alert(JSON.stringify(jsondata));

    var urlstring = "/fwp/registerquery/"+proxy_id+"/"+meta_id+"/";
    var container = "#proxy_addconn";

    setLoadingState();

    $.ajax ({
        url: urlstring,
        data:   {jsonmessage: JSON.stringify(jsondata)},
        async: true,
        type: 'POST',
        success: function(data) {

            // we do NOT unset the loading state so it is clear to the user that the operation is still running, even if it is just for the autorefresh
            //unsetLoadingState();

            //we put the message anyway just in case there's anything to delay the refresh;
            postFeedbackMessage(data['success'], data['report'], container);


            // AUTOREFRESH
            window.location = window.location.pathname;
        },
        error: function (data)
        {
            unsetLoadingState();
            //alert ("FAIL");
            postFeedbackMessage(false, "ERRORE: "+JSON.stringify(data), container);

        }
    });



}

function renderConnSummary (widgetid)
{

    var summary = '<div class="connsummary">';

    summary += currentconn['connection']['host']+':<br>' +currentconn['connection']['dbname']+"."+currentconn['query']['schema']+"."+currentconn['query']['view']+'</div>';

    $(widgetid).append(summary);

}

function filterConversionFields()
{

    var ctype = $("select#objtype").val();

    $(".typefield").hide();
    $(".typefieldlist_"+ctype).show();
    checkConversions();

}


// from metapage.js
function zoomToBBox (olmap, bbox)
{
    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());
    olmap.zoomToExtent (bounds, true);


}


function postFeedbackMessage (success, report, widgetid, dontcloseall)
{



    var feedbackclass;
    if (success)
    {
        feedbackclass = "success";
    }
    else
    {
        feedbackclass = "fail";
    }

    var feedbackmess = '<div class="feedback '+feedbackclass+'">' +report+ '</div>';

    if (typeof dontcloseall != 'undefined' && !dontcloseall)
    {
        closeAllMasks();
    }

    $(widgetid).append(feedbackmess);
}