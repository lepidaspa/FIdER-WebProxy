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


    $("#proxy_create_confirm").click(create_CreateProxy);

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

    create_CheckForSubmission();

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

        if (newmetamap.layers[1].features.length == 0)
        {
            //alert ("Using auto bb");
            boundingbox = newmetamap.getExtent().transform(newmetamap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84)).toArray();
        }
        else
        {
            //alert ("Using given bb");
            boundingbox = newmetamap.layers[1].features[0].geometry.bounds.transform(newproxymap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84)).toArray();
        }

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

    create_CheckForSubmission();

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

        if (meta_datefrom != "" && meta_datefrom != null)
        {
            str_datefrom = meta_datefrom;
        }
        else
        {
            str_datefrom = "(Globale)";
        }

        if (meta_dateto != "" && meta_dateto != null)
        {
            str_dateto = meta_dateto;
        }
        else
        {
            str_dateto = "(Globale)";
        }


        var str_bb = "";
        var meta_bb = metadata[meta_id]['area'];
        //alert (newmetamap.projection+" "+coords);
        if (meta_bb!= null)
        {

            //var coords = meta_bb_pre.toBBOX();
            //alert(JSON.stringify(meta_bb));

            //var pointA = create_reprojPoint( newmetamap, coords[0], coords[1]);
            //var pointB = create_reprojPoint( newmetamap, coords[2], coords[3]);
            //var meta_bb = new Array();


            //meta_bb.push(coords[0], coords[1], coords[2], coords[3]);

            //alert(meta_bb);
            for (var i in meta_bb)
            {
                //alert("Index: "+i);
                if (i == 2)
                {
                    str_bb += "<br>";
                }
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
        $("#newproxy_dateto").val("");
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
        $("#newmeta_datefrom").val("");
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
        $("#newmeta_dateto").val("");
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

    $("#proxymapcanvas").hide();
    $("#metamapcanvas").hide();

    $("#proxymap").show();

    // we do this to properly reset the main map
    pageInit(proxies);

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
    //create_setDrawControls(newproxymap);
    //create_setDrawControls(newmetamap);


    newproxymap.events.register("moveend", newproxymap, create_CheckForSubmission);
}


function create_createMapWidget(element)
{

    var widget;

    //TODO: import theme to local and replace this after DEMO (or before?)
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    widget = new OpenLayers.Map(element, {controls: []});
    //widget.projection = proj_WGS84;
    //widget.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var osmlayer  = new OpenLayers.Layer.OSM();
    widget.addLayer(osmlayer);



    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});
    // adding the "state" layer
    var tracelayer = new OpenLayers.Layer.Vector("BoundingBox", {styleMap: featurestylemap});
    widget.addLayer(tracelayer);

    create_centerMapTo(widget, defaultLon, defaultLat, 6);


    return widget;

}

function create_setDrawControls (map)
{

    var drawcontrol = new OpenLayers.Control.DrawFeature(
            map.layers[1], OpenLayers.Handler.RegularPolygon,

            {featureAdded: replaceOldBox, displayClass: "olControlDrawFeaturePoint", title: "Draw Features", handlerOptions: {holeModifier: "altKey", sides: 4,
        irregular: true}});
    var panel = new OpenLayers.Control.Panel({
        displayClass: "olControlEditingToolbar"
    });
    panel.addControls([
        new OpenLayers.Control.Navigation({title: "Navigate"}),
        drawcontrol]);
    map.addControl(panel);

}

function replaceOldBox (feature)
{
    /*
    var layer = feature.layer;
    var removelist = new Array();
    for (var f in layer.features)
    {
        if (feature != layer.features[f])
        {
            removelist.push (layer.features[f]);
        }
    }

    layer.removeFeatures(removelist);
    */

    var newbox = feature;
    feature.layer.removeAllFeatures();
    feature.layer.addFeatures(new Array (newbox));

    create_CheckForSubmission();
    //alert("Killing old bbox from "+feature.layer.map);
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
    var projected = lonlat.transform(new OpenLayers.Projection(proj_WGS84), map.getProjectionObject());

    map.setCenter(projected, zoom);
}

function create_reprojPointToMap (map, pointX, pointY)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(new OpenLayers.Projection(proj_WGS84), map.getProjectionObject());

    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}

