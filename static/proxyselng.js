/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/25/12
 * Time: 3:24 PM
 * To change this template use File | Settings | File Templates.
 */

var proxies;
var instancenames = [];

var keycode_ENTER = 13;
var keycode_ESC = 27;

var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";
var gjformat;

var regex_names = new RegExp ("^[A-Za-z0-9_]+$");
var regex_email_rfc = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;


var defaultLon = 11.1;
var defaultLat = 44.5;
var defaultBounds;

var newproxymap;
var newmetamap;
// full hard proxy map
var proxymap;


var newproxychecks;
var newmetachecks;

var newmetalist = [];

// these are needed only to avoid checking against the presence of the bbox feature on the respective maps; on these it is a simple exists/null check
var tempgeoloc_meta = null;
var tempgeoloc_proxy = null;

var blankmanifest = {
    'name': "",
    'provider': "",
    'operations':
    {
        'read' : 'none',
        'write': 'none',
        'query':
        {
            'inventory': 'none',
            'geographic': 'none',
            'time': 'none',
            'bi': 'none',
            'signs': false
        }
    },
    'time': ["", ""],
    'area': [],
    'metadata': []
};

var cpid = null;

// layer with the bboxes of all instances of the current kind
var mapsumlayer;
// layer with the bboxes of the currently selected instance
var mapvislayer;

function pageInit(proxylist)
{

    proxies = proxylist;

    buildInstanceNamesList();

    console.log("Proxy selection/creation. Listing:");
    console.log(proxylist);

    $("#tabsel_proxy").live('click', showSelProxy);
    $("#tabsel_standalone").live('click', showSelStandalone)



    var pobj_wgs84 = new OpenLayers.Projection(proj_WGS84);
    var pobj_google = new OpenLayers.Projection(proj_900913);

    defaultBounds = new OpenLayers.Bounds();
    defaultBounds.extend(new OpenLayers.LonLat(9.1980988, 43.73086379999999).transform(pobj_wgs84, pobj_google));
    defaultBounds.extend(new OpenLayers.LonLat(12.7558364, 45.1395245).transform(pobj_wgs84, pobj_google));


    OpenLayers.Lang.setCode("it");
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";


    initForms();
    initProxyMap();

    showSelProxy();


}


