/**
 * Created with PyCharm.
 * User: drake
 * Date: 5/8/12
 * Time: 10:23 AM
 * To change this template use File | Settings | File Templates.
 */

var meta_added;
var meta_total;
var meta_ids; // ids on the page

var meta_names;
var meta_dates_from;
var meta_dates_to;
var meta_bbs;

var main_bb;
var main_date_from;
var main_date_to;

var main_ops_mode;

function page_init ()
{

    // numberf of metadata added to the manifest
    meta_added = 0;
    meta_total = 0;

    meta_names = [];
    meta_ids = [];
    meta_bbs = [];
    meta_dates_from = [];
    meta_dates_to = [];

    main_bb = [];
    main_date_from = NaN;
    main_date_to = NaN;


    $("#datepicker_main_from").datepicker( {onClose: checkMainTimespan, changeYear: true});
    $("#datepicker_main_to").datepicker( {onClose: checkMainTimespan, changeYear: true});

    $("#datepicker_meta_new_from").datepicker( {onClose: checkMetaTimespan, changeYear: true});
    $("#datepicker_meta_new_to").datepicker( {onClose: checkMetaTimespan, changeYear: true});

    $('#proxy_ops_write').click(conf_ops_write);
    $('#proxy_ops_read').click(conf_ops_read);
    $('#proxy_ops_query').click(conf_ops_query);

    $('#button_add_meta').click(addMeta);

    createMapWidget("#proxy_bb");
    createMapWidget("#proxy_meta_new_bb");

    $("#disable_meta_date_from").trigger('click');
    $("#disable_meta_date_to").trigger('click');
    $("#button_add_meta").prop("disabled",true);


    // TODO: refine, reworks too much stuff each time; we should separate the warnings and the issues in the submission checklist area
    $("#proxy_bb").bind( "geomapbboxchange", checkSendable );


    $('#button_proxy_create').click(postManifest);


    $('.proxy_ops_type').click(setOpsMode);


    $('#proxy_ops_read').trigger('click');

    checkSendable();

}

function setOpsMode()
{
    //alert ("Setting ops to "+this.value);
    main_ops_mode = this.value;
}

function checkMainTimespan ()
{
    /*
    Shortcut function that calls validateTimespan with the values provided by the input fields for the main timespan of the whole proxy
     */

    validateTimespan($("#datepicker_main_from").val(), $("#datepicker_main_to").val(), this.id);


    // values from input are not stored because ValidateTimeSpan alters them in casethe interval is not valid

    main_date_from = dateToInt($("#datepicker_main_from").val());
    main_date_to = dateToInt($("#datepicker_main_to").val());


    checkSendable();

}

function checkMetaTimespan ()
{
    /*
     Shortcut function that calls validateTimespan with the values provided by the input fields for the main timespan of the whole proxy
     */

    //alert ("DATE CHECKING with param "+this.id);
    var datefrom = $("#datepicker_meta_new_from").val();
    var dateto = $("#datepicker_meta_new_to").val();

    validateTimespan(datefrom, dateto, this.id);
}

function conf_ops_write ()
{
    /*
    Replaces the current details section with the input needed for configuring a write proxy
     */


/*
    var write_full = '<label for="proxy_write_mode_full">Full</label><input type="radio" name="proxy_write_mode" value="full" id="proxy_write_mode_full">';
    var write_sync = '<label for="proxy_write_mode_sync">Sync</label><input type="radio" name="proxy_write_mode" value="sync" id="proxy_write_mode_sync">';
*/
    var write_full = makeRadio ('proxy_write_mode', 'full', 'proxy_write_mode_full', 'Continua', true);

    var write_sync = makeRadio ('proxy_write_mode', 'sync', 'proxy_write_mode_sync', 'Periodica');


    $(".proxy_ops_details").remove();

    $("#proxy_ops_mode").append('<td class="proxy_ops_details">Modalità scrittura<br>'+write_full+'<br>'+write_sync+'</td>');



}

function conf_ops_read()
{
    //TODO: placeholder, implement

    var read_full = makeRadio ('proxy_read_mode', 'full', 'proxy_read_mode_full', 'Completa', true);

    var read_diff = makeRadio ('proxy_read_mode', 'diff', 'proxy_read_mode_diff', 'Aggiornamento');


    $(".proxy_ops_details").remove();

    $("#proxy_ops_mode").append('<td class="proxy_ops_details">Modalità lettura<br>'+read_full+'<br>'+read_diff+'</td>');

}

