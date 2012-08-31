/**
 * Created with PyCharm.
 * User: drake
 * Date: 8/31/12
 * Time: 9:38 AM
 * To change this template use File | Settings | File Templates.
 */


function bindContextGuideButton()
{
    $("#guidebutton").live('mouseenter', showGuide);
    $("#contextguide").live('mouseleave', hideGuide);
}


function showGuide()
{
    console.log("opening context guide");
    $("#contextguide").show();
    $("#guidebutton").hide();

}

function hideGuide()
{
    console.log("closing context guide");
    $("#contextguide").hide();
    $("#guidebutton").show();
}
