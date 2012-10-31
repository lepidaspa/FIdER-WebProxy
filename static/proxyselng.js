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

var newproxymap;
var newmetamap;
// full hard proxy map
var proxymap;


var newproxychecks;
var newmetachecks;

var newmetalist = [];

function pageInit(proxylist)
{

    proxies = proxylist;

    buildInstanceNamesList();

    console.log("Proxy selection/creation. Listing:");
    console.log(proxylist);

    $("#tabsel_proxy").live('click', showSelProxy);
    $("#tabsel_standalone").live('click', showSelStandalone)



    OpenLayers.Lang.setCode("it");
    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";


    showSelProxy();
    initForms();
    initProxyMap();

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
    proxymap_metalayer = new OpenLayers.Layer.Vector("Cataloghi", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_metalayer);

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.2, fillColor: "#0000ff", strokeColor: "#0000ff", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_activemeta = new OpenLayers.Layer.Vector("Catalogo attivo", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_activemeta);

    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#009900", strokeColor: "#009900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    proxymap_activemap = new OpenLayers.Layer.Vector("Mappa attiva", {styleMap: featurestylemap});
    proxymap.addLayer(proxymap_activemap);

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
        this.baseLbl.innerHTML = 'Sfondi';                                   //change title for base layers
        this.dataLbl.innerHTML = 'Livelli';                                   //change title for overlays (empty string "" is an option, too)
    };

    var switcher = new ItaLayerSwitcher();
    proxymap.addControl(switcher);

    zoomToCenter(proxymap, defaultLon, defaultLat, 6);


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

function showSelProxy ()
{
    $("#tabsel_standalone").addClass("unseltab");
    $("#tabsel_proxy").removeClass("unseltab");
    $("#instances_proxy").show();
    $("#instances_standalone").hide();
}


function showSelStandalone ()
{
    $("#tabsel_standalone").removeClass("unseltab");
    $("#tabsel_proxy").addClass("unseltab");
    $("#instances_proxy").hide();
    $("#instances_standalone").show();
}

function initForms()
{

    $("#btn_newdatasource_linker").live('click', initCreateLinked);
    $("#btn_newdatasource_standalone").live('click', initCreateStandalone);
    $("#btn_newdatasource_networked").live('click', initCreateReadWrite);
    $("#btn_newdatasource_query").live('click', initCreateQuery);
    $("#newmeta_create").live('click', tryCreateMeta);


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
    $(".proxymetadatefield").live('change', verifyMetaDates);

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

    $("#form_create_standalone, #form_create_linked, #form_create_readwrite, #form_create_query").addClass("btn_form_create");


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
    //TODO: placeholder, implement

}

function initCreateQuery ()
{
    //TODO: placeholder, implement
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
    //TODO: placeholder, implement

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

function tryCreateLinked()
{
    //TODO: placeholder, implement
}

function initCreateStandalone()
{
    //TODO: placeholder, implement
    $(".tablemap").empty();
    $("#proxycreate_standalone").dialog("open");
    initMiniMap("map_createstandalone");
    initMiniMap("map_metastandalone");
    resetProxyChecks();
    // standalone does NOT need an actual meta structure, will be created automatically
    newproxychecks.hasmeta = true;
    cleanForms("proxycreate_standalone");
    reviewProxySubmission("proxycreate_standalone");

}

function tryCreateStandalone()
{
    //TODO: placeholder, implement
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

    verifyFormData(formname);

}

function verifyFormData(formname)
{
    switch (formname)
    {
        case "proxycreate_standalone":
            verifyFormDataStandalone();
            break;
        case "proxycreate_linked":
            verifyFormDataLinked();
            break;
        case "proxycreate_query":
            verifyFormDataQuery();
            break;
        case "proxycreate_readwrite":
            verifyFormDataReadWrite();
            break;
    }
}


function tryCreateMeta()
{

    var formid = $(this).closest(".creationdialog").attr("id");
    console.log ("Checking meta name from "+formid+": "+candidate);
    var base = $(this).closest(".creatormask");

    var metaname = base.find(".newmeta_name").val();

    var datefromval = null;
    var hasdatefrom = base.find(".metadatefieldswitch.hasdatefrom").attr("checked");
    if (hasdatefrom)
    {
        datefromval = base.find(".metadatefrom").datepicker("getDate");
    }

    var datetoval = null;
    var hasdateto = base.find(".metadatefieldswitch.hasdateto").attr("checked");
    if (hasdateto)
    {
        datetoval = base.find(".metadateto").datepicker("getDate");
    }

}


function geosearch(caller)
{


    var cmap;
    var geostring;
    if (caller.srcElement.id == 'btn_trygeoloc_meta')
    {
        cmap = newmetamap;
        geostring = $('#newmeta_geoloc').val();
    }
    else if  (caller.srcElement.id == 'btn_trygeoloc_proxy')
    {
        cmap = newproxymap;
        geostring = $('#newproxy_geoloc').val();
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
                if (caller.srcElement.id == 'btn_trygeoloc_meta')
                {
                    console.log("Rendering meta bbox");
                    tempgeoloc_meta = gq;
                }
                else if  (caller.srcElement.id == 'btn_trygeoloc_proxy')
                {
                    console.log("Rendering proxy bbox");
                    tempgeoloc_proxy = gq;
                }
                renderbbox (gq, cmap, true);


                cleanupFeedback("#proxy_created");

            }
            else
            {

                console.log("No location found");
                postFeedbackMessage(false, "Impossibile individuare la locazione specificata.", "#proxy_created", true);
                console.log(gqdata.results);
            }
        }
        else
        {
            console.log("No location found");
            postFeedbackMessage(false, "Impossibile individuare la locazione specificata.", "#proxy_created", true);
            console.log(gqdata.results);
        }
    });



}


