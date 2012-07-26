/**
 * Created with PyCharm.
 * User: drake
 * Date: 7/23/12
 * Time: 11:37 AM
 * To change this template use File | Settings | File Templates.
 */


// Projection systems
var proj_WGS84 = "EPSG:4326";
var proj_900913 = "EPSG:900913";

// variables from django template
var proxy_id;
var proxy_name;
var proxy_bb;
var proxy_meta;
var maps_fider;
var maps_st;


// the main map
var mapview;
// the layer of the main map on which we are drawing the vectors
var vislayer;
var snaplayer;

var activemap;
var snapmap;
// boolean: tells if we are creating a new map or editing an old one
var createmode = false;


// full json data of the main map and the snap map
var mapdata;
var snapdata;

// geometry type string for the current map
var maptype;

// model_id when creating a new map
var mapmodel;

// fields for each feature: based on the model/additions if applicable, plus any property descriptors in the single features.
var fields;

// String used to describe the featuretype in the interface, if possible it is pulled from the model, otherwise we use a generic description
var ftype_name;

var models;

// controls on the map
var panel;
var drawcontrol;
var measurecontrol;
var snapcontrol;
var editcontrol;

// links the actual FID with the sequence id in the map [ features ] array
var idlink;

// featureId currently in use
var currentfid;

// arrays by FID
// values BEFRORE anychange (added the first time an element is selected)
var prechange = null;
// values AFTER the LATEST change
var changelist = null;

var newfidprefix = "+";
var newfeatureid = 0;

// format to retrieve geometries from the map in geojson
var gjformat;

// if the application is currently saving data on the proxy
var issaving = false;


function pageInit(req_proxy_id, req_proxy_manifest, req_proxy_meta, req_maps_fider, req_maps_st, req_models)
{

    OpenLayers.ImgPath = "/static/OpenLayers/themes/dark/";


    $("#states > *").hide();
    $("#currentfeature").hide();
    toggleContextGuide();

    console.log("Init page...");

    proxy_id = req_proxy_id;
    proxy_name = req_proxy_manifest['name'];
    proxy_bb = req_proxy_manifest['area'];

    // list of metadata names
    proxy_meta = req_proxy_meta;

    // list of maps by meta
    maps_fider = req_maps_fider;

    // list of maps in the standalone tool
    maps_st = req_maps_st;

    // map models allowed by the main server
    console.log("Received models from server: "+JSON.stringify(req_models));
    models = req_models;




    console.log ("Init map...");
    createMap('mapview');




    console.log ("Init context mask...");
    renderContextMask();

    $("#btn_loadmap").live('click', loadSetMap);
    $("#btn_loadsnap").live('click', loadShadowMap);
    $("#txt_addfield").live('change mouseup keyup', checkNewFieldName);
    $("#btn_addfield").live('click', addNewField);
    $("#maploader").live('change',checkSaveState);
    $("#txt_saveto").live('change mouseup keyup', checkMapSaveName);
    $("#btn_savechanges").live("click", integrateMapChanges);

    // Removed: we update on deselection
    //$(".setproperty").live('change mouseup keyup', updateFieldInMap);

    resetContext();

}

function checkMapSaveName()
{
    var cname = $("#txt_saveto").val();

    if (cname.match(/^[A-Za-z0-9_]+$/)==null)
    {
        console.log("Non valid filename "+cname);
        $("#btn_savechanges").addClass('disabled');
        $("#btn_savechanges").removeClass('warning');
    }
    else
    {
        console.log("Valid filename "+cname);
        $("#btn_savechanges").removeClass('disabled');
        checkSaveState();

    }

}


function checkSaveState()
{
    if (changelist && $("#maploader").val()!="")
    {
        $("#btn_savechanges").addClass('warning');
    }
    else
    {
        $("#btn_savechanges").removeClass('warning');
    }

    if ($("#maploader").val()=="")
    {
        $("#btn_loadmap").prop('disabled', true);
        $("#btn_savechanges").removeClass('warning');
    }
    else
    {
        $("#btn_loadmap").prop('disabled', false);
        if (changelist)
        {
            $("#btn_savechanges").addClass('warning');
        }
    }

}

