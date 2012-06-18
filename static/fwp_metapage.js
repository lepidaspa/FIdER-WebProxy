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
var shapes;
var shapedata;
var manifest;
var proxy_type;

var minimap;

var proxymap;

var proxymap_currentlayer;
var proxymap_pastlayer;
var proxymap_selectlayer;

// describes which map (by index) is being highlighted, reverts to NaN when unfocused
var focused = NaN;
// same, for upload masks
var uploading = NaN;

// the table holding the translation schema being created by the user
var convtable;
// the fields in the properties of the original file
var convsource;
// the model received from the main server
var convmodel;
var convmodelcats;

// id of the map item being worked on in the sidebar, needed to keep state with the bindings
var currentmap;

function pageInit(req_proxy_id, req_meta_id, req_proxy_type, req_manifest, req_maps)
{

    $("#renderingstate").hide();
    $("#loadingstate").hide();

    proxy_id = req_proxy_id;
    meta_id = req_meta_id;
    manifest = req_manifest;
    proxy_type = req_proxy_type;

    shapes = jQuery.parseJSON(req_maps);

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

    $("#newmap_shapefile").click(renderNewShapeMask);
    $("#newmap_wfs").click(renderNewWFSMask);

}





function renderMaps()
{

    setLoadingState();
    shapedata = new Array();

    //todo: handle errors

    for (var i = 0; i < shapes.length; i++)
    {

        $.ajax({
            url: "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+shapes[i],
            async: true
        }).done(function (jsondata) {
                    shapedata.push(jsondata);
                    checkShapesLoadingState();
        });
    }

}

function checkShapesLoadingState()
{
    if (shapedata.length == shapes.length)
    {
        unsetLoadingState();
    }
}

function setLoadingState()
{

    // shows the loading message in an additional front layer
    //featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 1, strokeDashstyle: "solid"});
    //featurestylemap = new OpenLayers.StyleMap(featurestyle);
    $("#loadingstate").show();

    proxymap_currentlayer.removeAllFeatures();
}

function unsetLoadingState()
{
    //alert("Rendering "+shapes.length+" shapes");

    $("#loadingstate").hide();

    // renders the maps
    for (var i = 0; i < shapedata.length; i++)
    {
        renderGeoJSON (shapedata[i], proxymap, proxymap_currentlayer);
        renderMapCard (i);
        //alert("Rendered "+shapes[i]);
    }


    $(".btn_focus").unbind();
    $(".btn_focus").click(focusSelMap);


    $(".btn_uploadfile").unbind();
    $(".btn_uploadfile").click(renderUploadFileMask);
    $(".btn_uploadwfs").unbind();
    $(".btn_uploadwfs").click(renderUploadWFSMask);
    $(".btn_convert").unbind();
    $(".btn_convert").click(renderTranslationMask);
    $(".btn_remove").unbind();
    $(".btn_remove").click(renderRemoverMask);

    // activates map controls, removes the front layer
    proxymap.addControl(new OpenLayers.Control.Navigation());
    proxymap.addControl(new OpenLayers.Control.PanZoomBar());



}

function focusSelMap()
{


    $("#renderingstate").show();



    var prefix = "btn_focus_";
    var i = parseInt(this.id.substr(prefix.length));

    if ((focused == NaN) || (focused != i))
    {
        proxymap_selectlayer.removeAllFeatures();

        focused = i;

        renderGeoJSON(shapedata[i], proxymap, proxymap_selectlayer);

    }
    else
    {
        proxymap_selectlayer.removeAllFeatures();
        focused = NaN;

    }

    $("#renderingstate").hide();

}