function conf_ops_query()
{
    //TODO: placeholder, implement

    /*
    $('#proxy_ops_details').empty();
    */

    var query_geo_full = makeRadio ('proxy_query_geo_mode', 'full', 'proxy_query_geo_full', 'Complesse', true);
    var query_geo_bb = makeRadio ('proxy_query_geo_mode', 'bb', 'proxy_query_geo_bb', 'BB');
    var query_geo_none = makeRadio ('proxy_query_geo_mode', 'none', 'proxy_query_geo_none', 'N/D');

    var query_inv_full = makeRadio ('proxy_query_inv_mode', 'full', 'proxy_query_inv_full', 'Complete', true);
    var query_inv_simple = makeRadio ('proxy_query_inv_mode', 'simple', 'proxy_query_inv_simple', 'Semplici');
    var query_inv_none = makeRadio ('proxy_query_inv_mode', 'none', 'proxy_query_inv_none', 'N/D');

    var query_time_full = makeRadio ('proxy_query_time_mode', 'full', 'proxy_query_time_full', 'Complete', true);
    var query_time_none = makeRadio ('proxy_query_time_mode', 'none', 'proxy_query_time_none', 'N/D');

    var query_bi_full = makeRadio ('proxy_query_bi_mode', 'full', 'proxy_query_bi_full', 'Completa', true);
    var query_bi_simple = makeRadio ('proxy_query_bi_mode', 'simple', 'proxy_query_bi_simple', 'Semplice');
    var query_bi_none = makeRadio ('proxy_query_bi_mode', 'none', 'proxy_query_bi_none', 'N/D');

    var query_signed_true = makeRadio ('proxy_query_sign', 'true', 'proxy_query_sign_true', 'Sì', true);
    var query_signed_false = makeRadio ('proxy_query_sign', 'false', 'proxy_query_sign_false', 'No');




    $(".proxy_ops_details").remove();


    var fullhtml = '<td class="proxy_ops_details">Query geografiche<br>'+query_geo_full+'<br>'+query_geo_bb+'<br>'+query_geo_none+'</td>' +
        '<td class="proxy_ops_details">Query inventariali<br>'+query_inv_full+'<br>'+query_inv_simple+'<br>'+query_inv_none+'</td>' +
        '<td class="proxy_ops_details">Query temporali<br>'+query_time_full+'<br>'+query_time_none+'<br></td>' +
        '<td class="proxy_ops_details">Business intelligence<br>'+query_bi_full+'<br>'+query_bi_simple+'<br>'+query_bi_none+'</td>' +
        '<td class="proxy_ops_details">Firma<br>'+query_signed_true+'<br>'+query_signed_false+'</td>';

    $("#proxy_ops_mode").append(fullhtml);
}

function makeRadio (name, value, id, label, isset)
{


    if (!label)
    {
        label = "";
    }

    if (!id)
    {
        id = "";
    }


    var checked = "";
    if (isset === true)
    {
        checked=" CHECKED"
    }

    var radiobutton = '<input type="radio" name="'+name+'" value="'+value+'" id="'+id+'" '+checked+'>';
    var labelhtml = "";
    if ((label!="") && (id!=""))
    {
        labelhtml = '<label for="'+id+'">'+label+'</label>';
    }

    return ""+labelhtml+radiobutton;
}


function validateMetaBbox (meta_id)
{
    var candidate = meta_bbs[meta_ids.indexOf(meta_id)];
    var reference = $("#proxy_bb").geomap("option", "bbox");

    return validateBboxReference(reference, candidate)

}

function validateBboxReference (referencebb, candidate)
{
    /*
    finds a bbox in the meta_bbs global and validates it against the reference bb; returntrue if enclosed or empty
     */

    if (candidate.length > 0)
    {
        return (
            (candidate[0] >= referencebb[0]) &&
            (candidate[1] >= referencebb[1]) &&
            (candidate[2] <= referencebb[2]) &&
            (candidate[3] <= referencebb[3])
            );
    }
}

