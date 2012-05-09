/**
 * Created with PyCharm.
 * User: drake
 * Date: 5/8/12
 * Time: 10:23 AM
 * To change this template use File | Settings | File Templates.
 */

var meta_added;
var meta_total;
var meta_names = [];

function page_init ()
{

    // numberf of metadata added to the manifest
    meta_added = 0;


    $("#datepicker_main_from").datepicker();
    $("#datepicker_main_to").datepicker();
    $("#datepicker_meta_new_from").datepicker();
    $("#datepicker_meta_new_to").datepicker();

    $('#proxy_ops_write').click(conf_ops_write);
    $('#proxy_ops_read').click(conf_ops_read);
    $('#proxy_ops_query').click(conf_ops_query);

    $('#button_add_meta').click(addMeta);

    createMapWidget("#proxy_bb");
    createMapWidget("#proxy_meta_new_bb");

    $("#disable_meta_date_from").trigger('click');
    $("#disable_meta_date_to").trigger('click');
    $("#button_add_meta").prop("disabled",true);

}



function conf_ops_write ()
{
    /*
    Replaces the current details section with the input needed for configuring a write proxy
     */

    $('#proxy_ops_details').empty();

    var write_full = '<label for="proxy_write_mode_full">Full</label><input type="radio" name="proxy_write_mode" value="full" id="proxy_write_mode_full">';
    var write_sync = '<label for="proxy_write_mode_sync">Sync</label><input type="radio" name="proxy_write_mode" value="sync" id="proxy_write_mode_sync">';


    $(write_full+write_sync).appendTo("#proxy_ops_details");
    //$(write_full).appendTo("#proxy_ops_details");
}

function conf_ops_read()
{
    //TODO: placeholder, implement
    $('#proxy_ops_details').empty();

    var read_full = '<label for="proxy_read_mode_full">Full</label><input type="radio" name="proxy_read_mode" value="full" id="proxy_read_mode_full">';
    var read_diff = '<label for="proxy_read_mode_diffc">Diff</label><input type="radio" name="proxy_read_mode" value="diff" id="proxy_read_mode_diff">';

    $(read_full+read_diff).appendTo("#proxy_ops_details");

}

function conf_ops_query()
{
    //TODO: placeholder, implement

    $('#proxy_ops_details').empty();

    var query_geo_full = makeRadio ('proxy_query_geo_mode', 'full', 'proxy_query_geo_full', 'Complesse');
    var query_geo_bb = makeRadio ('proxy_query_geo_mode', 'bb', 'proxy_query_geo_bb', 'BB');
    var query_geo_none = makeRadio ('proxy_query_geo_mode', 'none', 'proxy_query_geo_none', 'N/D');

    var query_inv_full = makeRadio ('proxy_query_inv_mode', 'full', 'proxy_query_inv_full', 'Complete');
    var query_inv_simple = makeRadio ('proxy_query_inv_mode', 'simple', 'proxy_query_inv_simple', 'Semplici');
    var query_inv_none = makeRadio ('proxy_query_inv_mode', 'none', 'proxy_query_inv_none', 'N/D');

    var query_time_full = makeRadio ('proxy_query_time_mode', 'full', 'proxy_query_time_full', 'Complete');
    var query_time_none = makeRadio ('proxy_query_time_mode', 'none', 'proxy_query_time_none', 'N/D');

    var query_signed_true = makeRadio ('proxy_query_sign', 'true', 'proxy_query_sign_true', 'Sì');
    var query_signed_false = makeRadio ('proxy_query_sign', 'false', 'proxy_query_sign_false', 'No');



    var fullhtml = "Query geografiche: "+query_geo_full+query_geo_bb+query_geo_none+"<br>"+
        "Query inventariali: "+query_inv_full+query_inv_simple+query_inv_none+"<br>"+
        "Query temporali: "+query_time_full+query_time_none+"<br>"+
        "Firma query: "+query_signed_false+query_signed_true;

    $("#proxy_ops_details").append(fullhtml);
}

function makeRadio (name, value, id, label)
{

    if (!label)
    {
        label = "";
    }

    if (!id)
    {
        id = "";
    }

    var radiobutton = '<input type="radio" name="'+name+'" value="'+value+'" id="'+id+'">';
    var labelhtml = "";
    if ((label!="") && (id!=""))
    {
        var labelhtml = '<label for="'+id+'">'+label+'</label>';
    }

    return ""+labelhtml+radiobutton;
}

