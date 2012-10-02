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
var maps_st;
var shapedata;
var manifest;
var proxy_type;

var maptypes = {};

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

var maps_remote;

// if the proxy is a linked proxy
var islinked;

// models provided by the main server for conversion; they are loaded at the start and "follow" until the user reloads. If there are no models, some functions will be disabled
var models;

function pageInit(req_proxy_id, req_meta_id, req_manifest, req_maps, req_remote, req_maps_st, req_islinked)
{

    proxy_id = req_proxy_id;
    meta_id = req_meta_id;
    manifest = req_manifest;

    islinked = req_islinked;
    console.log("This proxy is linked? "+islinked);

    console.log("Opening metadata "+meta_id);

    if (meta_id != '.st')
    {
        console.log(JSON.parse(req_remote));
        maps_remote = JSON.parse(req_remote);
    }
    else
    {
        maps_remote = [];
    }

    $("#conversion").hide();
    $("#renderingstate").hide();
    $("#loadingstate").hide();
    $("#serverstate").hide();
    $("#currentops").hide();
    $("#btn_reload").hide();
    $("#proxy_addmap").hide();

    $("#btn_reloadremote").hide();
    $("#progspinner").hide();



    proxy_type = getProxyType(manifest);

    if (proxy_type == "read" || proxy_type == "write" || proxy_type == "query")
    {
        $("#newmap_st").remove();
    }

    if (meta_id == '.st')
    {
        $("#proxy_addmap").remove();
    }

    maps_st = jQuery.parseJSON(req_maps_st);
    if (meta_id == '.st')
    {
        console.log("Has "+maps_st.length+" archived maps");
        shapes = maps_st;


    }
    else
    {
        shapes = jQuery.parseJSON(req_maps);
    }
    //console.log("Maps from standalone: "+JSON.stringify(maps_st)+"\nfrom");
    //console.log(req_maps_st);

    //alert(JSON.stringify(manifest['metadata']));

    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    minimap = new OpenLayers.Map('minimap', {controls: []});
    minimap.projection = proj_WGS84;
    minimap.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var layer = new OpenLayers.Layer.OSM();

    minimap.addLayer(layer);

    //mapvis.addControl(new OpenLayers.Control.OverviewMap());

    //mapvis.events.register('moveend', mapvis, showProxyList);
    //mapvis.events.register('zoomend', null, filterProxies);

    var cmeta = -1;
    for (var i = 0; i < manifest['metadata'].length; i++)
    {
        if (manifest['metadata'][i]['name'] == meta_id)
        {
            cmeta = i;
            break;
        }
    }

    console.log("Bounding box preset to current proxy");
    var bbox = manifest['area'];
    console.log(bbox);
    if (cmeta != -1)
    {
        console.log("Setting bounding box to current meta");
        bbox = manifest['metadata'][i]['area'];
        console.log(bbox);
    }


    buildMetaMap();

    renderMaps();

    zoomToBBox(minimap, bbox);
    zoomToBBox(proxymap, bbox);


    $("#confirmuploadfile").live('click', uploadFromFile);
    $("#confirmuploadwfs").live('click', uploadFromWeb);
    $("#confirmsideloadST").live('click', sideloadFromST);
    $(".btn_confirmdelete").live('click', deleteMap);
    $(".btn_refreshremote").live('click', refreshRemoteResource);
    $("#newmap_chooserST").live('change', verifySTselect);

    $("#newmap_shapefile").click(renderNewShapeMask);
    $("#newmap_wfs").click(renderNewWFSMask);
    $("#newmap_st").click(renderNewSTMask);


    $(".btn_focus").live('click', focusSelMap);
    $(".btn_uploadfile").live('click', renderUploadFileMask);
    $(".btn_uploadwfs").live('click', renderUploadWFSMask);
    $(".btn_convert").live('click', renderConvMask);
    $(".btn_remove").live('click', renderRemoverMask);


}

