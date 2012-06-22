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

function create_initForm()
{

    if ((newmetamap == null) && (newproxymap == null))
    {
        create_setMaps();
    }
    else
    {
        $("#proxymapcanvas").show();
        $("#metamapcanvas").show();
    }
    $("#proxycreate_mask").show();

    setOpsModeVisibility();
    $("#proxy_opsmode").change(setOpsModeVisibility);
    $("#proxymap").hide();
    $("#proxy_create_new").hide();
    $("#proxy_show_map").show();
    $("#proxy_show_map").click(backToMaps);

/*
    $("#tool_nav_proxy").click(create_setNavControlsHere);
    $("#tool_draw_proxy").click(create_setDrawControlsHere);
*/

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

    var osmlayer  = new OpenLayers.Layer.OSM();

    widget.addLayer(osmlayer);

    var tracelayer = new OpenLayers.Layer.Vector();
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

    //TODO: add downloading of currently used names

    var metaname =  $("#newmeta_name").val();
    alert("CHECKING "+metaname);
    if ( (metaname.length > 20 ) || (metaname.match(/^[A-Za-z0-9_]+$/)!=null) || (metanames.indexOf(metaname) != -1) || (metaname.length == 0))
    {
        validsubmission = false;
    }




    // CAN have no dates, in that case it follows the proxy
    // CAN have no BB, in that case it follows the proxy

    // CANNOT have an ending date that comes sooner than the starting date


    // overall check
    if (!validsubmission)
    {
        alert("CHECKED bad");
        $("#newmeta_confirm").prop('disabled', true);
    }
    else
    {
        alert("CHECKED ok");
        $("#newmeta_confirm").prop('disabled', false);
    }

}

function create_CheckForSubmission()
{
    // checks if the data provided for the proxy and the inserted meta is OK. Provides a report and activates/deactivates the submission button

    // The proxy name must be <20 chars long and have only [A-Za-z_] and not be used by any other softproxy on the current hardproxy

    // The proxy MUST have a starting date, can be without an ending date if the specific checkbox is activated (permanent proxy)

    // The dates of the proxy must be compatible



    // There must be at least ONE metadata

}