function initProxyMap()
{
    // resetting the widget in case there is an older map and we are loading a new one
    $("#proxymap").empty();

    proxymap = new OpenLayers.Map("proxymap", {controls: []});
    proxymap.projection = proj_WGS84;
    proxymap.displayProjection = new OpenLayers.Projection(proj_WGS84);

    // setting the format to translate geometries out of the map
    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': proxymap.getProjectionObject()});

    //Base Maps from Google
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Physical", {
        type : google.maps.MapTypeId.TERRAIN,
        visibility : false
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Satellite", {
        type : google.maps.MapTypeId.SATELLITE,
        numZoomLevels : 20
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Streets", {
        numZoomLevels : 20,
        visibility : false
    }));
    proxymap.addLayer(new OpenLayers.Layer.Google("Google Hybrid", {
        type : google.maps.MapTypeId.HYBRID,
        numZoomLevels : 20,
        visibility : false
    }));


    var osmlayer = new OpenLayers.Layer.OSM();
    proxymap.addLayer(osmlayer);


    var featurestyle = new OpenLayers.Style ({fillOpacity: 0.2, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid"});
    var featurestylemap = new OpenLayers.StyleMap(featurestyle);
    mapsumlayer = new OpenLayers.Layer.Vector("Istanze", {styleMap: featurestylemap});
    proxymap.addLayer(mapsumlayer);

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.2, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    mapvislayer = new OpenLayers.Layer.Vector("Istanze selezionate", {styleMap: featurestylemap});
    proxymap.addLayer(mapvislayer);

    proxymap.addControl(new OpenLayers.Control.Navigation());
    proxymap.addControl(new OpenLayers.Control.PanZoomBar());

    //Inheriting of OpenLayers.Control.LayerSwitcher
    ItaLayerSwitcher.prototype = new OpenLayers.Control.LayerSwitcher;           // Define sub-class
    ItaLayerSwitcher.prototype.constructor = ItaLayerSwitcher;

    function ItaLayerSwitcher()
    {
        OpenLayers.Control.LayerSwitcher.call(this, { displayClass: "olLabsLayerSwitcher"});                                         // derived constructor = call super-class constructor
    }

    ItaLayerSwitcher.prototype.loadContents = function()                                 // redefine Method
    {
        OpenLayers.Control.LayerSwitcher.prototype.loadContents.call(this);         // Call super-class method
        this.baseLbl.innerHTML = 'Cartografie';                                   //change title for base layers
        this.dataLbl.innerHTML = 'Mappe';                                   //change title for overlays (empty string "" is an option, too)
    };

    var switcher = new ItaLayerSwitcher();
    proxymap.addControl(switcher);

    //zoomToCenter(proxymap, defaultLon, defaultLat, 8);
    proxymap.zoomToExtent(defaultBounds);


}

function resetProxyChecks()
{
    newproxychecks = {
        "proxyname": false,
        "proxydates": false,
        "meta_partial": [],
        "meta_out": [],
        "hasmeta": false,
        "hasprovider": false,
        "hascontact": false
    };

    resetMetaChecks();
}

function resetMetaChecks()
{
    newmetachecks = {
        "metaname": false,
        "metadates": true
    }
}

function buildInstanceNamesList()
{

    for (var proxy_id in proxies)
    {
        var cname = proxies[proxy_id].name;
        if (instancenames.indexOf(cname) == -1)
        {
            instancenames.push(cname);
        }
    }

    console.log("List of current instances names");
    console.log(instancenames);
}

function getProxyList(federated)
{
    // returns a list of proxy ids, federated is a boolean: true for proxies, false for local

    var prefix = "local_";
    var cproxylist = [];
    for (var proxy_id in proxies)
    {
        if ((proxy_id.substr(0,prefix.length)!=prefix) == federated)
        {
            cproxylist.push(proxy_id);
        }

    }

    return cproxylist;

}

function showSelProxy ()
{
    $("#tabsel_standalone").addClass("unseltab");
    $("#tabsel_proxy").removeClass("unseltab");
    $("#instances_proxy").show();
    $("#instances_standalone").hide();

    renderProxies(getProxyList(true));
}

function showSelStandalone ()
{
    $("#tabsel_standalone").removeClass("unseltab");
    $("#tabsel_proxy").addClass("unseltab");
    $("#instances_proxy").hide();
    $("#instances_standalone").show();

    renderProxies(getProxyList(false));
}

function renderHovered ()
{
    var prefix = "instance_";
    var proxy_id = this.id.substr(prefix.length);
    renderSelectedProxy(proxy_id);
}

function unrenderHovered ()
{

    mapvislayer.destroyFeatures();

}

function renderSelectedProxy (proxy_id)
{

    mapvislayer.destroyFeatures();

    var bbox = proxies[proxy_id]['area'];
    var points = [
        reverseReprojPoint(bbox[0], bbox[1], proxymap),
        reverseReprojPoint(bbox[2], bbox[1], proxymap),
        reverseReprojPoint(bbox[2], bbox[3], proxymap),
        reverseReprojPoint(bbox[0], bbox[3], proxymap)
    ];
    var ring = new OpenLayers.Geometry.LinearRing(points);
    var polygon = new OpenLayers.Geometry.Polygon([ring]);

    var feature = new OpenLayers.Feature.Vector(polygon, {});


    mapvislayer.addFeatures([feature]);

}

function renderProxies (proxy_ids)
{

    // cleaning up the map
    mapsumlayer.destroyFeatures();



    for (var i in proxy_ids)
    {
        var proxy_id = proxy_ids[i];
        console.log("Rendering instance "+proxy_id+" with area");
        var bbox = proxies[proxy_id]['area'];
        console.log(bbox);
        var points = [
            reverseReprojPoint(bbox[0], bbox[1], proxymap),
            reverseReprojPoint(bbox[2], bbox[1], proxymap),
            reverseReprojPoint(bbox[2], bbox[3], proxymap),
            reverseReprojPoint(bbox[0], bbox[3], proxymap)
        ];
        var ring = new OpenLayers.Geometry.LinearRing(points);
        var polygon = new OpenLayers.Geometry.Polygon([ring]);

        var feature = new OpenLayers.Feature.Vector(polygon, {});


        mapsumlayer.addFeatures([feature]);

    }


}



function initForms()
{

    $(".proxylisting_instance").hover(renderHovered, unrenderHovered);

    $("#btn_newdatasource_linker").live('click', initCreateLinked);
    $("#btn_newdatasource_standalone").live('click', initCreateStandalone);
    $("#btn_newdatasource_networked").live('click', initCreateReadWrite);
    $("#btn_newdatasource_query").live('click', initCreateQuery);
    $(".btn_proxydelete").live('click', initDeleteProxy);


    $(".proxyrecap").live('click', openProxyRecap);
    $("#infobox_proxies").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Chiudi": {
                text: "Chiudi",
                click: function() {$( this ).dialog( "close" );}
            }
        }
    });

    $(".proxydatefield, .proxymetadatefield").datepicker({
        changeMonth: true,
        changeYear: true
    });

    // blocking direct text input in date fields, will use datepicker only
    $(".proxydatefield, .proxymetadatefield").live("keyup keydown",
    function (ev)
    {
        ev.preventDefault();
        return false;
    });

    $(".proxydatefield").live("change", verifyProxyDates);
    $(".proxyhasdateto").live("change", switchProxyDateFields);
    $(".proxyfieldprovider").live("keyup change mouseup", verifyProxyProvider);
    $(".proxyfieldcontactdata").live("keyup change mouseup", verifyProxyContact);
    $(".proxynamefield").live('keyup change mouseup', verifyProxyName);


    $(".newmeta_name").live('keyup change mouseup', verifyMetaName);
    $(".metadatefieldswitch").live('change', switchMetaDates);
    $(".metabboxfieldswitch").live('change', switchMetaBbox);
    $(".proxymetadatefield").live('change', verifyMetaDates);

    $(".field_meta_geoloc, .field_proxy_geoloc").live('keyup', tryGeoSearch);
    $(".btn_trygeoloc").live('click', geosearch);
    $(".cleangeoloc_meta, .cleangeoloc_proxy").live('click', cleanGeoloc);
    $(".newmeta_create").live('click', addNewMeta);
    $(".removemeta").live('click', removeMeta);

    $("#proxycreate_readwrite").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_readwrite",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_readwrite",
                text: "Crea",
                click: tryCreateReadWrite
            }
        }
    });
    $("#btn_newmetarw_create").button();


    $("#proxycreate_query").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_query",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_query",
                text: "Crea",
                click: tryCreateQuery
            }
        }
    });
    $("#btn_newmetaquery_create").button();

    $("#proxycreate_linked").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_linked",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_linked",
                text: "Crea",
                click: tryCreateLinked
            }
        }
    });

    $("#proxycreate_linked_choosesource").live('change', checkFedRequestField);

    $("#proxycreate_standalone").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_standalone",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Crea": {
                id : "form_create_standalone",
                text: "Crea",
                click: tryCreateStandalone
            }
        }
    });

    $("#creation_progress").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Esci": {
                id: "btn_createprogress_close_success",
                text: "Chiudi",
                click: function() {
                    $( this ).dialog( "close" );
                    resetPage();
                }
            },
            "Chiudi": {
                id: "btn_createprogress_close_fail",
                text: "Chiudi",
                click: function() {
                    $( this ).dialog( "close" );
                }
            }

        }
    });

    $("#proxydelete").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Annulla": {
                id : "form_close_delete",
                text: "Annulla",
                click: function() {$( this ).dialog( "close" );}
            },
            "Conferma": {
                id : "deleterequest_confirmationbutton",
                text: "Elimina",
                click: tryDeleteProxy
            }
        }
    });
    $("#deleterequest_confirmationstring").live('keyup mouseup change', checkDeletionReady);

    $("#delete_progress").dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        width:  "auto",
        buttons: {
            "Esci": {
                id: "btn_deleteprogress_close_success",
                text: "Chiudi",
                click: function() {
                    $( this ).dialog( "close" );
                    resetPage();
                }
            },
            "Chiudi": {
                id: "btn_deleteprogress_close_fail",
                text: "Chiudi",
                click: function() {
                    $( this ).dialog( "close" );
                }
            }

        }
    });

    $("#form_create_standalone, #form_create_linked, #form_create_readwrite, #form_create_query").addClass("btn_form_create");


}