function registerModels (req_models)
{
    if (!req_models || jQuery.isEmptyObject(req_models))
    {
        $(".btn_convert").unbind();
        $(".btn_convert").hide();
        postFeedbackMessage(false, "Nessun modello disponibile. La funzione di traduzione di modelli e valori non è attiva.<br><a class='reloadbutton' href='#'>Ricarica</a>", "#proxy_addmap");
        models = null;

        return;
    }

    models = req_models;

}


function verifySTselect ()
{
    if ($("#newmap_chooserST").val() != "")
    {
        $("#confirmsideloadST").prop('disabled', false);
    }
    else
    {
        $("#confirmsideloadST").prop('disabled', true);
    }
}

function getProxyType (manifest)
{

    //console.log("Checking proxy type");
    //console.log(manifest['operations']);

    if (manifest['operations']['read'] != 'none')
    {
        return 'read';
    }
    else if (manifest['operations']['write'] != 'none')
    {
        return 'write';
    }
    else if (manifest['operations']['query']['time'] != 'none' ||
        manifest['operations']['query']['geographic'] != 'none' ||
        manifest['operations']['query']['bi'] != 'none' ||
        manifest['operations']['query']['inventory'] != 'none')
    {
        return 'query';
    }
    else
    {
        return 'local';
    }

}



function renderMaps()
{

    setLoadingState();
    shapedata = new Array();

    console.log("Loading maps from proxy");
    console.log(shapes);

    var baseurl = "";
    if (meta_id != '.st')
    {
        baseurl = "/fwp/maps/"+proxy_id+"/"+meta_id+"/";
    }
    else
    {
        baseurl = "/fwst/maps/"+proxy_id+"/";
    }

    if (shapes.length > 0)
    {

        var urlstring = baseurl + shapes[i];

        for (var i = 0; i < shapes.length; i++)
        {

            $.ajax({
                url: baseurl+shapes[i]+"/",
                async: true
            }).done(function (jsondata) {
                        var shapename = jsondata['id'];
                        console.log("Downloaded map "+shapename);
                        var map_id = shapes.indexOf(shapename);
                        shapedata[map_id] = jsondata;
                        //shapedata.push(jsondata);
                        checkShapesLoadingState();
            });
        }
    }
    else
    {
        checkShapesLoadingState();
    }

}



function checkShapesLoadingState()
{

    console.log("Checking for end of map loading");
    console.log("("+shapedata.length+"/"+shapes.length+")");
    if (shapedata.length == shapes.length)
    {
        console.log("Finished loading maps");
        for (var mapkey in shapes)
        {
            console.log("Loaded map "+shapes[mapkey]);
        }
        unsetLoadingState();
        $("#proxy_addmap").show();
    }
}

function setLoadingState()
{

    // shows the loading message in an additional front layer
    //featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 1, strokeDashstyle: "solid"});
    //featurestylemap = new OpenLayers.StyleMap(featurestyle);
    $("#loadingstate").show();
    $("#progspinner").show();

    proxymap_currentlayer.removeAllFeatures();
}

