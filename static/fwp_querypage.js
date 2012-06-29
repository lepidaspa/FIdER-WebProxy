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




function pageInit(req_proxy_id, req_meta_id, req_manifest, req_maps)
{

    $("#renderingstate").hide();
    $("#loadingstate").hide();
    $("#serverstate").hide();
    $("#currentops").hide();
    $("#btn_reload").hide();
    $("#proxy_addmap").hide();

    proxy_id = req_proxy_id;
    meta_id = req_meta_id;
    manifest = req_manifest;



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

    renderQueries();

    $("#btn_addconn").click(renderNewConnMask);

}

function registerModels(req_models)
{
    models = req_models;

    //alert(JSON.stringify(models));
}

function renderQueries()
{
    //TODO: placeholder, implements
    // creates the infograph and launches the card rendering
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
                    '</div>'
            ;








    $("#proxy_addconn").append(connmask);

    /*
     QUICK TESTING HACK
     */
    $("#conn_name_new").val("Testbed");
    $("#conn_host_new").val("195.62.186.196");
    $("#conn_port_new").val("5432");
    $("#conn_db_new").val("geodb");
    $("#conn_schema_new").val("reti");
    $("#conn_view_new").val("f_links_ln");
    $("#conn_user_new").val("labs");
    $("#conn_pass_new").val("lepidalabs");
    /*
     TODO: REMOVE THE ABOVE HARDCODING
     */

    $("#connect_new").unbind();
    $("#connect_new").click(createNewConnection);



}

function configConnection()
{

    var conn_id = cc_id;

}

function closeAllMasks()
{
    // closes all information/feedback/creations masks in the navigation area
    //TODO: placeholder, implement

    $(".formmask").remove();
    $(".feedback").remove();



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

    $.ajax ({
        url: urlstring,
        async: true,
        data: {jsonmessage: JSON.stringify(connectiondata)},
        type: 'POST',
        success: function(data) {
            if (data['success'])
            {
                //postFeedbackMessage(data['success'], "Connessione riuscita, recupero tabelle di conversione.", "#proxy_addconn");
                currentconn = connectiondata;
                editTranslation(data['report']);

            }
            else
            {
                postFeedbackMessage(data['success'], data['report'], "#proxy_addconn");
            }
        }



    });


    // if successful, saving the basic info about it


    // opening the connection edit mask in the new connection area with the data taken from the test
    configConnection();

    // after we set that up, we save the basic data


}

function editTranslation(ffields)
{
    // creates a widget interface to set the conversion of foreign fields in our model fields

    closeAllMasks();

    var convtable = '<div class="formmask" id="editxlate_new">' +
            '<div class="maskfield"><div class="colhead masksubfield">Campo</div><div class="masksubfield colhead">Ricerca su</div></div>';

    var fieldselect_ops = '<option value=""></option>';
    for (var i in ffields)
    {
        // note: conv table fields are : name, can be null, datatype (not sure if really useful, definitions are very vague)
        fieldselect_ops += '<option value="'+ffields[i][0]+'">'+ffields[i][0]+'</option>';
    }

    var typeselect = '<div id="select_objtype"><label for="objtype">Tipologia</label> <select id="objtype">';
    for (var m in models)
    {
        typeselect += '<option value="'+m+'">'+m+'</option>';

        for (var f in models[m])
        {
            convtable += '<div class="maskfield typefield typefieldlist_'+m+'"><div class="masksubfield">'+f+'</div><div class="masksubfield colhead"><select class="fieldtype_'+m+' fieldconv_'+f+'" id="fieldconversion_'+f+'">'+fieldselect_ops+'</select></div></div>';
        }

        convtable += '<div class="maskfield typefield typefieldlist_'+m+'"><div class="masksubfield">Geometria</div><div class="masksubfield colhead"><select id="fieldconversion_geo">'+fieldselect_ops+'</select></div></div>';

    }
    typeselect += '</select></div>';


    convtable += '</div>' +
            '<input type="button" id="newconn_save" value="Crea">';



    if (cc_id == 'new')
    {

        renderConnSummary("#proxy_addconn");

        $("#proxy_addconn").append(typeselect);
        $("#proxy_addconn").append(convtable);


        $("select#objtype").unbind();
        $("select#objtype").change(filterConversionFields);
        $("select#objtype").trigger("change");
        $("#newconn_save").unbind();
        $("#newconn_save").click(saveNewConnection);
    }


}

function saveNewConnection ()
{

    var conversion = {};
    var filter =  $("select#objtype").val();

    $("select.fieldtype_"+filter).each(
            function (i)
            {
                if ($(this).val()!="")
                {
                    alert($(this).attr('class'));
                }

            }
    );




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

}


// from metapage.js
function zoomToBBox (olmap, bbox)
{
    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());
    olmap.zoomToExtent (bounds, true);


}


function postFeedbackMessage (success, report, widgetid)
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

    closeAllMasks();
    $(widgetid).append(feedbackmess);
}