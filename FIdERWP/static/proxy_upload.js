/**
 * Created with PyCharm.
 * User: drake
 * Date: 5/29/12
 * Time: 10:12 AM
 * To change this template use File | Settings | File Templates.
 */

var list_proxy;
var list_meta;
var list_shape;

function pageInit()
{

    $("#confirmsend").attr('disabled', true);
    $("#sel_meta").attr('disabled', true);

    $("#sel_proxy").change(updateMetaSel);
    $("#mapsub").change(readyToUpload);

    rebuildFilters();
    filterShapes();

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
    options = $("td.shaperef");
    for (i = 0; i < options.length; i++)
    {
        //alert ($(options[i]).text());

        var proxy_id = $(options[i]).closest(".group_proxydata").attr("id").split("-")[1];
        var meta_id = $(options[i]).closest(".group_metadata").attr("id").split("-")[1];
        var shape_id = $(options[i]).attr("id").split("-").pop();
        //alert(proxy_id+"/"+meta_id+"/"+shape_id);

        if (!list_shape[proxy_id])
        {
            list_shape[proxy_id] = {};
        }
        if (!list_shape[proxy_id][meta_id])
        {
            list_shape[proxy_id][meta_id] = [];
        }
        list_shape[proxy_id][meta_id].push(shape_id);
    }

    //NOW we can bind the selects and hide/show them in realtime
    $("#sel_proxy").unbind();
    $("#sel_meta").unbind();
    $(".check_removal").unbind();

    $("#sel_proxy").change(updateMetaSel);
    $("#sel_meta").change(readyToUpload);
    $(".check_removal").click(readyToUpload);

    $("#sel_meta").attr('disabled', true);

}

function updateMetaSel()
{

    $("#sel_meta optgroup").remove();
    $("#sel_meta option:[class!=nullopt]").remove();

    var proxy_id = $("#sel_proxy").val();

    if ((proxy_id) && (proxy_id!=""))
    {
        for (var i = 0; i < list_meta[proxy_id].length; i++)
        {
            var meta_id = list_meta[proxy_id][i];
            $("#sel_meta").append('<option value="'+meta_id+'">'+meta_id+'</option>')
        }

    }






    readyToUpload();

}


function filterShapes()
{
    var proxy_id = $("#sel_proxy").val();
    var meta_id = $("#sel_meta").val();

    $("table.group_proxydata").hide();
    $("#sel_saveas option:[class!=nullopt]").remove();
    if ((proxy_id && meta_id) && (proxy_id != "" && meta_id != ""))
    {

        //alert ("Filtering from "+proxy_id+"-"+meta_id);
        //alert ("Filter elem: "+$("#proxydata-"+proxy_id).attr('id')+" - "+$("#metadata-"+meta_id).attr('id'));
        $("#proxydata-"+proxy_id).show();

        $("tbody.group_metadata").hide();
        $("#metadata-"+meta_id).show();

        //alert ("Preparing to add shapes to saves");
        for (var i = 0; i < list_shape[proxy_id][meta_id].length; i++)
        {
            var shape_id = list_shape[proxy_id][meta_id][i];
            $("#sel_saveas").append('<option value="'+shape_id+'">'+shape_id+'</option>');
        }
    }




}


function readyToUpload()
{
    //alert ("Launched by "+($(this).attr('id')));

   if ($(this).attr('id')!='mapsub')
   {
       filterShapes();
   }


    if ($("#sel_proxy").val() != "")
    {
        $("#sel_meta").removeAttr('disabled');
        if ($("#sel_meta").val() != "" && ($("#mapsub").val() || $(".check_removal:checked").length > 0))
        {
            $("#confirmsend").removeAttr('disabled');
        }
        else
        {
            $("#confirmsend").attr('disabled', true);
        }
    }
    else
    {
        $("#sel_meta").attr('disabled', true);
        $("#confirmsend").attr('disabled', true);
    }

}