function unsetLoadingState()
{
    //alert("Rendering "+shapes.length+" shapes");

    $("#loadingstate").hide();


    // renders the maps
    for (var i = 0; i < shapedata.length; i++)
    {
        console.log("Rendering map "+shapes[i]);
        renderGeoJSON (shapedata[i], proxymap, proxymap_currentlayer);

        renderMapCard (i);
        //alert("Rendered "+shapes[i]);
    }


    $("#progspinner").hide();

    /*

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

    */

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
            if (!maptypes[map_id])
            {
                maptypes[map_id] = "LineString";
            }
            maplines++;
        }
        else if ((ctype == 'Point') || (ctype == 'MultiPoint'))
        {
            if (!maptypes[map_id])
            {
                maptypes[map_id] = "Point";
            }
            mappoints++;
        }
    }


    var str_btn_refresh="";
    var originstring = "";
    if (maps_remote.indexOf(mapname) != -1)
    {

        originstring = "WFS";
        console.log("Refreshable map: "+mapname);
        str_btn_refresh = '<img title="Aggiorna risorsa WFS" class="btn_refreshremote btn_inline" id="btn_refreshremote_'+map_id+'" src="/static/resource/fwp_reload.png">';
    }
    else
    {
        originstring = "Locale";
        console.log("Static map: "+mapname);
    }

    var featurestring;
    if (maplines > 0)
    {
        featurestring = ''+maplines+" tratte";
    }
    else if (mappoints > 0)
    {
        featurestring = ''+mappoints+" nodi";
    }
    var statsstring = '<div class="mapstats"><span class="mapname">'+mapname+'</span> '+str_btn_refresh+'<br>'+originstring+': '+featurestring+'</div>';


    var str_btn_focus = '<img title="Evidenzia/Nascondi" class="btn_focus" id="btn_focus_'+map_id+'" src="/static/resource/fwp_focus.png">';

    var str_btn_uploadfile = "";
    var str_btn_uploadwfs = "";



    if (meta_id != ".st" && !islinked)
    {
        str_btn_uploadfile = '<img title="Carica da file" class="btn_uploadfile" id="btn_uploadfile_'+map_id+'" src="/static/resource/fwp_uploadfile.png">';
        str_btn_uploadwfs = '<img title="Carica da WFS" class="btn_uploadwfs" id="btn_uploadwfs_'+map_id+'" src="/static/resource/fwp_uploadwfs.png">';
    }

    var str_btn_convert = "";
    if (proxy_type != 'local' && models != null)
    {
        // conversions are used for federation processes, so we do not need them on standalone proxies
        str_btn_convert = '<img title="Proprietà" class="btn_convert" id="btn_convert_'+map_id+'" src="/static/resource/fwp_convert.png">';
    }

    var str_btn_remove = "";
    if (!islinked)
    {
        str_btn_remove = '<img title="Elimina" class="btn_remove" id="btn_remove_'+map_id+'" src="/static/resource/fwp_remove.png">';
    }



    var str_btn_edit = "";
    if (proxy_type == 'local')
    {
        var editlink = "/fwst/"+proxy_id+"/"+meta_id+"/"+shapes[map_id]+"/";
        str_btn_edit = '<a href="'+editlink+'"><img title="Modifica" class="btn_edit" id="btn_edit_'+map_id+'" src="/static/resource/fwp_editmap.png"></a>';
    }


    var mapactions = '<div class="mapactions">'+str_btn_focus+' '+str_btn_convert+'<br>'+str_btn_uploadfile+' '+str_btn_uploadwfs+'<br>'+str_btn_edit+' '+str_btn_remove+'</div>';

    var mapcardstring = '<div class="mapcard" id="map_'+map_id+'">'+mapactions+statsstring+'</div>';

    $("#maplisting").append(mapcardstring);




}


function renderNewWFSMask()
{
    closeAllMasks();


    var uploadtable = '<table class="uploadwfsmask maskwidget" id="uploadwfs_new">' +
            '<tr><td>URL</td><td><input type="text" id="mapsub" name="mapsub">' +
            '<tr><td>Mappa</td><td><input type="tet" id="wfsmap" name="wfsmap"></td>' +
            '<tr><td>Utente</td><td><input type="text" id="wfsuser" name="wfsuser"></td>' +
            '<tr><td>Password</td><td><input type="password" id="wfspass" name="wfspass"></td>' +
            '<tr><td colspan=2><input type="button" id="confirmuploadwfs" value="Carica"></td></tr>'+
            '</table>';


    $("#proxy_addmap").append(uploadtable);
}