function openProxyRecap ()
{
    var prefix = "proxyrecap_";
    var dest = this.id.substr(prefix.length);

    console.log("opening infobox for proxy "+dest);

    $(".proxydetails").hide();
    $("#proxydetails_"+dest).show();
    $("#infobox_proxies").dialog("open");
}

function initDeleteProxy()
{

    var prefix = "btn_proxydelete_";
    cpid = this.id.substr(prefix.length);
    console.log("Waiting for confirmation to delete proxy "+cpid);

    $("#proxydelete").dialog("open");
    $("#deleterequest_confirmationstring").val("");
    $("#deleterequest_confirmationbutton").prop("disabled", true);


}

function checkDeletionReady()
{
    var userstring = $("#deleterequest_confirmationstring").val();
    // NOTE: hidden input is used to that we can change the text only in one place, that is the HTML template
    var compareto = $("#deleterequest_verificationstring").val();

    $("#deleterequest_confirmationbutton").prop("disabled", userstring != compareto);

}


function tryDeleteProxy()
{



    $("#proxydelete").dialog("close");

    var proxy_id = cpid;

    console.log("Requesting deletion for proxy "+cpid);

    var controldict = {
        'action': 'deleteproxy',
        'proxy_id': cpid
    };

    $("#delete_progress").dialog("open");
    $("#delete_progress.progressinfo").hide();
    $("#deletefinished_success").hide();
    $("#deletefinished_fail").hide();
    $("#deletefail_explain").empty();
    $("#progspinner_delete").show();

    $("#btn_deleteprogress_close_success").hide();
    $("#btn_deleteprogress_close_fail").hide();


    $.ajax({
        url: "/fwp/control/",
        async: true,
        data: controldict,
        type: 'POST',
        success: reportDeleteResult,
        error: reportFailedDelete
    });


}

function reportDeleteResult (data, textStatus, jqXHR)
{

    console.log("Received structurally correct response");
    console.log(data);

    $("#progress_stage_makingrequest").hide();
    $("#progspinner_delete").hide();

    if (data['success'] == true)
    {
        $("#btn_deleteprogress_close_success").show();
        $("#deletefinished_success").show();
        console.log("Proxy deletion succeeded");
    }
    else
    {
        $("#deletefinished_fail").show();
        $("#deletefail_explain").append(data['report']);
        $("#btn_deleteprogress_close_fail").show();
        console.log("Proxy deletion failed");
    }

}

function reportFailedDelete (err, xhr)
{

    console.log("Reporting failed ajax call for proxy delete");
    console.log(err);

    $("#progress_stage_makingrequest").hide();
    $("#progspinner_delete").hide();

    $("#deletefinished_fail").show();
    $("#deletefail_explain").append(err);
    $("#btn_deleteprogress_close_fail").show();


}



function resetPage()
{
    // callback for forms that need to have the page reloaded after the user reads the feedback
    window.location = window.location.pathname;
}

function initCreateReadWrite ()
{
    //TODO: placeholder, implement
    $(".tablemap").empty();
    $("#proxycreate_readwrite").dialog("open");
    newproxymap = initMiniMap("map_createreadwrite");
    newmetamap = initMiniMap("map_metareadwrite");

    resetProxyChecks();
    cleanForms("proxycreate_readwrite");
    reviewProxySubmission("proxycreate_readwrite");
    reviewMetaSubmission("proxycreate_readwrite");

    newmetalist = [];
}


function tryCreateReadWrite()
{

    var base = $("#proxycreate_readwrite");

    var proxyname = base.find(".proxynamefield").val();

    var proxydatefrom = base.find(".proxydatefield.datefromfield").datepicker("getDate");
    var hasdateto = base.find(".proxyhasdateto").is(":checked");
    var proxydateto = hasdateto ? base.find(".proxydatefield.datetofield").datepicker("getDate"): null;

    var proxyopsdetails = base.find("#field_createreadwrite_mode").val().split("/");
    var proxymode = proxyopsdetails[0];
    var proxysubmode = proxyopsdetails[1];

    // the proxy must ALWAYS have a bounding box, we only need to find if it's drawn or implicit
    var proxybbox = newproxymap.layers[1].features.length > 0 ? newproxymap.layers[1].features[0].geometry.bounds.toArray() : newproxymap.getExtent().toArray();

    var proxyowner = base.find(".proxyfieldprovider").val();
    var proxycontactname = base.find(".proxyfieldcontactname").val();
    var proxycontactmail = base.find(".proxyfieldemail").val();
    var proxycontactphone = base.find(".proxyfieldphone").val();

    //quick and dirty clone hack
    var manifest = JSON.parse(JSON.stringify(blankmanifest));

    manifest['name'] = proxyname;
    manifest['provider'] = proxyowner;
    manifest['time'][0] = dateToStamp(proxydatefrom);
    if (proxydateto != null)
    {
        manifest['time'][1] = dateToStamp(proxydateto);
    }


    proxybbox = reprojBboxArray(proxybbox, newproxymap);

    manifest['area'] = proxybbox;

    // setting only the operation we actually use
    manifest['operations'][proxymode] = proxysubmode;


    for (var i in newmetalist)
    {
        var metadata = {
            'name': "",
            'time': ["", ""],
            'area': []
        };

        metadata['name'] = newmetalist[i]['name'];


        var hasbbox = newmetalist[i]['bbox'] != null;
        if (hasbbox)
        {
            metadata['area'] = reprojBboxArray(newmetalist[i]['bbox'], newmetamap);
        }
        else
        {
            metadata['area'] = proxybbox;
        }

        var hasdatefrom = newmetalist[i]['datefrom'] != null;
        if (hasdatefrom)
        {
            metadata['time'][0] = dateToStamp(newmetalist[i]['datefrom']);
        }

        var hasdateto = newmetalist[i]['dateto'] != null;
        if (hasdateto)
        {
            metadata['time'][1] = dateToStamp(newmetalist[i]['dateto']);
        }

        manifest['metadata'].push(metadata);


    }



    var contacts = {
        'owner': proxyowner,
        'contact': proxycontactname,
        'email': proxycontactmail,
        'phone': proxycontactphone
    };

    var payload = {
        'manifest' : manifest,
        'contacts' : contacts
    };

    console.log("Preparing to send payload message for registration");
    console.log(payload);

    $("#proxycreate_readwrite").dialog("close");


    $("#creation_progress").dialog("open");
    $("#creation_progress.progressinfo").hide();
    $("#creationfinished_success").hide();
    $("#creationfinished_fail").hide();
    $("#progspinner_creation").show();

    $("#btn_createprogress_close_success").hide();
    $("#btn_createprogress_close_fail").hide();

    var urlstring = "/fwp/createng/";

    $.ajax ({
        url: urlstring,
        data: {jsonmessage: JSON.stringify(payload)},
        //contentType: 'application/json',
        //dataType: 'json',
        type: 'POST',
        async: true,
        success: reportCreationResult,
        error: reportFailedCreation
    });

    console.log("Payload sent");

}

