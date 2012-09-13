/**
 * Created with PyCharm.
 * User: drake
 * Date: 6/12/12
 * Time: 11:25 AM
 * To change this template use File | Settings | File Templates.
 */

var proxies;

var mapvis;
var mapvislayer = null;
var mapvisformat;

var defaultLon = 11.1;
var defaultLat = 44.5;
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var proxynames = new Array();

// string : "proxy" "standalone"
var proxycreationmode = "";
// if the user is creating a new instance or just looking at the map
var creationmode = false;

function pageInit(jsonlisting)
{

    // by default we only show the proxymap, not the creation interface
    $("#proxybuilder").hide();
    $("#proxy_show_map").hide();
    $("#proxy_created").hide();
    $("#progspinner").hide();

    $("#tabsel_proxy").click(showSelProxy);
    $("#tabsel_standalone").click(showSelStandalone);



    proxies = jsonlisting;
    console.log(proxies);

    buildProxyList();

    $("#proxymap").empty();

    //TODO: import theme to local and replace this after DEMO (or before?)
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    mapvis = new OpenLayers.Map('proxymap', {controls: []});
    mapvis.projection = proj_WGS84;
    mapvis.displayProjection = new OpenLayers.Projection(proj_WGS84);


    var osmlayer  = new OpenLayers.Layer.OSM();

    mapvis.addLayer(osmlayer);


    mapvislayer = new OpenLayers.Layer.Vector();
    mapvis.addLayer(mapvislayer);

    //mapvis.addControl(new OpenLayers.Control.OverviewMap());
    mapvis.addControl(new OpenLayers.Control.Navigation());
    mapvis.addControl(new OpenLayers.Control.PanZoomBar());

    mapvis.events.register('moveend', mapvis, showProxyList);
    //mapvis.events.register('zoomend', null, filterProxies);

    centerMapTo(defaultLon, defaultLat, 6);

    if (proxycreationmode == "standalone")
    {
        proxycreationmode = "";
        showSelStandalone();
    }
    else if (proxycreationmode == "proxy")
    {
        proxycreationmode = "";
        showSelProxy();
    }
    else
    {
        showSelProxy();
    }

    populateOwners();


}

function populateOwners()
{

    var urlstring = "/fwp/fed/owners";

    $.ajax ({
        url: urlstring,
        async: true,
        success: function(data) {
            $("#fed_providers").empty();

            console.log("Providers request");
            console.log(data);
            try
            {
                for (var i in data)
                {
                    $("#fed_providers").append('<option value="'+data[i]+'">')
                }
            }
            catch (err)
            {
                console.log(err);
            }
        }
    });
}


function showSelProxy ()
{

    if (proxycreationmode == "proxy")
    {
        return;
    }

    hideCreationTabQuick();


    proxycreationmode = "proxy";
    $("#tabsel_standalone").addClass("unseltab");
    $("#tabsel_proxy").removeClass("unseltab");

    $("#controls_standalone").hide();
    $("#controls_proxy").show();

    $(".proxytype_local").hide();

    $(".proxytype_query").show();
    $(".proxytype_read").show();
    $(".proxytype_write").show();


}

function showSelStandalone()
{

    if (proxycreationmode == "standalone")
    {
        return;
    }

    hideCreationTabQuick();

    proxycreationmode = "standalone";
    $("#tabsel_standalone").removeClass("unseltab");
    $("#tabsel_proxy").addClass("unseltab");

    $("#controls_standalone").show();
    $("#controls_proxy").hide();

    $(".proxytype_local").show();

    $(".proxytype_query").hide();
    $(".proxytype_read").hide();
    $(".proxytype_write").hide();


}

function hideCreationTabQuick()
{

    if (creationmode)
    {
        backToMaps();
    }


}

function centerMapTo (lon, lat, zoom)
{
    var lonlat = new OpenLayers.LonLat (lon, lat);
    var projected = lonlat.transform (new OpenLayers.Projection(proj_WGS84), mapvis.getProjectionObject());

    mapvis.setCenter(projected, zoom);
}