function renderNewSTMask ()
{
    closeAllMasks();

    var chooser = $('<div id="uploadSTMask" class="maskwidget"><select id="newmap_chooserST"><option value=""></option></select></div>');
    for (var i in maps_st)
    {
        chooser.children("#newmap_chooserST").append('<option value="'+maps_st[i]+'">'+maps_st[i]+'</option>');
    }

    chooser.append('<input type="button" id="confirmsideloadST" value="Importa">');

    $("#proxy_addmap").append(chooser);
    verifySTselect();


}


function renderNewShapeMask ()
{
    closeAllMasks();

    var uploadtable = '<table class="uploadfilemask maskwidget" id="uploadfile_new">' +
            '<tr><td><input type="file" id="mapsub" name="mapsub"></td></tr>' +
            '<tr><td colspan=2><input type="button" id="confirmuploadfile" value="Carica"></td></tr>'+
            '</table>';


    $("#proxy_addmap").append(uploadtable);
}

function renderUploadFileMask()
{

    var prefix = "btn_uploadfile_";
    var i = parseInt(this.id.substr(prefix.length));
    currentmap = i;

    closeAllMasks();

    var uploadtable = '<table class="uploadfilemask maskwidget" id="uploadfile_'+i+'">' +
            '<tr><td><input type="file" id="mapsub" name="mapsub"></td></tr>' +
            '<tr><td colspan><input type="button" id="confirmuploadfile" value="Carica"></td></tr>'+
            '</table>';

    $("#map_"+i).append(uploadtable);

}




function renderUploadWFSMask()
{

    var prefix = "btn_uploadwfs_";
    var i = parseInt(this.id.substr(prefix.length));
    currentmap = i;

    closeAllMasks();

    var uploadtable = '<table class="uploadwfsmask maskwidget" id="uploadwfs_'+i+'">' +
            '<tr><td>URL</td><td><input type="text" id="mapsub" name="mapsub">' +
            '<tr><td>Mappa</td><td><input type="tet" id="wfsmap" name="wfsmap"></td>' +
            '<tr><td>Utente</td><td><input type="text" id="wfsuser" name="wfsuser"></td>' +
            '<tr><td>Password</td><td><input type="password" id="wfspass" name="wfspass"></td>' +
            '<tr><td colspan=2><input type="button" id="confirmuploadwfs"  value="Carica"></td></tr>'+
            '</table>';



    $("#map_"+i).append(uploadtable);

}



function uploadFromFile ()
{

    var prefix = "uploadfile_";

    //alert(this.id);
    var form = $("#"+this.id).closest(".uploadfilemask").prop("id");
    var i = form.substr(prefix.length);


    var map_id;
    if (i != "new")
    {
        map_id = parseInt(i);
    }
    else
    {
        map_id = -1;
    }

    //alert(JSON.stringify(this.id)+": "+form);
    //     uploadfilemask            uploadfile_n


    var urlstring = "/fwp/upload/"+proxy_id+"/"+meta_id+"/";
    if (map_id != -1)
    {
        urlstring += shapes[map_id]+"/";
    }

    // and now for some black magic...

    //var xhr = new XMLHttpRequest();
    var fd = new FormData();
    var uploadfilename = $('#mapsub').val();

    fd.append('shapefile', $('#mapsub')[0].files[0]);


    // setting the container on which we'll render the feedback
    var container;
    if (i == 'new')
    {
        container = "#proxy_addmap";
    }
    else
    {
        container = "#map_"+i;
    }

    $("#progspinner").show();

    $.ajax ({
        url: urlstring,
        data:   fd,
        async: true,
        processData:    false,
        contentType:    false,
        type: 'POST',
        success: function(data) {
            //alert ("COMPLETED");
            postFeedbackMessage(data['success'], data['report'], container);
            if (data['success'] == true)
            {

                if (map_id != -1)
                {
                    var torebuild = shapes[map_id];
                }
                else
                {
                    //alert(uploadfilename);
                    var pathels = uploadfilename.replace(/\\/g,"/").split("/");
                    //alert(pathels+"\n***\n"+pathels[pathels.length-1]);
                    torebuild = pathels[pathels.length-1].replace(".zip","").replace(",","");
                }

                rebuildShapeData(torebuild);
            }

        },
        error: function (data)
        {
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container)
        }
    });

}

