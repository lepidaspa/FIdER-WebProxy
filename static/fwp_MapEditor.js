/**
 * Created with PyCharm.
 * User: drake
 * Date: 7/5/12
 * Time: 8:22 AM
 * To change this template use File | Settings | File Templates.
 */

// Projection systems
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

// data needed to load the map we are working on
var proxy_id;
var meta_id;
var map_id;
var proxy_name;

// list of all the maps available in the same metadata, to be used as additional layer and for snapping
var maps;

// the static corner map that show the general area of interest of the current file
// (does not include background files added to it)
var minimap;

// the map used for the actual editing work, in the center of the screen
var mapview;
// type of object we have in the map
var maptype;

// full json data for the main (editable) map
var coredata;
// full json data for the background map used for snap only
var snapdata;


// layer where we draw the current state of the main map
var vislayer;
// layer where we draw any additional map used for snapping purposes
var snaplayer;

var drawcontrol;
var editcontrol;
var snapcontrol;
var removecontrol;
var infocontrol;
var panel;


// Full list of properties allowed for each kind of map, loaded from the server at python level and extracted for the kind of map we are currently using via js
var datamodel;

// TODO: replace with final naming
var modelref = { 'Point': 'Well', 'LineString': 'Duct', 'MultiLineString' : 'Duct'};

var newfeature_prefix = "PIPERGIS_new_";
var newfeature_id = 0;



/*
The changelist shows ALL changes to the map in sequence. It does not combine changes, so it can be used as an undo list to work back step by step.
The changesource shows the state of the modified elements at load time, so we can check quickly if a modification has been undone (such as new features being deleted, attributes being corrected) and do a faster compare with the main server
 */
var changesource = {};
var changelist = new Array();

var prechange = {};

var idlink;


function pageInit (req_proxy, req_meta, req_map, req_maplist, req_model)
{
/*
Loads the main map and the list of additional maps
 */

    $("#renderingstate").hide();
    $("#savingstate").hide();
    $("#btn_savechanges").hide();



    proxy_id = req_proxy;
    meta_id = req_meta;
    map_id = req_map;

    maps = jQuery.parseJSON(req_maplist);

    datamodel = req_model;
    //alert(JSON.stringify(datamodel));

    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";

    setLoadingState();
    loadMainMap();


    $("#sel_setshadow").change(setShadowLayer);


    $(".btn_save").live('click', saveAttributeChanges);
    $(".btn_remove").live('click', renderRemoveMask);
    $(".canceldelete").live('click', cancelDeleteFeature);
    $(".deleteok").live('click', deleteCurrentFeature);
    $("#btn_savechanges").click(saveMapChanges);


}

function setLoadingState()
{
    $("#loadingstate").show();
5


}

function unsetLoadingState()
{
    $("#loadingstate").hide();
}


function loadMainMap()
{
    /*
    Loads the json data of the map to be edited as an async operation, then renders it on the mini and main map
     */

    var urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id;


    $.ajax ({
        url:    urlstring,
        async:  true
    }).done(function (jsondata) {


        coredata = jsondata;



        //alert ("Loaded map "+map_id+"\n"+JSON.stringify(coredata));
        renderMiniMap('minimap');
        renderMainMap('mapview');
        unsetLoadingState();

    });



}


function renderMiniMap (widgetid)
{


    minimap = new OpenLayers.Map(widgetid, {controls: []});
    minimap.projection = proj_WGS84;
    minimap.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var layer = new OpenLayers.Layer.OSM();

    minimap.addLayer(layer);

    var bbox = (coredata['bbox']);
    zoomToBBox(minimap, bbox);

}

function setShadowLayer()
{
    // removes the current background layer and, if needed loads the new one

    snaplayer.removeAllFeatures();
    var newshadow = $("#sel_setshadow").val();
    if (newshadow != "")
    {
        loadShadowLayer(newshadow);
    }


}

function loadShadowLayer (map_id)
{
    /*
    Loads the "background" vector for the main map
     */


    var urlstring = "/fwp/maps/"+proxy_id+"/"+meta_id+"/"+map_id;

    $.ajax ({
        url:    urlstring,
        async:  true
    }).done(function (jsondata) {

                snapdata = jsondata;
                renderGeoJSON (snapdata, mapview, snaplayer);

            });


}