function reportCreationResult (data, textStatus, jqXHR)
{

    console.log("Received structurally correct response");
    console.log(data);

    $("#progress_stage_sendinginfo").hide();
    $("#progspinner_creation").hide();

    if (data['success'] == true)
    {
        $("#btn_createprogress_close_success").show();
        $("#creationfinished_success").show();
        console.log("Proxy creation succeeded");
    }
    else
    {
        $("#creationfinished_fail").show();
        $("#creationfail_explain").append(data['report']);
        $("#btn_createprogress_close_fail").show();
        console.log("Proxy creation failed");
    }


}

function reportFailedCreation (err, xhr)
{

    console.log("Reporting failed ajax call for creation");

    $("#progress_stage_sendinginfo").hide();
    $("#progspinner_creation").hide();

    $("#creationfinished_fail").show();
    $("#creationfail_explain").append(err);
    $("#btn_createprogress_close_fail").show();

    console.log(err);

}

function reprojBboxArray (boxarray, olmap)
{
    var endA = reprojPoint(boxarray[0], boxarray[1], newproxymap);
    //console.log(endA);
    var endB = reprojPoint(boxarray[2], boxarray[3], newproxymap);
    //console.log(endB);
    return [endA.x, endA.y, endB.x, endB.y];
}

function reprojPoint (pointX, pointY, olmap)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(olmap.getProjectionObject(), new OpenLayers.Projection(proj_WGS84));


    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}

function reverseReprojPoint (pointX, pointY, olmap)
{
    var reproj;

    reproj = new OpenLayers.LonLat(pointX, pointY).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());

    return new OpenLayers.Geometry.Point(reproj.lon, reproj.lat);
}

function initCreateQuery ()
{



    $(".tablemap").empty();
    $("#proxycreate_query").dialog("open");
    newproxymap = initMiniMap("map_createquery");
    newmetamap = initMiniMap("map_metaquery");
    resetProxyChecks();
    cleanForms("proxycreate_query");
    reviewProxySubmission("proxycreate_query");
    reviewMetaSubmission("proxycreate_query");
}

function tryCreateQuery ()
{
    //NOTE: based on tryCreateReadWrite

    var base = $("#proxycreate_query");

    var proxyname = base.find(".proxynamefield").val();

    var proxydatefrom = base.find(".proxydatefield.datefromfield").datepicker("getDate");
    var hasdateto = base.find(".proxyhasdateto").is(":checked");
    var proxydateto = hasdateto ? base.find(".proxydatefield.datetofield").datepicker("getDate"): null;

    var querymode_geo = $("#newquery_mode_geo").val();
    var querymode_inv = $("#newquery_mode_inv").val();
    var querymode_time = $("#newquery_mode_time").val();
    var querymode_bi = $("#newquery_mode_bi").val();
    var querymode_signed = $("#newquery_mode_sign").val() == "true";

    // the proxy must ALWAYS have a bounding box, we only need to find if it's drawn or implicit
    var proxybbox = newproxymap.layers[1].features.length > 0 ? newproxymap.layers[1].features[0].geometry.bounds.toArray() : newproxymap.getExtent().toArray();

    var proxyowner = base.find(".proxyfieldprovider").val();
    var proxycontactname = base.find(".proxyfieldcontactname").val();
    var proxycontactmail = base.find(".proxyfieldemail").val();
    var proxycontactphone = base.find(".proxyfieldphone").val();

    //quick and dirty clone hack
    var manifest = JSON.parse(JSON.stringify(blankmanifest));

    manifest['name'] = proxyname;
    manifest['provider'] = proxyowner;
    manifest['time'][0] = dateToStamp(proxydatefrom);
    if (proxydateto != null)
    {
        manifest['time'][1] = dateToStamp(proxydateto);
    }


    proxybbox = reprojBboxArray(proxybbox, newproxymap);

    manifest['area'] = proxybbox;


    // setting only the operation we actually use

    // setting the query mode info
    manifest['operations']['query']['geographic'] = querymode_geo;
    manifest['operations']['query']['inventory'] = querymode_inv;
    manifest['operations']['query']['time'] = querymode_time;
    manifest['operations']['query']['bi'] = querymode_bi;
    manifest['operations']['query']['signs'] = querymode_signed;

    for (var i in newmetalist)
    {
        var metadata = {
            'name': "",
            'time': ["", ""],
            'area': []
        };

        metadata['name'] = newmetalist[i]['name'];


        var hasbbox = newmetalist[i]['bbox'] != null;
        if (hasbbox)
        {
            metadata['area'] = reprojBboxArray(newmetalist[i]['bbox'], newmetamap);
        }
        else
        {
            metadata['area'] = proxybbox;
        }

        var hasdatefrom = newmetalist[i]['datefrom'] != null;
        if (hasdatefrom)
        {
            metadata['time'][0] = dateToStamp(newmetalist[i]['datefrom']);
        }

        var hasdateto = newmetalist[i]['dateto'] != null;
        if (hasdateto)
        {
            metadata['time'][1] = dateToStamp(newmetalist[i]['dateto']);
        }

        manifest['metadata'].push(metadata);


    }

    var contacts = {
        'owner': proxyowner,
        'contact': proxycontactname,
        'email': proxycontactmail,
        'phone': proxycontactphone
    };

    var payload = {
        'manifest' : manifest,
        'contacts' : contacts
    };

    console.log("Preparing to send payload message for registration");
    console.log(payload);

    $("#proxycreate_query").dialog("close");
    $("#creation_progress").dialog("open");
    $("#creation_progress.progressinfo").hide();
    $("#creationfinished_success").hide();
    $("#creationfinished_fail").hide();
    $("#creationfail_explain").empty();

    $("#progspinner_creation").show();


    $("#btn_createprogress_close_success").hide();
    $("#btn_createprogress_close_fail").hide();

    var urlstring = "/fwp/createng/";

    $.ajax ({
        url: urlstring,
        data: {jsonmessage: JSON.stringify(payload)},
        //contentType: 'application/json',
        //dataType: 'json',
        type: 'POST',
        async: true,
        success: reportCreationResult,
        error: reportFailedCreation
    });

    console.log("Payload sent");

}