function refreshRemoteResource()
{


    var prefix = "btn_refreshremote_";

    var form = $("#"+this.id).closest(".btn_refreshremote").prop("id");
    var i = form.substr(prefix.length);

    var map_id = parseInt(i);


    var container = "#map_"+i;


    closeAllMasks();

    var urlstring = '/refreshmap/'+proxy_id+'/'+meta_id+'/'+shapes[map_id];

    $("#progspinner").show();

    $.ajax ({
        url: urlstring,
        async: true,
        type: 'GET',
        success: function(data) {
            //alert ("COMPLETED");
            postFeedbackMessage(data['success'], data['report'], container);
            if (data['success'] == true)
            {

                rebuildShapeData(shapes[map_id]);
            }

        },
        error: function (data)
        {
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container)
        }
    });

}


function uploadFromWeb ()
{


    var prefix = "uploadwfs_";

    //alert(this.id);
    var form = $("#"+this.id).closest(".uploadwfsmask").prop("id");
    var i = form.substr(prefix.length);


    var map_id;
    if (i != "new")
    {
        map_id = parseInt(i);
    }
    else
    {
        map_id = null;
    }

    // setting the container on which we'll render the feedback
    var container;
    if (i == 'new')
    {
        container = "#proxy_addmap";
    }
    else
    {
        container = "#map_"+i;
    }

    var urlstring = "/fwp/download/"+proxy_id+"/"+meta_id+"/";
    if (map_id != null)
    {
        urlstring += shapes[map_id]+"/";
    }



    var wfsparams = {};

    wfsparams['url'] = $("#mapsub").val();
    wfsparams['user'] = $("#wfsuser").val();
    wfsparams['pass'] = $("#wfspass").val();
    wfsparams['layer'] = $("#wfsmap").val();


    $("#progspinner").show();

    //alert (JSON.stringify(wfsparams));



    $.ajax ({
        url: urlstring,
        data: wfsparams,
        async: true,
        type: 'POST',
        success: function(data) {

            postFeedbackMessage(data['success'], data['report'], container);
            if (data['success'] == true)
            {

                rebuildShapeData(shapes[map_id]);
            }

        },
        error: function (data)
        {
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container)
        }
    });


}




function sideloadFromST ()
{



    var requested = $("#newmap_chooserST").val();

    console.log("Sideloading map "+requested);

    if (!requested || requested == "")
    {
        return;
    }



    //TODO: add support for upload to a specific map name other than the original

    var urlstring = "/fwp/stimport/";
    var container = "#proxy_addmap";


    //NOTE: saveto is a placeholder for saving to a different map
    var saveto = requested;
    var params = {
        'proxy_id': proxy_id,
        'meta_id': meta_id,
        'map_id': requested,
        'saveto': saveto
    };

    $("#progspinner").show();

    $.ajax ({
        url:    urlstring,
        data:   params,
        async:  true,
        type:   'POST',
        success: function (data) {
            postFeedbackMessage(data['success'], data['report'], container);

            rebuildShapeData(saveto);

        },
        error:  function (data) {
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container)
        }

    });



}





function rebuildShapeData (shape_id)
{
    // launches an ajax request to the server for re-parsing a map in the upload directory

    $("#serverstate").show();

    //alert(shape_id);

    var urlstring;
    urlstring = "/fwp/rebuild/"+proxy_id+"/"+meta_id+"/"+shape_id+"/";

    var container = "#currentops";

    $("#progspinner").show();

    $.ajax ({
        url:            urlstring,
        async:          true,
        success: function(data) {
            //alert ("COMPLETED");
            postFeedbackMessage(data['success'], data['report'], container);
        },
        error: function (data)
        {
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container)
        }
    });

    $("#currentops").show();
    $("#serverstate").hide();
    $("#btn_reload").show();


}