function create_reprojPointToStandard (map, pointX, pointY)
{

    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(map.getProjectionObject(), new OpenLayers.Projection(proj_WGS84));

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

    // warnings and errors have specific arrays with meta_ids used to assemble the report strings

    var warnings_times = [];
    var warnings_areas = [];

    var errors_times = [];
    var errors_areas = [];

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
        if ( ($("#proxy_options_query_geo").val() == "none") && ($("#proxy_options_query_inv").val() == "none") && ($("#proxy_options_query_time").val() == "none") )
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

    var proxyfrom = hasdatefrom ? getDateForCmp(proxydatefrom) : null;
    var proxyto = hasdateto ? getDateForCmp(proxydateto) : null;

    if (  (!hasdatefrom) || (($('#newproxy_dateto_use').is(':checked')) && (!hasdateto)) )
    {
        //alert("Invalid date combo: "+validateDateField(proxydatefrom)+","+validateDateField(proxydateto));

        errors += 1;
    }
    // If dates are valid, they must be compatible
    else if (hasdatefrom && hasdateto)
    {
        if (proxyfrom >= proxyto)
        {
            errors += 1;
        }
    }


    //alert("METADATA -> "+metadata.length+": "+JSON.stringify(metadata));

    // There must be at least ONE metadata
    if (metanames.length == 0)
    {
        errors += 1;
    }


    else if (hasdatefrom && (proxyfrom < proxyto || !hasdateto))
    // without date from for the proxy we cannot make most of the checks, so we throw ONE error
    {


        // for all metadata, the bounding box must be (at least partially) INSIDE the bounding box of the proxy itself and the dates must be in the same relation with the proxy dates

        // partially included timespans and bboxes will be normalised, with a warning


        var proxy_bb;
        if (newproxymap.layers[1].features.length == 0)
        {
            //alert ("Using auto bb");
            proxy_bb = newproxymap.getExtent().transform(newproxymap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84)).toArray();
        }
        else
        {
            //alert ("Using given bb");
            proxy_bb = newproxymap.layers[1].features[0].geometry.bounds.transform(newproxymap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84)).toArray();
        }



        // note that here the i is the meta_id
        for (var i in metadata)
        {
            var meta_bb = metadata[i]['area'];
            var meta_time = metadata[i]['time'];

            if (meta_bb != null)
            {
                var bbox_match = compareBboxArrays(meta_bb, proxy_bb);
            }
            else
            {
                bbox_match = 1;
            }


            if (bbox_match == 0)
            {
                // if partially inside
                // partially outside, i.e. warning
                warnings+=1;
                warnings_areas.push(i);
            }
            else if (bbox_match == -1)
            {
                // totally out, i.e. error
                errors += 1;
                errors_areas.push(i);
            }


            // DATE VERIFICATION

            // generating all numeric dates; might be redundant in some circumstances but makes for a clearer flow


            if (!hasdateto)
            {
                proxydateto = null;
            }


            if (meta_time[0] == "")
            {
                meta_time[0] = proxydatefrom;
            }

            if (meta_time[1] == "")
            {
                meta_time[1] = proxydateto;
            }

            var timematch = compareTimeSpans(meta_time[0], meta_time[1], proxydatefrom, proxydateto);

            if (timematch == 0)
            {
                warnings+=1;
                warnings_times.push(i);
            }
            else if (timematch == -1)
            {
                errors+=1;
                errors_times.push(i);
            }

        }





    }
    else
    {

        //TODO: add error message saying meta cannot be parsed without a full proxy description
    }




    var str_err_times = errors_times.length > 0 ? writeIssueList("Intervalli non compatibili: ", errors_times)  : "";
    var str_err_areas = errors_areas.length > 0 ? writeIssueList("Aree non compatibili: ", errors_areas) : "";
    var str_warn_times = warnings_times.length > 0 ? writeIssueList("Intervalli normalizzati: ", warnings_times) : "";
    var str_warn_areas = warnings_areas.length > 0 ? writeIssueList("Aree normalizzate: ", warnings_areas) : "";

    /*
    var str_err_areas = errors_areas.length > 0 ? "WRONG BBOX: "+JSON.stringify(errors_areas) : "";
    var str_warn_times = warnings_times.length > 0 ? "AUTOFIX TIME: "+JSON.stringify(warnings_times) : "";
    var str_warn_areas = warnings_areas.length > 0 ? "AUTOFIX BBOX: "+JSON.stringify(warnings_areas) : "";
    */

    $("#reports_pre").text(str_err_times+"\n"+str_err_areas+"\n"+str_warn_areas+"\n"+str_warn_times);

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