function renderMainMap (widgetid)
{

    maptype = coredata['features'][0]['geometry']['type'];
    //alert("Map type: "+maptype);

    mapview = new OpenLayers.Map('mapview', {controls: []});
    mapview.projection = proj_WGS84;
    mapview.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var baselayer = new OpenLayers.Layer.OSM();
    mapview.addLayer(baselayer);

    var featurestyle;
    var featurestylemap;

    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#888888", strokeColor: "#888888", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "background" layer
    snaplayer= new OpenLayers.Layer.Vector("Riferimento", {styleMap: featurestylemap});
    mapview.addLayer(snaplayer);

    // setting style
    //featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    //featurestylemap = new OpenLayers.StyleMap(featurestyle);
    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#ff9900", strokeColor: "#ff9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});
    // adding the "state" layer
    vislayer= new OpenLayers.Layer.Vector("Mappa", {styleMap: featurestylemap});
    mapview.addLayer(vislayer);


    renderGeoJSON (coredata, mapview, vislayer);
    createIdTable (coredata);

    /* TODO: check if we can work directly on the  vislayer layer
    // setting style
    featurestyle = new OpenLayers.Style ({fillOpacity: 0.4, fillColor: "#00aaff", strokeColor: "#00aaff", strokeWidth: 1, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap(featurestyle);
    // adding the "work" layer
    modlayer= new OpenLayers.Layer.Vector("Metadata", {styleMap: featurestylemap});
    mapview.addLayer(modlayer);
    */



    // add snap control
    snapcontrol = new OpenLayers.Control.Snapping ({
        layer: vislayer,
        targets: [vislayer, snaplayer],
        greedy: false
    });
    mapview.addControl(snapcontrol);
    snapcontrol.activate();


    // Adding editing controls
    panel = new OpenLayers.Control.Panel({
        displayClass: "olControlEditingToolbar"
    });

    if (maptype == "Point")
    {
        drawcontrol = new OpenLayers.Control.DrawFeature(
                vislayer, OpenLayers.Handler.Point,
                {
                    displayClass: "olLabsControlDrawFeaturePoint",
                    title: "Aggiungi",
                    handlerOptions:
                    {
                        holeModifier: "altKey"
                    },
                    featureAdded: (setNewFid)
                }
        );
    }
    else
    {
        drawcontrol = new OpenLayers.Control.DrawFeature
            (
                vislayer, OpenLayers.Handler.Path,
                {
                    displayClass: "olLabsControlDrawFeaturePoint",
                    title: "Aggiungi",
                    handlerOptions:
                    {
                        holeModifier: "altKey"
                    },
                    featureAdded: (setNewFid)
                }
            );
    }



    editcontrol = new OpenLayers.Control.ModifyFeature(
            vislayer, {
                displayClass: "olLabsControlModifyFeature",
                title: "Modifica"

            }
    );
    panel.addControls([
        //new OpenLayers.Control.Navigation({title: "Navigate"}),
        drawcontrol, editcontrol
    ]);

    mapview.addControl(panel);

    mapview.addControl(new OpenLayers.Control.Navigation());
    mapview.addControl(new OpenLayers.Control.PanZoomBar());
    mapview.addControl(new OpenLayers.Control.MousePosition());


    vislayer.events.register('featureselected', mapview, renderFeatureCard);
    vislayer.events.register('featureunselected', mapview, freeSelection);


    var bbox = (coredata['bbox']);
    zoomToBBox(mapview, bbox);


    //alert(mapview.controls);

}

function createIdTable (jsondata)
{
    // we also set up a mapping from tids to fids
    // ID is the id ATTRIBUTE of the feature in the json, tid its id as memeber of the array, fid the ID attribute as translated in the map

    //TODO: placeholder, implement

    idlink = {};

    for (var tid in jsondata['features'])
    {

        var fid = jsondata['features'][tid]['id'];

        idlink[fid] = tid;

    }

}