function renderMapCard (map_id)
{

    var mapname = shapes[map_id];

    var mapfeatures = shapedata[map_id]['features'].length;
    var maplines = 0;
    var mappoints = 0;

    for (var i = 0; i < mapfeatures; i++)
    {
        var ctype = shapedata[map_id]['features'][i]['geometry']['type'];
        if ((ctype == 'LineString') || (ctype == 'MultiLineString'))
        {
            maplines++;
        }
        else if ((ctype == 'Point') || (ctype == 'MultiPoint'))
        {
            mappoints++;
        }
    }

    var statsstring = '<div class="mapstats"><span class="mapname">'+mapname+'</span><br>Elementi: '+mapfeatures+'<br>('+
            maplines + ' tratte/' +
            mappoints + ' accessi)</div>';

    var str_btn_focus = '<img alt="Evidenzia/Nascondi" class="btn_focus" id="btn_focus_'+map_id+'" src="/static/resource/fwp_focus.png">';
    var str_btn_uploadfile = '<img alt="Aggiorna da shapefile" class="btn_uploadfile" id="btn_uploadfile_'+map_id+'" src="/static/resource/fwp_uploadfile.png">';
    var str_btn_uploadwfs = '<img alt="Aggiorna da WFS" class="btn_uploadwfs" id="btn_uploadwfs_'+map_id+'" src="/static/resource/fwp_uploadwfs.png">';
    var str_btn_convert = '<img alt="Proprietà" class="btn_convert" id="btn_convert_'+map_id+'" src="/static/resource/fwp_convert.png">';
    var str_btn_remove = '<img alt="Elimina" class="btn_remove" id="btn_remove_'+map_id+'" src="/static/resource/fwp_remove.png">';

    var mapactions = '<div class="mapactions">'+str_btn_focus+' '+str_btn_convert+'<br>'+str_btn_uploadfile+' '+str_btn_uploadwfs+'<br>'+str_btn_remove+'</div>';

    var mapcardstring = '<div class="mapcard" id="map_'+map_id+'">'+mapactions+statsstring+'</div>';

    $("#maplisting").append(mapcardstring);




}


function renderNewWFSMask()
{
    closeAllMasks();

    var uploadstring = '<div class="uploadwfsmask maskwidget" id="uploadwfs_new">' +
            'http://<input type="text" id="mapsub" name="mapsub">' +
            '<br><input type="button" value="Carica">'+
            '</div>';

    $("#proxy_addmap").append(uploadstring);
}

function renderNewShapeMask ()
{
    closeAllMasks();

    var uploadstring = '<div class="uploadfilemask maskwidget" id="uploadfile_new">' +
            '<input type="file" id="mapsub" name="mapsub">' +
            '</div>';

    $("#proxy_addmap").append(uploadstring);
}

function renderUploadFileMask()
{

    var prefix = "btn_uploadfile_";
    var i = parseInt(this.id.substr(prefix.length));

    closeAllMasks();

    var uploadstring = '<div class="uploadfilemask maskwidget" id="uploadfile_'+i+'">' +
            '<input type="file" id="mapsub" name="mapsub">' +
            '</div>';

    $("#map_"+i).append(uploadstring);

}

function renderUploadWFSMask()
{

    var prefix = "btn_uploadwfs_";
    var i = parseInt(this.id.substr(prefix.length));


    closeAllMasks();


    var uploadstring = '<div class="uploadwfsmask maskwidget" id="uploadwfs_'+i+'">' +
            'http://<input type="text" id="mapsub" name="mapsub">' +
            '<br><input type="button" value="Carica">'+
            '</div>';

    $("#map_"+i).append(uploadstring);

}

function renderRemoverMask()
{
    var prefix = "btn_remove_";
    var i = parseInt(this.id.substr(prefix.length));

    closeAllMasks();


    var removestring = '<div class="removemask maskwidget" id="remove_'+i+'">' +
            'Confermi l\'eliminazione della mappa?<br>' +
            '<input type="button" id="btn_confirmdelete_'+i+'" value="Elimina">' +
            '<br>ATTENZIONE: questa azione non può essere annullata.' +
            '</div>';


    $("#map_"+i).append(removestring);
}