function addMeta()
{
    /*
    Adds a new meta to the metadata list, updates the summarize section and cleans the *name* data only on the new meta section
     */


    var removebutton = '<input type="button" id="pm_%METANUM%_remove" value="-"  onclick="removeMeta(%METANUM%)">';


    var tr_template = '<tr id="proxy_meta_%METANUM%">' +
        '<td class="pm_cell_name"><span class="pm_text_name" id="pm_%METANUM%_name">%METANAME%</span></td>' +
        '<td class="pm_cell_date"><span id="pm_%METANUM%_datefrom">%METADATEFROM%</span></td>' +

        '<td class="pm_cell_date"><span id="pm_%METANUM%_dateto">%METADATETO%</span></td>' +
        '<td class="pm_cell_bbox"><span class="pm_text_bbox" id="pm_%METANUM%_bbox">%METABBOX%</span></td>' +
        '<td>'+removebutton+'</td></tr>';

    // Add to metadata_submitted <tbody> element

    // passing the number
    tr_template = tr_template.replace(/%METANUM%/g,meta_added);

    //passing the date FROM
    var replacement = "";
    var datefrom = dateToInt($("#datepicker_meta_new_from").val());
    if ($("#datepicker_meta_new_from").prop("disabled") || isNaN(datefrom))
    {
        replacement = "N/A";
    }
    else
    {
        replacement = $("#datepicker_meta_new_from").val();
    }

    tr_template = tr_template.replace(/%METADATEFROM%/g, replacement);

    //passing the date TO
    var dateto = dateToInt($("#datepicker_meta_new_to").val());
    if ($("#datepicker_meta_new_to").prop("disabled") || isNaN(dateto))
    {
        replacement = "N/A";
    }
    else
    {
        replacement = $("#datepicker_meta_new_to").val();
    }

    tr_template = tr_template.replace(/%METADATETO%/g, replacement);


    // passing the bounding box
    var bbcoord;
    var bbstring;
    if ($("#enable_meta_bbox").prop("checked"))
    {

        var bboxarray = $("#proxy_meta_new_bb").geomap("option", "bbox");

        replacement = "";

        for (i = 0; i < bboxarray.length; i++)
        {
            bbcoord = String(bboxarray[i]).split(".");
            bbstring = bbcoord[0]+"."+bbcoord[1].substr(0,3);
            replacement += (i > 0) ? ", " : "";
            replacement += bbstring;
        }

        //replacement = String($("#proxy_meta_new_bb").geomap("option", "bbox")).replace(/,/g,", ");


    }
    else
    {
        replacement = "N/A";
        bboxarray = [];
    }

    tr_template = tr_template.replace(/%METABBOX%/g, replacement);

    replacement = $("#name_meta_new").val();
    tr_template = tr_template.replace(/%METANAME%/g, replacement);

    $("#metadata_submitted").append(tr_template);

    meta_names.push($("#name_meta_new").val());
    meta_ids.push(meta_added);
    meta_bbs.push(bboxarray);
    meta_dates_from.push(datefrom);
    meta_dates_to.push(dateto);

    meta_added++;
    meta_total++;

    $("#name_meta_new").val("");
    $("#button_add_meta").prop("disabled", true);

    checkSendable();

}

function createMapWidget (pagenode)
{

    // hardcoded, replace with geolocation
    var cpos = [11.1, 44.5];


    var cservice = [{
        class: "osm",
        type: "tiled",
        src: function( view ) {
            return "http://tile.openstreetmap.org/" + view.zoom + "/" + view.tile.column + "/" + view.tile.row + ".png";
        },
        attr: ''
    }];


    $(pagenode).geomap(
        {
            center: navigator.geolocation,
            zoom: 6,
            services: cservice,
            center: cpos
        }
    );

}


function removeMeta (meta_id)
{
    var currentname = $("#pm_"+meta_id+"_name").text();
    alert("Removing meta "+currentname+" -> "+meta_names.indexOf(currentname));
    meta_names.splice(meta_names.indexOf(currentname),1);
    meta_ids.splice(meta_names.indexOf(meta_id),1);
    $("#proxy_meta_"+meta_id).remove();
    meta_total--;

    checkSendable();

}

function arrayToString (candidate)
{
    var output = "[";
    for (var i = 0; i < candidate.length; i++)
    {
        output += candidate[i] + ", ";
    }
    output += "]";
    return output;
}

function switchMainDateTo ()
{

    // Shortcut to switchField when switching on/off the main Proxy DateTo field

    switchField('#datepicker_main_to','Permanente');
    checkSendable();

}


function switchField (field_id, msg)
{
    var disabledstate = $(field_id).prop("disabled");
    //alert ("Switching "+field_id+" from "+fieldstate+" to "+!fieldstate);
    $(field_id).prop("disabled", !disabledstate);
    if ((!disabledstate) && (msg))
    {
        $(field_id).val(msg);
    }

    if ((disabledstate) && ($(field_id).val()))
    {
        $(field_id).val("");
    }
}


