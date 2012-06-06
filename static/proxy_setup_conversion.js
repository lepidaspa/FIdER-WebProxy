/**
 * Created with PyCharm.
 * User: drake
 * Date: 5/11/12
 * Time: 5:08 PM
 * To change this template use File | Settings | File Templates.
 */

// list of proxies
var list_proxy;
// associative array: key proxy: value list of metadata
var list_meta;
// multi-level associative array: key proxy: value array: key meta: value shape
var list_shape;
var conversions;
var conversion_types;

function pageInit()
{
    rebuildFilters();
}

function rebuildFilters()
{

    var options;
    var group;
    var i;

    //TODO: extract proxy, meta, shapes from selection fields
    list_proxy = [];
    options = $("#sel_proxy option:[class!=nullopt]");
    for (i = 0; i < options.length; i++)
    {
        list_proxy.push(options[i].value);
    }

    list_meta = {};
    options = $("#sel_meta option:[class!=nullopt]");
    for (i = 0; i < options.length; i++)
    {
        group = $(options[i]).closest("optgroup").attr("label");
        if (!list_meta[group])
        {
            list_meta[group] = [];
        }
        list_meta[group].push(options[i].value);
    }

    list_shape = {};
    options = $("#sel_shape option:[class!=nullopt]");
    for (i = 0; i < options.length; i++)
    {
        group = $(options[i]).closest("optgroup").attr("label").split("/");
        var proxy_id = group [0];
        var meta_id = group[1];

        if (!list_shape[proxy_id])
        {
            list_shape[proxy_id] = {};
        }
        if (!list_shape[proxy_id][meta_id])
        {
            list_shape[proxy_id][meta_id] = [];
        }
        list_shape[proxy_id][meta_id].push(options[i].value);
    }

    //NOW we can bind the selects and hide/show them in realtime
    $("#sel_proxy").change(updateFiltersFromProxy);
    $("#sel_meta").change(updateFiltersFromMeta);
    $("#sel_shape").change(openConversionTable);

    $("#sel_meta").attr("disabled", true);
    $("#sel_shape").attr("disabled", true);


}


function updateFiltersFromProxy ()
{

    var i;
    var meta_id;

    $("#sel_meta :[class!=nullopt]").remove();
    var proxy_id = $("#sel_proxy").val();
    for (var i in list_meta[proxy_id])
    {
        meta_id = list_meta[proxy_id][i];
        $("#sel_meta").append('<option value="'+meta_id+'">'+meta_id+'</option>');
    }

    $("#sel_meta").removeAttr("disabled");
    $("#sel_shape").attr("disabled", true);

}

function updateFiltersFromMeta ()
{
    var i;
    var shape_id;

    $("#sel_shape :[class!=nullopt]").remove();

    var proxy_id = $("#sel_proxy").val();
    var meta_id = $("#sel_meta").val();

    for (i in list_shape[proxy_id][meta_id])
    {
        shape_id = list_shape[proxy_id][meta_id][i];
        $("#sel_shape").append('<option value="'+shape_id+'">'+shape_id+'</option>');
    }
    $("#sel_shape").removeAttr("disabled");

}

function openConversionTable ()
{

    $("#mapped_type").unbind();

    var proxy_id = $("#sel_proxy").val();
    var meta_id = $("#sel_meta").val();
    var shape_id = $("#sel_shape").val();

    //TODO: placeholder, implement
    //alert("Loading table for "+proxy_id+"."+meta_id+"."+shape_id);


    $.ajax({
        url: "/proxy/shapetable/"+proxy_id+"/"+meta_id+"/"+shape_id,
        async: false
    }).done(function( tabledata ) {
            $("#widget_conversion").empty();
            $("#widget_conversion").append(tabledata);
        });


    //conversion_init();

    focusConversionSelect();
    $("#mapped_type").unbind();
    $("#mapped_type").change(focusConversionSelect);
    //alert("Rebound mapped_type");

    $("#button_conversion_create").unbind();
    $("#button_conversion_create_meta").unbind();
    $("#button_conversion_create").click(setConversionTable);
    $("#button_conversion_create_meta").click(setConversionTableForMeta);

    $(".mapped_field").unbind();
    $(".mapped_field").change(checkSendable);

    //TODO: TEMPORARY ONLY, FIX
    $("#button_conversion_create_meta").attr("disabled", true);



}


