/**
 * Created with PyCharm.
 * User: drake
 * Date: 6/22/12
 * Time: 8:16 AM
 * To change this template use File | Settings | File Templates.
 */

// map used to set up the bbox of the proxy
var newproxymap = null;
// map used to set up the bbox of the meta
var newmetamap = null;

var defaultLon = 11.1;
var defaultLat = 44.5;
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var metanames = new Array();

// MOVED TO fwp_proxysel
// var proxynames = new Array();

var metadata = {};

var dateregex = new RegExp ("\\d{2}-\\d{2}-\\d{4}");


function create_initForm()
{

    if ((newmetamap == null) && (newproxymap == null))
    {
        create_setMaps();

        // Moved bindings here so we don't have multiple bindings from the same event

        $("#proxy_show_map").click(backToMaps);
        $("#proxy_opsmode").change(setOpsModeVisibility);
        bindInputFields();


    }
    else
    {
        $("#proxymapcanvas").show();
        $("#metamapcanvas").show();
    }

    $("#proxycreate_mask").show();

    setOpsModeVisibility();
    $("#proxymap").hide();
    $("#proxy_create_new").hide();
    $("#proxy_show_map").show();

/*
    $("#tool_nav_proxy").click(create_setNavControlsHere);
    $("#tool_draw_proxy").click(create_setDrawControlsHere);
*/

    create_CheckNewMetaInfo();
    create_CheckForSubmission();


}

function bindInputFields()
{
    // trying to intercept all types of modifiers, since .change is not reliable
    // note that mouseup is quite intrusive at times
    $("#newproxy_name").keyup(create_CheckForSubmission);
    $("#newproxy_name").mouseup(create_CheckForSubmission);
    $("#newproxy_name").change(create_CheckForSubmission);


    $("#newproxy_datefrom").datepicker( {onClose: create_CheckForSubmission, changeYear: true, dateFormat: "dd-mm-yy"});
    $("#newproxy_dateto").datepicker( {onClose: create_CheckForSubmission, changeYear: true, dateFormat: "dd-mm-yy"});
    $('#newproxy_dateto_use').change(switchProxyDateTo);

    $("#newmeta_datefrom").datepicker( {onClose: create_CheckNewMetaInfo, changeYear: true, dateFormat: "dd-mm-yy"});
    $("#newmeta_dateto").datepicker( {onClose: create_CheckNewMetaInfo, changeYear: true, dateFormat: "dd-mm-yy" });
    $('#newmeta_datefrom_use').change(switchMetaDateFrom);
    $('#newmeta_dateto_use').change(switchMetaDateTo);

    $(".fields_query").change(create_CheckForSubmission);
    $("#proxy_opsmode").change(create_CheckForSubmission);


    // trying to intercept all types of modifiers, since .change is not reliable
    // note that mouseup is quite intrusive at times
    $("#newmeta_name").keyup(create_CheckNewMetaInfo);
    $("#newmeta_name").mouseup(create_CheckNewMetaInfo);
    $("#newmeta_name").change(create_CheckNewMetaInfo);

    $("#newmeta_confirm").click(create_AddNewMeta);


    $(".newmeta_ctrldelete .metaremover").live('click', create_RemoveMeta);

}

function create_RemoveMeta()
{
   // alert(this.id+"\n"+JSON.stringify(metadata));

    var prefix = "removemeta_";
    var meta_id = this.id.substr(prefix.length);

    delete metadata[meta_id];
    //alert(JSON.stringify(metadata));
    var newnames = new Array();
    for (var i in metanames)
    {
        if (metanames[i] != meta_id)
        {
            newnames.push(metanames[i]);
        }
    }
    metanames = newnames;

    $("#"+this.id).closest("tr").remove();

}