function getCurrentMetaNames()
{
    var metanames = [];

    // TODO: implement, placeholder



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
    console.log ("Checking proxy name from "+formid+": "+candidate);


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

    console.log("Form "+dialogid+" META readiness: "+ready);
    $("#"+dialogid).closest(".ui-dialog").find(".newmeta_create").prop("disabled", !ready);


}


function reviewProxySubmission(dialogid)
{
    // checks if all the parameters to create a proxy are met by looking at the global object newproxychecks


    var ready = (newproxychecks.proxyname && newproxychecks.proxydates && newproxychecks.hasmeta && newproxychecks.hasprovider && newproxychecks.hascontact && (newproxychecks.meta_out.length == 0));

    console.log("Form "+dialogid+" PROXY readiness: "+ready);

    $("#"+dialogid).closest(".ui-dialog").find(".btn_form_create").prop("disabled", !ready);
    //console.log($("#"+dialogid).closest(".ui-dialog").find(".btn_form_create"));
}

function switchProxyDateFields()
{

    // only checks on dateto

    var eid = this.id;
    var hasdateto = $(this).attr("checked");

    var formid = $(this).closest(".creationdialog").attr("id");
    $("#"+formid).find(".proxydatefield.datetofield").prop("disabled", !hasdateto);
    $("#"+formid).find(".proxydatefield.datetofield").change();
}

function verifyProxyContact()
{
    // checks if a valid contact reference has been inserted for this proxy

    console.log("Contact field verfication from field "+this.id);

    // we only need one valid data in all the contact data fields for this to be used
    var isvalid = false;

    var formid = $(this).closest(".creationdialog").attr("id");
    var base = $(this).closest(".creatormask");

    var contactfields = base.find(".proxyfieldcontactdata");

    for (var i = 0; i < contactfields.length; i++)
    {

        console.log("Checking contact field "+contactfields[i].id);

        var fieldval = $(contactfields[i]).val();
        console.log("Field has value "+fieldval);


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

    var switchval = $(this).attr("checked");

    $("#"+destid).prop("disabled", !switchval);
    $("#"+destid).change();

}

function verifyMetaDates()
{

    var isvalid = true;

    var formid = $(this).closest(".creationdialog").attr("id");
    console.log ("Checking proxy dates from "+formid);

    var base = $(this).closest(".creatormask");

    var hasdatefrom = base.find(".metadatefieldswitch.hasdatefrom").attr("checked");
    if (hasdatefrom)
    {
        var datefromval = base.find(".metadatefrom").datepicker("getDate");
        if (datefromval === null)
        {
            isvalid = false;
        }
    }

    var hasdateto = base.find(".metadatefieldswitch.hasdateto").attr("checked");
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

    var hasdateto = base.find(".proxyhasdateto").attr("checked");
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

    zoomToCenter (mapview, defaultLon, defaultLat, 6);

    create_setNavControls(mapview);
    return mapview;
}


function zoomToCenter (widget, lon, lat, zoom)
{

    var lonlat = new OpenLayers.LonLat (lon, lat);
    var projected = lonlat.transform(new OpenLayers.Projection(proj_WGS84), widget.getProjectionObject());

    widget.setCenter(projected, zoom);

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

