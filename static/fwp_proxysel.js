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

// summary layer with all the boxes
var mapsumlayer = null;

var defaultLon = 11.1;
var defaultLat = 44.5;
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

var proxynames = new Array();

// string : "proxy" "standalone"
var proxycreationmode = "";
// if the user is creating a new instance or just looking at the map
var creationmode = false;

var closerbutton = '<img src="/static/resource/fwp_closemasks.png" class="btn_closeallmasks" id="btn_closeallmasks" alt="Chiudi">';

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

    // render basic list

    // this layer is used to display the unselected proxies
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.1, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    mapsumlayer = new OpenLayers.Layer.Vector("", {styleMap: featurestylemap});
    mapvis.addLayer(mapsumlayer);
    //renderAllProxies();

    // this layer is used to display the selected map
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.3, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    mapvislayer = new OpenLayers.Layer.Vector("", {styleMap: featurestylemap});
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

    $(".btn_proxydelete").live("click", renderDeleteMask);
    $(".btn_stfider").live("click", renderFederationMask);

    $(".btn_closeallmasks").live('click', closeAllMasks);

}


function renderFederationMask ()
{
    var prefix = "btn_stfider_";
    var i = this.id.substr(prefix.length);

    console.log("Rendering federation mask for standalone "+i);
    closeAllMasks();

    var fiderstring = '<div class="fidermask maskwidget" id="fiderst_'+i+'">' +
        closerbutton+
        'Federare l\'istanza?'+
        '<input type="button" class="btn_confirmfider" id="btn_confirmfider_'+i+'" value="Federa">' +
        '</div>';

    $("#proxies_"+i).append(fiderstring);


    $(".btn_confirmfider").unbind();
    $("#btn_confirmfider_"+i).live('click', fiderSt);



}


function renderDeleteMask ()
{



    var prefix = "btn_proxydelete_";
    var i = this.id.substr(prefix.length);

    console.log("Rendering delete mask for "+i);
    closeAllMasks();


    var removestring = '<div class="removemask maskwidget" id="remove_'+i+'">' +
        closerbutton+
        'Confermi l\'eliminazione dell\'istanza?<br>(per confermare, scrivi "confermo la richiesta di eliminazione" nel riquadro di testo)<br>'+
        '<input type="text" id="txt_confirmproxydelete">'+
        '<input type="button" class="btn_confirmdelete" id="btn_confirmdelete_'+i+'" value="Elimina">' +
        '<br>ATTENZIONE: questa azione non può essere annullata.' +
        '</div>';


    $("#txt_confirmproxydelete").unbind();
    $("#txt_confirmproxydelete").live('keyup change click', checkRemoveConfirmation);
    $(".btn_confirmdelete").unbind();
    $("#btn_confirmdelete_"+i).live('click', deleteProxy);

    $("#proxies_"+i).append(removestring);

    checkRemoveConfirmation();

}


function fiderSt ()
{
    var prefix = "btn_confirmfider_";
    var i = this.id.substr(prefix.length);

    console.log("Adding standalone "+i+" to federation");

    closeAllMasks();

    var container = "#proxies_"+i;

    var controldict = {
        'linkedto': i
    };

    $("#progspinner").show();

    $.ajax({
        url: "/fwp/create/",
        async: true,
        data: controldict,
        type: 'POST',
        success: function(data)
        {
            if (!data['report'] || data['report'] == "")
            {
                data['report'] = 'Istanza '+i+' federata';
            }
            $("#progspinner").hide();
            postFeedbackMessage(data['success'], data['report'] , container);
            window.location = window.location.pathname;

        },
        error: function (data)
        {
            $("#progspinner").hide();
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container);
        }
    });

}

function deleteProxy()
{


    var prefix = "btn_confirmdelete_";
    var i = this.id.substr(prefix.length);

    console.log("Deleting proxy "+i);

    closeAllMasks();

    var container = "#proxies_"+i;

    var controldict = {
        'action': 'deleteproxy',
        'proxy_id': i
    };

    $("#progspinner").show();

    $.ajax({
        url: "/fwp/control/",
        async: true,
        data: controldict,
        type: 'POST',
        success: function(data)
        {

            if (data['success'])
            {
                if (!data['report'] || data['report'] == "")
                {
                    data['report'] = 'Proxy '+i+' eliminato';
                }
            }
            else
            {
                if (!data['report'] || data['report'] == "")
                {
                    data['report'] = 'Proxy '+i+' non eliminato';
                }
            }

            $("#progspinner").hide();
            postFeedbackMessage(data['success'], data['report'] , container);
            console.log(data['success']);
            if (data['success'])
            {
                window.location = window.location.pathname;
            }


        },
        error: function (data)
        {
            $("#progspinner").hide();
            postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container);
        }
    });

}