function create_AddNewMeta()
{

    var meta_info = {};

    var meta_name = $("#newmeta_name").val();

    var metadatefrom = "";
    if ($('#newmeta_datefrom_use').is(':checked'))
    {
        metadatefrom = $("#newmeta_datefrom").val();
    }

    var metadateto = "";
    if ($('#newmeta_dateto_use').is(':checked'))
    {
        metadateto = $("#newmeta_dateto").val();
    }




    var boundingbox;
    if ($('#newmeta_bbox_use').is(':checked'))
    {
        // use own map bbox
        boundingbox = newmetamap.baseLayer.getExtent().toBBOX();
    }
    else
    {
        boundingbox = null;
    }

    metadata [meta_name] = {'time': [metadatefrom, metadateto], 'area': boundingbox};
    metanames.push(meta_name);


    renderMetaList();
    $("#newmeta_name").val("");
    $("#newmeta_name").trigger("change");

}

function renderMetaList()
{

    //alert(JSON.stringify(metadata));

    $("tr.metalist").remove();

    for (var meta_id in metadata)
    {

        var str_datefrom = "";
        var str_dateto = "";
        var meta_datefrom = metadata[meta_id]['time'][0];
        var meta_dateto = metadata[meta_id]['time'][1];

        if (meta_datefrom != "")
        {
            str_datefrom = meta_datefrom;
        }
        else
        {
            str_datefrom = "(Globale)";
        }
        if (meta_dateto != "")
        {
            str_dateto = meta_dateto;
        }
        else
        {
            str_dateto = "(Globale)";
        }


        var str_bb = "";
        var coords = metadata[meta_id]['area'];
        //alert (newmetamap.projection+" "+coords);
        if (coords!= null)
        {

            //var coords = meta_bb_pre.toBBOX();
            //alert(JSON.stringify(meta_bb));

            var pointA = create_reprojPoint( newmetamap, coords[0], coords[1]);
            var pointB = create_reprojPoint( newmetamap, coords[2], coords[3]);
            var meta_bb = new Array();


            meta_bb.push(pointA.x, pointA.y, pointB.x, pointB.y);

            //alert(meta_bb);

            for (var i in meta_bb)
            {
                //alert("Index: "+i);

                str_bb += " "+meta_bb[i].toFixed(5);
            }
        }
        else
        {
            str_bb = "(Globale)";
        }



        var trstring = '<tr class="metalist" id="metalist_'+meta_id+'">' +
                '<td class="newmeta_namefield">'+meta_id+'</td>' +
                '<td class="newmeta_datefrom">'+str_datefrom+'</td>' +
                '<td class="newmeta_dateto">'+str_dateto+'</td>' +
                '<td class="newmeta_bb">'+str_bb+'</td>' +
                '<td class="newmeta_ctrldelete"><input class="metaremover" type="button" value="-" id="removemeta_'+meta_id+'"></td>' +
                '</tr>';

        $("#new_meta_table").append(trstring);

    }




}


function getDateForCmp (datestring)
{
    // Takes a datestring (from an optimized field, DD/MM/YYYY) and chnages it into an Int for quick comparison
    return parseInt(datestring.substr(6,4)+datestring.substr(3,2)+datestring.substr(0,2), 10);
}

function switchProxyDateTo ()
{
    if ($("#newproxy_dateto").prop('disabled'))
    {
        $("#newproxy_dateto").prop('disabled', false);
        $("#newproxy_dateto").val("");
    }
    else
    {
        $("#newproxy_dateto").prop('disabled', true);
        $("#newproxy_dateto").val("Permanente");
    }
    create_CheckForSubmission();
}

function switchMetaDateFrom ()
{
    if ($("#newmeta_datefrom").prop('disabled'))
    {
        $("#newmeta_datefrom").prop('disabled', false);
        $("#newmeta_datefrom").val("");
    }
    else
    {
        $("#newmeta_datefrom").prop('disabled', true);
        $("#newmeta_datefrom").val("Globale");
    }
    create_CheckNewMetaInfo();
}

function switchMetaDateTo ()
{
    if ($("#newmeta_dateto").prop('disabled'))
    {
        $("#newmeta_dateto").prop('disabled', false);
        $("#newmeta_dateto").val("");
    }
    else
    {
        $("#newmeta_dateto").prop('disabled', true);
        $("#newmeta_dateto").val("Globale");
    }
    create_CheckNewMetaInfo();
}

