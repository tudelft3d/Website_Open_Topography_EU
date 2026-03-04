(function() { 
    function debounce(fn, delay) { 
        let timer; 
        return function(...args) { 
            clearTimeout(timer); 
            timer = setTimeout(() => fn.apply(this, args), delay); 
        }; 
    } 

    const standardCategoryColors = { 
        Region: '#9CA3AF', 
        Pointcloud: '#1B9E77', 
        DEM: '#0072B2', 
        'No Info':'#7F7F7F' 
    }; 
    // Paul Tol (Bright) qualitative colors, adapted for our 4 map categories.
    const colorblindCategoryColors = {
        Region: '#AA3377',     // Tol bright purple
        Pointcloud: '#EE6677', // Tol bright red
        DEM: '#66CCEE',        // Tol bright cyan
        'No Info': '#BBBBBB'   // Tol bright grey
    };
    let useColorblindPalette = false;
    let categoryColors = { ...standardCategoryColors };

    // State 
    let countriesData, regionsData, overviewMapData; 
    let selectedCountryFeature = null; 
    let selectedRegionFeatureId = null; 
    let activeDatasetRegionIds = [];
    let activeCategory = null; 
    let activeLegendCategories = new Set();
    let locationSearchIndex = [];
    let locationSearchIndexPromise = null;
    const mapFocusParams = (() => {
        try {
            const qp = new URLSearchParams(window.location.search || '');
            return {
                country: (qp.get('focusCountry') || '').trim(),
                region: (qp.get('focusRegion') || '').trim()
            };
        } catch (e) {
            return { country: '', region: '' };
        }
    })();
    let mapFocusHandled = false;

    // DOM 
    function showCountryTOC() { 
        document.getElementById('toc-country').style.display = 'block'; 
        document.getElementById('toc-region').style.display = 'none'; 
    } 

    function showRegionTOC() { 
        document.getElementById('toc-country').style.display = 'none'; 
        document.getElementById('toc-region').style.display = 'block'; 
    } 

    function buildRegionFileCandidates(countryName) {
        const base = String(countryName || '').toLowerCase().trim();
        const underscored = base.replace(/\s+/g, '_');
        return [
            `data/region_map_data_${underscored}.geojson`,
            `data/region_map_data_${base}.geojson`
        ];
    }

    function fetchCountryRegions(countryName) {
        const candidates = buildRegionFileCandidates(countryName);
        const tryAt = (index) => {
            if (index >= candidates.length) return Promise.reject(new Error('No region file found'));
            return fetch(candidates[index]).then((res) => {
                if (!res.ok) return tryAt(index + 1);
                return res.json();
            });
        };
        return tryAt(0);
    }

    function loadLocationSearchIndex() {
        if (locationSearchIndexPromise) return locationSearchIndexPromise;
        locationSearchIndexPromise = fetch('data/catalogue.csv')
            .then((response) => {
                if (!response.ok) throw new Error('catalogue missing');
                return response.text();
            })
            .then((csvText) => {
                const firstLine = (csvText.split(/\r?\n/, 1)[0] || '');
                const commaCount = (firstLine.match(/,/g) || []).length;
                const semicolonCount = (firstLine.match(/;/g) || []).length;
                const delimiter = semicolonCount > commaCount ? ';' : ',';
                const rows = parseCsvText(csvText, delimiter);
                if (!rows.length || rows[0].length === 0) return [];

                const key = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, '');
                const headers = rows[0].map((h) => key(h));
                const readFirst = (row, ...candidates) => {
                    for (let i = 0; i < candidates.length; i += 1) {
                        const value = row[candidates[i]];
                        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
                    }
                    return '';
                };

                const seen = new Set();
                const items = [];
                rows.slice(1).forEach((r) => {
                    const row = {};
                    headers.forEach((h, i) => {
                        row[h] = r[i] !== undefined ? r[i] : '';
                    });
                    const name = readFirst(row, 'name', 'regionname', 'country');
                    const mainCountry = readFirst(row, 'main_country', 'country') || name;
                    if (!name || !mainCountry) return;

                    const nameKey = normalizeCountryKey(name);
                    const countryKey = normalizeCountryKey(mainCountry);
                    const dedupeKey = `${nameKey}|${countryKey}`;
                    if (seen.has(dedupeKey)) return;
                    seen.add(dedupeKey);

                    items.push({
                        label: name,
                        country: mainCountry,
                        region: name,
                        searchText: `${name} ${mainCountry}`.toLowerCase()
                    });
                });

                return items.sort((a, b) => a.label.localeCompare(b.label));
            })
            .catch(() => []);
        return locationSearchIndexPromise.then((items) => {
            locationSearchIndex = Array.isArray(items) ? items : [];
            return locationSearchIndex;
        });
    }

    function ensureSearchDatalist() {
        const id = 'globalLocationSuggestions';
        let list = document.getElementById(id);
        if (!list) {
            list = document.createElement('datalist');
            list.id = id;
            document.body.appendChild(list);
        }
        if (tocSearch) tocSearch.setAttribute('list', id);
        if (mobileSearchInput) mobileSearchInput.setAttribute('list', id);
        return list;
    }

    function updateSearchSuggestions(query) {
        const list = ensureSearchDatalist();
        const q = String(query || '').trim().toLowerCase();
        const esc = (value) => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        if (!q) {
            list.innerHTML = '';
            return;
        }
        loadLocationSearchIndex().then((items) => {
            const matches = items
                .filter((it) => it.searchText.includes(q))
                .slice(0, 15);
            list.innerHTML = matches.map((it) => {
                const suffix = normalizeCountryKey(it.label) === normalizeCountryKey(it.country)
                    ? it.country
                    : `${it.label} - ${it.country}`;
                return `<option value="${esc(it.label)}" label="${esc(suffix)}"></option>`;
            }).join('');
        });
    }

    function findCountryFeatureByName(name) {
        const target = normalizeCountryKey(name);
        if (!target || !countriesData || !countriesData.features) return null;
        return countriesData.features.find((f) =>
            f &&
            f.properties &&
            f.properties.Name &&
            !f.properties.RegionName &&
            normalizeCountryKey(f.properties.Name) === target
        ) || null;
    }

    function focusCountryAndRegion(countryName, regionName) {
        const baseName = countryName || regionName;
        const countryFeature = findCountryFeatureByName(baseName);
        if (!countryFeature) return false;

        handleCountrySelect(countryFeature);
        const regionTarget = normalizeCountryKey(regionName);
        if (!regionTarget || regionTarget === normalizeCountryKey(countryFeature.properties.Name)) return true;

        let tries = 0;
        const maxTries = 50;
        const timer = setInterval(() => {
            tries += 1;
            if (!regionsData || !Array.isArray(regionsData.features) || !regionsData.features.length) {
                if (tries >= maxTries) clearInterval(timer);
                return;
            }

            const found = regionsData.features.find((f) =>
                normalizeCountryKey((f.properties && f.properties.Name) || '') === regionTarget
            );
            if (found && found.id !== undefined) {
                selectRegion(found.id, found.properties || {});
                clearInterval(timer);
                return;
            }
            if (tries >= maxTries) clearInterval(timer);
        }, 150);
        return true;
    }

    function focusMapFromQueryIfNeeded() {
        if (mapFocusHandled) return;
        if (!document.body.classList.contains('map-page')) return;
        if (!mapFocusParams.country && !mapFocusParams.region) return;
        if (!window.map || !countriesData || !Array.isArray(countriesData.features)) return;
        mapFocusHandled = true;
        focusCountryAndRegion(mapFocusParams.country, mapFocusParams.region);
    }

    function buildOverviewMapData() {
        const baseCountries = countriesData.features.filter(f => f.properties.Name && !f.properties.RegionName);
        const regionalCountries = baseCountries.filter(f => normalizeCat(f.properties.Data) === 'Region');
        if (!regionalCountries.length) {
            overviewMapData = { type: 'FeatureCollection', features: baseCountries };
            return Promise.resolve();
        }

        const replacements = regionalCountries.map((country) => {
            const countryName = country.properties.Name;
            return fetchCountryRegions(countryName)
                .then((rd) => {
                    const countryNameLc = String(countryName).toLowerCase();
                    const features = (rd && rd.features ? rd.features : [])
                        .filter((rf) => String((rf.properties && rf.properties.Name) || '').toLowerCase() !== countryNameLc)
                        .map((rf) => ({
                            type: 'Feature',
                            properties: {
                                ...(rf.properties || {}),
                                Data: normalizeCat((rf.properties || {}).Data || 'No Info'),
                                ParentCountry: countryName,
                                infoStatus: 'regionchild'
                            },
                            geometry: rf.geometry
                        }));
                    return { countryName, features };
                })
                .catch(() => ({ countryName, features: [] }));
        });

        return Promise.all(replacements).then((resolved) => {
            const replacementByCountry = {};
            resolved.forEach((entry) => {
                replacementByCountry[entry.countryName] = entry.features;
            });
            const merged = [];
            baseCountries.forEach((country) => {
                const countryName = country.properties.Name;
                const replacement = replacementByCountry[countryName];
                if (Array.isArray(replacement) && replacement.length) {
                    merged.push(...replacement);
                } else {
                    merged.push(country);
                }
            });
            overviewMapData = { type: 'FeatureCollection', features: merged };
        });
    }

    function overviewReset(keepView) { 
        activeCategory = null; 
        activeLegendCategories.clear();
        selectedCountryFeature = null; 
        selectedRegionFeatureId = null; 
        clearDatasetRegionSelection();
        regionsData = null; 
        document.getElementById('tocSearch').value = ''; 
        document.querySelectorAll('.legend-btn').forEach(b => b.classList.remove('active')); 
        if (legendPanel) {
            legendPanel.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        }
        showCountryTOC(); 
        const mapRef = window.map;
        if (mapRef) { 
            if (mapRef.getLayer('country-fill')) mapRef.setLayoutProperty('country-fill', 'visibility', 'visible'); 
            if (mapRef.getLayer('country-border')) mapRef.setLayoutProperty('country-border', 'visibility', 'visible'); 
            if (mapRef.getLayer('region-fill')) mapRef.removeLayer('region-fill'); 
            if (mapRef.getLayer('region-border')) mapRef.removeLayer('region-border'); 
            if (mapRef.getSource('regions')) mapRef.removeSource('regions'); 
            // clear any filters that may hide countries
            if (mapRef.getLayer('country-fill')) mapRef.setFilter('country-fill', null);
            if (mapRef.getLayer('country-border')) mapRef.setFilter('country-border', null);
            applyCategoryFilterToMap(); 
            if (!keepView) {
                mapRef.easeTo({ center: [5, 50], zoom: 5, pitch: 0, bearing: 0, duration: 1000 }); 
            }
            mapRef.setMinZoom(2); 
        } 
        sidebar.style.display = 'none'; // Sidebar sluiten bij reset 
        if (infoTitleEl) infoTitleEl.textContent = 'Select a country.'; 
        infoBox.innerHTML = 'Select a country.'; 
        if (document.getElementById('infoPanel')) { 
            document.getElementById('infoPanel').style.display = 'none'; 
        } 
        renderCountriesList(); 
    } 

    const sidebar = document.getElementById('sidebar'); 
    const sidebarBackBtn = document.getElementById('sidebar-back');
    const sidebarCloseBtn = document.getElementById('sidebar-close');
    const infoBox = document.getElementById('info'); 
    const infoTitleEl = document.getElementById('infoTitle'); 
    // const closeBtn = document.getElementById('closeBtn'); 
    const legendCatsEl = document.getElementById('legendCategories'); 
    const overviewBtn = document.getElementById('overviewBtn'); 
    const countryListEl = document.getElementById('countryList'); 
    const dividerLine = document.getElementById('dividerLine'); 
    const regionBackToCountryBtn = document.getElementById('regionBackToCountryBtn');
    const tocSearch = document.getElementById('tocSearch'); 
    const tocSearchToggle = document.getElementById('tocSearchToggle');
    const mobileSearchToggle = document.getElementById('mobileSearchToggle');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const mobileSearchHint = document.getElementById('mobileSearchHint');
    const tabSearch = document.getElementById('tab-search');
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
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            overviewReset();
        });
    }
    if (sidebarBackBtn) {
        let showBackBtn = false;
        try {
            const ref = document.referrer ? new URL(document.referrer) : null;
            const here = window.location;
            const fromPcOnMapButton = new URLSearchParams(here.search || '').get('skipIntro') === '1';
            const refPath = ref ? ref.pathname.toLowerCase() : '';
            const herePath = (here.pathname || '').toLowerCase();
            showBackBtn = !fromPcOnMapButton && !!(ref && ref.origin === here.origin && refPath !== herePath);
        } catch (e) {
            showBackBtn = false;
        }
        sidebarBackBtn.style.display = showBackBtn ? 'inline-flex' : 'none';
        sidebarBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'index.html';
            }
        });
    }
    if (document.body.classList.contains('map-page')) {
        tocSearch.addEventListener('input', renderCountriesList);
    }
    tocSearch.addEventListener('input', () => updateSearchSuggestions(tocSearch.value));
    tocSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const result = searchAndSelectCountry(tocSearch.value);
            if (result.ok) closeSearch();
        }
    });
    const positionSearch = (anchorEl) => {
        const anchor = anchorEl || tocSearchToggle;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const left = 12;
        const width = Math.max(160, rect.right - left);
        tocSearch.style.left = `${left}px`;
        tocSearch.style.width = `${width}px`;
        tocSearch.style.top = `${rect.top}px`;
    };
    const closeSearch = () => {
        if (tabSearch) tabSearch.classList.remove('open');
        if (tocSearch) tocSearch.classList.remove('mobile-open');
        if (mobileSearchOverlay) mobileSearchOverlay.classList.remove('open');
        document.getElementById('tab-title').classList.remove('hidden');
    };
    const searchAndSelectCountry = (query) => {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return { ok: false, reason: 'empty' };
        const onMapPage = document.body.classList.contains('map-page');

        if (onMapPage && countriesData && Array.isArray(countriesData.features)) {
            const countries = countriesData.features.filter(f => f.properties && f.properties.Name && !f.properties.RegionName);
            const exact = countries.find(f => String(f.properties.Name).toLowerCase() === q);
            const partial = countries.find(f => String(f.properties.Name).toLowerCase().includes(q));
            const match = exact || partial;
            if (match) {
                handleCountrySelect(match);
                return { ok: true };
            }
        }

        const indexedItems = Array.isArray(locationSearchIndex) ? locationSearchIndex : [];
        if (!indexedItems.length && locationSearchIndexPromise) {
            return { ok: false, reason: 'loading' };
        }
        const exactIndexed = indexedItems.find((it) => String(it.label).toLowerCase() === q || String(it.searchText).toLowerCase() === q);
        const partialIndexed = indexedItems.find((it) => String(it.searchText).toLowerCase().includes(q));
        const indexedMatch = exactIndexed || partialIndexed;
        if (!indexedMatch) return { ok: false, reason: 'notfound' };

        if (onMapPage && countriesData && Array.isArray(countriesData.features) && window.map) {
            const ok = focusCountryAndRegion(indexedMatch.country, indexedMatch.region);
            return ok ? { ok: true } : { ok: false, reason: 'notfound' };
        }

        const href = `map.html?focusCountry=${encodeURIComponent(indexedMatch.country)}&focusRegion=${encodeURIComponent(indexedMatch.region)}`;
        window.location.href = href;
        return { ok: true };
    };
    const openSearch = (anchorEl) => {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
            if (mobileSearchOverlay) mobileSearchOverlay.classList.add('open');
            if (mobileSearchInput) {
                mobileSearchInput.value = '';
                if (mobileSearchHint) mobileSearchHint.textContent = '';
                mobileSearchInput.focus();
            }
        } else if (tabSearch) {
            tabSearch.classList.add('open');
            positionSearch(anchorEl);
            tocSearch.focus();
            tocSearch.select();
        }
        document.getElementById('tab-title').classList.add('hidden');
    };
    if (tocSearchToggle) {
        tocSearchToggle.addEventListener('click', () => openSearch(tocSearchToggle));
    }
    if (mobileSearchToggle) {
        mobileSearchToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSearch(mobileSearchToggle);
        });
    }
    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('open');
        });
        mobileMenu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => mobileMenu.classList.remove('open'));
        });
    }
    if (mobileSearchOverlay && mobileSearchInput) {
        mobileSearchInput.addEventListener('input', () => updateSearchSuggestions(mobileSearchInput.value));
        mobileSearchOverlay.addEventListener('click', (e) => {
            if (e.target === mobileSearchOverlay) {
                closeSearch();
            }
        });
        mobileSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearch();
                return;
            }
            if (e.key === 'Enter') {
                const result = searchAndSelectCountry(mobileSearchInput.value);
                if (result.ok) {
                    closeSearch();
                } else if (mobileSearchHint) {
                    mobileSearchHint.textContent = result.reason === 'loading'
                        ? 'Data is still loading, try again in a moment.'
                        : 'Country not found.';
                }
            }
        });
    }
    document.addEventListener('click', (e) => {
        if ((tabSearch && !tabSearch.contains(e.target)) &&
            (!mobileSearchToggle || !mobileSearchToggle.contains(e.target)) &&
            (!tocSearch || !tocSearch.contains(e.target)) &&
            (!mobileSearchOverlay || !mobileSearchOverlay.contains(e.target))) {
            closeSearch();
        }
        if (mobileMenu && mobileMenu.classList.contains('open') && !mobileMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            mobileMenu.classList.remove('open');
        }
        const menu = document.getElementById('dataMenu');
        if (menu && menu.style.display === 'block' && !menu.contains(e.target) && !dataTab.contains(e.target)) {
            menu.style.display = 'none';
        }
    }, true);
    window.addEventListener('resize', () => {
        if (tabSearch && tabSearch.classList.contains('open')) positionSearch(tocSearchToggle);
    });
    loadLocationSearchIndex();
    if (overviewBtn) {
        overviewBtn.onclick = overviewReset;
    }
    if (tabs.help && tabs.help.tagName === 'BUTTON') {
        tabs.help.addEventListener('click', () => {
            window.open('contribute.html', '_blank', 'noopener');
        });
    }

    const dataTab = document.getElementById('tab-data');
    const dataMenu = document.getElementById('dataMenu');
    let dataMenuCloseTimer = null;
    const cancelCloseDataMenu = () => {
        if (dataMenuCloseTimer) {
            clearTimeout(dataMenuCloseTimer);
            dataMenuCloseTimer = null;
        }
    };
    const scheduleCloseDataMenu = () => {
        cancelCloseDataMenu();
        dataMenuCloseTimer = setTimeout(() => {
            dataMenu.style.display = 'none';
        }, 140);
    };
    const dataMapBtn = document.getElementById('dataMapBtn');
    if (dataMapBtn) {
        dataMapBtn.addEventListener('click', () => {
            overviewReset();
            dataMenu.style.display = 'none';
        });
    }
    const dataCatalogueBtn = document.getElementById('dataCatalogueBtn');
    if (dataCatalogueBtn) {
        dataCatalogueBtn.addEventListener('click', () => {
            window.location.href = 'catalogue.html';
        });
    }
    const positionDataMenu = () => {
        const rect = dataTab.getBoundingClientRect();
        dataMenu.style.left = `${rect.left + window.scrollX}px`;
        dataMenu.style.top = `${rect.bottom + window.scrollY + 2}px`;
    };
    dataTab.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSearch();
        cancelCloseDataMenu();
        positionDataMenu();
        const open = dataMenu.style.display === 'block';
        dataMenu.style.display = open ? 'none' : 'block';
    });
    dataTab.addEventListener('mouseenter', () => {
        cancelCloseDataMenu();
        positionDataMenu();
        dataMenu.style.display = 'block';
    });
    dataTab.addEventListener('mouseleave', () => {
        scheduleCloseDataMenu();
    });
    dataMenu.addEventListener('mouseenter', () => {
        cancelCloseDataMenu();
    });
    dataMenu.addEventListener('mouseleave', () => {
        scheduleCloseDataMenu();
    });
    window.addEventListener('resize', () => {
        if (dataMenu.style.display === 'block') positionDataMenu();
    });
    // document.getElementById('helpModalClose').addEventListener('click', () => showTab('toc')); 

    function showTab(name) { 
        Object.keys(panels).forEach(key => { 
            const panel = panels[key];
            if (panel) {
                panel.style.display = (key === name) ? 'block' : 'none'; 
            }
            const tab = tabs[key];
            if (tab) {
                tab.classList.toggle('active', key === name); 
            }
        }); 
        if (name === 'help') { 
            sidebar.style.display = 'none'; // Sidebar verbergen bij help 
        } 
    } 

    // Load data 
    if (document.body.classList.contains('map-page')) {
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
            return buildOverviewMapData();
        })
        .then(() => {
            renderCategoryButtons(); 
            renderCountriesList(); 
            initMap(); 
            updateTOCList(); 
            showTab('toc'); 
        }); 
    }

    function renderCategoryButtons() { 
        if (!legendCatsEl) return;
        legendCatsEl.innerHTML = ''; 
        const orderedCats = ['Pointcloud', 'DEM', 'No Info', 'Region']; 
        orderedCats.forEach(cat => { 
            const color = categoryColors[cat] || '#7F7F7F'; 
            const btn = document.createElement('button'); 
            btn.className = 'legend-btn'; 
            btn.setAttribute('data-color', cat); 
            btn.style.setProperty('--cat-color', color); 
            if (cat === 'Region') { 
                btn.classList.add('region-btn'); 
                btn.innerHTML = '<span>Regional</span>'; // logo + tekst via CSS 
            } else { 
                const label = (cat === 'DEM') ? 'Elevation model' : (cat === 'No Info' ? 'No data / unknown' : cat); 
                btn.textContent = label; 
            } 
            btn.onclick = () => { 
                activeLegendCategories.clear();
                if (legendPanel) {
                    legendPanel.querySelectorAll('li').forEach(li => li.classList.remove('active'));
                }
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
        return (categoryColors[normalizeCat(cat)] || '#7F7F7F'); 
    } 

    function buildCountryFillExpression() {
        return [
            'case',
            ['boolean', ['feature-state', 'highlightAllGreen'], false], getCatColor('Region'),
            ['==', ['get', 'Data'], 'Region'], getCatColor('Region'),
            ['==', ['get', 'Data'], 'Pointcloud'], getCatColor('Pointcloud'),
            ['==', ['get', 'Data'], 'DEM'], getCatColor('DEM'),
            getCatColor('No Info')
        ];
    }

    function buildRegionFillExpression() {
        return [
            'case',
            ['boolean', ['feature-state', 'selected'], false], '#ffe900',
            ['boolean', ['feature-state', 'datasetSelected'], false], '#ffb703',
            ['==', ['downcase', ['get', 'Data']], 'region'], getCatColor('Region'),
            ['==', ['downcase', ['get', 'Data']], 'pointcloud'], getCatColor('Pointcloud'),
            ['==', ['downcase', ['get', 'Data']], 'dem'], getCatColor('DEM'),
            ['==', ['downcase', ['get', 'Data']], 'no info'], getCatColor('No Info'),
            getCatColor('No Info')
        ];
    }

    function clearDatasetRegionSelection() {
        if (window.map && map.getSource('regions') && activeDatasetRegionIds.length) {
            activeDatasetRegionIds.forEach((id) => {
                try {
                    map.setFeatureState({ source: 'regions', id }, { datasetSelected: false });
                } catch (e) {}
            });
        }
        activeDatasetRegionIds = [];
    }

    function setDatasetRegionSelectionByNames(regionNames) {
        clearDatasetRegionSelection();
        if (!window.map || !map.getSource('regions') || !regionsData || !Array.isArray(regionsData.features)) return;

        const targets = new Set(
            (regionNames || [])
                .map((name) => String(name || '').trim().toLowerCase())
                .filter(Boolean)
        );
        if (!targets.size) return;

        const matchingFeatures = regionsData.features.filter((feature) => {
            const name = String((feature && feature.properties && feature.properties.Name) || '').trim().toLowerCase();
            return name && targets.has(name);
        });
        if (!matchingFeatures.length) return;

        activeDatasetRegionIds = matchingFeatures
            .map((feature) => feature && feature.id)
            .filter((id) => id !== null && id !== undefined);

        activeDatasetRegionIds.forEach((id) => {
            try {
                map.setFeatureState({ source: 'regions', id }, { datasetSelected: true });
            } catch (e) {}
        });
    }

    function updateLegendSwatches() {
        const swatchMap = {
            '.swatch.pc': 'Pointcloud',
            '.swatch.dem': 'DEM',
            '.swatch.region': 'Region',
            '.swatch.noinfo': 'No Info'
        };
        Object.keys(swatchMap).forEach((selector) => {
            const el = document.querySelector(selector);
            if (el) el.style.background = getCatColor(swatchMap[selector]);
        });
    }

    function getMapInstance() {
        const m = window.map;
        if (!m) return null;
        if (typeof m.getLayer !== 'function') return null;
        if (typeof m.setPaintProperty !== 'function') return null;
        return m;
    }

    function applyCategoryPalette() {
        categoryColors = useColorblindPalette ? { ...colorblindCategoryColors } : { ...standardCategoryColors };
        updateLegendSwatches();

        const mapRef = getMapInstance();
        if (mapRef) {
            if (mapRef.getLayer('country-fill')) {
                mapRef.setPaintProperty('country-fill', 'fill-color', buildCountryFillExpression());
            }
            if (mapRef.getLayer('region-fill')) {
                mapRef.setPaintProperty('region-fill', 'fill-color', buildRegionFillExpression());
            }
        }

        if (typeof renderCategoryButtons === 'function') renderCategoryButtons();
        if (typeof renderCountriesList === 'function' && countriesData) renderCountriesList();
        if (selectedCountryFeature && regionsData && typeof renderRegionList === 'function') renderRegionList();
    }

    // AANGEPAST: kleuren in landenlijst via getCatColor 
    function renderCountriesList() { 
        if (!countriesData || !countryListEl || !dividerLine || !tocSearch) return;
        showCountryTOC(); 
        let countries = countriesData.features.filter(f => f.properties.Name && !f.properties.RegionName); 
        const q = tocSearch.value.trim().toLowerCase(); 
        const selectedCats = activeLegendCategories.size
            ? Array.from(activeLegendCategories)
            : (activeCategory ? [activeCategory] : []);
        if (!q && !selectedCats.length) { 
            countryListEl.innerHTML = ''; 
            dividerLine.style.display = 'none'; 
            return; 
        } 
        if (q) { 
            countries = countries.filter(f => f.properties.Name.toLowerCase().includes(q)); 
        } 
        if (selectedCats.length) { 
            countries = countries.filter(f => selectedCats.includes(normalizeCat(f.properties.Data || 'No Info'))); 
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
        homeBtn.onclick = returnToCountryView;
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

    function returnToCountryView() {
        if (!selectedCountryFeature || !selectedCountryFeature.properties) return;
        const mainRegion = regionsData && regionsData.features
            ? regionsData.features.find(
                f => (f.properties.Name || '').toLowerCase() === (selectedCountryFeature.properties.Name || '').toLowerCase()
            )
            : null;
        if (mainRegion) {
            selectRegion(mainRegion.id, mainRegion.properties);
        } else {
            clearDatasetRegionSelection();
            showInfo(selectedCountryFeature.properties, false);
            try {
                zoomTo(selectedCountryFeature, 45);
            } catch (e) {}
        }
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
            if (mainRegion) {
                showInfo(mainRegion.properties, true);
            }
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

    const regionOverviewBtn = document.getElementById('regionOverviewBtn');
    if (regionOverviewBtn) {
        regionOverviewBtn.onclick = overviewReset;
    }
    if (regionBackToCountryBtn) {
        regionBackToCountryBtn.onclick = returnToCountryView;
    }

    function updateTOCForType(type) { 
        tocSearch.style.display = 'none'; 
        tocList.innerHTML = ''; 
        tocList.style.display = 'flex'; 
        tocList.style.flexWrap = 'wrap'; 
        tocList.style.gap = '4px'; 
        const colorMap = { 
            Region: '#0072B2', 
            Pointcloud: '#1B9E77', 
            DEM: '#7570B3', 
            'No info': '#7F7F7F' 
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
            const mapFeatures = (overviewMapData && overviewMapData.features) ? overviewMapData.features : countriesData.features;
            const onlyCountries = { 
                type: 'FeatureCollection', 
                features: mapFeatures.filter(f => f.properties.Name && !f.properties.RegionName) 
            }; 
            map.addSource('countries', { type: 'geojson', data: onlyCountries, generateId: true }); 
            map.addLayer({ 
                id: 'country-fill', 
                type: 'fill', 
                source: 'countries', 
                paint: { 
                    'fill-color': buildCountryFillExpression(), 
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

            // Unified click handling: select region first, then country, otherwise reset
            map.on('click', e => {
                const regionLayers = ['region-fill', 'region-border'].filter(layerId => map.getLayer(layerId));
                if (regionLayers.length) {
                    const regionFeatures = map.queryRenderedFeatures(e.point, { layers: regionLayers });
                    if (regionFeatures.length) {
                        const regionFeature = regionFeatures[0];
                        if (regionFeature && regionFeature.id !== undefined) {
                            selectRegion(regionFeature.id, regionFeature.properties);
                            return;
                        }
                    }
                }

                const countryFeatures = map.queryRenderedFeatures(e.point, { layers: ['country-fill'] });
                if (countryFeatures.length) {
                    const feat = countryFeatures[0];
                    if (feat.properties.ParentCountry) {
                        const parentCountryName = String(feat.properties.ParentCountry).toLowerCase();
                        const parentCountry = countriesData.features.find((f) =>
                            f.properties &&
                            f.properties.Name &&
                            !f.properties.RegionName &&
                            String(f.properties.Name).toLowerCase() === parentCountryName
                        );
                        if (parentCountry) {
                            handleCountrySelect(parentCountry);
                            return;
                        }
                    }
                    if (feat.properties.infoStatus === 'hasinfo' || feat.properties.infoStatus === 'region') {
                        handleCountrySelect(feat);
                        return;
                    }
                }

                overviewReset();
            });
            focusMapFromQueryIfNeeded();
        }); 
    } 

    // AANGEPAST: kaart-styling robuust tegen hoofdletters/varianten 
    function showRegionsOnMap(rd) { 
        // keep countries visible so switching countries remains possible 
        clearDatasetRegionSelection();
        if (map.getLayer('region-fill')) map.removeLayer('region-fill'); 
        if (map.getLayer('region-border')) map.removeLayer('region-border'); 
        if (map.getSource('regions')) map.removeSource('regions'); 
        if (selectedCountryFeature && selectedCountryFeature.properties && selectedCountryFeature.properties.Name) {
            const selectedName = selectedCountryFeature.properties.Name;
            if (map.getLayer('country-fill')) {
                map.setFilter('country-fill', ['!=', ['get', 'Name'], selectedName]);
            }
            if (map.getLayer('country-border')) {
                map.setFilter('country-border', ['!=', ['get', 'Name'], selectedName]);
            }
        }
        map.addSource('regions', { type: 'geojson', data: rd, generateId: true }); 
        map.addLayer({ 
            id: 'region-fill', 
            type: 'fill', 
            source: 'regions', 
            filter: ['!=', ['get', 'Name'], selectedCountryFeature.properties.Name], 
            paint: { 
                'fill-color': buildRegionFillExpression(), 
                'fill-opacity': 0.75 
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
        // Region selection is handled in the unified map click handler above.
    } 

    function selectRegion(id, props) { 
        console.log('selectRegion', id, props.Name); 
        if (!regionsData || !regionsData.features || !regionsData.features[id]) return; 
        clearDatasetRegionSelection();
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
        clearDatasetRegionSelection();
        regionsData = null; 
        map.removeLayer('region-fill'); 
        map.removeLayer('region-border'); 
        map.removeSource('regions'); 
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

function normalizeCountryKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const countryFlagCodes = {
  albania: 'al',
  andorra: 'ad',
  austria: 'at',
  belarus: 'by',
  belgium: 'be',
  'bosnia and herzegovina': 'ba',
  bulgaria: 'bg',
  croatia: 'hr',
  cyprus: 'cy',
  czechia: 'cz',
  'czech republic': 'cz',
  denmark: 'dk',
  estonia: 'ee',
  finland: 'fi',
  france: 'fr',
  germany: 'de',
  greece: 'gr',
  hungary: 'hu',
  iceland: 'is',
  ireland: 'ie',
  italy: 'it',
  kosovo: 'xk',
  latvia: 'lv',
  liechtenstein: 'li',
  lithuania: 'lt',
  luxembourg: 'lu',
  malta: 'mt',
  moldova: 'md',
  monaco: 'mc',
  montenegro: 'me',
  netherlands: 'nl',
  'north macedonia': 'mk',
  norway: 'no',
  poland: 'pl',
  portugal: 'pt',
  romania: 'ro',
  'san marino': 'sm',
  serbia: 'rs',
  slovakia: 'sk',
  slovenia: 'si',
  spain: 'es',
  sweden: 'se',
  switzerland: 'ch',
  ukraine: 'ua',
  'united kingdom': 'gb',
  england: 'gb',
  europe: 'eu'
};

function resolveFlagCodeForFeature(p) {
  const explicitCode = p && (p.FlagCode || p.flag_code || p.flag);
  if (explicitCode) return String(explicitCode).toLowerCase().trim();

  const candidates = [
    p && p.ParentCountry,
    p && p.main_country,
    p && p.country,
    selectedCountryFeature && selectedCountryFeature.properties && selectedCountryFeature.properties.Name,
    p && p.Name
  ].filter(Boolean);

  for (let i = 0; i < candidates.length; i += 1) {
    const key = normalizeCountryKey(candidates[i]);
    if (/^[a-z]{2}$/.test(key)) return key;
    if (countryFlagCodes[key]) return countryFlagCodes[key];
  }
  return '';
}

function getBannerNavigationItems() {
  const items = [];
  if (regionsData && Array.isArray(regionsData.features) && regionsData.features.length) {
    regionsData.features.forEach((f, i) => {
      if (f.id === undefined) f.id = i;
      items.push({
        kind: 'region',
        id: f.id,
        name: (f.properties && f.properties.Name) || '',
        properties: f.properties || {}
      });
    });

    if (selectedCountryFeature && selectedCountryFeature.properties) {
      const countryName = String(selectedCountryFeature.properties.Name || '').toLowerCase();
      const hasCountryInRegions = items.some((it) => String(it.name || '').toLowerCase() === countryName);
      if (!hasCountryInRegions) {
        items.unshift({
          kind: 'country',
          id: null,
          name: selectedCountryFeature.properties.Name || '',
          properties: selectedCountryFeature.properties
        });
      }
    }
  } else if (selectedCountryFeature && selectedCountryFeature.properties) {
    items.push({
      kind: 'country',
      id: null,
      name: selectedCountryFeature.properties.Name || '',
      properties: selectedCountryFeature.properties
    });
  }
  return items;
}

function findCurrentBannerItemIndex(items, p, regionMode) {
  if (!items.length) return -1;
  if (regionMode && selectedRegionFeatureId !== null) {
    const idxById = items.findIndex((it) => it.kind === 'region' && it.id === selectedRegionFeatureId);
    if (idxById !== -1) return idxById;
  }

  const currentName = String((p && p.Name) || '').toLowerCase();
  if (currentName) {
    const idxByName = items.findIndex((it) => String(it.name || '').toLowerCase() === currentName);
    if (idxByName !== -1) return idxByName;
  }
  return 0;
}

function navigateInfoBanner(step, p, regionMode) {
  const items = getBannerNavigationItems();
  if (items.length < 2) return;

  const currentIdx = findCurrentBannerItemIndex(items, p, regionMode);
  const nextIdx = (currentIdx + step + items.length) % items.length;
  const nextItem = items[nextIdx];
  if (!nextItem) return;

  if (nextItem.kind === 'region' && nextItem.id !== null && nextItem.id !== undefined) {
    selectRegion(nextItem.id, nextItem.properties);
    return;
  }

  if (window.map && map.getSource('regions') && selectedRegionFeatureId !== null) {
    try {
      map.setFeatureState({ source: 'regions', id: selectedRegionFeatureId }, { selected: false });
    } catch (e) {}
  }
  selectedRegionFeatureId = null;
  showInfo(nextItem.properties, false);
}

function showInfo(p, regionMode, yearIndex, datasetIndex, activeTabOverride) { 
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const hasInfo = [
    p && p.Data,
    p && p.Type,
    p && p.National,
    p && p.Urban,
    p && p.Planimetric,
    p && p.Altimetric,
    p && p.Year,
    p && p.Link,
    p && p['XY Ref'],
    p && p['Z Ref']
  ].some((value) => value !== null && value !== undefined && String(value).trim() !== '');
  const objectName = p.Name || 'No name';
  const formatMeters = (value) => (value || value === 0 ? `${value} m` : 'N/A');
  const normalizeValue = (value) => {
    if (value === 0) return '0';
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text) return '';
    if (/^(n\/a|na|none|null|geen data|no data|unknown)$/i.test(text)) return '';
    return text;
  };
  const formatSpatialDistribution = (national, urban) => {
    const nationalVal = normalizeValue(national);
    const urbanVal = normalizeValue(urban);
    if (nationalVal && urbanVal && nationalVal === urbanVal) return `${nationalVal} ppsm`;
    if (nationalVal && urbanVal) return `${nationalVal} to ${urbanVal} ppsm`;
    if (nationalVal) return `${nationalVal} ppsm`;
    if (urbanVal) return `${urbanVal} ppsm`;
    return 'N/A';
  };
  const splitSeries = (value) => {
    if (value === null || value === undefined) return [];
    const text = String(value).trim();
    if (!text) return [];
    return text.split(/\s*,\s*/).filter(Boolean);
  };
  const uniqueValues = (values) => {
    const seen = new Set();
    return values.filter((value) => {
      const key = String(value).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const firstValue = (...values) => {
    for (const value of values) {
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  };
  const providerValue = firstValue(
    p && p['Data Provider'],
    p && p['Data provider'],
    p && p.Provider,
    p && p.provider,
    p && p.Organisation,
    p && p.Organization,
    p && p.Agency
  );
  const datasetFieldValue = firstValue(
    p && p['Data Name'],
    p && p['Data name'],
    p && p.Dataset,
    p && p['Dataset Name'],
    p && p.dataset_name
  );
  const parseDatasetNamesFromInfo = (infoText) => {
    if (!infoText) return [];
    const matches = String(infoText).match(/\b[A-Z][A-Za-z0-9-]*\d+[A-Za-z0-9-]*\b/g) || [];
    return uniqueValues(matches);
  };
  const parseDatasetNamesFromLink = (linkValue) => {
    if (!linkValue) return [];
    try {
      const url = new URL(String(linkValue));
      const segments = url.pathname.split('/').map((segment) => segment.trim()).filter(Boolean);
      const candidate = segments.reverse().find((segment) => !/^(en|nl|fr|de|download)$/i.test(segment));
      if (!candidate) return [];
      const normalized = candidate.replace(/[-_]+/g, ' ').trim();
      return normalized ? [normalized] : [];
    } catch (e) {
      return [];
    }
  };
  const parseDatasetRegionMap = (infoText, names) => {
    const text = String(infoText || '');
    const lowerText = text.toLowerCase();
    const datasetMap = {};
    const splitRegionNames = (segmentText) => {
      return String(segmentText || '')
        .replace(/\bcounties?\b/gi, '')
        .replace(/\bcounty\b/gi, '')
        .replace(/\s+and\s+/gi, ', ')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    };

    names.forEach((name, index) => {
      const lowerName = String(name || '').toLowerCase();
      if (!lowerName) {
        datasetMap[name] = [];
        return;
      }

      const markers = [`${lowerName} is available in`, `the ${lowerName} is available in`];
      let start = -1;
      let markerLength = 0;
      markers.some((marker) => {
        const markerIndex = lowerText.indexOf(marker);
        if (markerIndex === -1) return false;
        start = markerIndex + marker.length;
        markerLength = marker.length;
        return true;
      });

      if (start === -1 || markerLength === 0) {
        datasetMap[name] = [];
        return;
      }

      const nextDatasetStarts = names
        .slice(index + 1)
        .map((otherName) => String(otherName || '').toLowerCase())
        .flatMap((otherName) => [
          lowerText.indexOf(`while the ${otherName} is available in`, start),
          lowerText.indexOf(`${otherName} is available in`, start)
        ])
        .filter((pos) => pos !== -1);
      const periodIndex = lowerText.indexOf('.', start);
      const endCandidates = [
        ...nextDatasetStarts,
        periodIndex
      ].filter((pos) => pos !== -1);
      const end = endCandidates.length ? Math.min(...endCandidates) : text.length;
      datasetMap[name] = splitRegionNames(text.slice(start, end));
    });

    return datasetMap;
  };
  const datasetOptions = uniqueValues([
    ...splitSeries(datasetFieldValue),
    ...parseDatasetNamesFromInfo(p && p.Info),
    ...parseDatasetNamesFromLink(p && p.Link)
  ]);
  const datasetRegionMap = parseDatasetRegionMap(p && p.Info, datasetOptions);
  const yearSeries = splitSeries(p.Year);
  const hasYearSwitcher = yearSeries.length > 1;
  const hasDatasetSwitcher = datasetOptions.length > 1;
  const hasLinkedDatasetSeries = hasDatasetSwitcher && hasYearSwitcher && datasetOptions.length === yearSeries.length;
  const requestedSeriesIndex = Number.isInteger(datasetIndex)
    ? datasetIndex
    : (Number.isInteger(yearIndex) ? yearIndex : 0);
  const activeDatasetIndex = hasDatasetSwitcher
    ? Math.max(0, Math.min(requestedSeriesIndex, datasetOptions.length - 1))
    : 0;
  const activeYearIndex = hasYearSwitcher
    ? Math.max(0, Math.min(hasLinkedDatasetSeries ? activeDatasetIndex : requestedSeriesIndex, yearSeries.length - 1))
    : 0;
  const valueForYear = (rawValue) => {
    if (!hasYearSwitcher) return rawValue;
    const parts = splitSeries(rawValue);
    if (parts.length === yearSeries.length) return parts[activeYearIndex];
    return rawValue;
  };
  const valueForDataset = (rawValue) => {
    if (!hasDatasetSwitcher) return rawValue;
    const parts = splitSeries(rawValue);
    if (parts.length === datasetOptions.length) return parts[activeDatasetIndex];
    return rawValue;
  };
  const valueForSelection = (rawValue) => {
    const datasetScoped = valueForDataset(rawValue);
    if (datasetScoped !== rawValue) return datasetScoped;
    return valueForYear(rawValue);
  };
  const normalizeDatasetSlug = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  const getLinkDatasetSlug = () => {
    const linkValue = p && p.Link;
    if (!linkValue) return '';
    try {
      const url = new URL(String(linkValue));
      const segments = url.pathname.split('/').map((segment) => segment.trim()).filter(Boolean);
      const candidate = segments.reverse().find((segment) => !/^(en|nl|fr|de|download)$/i.test(segment));
      return normalizeDatasetSlug(candidate);
    } catch (e) {
      return '';
    }
  };
  const linkedDatasetSlug = getLinkDatasetSlug();
  const activeDatasetSlug = normalizeDatasetSlug(datasetOptions[activeDatasetIndex] || '');
  const hasSingleDatasetSpecificFallback = hasDatasetSwitcher && linkedDatasetSlug && activeDatasetSlug && linkedDatasetSlug !== activeDatasetSlug;
  const valueForSpecs = (rawValue) => {
    const datasetParts = hasDatasetSwitcher ? splitSeries(rawValue) : [];
    if (hasDatasetSwitcher && datasetParts.length === datasetOptions.length) {
      return datasetParts[activeDatasetIndex];
    }
    const yearParts = hasYearSwitcher ? splitSeries(rawValue) : [];
    if (hasYearSwitcher && yearParts.length === yearSeries.length) {
      return yearParts[activeYearIndex];
    }
    if (hasSingleDatasetSpecificFallback) return '';
    return rawValue;
  };
  const navItems = getBannerNavigationItems();
  const navHtml = navItems.length > 1
    ? `<div class="info-banner-nav">
         <button id="infoBannerPrev" class="info-banner-btn" aria-label="Previous region">‹</button>
         <button id="infoBannerNext" class="info-banner-btn" aria-label="Next region">›</button>
       </div>`
    : '';
  const buildTypeBadges = (typeText) => {
    if (!typeText || !String(typeText).trim()) return '<strong>N/A</strong>';
    const tokens = String(typeText).split(',').map(t => t.trim()).filter(Boolean);
    if (!tokens.length) return '<strong>N/A</strong>';
    const chips = tokens.map((token) => {
      const upper = token.toUpperCase();
      const iconSrc = `assets/images/icons/${upper.toLowerCase()}.png`;
      return `<span class="type-pill" title="${escapeHtml(upper)}"><img class="type-icon" src="${iconSrc}" alt="${escapeHtml(upper)}" /></span>`;
    }).join('');
    return `<div class="type-pillset">${chips}</div>`;
  };
  const buildInfoParagraphs = (text) => {
    const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return '<p>No info available.</p>';
    return normalized
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('');
  };
  const buildDatasetSpecificInfo = (infoText, names, activeName) => {
    const normalized = String(infoText || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return '';
    if (!activeName || names.length < 2) return normalized;

    const nameTokens = names.map((name) => String(name).toLowerCase());
    const activeToken = String(activeName).toLowerCase();
    const sentences = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
    const genericSentences = [];
    const matchingSentences = [];

    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      const mentionsDataset = nameTokens.some((token) => lower.includes(token));
      if (!mentionsDataset) {
        genericSentences.push(trimmed);
        return;
      }
      if (lower.includes(activeToken)) {
        matchingSentences.push(trimmed);
      }
    });

    if (!matchingSentences.length) return normalized;
    return [...genericSentences, ...matchingSentences].join(' ');
  };
  const getAsprsClassifications = (infoText) => {
    const text = String(infoText || '').toLowerCase();
    const definitions = [
      { code: 0, label: 'Never classified', patterns: ['never classified'] },
      { code: 1, label: 'Unclassified', patterns: ['unclassified'] },
      { code: 2, label: 'Ground', patterns: ['ground class', 'classified as ground', ' ground '] },
      { code: 3, label: 'Low vegetation', patterns: ['low vegetation'] },
      { code: 4, label: 'Medium vegetation', patterns: ['medium vegetation'] },
      { code: 5, label: 'High vegetation', patterns: ['high vegetation'] },
      { code: 6, label: 'Building', patterns: ['classification: building', 'classified as building', ' buildings'] },
      { code: 7, label: 'Low point / noise', patterns: ['low point', 'low points', 'noise'] },
      { code: 8, label: 'Reserved', patterns: [] },
      { code: 9, label: 'Water', patterns: ['classification: water', 'classified as water', ' water surface', ' water bodies'] },
      { code: 10, label: 'Rail', patterns: ['rail'] },
      { code: 11, label: 'Road surface', patterns: ['road surface'] },
      { code: 12, label: 'Overlap', patterns: ['overlap'] },
      { code: 13, label: 'Wire guard / shield', patterns: ['wire guard', 'shield wire'] },
      { code: 14, label: 'Wire conductor / phase', patterns: ['wire conductor', 'wire phase', 'conductor'] },
      { code: 15, label: 'Transmission tower', patterns: ['transmission tower'] },
      { code: 16, label: 'Wire-structure connector', patterns: ['wire-structure connector', 'wire structure connector'] },
      { code: 17, label: 'Bridge deck', patterns: ['bridge deck'] },
      { code: 18, label: 'High noise', patterns: ['high noise'] }
    ];
    return definitions.map((entry) => ({
      ...entry,
      present: entry.patterns.some((pattern) => text.includes(pattern))
    }));
  };
  const resolveProviderName = () => {
    const scopedProviderValue = valueForSelection(providerValue);
    if (scopedProviderValue) return scopedProviderValue;
    const linkValue = valueForSelection(p && p.Link);
    if (!linkValue) return 'N/A';
    try {
      const url = new URL(String(linkValue));
      return url.hostname.replace(/^www\./i, '') || 'N/A';
    } catch (e) {
      return linkValue;
    }
  };
  const resolveAccessLink = () => {
    const scopedLink = valueForSelection(p && p.Link);
    if (!scopedLink) return scopedLink;
    const splitLinks = splitSeries(p && p.Link);
    if (!hasDatasetSwitcher || splitLinks.length > 1) return scopedLink;

    const baseLink = String(scopedLink);
    const activeSlug = String(activeDatasetName || '').trim().toLowerCase().replace(/\s+/g, '-');
    if (!activeSlug) return baseLink;

    const knownSlugs = datasetOptions
      .map((name) => String(name || '').trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean);
    const matchedSlug = knownSlugs.find((slug) => baseLink.toLowerCase().includes(slug));
    return matchedSlug ? baseLink.replace(new RegExp(matchedSlug, 'i'), activeSlug) : baseLink;
  };
  const activeDatasetName = datasetOptions[activeDatasetIndex] || datasetOptions[0] || objectName;
  const generalInfoText = buildDatasetSpecificInfo(p && p.Info, datasetOptions, activeDatasetName);
  const asprsClassifications = getAsprsClassifications(generalInfoText);
  const hasClassificationInfo = asprsClassifications.some((entry) => entry.present);
  const effectiveTab = hasInfo
    ? (activeTabOverride || (infoBox && infoBox.dataset && infoBox.dataset.activeTab) || 'general')
    : 'general';
  const datasetControlHtml = hasDatasetSwitcher
    ? `<label class="info-select-wrap" aria-label="Select dataset">
         <select class="info-select" data-info-dataset-select="true">
           ${datasetOptions.map((name, index) => `<option value="${index}"${index === activeDatasetIndex ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}
         </select>
       </label>`
    : escapeHtml(activeDatasetName || 'N/A');
  const yearLabel = hasYearSwitcher ? yearSeries[activeYearIndex] : (p.Year || 'N/A');
  const yearNavHtml = hasYearSwitcher
    ? `<div class="info-year-nav">
         <button class="info-year-btn" type="button" data-info-year-step="-1" aria-label="Previous year">â€¹</button>
         <span class="info-year-label">${escapeHtml(yearLabel)}</span>
         <button class="info-year-btn" type="button" data-info-year-step="1" aria-label="Next year">â€º</button>
       </div>`
    : '';
  const countryName = String((selectedCountryFeature && selectedCountryFeature.properties && selectedCountryFeature.properties.Name) || '').trim().toLowerCase();
  const viewingCountrySummary = countryName && String(objectName || '').trim().toLowerCase() === countryName;
  // Titel altijd tonen 
  if (infoTitleEl) infoTitleEl.textContent = objectName; 
  const flagCode = resolveFlagCodeForFeature(p);
  const flagName = escapeHtml((p && (p.ParentCountry || p.main_country || p.country || p.Name)) || objectName);
  const flagHtml = flagCode
    ? `<img class="info-banner-flag" src="https://flagcdn.com/w320/${flagCode}.png" srcset="https://flagcdn.com/w640/${flagCode}.png 2x, https://flagcdn.com/w960/${flagCode}.png 3x" width="320" height="170" alt="${flagName} flag">`
    : `<img class="info-banner-flag" src="assets/images/banner-placeholder.svg" width="320" height="170" alt="Flag not available">`;
  const bannerHtml = `
    <div class="info-banner">
      ${flagHtml}
      <div class="info-banner-title">${escapeHtml(objectName)}</div>
      ${navHtml}
    </div>`;
  const generalRows = `
    <section class="info-panel-section${effectiveTab === 'general' ? ' is-active' : ''}" data-info-panel="general">
      <div class="info-card info-card-general">
        <h4>General information</h4>
        <div class="info-row">
          <span>Data name</span>
          <strong>${datasetControlHtml}</strong>
        </div>
        ${hasYearSwitcher ? `<div class="info-row"><span>Year</span><strong>${yearNavHtml}</strong></div>` : ''}
        <div class="info-row"><span>Data provider</span><strong>${escapeHtml(resolveProviderName())}</strong></div>
        <div class="info-intro">${buildInfoParagraphs(generalInfoText)}</div>
      </div>
    </section>`;

  if (!hasInfo) { 
    infoBox.innerHTML = bannerHtml + generalRows; 
  } else { 
    const xyRef = p['XY Ref'] ? linkifyEPSG(valueForSelection(p['XY Ref'])) : 'N/A'; 
    const zRef = p['Z Ref'] ? linkifyEPSG(valueForSelection(p['Z Ref'])) : 'N/A'; 
    const yearLabel = hasYearSwitcher ? yearSeries[activeYearIndex] : (p.Year || 'N/A');
    const yearNavHtml = hasYearSwitcher
      ? `<div class="info-year-nav">
           <button id="infoYearPrev" class="info-year-btn" aria-label="Previous year">‹</button>
           <span class="info-year-label">${escapeHtml(yearLabel)}</span>
           <button id="infoYearNext" class="info-year-btn" aria-label="Next year">›</button>
         </div>`
      : '';
    const linkValue = resolveAccessLink();
    const accessHtml = linkValue
      ? `<a href="${linkValue}" target="_blank" rel="noopener noreferrer">View dataroom</a>`
      : 'N/A';

    const tabsHtml = `
      <div class="info-tabs" role="tablist" aria-label="Information sections">
        <button class="info-tab-btn${effectiveTab === 'general' ? ' is-active' : ''}" type="button" data-info-tab="general" aria-pressed="${effectiveTab === 'general' ? 'true' : 'false'}">General information</button>
        <button class="info-tab-btn${effectiveTab === 'specs' ? ' is-active' : ''}" type="button" data-info-tab="specs" aria-pressed="${effectiveTab === 'specs' ? 'true' : 'false'}">Specifications</button>
        <button class="info-tab-btn${effectiveTab === 'classes' ? ' is-active' : ''}" type="button" data-info-tab="classes" aria-pressed="${effectiveTab === 'classes' ? 'true' : 'false'}">Classifications</button>
      </div>`;
    const classHtml = `
      <section class="info-panel-section${effectiveTab === 'classes' ? ' is-active' : ''}" data-info-panel="classes">
        <div class="info-card">
          <h4>ASPRS LAS Classes</h4>
          <div class="classification-table">
            ${asprsClassifications.map((entry) => `
              <div class="classification-row">
                <span class="classification-code">${entry.code}</span>
                <span class="classification-name">${escapeHtml(entry.label)}</span>
                <strong class="classification-mark">${entry.present ? 'x' : ''}</strong>
              </div>
            `).join('')}
          </div>
          ${hasClassificationInfo ? '' : '<p class="classification-note">No classification information available.</p>'}
        </div>
      </section>`;
    const dataHtml = `
      <section class="info-panel-section${effectiveTab === 'specs' ? ' is-active' : ''}" data-info-panel="specs">
      <div class="info-sections">
        <section class="info-card">
          <h4>Acquisition & Coverage</h4>
          <div class="info-row"><span>Dataset type</span><strong>${valueForSelection(p.Data) || 'N/A'}</strong></div>
          <div class="info-row"><span>Acquisition platform</span>${buildTypeBadges(valueForSelection(p.Type))}</div>
        </section>
        <section class="info-card">
          <h4>Quality descriptions</h4>
          <div class="info-row"><span>Spatial distribution</span><strong>${formatSpatialDistribution(valueForSpecs(p.National), valueForSpecs(p.Urban))}</strong></div>
          <div class="info-row"><span>Planimetric</span><strong>${formatMeters(valueForSpecs(p.Planimetric))}</strong></div>
          <div class="info-row"><span>Altimetric</span><strong>${formatMeters(valueForSpecs(p.Altimetric))}</strong></div>
        </section>
        <section class="info-card">
          <h4>Additional Info</h4>
          ${yearNavHtml}
          <div class="info-row"><span>Data name</span><strong>${datasetControlHtml}</strong></div>
          <div class="info-row"><span>Data provider</span><strong>${escapeHtml(resolveProviderName())}</strong></div>
          <div class="info-row"><span>Year</span><strong>${yearLabel}</strong></div>
          <div class="info-row"><span>Access</span><strong>${accessHtml}</strong></div>
          <div class="info-row"><span>XY-ref</span><strong>${xyRef}</strong></div>
          <div class="info-row"><span>Z-ref</span><strong>${zRef}</strong></div>
        </section>
      </div>
      </section>`; 

    infoBox.innerHTML = bannerHtml + tabsHtml + generalRows + dataHtml + classHtml; 
  } 
  if (infoBox && infoBox.dataset) {
    infoBox.dataset.activeTab = effectiveTab;
  }

  const infoBannerPrev = infoBox.querySelector('#infoBannerPrev');
  const infoBannerNext = infoBox.querySelector('#infoBannerNext');
  if (infoBannerPrev) {
    infoBannerPrev.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateInfoBanner(-1, p, regionMode);
    });
  }
  if (infoBannerNext) {
    infoBannerNext.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateInfoBanner(1, p, regionMode);
    });
  }
  const infoYearButtons = Array.from(infoBox.querySelectorAll('[data-info-year-step]'));
  if (hasYearSwitcher && infoYearButtons.length) {
    infoYearButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const step = Number(button.getAttribute('data-info-year-step') || '0');
        if (!step) return;
        const nextIndex = (activeYearIndex + step + yearSeries.length) % yearSeries.length;
        const nextDatasetIndex = hasLinkedDatasetSeries ? nextIndex : activeDatasetIndex;
        showInfo(p, regionMode, nextIndex, nextDatasetIndex, effectiveTab);
      });
    });
  }
  const legacyInfoYearPrev = infoBox.querySelector('#infoYearPrev');
  const legacyInfoYearNext = infoBox.querySelector('#infoYearNext');
  if (hasYearSwitcher && legacyInfoYearPrev && legacyInfoYearNext) {
    legacyInfoYearPrev.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextIndex = (activeYearIndex - 1 + yearSeries.length) % yearSeries.length;
      const nextDatasetIndex = hasLinkedDatasetSeries ? nextIndex : activeDatasetIndex;
      showInfo(p, regionMode, nextIndex, nextDatasetIndex, effectiveTab);
    });
    legacyInfoYearNext.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextIndex = (activeYearIndex + 1) % yearSeries.length;
      const nextDatasetIndex = hasLinkedDatasetSeries ? nextIndex : activeDatasetIndex;
      showInfo(p, regionMode, nextIndex, nextDatasetIndex, effectiveTab);
    });
  }
  const infoDatasetSelects = Array.from(infoBox.querySelectorAll('[data-info-dataset-select]'));
  if (infoDatasetSelects.length) {
    infoDatasetSelects.forEach((infoDatasetSelect) => {
      infoDatasetSelect.addEventListener('change', (e) => {
      const nextDatasetIndex = Number(e.target.value);
      const nextYearIndex = hasLinkedDatasetSeries ? nextDatasetIndex : activeYearIndex;
      showInfo(p, regionMode, nextYearIndex, nextDatasetIndex, effectiveTab);
      });
    });
  }
  const infoTabButtons = Array.from(infoBox.querySelectorAll('[data-info-tab]'));
  if (infoTabButtons.length) {
    infoTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextTab = button.getAttribute('data-info-tab') || 'general';
        showInfo(p, regionMode, activeYearIndex, activeDatasetIndex, nextTab);
      });
    });
  }
  if (viewingCountrySummary) {
    setDatasetRegionSelectionByNames(datasetRegionMap[activeDatasetName] || []);
  } else {
    clearDatasetRegionSelection();
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

const legendBookmark = document.getElementById('legend-bookmark');
const legendToggle = document.getElementById('legend-toggle');
const legendPanel  = document.getElementById('legend-panel');
const legendClose  = document.getElementById('legend-close');
const legendResetBtn = document.getElementById('legendResetBtn');
if (legendBookmark && legendToggle && legendPanel && legendClose) {
  const legendTitle = legendPanel.querySelector('.legend-header span');

  function closeLegend() {
    legendBookmark.classList.remove('open');
  }
  legendToggle.onclick = () => {
    legendBookmark.classList.add('open');
  };

  legendClose.onclick = closeLegend;
  if (legendTitle) {
    legendTitle.onclick = closeLegend;
  }
  document.addEventListener('click', (e) => {
    if (!legendBookmark.contains(e.target)) {
      closeLegend();
    }
  });

  // Koppelt direct aan bestaande category-logica
  legendPanel.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      const cat = normalizeCat(li.dataset.cat);
      activeCategory = null;
      if (activeLegendCategories.has(cat)) {
        activeLegendCategories.delete(cat);
        li.classList.remove('active');
      } else {
        activeLegendCategories.add(cat);
        li.classList.add('active');
      }
      renderCountriesList();
      applyCategoryFilterToMap();
    });
  });

  if (legendResetBtn) {
    legendResetBtn.addEventListener('click', () => {
      overviewReset(true);
    });
  }

  applyCategoryPalette();
}

function initAccessibilityControls() {
  if (!document.body) return;
  const storageKeys = {
    colorBlind: 'a11yColorBlindEnabled',
    legacyContrast: 'a11yContrastEnabled',
    largeText: 'a11yLargeTextEnabled'
  };
  const root = document.documentElement;
  const getStored = (key, fallbackKey) => {
    const primary = localStorage.getItem(key);
    if (primary !== null) return primary === '1';
    if (fallbackKey) return localStorage.getItem(fallbackKey) === '1';
    return false;
  };
  const setStored = (key, enabled) => {
    localStorage.setItem(key, enabled ? '1' : '0');
  };
  const applyMode = (className, enabled) => {
    root.classList.toggle(className, enabled);
  };
  const updateButtonState = (button, enabled, labels) => {
    button.classList.toggle('active', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.setAttribute('aria-label', enabled ? labels.disable : labels.enable);
    button.setAttribute('title', enabled ? labels.disable : labels.enable);
  };

  let controls = document.getElementById('a11y-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'a11y-controls';
    controls.className = 'a11y-controls';
    controls.innerHTML = `
      <button id="a11yColorBlindBtn" class="a11y-btn" type="button" aria-pressed="false">
        <span class="a11y-label">Color blindness mode</span>
        <span class="a11y-icon a11y-icon-eye" aria-hidden="true">&#128065;</span>
      </button>
      <button id="a11yTextBtn" class="a11y-btn" type="button" aria-pressed="false">
        <span class="a11y-label">Increase text size</span>
        <span class="a11y-icon a11y-icon-aa" aria-hidden="true">AA</span>
      </button>
    `;
    document.body.appendChild(controls);
  }

  const colorBlindBtn = document.getElementById('a11yColorBlindBtn');
  const textBtn = document.getElementById('a11yTextBtn');
  if (!colorBlindBtn || !textBtn) return;

  const refreshButtons = () => {
    const colorBlindEnabled = root.classList.contains('a11y-colorblind');
    const largeTextEnabled = root.classList.contains('a11y-large-text');
    updateButtonState(colorBlindBtn, colorBlindEnabled, {
      enable: 'Enable color blindness mode',
      disable: 'Disable color blindness mode'
    });
    updateButtonState(textBtn, largeTextEnabled, {
      enable: 'Enable large text',
      disable: 'Disable large text'
    });
  };

  const setColorBlind = (enabled) => {
    applyMode('a11y-colorblind', enabled);
    useColorblindPalette = enabled;
    if (typeof applyCategoryPalette === 'function') applyCategoryPalette();
    setStored(storageKeys.colorBlind, enabled);
    localStorage.removeItem(storageKeys.legacyContrast);
    refreshButtons();
  };
  const setLargeText = (enabled) => {
    applyMode('a11y-large-text', enabled);
    setStored(storageKeys.largeText, enabled);
    refreshButtons();
  };

  const initMapAwarePositioning = () => {
    if (!document.body.classList.contains('map-page')) return;
    const trackedPanels = ['sidebar', 'infoPanel', 'helpModal']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!trackedPanels.length) return;

    const placeControls = () => {
      const visiblePanel = trackedPanels.find((panel) => {
        const style = window.getComputedStyle(panel);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      if (!visiblePanel) {
        controls.classList.remove('a11y-under-popup');
        controls.style.top = '';
        controls.style.bottom = '';
        return;
      }

      const rect = visiblePanel.getBoundingClientRect();
      const margin = 8;
      const maxTop = window.innerHeight - controls.offsetHeight - margin;
      const desiredTop = Math.round(rect.bottom + margin);
      const finalTop = Math.max(72, Math.min(desiredTop, maxTop));

      controls.classList.add('a11y-under-popup');
      controls.style.top = `${finalTop}px`;
      controls.style.bottom = 'auto';
    };

    const schedulePlaceControls = () => window.requestAnimationFrame(placeControls);
    const observer = new MutationObserver(schedulePlaceControls);
    trackedPanels.forEach((panel) => observer.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] }));
    window.addEventListener('resize', schedulePlaceControls);
    document.addEventListener('click', schedulePlaceControls);
    schedulePlaceControls();
  };

  window.toggleColorBlindMode = () => setColorBlind(!root.classList.contains('a11y-colorblind'));
  window.toggleContrastMode = window.toggleColorBlindMode;
  window.toggleTextSizeMode = () => setLargeText(!root.classList.contains('a11y-large-text'));

  colorBlindBtn.addEventListener('click', window.toggleColorBlindMode);
  textBtn.addEventListener('click', window.toggleTextSizeMode);

  setColorBlind(getStored(storageKeys.colorBlind, storageKeys.legacyContrast));
  setLargeText(getStored(storageKeys.largeText));
  initMapAwarePositioning();
}

initAccessibilityControls();

function applyCategoryFilterToMap() {
  const mapRef = (typeof getMapInstance === 'function') ? getMapInstance() : null;
  if (!mapRef || !mapRef.getLayer('country-fill')) return;
  const selectedCats = activeLegendCategories.size
    ? Array.from(activeLegendCategories)
    : (activeCategory ? [activeCategory] : []);
  if (selectedCats.length) {
    mapRef.setFilter('country-fill', [
      'all',
      ['in', ['get', 'Data'], ['literal', selectedCats]],
      ['!', ['has', 'RegionName']]
    ]);
    mapRef.setFilter('country-border', [
      'all',
      ['!', ['has', 'RegionName']]
    ]);
  } else {
    mapRef.setFilter('country-fill', null);
    mapRef.setFilter('country-border', null);
  }
}
}()); 

// Banner/Carousel functionality for home page
function initBannerCarousel() {
    const slides = [
        { src: 'assets/images/Banner_index/Helmond_AHN5.png', alt: 'Banner map example', href: 'map.html?skipIntro=1&focusCountry=Netherlands' },
        { src: 'assets/images/Banner_index/Avignon_LidarHD.png', alt: 'Avignon LiDAR example', href: 'map.html?skipIntro=1&focusCountry=France' },
        { src: 'assets/images/Banner_index/Banner_Norway.png', alt: 'Norway point cloud example', href: 'map.html?skipIntro=1&focusCountry=Norway' },
        { src: 'assets/images/Banner_index/Banner_portugal.png', alt: 'Portugal point cloud example', href: 'map.html?skipIntro=1&focusCountry=Portugal' },
        { src: 'assets/images/Banner_index/Barca_YY.png', alt: 'Barcelona point cloud example', href: 'map.html?skipIntro=1&focusCountry=Spain' }
    ];
    const bannerEl = document.querySelector('.home-page .banner');
    const imgEl = document.getElementById('bannerImage');
    const dotsEl = document.getElementById('bannerDots');
    const prevBtn = document.getElementById('bannerPrev');
    const nextBtn = document.getElementById('bannerNext');
    
    if (!imgEl || !dotsEl) return; // Not on home page
    
    let current = 0;
    let timer = null;

    function renderDots() {
        dotsEl.innerHTML = '';
        slides.forEach((_, i) => {
            const b = document.createElement('button');
            b.className = i === current ? 'active' : '';
            b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
            b.addEventListener('click', () => goTo(i));
            dotsEl.appendChild(b);
        });
    }

    function goTo(index) {
        current = (index + slides.length) % slides.length;
        imgEl.src = slides[current].src;
        imgEl.alt = slides[current].alt;
        renderDots();
        restartTimer();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }
    function openCurrentMapLocation() {
        const target = slides[current] && slides[current].href;
        if (target) window.location.href = target;
    }

    function restartTimer() {
        if (timer) clearInterval(timer);
        timer = setInterval(next, 6000);
    }

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    if (bannerEl) {
        bannerEl.style.cursor = 'pointer';
        bannerEl.setAttribute('role', 'link');
        bannerEl.setAttribute('tabindex', '0');
        bannerEl.addEventListener('click', (event) => {
            if (event.target && event.target.closest('button')) return;
            openCurrentMapLocation();
        });
        bannerEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCurrentMapLocation();
            }
        });
    }

    renderDots();
    restartTimer();
}

// Initialize banner carousel if elements exist
document.addEventListener('DOMContentLoaded', () => {
    initBannerCarousel();
});

function parseCsvText(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const sep = delimiter || ',';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
        } else if (ch === sep) {
            row.push(field);
            field = '';
        } else if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (ch !== '\r') {
            field += ch;
        }
    }
    row.push(field);
    if (row.some((v) => String(v).trim() !== '') || rows.length === 0) {
        rows.push(row);
    }
    return rows;
}

function initCatalogueTable() {
    const body = document.getElementById('catalogueBody');
    const status = document.getElementById('catalogueStatus');
    if (!body || !status || !document.body.classList.contains('catalogue-page')) return;

    const key = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, '');
    const readFirst = (row, ...candidates) => {
        for (let i = 0; i < candidates.length; i += 1) {
            const value = row[candidates[i]];
            if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
        }
        return '';
    };
    const normalize = (value) => {
        if (value === null || value === undefined) return '';
        const v = String(value).trim();
        if (!v || /^(n\/a|na|null|none|geen data|no data|unknown)$/i.test(v)) return '';
        return v;
    };
    const escapeHtml = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const spatialDistribution = (row) => {
        const direct = normalize(readFirst(row, 'spatialdistribution', 'spatialdensity', 'density'));
        if (direct) return direct.toLowerCase().includes('ppsm') ? direct : `${direct} ppsm`;
        const national = normalize(readFirst(row, 'national'));
        const urban = normalize(readFirst(row, 'urban'));
        if (national && urban && national === urban) return `${national} ppsm`;
        if (national && urban) return `${national} to ${urban} ppsm`;
        if (national) return `${national} ppsm`;
        if (urban) return `${urban} ppsm`;
        return '-';
    };

    fetch('data/catalogue.csv')
        .then((response) => {
            if (!response.ok) throw new Error('CSV not found');
            return response.text();
        })
        .then((csvText) => {
            const firstLine = (csvText.split(/\r?\n/, 1)[0] || '');
            const commaCount = (firstLine.match(/,/g) || []).length;
            const semicolonCount = (firstLine.match(/;/g) || []).length;
            const delimiter = semicolonCount > commaCount ? ';' : ',';
            const rows = parseCsvText(csvText, delimiter);
            if (!rows.length || rows[0].length === 0) throw new Error('CSV empty');
            const headers = rows[0].map((h) => key(h));
            const records = rows.slice(1).filter((r) => r.some((v) => String(v).trim() !== ''))
                .map((r) => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        obj[h] = r[i] !== undefined ? r[i] : '';
                    });
                    return obj;
                });

            if (!records.length) {
                body.innerHTML = '<tr><td colspan="8">No catalogue rows found in CSV.</td></tr>';
                status.textContent = 'Catalogue loaded, but no data rows were found.';
                return;
            }

            const isNA = (value) => {
                const v = String(value || '').trim().toLowerCase();
                return !v || v === 'n/a' || v === '-';
            };
            const formatDataVersion = (value) => {
                const v = String(value || '').trim().toLowerCase();
                if (!v || v === 'n/a' || v === '-') return '-';
                if (v === 'region' || v === 'regional') return 'Region';
                if (v.includes('dense') || v === 'dm' || v.includes('matching')) return 'Dense matching';
                if (v.includes('dem') || v.includes('elevation')) return 'Point cloud elevation model (DEM)';
                if (v.includes('point')) return 'Point cloud';
                return String(value).trim();
            };

            const html = records.map((row) => {
                const rawName = readFirst(row, 'name', 'country', 'main_country', 'regionname') || '-';
                const rawMainCountry = readFirst(row, 'main_country', 'country') || '';
                const rawDataVersion = formatDataVersion(readFirst(row, 'dataversion', 'data_version', 'data', 'datasettype', 'dataset_type', 'type'));
                if (String(rawDataVersion).toLowerCase() === 'region') return '';
                const rawYear = readFirst(row, 'year') || '-';
                const rawAgency = readFirst(row, 'responsibleagency', 'responsibleagencie', 'agency', 'provider') || '-';
                const rawSpatial = spatialDistribution(row);
                const rawPlanimetric = normalize(readFirst(row, 'planimetric', 'avg_plan')) || '-';
                const rawAltimetric = normalize(readFirst(row, 'altimetric', 'avg_alti')) || '-';
                const link = readFirst(row, 'dataroom', 'link', 'access');

                const allDataNA = [
                    rawDataVersion,
                    rawYear,
                    rawAgency,
                    rawSpatial,
                    rawPlanimetric,
                    rawAltimetric,
                    link || '-'
                ].every(isNA);
                if (allDataNA) return '';

                const name = escapeHtml(rawName);
                const mapCountry = rawMainCountry || rawName;
                const mapHref = (mapCountry && rawName && rawName !== '-')
                    ? `map.html?focusCountry=${encodeURIComponent(mapCountry)}&focusRegion=${encodeURIComponent(rawName)}`
                    : '';
                const nameHtml = mapHref
                    ? `<a href="${mapHref}" title="Go to maps location -->">${name}</a>`
                    : name;
                const dataVersion = escapeHtml(rawDataVersion);
                const year = escapeHtml(rawYear);
                const agency = escapeHtml(rawAgency);
                const spatial = escapeHtml(rawSpatial);
                const planimetric = escapeHtml(rawPlanimetric);
                const altimetric = escapeHtml(rawAltimetric);
                const linkHtml = link
                    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Link to local dataset</a>`
                    : '-';

                return `<tr>
                    <td>${nameHtml}</td>
                    <td>${dataVersion}</td>
                    <td>${year}</td>
                    <td>${agency}</td>
                    <td>${spatial}</td>
                    <td>${planimetric}</td>
                    <td>${altimetric}</td>
                    <td>${linkHtml}</td>
                </tr>`;
            }).join('');

            body.innerHTML = html || '<tr><td colspan="8">No catalogue rows to display after filtering empty data.</td></tr>';
        })
        .catch(() => {
            body.innerHTML = '<tr><td colspan="8">Could not load data/catalogue.csv. Add the CSV file to show catalogue rows.</td></tr>';
            status.textContent = 'Catalogue CSV not found. Expected file: data/catalogue.csv';
        });
}

document.addEventListener('DOMContentLoaded', () => {
    initCatalogueTable();
});