function freeSelection (caller)
{

    var selected = caller['feature'];

    if ((selected.geometry != prechange.geometry) || (selected.attributes != prechange.attributes))
    {

        //alert("Updating feature "+selected['fid']);
        // we have changes to register
        updateChangeSource();
        updateChangelist();
    }

    //alert("Unselected "+feature.fid);
    prechange = null;
    $("#currentfeature").empty();

}


function setNewFid (feature)
{

    //vislayer.addFeatures ([feature]);

    feature.fid = newfeature_prefix+newfeature_id.toString();
    newfeature_id++;
    vislayer.addFeatures([feature]);


    // changesource to null since we want to clarify the object is CREATED
    changesource[feature.fid] = null;

    prechange = {
        'fid':              feature.fid,
        'geometry':         feature.geometry,
        'attributes':       feature.attributes
    };

    updateChangelist();


}

function updateChangelist ()
{

    /*
    Adds the last change to the changelist
     */

    var cfid = prechange['fid'];

    /* removing, not really needed
    TODO: confirm removal

    var oldstate = {
        'geometry':     prechange.geometry,
        'attributes':   prechange.attributes
    };
     */

    var feature = vislayer.getFeatureByFid(cfid);

    var changedata = {
        'fid':              cfid
        //'prev':             oldstate
    };


    if (feature != null)
    {
        changedata ['current'] = {
                        'geometry':     feature.geometry,
                        'attributes':   feature.attributes
                    }
    }
    else
    {
        // we deleted the feature so there is no data to work on
        changedata['current'] = null;
    }


    changelist.push(changedata);
    $("#btn_savechanges").show();


}

function updateChangeSource (featureid)
{

    /*
    Adding a feature to the changesource list, will actually be done only once
     */
    var fid = prechange['fid'];

    if (!changesource.hasOwnProperty(fid))
    {
        changesource[fid] = {
            geometry:   coredata['features'][idlink[fid]]['geometry'],
            attributes: coredata['features'][idlink[fid]]['properties']
        }
    }

}


function renderFeatureCard (caller)
{
    //TODO: consider streamlining this with globals, since we cannot have different types in  the same file


    var feature = caller['feature'];
    //alert("Selected "+feature.fid+": "+JSON.stringify(feature.geometry)+"\n"+JSON.stringify(feature.attributes));

     var typename;
    if (maptype == 'Point')
    {
        typename = "Accesso";
    }
    else
    {
        typename = "Tratta";
    }



    var str_btn_remove = '<img alt="Elimina" class="btn_remove" id="remove_'+feature.fid+'" src="/static/resource/fwp_remove.png">';
    var str_btn_save = '<img alt="Salva modifiche" class="btn_save" id="update_'+feature.fid+'" src="/static/resource/fwp_savechanges.png">';
    var fcontrols = '<div class="featureactions">'+str_btn_save+" "+str_btn_remove+'</div>';

    var fstats = '<div id="feature_desc">'+feature.fid+'. '+typename+'</div>';

    var fcard = '<div class="featurecard" id="f_'+feature.fid+'">'+fcontrols+fstats+'<div id="featuremask">'+renderAttributesMask(feature)+'</div></div>';

    $("#currentfeature").empty();
    $("#currentfeature").append(fcard);

    /*
     Since this is called every time we select a feature, we use it as a pre-select to prepare the data for the changelist and changesource variables
     */

    prechange = {
        'fid':              feature.fid,
        'geometry':         feature.geometry,
        'attributes':       {}
    };

    for (var attrname in feature.attributes)
    {
        prechange['attributes'][attrname] = feature.attributes[attrname];
    }



}

function cancelDeleteFeature ()
{

    var prefix = "canceldelete_";
    var fid = this.id.substr(prefix.length);

    $("#featuremask").empty();
    $("#featuremask").append(renderAttributesMask(vislayer.getFeatureByFid(fid)));

}