function create_setNavControlsHere ()
{

    var desc = this.id.split("_");
    var targetname = desc[desc.length-1];

    //alert("Switching "+targetname+" to nav controls");

    if (targetname == 'proxy')
    {
        create_setNavControls(newproxymap);
    }
    else if (targetname == 'meta')
    {
        create_setNavControls(newmetamap);
    }

    //alert(JSON.stringify($("#"+this.id).closest(".mapmask")));
    //.closest("#mapmask").attr('id')

}



function backToMaps()
{
    $("#proxy_builder").hide();
    $("#proxycreate_mask").hide();

    $("#proxy_create_new").show();
    $("#proxy_show_map").hide();
    $("#proxymap").show();
    $("#proxymapcanvas").hide();
    $("#metamapcanvas").hide();

}

function setOpsModeVisibility ()
{
    var currentmode = $("#proxy_opsmode").val();
    $(".opsdetail_sel").hide();

    $("#proxy_opsmode_"+currentmode).show();

}

function create_setMaps()
{

    newproxymap = create_createMapWidget("proxymapcanvas");
    newmetamap = create_createMapWidget("metamapcanvas");

    create_setNavControls(newproxymap);
    create_setNavControls(newmetamap);

}




function create_createMapWidget(element)
{

    var widget;

    //TODO: import theme to local and replace this after DEMO (or before?)
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    widget = new OpenLayers.Map(element, {controls: []});
    widget.projection = proj_WGS84;
    widget.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var osmlayer  = new OpenLayers.Layer.OSM({projection: new OpenLayers.Projection(proj_WGS84)});
    widget.addLayer(osmlayer);

    var tracelayer = new OpenLayers.Layer.Vector({projection: new OpenLayers.Projection(proj_WGS84)});
    widget.addLayer(tracelayer);


    create_centerMapTo(widget, defaultLon, defaultLat, 6);

    return widget;

}

function create_setNavControls (map)
{

    map.addControl(new OpenLayers.Control.Navigation());

}

function create_unsetNavControls (map)
{
    //alert("Current map:"+JSON.stringify(map));
    map.removeControl(OpenLayers.Control.Navigation());
}


function create_centerMapTo (map, lon, lat, zoom)
{
    var lonlat = new OpenLayers.LonLat (lon, lat);
    var projected = lonlat.transform( new OpenLayers.Projection(proj_WGS84), map.getProjectionObject());

    map.setCenter(projected, zoom);
}

function create_reprojPoint (map, pointX, pointY)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(new OpenLayers.Projection(proj_WGS84), map.getProjectionObject());

    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}

function create_CheckNewMetaInfo()
{
    // checks if the data provided with the new meta is enough for adding

    var validsubmission = true;

    // The meta name must be <20 chars long and have only [A-Za-z_]


    var metaname =  $("#newmeta_name").val();
    //alert("CHECKING "+metaname);
    if (! ((metaname.length <= 20 ) && (metaname.match(/^[A-Za-z0-9_]+$/)!=null) && (metanames.indexOf(metaname) == -1) && (metaname.length > 0))  )
    {
        validsubmission = false;
    }

    // CAN have no dates, in that case it follows the proxy
    // CANNOT have an ending date that comes sooner than the starting date
    // Comparison with the proxy date is not preanalysed because proxy date can change after the meta has been accepted (so the user can add, but there will be an error or warning in the submission check)
    var metadatefrom = $("#newmeta_datefrom").val();
    var metadateto = $("#newmeta_dateto").val();

    var hasdatefrom = validateDateField(metadatefrom);
    var hasdateto = validateDateField(metadateto);

    var usedatefrom = $('#newmeta_datefrom_use').is(':checked');
    var usedateto = $('#newmeta_dateto_use').is(':checked');


    if ( ((!hasdatefrom) && usedatefrom) || ((!hasdateto) && usedateto))
    {
        validsubmission = false;
    }
    // we check for date compatibility only if both dates are in use
    else if ((hasdatefrom && hasdateto) && (usedatefrom && usedateto))
    {
        if (getDateForCmp(metadatefrom) > getDateForCmp(metadateto))
        {
            validsubmission = false;
        }
    }


    // CAN have no BB, in that case it follows the proxy
    // BB is NOT pre-analysed since the proxy bb can change later (so the user can add, but there will be an error or warning in the submission check)


    // overall check
    if (!validsubmission)
    {
        //alert("CHECKED bad");
        $("#newmeta_confirm").prop('disabled', true);
    }
    else
    {
        //alert("CHECKED ok");
        $("#newmeta_confirm").prop('disabled', false);
    }

}