function checkRemoveConfirmation()
{
    var required = "confermo la richiesta di eliminazione";
    var confstring = $("#txt_confirmproxydelete").val();
    if (confstring == required)
    {
        $(".btn_confirmdelete").prop('disabled', false);
    }
    else
    {
        $(".btn_confirmdelete").prop('disabled', true);
    }
}

function populateOwners()
{

    var urlstring = "/fwp/fed/owners/";

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

function islocal (proxy_id)
{
    /*
    Tells if the requested proxy is a standalone instance or not
     */

    var localprefix = "local_";

    return proxy_id.substr(0, localprefix.length) == localprefix;
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
    $("#standalone_create_new").hide();
    $("#proxy_create_new").show();
    $("#controls_proxy").show();

    $(".proxytype_local").hide();

    $(".proxytype_query").show();
    $(".proxytype_read").show();
    $(".proxytype_write").show();

    var filteredproxylist = [];
    for (var proxy_id in proxies)
    {

        if (!islocal(proxy_id))
        {
            filteredproxylist.push(proxy_id);
        }
    }
    console.log("Rendering federated proxies ");
    console.log(filteredproxylist);
    renderProxies(filteredproxylist);


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
    $("#standalone_create_new").show();
    $("#proxy_create_new").hide();

    $(".proxytype_local").show();

    $(".proxytype_query").hide();
    $(".proxytype_read").hide();
    $(".proxytype_write").hide();

    var filteredproxylist = [];
    for (var proxy_id in proxies)
    {
        if (islocal(proxy_id))
        {
            filteredproxylist.push(proxy_id);
        }
    }

    console.log("Rendering standalone instances");
    console.log(filteredproxylist);
    renderProxies(filteredproxylist);

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



function isLinkedInstance (proxy_id)
{
    // checks if the instance with the requested id is a local/standalone instance and already has a linker proxy

    var stprefix = 'local_';
    if (proxy_id.substr(0, stprefix.length) != stprefix)
    {
        return false;
    }

    var proxy_name = proxies[proxy_id]['name'];

    // linker proxies always have the same name as the standalone instance they are adding to the federation. Also, it is forbidden to manually create a proxy with the same name as an existing proxy or standalone instance

    for (var cid in proxies)
    {
        if (cid == proxy_id)
        {
            continue;
        }
        else if (proxies[cid]['name'] == proxy_name)
        {
            return true;
        }
    }

    return false;

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

        console.log("Adding proxy "+proxy_id+" of type "+proxies[proxy_id]['type']);
        console.log(proxies[proxy_id]);

        var stfider = "";
        if (proxies[proxy_id]['type'] == "local" && !isLinkedInstance(proxy_id))
        {
            stfider = '<img src="/static/resource/fwp_stfider.png" class="btn_stfider" id="btn_stfider_'+proxy_id+'">';
        }

        var proxydelete = '<img src="/static/resource/fwp_remove.png" class="btn_proxydelete" id="btn_proxydelete_'+proxy_id+'" alt="Elimina">';

        var proxyentry = '<div class="nav_entry '+proxyclass+'" id="proxies_'+proxy_id+'">'+proxydelete+stfider+'<a href="/fwp/proxyng/'+proxy_id+'/">'+entry_name +'</a><br>'+entry_area+'<br>'+entry_time+'</div>';
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




function renderProxies (proxylist)
{

    /*
    Draws the bounding boxes for a selection of  proxies, proxylist being a list of proxy_ids
     */

    mapsumlayer.destroyFeatures();

    for (var i in proxylist)
    {
        var proxy_id = proxylist[i];
        console.log("Adding proxy "+proxy_id);
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


        mapsumlayer.addFeatures([feature]);
    }



}


function renderAllProxies()
{
    /*
    Draws the bounding boxes for all the proxies and standalone,
     */

    renderProxies (Object.getOwnPropertyNames(proxies));




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

function closeAllMasks()
{
    $(".maskwidget").remove();
}