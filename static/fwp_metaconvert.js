/**
 * Created with PyCharm.
 * User: drake
 * Date: 8/27/12
 * Time: 4:50 PM
 * To change this template use File | Settings | File Templates.
 */

var geomfield = 'Geometria';


function bindConvControls ()
{
    // sets the bindings for the various selectors in the conversion creation form

    $(".valueconv_addfield").die();
    $(".valueconv_addfield").live('click', addValueConversionItem);
    $(".valueconv_removefield").die();
    $(".valueconv_removefield").live('click', removeValueConversionItem);
    $("#conversion_typeto").die();
    $("#conversion_typeto").live('change', filterConversionFields);
    filterConversionFields();

    $("#convtable_close").die();
    $("#convtable_close").live('click', closeConvTable);
    $("#convtable_submit").die();
    $("#convtable_submit").live('click', saveConvTable);

    $(".sel_sourcefield").die();
    if (proxy_type == 'query')
    {
        $(".sel_sourcefield").live('change', checkValidConvSet);
    }

}

function checkValidConvSet()
{

    var modelid = $("#conversion_typeto").val();

    // checks if the current conversions have a value set for the geometry field
    if (proxy_type == "query")
    {
        var selectorid = "#sel_sourcefield_"+modelid+"_"+geomfield;

        if ($(selectorid).val()=="")
        {
            $("#convtable_submit").prop('disabled', true);
        }
        else
        {
            $("#convtable_submit").prop('disabled', false);
        }
    }


}


function renderConvMask()
{

    // Mask for values conversion

    $("#convtable_fields tbody").remove();

    var prefix = "btn_convert_";
    var mapidx = this.id.substr(prefix.length);

    var destination;

    if (proxy_type != "query")
    {
        var i = parseInt(mapidx);
        currentmap = i;
        var maptype = maptypes[currentmap];
        destination = shapes[i];
    }
    else
    {
        currentmap = mapidx;
        destination = mapidx;
    }



    closeAllMasks();
    $("#serverstate").show();
    $("#progspinner").show();

    var tables = null;
    var success;



    $.ajax({
        url: "/fwp/conversion/"+proxy_id+"/"+meta_id+"/"+destination+"/",
        async: false
    }).done(function (jsondata) {

            success = true;
            console.log("Retrieved conversion data");
            console.log(jsondata);
            tables = jsondata;

        }).fail(function ()
        {
            // message posted as warning to let the user know why the fields are empty even if they may have been filled before
            postFeedbackMessage(null, "Impossibile caricare i dati della mappa per la conversione.", "#map_"+i);
            success = false;
        });

    //alert(JSON.stringify(tables));

    $("#serverstate").hide();
    $("#progspinner").hide();


    if (success==false)
    {
        return;
    }

    // 1. render the layout


    // 1.1 unhide and switch places with the map widget
    $("#proxymap").hide();
    $("#conversion").removeClass("inhiding");
    $("#conversion").show();

    // 1.2 build the table rows for ALL allowed models, then will hide/show according to the main chooser widget
    $("#conversion_typeto").empty();

    for (var modelid in models)
    {

        if (proxy_type != "query" && models[modelid]['objtype'] != maptype )
        {
            continue;
        }

        // 1.2.1 model type selector

        $("#conversion_typeto").append('<option value="'+modelid+'">'+models[modelid]['name']+'</option>');

        var fields = Object.keys(models[modelid]['properties']);
        if (proxy_type == 'query')
        {
            fields.push(geomfield);
        }

        var model_tb = $('<tbody id="conversion_fields_'+modelid+'"></tbody>');

        for (var i in fields)
        {

            var sourcefields_selector = $('<select class="sel_sourcefield" id="sel_sourcefield_'+modelid+"_"+fields[i]+'"></select>');
            sourcefields_selector.append('<option value="">(non usato)</option>');
            for (var f in tables['mapfields'])
            {
                sourcefields_selector.append('<option value="'+tables['mapfields'][f]+'">'+tables['mapfields'][f]+'</option>');
            }

            // extendable widget for adding conversion
            var valueconv_widget = $('<div class="valueconversion" id="valueconversion_'+modelid+"_"+fields[i]+'"></div>');
            if ($.isArray(models[modelid]['properties'][fields[i]]))
            {
                valueconv_widget.append('<div class="valueconv_row"><div class="cell"><input type="button" class="valueconv_addfield" value="+"></div><div class="cell"></div><div class="cell"></div></div>');
            }

            var fieldhtml = $('<tr class="tr_'+modelid+'_'+fields[i]+'"></tr>');
            fieldhtml.append('<td>'+fields[i]+'</td>');
            fieldhtml.append($('<td></td>').append(sourcefields_selector));
            fieldhtml.append($('<td></td>').append(valueconv_widget));

            //console.log(fieldhtml);

            model_tb.append(fieldhtml);
        }

        $("#convtable_fields").append(model_tb);

    }








    // 2. bindings (consider declaring only once in caller page)
    bindConvControls();



    // 3. fill the layout with values from the existing model, if applicable
    // (moved after the bindings so we can use the event system)

    console.log("Pre-filling the conversion table");
    console.log(tables['conversion']);

    if (!$.isEmptyObject(tables['conversion']))
    {
        var modelid = tables['conversion']['modelid'];
        $("#conversion_typeto").val(modelid);
        $("#conversion_typeto").change();


        var path_model = $('#conversion_fields_'+modelid);

        var fields = tables['conversion']['fields'];
        for (var i in fields)
        {
            console.log("prefilling field "+fields[i]['to']+" with "+i);
            var fieldfrom = i;
            var fieldto = fields[i]['to'];

            var path_field = path_model.find(".tr_"+modelid+"_"+fieldto);
            console.log(path_field);

            path_field.find("#sel_sourcefield_"+modelid+"_"+fieldto).val(fieldfrom);

            if (!$.isEmptyObject(fields[i]['values']))
            {
                var mappings = Object.keys(fields[i]['values']);
                console.log("Applying values translations");
                console.log(mappings);

                var valueconvwidget = path_field.find("#valueconversion_"+modelid+"_"+fieldto);
                var addfieldbutton = valueconvwidget.find("input.valueconv_addfield");

                for (var n = 0; n < mappings.length; n++)
                {
                    addfieldbutton.click();


                    $(valueconvwidget.find(".valueconv_valuefrom").get(n)).val(mappings[n]);
                    $(valueconvwidget.find(".valueconv_valueto").get(n)).val(fields[i]['values'][mappings[n]]);


                }



            }



        }


    }

    if (proxy_type == "query")
    {
        checkValidConvSet();
    }


}