function renderTranslationMask ()
{
    // todo: implement pre-compiled table, store values


    var prefix = "btn_convert_";
    var i = parseInt(this.id.substr(prefix.length));

    currentmap = i;

    closeAllMasks();

    var tables;

    $.ajax({
        url: "/fwp/conversion/"+proxy_id+"/"+meta_id+"/"+shapes[i],
        async: false
    }).done(function (jsondata) {

                tables = jsondata;


            });

    //alert(JSON.stringify(tables));

    convtable = tables['shapetable']; // dict
    convsource = tables['shapedata']; // list
    convmodel = tables['conversion']; // dict of category:list

    convmodelcats = new Array();


    var modelcat;
    for (modelcat in convmodel)
    {
        convmodelcats.push(modelcat);
    }
    //alert(JSON.stringify(convmodelcats));

    // selector to choose which kind of infrastructure we are dealing with
    var catselect = '<label for="convtable_catselect">Tipologia</label> <select id="convtable_catselect">';
    for (var c = 0; c < convmodelcats.length; c++)
    {
        catselect += '<option value="'+c+'">'+convmodelcats[c]+'</option>';
    }
    catselect += '</select>';

    // conversion table widget


    var ctwidget= renderTranslationTable();
    var ctsavebutton = '<input type="button" name="saveconversion" id="saveconversion_'+i+'" value="Salva conversione">'

    var ctdiv = '<div class="convtablemask maskwidget" id="convtable_'+i+'">'+ catselect + ctwidget + ctsavebutton +'</div>';

    $("#convtable_table").remove();
    $("#map_"+i).append(ctdiv);

    $("#convtable_catselect").unbind();
    $("#convtable_catselect").change(refreshTranslationTable);

}

function refreshTranslationTable ()
{
    $("#convtable_table").remove();
    var ctwidget= renderTranslationTable();

    $("#convtable_"+currentmap).append(ctwidget);

}




function renderTranslationTable()
{
    // creates the translation table HTML widget according to the selected category
    var selid = $("#convtable_catselect").value;
    if (!selid)
    {
        selid = 0;
    }

    var i;

    // here we create only the options list, not the whole select widget as we need the ID of the original element we are converting
    //alert (selid+" -> "+JSON.stringify(convsource));
    var convopts = '<option value="">Non usato</option>';
    for (i = 0; i < convmodel[convmodelcats[selid]].length; i++)
    {
        convopts += '<option value="'+convmodel[convmodelcats[selid]][i]+'">'+convmodel[convmodelcats[selid]][i]+'</option>';
    }

    var tablestr = '<table id="convtable_table">';



    for (i = 0; i < convsource.length; i++)
    {
        tablestr += '<tr><td>' +
                convsource[i] +
                '</td><td>' +
                '<select id="mapping_"'+i+'>' +
                convopts +
                '</select></td></tr>';
    }
    tablestr += '</table>';


    return tablestr;



}

function closeAllMasks()
{
    /*
    Closes all upload/convert/confirmation masks currently open
     */

    $(".maskwidget").remove();

    /*
    $(".uploadfilemask").remove();
    $(".uploadwfsmask").remove();
    $(".convtablemask").remove();
    $(".removemask").remove();
    */
}

function renderGeoJSON (shapedata, map, maplayer)
{

    //$("#renderingstate").show();


    var geojson_format = new OpenLayers.Format.GeoJSON({'externalProjection':new OpenLayers.Projection(proj_WGS84), 'internalProjection':map.getProjectionObject()});

    var stringmap = JSON.stringify(shapedata);
    var formatmap = geojson_format.read(stringmap);
    maplayer.addFeatures(formatmap);

    //$("#renderingstate").hide();

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

    /*
    // this layer is used to display maps with temporal extension ending before current date (NOTE: not actually used at meta display since the dates are always the same for all maps)
    var featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#cccccc", strokeColor: "#cccccc", strokeWidth: 1, strokeDashstyle: "solid"});
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_pastlayer = new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_pastlayer);
    */

    // this layer is used to display
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_currentlayer = new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_currentlayer);


    // this layer is used to display the selected map
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_selectlayer = new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_selectlayer);


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