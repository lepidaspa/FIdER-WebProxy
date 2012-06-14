/**
 * Created with PyCharm.
 * User: drake
 * Date: 6/14/12
 * Time: 3:05 PM
 * To change this template use File | Settings | File Templates.
 */

var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var proxy_id;
var meta_id;
var manifest;
var proxy_type;

var minimap;

var proxymap;
var proxymap_currentlayer;
var proxymap_pastlayer;
var proxymap_selectlayer;

function pageInit(req_proxy_id, req_meta_id, req_proxy_type, req_manifest)
{

    proxy_id = req_proxy_id;
    meta_id = req_meta_id;
    manifest = req_manifest;
    proxy_type = req_proxy_type;

    //alert(JSON.stringify(manifest['metadata']));

    //TODO: import theme to local and replace this after DEMO (or before?)
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    minimap = new OpenLayers.Map('minimap', {controls: []});
    minimap.projection = proj_WGS84;
    minimap.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var layer = new OpenLayers.Layer.OSM();

    minimap.addLayer(layer);

    //mapvis.addControl(new OpenLayers.Control.OverviewMap());

    //mapvis.events.register('moveend', mapvis, showProxyList);
    //mapvis.events.register('zoomend', null, filterProxies);

    var bbox = (manifest['area']);
    zoomToBBox(minimap, bbox);

    buildMetaMap();

    if (proxy_type != 'query')
    {
        renderMaps();
    }
    else
    {
        renderQuery();
    }


}

function renderMaps()
{

    setLoadingState();

}

function setLoadingState()
{
    // disables the map, shows the loading message in the front

    $("#loadingstate").show();
}


function renderQuery()
{
    alert("PLACEHOLDER");
}


function buildMetaMap()
{


    proxymap = new OpenLayers.Map('proxymap', {controls: []});
    proxymap.projection = proj_WGS84;
    proxymap.displayProjection = new OpenLayers.Projection(proj_WGS84);
    var layer = new OpenLayers.Layer.OSM();

    proxymap.addLayer(layer);
    var bbox = (manifest['area']);
    zoomToBBox(proxymap, bbox);

    var featurestyle = new OpenLayers.Style ({fillOpacity: 0.2, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 1, strokeDashstyle: "dash"});
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_metalayer = new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_metalayer);

    var selectstyle = new OpenLayers.Style ({fillOpacity: "0.2", fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 1});
    var selectstylemap = new OpenLayers.StyleMap (selectstyle);
    proxymap_selectlayer = new OpenLayers.Layer.Vector("Selection", {styleMap: selectstylemap});
    proxymap.addLayer(proxymap_selectlayer);

    proxymap.addControl(new OpenLayers.Control.Navigation());
    proxymap.addControl(new OpenLayers.Control.PanZoomBar());
}


function zoomToBBox (olmap, bbox)
{
    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());
    olmap.zoomToExtent (bounds, true);


}


function reprojPoint (pointX, pointY, olmap)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());


    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}