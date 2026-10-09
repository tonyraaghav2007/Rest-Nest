/**
 * RestNest — Meta Pixel Base Code
 */
(function () {
    var PIXEL_ID = '29080819768207553';

    if (window.fbq) return;

    var n = window.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };

    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];

    var t = document.createElement('script');
    t.async = true;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(t, s);

    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
})();