function renderAttributesMask (feature)
{

    var mtype = modelref[maptype];

    //alert(mtype+"\n"+JSON.stringify(datamodel)+"\n"+JSON.stringify(feature.attributes));

    var props = datamodel[mtype];

    var table_props = '<table id="feature_props">';
    for (var p in datamodel[mtype])
    {
        var cvalue = "";
        if (feature['attributes'][p])
        {
            cvalue =  feature['attributes'][p];
        }

        table_props += '<tr><td>'+p+'</td><td><input class="feature_attrs" type="text" id="feature_attr_'+p+'" value="'+cvalue+'"></td></tr>';
    }

    table_props += '</table>';

    return table_props;

}

function renderRemoveMask ()
{

    var prefix = "remove_";
    var fid = this.id.substr(prefix.length);

    $("#featuremask").empty();

    var removalconfirm = 'Vuoi eliminare questo elemento dalla mappa?' +
            '<input type="button" class="deleteok" id="deleteok_'+fid+'" value="Conferma"><input type="button" class="canceldelete" id="canceldelete_'+fid+'" value="Annulla">';

    $("#featuremask").append(removalconfirm);

}

function deleteCurrentFeature()
{

    var prefix = "deleteok_";
    var fid = this.id.substr(prefix.length);


    updateChangeSource();

    vislayer.removeFeatures(vislayer.selectedFeatures);

    updateChangelist();

    $("#currentfeature").empty();

    editcontrol.deactivate();
    editcontrol.activate();

}



function saveAttributeChanges ()
{

    var newattrs= {};
    var prefix = "update_";

    var fid = this.id.substr(prefix.length);

    //alert("Launched via "+fid);

    $(".feature_attrs").each( function (i)
    {
        prefix = 'feature_attr_';
        var attr_name = $(this).attr('id').substr(prefix.length);
        newattrs[attr_name] = $(this).val();
    });

    //alert("Changing features for "+vislayer.getFeaturesByFid(fid));

    vislayer.getFeatureByFid(fid)['attributes']= newattrs;


    var feedbackmess = '<div class="feedback success">Dati aggiornati.</div>';

    $(".feedback").remove();
    $("#feature_props").after(feedbackmess);
    updateChangeSource();
    updateChangelist();


    //alert("New attributes for feature "+feature.fid+": "+JSON.stringify(vislayer.getFeaturesByFid(fid).attributes));

}