function initCreateLinked ()
{

    // avoids the usual proxy checks since we only need to know WHICH proxy will be chosen and everything else is copied automatically

    $(".tablemap").empty();
    $("#proxycreate_linked").dialog("open");
    cleanForms("proxycreate_linked");
    checkFedRequestField();
}

function checkFedRequestField()
{
    var selection = $("#proxycreate_linked_choosesource").val();

    $("#form_create_linked").prop("disabled", !(selection != null && selection != ""));

}

function initCreateStandalone()
{
    $(".tablemap").empty();
    $("#proxycreate_standalone").dialog("open");
    newproxymap = initMiniMap("map_createstandalone");
    resetProxyChecks();
    // standalone does NOT need an actual meta structure, will be created automatically
    newproxychecks.hasmeta = true;
    cleanForms("proxycreate_standalone");
    reviewProxySubmission("proxycreate_standalone");

}

function tryCreateStandalone()
{
    // works as per ReadWrite except NO mode or operation set
    // artificially declare only ONE meta, same data as the instance itself


    console.log("Creating a standalone instance");


    var base = $("#proxycreate_standalone");

    var proxyname = base.find(".proxynamefield").val();

    var proxydatefrom = base.find(".proxydatefield.datefromfield").datepicker("getDate");
    var hasdateto = base.find(".proxyhasdateto").is(":checked");
    var proxydateto = hasdateto ? base.find(".proxydatefield.datetofield").datepicker("getDate"): null;


    // the proxy must ALWAYS have a bounding box, we only need to find if it's drawn or implicit
    var proxybbox = newproxymap.layers[1].features.length > 0 ? newproxymap.layers[1].features[0].geometry.bounds.toArray() : newproxymap.getExtent().toArray();

    var proxyowner = base.find(".proxyfieldprovider").val();
    var proxycontactname = base.find(".proxyfieldcontactname").val();
    var proxycontactmail = base.find(".proxyfieldemail").val();
    var proxycontactphone = base.find(".proxyfieldphone").val();

    //quick and dirty clone hack
    var manifest = JSON.parse(JSON.stringify(blankmanifest));

    manifest['name'] = proxyname;
    manifest['provider'] = proxyowner;
    manifest['time'][0] = dateToStamp(proxydatefrom);
    if (proxydateto != null)
    {
        manifest['time'][1] = dateToStamp(proxydateto);
    }


    proxybbox = reprojBboxArray(proxybbox, newproxymap);

    manifest['area'] = proxybbox;

    // standalone has only ONE meta, same bbox as the proxy and no time (reverts to main)

    var unimeta = {
        "name": "Archivio",
        "time": ["",""],
        "area": proxybbox
    };

    manifest['metadata'] = [];
    manifest['metadata'].push(unimeta);


    var contacts = {
        'owner': proxyowner,
        'contact': proxycontactname,
        'email': proxycontactmail,
        'phone': proxycontactphone
    };

    var payload = {
        'manifest' : manifest,
        'contacts' : contacts
    };

    console.log("Preparing to send payload message for registration");
    console.log(payload);

    $("#proxycreate_standalone").dialog("close");

    $("#creation_progress").dialog("open");
    $("#creation_progress.progressinfo").hide();
    $("#creationfinished_success").hide();
    $("#creationfinished_fail").hide();
    $("#creationfail_explain").empty();
    $("#progspinner_creation").show();

    $("#btn_createprogress_close_success").hide();
    $("#btn_createprogress_close_fail").hide();

    var urlstring = "/fwp/createng/";

    $.ajax ({
        url: urlstring,
        data: {jsonmessage: JSON.stringify(payload)},
        //contentType: 'application/json',
        //dataType: 'json',
        type: 'POST',
        async: true,
        success: reportCreationResult,
        error: reportFailedCreation
    });

    console.log("Payload sent");


}