function buildUpdatedMap ()
{
    // combining changelist and mapdata

    if (mapdata)
    {
        var savedata = mapdata;
    }
    else
    {
        savedata = {
            'type': "FeatureCollection",
            'id': $("#txt_saveto").val(),
            'features': []
        }
    }


    // getting the highest id
    var maxid = 0;
    var cfid;
    for (cfid in idlink)
    {
        if (cfid > maxid)
        {
            maxid = cfid;
        }
    }


    // first we change and add, deleted items are removed later
    var removable = [];
    for (cfid in changelist)
    {
        var seqid = idlink[cfid];

        if (seqid)
        {
            if (changelist[cfid] != null)
            {
                // modified feature
                savedata['features'][seqid]['geometry'] = changelist[cfid]['geometry'];                savedata['features'][seqid]['properties'] = changelist[cfid]['properties'];
                savedata['features'][seqid]['id'] = cfid;
            }
            else
            {
                removable.push(cfid);
            }
        }
        else
        {
            // added feature
            maxid++;
            var cfeature = {};

            cfeature['type'] = 'Feature';
            cfeature['geometry'] = changelist[cfid]['geometry'];
            cfeature['id'] = maxid;
            cfeature['properties'] = changelist[cfid]['properties'];
            savedata['features'].push(cfeature);
        }
    }



    // now we remove the removed elements from the saved map
    var removed = 0;
    for (var r in removable)
    {
        seqid = idlink[removable[r]]-removed;
        savedata['features'].splice(seqid,1);
        removed++;
    }

    return savedata;
}

function integrateMapChanges()
{
    // commit local changes to the changelist
    freeSelection();

    // the map is saved IN FULL at the moment. We wait before removing the original mapdata variable in case there are saving issues. The map is saved to a chosen name authoritatively


    var savedata = buildUpdatedMap();

    saveMapChanges(savedata);

}


function setSavingState(savemode)
{

    issaving = savemode;
    if (issaving)
    {
        $("#savingstate").show();
        $("#btn_savechanges").addClass('disabled');
        $("#btn_savechanges").removeClass('warning');
    }
    else
    {
        $("#savingstate").hide();
        $("#btn_savechanges").removeClass('disabled');
        //TODO: placeholder implement
    }

}

function saveMapChanges(savedata)
{

    setSavingState(true);

    console.log("DEBUG: save data");
    console.log(savedata);

    var urlstring = '/stsave/'+proxy_id+"/";

    $.ajax (
        {
            url:    urlstring,
            data:   {
                mapname: $("#txt_saveto").val(),
                jsondata: JSON.stringify(savedata)
            },
            async:  true,
            type:   'POST',
            success: confirmSave,
            error: warnSaveFail
        }
    );

}

function confirmSave (jsondata, status, jqXHR)
{
    //TODO: placeholder, implement
    console.log("Save successful? ");
    console.log(jsondata);

    alert(jsondata['report']);

    setSavingState(false);

    if (jsondata['success'])
    {
        finalizeSave();

    }


}

function finalizeSave()
{
    // This function is launched when a save is confirmed as complete AND successful
    console.log("Finalizing save...");
    mapdata = buildUpdatedMap();
    prechange = null;
    changelist = null;
    activemap = ".st/"+$("#txt_saveto").val();


    var mapmodel_req = mapmodel;
    var maptype_req = maptype;



    maps_st.push($("#txt_saveto").val());
    // we reset the context at the end so we can resume work from the new starting point
    resetContext();

    mapmodel = mapmodel_req;
    maptype = maptype_req;

    renderContextMask();
    checkSaveState();

}

function warnSaveFail (jqXHR, status, errorThrown)
{
    //TODO: placeholder, implement
    console.log("Save failed: "+status);
    alert("Salvataggio fallito");
    setSavingState(false);
}



function loadSetMap ()
{

    var mapurl = ($("#maploader").val());


    var metamap = mapurl.split("/");

    if (metamap[0] != '.new')
    {
        loadMap(mapurl);
        createmode = false;
    }
    else
    {
        resetContext();
        createmode = true;
        mapmodel = metamap[1];
        maptype = models[metamap[1]]['objtype'];
        ftype_name = models[metamap[1]]['name'];
        setMapControls();
        renderContextMask();
    }

}