function renderRemoverMask()
{
    var prefix = "btn_remove_";
    var i = this.id.substr(prefix.length);

    closeAllMasks();


    var removestring = '<div class="removemask maskwidget" id="remove_'+i+'">' +
            'Confermi l\'eliminazione della mappa?<br>' +
            '<input type="button" class="btn_confirmdelete" id="btn_confirmdelete_'+i+'" value="Elimina">' +
            '<br>ATTENZIONE: questa azione non può essere annullata.' +
            '</div>';


    $("#map_"+i).append(removestring);
}

function deleteMap ()
{
    var prefix = "btn_confirmdelete_";
    var i = parseInt(this.id.substr(prefix.length));

    closeAllMasks();

    var container = "#currentops";

    var controldict = {
        'action': 'delete',
        'proxy_id': proxy_id,
        'meta_id': meta_id,
        'shape_id': shapes[i]
    };

    $("#progspinner").show();

    $.ajax({
        url: "/fwp/control/",
        async: true,
        data: controldict,
        type: 'POST',
        success: function(data)
        {
            postFeedbackMessage(data['success'], data['report'], container);
        },
        error: function (data)
        {
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container);
        }
    });

    $("#currentops").show();
    $("#serverstate").hide();
    $("#btn_reload").show();
}


function postFeedbackMessage (success, report, widgetid)
{

    $("#progspinner").hide();

    var status = success;
    var message = report;

    var feedbackclass;
    if (status === true)
    {
        feedbackclass = "success";
    }
    else if (status === false)
    {
        feedbackclass = "fail";
    }

    var feedbackmess = '<div class="feedback '+feedbackclass+'">' +message+ '</div>';

    closeAllMasks();
    $(widgetid).append(feedbackmess);
}


function closeAllMasks()
{
    /*
    Closes all upload/convert/confirmation masks currently open
     */

    $(".maskwidget").remove();
    $(".feedback").remove();
    //$(".statemess").hide();



}

function renderGeoJSON (shapedata, map, maplayer)
{

    /*
    setTimeout(function () {
        $("#renderingstate").show();
    }, 0);
    */


    var geojson_format = new OpenLayers.Format.GeoJSON({'externalProjection':new OpenLayers.Projection(proj_WGS84), 'internalProjection':map.getProjectionObject()});


    /*
    var stringmap = JSON.stringify(shapedata);
    var formatmap = geojson_format.read(stringmap);
    maplayer.addFeatures(formatmap);
    */

    var render_errors = [];
    for (var i in shapedata['features'])
    {
        try
        {

            var info2d = shapedata['features'][i];

            var objtype = info2d['geometry']['type'];
            if (objtype.toUpperCase() == "LINESTRING")
            {

                for (var pt in info2d['geometry']['coordinates'])
                {
                    info2d['geometry']['coordinates'][pt] = info2d['geometry']['coordinates'][pt].slice(0,2);
                }

            }
            else if (objtype.toUpperCase() == "POINT")
            {
                info2d['geometry']['coordinates'] = info2d['geometry']['coordinates'].slice(0,2);

            }
            var fstring = JSON.stringify(info2d);
            var fmap = geojson_format.read(fstring);
            maplayer.addFeatures(fmap);


        }
        catch (err)
        {
            if (render_errors.length < 100)
            {
                console.log(err);
            }
            render_errors.push(i);
        }

    }
    console.log ("Rendered with "+render_errors.length+" errors");
    if (render_errors.length > 0)
    {
        console.log("Error sample:");
        console.log(render_errors[0]);
    }


    /*
    setTimeout(function () {
        $("#renderingstate").hide();
    }, 0);
    */
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
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    var clustering = new OpenLayers.Strategy.Cluster({distance: 20, threshold: 3});

    proxymap_currentlayer = new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_currentlayer);


    // this layer is used to display the selected map
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 3, strokeDashstyle: "solid", pointRadius: 6});
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