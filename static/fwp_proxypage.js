/**
 * Created with PyCharm.
 * User: drake
 * Date: 6/13/12
 * Time: 9:14 AM
 * To change this template use File | Settings | File Templates.
 */

var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var proxy_id;
var manifest;

var minimap;


var proxymap;
var proxymap_metalayer;
var proxymap_selectlayer;

function pageInit(req_id, req_manifest)
{

    proxy_id = req_id;
    manifest = req_manifest;

    // checking if not a query proxy
    if (manifest['operations']['query']['time'] == 'none' &&
        manifest['operations']['query']['geographic'] == 'none' &&
        manifest['operations']['query']['bi'] == 'none' &&
        manifest['operations']['query']['inventory'] == 'none')
    {
        console.log("Creating access for standalone");
        $('<div class="button wide" id="proxy_standalone"><a href="/fwst/'+proxy_id+'">Area Standalone</a></div>').insertAfter("#minimap");
    }

    //alert(JSON.stringify(manifest['metadata']));

    //TODO: import theme to local and replace this after DEMO (or before?)
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    minimap= new OpenLayers.Map('minimap', {controls: []});
    minimap.projection = proj_WGS84;
    minimap.displayProjection = new OpenLayers.Projection(proj_WGS84);


    var layer = new OpenLayers.Layer.OSM();

    minimap.addLayer(layer);

    //mapvis.addControl(new OpenLayers.Control.OverviewMap());


    //mapvis.events.register('moveend', mapvis, showProxyList);
    //mapvis.events.register('zoomend', null, filterProxies);


    var bbox = (manifest['area']);
    zoomToBBox(minimap, bbox);


    buildProxyMap();
    renderMetaData();





}

function renderMetaData()
{


    for (var i = 0; i < manifest['metadata'].length; i++)
    {
        //alert(JSON.stringify(manifest['metadata'][i]));

        // creating the text entry, which will then be bound to the highlight of the polygon on the map

        var meta_id =  manifest['metadata'][i]['name'];

        var meta_bb = manifest['metadata'][i]['area'];
        if (meta_bb.length != 4)
        {
            meta_bb = manifest['area'];
        }

        var bbstring = "";
        for (var b in meta_bb)
        {
            bbstring += meta_bb[b].toFixed(5)+" ";
        }


        var meta_time = manifest['metadata'][i]['time'];
        if (meta_time[0] == "")
        {
            meta_time[0] = manifest['time'][0];
        }
        if (meta_time[1] == "")
        {
            meta_time[1] = manifest['time'][1];
        }

        var timestring = meta_time[0] + " - " + meta_time[1];



        var metastring = '<div class="metadesc" id="meta_'+i+'"><a href="/fwp/proxy/'+proxy_id+'/'+meta_id+'/">'+meta_id+'</a><br>'+bbstring+'<br>'+timestring+'</div>';

        $("#metalisting").append(metastring);

        // drawing the bb on the map
        var points = [
            reprojPoint(meta_bb[0], meta_bb[1], proxymap),
            reprojPoint(meta_bb[2], meta_bb[1], proxymap),
            reprojPoint(meta_bb[2], meta_bb[3], proxymap),
            reprojPoint(meta_bb[0], meta_bb[3], proxymap)
        ];
        var ring = new OpenLayers.Geometry.LinearRing(points);
        var polygon = new OpenLayers.Geometry.Polygon([ring]);
        var feature = new OpenLayers.Feature.Vector(polygon, {});

        //alert(bbox);


        proxymap_metalayer.addFeatures([feature]);

        $(".metadesc").hover(showSelArea, hideSelArea);

    }

}

function bboxToFeature (bbox, olmap)
{

    var points = [
        reprojPoint(bbox[0], bbox[1], olmap),
        reprojPoint(bbox[2], bbox[1], olmap),
        reprojPoint(bbox[2], bbox[3], olmap),
        reprojPoint(bbox[0], bbox[3], olmap)
    ];
    var ring = new OpenLayers.Geometry.LinearRing(points);
    var polygon = new OpenLayers.Geometry.Polygon([ring]);

    return new OpenLayers.Feature.Vector(polygon, {});
}

function showSelArea ()
{

    //proxymap_metalayer.setVisibility(false);

    var prefix = "meta_";
    var meta_i = parseInt(this.id.substr(prefix.length));

    var meta_bb = manifest['metadata'][meta_i]['area'];
    if (meta_bb.length != 4)
    {
        meta_bb = manifest['area'];
    }

    var feature = bboxToFeature(meta_bb, proxymap);
    proxymap_selectlayer.removeAllFeatures();
    proxymap_selectlayer.addFeatures([feature]);
}

function hideSelArea ()
{
    proxymap_selectlayer.removeAllFeatures();
    //proxymap_metalayer.setVisibility(true);

}


function buildProxyMap ()
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

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_selectlayer = new OpenLayers.Layer.Vector("Selection", {styleMap: featurestylemap});
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