function toggleContextGuide()
{
    if (!$("#contextguide").is(':hidden'))
    {
        $("#contextguide").hide();
        $("#functionality").css("right", "0");
        $("#functionality").css("border-right", "none");
    }
    else
    {
        $("#contextguide").show();
        $("#functionality").css("right", "25%");
        $("#functionality").css("border-right", "1px solid #ffff00");
    }

}


function createMap (widgetid)
{

    // resetting the widget in case there is an older map and we are loading a new one
    $("#"+widgetid).empty();

    //maptype = coredata['features'][0]['geometry']['type'];
    //alert("Map type: "+maptype);

    //mapview = new OpenLayers.Map(widgetid, {controls: []});
    mapview = new OpenLayers.Map(widgetid);
    mapview.projection = proj_WGS84;
    mapview.displayProjection = new OpenLayers.Projection(proj_WGS84);

    var baselayer = new OpenLayers.Layer.OSM();
    mapview.addLayer(baselayer);


    // setting the format to translate geometries out of the map
    gjformat = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection': mapview.getProjectionObject()});




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
    var defaultstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#FF9900", strokeColor: "#FF9900", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var selectstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    var drawstyle = new OpenLayers.Style ( {fillOpacity: 0.4, fillColor: "#0000FF", strokeColor: "#0000FF", strokeWidth: 2, strokeDashstyle: "solid", pointRadius: 6});
    featurestylemap = new OpenLayers.StyleMap ({'default': defaultstyle, 'select': selectstyle, 'temporary': drawstyle});
    // adding the "state" layer
    vislayer= new OpenLayers.Layer.Vector("Mappa", {styleMap: featurestylemap});
    mapview.addLayer(vislayer);


    autoZoom(mapview);



}


function setMapControls ()
{
    /*
    We set the controls for the map at loading time after we know which kind of map we are working with (different drawing controls); requires the maptype global variable to be set (or no editing controls)
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
                featureAdded: (createNewFeature)
            }
        );
    }
    else if (maptype == "LineString")
    {
        drawcontrol = new OpenLayers.Control.DrawFeature
            (
                vislayer, OpenLayers.Handler.Path,
                {
                    displayClass: "olLabsControlDrawFeaturePath",
                    title: "Aggiungi",
                    handlerOptions:
                    {
                        holeModifier: "altKey"
                    },
                    featureAdded: (createNewFeature)
                }
            );
    }



    editcontrol = new OpenLayers.Control.ModifyFeature(
        vislayer, {
            displayClass: "olLabsControlModifyFeature",
            title: "Modifica"
        }
    );




    measurecontrol = new OpenLayers.Control.Measure(

        OpenLayers.Handler.Path, {
            eventListeners:
            {
                'measure': handleMeasure,
                'measurepartial': handleMeasure,
                'deactivate': hideDistance
            },
            handlerOptions:
            {
                persist: true,
                immediate: true
            },
            displayClass: 'olLabsControlMeasure',
            displayUnits: 'm',
            title: "Misura"

        });



    // setting panel-based controls
    panel.addControls([
        //new OpenLayers.Control.Navigation({title: "Navigate"}),
        drawcontrol, editcontrol, measurecontrol
    ]);

    // binding controls to the map
    mapview.addControl(panel);
    mapview.addControl(new OpenLayers.Control.Navigation());
    mapview.addControl(new OpenLayers.Control.PanZoomBar());
    mapview.addControl(new OpenLayers.Control.MousePosition());

    vislayer.events.register('featureselected', mapview, renderFeatureCard);
    vislayer.events.register('featureunselected', mapview, freeSelection);

}

function addToPreChange(fid)
{
    /*
    Adds the current status of the requested feature to the prechange dict
    IF the feature has not been added already
     */

    // init prechange if needed
    if (!prechange)
    {
        prechange = {};
    }

    $("#btn_savechanges").show();

    if (!prechange.hasOwnProperty(fid))
    {

        if (idlink[fid])
        {

            // IF this is an object that was already on the map

            prechange[fid] = {
                'geometry': mapdata['features'][idlink[fid]]['geometry'],
                'properties': mapdata['features'][idlink[fid]]['properties']
            }
        }
        else
        {

            // IF the object has just been added
            prechange[fid] = null;

        }


    }

}