function tryCreateLinked()
{

    // needs only the proxy_id of the standalone to be linked

    console.log("Creating a linked proxy instance");

    var base = $("#proxycreate_linked");

    var proxy_id = base.find("#proxycreate_linked_choosesource").val();

    var payload = {
        'linkedto': proxy_id
    };

    console.log("Preparing to send payload message for registration");
    console.log(payload);

    $("#proxycreate_linked").dialog("close");


    $("#creation_progress").dialog("open");
    $("#creation_progress.progressinfo").hide();
    $("#creationfinished_success").hide();
    $("#creationfinished_fail").hide();
    $("#creationfail_explain").empty();
    $("#progspinner_creation").show();
    $("#btn_createprogress_close_success").hide();
    $("#btn_createprogress_close_fail").hide();

    var urlstring = "/fwp/createng/";

    $.ajax ({
        url: urlstring,
        data: {jsonmessage: JSON.stringify(payload)},
        type: 'POST',
        async: true,
        success: reportCreationResult,
        error: reportFailedCreation
    });

    console.log("Payload sent");


}


function cleanForms(formname)
{

    //Clearing all fields and triggering change on all
    // SELECTS are reset to first value

    // clearing all text fields
    console.log("Resetting text inputs");
    $('.creatormask .widetext').val('');


    console.log("Resetting checkboxes");
    // setting all checkboxes to false in all creation forms
    $(".creatormask input[type=checkbox]").attr("checked", false);
    $(".creatormask input[type=checkbox]").change();

    console.log("Resetting selects");
    // setting all selects to default
    var selector = $(".creatormask select");
    console.log(selector);
    for (var i = 0; i < selector.length; i++)
    {
        $(selector[i])[0].selectedIndex = 0;
    }
}

function cleanMetaForm (dialogid)
{

    var base = $("#"+dialogid).find(".metadata_info");

    newmetamap.layers[1].destroyFeatures();
    //zoomToCenter (newmetamap, defaultLon, defaultLat, 8);
    newmetamap.zoomToExtent(defaultBounds);

    base.find(".newmeta_name").val("");
    base.find(".proxymetadatefield").val("");
    base.find(".field_meta_geoloc").val("");

    var checkboxes = base.find("input[type=checkbox]");
    checkboxes.attr("checked", false);
    checkboxes.change();
    resetMetaChecks();


    reviewMetaSubmission(dialogid);






}

function tryGeoSearch (event)
{


    if (event.keyCode == keycode_ENTER)
    {

        console.log("Enter pressed, launching geosearch");
        console.log("Geosearch event launched from "+event.target.id);
        console.log(event);

        // passing the event down
        geosearch(event);
        event.preventDefault();
    }

}

function cleanGeoloc()
{
    var formid = $(this).closest(".creationdialog").attr("id");
    console.log ("Cleaning geoloc bbox for "+formid);
    var base = $(this).closest(".creatormask");

    //TODO: placeholder, implement

    var cmap;
    var searchbox;
    if ($(this).hasClass("cleangeoloc_meta"))
    {
        cmap = newmetamap;
        searchbox = base.find(".field_meta_geoloc");
        tempgeoloc_meta = null;
    }
    else if ($(this).hasClass("cleangeoloc_proxy"))
    {
        cmap = newproxymap;
        searchbox = base.find(".field_proxy_geoloc");
        tempgeoloc_proxy = null;
    }

    searchbox.val("");
    cmap.layers[1].destroyFeatures();

}



function geosearch(event)
{
    console.log(event);

    var caller = event.target;

    var formid = $(caller).closest(".creationdialog").attr("id");
    console.log ("Geosearching bbox for "+formid);
    var base = $(caller).closest(".creatormask");


    var searchbox;

    var cmap;
    var geostring;
    if ($(caller).hasClass ('btn_meta_geoloc') || $(caller).hasClass('field_meta_geoloc'))
    {
        cmap = newmetamap;
        searchbox = base.find(".field_meta_geoloc");
        geostring = $('.field_meta_geoloc').val();
    }
    else if ($(caller).hasClass ('btn_proxy_geoloc') || $(caller).hasClass('field_proxy_geoloc'))
    {
        cmap = newproxymap;
        searchbox = base.find(".field_proxy_geoloc");
        geostring = searchbox.val();
    }


    var jg;
    var path = '/external/maps.googleapis.com/maps/api/geocode/json?sensor=false&address='
        + geostring;

    console.log("Recentering meta map by search: "+path);


    $.getJSON(path, function(gqdata){
        console.log(gqdata);
        if(gqdata.status == "OK"){
            if (gqdata.results.length > 0){

                console.log("Results found");

                gq = new OpenLayers.Bounds();

                gq.extend(new
                    OpenLayers.LonLat(gqdata.results[0].geometry.viewport.southwest.lng,
                    gqdata.results[0].geometry.viewport.southwest.lat).transform(proj_WGS84,
                    proj_900913));
                gq.extend(new
                    OpenLayers.LonLat(gqdata.results[0].geometry.viewport.northeast.lng,
                    gqdata.results[0].geometry.viewport.northeast.lat).transform(proj_WGS84,
                    proj_900913));



                // moved inside renderbbox
                //cmap.zoomToExtent(gq);

                // using the data for either the proxy or the current meta
                if (caller.id == 'btn_trygeoloc_meta')
                {
                    console.log("Rendering meta bbox");
                    tempgeoloc_meta = gq;
                }
                else if  (caller.id == 'btn_trygeoloc_proxy')
                {
                    console.log("Rendering proxy bbox");
                    tempgeoloc_proxy = gq;
                }
                renderbbox (gq, cmap, true);

            }
            else
            {

                console.log("No location found");
                alert("Impossibile individuare la posizione richiesta.");
                console.log(gqdata.results);
            }
        }
        else
        {
            console.log("No location found");
            alert("Impossibile individuare la posizione richiesta.");

        }
    });



}

function renderbbox (bounds, mapview, zoomto)
{

    // forcing since we know we will have only OSM as background layer on the maps where we use this
    var vectorlayer = mapview.layers[1];
    vectorlayer.destroyFeatures();

    if (bounds != null)
    {
        if (zoomto)
        {
            mapview.zoomToExtent(bounds);
        }
        var cfeature = new OpenLayers.Feature.Vector(bounds.toGeometry());

        vectorlayer.addFeatures(cfeature);
        console.log(bounds.toGeometry());
        console.log(vectorlayer);
    }


}