function writeIssueList (introstring, instances)
{

    var report = introstring;

    var sep = "";
    for (var i in instances)
    {
        report += sep+instances[i];
        sep = ", ";
    }

    return report;


}


function compareBboxArrays (can_bb, ref_bb)
{
    //Compares two bounding box arrays (left, bottom, right, top) as candidate and reference. Returns 1 for full match (candidate inside reference), 0 for partial (candidate partially inside) or -1 for no match (candidate entirely outside reference). Coordinates are expected to be in the same SRS, with right > left and top > bottom
    //TODO: placeholder, implement

    //alert ("Comparing "+can_bb+" to "+ref_bb);


    var candidate = OpenLayers.Bounds.fromArray(can_bb);
    var reference = OpenLayers.Bounds.fromArray(ref_bb);


    if (reference.intersectsBounds(candidate))
    {
        //we have at least a partial match
        if (reference.containsBounds(candidate))
        {
            // full containment
            return 1;
        }
        else
        {
            // confirmed as partial
            return 0;
        }
    }
    else
    {
        // no intersection/containment at all
        return -1;
    }


}

function compareTimeSpans (str_can_from, str_can_to, str_ref_from, str_ref_to)
{

    // Compares two time span strings formatted according to the needs of getDateForCmp. Null defines open boundaries; returns 1 for full containment, 0 for partial containment and -1 for no match at all

    var can_from = str_can_from != null ? getDateForCmp(str_can_from) : null;
    var can_to = str_can_to != null ? getDateForCmp(str_can_to) : null;

    var ref_from = str_ref_from != null ? getDateForCmp(str_ref_from) : null;
    var ref_to = str_ref_to != null ? getDateForCmp(str_ref_to) : null;


    // NOTE:we are not validating a timespan INSIDE itself since for our purpose it should have already been done

    if (ref_from != null)
    {
        // if reference timespan is open backwards, we cannot exceed it there
        // so we do the check only in case there is a limit

        if (can_to != null && can_to < ref_from)
        {
            return -1;
        }
        else if (can_from == null || can_from < ref_from)
        {
            return 0;
        }

    }

    if (ref_to != null)
    {

        if (can_from != null && can_from > ref_to)
        {
            return -1;
        }
        else if (can_to == null || can_to > ref_to)
        {
            return 0;
        }

    }

    return 1;

}


function validateDateField (datestring)
{

    // WEAK VALIDATION (structure only), we only really need it in case somebody breaks the datepicker widget, which is unlikely in normal use (and there will be proper checks when trying to build the actual manifest)


    return ((datestring.match(dateregex)) &&  (parseInt(datestring.substr(0,2)) < 32) && (parseInt(datestring.substr(3,2)) < 13) );

}