function getFeatureProps (fid)
{
    /*
    Retrieves the most updated attributes/properties for the requested feature, checking on the changelist and mapdata as needed. Always returns ALL the fields in the fields[] array. This does not retrieve geometry as that is always displayed on the viewport in its most up to date state
     */

    var props = {};

    if (changelist && changelist[fid])
    {
        // if the feature has its data in the changelist, this is surely the most up to date
        console.log("Getting properties from changelist for "+fid);

        props = changelist[fid]['properties'];


    }
    else
    {
        // we can have a feature that has been added but not updated (so it has all empty values or a feature in the mapdata array

        if (idlink[fid])
        {
            console.log("Getting properties from mapdata for "+fid);
            // existing in the original map
            props = mapdata['features'][idlink[fid]]['properties'];
        }

    }


    // adding fields that were not used
    for (var f in fields)
    {

        var cfield = fields[f];

        if (!props[cfield])
        {
            props[cfield] = "";
        }


    }

    return props;






}

function updateChangeList()
{

    if (!changelist)
    {
        changelist = {};
    }

    /*
    Add modifications for a specific feature to the changelist
     */

    if (!currentfid)
    {

        // if triggered without a feature in use

        return;
    }

    // TODO: placeholder, implement
    console.log ("updating the changelist with element "+currentfid);

    if (!changelist[currentfid])
    {
        changelist[currentfid] = {};
    }

    // we take the geometry from the map

    changelist[currentfid]['geometry'] = JSON.parse(gjformat.write(vislayer.getFeatureByFid(currentfid).geometry));


    // and the feature properties from the form IF open, otherwise from mapdata/
    if ($(".featurefield.setproperty").length > 0)
    {
        // if we have a form open we clean up before adding/changing the values

        console.log("Saving properties from form");

        changelist[currentfid]['properties'] = {};
        $.each($(".featurefield.setproperty"), function ()
        {

            var fieldid = (this.id.split("_")[1]);
            var fieldval = $("#"+this.id).val();

            changelist[currentfid]['properties'][fields[fieldid]] = fieldval;

        });

    }
    else if (idlink[currentfid])
    {

        // without the form, in case we have nothing yet in the changelist for this item, we get from mapdata; IF the object is in the map

        if (!changelist[currentfid]['properties'])
        {
            changelist[currentfid]['properties'] = mapdata['features'][idlink[currentfid]]['properties'];
        }

    }
    else
    {
        changelist[currentfid]['properties'] = {};
    }

    console.log("Current status of feature "+currentfid);
    console.log(changelist[currentfid]);




}

function deleteFeature (fid)
{
    //TODO: placeholder, implement

    changelist[fid] = null;

}


function createNewFeature(feature)
{

    // set new FID and then add to the prechange and changelist lists

    console.log("Creating new feature");
    console.log(feature);

    // openlayers id
    var olid = feature.id;

    var newfid = newfidprefix + newfeatureid;
    feature.fid = newfid;
    currentfid = newfid;

    newfeatureid++;


    addToPreChange(newfid);
    updateChangeList();




}

function renderFeatureCard(caller)
{



    $("#currentfeature").empty();

    var featurecard = $('<div class="featurecard"></div>');

    var feature = caller['feature'];
    currentfid = feature.fid;

    addToPreChange(currentfid);

    console.log('Selected feature '+feature.fid+': '+ftype_name);
    console.log(feature.attributes);

    featurecard.append('<div class="cardtitle">'+ftype_name+' '+feature.fid+'</div>');

    //TODO: populate with data from either CHANGELIST (last update) or MAPDATA *if* object in idlink table



    var featurefields = $('<table id="featurefields"></table>');
    for (var f in fields)
    {
        var props = getFeatureProps(currentfid);
        featurefields.append('<tr><td>'+fields[f]+'</td><td><input type="text" class="featurefield setproperty" id="featurefields_'+f+'" value="'+props[fields[f]]+'"></td></tr>');
    }

    var addfield = '<tr id="tr_addfield"><td colspan=2><hr></td></tr>' +
        '<tr><td>' +
        'Nuovo campo' +
        '</td><td>' +
        '<input class="featurefield" type="text" value="" id="txt_addfield"><input type="button" id="btn_addfield" value="+">' +
        '</td></tr>';

    featurefields.append(addfield);
    featurecard.append(featurefields);

    $("#currentfeature").append(featurecard);


    $("#currentfeature").show();
    checkNewFieldName();
}



