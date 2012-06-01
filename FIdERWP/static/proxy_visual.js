/**
 * Created with PyCharm.
 * User: drake
 * Date: 6/1/12
 * Time: 10:41 AM
 * To change this template use File | Settings | File Templates.
 */

var list_proxy;
var list_meta;
var list_shape;

var bb_proxy;
var bb_meta;

var mapvis;
var mapvislayer = null;

var defaultLon = 11.1;
var defaultLat = 44.5;
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

function pageInit()
{

    //TODO: import theme to local and replace this after DEMO (or before?)
    OpenLayers.ImgPath = "https://github.com/sirmmo/openlayers_themes/raw/master/dark/";

    mapvis = new OpenLayers.Map('proxymap');

    var layer = new OpenLayers.Layer.OSM();

    mapvis.addLayer(layer);
    centerMapTo(defaultLon, defaultLat, 9);

    rebuildFilters();

}

function populateBB (proxyBBjson, metaBBjson)
{
    //bb_proxy = JSON.parse(proxyBBjson);
    bb_proxy = proxyBBjson;
    bb_meta = metaBBjson;
}


function centerMapTo (lon, lat, zoom)
{
    var lonlat = new OpenLayers.LonLat (lon, lat);
    var projected = lonlat.transform( new OpenLayers.Projection(proj_WGS84), mapvis.getProjectionObject());

    mapvis.setCenter(projected, zoom);

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
        var meta_id = group [1];

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
    $("#sel_proxy").change(updateMapWithProxy);
    $("#sel_meta").change(updateMapWithMeta);
    $("#sel_shape").change(updateMapWithShape);

    $("#sel_meta").attr("disabled", true);
    $("#sel_shape").attr("disabled", true);


}

function updateMapWithProxy ()
{
    //TODO: placeholder, implement
    var i;
    var meta_id;

    $("#sel_meta :[class!=nullopt]").remove();
    var proxy_id = $("#sel_proxy").val();
    for (i in list_meta[proxy_id])
    {
        meta_id = list_meta[proxy_id][i];
        $("#sel_meta").append('<option value="'+meta_id+'">'+meta_id+'</option>');
    }

    $("#sel_meta").removeAttr("disabled");
    $("#sel_shape").attr("disabled", true);

    //TODO: reset bounding box on map according to selection
    resetMapBB(bb_proxy[proxy_id]);

}

function updateMapWithMeta ()
{
    //TODO: placeholder, implement
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

    //TODO: reset bounding box on map according to selection
    resetMapBB(bb_meta[proxy_id][meta_id]);

}

function updateMapWithShape ()
{
    //TODO: placeholder, implement

    //TODO: reset bounding box on meta/proxy and draw map elements

    var proxy_id = $("#sel_proxy").val();
    var meta_id = $("#sel_meta").val();
    var shape_id = $("#sel_shape").val();
    resetMapBB(bb_meta[proxy_id][meta_id]);

    //todo: load and DRAW map features
    $.ajax({
        url: "/proxy/maps/"+proxy_id+"/"+meta_id+"/"+shape_id,
        async: false
    }).done(function (jsondata) {
            drawToMap( jsondata )
        });


}

function drawToMap (mapjson)
{
    /*var featurecoll = mapjson;
    alert("Drawing "+featurecoll);*/

    if (mapvislayer != null)
    {
        mapvislayer.destroy();
    }

    var geojson_format = new OpenLayers.Format.GeoJSON({'externalProjection':new OpenLayers.Projection(proj_WGS84), 'internalProjection':mapvis.getProjectionObject()});
    mapvislayer = new OpenLayers.Layer.Vector();
    mapvis.addLayer(mapvislayer);

    var stringmap = JSON.stringify(mapjson);
    //alert(stringmap);
    var formatmap = geojson_format.read(stringmap);
    mapvislayer.addFeatures(formatmap);




}

function resetMapBB (bb_array)
{
    //TODO: placeholder, implement

    //alert("Reboxing to "+bb_array[0]+", "+bb_array[1]+", "+bb_array[2]+", "+bb_array[3]);

    var bbox = new OpenLayers.Bounds (bb_array[0], bb_array[1], bb_array[2], bb_array[3]);
    var bbox_proj = bbox.transform( new OpenLayers.Projection(proj_WGS84), mapvis.getProjectionObject());

    mapvis.zoomToExtent(bbox_proj, true);

}