function create_CreateProxy ()
{


    //alert ("Creating proxy");
    // creates the proxy according to the data in the proxy and metas by building a manifest and sending to the main server

    // container div for feedback
    var container = "#proxy_created";


    // first we must re-check the proxy names, in case somebody create a proxy with the same name (that must be unique, though the actual identifier is the token provided by the server; except for this, all other validations have already been carried out and will NOT be repeated

    var proxy_name = $("#newproxy_name").val();

    var urlstring = "/fwp/proxylist";

    var success = true;
    var newnameslist = new Array();

    $.ajax ({
        url: urlstring,
        async: false,
        success: function(manifests) {
            //alert ("COMPLETED");
            //postFeedbackMessage(data['success'], data['report'], container);

            for (var proxy_id in manifests)
            {

                newnameslist.push (manifests[proxy_id]['name']);

                if (manifests[proxy_id]['name'] == proxy_name)
                {
                    postFeedbackMessage("fail", "ERRORE: È già presente un proxy con questo nome", container);
                    success = false;
                }
            }

        },
        error: function (data)
        {
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container);
            success = false;
        }
    });

    if (!success)
    {
        proxynames = newnameslist;
        create_CheckForSubmission();
        return;
    }

    // then we assemble the manifest

    var manifest = {};

    manifest['name'] = proxy_name;

    if (newproxymap.layers[1].features.length == 0)
    {
        //alert ("Using auto bb");
        manifest['area'] = newproxymap.getExtent().transform(newproxymap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84)).toArray();
    }
    else
    {
        //alert ("Using given bb");
        manifest['area'] = newproxymap.layers[1].features[0].geometry.bounds.transform(newproxymap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84)).toArray();
    }


    var proxydatefrom = $("#newproxy_datefrom").val();
    var proxyfromint = getDateForCmp(proxydatefrom);
    proxydatefrom += "T00:00Z";
    var proxydateto = $("#newproxy_dateto").val();
    var proxytoint;
    if (proxydateto != "")
    {
        proxytoint = getDateForCmp(proxydateto);
        proxydateto += "T00:00Z";
    }
    else
    {
        proxytoint = null;
    }



    manifest['time'] = new Array (proxydatefrom, proxydateto);

    var ops_prefix = "proxy_options_";

    var opsmode = $("#proxy_opsmode").val();

    var opsdict = {
        'read' : 'none',
        'write': 'none',
        'query': {
            'inventory': 'none',
            'geographic': 'none',
            'time': 'none',
            'bi': 'none',
            'signs': false
        }
    };

    if (opsmode != 'query')
    {
        opsdict[opsmode] = $("#"+ops_prefix+opsmode).val();
    }
    else
    {
        opsdict[opsmode]['inventory'] = $("#"+ops_prefix+opsmode+"_inv").val();
        opsdict[opsmode]['geographic'] = $("#"+ops_prefix+opsmode+"_geo").val();
        opsdict[opsmode]['time'] = $("#"+ops_prefix+opsmode+"_time").val();
        opsdict[opsmode]['bi'] = $("#"+ops_prefix+opsmode+'_bi').val();

        opsdict[opsmode]['signs'] = $("#"+ops_prefix+opsmode+'_bi').val() == "true";
    }

    manifest['operations'] = opsdict;
    manifest['metadata'] = new Array();

    for (var i in metadata)
    {
        var metaname = i;

        var metadatefrom = metadata[i]['time'][0];
        var metadateto = metadata[i]['time'][1];

        // normalising the date fields

        if (metadatefrom != "" && metadatefrom != null)
        {
            if (getDateForCmp(metadatefrom) < proxyfromint)
            {
                metadatefrom = proxydatefrom;
            }
            else
            {
                metadatefrom += "T00:00Z";
            }
        }
        else
        {
            metadatefrom = proxydatefrom;
        }

        if (metadateto != "" && metadateto != null)
        {
            if ((proxytoint != null) && proxytoint < getDateForCmp(metadateto))
            {
                metadateto = proxydateto;
            }
            else
            {
                metadateto += "T00:00Z";
            }
        }
        else
        {
            metadateto = proxydateto;
        }

        var meta_time = new Array (metadatefrom, metadateto);


        //TODO: normalize bounding box too (NOT urgent)
        var meta_area = metadata[i]['area'] != null ? metadata[i]['area'] : manifest['area'];

        var currentmeta = {
            'name' : metaname,
            'area' : meta_area,
            'time' : meta_time
        };

        manifest['metadata'].push(currentmeta);
    }

    alert(JSON.stringify(manifest));

    // call the proxy creation function from ProxyFS/proxy_core via ajax

    urlstring = "/fwp/create/";

    $.ajax ({
        url: urlstring,
        data: {jsonmessage: JSON.stringify(manifest)},
        //contentType: 'application/json',
        //dataType: 'json',
        type: 'POST',
        async: true,
        success: function(data) {
            //alert ("COMPLETED");
            postFeedbackMessage(data['success'], data['report'], container);

        },
        error: function (data)
        {
            postFeedbackMessage("fail", "ERRORE AJAX: "+JSON.stringify(data), container)
        }
    });


}



//copied from fwp_metapage.js, removed closeAllMasks()
function postFeedbackMessage (success, report, widgetid)
{
    var status = success;
    var message = report;

    var feedbackclass;
    if (status == true)
    {
        feedbackclass = "success";
    }
    else
    {
        feedbackclass = "fail";
    }

    alert("RISULTATO: "+message);

    var feedbackmess = '<div class="feedback '+feedbackclass+'">' +message+ '</div>';


    $(widgetid).append(feedbackmess);

}