function reprojPoint (pointX, pointY)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(new OpenLayers.Projection(proj_WGS84), mapvis.getProjectionObject());

    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}

function buildProxyList ()
{

    console.log("PROXY LIST: "+JSON.stringify(proxies));
    // Takes the global var proxies and creates the full proxy listing in the side bar
    proxynames = new Array();
    $("#proxylisting").empty();

    for (var proxy_id in proxies)
    {
        // TODO: placeholders, beautify
        var entry_name = proxies[proxy_id]['name'];

        proxynames.push(entry_name);

        var entry_area = "";
        for (var b in proxies[proxy_id]['area'])
        {
            entry_area += proxies[proxy_id]['area'][b].toFixed(5)+" ";
        }


        var entry_time = proxies[proxy_id]['time'][0];
        if (proxies[proxy_id]['time'].length == 2)
        {
            entry_time += " - "+proxies[proxy_id]['time'][1];
        }
        else
        {
            entry_time += " - ";
        }


        var proxyclass = "proxytype_"+proxies[proxy_id]['type'];


        var proxyentry = '<div class="nav_entry '+proxyclass+'" id="proxies_'+proxy_id+'"><a href="/fwp/proxy/'+proxy_id+'">'+entry_name +'</a><br>'+entry_area+'<br>'+entry_time+'</div>';
        $("#proxylisting").append(proxyentry);

    }

    //alert(proxynames);

    $(".nav_entry").unbind();

    /*
    On hover, the map shows the area of the currently hovered proxy description, and removes it when leaving
     */
    $(".nav_entry").hover(showProxyArea, hideProxyArea);

    $("#proxy_create_new").click(openProxyCreation);
    $("#standalone_create_new").click(openProxyCreation);



}

function openProxyCreation()
{
    $("#proxymap").hide();
    $("#proxybuilder").removeClass("inhiding");
    $("#proxybuilder").show();
    create_initForm();
}


function showProxyArea()
{

    /*
    Draws the currently hovered proxy on the map
     */

    var prefix = "proxies_";
    var proxy_id = this.id.substr(prefix.length);

    var bbox = proxies[proxy_id]['area'];

    var points = [
            reprojPoint(bbox[0], bbox[1]),
            reprojPoint(bbox[2], bbox[1]),
            reprojPoint(bbox[2], bbox[3]),
            reprojPoint(bbox[0], bbox[3])
    ];
    var ring = new OpenLayers.Geometry.LinearRing(points);
    var polygon = new OpenLayers.Geometry.Polygon([ring]);

    var feature = new OpenLayers.Feature.Vector(polygon, {});

    //alert(bbox);


    mapvislayer.addFeatures([feature]);

}

function hideProxyArea()
{

    /*
     Cleans up the proxy bb drawn on the map
     */

    mapvislayer.removeAllFeatures();

}


function showProxyList ()
{


    // Should hide all entries and show only those with a bounding box compliant with the current visible area.

    //$(".nav_entry").hide();

    // changed to different classes for visible and invisible proxies

    $(".nav_entry").addClass("offmap");

    var bbox = mapvis.getExtent().transform (mapvis.getProjectionObject(), new OpenLayers.Projection(proj_WGS84)).toArray();


    //alert (typeof(bbox[0]));

    for (var proxy_id in proxies)
    {
        var pbox = proxies[proxy_id]['area'];

        //if (pbox[0] >= bbox[0] && pbox[1] >= bbox[1] && pbox[2] <= bbox [2] && pbox[3] <= bbox[3])
        if ((pbox [0] < bbox [2] && pbox[2] > bbox[0]) && (pbox[1] < bbox[3] && pbox[3] > pbox[1]))
        {

            // proxy accepted

            $(".nav_entry#proxies_"+proxy_id).removeClass("offmap");
            //alert("Can show "+proxy_id+"\n"+pbox+"\nvs\n"+bbox);
        }
        else
        {
            //alert ("Must hide "+proxy_id+"\n"+pbox+"\nvs\n"+bbox);
        }
    }


}