function checkMetaName (launcher)
{

    // meta must have a name, the name must be unique and it must match alphanum+underscore
    if ((launcher.value != "") && (meta_names.indexOf(launcher.value) == -1) && (launcher.value.match(/^[A-Za-z0-9_]+$/)!=null))
    {

        $("#button_add_meta").prop("disabled",false);
    }
    else
    {
        $("#button_add_meta").prop("disabled",true);

    }

}


function validateTimespan (datefrom, dateto, field)
{
    /*
    Compares date_from to date_to to find if the dates are actually compatible as a temporal sequence. If not, launches an alert and then blanks the input field with the "offending" date.  Does not check against the complete context of the proxy (main date could be changed later). Does not give an error if one of the two dates is missing
     */

    // dates are expected provided as dd/mm/yyyy, compatibility is ensured even if difference == 0

    var validated = validateDateSequence (datefrom, dateto);

    if (!validated)
    {
        alert ("Intervallo di tempo non valido.");
        $("#"+field).prop("value",'');
    }

    return validated;



}

function dateToInt (parsable)
{
    // dates are expected provided as dd/mm/yyyy, compatibility is ensured even if difference == 0; also dates are provided by a datepicker widget

    return parseInt(parsable.substr (6,4) + parsable.substr (3,2) + parsable.substr (0,2), 10);

}


function validateIntDateSequence (intdatefrom, intdateto)
{
    /*
     Compares two dates to see if they are in a sequence (or the same), already converted to INT (or marked as NAN). Note  that NaN for any of the two will make the function return TRUE.
     */

    if ((isNaN(intdatefrom)) || (isNaN(intdateto)))
    {
        return true;
    }
    else
    {
        return (intdatefrom <= intdateto);
    }

}

function validateDateSequence(datefrom, dateto)
{

    /*
    Compares two dates to see if they are in a sequence (or the same). Note  that NaN for any of the two will make the function return TRUE.
     */


    // dates are expected provided as dd/mm/yyyy

    var intdatefrom = dateToInt(datefrom);
    var intdateto = dateToInt(dateto);


    //alert ("From "+intdatefrom+" to "+intdateto);
    return validateIntDateSequence(intdatefrom, intdateto);

}

function validateProxyTimespans ()
{
    /*
    Compares all dates in the proxy form to ensure that metadata dates are compatible with the context of the global timespan of the proxy. Returns a list of the meta_names with broken date combinations
     */

    //TODO: adapt to use the globals instead of extracting and parsing from the HTML

    // must harvest the submission table

    var baddates = [];

    var metafrom;
    var metato;
    var meta_idx;

    var proxyfrom = dateToInt($("#datepicker_main_from").val());
    var proxyto = dateToInt($("#datepicker_main_to").val());

    for (var i = 0; i < meta_ids.length; i++)
    {
        cmeta = meta_ids[i];


        metafrom = meta_dates_from[i];
        metato = meta_dates_to[i];

        //alert("COMPARE: "+proxyfrom+" vs "+metafrom+" && "+metato+" vs "+proxyto);

        if (!validateIntDateSequence (proxyfrom, metafrom) || !validateIntDateSequence (metato, proxyto))
        {
            baddates.push(meta_names[i]);
        }


    }

    return baddates;

}

function checkSendable ()
{
    /* Verifies if the form contains all the required element for submitting the manifest. Each check gives a warning in the last section of the page and having at least one will disable the send button; this way we do not need a separate confirmation page
     */

    /*
    CHECKS:
    We have at least ONE confirmed metadata
    We have a date of start and end of validity for the whole proxy (or a disabled on the to date)
    We have selected one MODE of operation
    We have the parameters for that mode of operations set (must be coded specifically for each mode as the number and exclusivity of fields changes)
     */

    var issues = [];
    var warnings = [];

    if (meta_total == 0)
    {
        issues.push("È necessario inserire almeno un metadato.");
    }


    var wrongdates = validateProxyTimespans();
    for (i = 0; i < wrongdates.length; i++)
    {
        warnings.push("L'intervallo del metadato "+wrongdates[i]+" verrà normalizzato.");
    }

    // TODO: add remaining checks

    // bbox warnings
    for (i = 0; i < meta_ids.length; i++)
    {
        if (!validateMetaBbox(meta_ids[i]))
        {
            warnings.push ("La bounding box del metadato "+meta_names[i]+" verrà normalizzata.");
        }
    }


    // checking main date from (must be not NaN)
    //alert(main_date_from);
    if (isNaN(main_date_from))
    {
        issues.push("È necessario indicare una data d'inizio di validità per il proxy.");
    }
    //alert(arrayToString(issues));

    //alert ("Number of issues: "+issues.length);
    $("#button_proxy_create").prop("disabled", issues.length > 0);
    $("#submission_checklist").empty();
    for (i = 0; i < issues.length; i++)
    {

        // Add message to warnings section

        $("#submission_checklist").append(""+issues[i]+"<br>")
    }
    for (i = 0; i < warnings.length; i++)
    {
        $("#submission_checklist").append(""+warnings[i]+"<br>")

    }



}

