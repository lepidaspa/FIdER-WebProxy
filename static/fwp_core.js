/**
 * Created with PyCharm.
 * User: drake
 * Date: 8/31/12
 * Time: 9:38 AM
 * To change this template use File | Settings | File Templates.
 */


function bindContextGuideButton()
{
    $("#guidebutton").live('click', toggleGuide);
    $("#contextguide").live('click', hideGuide);
    $("#contextguide").live('focusout', hideGuide);
}


function showGuide()
{
    console.log("opening context guide");
    $("#contextguide").show();
    //$("#guidebutton").hide();

}

function hideGuide()
{
    console.log("closing context guide");
    $("#contextguide").hide();
    //$("#guidebutton").show();
}

function toggleGuide()
{
    var guideoff = $("#contextguide").is(':hidden');
    if (guideoff)
    {
        showGuide();
    }
    else
    {
        hideGuide();
    }
}