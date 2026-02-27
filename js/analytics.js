// Matomo Analytics Tracking
(function() {
    var _paq = window._paq = window._paq || [];
    
    // Tracker configuration
    _paq.push(['enableLinkTracking']);
    
    // Matomo configuration
    var u = "//stats.aldeapucela.org/";
    _paq.push(['setTrackerUrl', u + 'matomo.php']);
    _paq.push(['setSiteId', '20']);
    
    // Load Matomo script
    var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
    g.async = true;
    g.src = u + 'matomo.js';
    s.parentNode.insertBefore(g, s);
})();