function addValueConversionItem (launcher)
{

    var caller = $(launcher.target);

    var prefix;

    prefix = "conversion_fields_";
    var modelid = caller.closest("tbody").attr('id').substring(prefix.length);

    prefix = "valueconversion_"+modelid+"_";
    var propname = caller.closest(".valueconversion").attr('id').substring(prefix.length);

    var choices = models[modelid]['properties'][propname];

    if (!$.isArray(choices))
    {
        // note: we should never get here anyway
        return;
    }

    var conversionwidget = $('<div class="valueconv_row"><div class="cell"><input type="text" class="valueconv_valuefrom" value=""></div><div class="cell"><select class="valueconv_valueto"></select></div><div class="cell"><input type="button" class="valueconv_removefield" value="-"></div></div>');
    for (var i in choices)
    {
        conversionwidget.find(".valueconv_valueto").append('<option value="'+choices[i]+'">'+choices[i]+'</option>');
    }


    caller.closest(".valueconv_row").before(conversionwidget);

}

function removeValueConversionItem (launcher)
{
    $(launcher.srcElement).closest(".valueconv_row").remove();

}


function filterConversionFields ()
{
    var currentfilter = $("#conversion_typeto").val();

    var fullid = "conversion_fields_"+currentfilter;

    $('#convtable_fields tbody[id!='+fullid+']').hide();
    $("#"+fullid).show();

}

function closeConvTable()
{

    // hides the conversion table widget and redisplays the map widget if applicable

    //TODO: placeholder, implement

}

function saveConvTable()
{

    console.log("Saving current conversions");


    // saves the current conversion setting

    var conversion = { "modelid": "", "fields": {}};


    // find the model currently in use

    var modelid = $("#conversion_typeto").val();

    conversion ['modelid'] = modelid;


    var prefix;
    prefix = "conversion_fields_";
    var convsection = $("#"+prefix+modelid);

    console.log("Converting fields for model id "+modelid);
    console.log(convsection.find("tr"));

    var convfields = {};
    convsection.find("tr").each (
        function ()
        {

            var selector = $(this).find(".sel_sourcefield");

            prefix = "sel_sourcefield_"+modelid+"_";

            var fieldto = selector.attr("id").substring(prefix.length);
            var fieldfrom = selector.val();

            if (fieldfrom == "")
            {
                // nothing to map or convert
                return;
            }
            else
            {
                convfields[fieldfrom] = { "to": fieldto, "values": {} };
            }



            console.log("Mapping "+fieldfrom+" to "+fieldto);

            var vconvtable = $(this).find("#valueconversion_"+modelid+"_"+fieldto);

            console.log(vconvtable);


            vconvtable.find(".valueconv_row").each (
                function ()
                {
                    if ($(this).find(".valueconv_addfield").size()>0)
                    {
                        // skipping the + button row
                        return;
                    }

                    var valuefrom = String($(this).find(".valueconv_valuefrom").val());
                    var valueto = String($(this).find(".valueconv_valueto").val());

                    console.log("Mapping "+fieldfrom+":"+fieldto+" with "+valuefrom+" to "+valueto);

                    convfields[fieldfrom]["values"][valuefrom] = valueto;
                }


            );


        }
    );
    conversion['fields'] = convfields;


    console.log("Compiled conversion data");
    console.log(conversion);


    // saving to filesystem

    var jsondata = {};

    jsondata['convtable'] = conversion;

    jsondata ['proxy_id']  = proxy_id;
    jsondata ['meta_id'] =  meta_id;

    if (proxy_type != 'query')
    {
        jsondata ['shape_id'] = shapes[currentmap];
    }
    else
    {
        jsondata ['shape_id'] = currentmap;
    }


    $("#progspinner").show();


    $.ajax ({
        url: "/fwp/maketable/",
        async: true,
        data: {jsonmessage: JSON.stringify(jsondata)},
        type: 'POST',
        success: function(data) {
            //alert ("COMPLETED");
            postFeedbackMessage(data['success'], data['report'], "#map_"+currentmap);

            if (proxy_type != 'query')
            {
                rebuildShapeData(shapes[currentmap]);
            }

            $("#progspinner").hide();


        }
    });




}