function checkNewFieldName ()
{
    var ftitle = $("#txt_addfield").val();

    if (ftitle && fields.indexOf(ftitle) == -1 && ftitle.length > 0)
    {
        $("#btn_addfield").prop('disabled', false);
    }
    else
    {
        $("#btn_addfield").prop('disabled', true);
    }

}

function addNewField ()
{

    console.log("Adding new field");

    var ftitle = $("#txt_addfield").val();
    fields.push(ftitle);
    var idx = fields.length-1;

    var fieldstring = '<tr><td>'+ftitle+'</td><td><input type="text" class="featurefield setproperty" id="featurefields_'+idx+'"></td></tr>';

    $("#tr_addfield").before(fieldstring);
    $("#txt_addfield").val("");
    checkNewFieldName();




}


function freeSelection ()
{
    console.log("Deselecting feature");

    updateChangeList();

    currentfid = null;
    $("#currentfeature").empty();
    $("#currentfeature").hide();
}

function createIdTable (jsondata)
{
    // we also set up a mapping from tids to fids
    // SEQID is the id ATTRIBUTE of the feature in the json, tid its id as memeber of the array, FID the featureid attribute as translated in the map


    idlink = {};

    for (var seqid in jsondata['features'])
    {
        var fid = jsondata['features'][seqid]['id'];
        idlink[fid] = seqid;
    }

}


function handleMeasure(event)
{

    //var geometry = event.geometry;
    var units = event.units;

    var precision;
    if (units == 'm')
    {
        precision = 2;
    }
    else
    {
        precision = 3;
    }

    var measure = event.measure.toFixed(precision);

    var measureinfo = "Distanza: "+measure+" "+units;
    console.log(measureinfo);

    $("#currentfeature").empty();
    $("#currentfeature").append(measureinfo);
    $("#currentfeature").show();

}

function hideDistance()
{
    //TODO: placeholder, implement
}


