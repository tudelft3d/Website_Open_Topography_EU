(function() { 
    function debounce(fn, delay) { 
        let timer; 
        return function(...args) { 
            clearTimeout(timer); 
            timer = setTimeout(() => fn.apply(this, args), delay); 
        }; 
    } 

    const categoryColors = { 
        Region: '#A7C1D9', 
        Pointcloud: '#A9B689', 
        DEM: '#D4602A', 
        'No Info':'#8E8E93' 
    }; 

    // State 
    let countriesData, regionsData; 
    let selectedCountryFeature = null; 
    let selectedRegionFeatureId = null; 
    let activeCategory = null; 

    // DOM 
    function showCountryTOC() { 
        document.getElementById('toc-country').style.display = 'block'; 
        document.getElementById('toc-region').style.display = 'none'; 
    } 

    function showRegionTOC() { 
        document.getElementById('toc-country').style.display = 'none'; 
        document.getElementById('toc-region').style.display = 'block'; 
    } 

    function overviewReset() { 
        activeCategory = null; 
        selectedCountryFeature = null; 
        selectedRegionFeatureId = null; 
        regionsData = null; 
        document.getElementById('tocSearch').value = ''; 
        document.querySelectorAll('.legend-btn').forEach(b => b.classList.remove('active')); 
        showCountryTOC(); 
        if (window.map) { 
            if (map.getLayer('country-fill')) map.setLayoutProperty('country-fill', 'visibility', 'visible'); 
            if (map.getLayer('country-border')) map.setLayoutProperty('country-border', 'visibility', 'visible'); 
            if (map.getLayer('region-fill')) map.removeLayer('region-fill'); 
            if (map.getLayer('region-border')) map.removeLayer('region-border'); 
            if (map.getSource('regions')) map.removeSource('regions'); 
            map.easeTo({ center: [5, 50], zoom: 5, pitch: 0, bearing: 0, duration: 1000 }); 
        } 
        map.setMinZoom(2); 
        sidebar.style.display = 'none'; // Sidebar sluiten bij reset 
        renderCountriesList(); 
    } 

    const sidebar = document.getElementById('sidebar'); 
    const infoBox = document.getElementById('info'); 
    const infoTitleEl = document.getElementById('infoTitle'); 
    // const closeBtn = document.getElementById('closeBtn'); 
    const introModal = document.getElementById('introModal'); 
    const introBtn = document.getElementById('introBtn'); 
    const legendCatsEl = document.getElementById('legendCategories'); 
    const overviewBtn = document.getElementById('overviewBtn'); 
    const countryListEl = document.getElementById('countryList'); 
    const dividerLine = document.getElementById('dividerLine'); 
    const tocSearch = document.getElementById('tocSearch'); 
    const tabs = { 
        toc: document.getElementById('tab-toc'), 
        info: document.getElementById('tab-info'), 
        help: document.getElementById('tab-help') 
    }; 
    const infoPanel = document.getElementById('infoPanel'); 
    const panels = { 
        toc: document.getElementById('toc'), 
        info: infoPanel, // <-- juiste panel koppelen 
        help: document.getElementById('helpModal') 
    }; 

    // Init 
    // tocSearch.addEventListener('input', debounce(updateTOCList, 200)); 
    tocSearch.addEventListener('input', renderCountriesList); 
    overviewBtn.onclick = overviewReset; 
    introBtn.addEventListener('click', () => introModal.style.display = 'none'); 
    tabs.toc.addEventListener('click', () => showTab('toc')); 
    tabs.info.addEventListener('click', () => showTab('info')); 
    tabs.help.addEventListener('click', () => showTab('help')); 
    // document.getElementById('helpModalClose').addEventListener('click', () => showTab('toc')); 

    function showTab(name) { 
        Object.keys(panels).forEach(key => { 
            panels[key].style.display = (key === name) ? 'block' : 'none'; 
            tabs[key].classList.toggle('active', key === name); 
        }); 
        if (name === 'help') { 
            sidebar.style.display = 'none'; // Sidebar verbergen bij help 
        } 
    } 

    // Load data 
    fetch('data/map_data_overview.geojson') 
    .then(r => r.json()) 
    .then(cd => { 
        countriesData = cd; 
        countriesData.features.forEach((f, i) => { 
            if (f.id === undefined) f.id = i; 
            const d = f.properties.Data; 
            if (!d || d.trim() === '') { 
                f.properties.Data = 'No Info'; // altijd zelfde notatie 
            } 
            f.properties.infoStatus = d ? (d.toLowerCase() === 'region' ? 'region' : 'hasinfo') : 'noinfo'; 
        }); 
        introModal.style.display = 'flex'; 
        setTimeout(() => { 
            introBtn.disabled = false; 
            introBtn.style.display = 'inline-block'; 
        }, 5000); 
        renderCategoryButtons(); 
        renderCountriesList(); 
        initMap(); 
        updateTOCList(); 
        showTab('toc'); 
    }); 

    function renderCategoryButtons() { 
        legendCatsEl.innerHTML = ''; 
        const orderedCats = ['Pointcloud', 'DEM', 'No Info', 'Region']; 
        orderedCats.forEach(cat => { 
            const color = categoryColors[cat] || '#8E8E93'; 
            const btn = document.createElement('button'); 
            btn.className = 'legend-btn'; 
            btn.setAttribute('data-color', cat); 
            btn.style.setProperty('--cat-color', color); 
            if (cat === 'Region') { 
                btn.classList.add('region-btn'); 
                btn.innerHTML = '<span>Regional</span>'; // logo + tekst via CSS 
            } else { 
                btn.textContent = cat; 
            } 
            btn.onclick = () => { 
                document.querySelectorAll('.legend-btn').forEach(b => b.classList.remove('active')); 
                if (activeCategory === cat) { 
                    activeCategory = null; 
                    renderCountriesList(); 
                    return; 
                } 
                activeCategory = cat; 
                btn.classList.add('active'); 
                renderCountriesList(); 
            }; 
            legendCatsEl.appendChild(btn); 
        }); 
    } 

    // NIEUW: normaliseer categorie-naam naar vaste set 
    function normalizeCat(cat) { 
        if (!cat) return 'No Info'; 
        const n = String(cat).trim().toLowerCase(); 
        if (n === 'region') return 'Region'; 
        if (n === 'pointcloud' || n === 'point cloud') return 'Pointcloud'; 
        if (n === 'dem' || n === 'digital elevation model') return 'DEM'; 
        if (n === 'no info' || n === 'noinfo' || n === 'geen info') return 'No Info'; 
        return cat; // laat onbekende labels intact 
    } 

    // NIEUW: haal kleur op ongeacht hoofdletters/varianten 
    function getCatColor(cat) { 
        return (categoryColors[normalizeCat(cat)] || '#8E8E93'); 
    } 

    // AANGEPAST: kleuren in landenlijst via getCatColor 
    function renderCountriesList() { 
        showCountryTOC(); 
        let countries = countriesData.features.filter(f => f.properties.Name && !f.properties.RegionName); 
        const q = tocSearch.value.trim().toLowerCase(); 
        if (!q && !activeCategory) { 
            countryListEl.innerHTML = ''; 
            dividerLine.style.display = 'none'; 
            return; 
        } 
        if (q) { 
            countries = countries.filter(f => f.properties.Name.toLowerCase().includes(q)); 
        } 
        if (activeCategory) { 
            countries = countries.filter(f => normalizeCat(f.properties.Data || 'No Info') === activeCategory); 
            dividerLine.style.display = 'block'; 
        } else { 
            dividerLine.style.display = 'none'; 
        } 
        countries = countries.sort((a, b) => a.properties.Name.localeCompare(b.properties.Name)); 
        countryListEl.innerHTML = ''; 
        countries.forEach((c, idx) => { 
            const li = document.createElement('li'); 
            li.className = 'country-item'; 
            li.style.setProperty('--cat-color', getCatColor(c.properties.Data)); 
            const a = document.createElement('a'); 
            a.href = '#'; 
            a.textContent = c.properties.Name; 
            a.onclick = (e) => { 
                e.preventDefault(); 
                handleCountrySelect(c); 
            }; 
            li.appendChild(a); 
            countryListEl.appendChild(li); 
            setTimeout(() => li.classList.add('show'), 70 + idx * 45); 
        }); 
    } 

    function renderRegionList() { 
        showRegionTOC(); 
        const regionFilterBtns = document.getElementById('regionFilterBtns'); 
        regionFilterBtns.innerHTML = ''; 
        regionFilterBtns.className = 'legend-categories'; 
        const countryDataType = selectedCountryFeature?.properties?.Data || 'No Info'; 

        // Overview knop (altijd) 
        const homeBtn = document.createElement('button'); 
        homeBtn.className = 'legend-btn overview-home-btn'; // apart maken 
        homeBtn.innerHTML = '<span>National dataset</span>';
        homeBtn.style.setProperty('--cat-color', getCatColor(countryDataType)); 
        homeBtn.onclick = () => { 
            // Geen active state meer – gewoon navigatie 
            const mainRegion = regionsData.features.find( 
                f => (f.properties.Name || '').toLowerCase() === (selectedCountryFeature.properties.Name || '').toLowerCase() 
            ); 
            if (mainRegion) { 
                selectRegion(mainRegion.id, mainRegion.properties); 
            } else { 
                showInfo(selectedCountryFeature.properties, false); 
            } 
        }; 
        regionFilterBtns.appendChild(homeBtn); 

        // Bepaal beschikbare categorieën 
        if (regionsData && regionsData.features && regionsData.features.length > 0) { 
            const catsAvailable = [...new Set( 
                regionsData.features.map(f => normalizeCat(f.properties.Data || 'No Info')) 
            )]; 
            catsAvailable.forEach(cat => { 
                if (cat === 'Country data') return; 
                const btn = document.createElement('button'); 
                btn.className = 'legend-btn'; 
                btn.textContent = cat; 
                btn.style.setProperty('--cat-color', getCatColor(cat)); 
                btn.onclick = () => { 
                    [...regionFilterBtns.children].forEach(b => b.classList.remove('active')); 
                    btn.classList.add('active'); 
                    const filteredRegions = regionsData.features.filter( 
                        f => normalizeCat(f.properties.Data || 'No Info') === cat 
                    ); 
                    showRegionList(filteredRegions, cat); 
                }; 
                regionFilterBtns.appendChild(btn); 
            }); 
        } 
        // Start: geen lijst 
        document.getElementById('regionList').innerHTML = ''; 
    } 

    // AANGEPAST: kleurblokjes in de regio-lijst via getCatColor 
    function showRegionList(filteredRegions, cat) { 
        const regionList = document.getElementById('regionList'); 
        const divider = document.getElementById('regionDividerLine'); 
        regionList.innerHTML = ''; 
        if ( filteredRegions.length === 1 && selectedCountryFeature && filteredRegions[0].properties.Name.toLowerCase() === selectedCountryFeature.properties.Name.toLowerCase() ) { 
            selectRegion(filteredRegions[0].id, filteredRegions[0].properties); 
            divider.style.display = 'none'; 
            return; 
        } 
        divider.style.display = (cat && cat !== 'Country data' && filteredRegions.length > 0) ? 'block' : 'none'; 
        filteredRegions.forEach((f, i) => { 
            if (f.id === undefined) f.id = i; 
            const li = document.createElement('li'); 
            li.className = 'country-item'; 
            li.textContent = f.properties.Name; 
            li.style.setProperty('--cat-color', getCatColor(normalizeCat(f.properties.Data))); 
            li.onclick = () => { 
                const region = regionsData.features.find(r => r.id === f.id); 
                if (region) { 
                    selectRegion(region.id, region.properties); 
                } else { 
                    showInfo(f.properties, true); 
                } 
            }; 
            regionList.appendChild(li); 
            setTimeout(() => li.classList.add('show'), 70 + i * 45); 
        }); 
    } 

    function handleCountrySelect(feature) { 
        selectedCountryFeature = feature; 
        fetch(`data/region_map_data_${feature.properties.Name.toLowerCase().replace(/\s+/g, '_')}.geojson`)


        .then(r => r.ok ? r.json() : Promise.reject()) 
        .then(rd => { 
            if (rd && rd.features) { 
                rd.features.forEach((f, i) => { 
                    if (f.id === undefined) f.id = i; 
                    f.properties.Data = normalizeCat(f.properties.Data); 
                }); 
            } 
            regionsData = rd; 
            let mainRegion = regionsData.features.find( 
                f => (f.properties.Name || '').toLowerCase() === (feature.properties.Name || '').toLowerCase() 
            ); 
            selectedCountryFeature.mainRegion = mainRegion || null; 
            if (mainRegion) { 
                // Prefer the main region 
                showInfo(mainRegion.properties, true); 
                if (map.getSource('regions')) { 
                    if (selectedRegionFeatureId !== null) { 
                        map.setFeatureState({ source: 'regions', id: selectedRegionFeatureId }, { selected: false }); 
                    } 
                    selectedRegionFeatureId = mainRegion.id; 
                    map.setFeatureState({ source: 'regions', id: mainRegion.id }, { selected: true }); 
                } else { 
                    selectedRegionFeatureId = mainRegion.id; 
                } 
                try { 
                    const bbox = turf.bbox(mainRegion); 
                    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 20, duration: 1000, pitch: 45, bearing: 0 }); 
                } catch (e) {} 
            } else { 
                // Fallback: no region found 
                showInfo(feature.properties, false); 
            } 
            renderRegionList(); 
            showRegionsOnMap(regionsData); // These must always run 
            showTab('toc'); 
            map.setMinZoom(5); 
        }) 
        .catch(() => { 
            regionsData = { type: 'FeatureCollection', features: [] }; 
            renderRegionList(); 
            showInfo(feature.properties, false); 
            showTab('toc'); 
            map.setMinZoom(5); 
        }); 
    } 

    document.getElementById('regionOverviewBtn').onclick = overviewReset; 

    function updateTOCForType(type) { 
        tocSearch.style.display = 'none'; 
        tocList.innerHTML = ''; 
        tocList.style.display = 'flex'; 
        tocList.style.flexWrap = 'wrap'; 
        tocList.style.gap = '4px'; 
        const colorMap = { 
            Region: '#A7C1D9', 
            Pointcloud: '#A9B689', 
            DEM: '#D4602A', 
            'No info': '#8E8E93' 
        }; 
        const matches = countriesData.features 
        .filter(f => type === 'No info' ? !f.properties.Data : f.properties.Data === type) 
        .map(f => f.properties.Name) 
        .sort(); 
        if (!matches.length) { 
            tocList.innerHTML = '<li><em>No matches</em></li>'; 
        } else { 
            matches.forEach(name => { 
                const li = document.createElement('li'); 
                li.textContent = name; 
                li.style.backgroundColor = colorMap[type]; 
                li.style.color = '#fff'; 
                li.style.padding = '4px 8px'; 
                li.style.margin = '2px'; 
                li.addEventListener('click', () => { 
                    const feat = countriesData.features.find(f => f.properties.Name === name); 
                    handleCountrySelect(feat); 
                }); 
                tocList.append(li); 
            }); 
        } 
        const resetBtn = document.createElement('button'); 
        resetBtn.textContent = 'Reset view'; 
        resetBtn.style.padding = '4px 8px'; 
        resetBtn.style.margin = '2px'; 
        resetBtn.addEventListener('click', resetToCountries); 
        tocList.append(resetBtn); 
    } 

    function updateTOCList() { 
        const q = tocSearch.value.trim().toLowerCase(); 
        countryListEl.innerHTML = ''; 
        if (!q) { 
            return; 
        } 
        let matches = countriesData.features 
        .filter(f => f.properties.Name && !f.properties.RegionName) 
        .map(f => f.properties.Name) 
        .filter(n => n.toLowerCase().includes(q)); 
        matches = Array.from(new Set(matches)).sort(); 
        if (!matches.length) { 
            countryListEl.innerHTML = '<li><em>No matches</em></li>'; 
            return; 
        } 
        matches.forEach(name => { 
            const li = document.createElement('li'); 
            li.className = 'country-item'; 
            li.textContent = name; 
            countryListEl.appendChild(li); 
            setTimeout(()=>li.classList.add('show'), 70); // optioneel, voor animatie 
            li.onclick = () => alert('Select: ' + name); 
        }); 
    } 

    function initMap() { 
        window.map = new maplibregl.Map({ 
            container: 'map', 
            style: { 
                version: 8, 
                sources: { 
                    osm: { 
                        type: 'raster', 
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], 
                        tileSize: 256 
                    } 
                }, 
                layers: [{ 
                    id: 'osm', 
                    type: 'raster', 
                    source: 'osm', 
                    paint: { 'raster-opacity': 1 } 
                }] 
            }, 
            center: [5, 50], 
            zoom: 4, 
            pitch: 0, 
            bearing: 0, 
            minZoom: 2, 
            maxZoom: 10 
        }); 
        map.on('load', () => { 
            const onlyCountries = { 
                type: 'FeatureCollection', 
                features: countriesData.features.filter(f => f.properties.Name && !f.properties.RegionName) 
            }; 
            map.addSource('countries', { type: 'geojson', data: onlyCountries, generateId: true }); 
            map.addLayer({ 
                id: 'country-fill', 
                type: 'fill', 
                source: 'countries', 
                paint: { 
                    'fill-color': ['case', ['boolean', ['feature-state', 'highlightAllGreen'], false], '#A7C1D9', ['==', ['get', 'Data'], 'Region'], '#A7C1D9', ['==', ['get', 'Data'], 'Pointcloud'], '#A9B689', ['==', ['get', 'Data'], 'DEM'], '#D4602A', '#8E8E93'], 
                    'fill-opacity': 0.6 
                } 
            }); 
            map.addLayer({ 
                id: 'country-border', 
                type: 'line', 
                source: 'countries', 
                paint: { 
                    'line-color': '#333', 
                    'line-width': 2 
                } 
            }); 
            ['mouseenter', 'mouseleave'].forEach(evt => { 
                map.on(evt, 'country-fill', () => map.getCanvas().style.cursor = evt === 'mouseenter' ? 'pointer' : ''); 
            }); 
            map.on('click', 'country-fill', e => { 
                const feat = e.features[0]; 
                if (feat.properties.infoStatus !== 'hasinfo' && feat.properties.infoStatus !== 'region') return; 
                handleCountrySelect(feat); 
            }); 

            // Click outside countries/regions to return to overview
            map.on('click', e => {
                // Check if click hit any features on country or region layers
                
                let countryFeatures = [];
                if (map.getLayer('country-fill')) {
                    countryFeatures = map.queryRenderedFeatures({ layers: ['country-fill'] });
                }
                
                let regionFeatures = [];
                if (map.getLayer('region-fill')) {
                    regionFeatures = map.queryRenderedFeatures({ layers: ['region-fill'] });
                }                
                // If no features were hit and we're currently viewing regions, return to overview
                if (countryFeatures.length === 0 && regionFeatures.length === 0 && regionsData) {
                    overviewReset();
                }
            });
        }); 
    } 

    // AANGEPAST: kaart-styling robuust tegen hoofdletters/varianten 
    function showRegionsOnMap(rd) { 
        if (map.getLayer('country-fill')) map.setLayoutProperty('country-fill', 'visibility', 'none'); 
        if (map.getLayer('country-border')) map.setLayoutProperty('country-border', 'visibility', 'none'); 
        if (map.getLayer('region-fill')) map.removeLayer('region-fill'); 
        if (map.getLayer('region-border')) map.removeLayer('region-border'); 
        if (map.getSource('regions')) map.removeSource('regions'); 
        map.addSource('regions', { type: 'geojson', data: rd, generateId: true }); 
        map.addLayer({ 
            id: 'region-fill', 
            type: 'fill', 
            source: 'regions', 
            filter: ['!=', ['get', 'Name'], selectedCountryFeature.properties.Name], 
            paint: { 
                'fill-color': [ 
                    'case', ['boolean', ['feature-state', 'selected'], false], '#ffe900', 
                    ['==', ['downcase', ['get', 'Data']], 'region'], '#A7C1D9', 
                    ['==', ['downcase', ['get', 'Data']], 'pointcloud'], '#A9B689', 
                    ['==', ['downcase', ['get', 'Data']], 'dem'], '#D4602A', 
                    ['==', ['downcase', ['get', 'Data']], 'no info'], '#8E8E93', 
                    /* else */ '#8E8E93' 
                ], 
                'fill-opacity': 0.5 
            } 
        }); 
        map.addLayer({ 
            id: 'region-border', 
            type: 'line', 
            source: 'regions', 
            paint: { 
                'line-color': [ 'case', ['==', ['get', 'Name'], selectedCountryFeature.properties.Name], '#0367ff', '#003399' ], 
                'line-width': [ 'case', ['==', ['get', 'Name'], selectedCountryFeature.properties.Name], 4, 2 ] 
            } 
        }); 
        map.on('click', 'region-fill', e => { 
            selectRegion(e.features[0].id, e.features[0].properties); 
        }); 
    } 

    function selectRegion(id, props) { 
        console.log('selectRegion', id, props.Name); 
        if (!regionsData || !regionsData.features || !regionsData.features[id]) return; 
        if (selectedRegionFeatureId !== null) { 
            map.setFeatureState({ source: 'regions', id: selectedRegionFeatureId }, { selected: false }); 
        } 
        selectedRegionFeatureId = id; 
        map.setFeatureState({ source: 'regions', id }, { selected: true }); 
        const feature = regionsData.features[id]; 
        try { 
            const bbox = turf.bbox(feature); 
            map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 20, duration: 1000, pitch: 45, bearing: 0 }); 
        } catch (e) { 
            console.warn('Kan bounding box niet bepalen:', e); 
        } 
        showInfo(props, true); 
    } 

    function resetToCountries() { 
        selectedCountryFeature = null; 
        regionsData = null; 
        if (map.getLayer('region-fill')) map.removeLayer('region-fill'); 
        if (map.getLayer('region-border')) map.removeLayer('region-border'); 
        if (map.getSource('regions')) map.removeSource('regions'); 
        tocSearch.style.display = ''; 
        tocSearch.value = ''; 
        tocList.innerHTML = ''; 
        sidebar.style.display = 'none'; 
        map.easeTo({ center: [5,50], zoom:5, pitch:0, bearing:0, duration:1000 }); 
    } 

    function zoomTo(feature, pitch) { 
        const bbox = turf.bbox(feature); 
        map.fitBounds([ [bbox[0], bbox[1]], [bbox[2], bbox[3]] ], { padding:20, duration:1000, pitch, bearing:0 }); 
    } 