function getCurrentMetaNames()
{
    var metanames = [];


    for (var i in newmetalist)
    {
        metanames.push(newmetalist[i]['name']);
    }

    return metanames;
}

function verifyMetaName()
{
    var candidate = $(this).val();
    var formid = $(this).closest(".creationdialog").attr("id");
    console.log ("Checking meta name from "+formid+": "+candidate);

    var isvalid = true;

    if (candidate.match(regex_names)==null || getCurrentMetaNames().indexOf(candidate)!= -1)
    {
        isvalid = false;
    }

    newmetachecks.metaname = isvalid;
    reviewMetaSubmission(formid);
}

function verifyProxyName ()
{

    var candidate = $(this).val();
    var formid = $(this).closest(".creationdialog").attr("id");
    //console.log ("Checking proxy name from "+formid+": "+candidate);


    // not on one line so we can add show() for specific warnings.
    var isvalid = true;

    // verifying if there are any illegal chars
    if (candidate.match(regex_names)==null || instancenames.indexOf(candidate)!= -1)
    {
        isvalid = false;
    }

    newproxychecks.proxyname = isvalid;
    reviewProxySubmission(formid);
}


function reviewMetaSubmission(dialogid)
{
    var ready = (newmetachecks.metadates && newmetachecks.metaname);
    // bounding box is implicit

    //console.log("Form "+dialogid+" META readiness: "+ready);
    $("#"+dialogid).closest(".ui-dialog").find(".newmeta_create").prop("disabled", !ready);


}

function addNewMeta ()
{

    var formid = $(this).closest(".creationdialog").attr("id");
    var base = $(this).closest(".creatormask");



    var metaname = base.find(".newmeta_name").val();
    var hasdatefrom = base.find(".metadatefieldswitch.hasdatefrom").is(":checked");
    var metadatefrom = hasdatefrom ? base.find(".metadatefrom").datepicker("getDate") : null;
    var hasdateto = base.find(".metadatefieldswitch.hasdateto").is(":checked");
    var metadateto = hasdateto ? base.find(".metadateto").datepicker("getDate") : null;

    var metabbox = null;
    var hasbbox = base.find(".metabboxfieldswitch.hasbbox").val();
    if (hasbbox)
    {
        var mapwidget = newmetamap;
        var isbboxdrawn = mapwidget.layers[1].features.length > 0;
        metabbox = isbboxdrawn ? mapwidget.layers[1].features[0].geometry.bounds.toArray() : mapwidget.getExtent().toArray();
    }

    var newmeta = {
        'name': metaname,
        'datefrom': metadatefrom,
        'dateto': metadateto,
        'bbox': metabbox
    };

    console.log("Adding new meta:");
    console.log(newmeta);

    newmetalist.push(newmeta);

    newproxychecks.hasmeta = true;

    renderMetaTable(base);
    cleanMetaForm(formid);

    reviewProxySubmission(formid);
}

function removeMeta()
{
    var metablock = $(this).closest(".metainfo");
    var base = $(this).closest(".creatormask");


    var prefix = "removemeta_";
    var metaid = parseInt(this.id.substr(prefix.length));

    newmetalist.splice(metaid, 1);

    newproxychecks.hasmeta = newmetalist.length > 0;

    renderMetaTable(base);
    resetMetaChecks();

    reviewProxySubmission($(this).closest(".creationdialog").attr("id"));
}

function renderMetaTable (base)
{

    var metatable = base.find(".newmetalist");
    metatable.empty();

    for (var i in newmetalist)
    {
        var metarow = $('<tr class="metainfo">' +
            '<td class="metainfo_name"></td>' +
            '<td class="metainfo_details"></td>' +
            '<td class="metainfo_actions"></td>' +
            '</tr>');

        var removemeta = '<img class="imgbutton removemeta" src="/static/resource/visng_model_deletevalue.png" id="removemeta_'+i+'">';


        metarow.find(".metainfo_name").append(newmetalist[i]['name']);
        metarow.find(".metainfo_actions").append(removemeta);

        metatable.append(metarow);

    }



}

function reviewProxySubmission(dialogid)
{
    // checks if all the parameters to create a proxy are met by looking at the global object newproxychecks


    var ready = (newproxychecks.proxyname && newproxychecks.proxydates && newproxychecks.hasmeta && newproxychecks.hasprovider && newproxychecks.hascontact && (newproxychecks.meta_out.length == 0));

    //console.log("Form "+dialogid+" PROXY readiness: "+ready);

    $("#"+dialogid).closest(".ui-dialog").find(".btn_form_create").prop("disabled", !ready);
    //console.log($("#"+dialogid).closest(".ui-dialog").find(".btn_form_create"));
}

function switchProxyDateFields()
{

    // only checks on dateto

    var eid = this.id;
    var hasdateto = $(this).is(":checked");

    var formid = $(this).closest(".creationdialog").attr("id");

    var datefield = $("#"+formid).find(".proxydatefield.datetofield");

    datefield.prop("disabled", !hasdateto);

    datefield.change();
}

function verifyProxyContact()
{
    // checks if a valid contact reference has been inserted for this proxy

    //console.log("Contact field verfication from field "+this.id);

    // we only need one valid data in all the contact data fields for this to be used
    var isvalid = false;

    var formid = $(this).closest(".creationdialog").attr("id");
    var base = $(this).closest(".creatormask");

    var contactfields = base.find(".proxyfieldcontactdata");

    for (var i = 0; i < contactfields.length; i++)
    {

        //console.log("Checking contact field "+contactfields[i].id);

        var fieldval = $(contactfields[i]).val();
        //console.log("Field has value "+fieldval);


        if (fieldval != null && fieldval != "")
        {
            if ($(contactfields[i]).hasClass("proxyfieldemail"))
            {
                if (regex_email_rfc.test(fieldval))
                {
                    isvalid = true;
                }
            }

            if ($(contactfields[i]).hasClass("proxyfieldphone"))
            {
                if (fieldval.match(/\d/g).length > 7)
                {
                    isvalid = true;
                }
            }
        }

    }

    newproxychecks.hascontact = isvalid;
    reviewProxySubmission(formid);


}