function focusConversionSelect ()
{

    var typeselection = $("#mapped_type").val();

    //var typeselection = $("#mapped_type").find(":selected").val();

    //alert ("Filtering options  on "+typeselection);
    //$(".mapped_field optgroup").each(filterOptgroup);

    // removing ALL optgroups
    $(".mapped_field").empty();

    //building optgroup for specified type
    var optgroup = "";
    var selects = $(".mapped_field");


    selects.each (function (index, value)
        {
            $(this).append('<option value="">(non utilizzato)</option>');

            for (var fieldname in conversions[typeselection])
            {
                $(this).append("<option value='"+fieldname+"'>"+fieldname+" ("+conversions[typeselection][fieldname]+")</option>");
            }
        }
    );

}



function fillConversionTable ()
{
    var convtable = {};
    $(".conversion_item").each ( function (index,value)
        {

            var itemname = $(this).find(".item_name").text();
            var itemtype = $("#mapped_type").val();
            var itemdest = $(this).find(".mapped_field").val();

            if (itemdest != '')
            {
                convtable[itemname] = [itemtype, itemdest];
            }
        }
    );
    return convtable;
}

function checkSendable()
{
    // Verifies if all the parameters are set correctly and enables/disables sending buttons as needed. Also, it rewrites the notification area.


    //TODO: proper handling of enable-disable: ATM we use an empty form to erase all keys from an existing table


    $("#notifications_area").empty();

    var usedkeys = [];
    var warnings = [];

    $(".conversion_item").each ( function (index,value)
        {

            var itemdest = $(this).find(".mapped_field").val();

            if (itemdest != '')
            {
                usedkeys.push(itemdest);
            }
        }
    );

    var repeated = [];
    var warned = [];
    for (var i = 0; i < usedkeys.length; i++)
    {
        if ($.inArray(usedkeys[i], repeated) == -1)
        {
            repeated.push(usedkeys[i]);
        }
        else
        {
            if ($.inArray(usedkeys[i], warned) == -1)
            {
                warned.push(usedkeys[i]);
                warnings.push("La chiave "+usedkeys[i]+" è usata per più di una proprietà.<br>");
            }

        }
    }

    for (i = 0; i < warnings.length; i++)
    {
        $("#notifications_area").append(warnings[i]+"<br>");
    }



}


function setConversionTableForMeta()
{

    var jsondata = {};
    jsondata['convtable'] = fillConversionTable();
    //alert(JSON.stringify(jsondata['convtable']));

    jsondata ['proxy_id']  = $("#sel_proxy").val();
    jsondata ['meta_id'] = $("#sel_meta").val();
    jsondata ['shape_id'] = null;

    postConversionTable(jsondata);

    return false;


}
function setConversionTable()
{

    var jsondata = {};
    jsondata['convtable'] = fillConversionTable();
    //alert(JSON.stringify(jsondata['convtable']));

    jsondata ['proxy_id']  = $("#sel_proxy").val();
    jsondata ['meta_id'] = $("#sel_meta").val();
    jsondata ['shape_id'] = $("#sel_shape").val();

    postConversionTable(jsondata);

    return false;
}


function postConversionTable(jsondata)
{

    //alert(JSON.stringify(jsondata));

    var conversion_success;

    $.ajax({
            url: "/proxy/maketable/",
            async: false,
            data: {jsonmessage: JSON.stringify(jsondata)},
            type: 'POST',
            success: function(data) {
                conversion_success = data;
            }
        }

    );


    /*
    alert("Operation success status: "+conversion_success['completed']+"\n"+
        "Updated shapes: "+conversion_success['ok']+"\n"+
        "Errors on: "+conversion_success['failed']
    );
    */

    var i;
    var success_string = "";
    if (conversion_success['completed'] == true)
    {
        success_string += "Aggiornamento tabella di conversione effettuato con successo. Elementi aggiornati: ";
        for (i in conversion_success['ok'])
        {
            if (i > 0)
            {
                success_string += ", ";
            }
            success_string += conversion_success['ok'][i];
        }
    }
    else
    {
        success_string += "Aggiornamento tabella di conversione non completato.<br>";
        success_string += "Elementi aggiornati: ";
        for (i in conversion_success['ok'])
        {
            if (i > 0)
            {
                success_string += ", ";
            }
            success_string += conversion_success['ok'][i];
        }
        success_string += "<br>Elementi non aggiornati: ";
        for (i in conversion_success['failed'])
        {
            if (i > 0)
            {
                success_string += ", ";
            }
            success_string += conversion_success['failed'][i];
        }

    }
    $("#notifications_area").append(success_string);



    return false;
}