function renderContextMask ()
{
    /*
    Draws the context mask: if a map is open will contain a summary, plus options to create or load existing maps;
     */

    $("#currentcontext").empty();
    $("#summary").empty();
    $("#mapcontrol").empty();


    var contextsummary = $('<table id="contextsummary"></table>');
    var contextdesc = proxy_name;

    fields = [];

    if (activemap)
    {
        // we draw the context description string only if there is an active map, which is set AFTER loading the related JSON data
        var mapmeta = activemap.split("/");

        if (mapmeta[0] != '.st')
        {
            contextdesc += " : "+mapmeta[0]+" : "+mapmeta[1];
        }
        else
        {
            contextdesc += " : "+mapmeta[1];
        }



        if (snapmap)
        {
            var snapmeta = snapmap.split("/");
            if (snapmeta[0]!='.st')
            {
                contextdesc += '<br>('+snapmeta[0]+' : '+snapmeta[1]+')';
            }
            else
            {
                contextdesc += '<br>('+snapmeta[1]+')';
            }
        }


        // setting the basic properties from model if applicable
        if (mapdata['model'])
        {
            for (var p in mapdata['model']['properties'])
            {
                if (fields.indexOf(p) == -1)
                {
                    fields.push(p);
                }
            }

            if (mapdata['additions'])
            {
                for (var a in mapdata['additions'])
                {
                    if (fields.indexOf(a) == -1)
                    {
                        fields.push(a);
                    }
                }
            }
        }

        for (var f in mapdata['features'])
        {
            for (p in mapdata['features'][f]['properties'])
            {
                if (fields.indexOf(p) == -1)
                {
                    fields.push(p);
                }

            }
        }



    }
    else if (createmode)
    {
        contextdesc += " : Creazione ("+ftype_name+")";
        for (p in models[mapmodel]['properties'])
        {
            if (fields.indexOf(p) == -1)
            {
                fields.push(p);
            }
        }


    }

    console.log("FIELDS: ");
    console.log(fields);

    contextsummary.append('<tr><td>Contesto</td><td>'+contextdesc+'</td></tr>');


    // drawing the create/load mask

    var mapselector = $('<select id="maploader"><option></option></select>');

    // TODO: If no models are available, empty option with (short) warning string

    console.log("Models: ");
    console.log(models);

    if (models && models.length != 0)
    {
        var newopts = '<optgroup label="Nuova mappa">';
        for (var model_id in models)
        {
            newopts += '<option value=".new/'+model_id+'">Nuova mappa: '+models[model_id]['name']+'</option>';
        }
        newopts += "</optgroup>";
    }
    else
    {
        var newopts = '<optgroup label="Modelli non disponibili"></optgroup>';
    }


    /*
    mapselector.append('<optgroup label="Nuova mappa">' +
            '<option value=".new/Point">Nuova mappa: accessi</option>' +
            '<option value=".new/LineString">Nuova mappa: tratte</option>' +
            '</optgroup>');
     */
    mapselector.append(newopts);
    mapselector.append(getMapsInST([activemap]));
    mapselector.append(getMapsByMetaOpts([activemap]));
    var mapselectorbutton = ' <input id="btn_loadmap" type="button" value="&gt;&gt;">';

    //console.log(mapselector);

    if (activemap || createmode)
    {

        if (!mapmeta)
        {
            var mapname = "NuovaMappa_"+new Date().getTime();
        }
        else
        {

            if (mapmeta[0] != ".st")
            {
                mapname = mapmeta[0]+"_"+mapmeta[1];
            }
            else
            {
                mapname = mapmeta[1];
            }
        }
        var mapnamefield = '<input id="txt_saveto" value="' +mapname+'" type="text">';
        contextsummary.append($('<tr><td>Salva come</td><td>'+mapnamefield+'</td></tr>'));
    }


    contextsummary.append($('<tr><td>Passa a</td></tr>').append(mapselector).append(mapselectorbutton));

    // setting the snap map selector

    var snapselector = $('<select id="snaploader"><option></option></select>');
    snapselector.append(getMapsInST([activemap, snapmap]));
    snapselector.append(getMapsByMetaOpts([activemap, snapmap]));
    var snapselectorbutton = ' <input id="btn_loadsnap" type="button" value="&gt;&gt;">';
    contextsummary.append($('<tr><td>Riferimento</td></tr>').append(snapselector).append(snapselectorbutton));

    // loaded context mask complete
    $("#summary").append(contextsummary);

}

function getMapsInST (excluded_all)
{

    // returns a <optgroup><option> list of all maps in the maps_st array
    var excluded = [];
    if (excluded_all)
    {

       for (var e in excluded_all)
       {

           if (excluded_all[e])
           {
               var exc_split = excluded_all[e].split("/");
               if (exc_split[0] == '.st')
               {
                   excluded.push(exc_split[1]);
               }
           }



       }
    }

    var html_meta = $('<optgroup label="Area standalone"></optgroup>');

    for (var m in maps_st)
    {
        var map_id = maps_st[m];

        // we skip this item if it's in the excluded list (usually because it's already loaded)
        if (excluded.indexOf(map_id) == -1)
        {
            //console.log(meta_id+" "+map_id);
            html_meta.append('<option value=".st/'+map_id+'">'+map_id+'</option>');
        }
    }

    return html_meta;


}

function getMapsByMetaOpts (excluded)
{
    // returns a <optgroup><option> list of all maps by meta in the maps_fider array

    if (!excluded)
    {
        excluded = [];
    }

    // init maps set
    for (var i in proxy_meta)
    {
        var meta_id = proxy_meta[i];
        var html_meta = $('<optgroup label="'+meta_id+'"></optgroup>');
        console.log ("Maps for meta: "+meta_id);
        for (var m in maps_fider[meta_id])
        {
            var map_id = maps_fider[meta_id][m];

            // we skip this item if it's in the excluded list (usually because it's already loaded)
            if (excluded.indexOf(meta_id+"/"+map_id) == -1)
            {
                //console.log(meta_id+" "+map_id);
                html_meta.append('<option value="'+meta_id+'/'+map_id+'">'+map_id+'</option>');

            }


        }
    }

    return html_meta;
}