function showInfo(p, regionMode) { 
  const hasInfo = p.Data && p.Data.toLowerCase() !== 'region'; 
  // Titel altijd tonen 
  infoTitleEl.textContent = p.Name || 'No name'; 

  // Maintext altijd tonen (ook als er geen data is) 
  const mainText = (p.Info && p.Info.trim() !== '') 
  ? `<p>${p.Info}</p>` 
  : '<p>No info available.</p>';

  if (!hasInfo) { 
    // Alleen de tekst uit Info laten zien 
    infoBox.innerHTML = mainText; 
  } else { 
    // Tekst + tabellen tonen 
    const xyRef = p['XY Ref'] ? linkifyEPSG(p['XY Ref']) : 'N/A'; 
    const zRef = p['Z Ref'] ? linkifyEPSG(p['Z Ref']) : 'N/A'; 

    const dataHtml = `
      <h4>Acquisition & Coverage</h4>
      <ul>
        <li><strong>Dataset type:</strong> ${p.Data||'N/A'}</li>
        <li><strong>Type:</strong> ${p.Type||'N/A'}</li>
      </ul>
      <h4>Accuracy</h4>
      <ul>
        <li><strong>Planimetric:</strong> ${p.Planimetric||'N/A'} m</li>
        <li><strong>Altimetric:</strong> ${p.Altimetric||'N/A'} m</li>
      </ul>
      <h4>Additional Info</h4>
      <ul>
        <li><strong>Year:</strong> ${p.Year||'N/A'}</li>
        <li><strong>Access:</strong> <a href="${p.Link||'#'}" target="_blank">View dataroom</a></li>
        <li><strong>XY-ref:</strong> ${xyRef}</li>
        <li><strong>Z-ref:</strong> ${zRef}</li>
      </ul>`; 

    infoBox.innerHTML = mainText + dataHtml; 
  } 
  sidebar.style.display = 'block'; 
}
function linkifyEPSG(text) { 
  const m = text.match(/\(EPSG:(\d+)\)/i); 
  return m 
    ? text.replace(
        /\(EPSG:(\d+)\)/i, 
        `<a href="https://epsg.io/${m[1]}" target="_blank">(EPSG:${m[1]})</a>`
      ) 
    : text; 
}

}());