function intdateToISO (intdate)
{
    var sdate = String(intdate);
    var dsep = "-";

    if (isNaN(intdate))
    {
        return '';
    }
    else
    {
        return sdate.substr(6,2) + dsep + sdate.substr(4,2) + dsep + sdate.substr(0,4) + "T00:00Z";
    }


}

function postManifest ()
{
    /*
    Assembles the manifest JSON and starts the communication process with the main server (through a separate django page)
     */
    //TODO: implement

    var manifest_pre = {};

    manifest_pre ['area'] = main_bb;
    manifest_pre ['time'] = [];

    // corret for NaN as '' and switch correct dates to ISO8601
    manifest_pre['time'].push(intdateToISO(main_date_from));
    manifest_pre['time'].push(intdateToISO(main_date_to));

    manifest_pre['operations'] = {};

    //alert(main_ops_mode);

    if (main_ops_mode == 'read')
    {
        // read proxy
        manifest_pre['operations'][main_ops_mode] = $("input[name=proxy_"+main_ops_mode+"_mode]:checked").val();
        manifest_pre['operations']['write'] = 'none';
        manifest_pre['operations']['query'] = {
            'inventory': 'none', 'geographic': 'none',
            'time': 'none', 'bi':'none', 'sign': false
        };
    }
    else if (main_ops_mode == 'write')
    {
        // write proxy
        manifest_pre['operations'][main_ops_mode] = $("input[name=proxy_"+main_ops_mode+"_mode]:checked").val();
        manifest_pre['operations']['read'] = 'none';
        manifest_pre['operations']['query'] = {
            'inventory': 'none', 'geographic': 'none',
            'time': 'none', 'bi':'none', 'sign': false
        };
    }
    else
    {
        // query proxy
        manifest_pre['operations'][main_ops_mode] = {};
        manifest_pre['operations'][main_ops_mode]['inventory'] = $("input[name=proxy_query_inv_mode]:checked").val();
        manifest_pre['operations'][main_ops_mode]['geographic'] = $("input[name=proxy_query_geo_mode]:checked").val();
        manifest_pre['operations'][main_ops_mode]['time'] = $("input[name=proxy_query_time_mode]:checked").val();
        manifest_pre['operations'][main_ops_mode]['bi'] = $("input[name=proxy_query_bi_mode]:checked").val();
        manifest_pre['operations'][main_ops_mode]['sign'] = $("input[name=proxy_query_sign]:checked").val();

        manifest_pre['operations']['read'] = 'none';
        manifest_pre['operations']['write'] = 'none';

    }


    manifest_pre['metadata'] = [];
    var cmeta;

    for (var i = 0; i < meta_total; i++)
    {
        cmeta = {};

        cmeta['name'] = meta_names[i];

        // normalise boundingbox according to main bounding box
        if (meta_bbs[i][0] < main_bb[0]) { meta_bbs[i][0] = main_bb[0]};
        if (meta_bbs[i][1] < main_bb[1]) { meta_bbs[i][1] = main_bb[1]};
        if (meta_bbs[i][2] > main_bb[2]) { meta_bbs[i][2] = main_bb[2]};
        if (meta_bbs[i][3] > main_bb[3]) { meta_bbs[i][3] = main_bb[3]};

        cmeta['area'] = meta_bbs[i];


        // corret for NaN as '' and switch correct dates to ISO8601

        // normalise intervals according to main time interval


        if (!isNaN(meta_dates_from[i]) && !isNaN(main_date_from))
        {
            if ( meta_dates_from[i] < main_date_from)
            {
                meta_dates_from[i] = main_date_from;
            }
        }
        if (!isNaN(meta_dates_to[i]) && !isNaN(main_date_to))
        {
            if ( meta_dates_to[i] > main_date_to)
            {
                meta_dates_to[i] = main_date_to;
            }
        }



        cmeta['time'] = [ intdateToISO(meta_dates_from[i]), intdateToISO(meta_dates_to[i]) ];

        manifest_pre['metadata'].push(cmeta);
    }

    alert(JSON.stringify(manifest_pre));

    $("#form_jsondata").val(JSON.stringify(manifest_pre));

}


