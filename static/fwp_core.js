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
    $("#guidebutton").live('mouseleave', hideGuide);
}


function showGuide()
{
    console.log("opening context guide");
    $("#contextguide").show();

}

function hideGuide()
{
    console.log("closing context guide");
    $("#contextguide").hide();

}
