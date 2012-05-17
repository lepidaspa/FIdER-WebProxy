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

    $("#sel_meta").hide();
    $("#sel_shape").hide();

}


function updateFiltersFromProxy ()
{

    var i;
    var meta_id;

    $("#sel_meta :[class!=nullopt]").remove();

    var proxy_id = $("#sel_proxy").val();
    for (i in list_meta[proxy_id])
    {
        meta_id = list_meta[proxy_id][i];
        $("#sel_meta").append('<option value="'+meta_id+'">'+meta_id+'</option>');
    }

    $("#sel_meta").show();
    $("#sel_shape").hide();

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
    $("#sel_shape").show();

}

function openConversionTable ()
{
    var proxy_id = $("#sel_proxy").val();
    var meta_id = $("#sel_meta").val();
    var shape_id = $("#sel_shape").val();

    //TODO: placeholder, implement
    alert("Selecting "+proxy_id+"."+meta_id+"."+shape_id);

    $("#widget_conversion").load("/proxy/shapetable/"+proxy_id+"/"+meta_id+"/"+shape_id);

}