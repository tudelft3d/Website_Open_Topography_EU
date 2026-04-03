(function () {
  const body = document.body;
  if (!body) return;

  const isMapPage = body.classList.contains('map-page');
  const isCataloguePage = body.classList.contains('catalogue-page');
  const isGettingStartedPage = body.classList.contains('getting-started-page');

  const dataClass = isCataloguePage || isMapPage ? ' class="active"' : '';
  const infoClass = isGettingStartedPage ? ' class="active"' : '';
  const helpLinkHtml = '    <a id="tab-help" href="contribute.html" target="_blank" rel="noopener noreferrer" title="fill in the MSForm and help us grow">Add Pointclouds</a>';
  const mobileHelpLinkHtml = '    <a href="contribute.html" target="_blank" rel="noopener noreferrer">Add Pointclouds</a>';
  const contactDrawerHtml = [
    '<div id="contactDrawerOverlay" aria-hidden="true"></div>',
    '<aside id="contactDrawer" aria-hidden="true" aria-labelledby="contactDrawerTitle">',
    '  <div class="contact-drawer-header">',
    '    <div>',
    '      <p class="contact-drawer-eyebrow">Contact</p>',
    '      <h2 id="contactDrawerTitle">Get in touch with the team</h2>',
    '    </div>',
    '    <button id="contactDrawerClose" type="button" aria-label="Close contact panel">&times;</button>',
    '  </div>',
    '  <div class="contact-drawer-section">',
    '    <h3>Email</h3>',
    '    <a class="contact-drawer-link" href="mailto:eupc-bk@tudelft.nl">eupc-bk@tudelft.nl</a>',
    '    <p>Use this address for questions, corrections, or suggestions for new point cloud datasets.</p>',
    '  </div>',
    '  <div class="contact-drawer-section">',
    '    <h3>TU Delft group</h3>',
    '    <a class="contact-drawer-link" href="https://3d.bk.tudelft.nl/" target="_blank" rel="noopener noreferrer">3D Geoinformation group website</a>',
    '    <p>The website is hosted by TU Delft and connected to the 3D Geoinformation group.</p>',
    '  </div>',
    '  <div class="contact-drawer-section">',
    '    <h3>About the team</h3>',
    '    <p>European Point Clouds is hosted by the <a class="contact-drawer-link" href="https://3d.bk.tudelft.nl/" target="_blank" rel="noopener noreferrer">3D geoinformation group</a> at <a class="contact-drawer-link" href="https://www.tudelft.nl/" target="_blank" rel="noopener noreferrer">TU Delft</a> and built by Daan van der Heide for the completion of his doctoral work, with support from <a class="contact-drawer-link" href="https://www.rijkswaterstaat.nl/" target="_blank" rel="noopener noreferrer">Rijkswaterstaat</a> and <a class="contact-drawer-link" href="https://www.eurosdr.net/" target="_blank" rel="noopener noreferrer">EuroSDR</a> to improve access to elevation and point cloud data across Europe.</p>',
    '  </div>',
    '</aside>'
  ].join('\n');
  const filterDockToggleHtml = isMapPage
    ? '<button id="filterDockToggle" type="button" aria-controls="filterMenu" aria-expanded="false">Filters</button>'
    : '';
  const filterMenuHtml = isMapPage
    ? [
        '<div id="filterMenu" class="filter-dock" role="region" aria-label="Map filters" aria-hidden="false">',
        '  <div class="filter-menu-header">',
        '    <strong>Filters</strong>',
        '    <button id="filterCloseBtn" type="button" aria-label="Close filters">Close <span aria-hidden="true">&#9662;</span></button>',
        '  </div>',
        '  <div class="filter-group">',
        '    <label>Spatial distribution (ppsm)</label>',
        '    <div class="filter-values"><span id="filterSpatialRangeValue">- to -</span></div>',
        '    <div class="range-slider" data-range="spatial">',
        '      <div class="range-track"><span id="filterSpatialTrack"></span></div>',
        '      <input id="filterSpatialMin" class="range-input min" type="range" min="0" max="100" value="0" step="0.01">',
        '      <input id="filterSpatialMax" class="range-input max" type="range" min="0" max="100" value="100" step="0.01">',
        '    </div>',
        '  </div>',
        '  <div class="filter-group">',
        '    <label>Accuracy (m)</label>',
        '    <div class="filter-values"><span id="filterAccuracyRangeValue">- to -</span></div>',
        '    <div class="range-slider" data-range="accuracy">',
        '      <div class="range-track"><span id="filterAccuracyTrack"></span></div>',
        '      <input id="filterAccuracyMin" class="range-input min" type="range" min="0" max="10" value="0" step="0.01">',
        '      <input id="filterAccuracyMax" class="range-input max" type="range" min="0" max="10" value="10" step="0.01">',
        '    </div>',
        '  </div>',
        '  <div class="filter-group">',
        '    <label>Acquisition year</label>',
        '    <div class="filter-values"><span id="filterYearRangeValue">- to -</span></div>',
        '    <div class="range-slider" data-range="year">',
        '      <div class="range-track"><span id="filterYearTrack"></span></div>',
        '      <input id="filterYearMin" class="range-input min" type="range" min="2000" max="2030" value="2000" step="1">',
        '      <input id="filterYearMax" class="range-input max" type="range" min="2000" max="2030" value="2030" step="1">',
        '    </div>',
        '  </div>',
        '  <div class="filter-group">',
        '    <label for="filterClassificationToggle">Classification labels (ASPRS - Las format).</label>',
        '    <div class="class-dropdown">',
        '      <button id="filterClassificationToggle" type="button" aria-expanded="false" aria-haspopup="listbox">Any classification</button>',
        '      <div id="filterClassificationMenu" role="listbox" aria-label="Classification options">',
        '        <div class="filter-class-menu-title">Selected a label(s)</div>',
        '        <label><input type="checkbox" value="has"> Has classification info</label>',
        '        <label><input type="checkbox" value="ground"> Ground</label>',
        '        <label><input type="checkbox" value="vegetation"> Vegetation</label>',
        '        <label><input type="checkbox" value="building"> Building</label>',
        '        <label><input type="checkbox" value="water"> Water</label>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="filter-group filter-group-research">',
        '    <label class="filter-round-toggle" for="filterIncludeResearch">',
        '      <input id="filterIncludeResearch" type="checkbox">',
        '      <span class="filter-round-toggle-box" aria-hidden="true"></span>',
        '      <span>Include research data</span>',
        '    </label>',
        '  </div>',
        '  <div class="filter-actions">',
        '    <button id="filterResetBtn" type="button">Reset Filters</button>',
        '  </div>',
        '</div>'
      ].join('\n')
    : '';

  const dataMenuHtml = isMapPage
    ? [
        '<div id="dataMenu">',
        '  <button id="dataMapBtn">Find your data on the map</button>',
        '  <button id="dataCatalogueBtn">Find your data in the catalogue</button>',
        '</div>'
      ].join('\n')
    : [
        '<div id="dataMenu">',
        '  <a href="map.html?skipIntro=1">Find your data on the map</a>',
        '  <a href="catalogue.html">Find your data in the catalogue</a>',
        '</div>'
      ].join('\n');

  const bannerHtml = [
    '<div id="tabs">',
    '  <div id="tab-left">',
    '    <a id="tab-title" href="index.html" aria-label="European Point Clouds">',
    '      <img class="tab-title-logo" src="assets/images/logo_website.png" alt="European Point Clouds">',
    '    </a>',
    '  </div>',
    '  <div id="tab-buttons">',
    '    <div id="tab-search">',
    '      <button id="tocSearchToggle" aria-label="Open search"></button>',
    '      <input id="tocSearch" placeholder="Search for a point cloud in a country, province or city" />',
    '    </div>',
    `    <button id="tab-data"${dataClass}>DATA &#9662;</button>`,
    `    <a id="tab-info"${infoClass} href="getting-started.html">Getting started</a>`,
    helpLinkHtml,
    '  </div>',
    '  <div id="tab-actions">',
    '    <button id="tab-contact" type="button" aria-label="Open contact information" title="Contact">&#9993;</button>',
    '  </div>',
    '  <div id="mobile-controls" aria-label="Mobile navigation controls">',
    '    <button id="mobileMenuToggle" aria-label="Open navigation menu"></button>',
    '    <button id="mobileSearchToggle" aria-label="Open search"></button>',
    '  </div>',
    isMapPage ? '  <div id="tab-spacer"></div>' : '',
    '  <div id="mobileMenu">',
    '    <a href="catalogue.html">Data</a>',
    '    <a href="getting-started.html">Getting started</a>',
    '    <button id="mobileContactToggle" type="button">Contact</button>',
    mobileHelpLinkHtml,
    '  </div>',
    '  <div id="mobileSearchOverlay" aria-hidden="true">',
    '    <div id="mobileSearchCard">',
    '      <p>Start search for clouds</p>',
    '      <input id="mobileSearchInput" type="text" placeholder="Start search for clouds" autocomplete="off" />',
    '      <div id="mobileSearchHint"></div>',
    '    </div>',
    '  </div>',
    '</div>',
    contactDrawerHtml,
    dataMenuHtml,
    filterDockToggleHtml,
    filterMenuHtml
  ].filter(Boolean).join('\n');

  document.write(bannerHtml);
})();