function loadMap (mapurl)
{
    /*
    Loads a map from the proxy (either meta+mapid or standalone area)
    into the main map widget and sets the controls accordingly (editing controls depending on what kind of map we are using
     */

    var urlstring;

    // TODO: add support for ST area

    var mapsplit = mapurl.split("/");
    if (mapsplit[0] == ".st")
    {
        urlstring = "/st/"+proxy_id+"/"+mapsplit[1];
    }
    else
    {
        urlstring = "/fwp/maps/"+proxy_id+"/"+mapurl;
    }


    console.log("Loading map from "+urlstring);

    // TODO: add error handling (with state message warning)

    $.ajax ({
        url:    urlstring,
        async:  true
    }).done(function (jsondata) {

            resetContext();
            createmode = false;

            mapdata = jsondata;
            activemap = mapurl;
            createIdTable(mapdata);
            renderMainMap();
            setMapControls();
            renderContextMask();

            autoZoom(mapview);

        });

}




function loadShadowMap (mapdescriptor)
{

    /*
     Loads a map from the proxy (either meta+mapid or standalone area)
     into the main map widget as background layer for snapping

     */

    var urlstring;

    // TODO: add support for ST area
    var mapurl = ($("#snaploader").val());
    urlstring = "/fwp/maps/"+proxy_id+"/"+mapurl;

    console.log("Loading map from "+urlstring);

    // TODO: add error handling (with state message warning)

    $.ajax ({
        url:    urlstring,
        async:  true
    }).done(function (jsondata) {

            snapdata = jsondata;
            snapmap = mapurl;

            renderGeoJSON(snapdata, snaplayer);


            renderContextMask();

        });




}



function resetContext(keepModel)
{
    /*
    General cleanup function for when a new map is loaded
     */

    if (!keepModel)
    {
        maptype = null;
        mapmodel = null;

    }

    freeSelection();

    $("#btn_savechanges").removeClass("warning");
    $("#btn_savechanges").hide();

    console.log(mapview.controls);

    while (mapview.controls.length > 0)
    {
        mapview.controls[0].destroy();
        mapview.removeControl(mapview.controls[0]);
    }

    vislayer.removeAllFeatures();

    //console.log(mapview.controls);
    mapdata = null;
    activemap = null;
    idlink = {};

    prechange = null;
    changelist = null;


}


function renderMainMap()
{

    // TODO: what if we just loaded an empty map?

    if (!mapdata.hasOwnProperty('model'))
    {
        maptype = mapdata['features'][0]['geometry']['type'];
        if (maptype == 'Point')
        {
            ftype_name = 'Accesso';
        }
        else if (maptype == 'LineString' || maptype == 'MultiLineString')
        {
            ftype_name = 'Tratta';
        }
    }
    else
    {
        maptype = mapdata['model']['objtype'];
        ftype_name = mapdata['model']['name'];
    }

    renderGeoJSON(mapdata, vislayer);

    console.log("Map type: " + maptype);

}

function renderGeoJSON (jsondata, layer)
{

    layer.removeAllFeatures();

    var geojson_format = new OpenLayers.Format.GeoJSON({'externalProjection': new OpenLayers.Projection(proj_WGS84), 'internalProjection':layer.map.getProjectionObject()});

    var stringmap = JSON.stringify(jsondata);
    var formatmap = geojson_format.read(stringmap);
    layer.addFeatures(formatmap);

}

function autoZoom (olmap)
{
    /*
     Checks if we have an active map and if it has a bbox. If not, zooms to the bbox of the proxy
     */

    console.log("Checking bbox, map and proxy");
    console.log(olmap);
    if (activemap)
    {
        console.log(mapdata['bbox']);
    }

    console.log(proxy_bb);

    var zoomto = proxy_bb;
    if (activemap)
    {
        if (mapdata.hasOwnProperty['bbox'])
        {
            zoomto = mapdata['bbox'];
        }

    }

    zoomToBBox(olmap, zoomto);

}

function zoomToBBox (olmap, bbox)
{
    var bounds = new OpenLayers.Bounds(bbox[0], bbox[1], bbox[2], bbox[3]).transform(new OpenLayers.Projection(proj_WGS84), olmap.getProjectionObject());
    olmap.zoomToExtent (bounds, true);


}