function create_CheckForSubmission()
{

    //NOTE: proxynames are downloaded elsewhere (in the fwp_proxysel.js)

    // Both warnings and errors are displayed in the reports section, but errors make disable the creation button
    var warnings = 0;
    var errors = 0;

    //TODO: add messages for each error/warning
    //Note that to avoid conflicts with CheckMetaInfo we will use two global arrays with warnings and errors and re-render the arrays as a whole after checking to avoid double
    // Also, we report inconsistencies, NOT missing fields to avoid saturation. The instructions about the mandatory fields will be in the help column on the side


    // checks if the data provided for the proxy and the inserted metas is OK. Provides a report and activates/deactivates the submission button

    // The proxy name must be <20 chars long and have only [A-Za-z_] and not be used by any other softproxy on the current hardproxy
    var proxyname =  $("#newproxy_name").val();
    //alert("CHECKING "+proxyname);
    if (!( (proxyname.length <= 20 ) && (proxyname.match(/^[A-Za-z0-9_]+$/)!=null) && (proxynames.indexOf(proxyname) == -1) && (proxyname.length > 0)))
    {
        errors += 1;
    }

    // IF the proxy is a query proxy, AT LEAST one type of query must be enabled beyond the 'none' level
    var proxymode = $("#proxy_opsmode").val();
    if (proxymode == "query")
    {
        // proxy_options_query_geo, proxy_options_query_inv, proxy_options_query_time, proxy_options_query_bi
        if ( ($("#proxy_options_query_geo").val() == "none") && ($("#proxy_options_query_inv").val() == "none") && ($("#proxy_options_query_time").val() == "none") && ($("#proxy_options_query_bi").val() == "none") )
        {
            errors += 1;
        }
    }

    // The proxy MUST have a starting date, can be without an ending date if the specific checkbox is activated (permanent proxy)
    var proxydatefrom = $("#newproxy_datefrom").val();
    var proxydateto = $("#newproxy_dateto").val();
    //alert (proxydatefrom+" - "+proxydateto);

    var hasdatefrom = validateDateField(proxydatefrom);
    var hasdateto = validateDateField(proxydateto);

    if (  (!hasdatefrom) || (($('#newproxy_dateto_use').is(':checked')) && (!hasdateto)) )
    {
        //alert("Invalid date combo: "+validateDateField(proxydatefrom)+","+validateDateField(proxydateto));

        errors += 1;
    }

    // The dates of the proxy must be compatible
    if (hasdatefrom && hasdateto)
    {
        if (getDateForCmp(proxydatefrom) > getDateForCmp(proxydateto))
        {
            errors += 1;
        }
    }

    // There must be at least ONE metadata
    if (metadata.length == 0)
    {
        errors += 1;
    }

    // for all metadata, the bounding box must be (at least partially) INSIDE the bounding box of the proxy itself and the dates must be in the same relation with the proxy dates

    // partially included timespans and bboxes will be normalised, with a warning






    // overall check
    if (errors > 0)
    {
        $("#proxy_create_confirm").prop('disabled', true);
    }
    else
    {
        $("#proxy_create_confirm").prop('disabled', false);
    }


}

function validateDateField (datestring)
{

    // WEAK VALIDATION (structure only), we only really need it in case somebody breaks the datepicker widget, which is unlikely in normal use (and there will be proper checks when trying to build the actual manifest)


    return ((datestring.match(dateregex)) &&  (parseInt(datestring.substr(0,2)) < 32) && (parseInt(datestring.substr(3,2)) < 13) );

}