function renderGeoJSON (shapedata, map, maplayer)
{

    var geojson_format = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection':map.getProjectionObject()});

    var stringmap = JSON.stringify(shapedata);
    var formatmap = geojson_format.read(stringmap);
    maplayer.addFeatures(formatmap);






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


function compressChangelist()
{
    /*
    reduces the changelist to one modification per item
     */

    console.log("CHANGES, FULL:\n"+changelist+"\n****************");

    //todo: placeholder, implement
    var compressed = {};

    var gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': mapview.getProjectionObject()});

    for (var i in changelist)
    {


        var change = changelist[i];
        var cfid = change['fid'];

        if (!compressed.hasOwnProperty(cfid))
        {
            compressed[cfid] = {
                'origin': {},
                'current': {}
            };
            //compressed[cfid]['origin'] = changesource[cfid];


            if (changesource[cfid] != null)
            {

                // pre-existing object has been modified

                compressed[cfid]['origin']['attributes'] = changesource[cfid]['attributes'];
                // we  switched to the json data so we do not need the conversion anymore
                //compressed[cfid]['origin']['geometry'] = JSON.parse(gjformat.write(changesource[cfid]['geometry']));
                compressed [cfid]['origin']['geometry'] = changesource[cfid]['geometry'];

            }
            else
            {
                // object has been created from scratch
                compressed[cfid]['origin'] = null;
            }

        }


        if (change['current'] != null)
        {

            // object has been modified with new data

            //compressed[cfid]['current'] = change['current'];
            compressed[cfid]['current']['attributes'] = change['current']['attributes'];
            compressed[cfid]['current']['geometry'] = JSON.parse(gjformat.write(change['current']['geometry']));
        }
        else
        {
            // object has been deleted

            compressed[cfid]['current'] = null;

        }



    }


    return compressed;

}



function saveMapChanges ()
{

    // first we get a compressed list of changes for the comparison

    var changes = compressChangelist();
    console.log(JSON.stringify(changes));

    // We try to save. *IF* there is an inconsistency, then we switch to the correction flow and see what we want to do with an additional layer showing the synced and unsynced objects and a mask on the side to confirm them.

    var urlstring = '/edit/update/'+proxy_id+"/"+meta_id+"/"+map_id+"/";

    var modelstruct = {};
    modelstruct["mid"] = modelref[maptype];
    modelstruct["struct"] = datamodel[modelref[maptype]];

    $.ajax (
        {
            url:    urlstring,
            data:   {changelist: JSON.stringify(changes), model: JSON.stringify(modelstruct)},
            async:  true,
            type:   'POST',
            success: function (data) {
                //NOTE: success can still return a failed update in case the two maps are not in sync. Our return data will be a boolean (updated/not updated) and a report with the new id and state of each submitted object, OR a list of the out of sync objects
                if (data['success'] == true)
                {
                    // update the changesource variable
                    console.log("Modification successful");
                    rebuildChangeSource (changes, data['report']);
                    $("#btn_savechanges").hide();

                    postFeedbackMessage(data['success'],"Modifiche salvate correttamente.","#states");


                }
                else
                {
                    console.log("Modification failed");
                    // open mask for handling of inconsistencies
                    postFeedbackMessage(data['success'],"Aggiornamento fallito.","#states");
                    renderResaveMask (changes, data['report']);




                }

            },
            error: function (data)
            {

                console.log("General error during modification");
                console.log(data.responseText);

                //postFeedbackMessage("fail", "ERRORE: "+JSON.stringify(data), container)
            }
        }
    );





}

function postFeedbackMessage (success, report, widgetid)
{
    var status = success;
    var message = report;

    var feedbackclass;
    if (status == true)
    {
        feedbackclass = "success";
    }
    else
    {
        feedbackclass = "fail";
    }

    var feedbackmess = '<div class="feedback '+feedbackclass+'">' +message+ '</div>';

    $(widgetid).append(feedbackmess);
}



function rebuildChangeSource (changes, confirmation)
{

    /*
    Updates the status of the changed elements so that they reflect the IDs in the confirmation data.
     */

    console.log("Confirmation list:"+JSON.stringify(confirmation));

    idlink = {};

    var gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': mapview.getProjectionObject()});


    var linkerdelta = 0;
    var cseqid;
    for (var fid in confirmation)
    {

        if (confirmation[fid] != null)
        {

            var cfid = parseInt(confirmation[fid]);

            var current = vislayer.getFeatureByFid(fid);
            //console.log(JSON.stringify(current.geometry));
            //console.log(JSON.stringify(current.attributes));
            //console.log("id->"+current.id+"->fid"+current.fid);

            current.fid = cfid;

            var cfeature = {};
            cfeature['type'] = 'Feature';
            cfeature['id'] = cfid;
            cfeature['properties'] =  current.attributes;
            cfeature['id'] = cfid;
            cfeature['geometry'] = gjformat.write(current.geometry);

            if (!idlink.hasOwnProperty(confirmation[fid]))
            {
                coredata['features'].push(cfeature);
            }
            else
            {
                cseqid = current.fid - linkerdelta;
                coredata['features'][cseqid] = cfeature;
            }

            console.log("Element fid "+fid+" moved to fid "+current.fid);
        }
        else
        {


            if (idlink.hasOwnProperty(fid))
            {

                //TODO: delete element in sequence and add 1 to linkerdelta

                cseqid = idlink[fid] - linkerdelta;
                coredata.splice(cseqid, 1);
                linkerdelta++;

            }

            console.log("Element fid "+fid+" deleted ");
        }
    }


    createIdTable(coredata);
    changesource = {};






}


function renderResaveMask (changes, consistency)
{
    /*
    Creates a mask that allows the user to see what can be saved and what is out of sync and choose to either: Cancel all changes and reload the map, Save the consistent elements,
     */

    var statustable = '<table id="consistencycheck"><tr><th>Elemento</th><th>Stato</th></tr>';

    for (var fid in consistency)
    {
        statustable += '<tr><td>'+fid+'</td><td>'+consistency[fid]+'</td></tr>';
    }

    statustable += '</table>';

    var mask = '<div id="resavemask">'+statustable+'</div>';




}