//NOTE: DOES NOT WORK
function addBBoxWidget (container, destid, width, height)
{

    if (!width)
    {
        width = 320;
    }
    if (!height)
    {
        height = 240;
    }

    $("<div/>", {
        'id' : destid,
        'width' : width,
        'height' : height
    }).appendTo(container);

    var result = $(destid).geomap();

    for (key in result)
    {
        alert (""+key+": "+result[key]);
    }


}

function summarizeMeta ()
{

    /*
    Creates the FULL table with all the metadata slots already created, each with a Remove button
     */

    //TODO: placeholder, implement

    $("#proxy_metadata").empty();


}

function addMeta()
{
    /*
    Adds a new meta to the metadata list, updates the summarize section and cleans the *name* data only on the new meta section
     */


    var removebutton = '<a href="#" id="pm_%METANUM%_remove" onclick="removeMeta(%METANUM%); return false">REMOVE</a>';

    var tr_template = '<tr id="proxy_meta_%METANUM%">' +
        '<td><span id="pm_%METANUM%_name">%METANAME%</span></td>' +
        '<td><span id="pm_%METANUM%_datefrom">%METADATEFROM%</span></td>' +

        '<td><span id="pm_%METANUM%_dateto">%METADATETO%</span></td>' +
        '<td><span id="pm_%METANUM%_bbox">%METABBOX%</span></td>' +
        '<td>'+removebutton+'</td></tr>';

    // Add to metadata_submitted <tbody> element

    // passing the number
    tr_template = tr_template.replace(/%METANUM%/g,meta_added);

    //passing the date FROM
    var replacement = "";
    if ($("#datepicker_meta_new_from").prop("disabled") || $("#datepicker_meta_new_from").val()=="")
    {

        replacement = "N/A";
    }
    else
    {
        replacement = $("#datepicker_meta_new_from").val();
    }

    tr_template = tr_template.replace(/%METADATEFROM%/g, replacement);

    //passing the date TO
    if ($("#datepicker_meta_new_to").prop("disabled") || $("#datepicker_meta_new_to").val()=="")
    {
        replacement = "N/A";
    }
    else
    {
        replacement = $("#datepicker_meta_new_to").val();
    }

    tr_template = tr_template.replace(/%METADATETO%/g, replacement);


    // passing the bounding box
    if ($("#enable_meta_bbox").prop("checked"))
    {
        replacement = String($("#proxy_meta_new_bb").geomap("option", "bbox")).replace(/,/g,", ")
    }
    else
    {
        replacement = "N/A";
    }

    tr_template = tr_template.replace(/%METABBOX%/g, replacement);

    replacement = $("#name_meta_new").val();
    tr_template = tr_template.replace(/%METANAME%/g, replacement);


    $("#metadata_submitted").append(tr_template);
    //var buttonselector = "#pm_"+meta_added+"_remove";
    //$(buttonselector).click(removeMeta, meta_added);

    meta_added++;
    meta_total++;
    meta_names.push($("#name_meta_new").val());

    $("#name_meta_new").val("");
    $("#button_add_meta").prop("disabled", true);

    return false;



}

function createMapWidget (pagenode)
{

/*    if (navigator.geolocation)
    {
        navigator.geolocation.getCurrentPosition(setPos,unsetPos,element);
    }
*/

    // hardcoded, replace with geolocation
    var cpos = [11.1, 44.5];


    var cservice = [{
        class: "osm",
        type: "tiled",
        src: function( view ) {
            return "http://tile.openstreetmap.org/" + view.zoom + "/" + view.tile.column + "/" + view.tile.row + ".png";
        },
        attr: ''
    }];


    $(pagenode).geomap(
        {
            center: navigator.geolocation,
            zoom: 6,
            services: cservice,
            center: cpos
        }
    );

}


function removeMeta (meta_id)
{
    $("#proxy_meta_"+meta_id).remove();
    meta_total--;

}


function switchField (field_id, msg)
{
    var disabledstate = $(field_id).prop("disabled");
    //alert ("Switching "+field_id+" from "+fieldstate+" to "+!fieldstate);
    $(field_id).prop("disabled", !disabledstate);
    if ((!disabledstate) && (msg))
    {
        $(field_id).val(msg);
    }

    if ((disabledstate) && ($(field_id).val()))
    {
        $(field_id).val("");
    }
}


function checkMetaName (launcher)
{

    if ((launcher.value != "") && (meta_names.indexOf(launcher.value) == -1))
    {

        $("#button_add_meta").prop("disabled",false);
    }
    else
    {
        $("#button_add_meta").prop("disabled",true);

    }




}