function verifyProxyProvider()
{

    // checks if a provider has been inserted for this proxy

    var formid = $(this).closest(".creationdialog").attr("id");
    var base = $(this).closest(".creatormask");

    var providername = base.find(".proxyfieldprovider").val();
    var isvalid = false;

    //console.log("Checking providername "+providername);

    if (providername != null)
    {
        var clean = providername.replace (/\s/, "");
        if (clean.length > 0)
        {
            isvalid = true;
        }
    }

    newproxychecks.hasprovider = isvalid;
    reviewProxySubmission(formid);


}

function switchMetaDates()
{
    var switchid = this.id;
    var destid = this.id.replace("_has", "_");

    var switchval = $(this).is(":checked");

    $("#"+destid).prop("disabled", !switchval);
    $("#"+destid).change();

}

function switchMetaBbox ()
{

    var switchval = $(this).is(":checked");
    var formid = $(this).closest(".creationdialog").attr("id");
    var base = $(this).closest(".creatormask");

    base.find(".field_meta_geoloc").prop('disabled', !switchval);


}

function verifyMetaDates()
{

    var isvalid = true;

    var formid = $(this).closest(".creationdialog").attr("id");
    console.log ("Checking meta dates from "+formid);

    var base = $(this).closest(".creatormask");

    var hasdatefrom = base.find(".metadatefieldswitch.hasdatefrom").is(":checked");
    if (hasdatefrom)
    {
        var datefromval = base.find(".metadatefrom").datepicker("getDate");
        if (datefromval === null)
        {
            isvalid = false;
        }
    }

    var hasdateto = base.find(".metadatefieldswitch.hasdateto").is(":checked");
    if (hasdateto)
    {
        var datetoval = base.find(".metadateto").datepicker("getDate");
        if (datetoval === null)
        {
            isvalid = false;
        }
    }

    if (hasdatefrom && hasdateto)
    {
        isvalid = isvalid && verifyDateSequence(datefromval, datetoval);
    }

    newmetachecks.metadates = isvalid;
    reviewMetaSubmission(formid);


}


function dateToStamp (candidate)
{

    function pad(number) {
        var r = String(number);
        if ( r.length === 1 ) {
            r = '0' + r;
        }
        return ""+r;
    }

    return ''+candidate.getUTCFullYear()+'-'+ pad(candidate.getUTCMonth()+1)+'-' + pad(candidate.getUTCDate())+ 'T00:00Z';


}

function verifyProxyDates()
{

    // checks and compare proxy date fields
    // we assume fields can only be correctly formatted or empty/null
    // since the HTML page locks up keyboard input here


    var isvalid = true;

    var formid = $(this).closest(".creationdialog").attr("id");
    console.log ("Checking proxy dates from "+formid);

    var base = $(this).closest(".creatormask");


    var datefromval = base.find(".proxydatefield.datefromfield").datepicker("getDate");
    if (datefromval === null)
    {
        isvalid = false;
    }

    var hasdateto = base.find(".proxyhasdateto").is(":checked");
    if (hasdateto)
    {
        var datetoval = base.find(".proxydatefield.datetofield").datepicker("getDate");
        if (datetoval === null)
        {
            isvalid = false;
        }

        console.log("Comparing dates "+datefromval+" to "+datetoval);
        isvalid = isvalid && verifyDateSequence(datefromval, datetoval);
    }

    newproxychecks.proxydates = isvalid;
    reviewProxySubmission(formid);

}

function verifyDateSequence (datefrom, dateto)
{

    var isSequence = false;

    var yearfrom = datefrom.getFullYear();
    var monthfrom = datefrom.getMonth();
    var dayfrom = datefrom.getDate();

    var yearto = dateto.getFullYear();
    var monthto = dateto.getMonth();
    var dayto = dateto.getDate();

    if (yearto > yearfrom)
    {
        isSequence = true;
    }
    else
    {
        if (monthto > monthfrom )
        {
            isSequence = true;
        }
        else
        {
            if (dayto >= dayfrom)
            {
                isSequence = true;
            }
        }
    }

    return isSequence;
}


function initMiniMap (eid)
{
    // creates a mini map with reduced controls on a specific div

    console.log("Setting map on element with id "+eid);

    // resetting the widget in case there is an older map and we are loading a new one
    //$("#"+eid).empty();
    //$(".tablemap").empty();

    var mapview = new OpenLayers.Map(eid, {controls: []});
    mapview.projection = proj_WGS84;
    mapview.displayProjection = new OpenLayers.Projection(proj_WGS84);

    //Base Maps from Google
    /*
    mapview.addLayer(new OpenLayers.Layer.Google("Google Physical", {

        type : google.maps.MapTypeId.TERRAIN,
        visibility : true,
        baselayer:  true
    }));
    */

    var osmlayer  = new OpenLayers.Layer.OSM();
    mapview.addLayer(osmlayer);

    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});

    var tracelayer = new OpenLayers.Layer.Vector("BoundingBox", {styleMap: featurestylemap});
    //console.log(tracelayer);
    //console.log(mapview);
    mapview.addLayer(tracelayer);

    //zoomToCenter (mapview, defaultLon, defaultLat, 8);
    mapview.zoomToExtent(defaultBounds);

    create_setNavControls(mapview);
    return mapview;
}


function zoomToCenter (widget, lon, lat, zoom)
{

    var lonlat = new OpenLayers.LonLat (lon, lat);
    var projected = lonlat.transform(new OpenLayers.Projection(proj_WGS84), widget.getProjectionObject());

    widget.setCenter(projected, zoom, false, true);

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

function zoomToBounds (olmap, bounds)
{
    console.log("Moving to");
    console.log(bbox);

    console.log(olmap.id);
    console.log(bounds);
    olmap.zoomToExtent (bounds, true);
    console.log("Actual viewport extent after zoom");
    console.log(olmap.getExtent());


}