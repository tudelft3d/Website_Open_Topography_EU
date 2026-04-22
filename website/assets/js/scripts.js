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
    const CLASSIFICATION_DEFINITIONS = [
        { code: 0, label: 'Never classified', patterns: ['never classified'], filterTags: [] },
        { code: 1, label: 'Unassigned', patterns: ['unclassified', 'unassigned'], filterTags: [] },
        { code: 2, label: 'Ground', patterns: ['class 2', 'ground class', 'classified as ground', ' ground '], filterTags: ['ground'] },
        { code: 3, label: 'Low vegetation', patterns: ['class 3', 'low vegetation'], filterTags: ['vegetation'] },
        { code: 4, label: 'Medium vegetation', patterns: ['class 4', 'medium vegetation'], filterTags: ['vegetation'] },
        { code: 5, label: 'High vegetation', patterns: ['class 5', 'high vegetation'], filterTags: ['vegetation'] },
        { code: 6, label: 'Building', patterns: ['class 6', 'classification: building', 'classified as building', ' building ', ' buildings'], filterTags: ['building'] },
        { code: 7, label: 'Low point / noise', patterns: ['class 7', 'low point', 'low points', 'noise'], filterTags: [] },
        { code: 8, label: 'Reserved', patterns: ['class 8', 'model key-point', 'model key point'], filterTags: [] },
        { code: 9, label: 'Water', patterns: ['class 9', 'classification: water', 'classified as water', ' water surface', ' water bodies'], filterTags: ['water'] },
        { code: 10, label: 'Rail', patterns: ['class 10', 'rail'], filterTags: [] },
        { code: 11, label: 'Road surface', patterns: ['class 11', 'road surface'], filterTags: [] },
        { code: 12, label: 'Reserved', patterns: ['class 12', 'overlap'], filterTags: [] },
        { code: 13, label: 'Wire guard / shield', patterns: ['class 13', 'wire guard', 'shield wire'], filterTags: [] },
        { code: 14, label: 'Wire conductor / phase', patterns: ['class 14', 'wire conductor', 'wire phase', 'conductor'], filterTags: [] },
        { code: 15, label: 'Transmission tower', patterns: ['class 15', 'transmission tower'], filterTags: [] },
        { code: 16, label: 'Wire connector', patterns: ['class 16', 'wire-structure connector', 'wire structure connector', 'wire connector'], filterTags: [] },
        { code: 17, label: 'Bridge deck', patterns: ['class 17', 'bridge deck'], filterTags: [] },
        { code: 18, label: 'High noise', patterns: ['class 18', 'high noise'], filterTags: [] }
    ];
    function getClassificationIconSvg(code, label) {
        const title = String(label || 'Classification icon')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const icons = {
            0: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"></circle><path d="M7.2 7.2l5.6 5.6"></path><path d="M12.8 7.2l-5.6 5.6"></path></svg>`,
            1: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"></circle><path d="M10 6v8"></path></svg>`,
            2: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 13.5h14"></path><path d="M5 13.5l2-3 2.2 2 2.3-4 2.1 3 1.4-1.5"></path></svg>`,
            3: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 14c2.2-4.5 4.7-6.8 7.6-6.8"></path><path d="M8.5 14c1.6-3 3.5-4.6 5.8-4.6"></path></svg>`,
            4: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14c2.2-5.2 4.8-8 8-8"></path><path d="M10 14c1.4-3.8 3.1-5.8 5-5.8"></path><path d="M4 14h12"></path></svg>`,
            5: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v10"></path><path d="M10 4l-4 4"></path><path d="M10 4l4 4"></path><path d="M6.5 14h7"></path></svg>`,
            6: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15V7l5-3 5 3v8z"></path><path d="M8 15v-3h4v3"></path></svg>`,
            7: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v7"></path><circle cx="10" cy="14.3" r="0.9" fill="currentColor" stroke="none"></circle><path d="M4.5 16l11-12"></path></svg>`,
            8: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="4.5" width="11" height="11" rx="2" stroke-dasharray="2.5 2.5"></rect></svg>`,
            9: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 11c1.2 1 2.3 1.5 3.5 1.5S9.8 12 11 11s2.3-1.5 3.5-1.5S16.8 10 18 11"></path><path d="M2 14c1.2 1 2.3 1.5 3.5 1.5S7.8 15 9 14s2.3-1.5 3.5-1.5S14.8 13 16 14"></path></svg>`,
            10: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4v12"></path><path d="M14 4v12"></path><path d="M8 6h4"></path><path d="M8 10h4"></path><path d="M8 14h4"></path></svg>`,
            11: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 14h12"></path><path d="M6 14l1.6-5"></path><path d="M11 14l1.6-5"></path><path d="M8.2 9h5.2"></path></svg>`,
            12: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="4.5" width="11" height="11" rx="2"></rect><path d="M7 7l6 6"></path><path d="M13 7l-6 6"></path></svg>`,
            13: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 15V6"></path><path d="M14 15V6"></path><path d="M6 7h8"></path><path d="M5 10h10"></path></svg>`,
            14: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 12c1.6-2 3.3-3 5-3s3.4 1 5 3 3.1 3 4.5 3"></path><path d="M4 8c1.6-2 3.3-3 5-3s3.4 1 5 3 3.1 3 4.5 3"></path></svg>`,
            15: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4l-3 4h6z"></path><path d="M7 8h6"></path><path d="M8 8l-2 8"></path><path d="M12 8l2 8"></path><path d="M6.8 12h6.4"></path></svg>`,
            16: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h5"></path><path d="M11 10h5"></path><circle cx="10" cy="10" r="2.2"></circle></svg>`,
            17: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 12h13"></path><path d="M5.5 12l1.5-3h6l1.5 3"></path><path d="M6.5 12v2"></path><path d="M13.5 12v2"></path></svg>`,
            18: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v6"></path><path d="M7.5 8.5L10 5l2.5 3.5"></path><path d="M4.5 16l11-12"></path></svg>`
        };
        return `<span class="classification-icon-svg" aria-label="${title}" title="${title}">${icons[code] || icons[1]}</span>`;
    }

    // State 
    let countriesData, regionsData, overviewMapData; 
    let unifiedMapData = null;
    let unifiedCountryCollections = new Map();
    let selectedCountryFeature = null; 
    let selectedRegionFeatureId = null; 
    let activeDatasetRegionIds = [];
    let dimmedDatasetRegionIds = [];
    let activeResearchMarkers = [];
    let activeCategory = null; 
    let activeLegendCategories = new Set();
    const RESEARCH_LEGEND_CATEGORY = 'Research';
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
    let countryFilterMetrics = new Map();
    let countryFilterMetricBuckets = new Map();
    let countryFilterMetricsPromise = null;
    let availableClassificationFilterOptions = new Set();
    let userHasAdjustedMapFilters = false;
    // regionFilterMetrics: keyed by "parentCountryKey::regionNameLc" → {spatial, accuracy, year, classifications}
    let regionFilterMetrics = new Map();
    // all sub-region features for non-"Region" countries (used for the filter-regions map layer)
    let filterRegionFeatures = [];
    const REGION_DRILLDOWN_ZOOM = 6.5;
    const REGION_DRILLDOWN_EXIT_ZOOM = 6.2;
    let regionDrilldownVisible = false;
    let autoDrilldownCountryFeature = null;
    let restoreFilterMenuAfterSidebarClose = false;
    const regionDataCache = new Map();
    const renderDataCache = new Map();
    const COUNTRY_RENDER_LEVELS = [
        { key: 'overview', maxZoom: 5.6, decimals: 5 },
        { key: 'detail', maxZoom: Infinity, decimals: 6 }
    ];
    let currentCountryRenderLevel = '';
    let currentRegionRenderLevel = '';
    let currentFilterRegionRenderLevel = '';
    const activeRangeFilters = {
        spatial: false,
        planimetric: false,
        altimetric: false,
        year: false
    };
    const mapFilterState = {
        spatialMin: null,
        spatialMax: null,
        includeMissingSpatial: false,
        planimetricMin: null,
        planimetricMax: null,
        altimetricMin: null,
        altimetricMax: null,
        includeMissingAccuracy: false,
        yearMin: null,
        yearMax: null,
        includeMissingYear: false,
        classifications: new Set(),
        dataCategories: new Set(['Pointcloud', 'DEM', 'No Info']),
        datasetTypes: new Set(['national']) // which ADM levels are included
    };
    const mapFilterBounds = {
        spatial: { min: 0, max: 100, ready: false },
        planimetric: { min: 0, max: 1, ready: false },
        altimetric: { min: 0, max: 1, ready: false },
        year: { min: 2000, max: 2026, ready: false }
    };
    const UNIFIED_MAP_DATA_VERSION = '20260422i';
    const UNIFIED_MAP_DATA_PATHS = [
        `../data/map_data_unified.geojson?v=${UNIFIED_MAP_DATA_VERSION}`,
        `data/map_data_unified.geojson?v=${UNIFIED_MAP_DATA_VERSION}`
    ];
    const CATALOGUE_DATA_PATHS = [
        'data/catalogue.csv',
        'data/Quality_parameters_v10022026.csv',
        '../data/catalogue.csv',
        '../data/Quality_parameters_v10022026.csv'
    ];

    function getFeatureParentCountryName(feature) {
        const properties = (feature && feature.properties) || {};
        const candidates = [
            properties.ParentCountry,
            properties.main_country,
            properties.country,
            properties.Name
        ];
        const match = candidates.find((value) => String(value || '').trim() !== '');
        return String(match || '').trim();
    }

    function isResearchFeature(feature) {
        return !!(feature && feature.properties && feature.properties.ADM_lookup);
    }

    function normalizeFeatureIdentity(properties) {
        if (!properties || properties.ADM_lookup) return properties;
        const parentCountryName = String(
            properties.ParentCountry ||
            properties.main_country ||
            properties.country ||
            ''
        ).trim();
        const currentName = String(properties.Name || '').trim();
        const alternateName = String(properties['Name.1'] || properties.RegionName || '').trim();
        const currentKey = normalizeCountryKey(currentName);
        const parentKey = normalizeCountryKey(parentCountryName || currentName);
        const alternateKey = normalizeCountryKey(alternateName);

        if (
            currentKey &&
            parentKey &&
            currentKey === parentKey &&
            alternateKey &&
            alternateKey !== parentKey
        ) {
            properties.RegionName = alternateName;
            properties.Name = alternateName;
        }
        return properties;
    }

    function isCountryLevelFeature(feature) {
        if (!feature || !feature.properties || isResearchFeature(feature)) return false;
        const regionName = normalizeCountryKey(feature.properties.RegionName);
        if (regionName && regionName !== normalizeCountryKey(feature.properties.Name)) return false;
        const nameKey = normalizeCountryKey(feature.properties.Name);
        const parentKey = normalizeCountryKey(getFeatureParentCountryName(feature));
        return !!nameKey && nameKey === parentKey;
    }

    function getFeatureDatasetLevel(feature) {
        if (!feature || !feature.properties) return 'regional';
        if (isResearchFeature(feature) || (feature.geometry && feature.geometry.type === 'Point')) return 'city';
        return isCountryLevelFeature(feature) ? 'national' : 'regional';
    }

    function isCountrySummaryFeatureForCountry(feature, countryName) {
        if (!feature || !feature.properties) return false;
        if (isResearchFeature(feature)) return false;
        if (!isCountryLevelFeature(feature)) return false;
        return normalizeCountryKey(feature.properties.Name) === normalizeCountryKey(countryName);
    }

    function getFeatureFilterMetricKey(properties, parentCountryKey) {
        if (!properties) return '';
        const isResearch = !!properties.ADM_lookup;
        const baseLabel = isResearch
            ? (
                properties.ADM_lookup ||
                properties.location ||
                properties.Location ||
                properties.place ||
                properties['Name.1'] ||
                properties.RegionName ||
                properties.Dataset_name ||
                properties.dataset_name ||
                properties['Data Name'] ||
                properties['Dataset Name'] ||
                properties.Name
            )
            : (properties.RegionName || properties['Name.1'] || properties.Name);
        const normalizedLabel = normalizeCountryKey(baseLabel);
        if (!normalizedLabel) return '';
        return isResearch
            ? `${parentCountryKey}::research::${normalizedLabel}`
            : `${parentCountryKey}::${normalizedLabel}`;
    }

    function getCountrySummaryPriority(feature) {
        if (!isCountryLevelFeature(feature)) return -1;
        const properties = feature.properties || {};
        const dataCategory = normalizeCat(properties.RawDataTypes || properties.Data);
        if (dataCategory === 'Pointcloud' || dataCategory === 'DEM') return 3;
        if (dataCategory === 'Region') return 2;
        if (hasCountrySummaryInfo(properties)) return 1;
        return 0;
    }

    function hasRegionalAreaChildren(features) {
        return (features || []).some((feature) => {
            if (!feature || !feature.properties) return false;
            if (isResearchFeature(feature)) return false;
            if (isCountryLevelFeature(feature)) return false;
            const geometryType = feature.geometry && feature.geometry.type;
            return geometryType && geometryType !== 'Point';
        });
    }

    function downgradeSummaryOnlyRegionalCountry(feature) {
        if (!feature || !feature.properties) return feature;
        const currentCategory = normalizeCat(feature.properties.RawDataTypes || feature.properties.Data);
        if (currentCategory !== 'Region') return feature;
        feature.properties.RawDataTypes = 'No Info';
        feature.properties.DataDisplay = 'No Info';
        feature.properties.Data = 'No Info';
        feature.properties.infoStatus = hasCountrySummaryInfo(feature.properties) ? 'hasinfo' : 'noinfo';
        setFeatureCategorySupport(feature.properties);
        return feature;
    }

    function sortCountryCollectionFeatures(features, countryName) {
        const countryKey = normalizeCountryKey(countryName);
        return [...(features || [])].sort((a, b) => {
            const aCountryLevel = isCountryLevelFeature(a);
            const bCountryLevel = isCountryLevelFeature(b);
            if (aCountryLevel !== bCountryLevel) return aCountryLevel ? -1 : 1;

            const aLevel = getFeatureDatasetLevel(a);
            const bLevel = getFeatureDatasetLevel(b);
            const levelOrder = { national: 0, regional: 1, city: 2 };
            if (levelOrder[aLevel] !== levelOrder[bLevel]) return levelOrder[aLevel] - levelOrder[bLevel];

            const aPriority = getCountrySummaryPriority(a);
            const bPriority = getCountrySummaryPriority(b);
            if (aPriority !== bPriority) return bPriority - aPriority;

            const aMatchesCountry = normalizeCountryKey(a && a.properties && a.properties.Name) === countryKey;
            const bMatchesCountry = normalizeCountryKey(b && b.properties && b.properties.Name) === countryKey;
            if (aMatchesCountry !== bMatchesCountry) return aMatchesCountry ? -1 : 1;

            const aName = String((a && a.properties && a.properties.Name) || '');
            const bName = String((b && b.properties && b.properties.Name) || '');
            return aName.localeCompare(bName);
        });
    }

    function mergeStandardFeatureSeries(features) {
        const isMissing = (value) => value === null || value === undefined || String(value).trim() === '';
        const splitExistingSeries = (value) => {
            if (isMissing(value)) return [];
            return String(value).split(/\s*\|\|\s*/).map((part) => part.trim()).filter(Boolean);
        };
        const mergeValues = (values) => {
            const uniqueValues = [];
            const seen = new Set();
            values.flatMap(splitExistingSeries).forEach((value) => {
                const key = String(value).trim().toLowerCase();
                if (!key || seen.has(key)) return;
                seen.add(key);
                uniqueValues.push(value);
            });
            if (!uniqueValues.length) return null;
            return uniqueValues.length === 1 ? uniqueValues[0] : uniqueValues.join(' || ');
        };
        const getSeriesMergeKey = (feature, index) => {
            const properties = normalizeFeatureIdentity({ ...((feature && feature.properties) || {}) });
            if (!properties || properties.ADM_lookup) return `research::${index}`;
            const parentCountry = getFeatureParentCountryName({ ...feature, properties });
            const parentKey = normalizeCountryKey(parentCountry);
            const nameKey = normalizeCountryKey(properties.RegionName || properties['Name.1'] || properties.Name);
            const admKey = String(properties.ADM === null || properties.ADM === undefined ? '' : properties.ADM).trim();
            const geometryType = String((feature && feature.geometry && feature.geometry.type) || '').trim();
            if (!parentKey || !nameKey) return `feature::${index}`;
            return [parentKey, nameKey, admKey, geometryType].join('::');
        };

        const grouped = new Map();
        (features || []).forEach((feature, index) => {
            if (!feature || !feature.properties) return;
            const key = getSeriesMergeKey(feature, index);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(feature);
        });

        const mergedFeatures = [];
        grouped.forEach((group) => {
            if (group.length <= 1) {
                mergedFeatures.push(group[0]);
                return;
            }
            const mergedProperties = {};
            const propertyNames = new Set();
            group.forEach((feature) => {
                Object.keys((feature && feature.properties) || {}).forEach((name) => propertyNames.add(name));
            });
            propertyNames.forEach((name) => {
                const values = group.map((feature) => feature && feature.properties && feature.properties[name]).filter((value) => !isMissing(value));
                mergedProperties[name] = mergeValues(values);
            });
            ['Name', 'ADM', 'main_country', 'country', 'ParentCountry', 'Name.1', 'RegionName', 'Coverage'].forEach((name) => {
                const firstValue = group.map((feature) => feature && feature.properties && feature.properties[name]).find((value) => !isMissing(value));
                if (!isMissing(firstValue)) mergedProperties[name] = firstValue;
            });
            mergedFeatures.push({
                ...group[0],
                properties: normalizeFeatureIdentity(mergedProperties)
            });
        });
        return mergedFeatures;
    }

    function initializeUnifiedMapData(collection) {
        const sourceFeatures = mergeStandardFeatureSeries(Array.isArray(collection && collection.features) ? collection.features : []);
        unifiedMapData = { ...(collection || {}), type: 'FeatureCollection', features: sourceFeatures };
        unifiedCountryCollections = new Map();
        regionDataCache.clear();
        renderDataCache.clear();

        sourceFeatures.forEach((feature, index) => {
            if (!feature || !feature.properties) return;
            if (feature.id === undefined) feature.id = index;
            normalizeFeatureIdentity(feature.properties);
            const representativeIndex = getPreferredOverviewRepresentativeIndex(feature.properties);
            const rawDataValue = feature.properties.Data;
            const representativeDataValue = valueAtRepresentativeIndex(rawDataValue, representativeIndex);
            feature.properties.RepresentativeSeriesIndex = representativeIndex;
            feature.properties.RawDataTypes = rawDataValue || 'No Info';
            feature.properties.DataDisplay = getDisplayDataType(rawDataValue || 'No Info');
            feature.properties.Data = representativeDataValue && representativeDataValue.trim() !== ''
                ? normalizeCat(representativeDataValue)
                : 'No Info';
            feature.properties.ParentCountry = getFeatureParentCountryName(feature);
            feature.properties.DatasetLevel = getFeatureDatasetLevel(feature);
            setFeatureCategorySupport(feature.properties);
            feature.properties.infoStatus = representativeDataValue
                ? (representativeDataValue.toLowerCase() === 'region' ? 'region' : 'hasinfo')
                : 'noinfo';
        });

        const groupedFeatures = new Map();
        sourceFeatures.forEach((feature) => {
            const parentCountry = getFeatureParentCountryName(feature);
            const countryKey = normalizeCountryKey(parentCountry);
            if (!countryKey || countryKey === 'global') return;
            if (!groupedFeatures.has(countryKey)) groupedFeatures.set(countryKey, []);
            groupedFeatures.get(countryKey).push(feature);
        });

        const primaryCountryFeatures = [];
        groupedFeatures.forEach((features, countryKey) => {
            const countryName = getFeatureParentCountryName(features[0]);
            const sortedFeatures = sortCountryCollectionFeatures(features, countryName).map((feature, index) => ({
                ...feature,
                id: index,
                properties: normalizeFeatureIdentity({ ...(feature.properties || {}), ParentCountry: countryName })
            }));
            unifiedCountryCollections.set(countryKey, {
                type: 'FeatureCollection',
                features: sortedFeatures
            });

            if (!hasRegionalAreaChildren(sortedFeatures)) {
                sortedFeatures.forEach((feature) => {
                    if (isCountryLevelFeature(feature)) {
                        downgradeSummaryOnlyRegionalCountry(feature);
                    }
                });
            }

            const countryCandidates = sortedFeatures.filter((feature) => isCountryLevelFeature(feature));
            const primaryFeature = (countryCandidates.length ? countryCandidates : sortedFeatures)[0];
            if (!primaryFeature) return;
            primaryCountryFeatures.push({
                ...primaryFeature,
                properties: normalizeFeatureIdentity({ ...(primaryFeature.properties || {}), ParentCountry: countryName })
            });
        });

        countriesData = {
            type: 'FeatureCollection',
            features: primaryCountryFeatures.sort((a, b) =>
                String((a && a.properties && a.properties.Name) || '').localeCompare(String((b && b.properties && b.properties.Name) || ''))
            )
        };
        countriesData.features.forEach((feature, index) => {
            feature.id = index;
        });
    }
    const REGION_DATA_VERSION = '20260402e';

    function fetchFirstAvailableText(paths) {
        const tryAt = (index) => {
            if (!Array.isArray(paths) || index >= paths.length) {
                return Promise.reject(new Error('No data file found'));
            }
            return fetch(paths[index]).then((response) => {
                if (!response.ok) return tryAt(index + 1);
                return response.text();
            });
        };
        return tryAt(0);
    }

    function getRenderLevel(levels, zoom) {
        const numericZoom = Number.isFinite(zoom) ? zoom : 0;
        return levels.find((level) => numericZoom <= level.maxZoom) || levels[levels.length - 1];
    }

    function roundCoordinateValue(value, decimals) {
        if (!Number.isFinite(value)) return value;
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    function quantizeCoordinates(coords, decimals) {
        if (!Array.isArray(coords)) return coords;
        if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            return coords.map((value) => roundCoordinateValue(value, decimals));
        }
        return coords.map((part) => quantizeCoordinates(part, decimals));
    }

    function quantizeFeature(feature, decimals) {
        if (!feature) return feature;
        const geometry = feature.geometry;
        if (!geometry || !Array.isArray(geometry.coordinates)) {
            return {
                ...feature,
                properties: { ...((feature && feature.properties) || {}) }
            };
        }
        return {
            ...feature,
            properties: { ...((feature && feature.properties) || {}) },
            geometry: {
                ...geometry,
                coordinates: quantizeCoordinates(geometry.coordinates, decimals)
            }
        };
    }

    function getQuantizedFeatureCollection(cacheKey, collection, decimals) {
        const sourceFeatures = Array.isArray(collection && collection.features) ? collection.features : [];
        const cached = renderDataCache.get(cacheKey);
        if (cached) return cached;

        const quantizedCollection = {
            ...(collection || {}),
            type: 'FeatureCollection',
            features: sourceFeatures.map((feature) => quantizeFeature(feature, decimals))
        };
        renderDataCache.set(cacheKey, quantizedCollection);
        return quantizedCollection;
    }

    function getCountryRenderDataForZoom(zoom) {
        const level = getRenderLevel(COUNTRY_RENDER_LEVELS, zoom);
        const source = overviewMapData && Array.isArray(overviewMapData.features) ? overviewMapData : countriesData;
        if (!source || !Array.isArray(source.features)) {
            return { levelKey: level.key, data: { type: 'FeatureCollection', features: [] } };
        }
        return {
            levelKey: level.key,
            data: getQuantizedFeatureCollection(`countries:${level.key}:${level.decimals}`, source, level.decimals)
        };
    }

    function getRegionRenderDataForZoom(zoom) {
        const level = getRenderLevel(COUNTRY_RENDER_LEVELS, zoom);
        if (!regionsData || !Array.isArray(regionsData.features)) {
            return { levelKey: 'full', data: { type: 'FeatureCollection', features: [] } };
        }
        return {
            levelKey: 'full',
            data: getQuantizedFeatureCollection(
                `regions:${normalizeCountryKey((getActiveRegionCountryFeature() && getActiveRegionCountryFeature().properties && getActiveRegionCountryFeature().properties.Name) || 'overview')}:${level.decimals}`,
                regionsData,
                level.decimals
            )
        };
    }

    function getFilterRegionRenderDataForZoom(zoom) {
        const level = getRenderLevel(COUNTRY_RENDER_LEVELS, zoom);
        const polygonFeatures = (filterRegionFeatures || []).filter((feature) => feature.geometry && feature.geometry.type !== 'Point');
        return {
            levelKey: 'full',
            data: getQuantizedFeatureCollection(
                `filter-regions:${level.decimals}`,
                { type: 'FeatureCollection', features: polygonFeatures },
                level.decimals
            )
        };
    }

    function reapplyRegionFeatureStates() {
        const mapRef = getMapInstance();
        if (!mapRef || !mapRef.getSource('regions')) return;
        if (selectedRegionFeatureId !== null) {
            try {
                mapRef.setFeatureState({ source: 'regions', id: selectedRegionFeatureId }, { selected: true });
            } catch (e) {}
        }
        activeDatasetRegionIds.forEach((id) => {
            try {
                mapRef.setFeatureState({ source: 'regions', id }, { datasetSelected: true });
            } catch (e) {}
        });
        dimmedDatasetRegionIds.forEach((id) => {
            try {
                mapRef.setFeatureState({ source: 'regions', id }, { datasetDimmed: true });
            } catch (e) {}
        });
    }

    function syncAdaptiveMapRendering(force) {
        const mapRef = getMapInstance();
        if (!mapRef) return;
        const zoom = mapRef.getZoom();

        if (mapRef.getSource('countries')) {
            const countryRender = getCountryRenderDataForZoom(zoom);
            if (force || currentCountryRenderLevel !== countryRender.levelKey) {
                mapRef.getSource('countries').setData(countryRender.data);
                currentCountryRenderLevel = countryRender.levelKey;
                applyCategoryFilterToMap();
            }
        }

        if (mapRef.getSource('regions') && regionsData && Array.isArray(regionsData.features)) {
            const regionRender = getRegionRenderDataForZoom(zoom);
            if (force || currentRegionRenderLevel !== regionRender.levelKey) {
                mapRef.getSource('regions').setData(regionRender.data);
                currentRegionRenderLevel = regionRender.levelKey;
                reapplyRegionFeatureStates();
            }
        }

        if (mapRef.getSource('filter-regions')) {
            const filterRegionRender = getFilterRegionRenderDataForZoom(zoom);
            if (force || currentFilterRegionRenderLevel !== filterRegionRender.levelKey) {
                mapRef.getSource('filter-regions').setData(filterRegionRender.data);
                currentFilterRegionRenderLevel = filterRegionRender.levelKey;
                applyCategoryFilterToMap();
            }
        }
    }

    // DOM 
    function isMobileMapViewport() {
        return window.matchMedia('(max-width: 760px)').matches;
    }

    function updateMobileOverviewChrome() {
        const isOverviewMode = !selectedCountryFeature;
        const shouldShow = !isMobileMapViewport() || isOverviewMode;
        const legendBookmarkEl = document.getElementById('legend-bookmark');
        const filterMenuEl = document.getElementById('filterMenu');

        if (legendBookmarkEl) {
            legendBookmarkEl.style.display = shouldShow ? '' : 'none';
            if (!shouldShow) {
                legendBookmarkEl.classList.remove('open');
            }
        }
        if (mobileFilterBtn) {
            mobileFilterBtn.style.display = shouldShow ? '' : 'none';
        }
        if (filterDockToggle) {
            filterDockToggle.style.display = shouldShow ? '' : 'none';
            if (!shouldShow) {
                filterDockToggle.classList.remove('hidden');
                filterDockToggle.setAttribute('aria-expanded', 'false');
            }
        }
        if (filterMenuEl && !shouldShow) {
            filterMenuEl.classList.remove('open');
            filterMenuEl.style.display = 'none';
            filterMenuEl.setAttribute('aria-hidden', 'true');
        }
    }

    function showCountryTOC() { 
        document.getElementById('toc-country').style.display = 'block'; 
        document.getElementById('toc-region').style.display = 'none'; 
        updateMobileOverviewChrome();
    } 

    function showRegionTOC() { 
        document.getElementById('toc-country').style.display = 'none'; 
        document.getElementById('toc-region').style.display = 'block'; 
        updateMobileOverviewChrome();
    } 

    function getActiveRegionCountryFeature() {
        return selectedCountryFeature || autoDrilldownCountryFeature || null;
    }

    function isStandardMapOverviewMode() {
        return !selectedCountryFeature;
    }

    function getDrilldownRegionFeatures() {
        if (!regionsData || !Array.isArray(regionsData.features)) return [];
        const activeCountry = getActiveRegionCountryFeature();
        const selectedName = normalizeCountryKey(activeCountry && activeCountry.properties && activeCountry.properties.Name);
        return regionsData.features.filter((feature) => {
            const featureName = normalizeCountryKey(feature && feature.properties && feature.properties.Name);
            return featureName && featureName !== selectedName;
        });
    }

    function hasDrilldownRegions() {
        return getDrilldownRegionFeatures().length > 0;
    }

    function ensureRegionsSource(rd) {
        const mapRef = getMapInstance();
        const activeCountry = getActiveRegionCountryFeature();
        const activeCountryName = activeCountry && activeCountry.properties && activeCountry.properties.Name
            ? activeCountry.properties.Name
            : '';
        if (!mapRef) return;
        const regionRender = getRegionRenderDataForZoom(mapRef.getZoom());
        if (mapRef.getSource('regions')) {
            mapRef.getSource('regions').setData(regionRender.data);
            currentRegionRenderLevel = regionRender.levelKey;
            reapplyRegionFeatureStates();
            return;
        }

        mapRef.addSource('regions', { type: 'geojson', data: regionRender.data, generateId: true });
        currentRegionRenderLevel = regionRender.levelKey;
        mapRef.addLayer({
            id: 'region-fill',
            type: 'fill',
            source: 'regions',
            filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'Name'], activeCountryName]],
            layout: { visibility: 'none' },
            paint: {
                'fill-color': buildRegionFillExpression(),
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'datasetSelected'], false], 0.8,
                    ['boolean', ['feature-state', 'datasetDimmed'], false], 0.12,
                    0.6
                ]
            }
        });
        mapRef.addLayer({
            id: 'region-border',
            type: 'line',
            source: 'regions',
            filter: ['==', ['geometry-type'], 'Polygon'],
            layout: { visibility: 'none' },
            paint: {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'datasetSelected'], false], '#ffd166',
                    ['==', ['get', 'Name'], activeCountryName], '#0367ff',
                    '#003399'
                ],
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'datasetSelected'], false], 3,
                    ['==', ['get', 'Name'], activeCountryName], 4,
                    2
                ],
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'datasetSelected'], false], 1,
                    ['boolean', ['feature-state', 'datasetDimmed'], false], 0.2,
                    1
                ]
            }
        });
        mapRef.addLayer({
            id: 'region-point',
            type: 'circle',
            source: 'regions',
            filter: [
                'all',
                ['==', ['geometry-type'], 'Point'],
                ['!=', ['get', 'Name'], activeCountryName],
                ['!', ['has', 'ADM_lookup']]
            ],
            layout: { visibility: 'none' },
            paint: {
                'circle-color': buildRegionFillExpression(),
                'circle-radius': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 10,
                    ['boolean', ['feature-state', 'datasetSelected'], false], 8,
                    7
                ],
                'circle-stroke-color': '#f1f5f9',
                'circle-stroke-width': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 3,
                    2
                ],
                'circle-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'datasetSelected'], false], 0.98,
                    ['boolean', ['feature-state', 'datasetDimmed'], false], 0.18,
                    0.95
                ]
            }
        });
    }

    function hideRegionsOnMap() {
        const mapRef = getMapInstance();
        if (!mapRef) return;
        clearSelectedRegionHighlight();
        clearResearchMarkers();
        if (mapRef.getLayer('region-fill')) mapRef.setLayoutProperty('region-fill', 'visibility', 'none');
        if (mapRef.getLayer('region-border')) mapRef.setLayoutProperty('region-border', 'visibility', 'none');
        if (mapRef.getLayer('region-point')) mapRef.setLayoutProperty('region-point', 'visibility', 'none');
        if (mapRef.getLayer('country-fill')) mapRef.setFilter('country-fill', null);
        if (mapRef.getLayer('country-border')) mapRef.setFilter('country-border', null);
        applyCategoryFilterToMap();
        if (!selectedCountryFeature) renderResearchMarkers();
    }

    function clearResearchMarkers() {
        activeResearchMarkers.forEach((marker) => {
            try {
                marker.remove();
            } catch (e) {}
        });
        activeResearchMarkers = [];
        const mapRef = getMapInstance();
        if (mapRef && mapRef.getSource('research-points')) {
            mapRef.getSource('research-points').setData({ type: 'FeatureCollection', features: [] });
        }
    }

    function zoomToResearchPoint(feature, targetMap) {
        const coords = feature && feature.geometry && feature.geometry.type === 'Point'
            ? feature.geometry.coordinates
            : null;
        const lon = coords ? Number(coords[0]) : NaN;
        const lat = coords ? Number(coords[1]) : NaN;
        if (!targetMap || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
        const currentZoom = targetMap.getZoom ? targetMap.getZoom() : 0;
        targetMap.easeTo({
            center: [lon, lat],
            zoom: Math.max(currentZoom, 10.5),
            pitch: 0,
            bearing: 0,
            duration: 900
        });
    }

    function flattenCoordinates(coords, acc) {
        if (!Array.isArray(coords)) return acc;
        if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            acc.push(coords);
            return acc;
        }
        coords.forEach((part) => flattenCoordinates(part, acc));
        return acc;
    }

    function getGeometryBounds(geometry) {
        if (!geometry || !geometry.coordinates) return null;
        const points = flattenCoordinates(geometry.coordinates, []);
        if (!points.length) return null;
        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;
        points.forEach(([lng, lat]) => {
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
        });
        if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;
        return { minLng, minLat, maxLng, maxLat };
    }

    function getCountryMarkerFallback(feature, index) {
        const bounds = getGeometryBounds(feature && feature.geometry);
        if (!bounds) return null;
        const cols = 3;
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = (col + 1) / (cols + 1);
        const y = Math.min(0.68, 0.35 + row * 0.12);
        return [
            bounds.minLng + (bounds.maxLng - bounds.minLng) * x,
            bounds.minLat + (bounds.maxLat - bounds.minLat) * y
        ];
    }

    function isPointWithinBounds(pointCoords, bounds) {
        if (!pointCoords || !bounds) return false;
        const [lng, lat] = pointCoords;
        return Number.isFinite(lng) && Number.isFinite(lat) &&
            lng >= bounds.minLng && lng <= bounds.maxLng &&
            lat >= bounds.minLat && lat <= bounds.maxLat;
    }

    function expandBounds(bounds, paddingDegrees) {
        if (!bounds || !Number.isFinite(paddingDegrees)) return bounds;
        return {
            minLng: bounds.minLng - paddingDegrees,
            minLat: bounds.minLat - paddingDegrees,
            maxLng: bounds.maxLng + paddingDegrees,
            maxLat: bounds.maxLat + paddingDegrees
        };
    }

    function getExactResearchCoordinates(feature) {
        const properties = feature && feature.properties;
        if (properties && properties.ADM_lookup) {
            const lng = toNumeric(
                properties.longitude ??
                properties.Longitude ??
                properties.LONGITUDE ??
                properties.lng ??
                properties.Lng ??
                properties.LNG ??
                properties.lon ??
                properties.Lon ??
                properties.LON
            );
            const lat = toNumeric(
                properties.latitude ??
                properties.Latitude ??
                properties.LATITUDE ??
                properties.lat ??
                properties.Lat ??
                properties.LAT
            );
            if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90) {
                return [lng, lat];
            }
        }
        const geometry = feature && feature.geometry;
        if (geometry && geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
            const [lng, lat] = geometry.coordinates;
            if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
        }
        return null;
    }

    function getValidatedResearchCoordinates(feature, countryFeature) {
        const exactCoords = getExactResearchCoordinates(feature);
        if (!exactCoords) return null;
        const countryBounds = getGeometryBounds(countryFeature && countryFeature.geometry);
        if (!countryBounds) return exactCoords;
        const width = Math.max(0, countryBounds.maxLng - countryBounds.minLng);
        const height = Math.max(0, countryBounds.maxLat - countryBounds.minLat);
        const paddedBounds = expandBounds(countryBounds, Math.max(0.5, Math.max(width, height) * 0.35));
        return isPointWithinBounds(exactCoords, paddedBounds) ? exactCoords : null;
    }

    function getMarkerCoordinatesForFeature(feature, countryFeature, index) {
        const exactResearchCoords = getValidatedResearchCoordinates(feature, countryFeature);
        if (exactResearchCoords) return exactResearchCoords;
        if (feature && feature.properties && feature.properties.ADM_lookup) return null;
        const geometry = feature && feature.geometry;
        const rawCoords = geometry && geometry.type === 'Point' ? geometry.coordinates : null;
        if (Array.isArray(rawCoords) && rawCoords.length >= 2) return rawCoords;
        const countryBounds = getGeometryBounds(countryFeature && countryFeature.geometry);
        return getCountryMarkerFallback(countryFeature, index);
    }

    function getOverviewResearchMarkerCoordinates(feature, index) {
        const resolvedCountry = resolveCountryFeatureFromMapFeature(feature);
        const exactResearchCoords = getValidatedResearchCoordinates(feature, resolvedCountry || feature);
        if (exactResearchCoords) return exactResearchCoords;
        if (feature && feature.properties && feature.properties.ADM_lookup) return null;
        const geometry = feature && feature.geometry;
        if (!geometry) return null;
        try {
            const center = turf.centerOfMass(feature);
            const coords = center && center.geometry && Array.isArray(center.geometry.coordinates)
                ? center.geometry.coordinates
                : null;
            if (coords && coords.length >= 2) return coords;
        } catch (e) {}
        return getCountryMarkerFallback(resolvedCountry || feature, index);
    }

    function mergeCountrySummaryProperties(features, fallbackProperties) {
        const sourceFeatures = Array.isArray(features) ? features.filter((feature) => feature && feature.properties) : [];
        const baseProps = { ...((fallbackProperties && typeof fallbackProperties === 'object') ? fallbackProperties : {}) };
        if (!sourceFeatures.length) return baseProps;

        const isMissing = (value) => {
            if (value === null || value === undefined) return true;
            if (typeof value === 'string') return !value.trim();
            return false;
        };
        const allKeys = new Set(Object.keys(baseProps));
        sourceFeatures.forEach((feature) => {
            Object.keys(feature.properties || {}).forEach((key) => allKeys.add(key));
        });

        allKeys.forEach((key) => {
            const values = sourceFeatures.map((feature) => feature.properties[key]);
            const nonMissingValues = values.filter((value) => !isMissing(value));
            if (!nonMissingValues.length) return;

            const allPresent = nonMissingValues.length === values.length;
            const firstValue = nonMissingValues[0];
            const sameValueAcrossFeatures = allPresent && nonMissingValues.every((value) => String(value).trim() === String(firstValue).trim());

            if (sameValueAcrossFeatures) {
                baseProps[key] = firstValue;
                return;
            }

            baseProps[key] = values
                .map((value) => (isMissing(value) ? 'N/A' : String(value)))
                .join(' || ');
        });

        baseProps.RepresentativeSeriesIndex = getLatestRepresentativeIndex(baseProps);
        return baseProps;
    }

    function getCountrySummaryFeature() {
        if (!regionsData || !Array.isArray(regionsData.features) || !selectedCountryFeature || !selectedCountryFeature.properties) {
            return null;
        }
        const countryKey = normalizeCountryKey(selectedCountryFeature.properties.Name);
        const matchingFeatures = regionsData.features.filter((feature) => {
            const properties = feature && feature.properties;
            if (!properties) return false;
            if (properties.ADM_lookup) return false;
            if (Number(properties.ADM) !== 0) return false;
            return normalizeCountryKey(properties.Name) === countryKey;
        });
        if (!matchingFeatures.length) return null;
        if (matchingFeatures.length === 1) return matchingFeatures[0];
        return {
            ...matchingFeatures[0],
            properties: mergeCountrySummaryProperties(matchingFeatures, selectedCountryFeature.properties)
        };
    }

    function getCountryDatasetIndexForFeature(feature) {
        const countrySummaryFeature = getCountrySummaryFeature();
        const summaryProperties = (countrySummaryFeature && countrySummaryFeature.properties) || (selectedCountryFeature && selectedCountryFeature.properties);
        if (!summaryProperties || !feature || !feature.properties) return undefined;

        const splitSeries = (value) => {
            if (value === null || value === undefined) return [];
            const text = String(value).trim();
            if (!text) return [];
            if (text.includes(' || ')) return text.split(/\s*\|\|\s*/).filter(Boolean);
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
        const getDatasetNamesFromProperties = (properties) => {
            const names = uniqueValues([
                properties && properties['Dataset_name'],
                properties && properties.Dataset_name,
                properties && properties['Data Name'],
                properties && properties['Data name'],
                properties && properties['Dataset Name'],
                properties && properties.dataset_name,
                properties && properties.Dataset
            ].flatMap((value) => splitSeries(value)));
            if (names.length) return names;
            const fallbackName = String((properties && properties.Name) || '').trim();
            const parentCountryName = String(
                (properties && (properties.ParentCountry || properties.main_country || properties.country)) || ''
            ).trim();
            const isSubCountryFeature = !!fallbackName && normalizeCountryKey(fallbackName) !== normalizeCountryKey(parentCountryName || fallbackName);
            return isSubCountryFeature ? uniqueValues([fallbackName]) : names;
        };
        const normalizeDatasetOptionKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

        const summaryDatasetOptions = getDatasetNamesFromProperties(summaryProperties);
        const countryName = normalizeCountryKey(summaryProperties.Name);
        const childDatasetOptions = regionsData.features
            .filter((item) => {
                const properties = item && item.properties;
                const sameCountryName = normalizeCountryKey(properties && properties.Name) === countryName;
                const isResearchFeature = !!(properties && properties.ADM_lookup);
                return !sameCountryName || isResearchFeature;
            })
            .flatMap((item) => getDatasetNamesFromProperties(item && item.properties));
        const datasetOptions = uniqueValues([...summaryDatasetOptions, ...childDatasetOptions]);
        const targetKeys = getDatasetNamesFromProperties(feature.properties).map((name) => normalizeDatasetOptionKey(name));
        return datasetOptions.findIndex((name) => targetKeys.includes(normalizeDatasetOptionKey(name)));
    }

    function getCountryDatasetIndexForDatasetName(datasetName) {
        const countrySummaryFeature = getCountrySummaryFeature();
        const summaryProperties = (countrySummaryFeature && countrySummaryFeature.properties) || (selectedCountryFeature && selectedCountryFeature.properties);
        if (!summaryProperties || !datasetName) return undefined;

        const splitSeries = (value) => {
            if (value === null || value === undefined) return [];
            const text = String(value).trim();
            if (!text) return [];
            if (text.includes(' || ')) return text.split(/\s*\|\|\s*/).filter(Boolean);
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
        const getDatasetNamesFromProperties = (properties) => {
            const names = uniqueValues([
                properties && properties['Dataset_name'],
                properties && properties.Dataset_name,
                properties && properties['Data Name'],
                properties && properties['Data name'],
                properties && properties['Dataset Name'],
                properties && properties.dataset_name,
                properties && properties.Dataset
            ].flatMap((value) => splitSeries(value)));
            if (names.length) return names;
            const fallbackName = String((properties && properties.Name) || '').trim();
            const parentCountryName = String(
                (properties && (properties.ParentCountry || properties.main_country || properties.country)) || ''
            ).trim();
            const isSubCountryFeature = !!fallbackName && normalizeCountryKey(fallbackName) !== normalizeCountryKey(parentCountryName || fallbackName);
            return isSubCountryFeature ? uniqueValues([fallbackName]) : names;
        };
        const normalizeDatasetOptionKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

        const summaryDatasetOptions = getDatasetNamesFromProperties(summaryProperties);
        const countryName = normalizeCountryKey(summaryProperties.Name);
        const childDatasetOptions = regionsData.features
            .filter((item) => {
                const properties = item && item.properties;
                const sameCountryName = normalizeCountryKey(properties && properties.Name) === countryName;
                const isResearchFeature = !!(properties && properties.ADM_lookup);
                return !sameCountryName || isResearchFeature;
            })
            .flatMap((item) => getDatasetNamesFromProperties(item && item.properties));
        const datasetOptions = uniqueValues([...summaryDatasetOptions, ...childDatasetOptions]);
        return datasetOptions.findIndex((name) => normalizeDatasetOptionKey(name) === normalizeDatasetOptionKey(datasetName));
    }

    function focusRegionFeature(id, props) {
        if (!window.map || !regionsData || !Array.isArray(regionsData.features)) return;
        const feature = getRegionFeatureByIdOrProperties(id, props);
        if (!feature) return;
        clearDatasetRegionSelection();
        clearSelectedRegionHighlight();
        selectedRegionFeatureId = id;
        map.setFeatureState({ source: 'regions', id }, { selected: true });
        try {
            if (feature && feature.geometry && feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
                map.easeTo({
                    center: feature.geometry.coordinates,
                    zoom: Math.max(map.getZoom(), 8),
                    padding: getMapFitPadding(20),
                    duration: 1000,
                    pitch: 45,
                    bearing: 0
                });
            } else {
                const bbox = turf.bbox(feature);
                map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
                    padding: getMapFitPadding(20),
                    duration: 1000,
                    pitch: 45,
                    bearing: 0
                });
            }
        } catch (e) {
            console.warn('Kan bounding box niet bepalen:', e);
        }
    }

    function isResearchLegendActive() {
        return activeLegendCategories.has(RESEARCH_LEGEND_CATEGORY);
    }

    function createResearchMarkerElement(datasetName) {
        const markerEl = document.createElement('button');
        markerEl.type = 'button';
        markerEl.className = 'research-marker';
        markerEl.setAttribute('aria-label', `Open ${datasetName}`);
        markerEl.innerHTML = `
          <span class="research-marker-pin"></span>
        `;
        return markerEl;
    }

    function getResearchDatasetName(feature) {
        const properties = feature && feature.properties;
        const isResearchFeature = !!(properties && properties.ADM_lookup);
        return String(
            (properties && (
                (isResearchFeature && (
                    properties.location ||
                    properties.Location ||
                    properties['Name.1'] ||
                    properties.RegionName ||
                    properties.Dataset_name ||
                    properties.dataset_name ||
                    properties['Data Name'] ||
                    properties['Dataset Name']
                )) ||
                properties.Name ||
                properties.RegionName ||
                properties.location ||
                properties.Location ||
                properties.Dataset_name ||
                properties.dataset_name ||
                properties['Data Name'] ||
                properties['Dataset Name']
            )) || ''
        ).trim() || 'Unknown dataset';
    }

    function getResearchDatasetNames(feature) {
        const rawName = getResearchDatasetName(feature);
        if (!rawName) return [];
        if (rawName.includes(' || ')) {
            return rawName.split(/\s*\|\|\s*/).map((value) => String(value || '').trim()).filter(Boolean);
        }
        return [rawName];
    }

    function getFeatureLocationLookupKeys(featureOrProperties) {
        const properties = (featureOrProperties && featureOrProperties.properties) || featureOrProperties || {};
        const isResearch = !!properties.ADM_lookup;
        return [
            isResearch ? null : properties.Name,
            properties['Name.1'],
            properties.RegionName,
            properties.location,
            properties.Location,
            properties.place,
            properties.Place,
            properties.Dataset_name,
            properties.dataset_name,
            properties['Data Name'],
            properties['Dataset Name']
        ]
            .flatMap((value) => String(value || '').split(/\s*\|\|\s*/))
            .map((value) => normalizeCountryKey(value))
            .filter(Boolean);
    }

    function renderResearchMarkers() {
        clearResearchMarkers();
        const mapRef = getMapInstance();
        const inCountryView = !!(selectedCountryFeature && regionsData && Array.isArray(regionsData.features));
        const cityTypeActive = inCountryView
            ? (!shouldApplyDatasetTypeFilter() || !mapFilterState.datasetTypes || mapFilterState.datasetTypes.has('city'))
            : (!mapFilterState.datasetTypes || mapFilterState.datasetTypes.has('city'));
        if (!mapRef || !cityTypeActive || !mapRef.getSource('research-points')) return;

        let sourceFeatures;
        if (inCountryView) {
            sourceFeatures = regionsData.features;
        } else {
            sourceFeatures = (unifiedMapData && Array.isArray(unifiedMapData.features))
                ? unifiedMapData.features
                : [];
        }

        const pointFeatures = sourceFeatures.filter((feature) => {
            const hasLookup = !!(feature && feature.properties && feature.properties.ADM_lookup);
            return hasLookup && String((feature.properties && feature.properties.Name) || '').trim();
        });
        if (!pointFeatures.length) return;

        const seenMarkerKeys = new Set();
        const markerFeatures = [];

        pointFeatures.forEach((feature, index) => {
            const baseCoords = inCountryView
                ? getMarkerCoordinatesForFeature(feature, selectedCountryFeature, index)
                : getOverviewResearchMarkerCoordinates(feature, index);
            if (!baseCoords) return;
            const datasetNames = getResearchDatasetNames(feature);
            if (!datasetNames.length) return;

            datasetNames.forEach((datasetName, datasetIndexWithinFeature) => {
                const coords = baseCoords;
                const markerKey = [
                    normalizeCountryKey(datasetName),
                    Array.isArray(coords) ? Number(coords[0]).toFixed(6) : '',
                    Array.isArray(coords) ? Number(coords[1]).toFixed(6) : ''
                ].join('::');
                if (seenMarkerKeys.has(markerKey)) return;
                seenMarkerKeys.add(markerKey);
                markerFeatures.push({
                    type: 'Feature',
                    properties: {
                        ...(feature.properties || {}),
                        DisplayName: datasetName,
                        ResearchFeatureId: feature.id !== undefined ? feature.id : index
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [Number(coords[0]), Number(coords[1])]
                    }
                });
            });
        });

        mapRef.getSource('research-points').setData({
            type: 'FeatureCollection',
            features: markerFeatures
        });
    }

    function resolveCountryFeatureFromMapFeature(feature) {
        if (!feature || !feature.properties) return null;
        const parentCountryName = String(feature.properties.ParentCountry || '').trim();
        const countryName = parentCountryName || String(feature.properties.Name || '').trim();
        if (!countryName || !countriesData || !Array.isArray(countriesData.features)) return null;
        const lookup = normalizeCountryKey(countryName);
        return countriesData.features.find((candidate) =>
            candidate &&
            candidate.properties &&
            candidate.properties.Name &&
            !candidate.properties.RegionName &&
            normalizeCountryKey(candidate.properties.Name) === lookup
        ) || null;
    }

    function getCenteredCountryFeature() {
        const mapRef = getMapInstance();
        if (!mapRef || !mapRef.getLayer('country-fill')) return null;
        const center = mapRef.project(mapRef.getCenter());
        const features = mapRef.queryRenderedFeatures(center, { layers: ['country-fill'] });
        if (!features || !features.length) return null;
        return resolveCountryFeatureFromMapFeature(features[0]);
    }

    function syncRegionDrilldownForZoom() {
        const mapRef = getMapInstance();
        if (!mapRef) return;

        if (!isStandardMapOverviewMode()) {
            if (regionDrilldownVisible || autoDrilldownCountryFeature) {
                regionDrilldownVisible = false;
                autoDrilldownCountryFeature = null;
                hideRegionsOnMap();
            }
            return;
        }

        const zoom = mapRef.getZoom();
        if (zoom < REGION_DRILLDOWN_EXIT_ZOOM) {
            regionDrilldownVisible = false;
            autoDrilldownCountryFeature = null;
            hideRegionsOnMap();
            return;
        }

        if (zoom < REGION_DRILLDOWN_ZOOM) {
            if (regionDrilldownVisible) {
                regionDrilldownVisible = false;
                autoDrilldownCountryFeature = null;
                hideRegionsOnMap();
            }
            return;
        }

        const targetCountry = getCenteredCountryFeature();
        if (!targetCountry || !targetCountry.properties || !targetCountry.properties.Name) {
            regionDrilldownVisible = false;
            autoDrilldownCountryFeature = null;
            hideRegionsOnMap();
            return;
        }

        const targetKey = normalizeCountryKey(targetCountry.properties.Name);
        const activeCountry = getActiveRegionCountryFeature();
        const activeKey = normalizeCountryKey(activeCountry && activeCountry.properties && activeCountry.properties.Name);
        if (regionDrilldownVisible && activeKey === targetKey && hasDrilldownRegions()) return;

        autoDrilldownCountryFeature = targetCountry;

        fetchCountryRegions(targetCountry.properties.Name)
            .then((rd) => {
                const currentMap = getMapInstance();
                const currentActiveCountry = getActiveRegionCountryFeature();
                const currentKey = normalizeCountryKey(currentActiveCountry && currentActiveCountry.properties && currentActiveCountry.properties.Name);
                if (!currentMap || currentMap.getZoom() < REGION_DRILLDOWN_ZOOM || currentKey !== targetKey) return;

                if (rd && rd.features) {
                    rd.features.forEach((f, i) => {
                        if (f.id === undefined) f.id = i;
                        f.properties.RawDataTypes = f.properties.Data || 'No Info';
                        f.properties.DataDisplay = getDisplayDataType(f.properties.Data || 'No Info');
                        f.properties.Data = normalizeCat(f.properties.Data);
                        setFeatureCategorySupport(f.properties);
                    });
                }

                regionsData = rd;
                regionDrilldownVisible = hasDrilldownRegions();
                if (!regionDrilldownVisible) {
                    hideRegionsOnMap();
                    return;
                }
                showRegionsOnMap(regionsData);
            })
            .catch(() => {
                if (!selectedCountryFeature) autoDrilldownCountryFeature = null;
                regionDrilldownVisible = false;
                hideRegionsOnMap();
            });
    }

    function fetchCountryRegions(countryName) {
        const cacheKey = normalizeCountryKey(countryName);
        if (regionDataCache.has(cacheKey)) return regionDataCache.get(cacheKey);
        const collection = unifiedCountryCollections.get(cacheKey);
        const request = collection
            ? Promise.resolve(collection)
            : Promise.reject(new Error(`No country collection found for ${countryName}`));
        regionDataCache.set(cacheKey, request);
        return request;
    }

    function buildSearchIndexFromGeoJSON() {
        const source = unifiedMapData || countriesData;
        if (!source || !Array.isArray(source.features)) return [];
        const seen = new Set();
        const items = [];
        source.features.forEach((f) => {
            if (!f || !f.properties) return;
            const props = f.properties;
            const name = String(props.Name || props.RegionName || '').trim();
            const parentCountry = String(props.ParentCountry || props.main_country || props.country || name).trim();
            if (!name || !parentCountry) return;
            const dedupeKey = `${normalizeCountryKey(name)}|${normalizeCountryKey(parentCountry)}`;
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            items.push({
                label: name,
                country: parentCountry,
                region: name,
                searchText: `${name} ${parentCountry}`.toLowerCase()
            });
        });
        return items.sort((a, b) => a.label.localeCompare(b.label));
    }

    function loadLocationSearchIndex() {
        if (locationSearchIndexPromise) return locationSearchIndexPromise;
        // Build index from the already-loaded GeoJSON if available, otherwise from CSV
        if (unifiedMapData && Array.isArray(unifiedMapData.features) && unifiedMapData.features.length) {
            locationSearchIndex = buildSearchIndexFromGeoJSON();
            locationSearchIndexPromise = Promise.resolve(locationSearchIndex);
            return locationSearchIndexPromise;
        }
        locationSearchIndexPromise = fetchFirstAvailableText(CATALOGUE_DATA_PATHS)
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

    function toNumeric(value) {
        const text = String(value || '').trim().replace(',', '.');
        if (!text) return null;
        const match = text.match(/-?\d+(\.\d+)?/);
        if (!match) return null;
        const n = Number(match[0]);
        return Number.isFinite(n) ? n : null;
    }

    function parseYearValues(value) {
        return String(value || '')
            .match(/\b(19|20)\d{2}\b/g)
            ?.map((token) => Number(token))
            .filter((year) => Number.isInteger(year)) || [];
    }

    function formatOngoingYearValue(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const now = new Date();
        const currentYear = now.getFullYear();
        const years = parseYearValues(text);
        if (years.length === 1 && years[0] === currentYear) {
            return `${currentYear + 1} onwards`;
        }
        return text;
    }

    function splitLinkedSeries(value) {
        if (value === null || value === undefined) return [];
        const text = String(value).trim();
        if (!text || !text.includes(' || ')) return [];
        return text.split(/\s*\|\|\s*/).map((part) => String(part || '').trim()).filter(Boolean);
    }

    function splitDatasetSeries(value) {
        if (value === null || value === undefined) return [];
        const text = String(value).trim();
        if (!text) return [];
        if (text.includes(' || ')) return text.split(/\s*\|\|\s*/).map((part) => String(part || '').trim()).filter(Boolean);
        return text.split(/\s*,\s*/).map((part) => String(part || '').trim()).filter(Boolean);
    }

    function uniqueTextValues(values) {
        const seen = new Set();
        return (values || []).filter((value) => {
            const key = String(value || '').trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function getDatasetNamesFromFeatureProperties(properties) {
        return uniqueTextValues([
            properties && properties['Dataset_name'],
            properties && properties.Dataset_name,
            properties && properties['Data Name'],
            properties && properties['Data name'],
            properties && properties['Dataset Name'],
            properties && properties.dataset_name,
            properties && properties.Dataset
        ].flatMap((value) => splitDatasetSeries(value)));
    }

    function getDatasetTypeFromProps(props) {
        if (props && props.ADM_lookup) return 'city';
        const adm = Number(props && props.ADM);
        if (!Number.isFinite(adm) || adm === 0) return 'national';
        if (adm === 1) return 'regional';
        return 'city';
    }

    function extractFilterRecordFromProps(props) {
        const allNumeric = (v) => String(v || '').split('||').map(toNumeric).filter((n) => Number.isFinite(n));
        const spatialValues = [props && props.National, props && props.Urban].flatMap(allNumeric);
        const planimetricValues = allNumeric(props && props.Planimetric);
        const altimetricValues = allNumeric(props && props.Altimetric);
        const filterYearEndValue = String((props && (props.Year_end || props.year_end || props['Year end'] || props['Acquisition end'] || props['End year'])) || '').trim();
        const filterYearStartValue = String((props && (props.Year_start || props.year_start || props['Year begin'] || props['Acquisition start'] || props['Start year'])) || '').trim();
        const filterLegacyYearValue = String((props && (props.Year || props.year)) || '').trim();
        const years = [
            ...parseYearValues(filterYearStartValue),
            ...parseYearValues(filterYearEndValue),
            ...parseYearValues(filterLegacyYearValue)
        ];
        const representativeYearScore = getLatestYearScore(
            filterYearEndValue,
            filterYearStartValue,
            filterLegacyYearValue
        );
        const classes = detectClassificationTags(String((props && (props.Info || props.info)) || ''), props);
        const dataCategories = new Set(
            getAvailableDataCategories(
                (props && (
                    props.RawDataTypes ||
                    props.DataDisplay ||
                    props['Data display'] ||
                    props.Data
                )) || ''
            ).filter((category) => ['Pointcloud', 'DEM', 'No Info', 'Region'].includes(category))
        );
        return {
            spatial: computeRange(spatialValues),
            planimetric: computeRange(planimetricValues),
            altimetric: computeRange(altimetricValues),
            year: computeRange(years),
            classifications: classes,
            dataCategories,
            representativeYearScore,
            datasetType: getDatasetTypeFromProps(props || {})
        };
    }

    function extractFilterRecordsFromProps(props) {
        if (!props) return [];
        const linkedSeriesCount = Math.max(
            1,
            splitLinkedSeries(props.National).length,
            splitLinkedSeries(props.Urban).length,
            splitLinkedSeries(props.Planimetric).length,
            splitLinkedSeries(props.Altimetric).length,
            splitLinkedSeries(props.Year_start).length,
            splitLinkedSeries(props.year_start).length,
            splitLinkedSeries(props['Year begin']).length,
            splitLinkedSeries(props['Acquisition start']).length,
            splitLinkedSeries(props['Start year']).length,
            splitLinkedSeries(props.Year_end).length,
            splitLinkedSeries(props.year_end).length,
            splitLinkedSeries(props['Year end']).length,
            splitLinkedSeries(props['Acquisition end']).length,
            splitLinkedSeries(props['End year']).length,
            splitLinkedSeries(props.Year).length,
            splitLinkedSeries(props.year).length,
            splitLinkedSeries(props['Dataset_name']).length,
            splitLinkedSeries(props.Dataset_name).length,
            splitLinkedSeries(props['Data Name']).length,
            splitLinkedSeries(props['Data name']).length,
            splitLinkedSeries(props['Dataset Name']).length,
            splitLinkedSeries(props.dataset_name).length,
            splitLinkedSeries(props.Dataset).length
        );

        if (linkedSeriesCount <= 1) {
            const singleRecord = extractFilterRecordFromProps(props);
            return singleRecord ? [singleRecord] : [];
        }

        const getLinkedValue = (value, index) => {
            const parts = splitLinkedSeries(value);
            return parts.length ? (parts[index] || '') : value;
        };

        return Array.from({ length: linkedSeriesCount }, (_, index) => extractFilterRecordFromProps({
            ...props,
            National: getLinkedValue(props.National, index),
            Urban: getLinkedValue(props.Urban, index),
            Planimetric: getLinkedValue(props.Planimetric, index),
            Altimetric: getLinkedValue(props.Altimetric, index),
            Year_start: getLinkedValue(props.Year_start, index),
            year_start: getLinkedValue(props.year_start, index),
            'Year begin': getLinkedValue(props['Year begin'], index),
            'Acquisition start': getLinkedValue(props['Acquisition start'], index),
            'Start year': getLinkedValue(props['Start year'], index),
            Year_end: getLinkedValue(props.Year_end, index),
            year_end: getLinkedValue(props.year_end, index),
            'Year end': getLinkedValue(props['Year end'], index),
            'Acquisition end': getLinkedValue(props['Acquisition end'], index),
            'End year': getLinkedValue(props['End year'], index),
            Year: getLinkedValue(props.Year, index),
            year: getLinkedValue(props.year, index),
            Dataset_name: getLinkedValue(props.Dataset_name, index),
            dataset_name: getLinkedValue(props.dataset_name, index),
            'Dataset_name': getLinkedValue(props['Dataset_name'], index),
            'Data Name': getLinkedValue(props['Data Name'], index),
            'Data name': getLinkedValue(props['Data name'], index),
            'Dataset Name': getLinkedValue(props['Dataset Name'], index),
            Dataset: getLinkedValue(props.Dataset, index)
        })).filter(Boolean);
    }

    function getLatestYearScore(...values) {
        for (let i = 0; i < values.length; i += 1) {
            const years = parseYearValues(values[i]);
            if (years.length) return Math.max(...years);
        }
        return Number.NEGATIVE_INFINITY;
    }

    function getLatestRepresentativeIndex(properties) {
        if (!properties) return 0;

        const yearEndParts = splitLinkedSeries(
            properties.Year_end ||
            properties.year_end ||
            properties['Year end'] ||
            properties['Acquisition end'] ||
            properties['End year']
        );
        const yearBeginParts = splitLinkedSeries(
            properties.Year_start ||
            properties.year_start ||
            properties.year_begin ||
            properties['Year begin'] ||
            properties['Acquisition start'] ||
            properties['Start year']
        );
        const legacyYearParts = splitLinkedSeries(properties.Year);
        const datasetNameParts = splitLinkedSeries(
            properties['Dataset_name'] ||
            properties.Dataset_name ||
            properties['Data Name'] ||
            properties['Data name'] ||
            properties.Dataset ||
            properties['Dataset Name'] ||
            properties.dataset_name
        );
        const dataTypeParts = splitLinkedSeries(properties.DataDisplay || properties['Data display'] || properties.Data);

        const partCount = Math.max(
            yearEndParts.length,
            yearBeginParts.length,
            legacyYearParts.length,
            datasetNameParts.length,
            dataTypeParts.length
        );
        if (partCount <= 1) return 0;

        let bestIndex = 0;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let index = 0; index < partCount; index += 1) {
            const score = getLatestYearScore(
                yearEndParts[index],
                yearBeginParts[index],
                legacyYearParts[index]
            );
            if (score > bestScore || (score === bestScore && index > bestIndex)) {
                bestScore = score;
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    function getPreferredOverviewRepresentativeIndex(properties) {
        if (!properties) return 0;

        const yearEndParts = splitLinkedSeries(
            properties.Year_end ||
            properties.year_end ||
            properties['Year end'] ||
            properties['Acquisition end'] ||
            properties['End year']
        );
        const yearBeginParts = splitLinkedSeries(
            properties.Year_start ||
            properties.year_start ||
            properties.year_begin ||
            properties['Year begin'] ||
            properties['Acquisition start'] ||
            properties['Start year']
        );
        const legacyYearParts = splitLinkedSeries(properties.Year);
        const datasetNameParts = splitLinkedSeries(
            properties['Dataset_name'] ||
            properties.Dataset_name ||
            properties['Data Name'] ||
            properties['Data name'] ||
            properties.Dataset ||
            properties['Dataset Name'] ||
            properties.dataset_name
        );
        const dataTypeParts = splitLinkedSeries(properties.DataDisplay || properties['Data display'] || properties.Data);

        const partCount = Math.max(
            yearEndParts.length,
            yearBeginParts.length,
            legacyYearParts.length,
            datasetNameParts.length,
            dataTypeParts.length
        );
        if (partCount <= 1) return 0;

        const chooseLatestIndex = (predicate) => {
            let bestIndex = -1;
            let bestScore = Number.NEGATIVE_INFINITY;
            for (let index = 0; index < partCount; index += 1) {
                const normalizedType = normalizeCat(dataTypeParts[index] || '');
                if (!predicate(normalizedType)) continue;
                const score = getLatestYearScore(
                    yearEndParts[index],
                    yearBeginParts[index],
                    legacyYearParts[index]
                );
                if (score > bestScore || (score === bestScore && index > bestIndex)) {
                    bestScore = score;
                    bestIndex = index;
                }
            }
            return bestIndex;
        };

        const nationalIndex = chooseLatestIndex((type) => type !== 'Region' && type !== 'No Info');
        if (nationalIndex !== -1) return nationalIndex;

        const regionalIndex = chooseLatestIndex((type) => type === 'Region');
        if (regionalIndex !== -1) return regionalIndex;

        return getLatestRepresentativeIndex(properties);
    }

    function valueAtRepresentativeIndex(value, index) {
        const parts = splitLinkedSeries(value);
        if (!parts.length) return value;
        const safeIndex = Math.max(0, Math.min(index, parts.length - 1));
        return parts[safeIndex];
    }

    function getAvailableDataCategories(value) {
        const raw = String(value || '').trim();
        if (!raw) return ['No Info'];
        const tokens = raw
            .replace(/\s*\|\|\s*/g, ',')
            .split(/\s*,\s*/)
            .map((token) => token.trim())
            .filter(Boolean);
        const categories = new Set();
        tokens.forEach((token) => {
            const category = normalizeCat(token);
            if (category) categories.add(category);
        });
        return categories.size ? Array.from(categories) : ['No Info'];
    }

    function categorySupportProperty(category) {
        switch (normalizeCat(category)) {
            case 'Pointcloud': return 'SupportsPointcloud';
            case 'DEM': return 'SupportsDEM';
            case 'Region': return 'SupportsRegion';
            default: return 'SupportsNoInfo';
        }
    }

    function setFeatureCategorySupport(properties, extraCategories) {
        if (!properties) return properties;
        const rawCategories = getAvailableDataCategories(
            properties.RawDataTypes ||
            properties.DataDisplay ||
            properties['Data display'] ||
            properties.Data
        );
        const mergedCategories = new Set(rawCategories);
        (extraCategories || []).forEach((category) => {
            const normalized = normalizeCat(category);
            if (normalized) mergedCategories.add(normalized);
        });
        if (!mergedCategories.size) mergedCategories.add('No Info');
        properties.SupportsPointcloud = mergedCategories.has('Pointcloud');
        properties.SupportsDEM = mergedCategories.has('DEM');
        properties.SupportsRegion = mergedCategories.has('Region');
        properties.SupportsNoInfo = mergedCategories.has('No Info');
        properties.AvailableCategories = Array.from(mergedCategories).join('|');
        return properties;
    }

    function featureSupportsCategory(featureOrProperties, category) {
        const properties = featureOrProperties && featureOrProperties.properties
            ? featureOrProperties.properties
            : featureOrProperties;
        if (!properties) return false;
        const propName = categorySupportProperty(category);
        if (Object.prototype.hasOwnProperty.call(properties, propName)) {
            return !!properties[propName];
        }
        return getAvailableDataCategories(
            properties.RawDataTypes ||
            properties.DataDisplay ||
            properties['Data display'] ||
            properties.Data
        ).includes(normalizeCat(category));
    }

    function getFeatureAvailableCategories(featureOrProperties) {
        const properties = featureOrProperties && featureOrProperties.properties
            ? featureOrProperties.properties
            : featureOrProperties;
        if (!properties) return [];
        return ['Pointcloud', 'DEM', 'No Info', 'Region'].filter((category) =>
            featureSupportsCategory(properties, category)
        );
    }

    function getActiveCategorySelection() {
        return activeLegendCategories.size
            ? Array.from(activeLegendCategories)
            : (activeCategory ? [activeCategory] : []);
    }

    function getFeatureDisplayColor(featureOrProperties) {
        const properties = featureOrProperties && featureOrProperties.properties
            ? featureOrProperties.properties
            : featureOrProperties;
        const selectedCats = getActiveCategorySelection();
        if (selectedCats.length === 1 && featureSupportsCategory(properties, selectedCats[0])) {
            return getCatColor(selectedCats[0]);
        }
        return getCatColor((properties && properties.Data) || 'No Info');
    }

    function getAvailableClassifications(infoText) {
        const text = ` ${String(infoText || '').toLowerCase()} `;
        if (!text.trim()) return [];
        return CLASSIFICATION_DEFINITIONS.filter((entry) =>
            Array.isArray(entry.patterns) && entry.patterns.some((pattern) => text.includes(pattern))
        );
    }

    // Map GeoJSON classification column names → filter tag
    const CLASSIFICATION_COLUMN_MAP = {
        'ground':              'ground',
        'low vegetation':      'low vegetation',
        'medium vegetation':   'medium vegetation',
        'high vegetation':     'high vegetation',
        'common vegetation':   'vegetation',
        'building':            'building',
        'water':               'water',
        'low point':           'low point',
        'rail':                'rail',
        'road surface':        'road surface',
        'bridge':              'bridge',
        'overhead':            'overhead',
        'transmission tower':  'transmission tower',
        'wire structure connector': 'wire connector',
        'wg':                  'wire guard',
        'wc':                  'wire connector',
        'snow':                'snow',
        'unclassified':        'unclassified',
        'created':             'created / never classified'
    };

    function detectClassificationTags(infoText, props) {
        const tags = new Set();
        // Read dedicated GeoJSON boolean columns
        if (props && typeof props === 'object') {
            Object.entries(props).forEach(([col, val]) => {
                const key = String(col).toLowerCase().trim();
                const tag = CLASSIFICATION_COLUMN_MAP[key];
                if (tag && val !== null && val !== undefined && val !== 0 && val !== '0' && val !== false && String(val).trim() !== '') {
                    tags.add(tag);
                }
            });
        }
        // Also fall back to text scanning for any not covered by columns
        getAvailableClassifications(infoText).forEach((entry) => {
            (entry.filterTags || []).forEach((tag) => tags.add(tag));
        });
        return tags;
    }

    function computeRange(values) {
        const nums = (values || []).filter((n) => Number.isFinite(n));
        if (!nums.length) return { min: null, max: null };
        return { min: Math.min(...nums), max: Math.max(...nums) };
    }

    function unionMetricRanges(records, key) {
        const pool = [];
        (records || []).forEach((record) => {
            const range = record && record[key];
            if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return;
            pool.push(range.min, range.max);
        });
        return computeRange(pool);
    }

    function clampFilterRange(currentMin, currentMax, bounds) {
        if (!bounds || !bounds.ready || !Number.isFinite(bounds.min) || !Number.isFinite(bounds.max)) {
            return { min: currentMin, max: currentMax };
        }
        let nextMin = Number.isFinite(currentMin) ? currentMin : bounds.min;
        let nextMax = Number.isFinite(currentMax) ? currentMax : bounds.max;
        nextMin = Math.max(bounds.min, Math.min(nextMin, bounds.max));
        nextMax = Math.max(bounds.min, Math.min(nextMax, bounds.max));
        if (nextMin > nextMax) {
            nextMin = bounds.min;
            nextMax = bounds.max;
        }
        return { min: nextMin, max: nextMax };
    }


    function rebuildCountryFilterMetrics() {
        const metrics = new Map();
        const availableFilterTags = new Set();
        let hasAnyClassificationInfo = false;

        const activeTypes = mapFilterState.datasetTypes;
        const activeDataCategories = mapFilterState.dataCategories;

        countryFilterMetricBuckets.forEach((bucket, countryKey) => {
            const allRecords = (bucket && bucket.standard) || [];
            if (!allRecords.length) return;

            // Filter records by the active dataset types (national/regional/city)
            const standardRecords = activeTypes.size
                ? allRecords.filter((r) => activeTypes.has(r.datasetType || 'national'))
                : allRecords;
            const categoryFilteredRecords = standardRecords.filter((record) => {
                const recordCategories = record && record.dataCategories instanceof Set
                    ? record.dataCategories
                    : new Set();
                if (!activeDataCategories || !activeDataCategories.size) return false;
                return Array.from(activeDataCategories).some((category) => recordCategories.has(category));
            });

            const classifications = new Set();
            categoryFilteredRecords.forEach((record) => {
                (record.classifications || new Set()).forEach((tag) => classifications.add(tag));
            });
            const hasClassification = classifications.size > 0;
            if (hasClassification) {
                hasAnyClassificationInfo = true;
                classifications.forEach((tag) => availableFilterTags.add(tag));
            }

            // A country passes if ANY of its active-type records has spatial data,
            // OR if it has no spatial data at all (show it, let other filters decide)
            metrics.set(countryKey, {
                spatial: unionMetricRanges(categoryFilteredRecords, 'spatial'),
                planimetric: unionMetricRanges(categoryFilteredRecords, 'planimetric'),
                altimetric: unionMetricRanges(categoryFilteredRecords, 'altimetric'),
                year: unionMetricRanges(categoryFilteredRecords, 'year'),
                records: categoryFilteredRecords,
                classifications,
                dataCategories: new Set(categoryFilteredRecords.flatMap((record) =>
                    Array.from((record && record.dataCategories) || [])
                )),
                hasClassification,
                hasActiveRecords: categoryFilteredRecords.length > 0
            });
        });

        const spatialPool = [];
        const planimetricPool = [];
        const altimetricPool = [];
        const yearPool = [];
        metrics.forEach((item) => {
            if (Number.isFinite(item.spatial.min)) spatialPool.push(item.spatial.min, item.spatial.max);
            if (Number.isFinite(item.planimetric.min)) planimetricPool.push(item.planimetric.min, item.planimetric.max);
            if (Number.isFinite(item.altimetric.min)) altimetricPool.push(item.altimetric.min, item.altimetric.max);
            if (Number.isFinite(item.year.min)) yearPool.push(item.year.min, item.year.max);
        });

        mapFilterBounds.spatial = spatialPool.length
            ? { min: 0, max: Math.ceil(Math.max(...spatialPool) * 2) / 2, ready: true }
            : { min: 0, max: 100, ready: false };
        mapFilterBounds.planimetric = planimetricPool.length
            ? { min: 0, max: Number(Math.max(...planimetricPool).toFixed(2)), ready: true }
            : { min: 0, max: 1, ready: false };
        mapFilterBounds.altimetric = altimetricPool.length
            ? { min: 0, max: Number(Math.max(...altimetricPool).toFixed(2)), ready: true }
            : { min: 0, max: 1, ready: false };
        mapFilterBounds.year = yearPool.length
            ? { min: Math.min(...yearPool), max: Math.max(...yearPool), ready: true }
            : { min: 2000, max: 2026, ready: false };

        const spatialRange = clampFilterRange(mapFilterState.spatialMin, mapFilterState.spatialMax, mapFilterBounds.spatial);
        mapFilterState.spatialMin = spatialRange.min;
        mapFilterState.spatialMax = spatialRange.max;
        const planimetricRange = clampFilterRange(mapFilterState.planimetricMin, mapFilterState.planimetricMax, mapFilterBounds.planimetric);
        mapFilterState.planimetricMin = planimetricRange.min;
        mapFilterState.planimetricMax = planimetricRange.max;
        const altimetricRange = clampFilterRange(mapFilterState.altimetricMin, mapFilterState.altimetricMax, mapFilterBounds.altimetric);
        mapFilterState.altimetricMin = altimetricRange.min;
        mapFilterState.altimetricMax = altimetricRange.max;
        const yearRange = clampFilterRange(mapFilterState.yearMin, mapFilterState.yearMax, mapFilterBounds.year);
        mapFilterState.yearMin = yearRange.min;
        mapFilterState.yearMax = yearRange.max;

        availableClassificationFilterOptions = new Set(availableFilterTags);
        if (hasAnyClassificationInfo) availableClassificationFilterOptions.add('has');
        countryFilterMetrics = metrics;
        return metrics;
    }

    function isFilterActive() {
        const eps = 1e-9;
        if (mapFilterState.classifications && mapFilterState.classifications.size > 0) return true;
        if (
            userHasAdjustedMapFilters &&
            mapFilterState.datasetTypes &&
            (
                mapFilterState.datasetTypes.size !== 1 ||
                !mapFilterState.datasetTypes.has('national')
            )
        ) return true;
        const defaultDataCategories = ['Pointcloud', 'DEM', 'No Info'];
        if (
            !mapFilterState.dataCategories ||
            mapFilterState.dataCategories.size !== defaultDataCategories.length ||
            defaultDataCategories.some((category) => !mapFilterState.dataCategories.has(category))
        ) return true;
        if (activeRangeFilters.spatial && mapFilterBounds.spatial.ready) {
            if (Math.abs(mapFilterState.spatialMin - mapFilterBounds.spatial.min) > eps) return true;
            if (Math.abs(mapFilterState.spatialMax - mapFilterBounds.spatial.max) > eps) return true;
        }
        if (activeRangeFilters.planimetric && mapFilterBounds.planimetric.ready) {
            if (Math.abs(mapFilterState.planimetricMin - mapFilterBounds.planimetric.min) > eps) return true;
            if (Math.abs(mapFilterState.planimetricMax - mapFilterBounds.planimetric.max) > eps) return true;
        }
        if (activeRangeFilters.altimetric && mapFilterBounds.altimetric.ready) {
            if (Math.abs(mapFilterState.altimetricMin - mapFilterBounds.altimetric.min) > eps) return true;
            if (Math.abs(mapFilterState.altimetricMax - mapFilterBounds.altimetric.max) > eps) return true;
        }
        if (activeRangeFilters.year && mapFilterBounds.year.ready) {
            if (Math.abs(mapFilterState.yearMin - mapFilterBounds.year.min) > eps) return true;
            if (Math.abs(mapFilterState.yearMax - mapFilterBounds.year.max) > eps) return true;
        }
        return false;
    }

    function shouldApplyDatasetTypeFilter() {
        return !!userHasAdjustedMapFilters;
    }

    function rangeOverlaps(metricRange, selectedMin, selectedMax, includeMissing) {
        if (!Number.isFinite(selectedMin) || !Number.isFinite(selectedMax)) return true;
        // No density data for this country/region → pass through (don't filter it out)
        if (!metricRange || !Number.isFinite(metricRange.min) || !Number.isFinite(metricRange.max)) return !!includeMissing;
        return metricRange.max >= selectedMin && metricRange.min <= selectedMax;
    }

    function countryPassesMapFilters(feature) {
        if (!feature || !feature.properties || !feature.properties.Name) return false;
        if (!isFilterActive()) return true;
        const key = normalizeCountryKey(feature.properties.Name);
        const metrics = countryFilterMetrics.get(key);
        if (!metrics) return false;
        if (!metrics.hasActiveRecords) return false;
        const activeRecords = Array.isArray(metrics.records) ? metrics.records : [];
        return activeRecords.some((record) => recordPassesCurrentMapFilters(record));
    }

    function recordPassesCurrentMapFilters(record) {
        if (!record) return false;
        if (shouldApplyDatasetTypeFilter() && (!mapFilterState.datasetTypes || !mapFilterState.datasetTypes.has(record.datasetType || 'national'))) return false;
        if (!mapFilterState.dataCategories || !mapFilterState.dataCategories.size) return false;
        const categoryMatch = Array.from(mapFilterState.dataCategories).some((category) =>
            ((record && record.dataCategories) || new Set()).has(category)
        );
        if (!categoryMatch) return false;
        if (activeRangeFilters.spatial && !rangeOverlaps(record.spatial, mapFilterState.spatialMin, mapFilterState.spatialMax, mapFilterState.includeMissingSpatial)) return false;
        if (activeRangeFilters.planimetric && !rangeOverlaps(record.planimetric, mapFilterState.planimetricMin, mapFilterState.planimetricMax, mapFilterState.includeMissingAccuracy)) return false;
        if (activeRangeFilters.altimetric && !rangeOverlaps(record.altimetric, mapFilterState.altimetricMin, mapFilterState.altimetricMax, mapFilterState.includeMissingAccuracy)) return false;
        if (activeRangeFilters.year && !rangeOverlaps(record.year, mapFilterState.yearMin, mapFilterState.yearMax, mapFilterState.includeMissingYear)) return false;
        if (mapFilterState.classifications && mapFilterState.classifications.size > 0) {
            const matches = Array.from(mapFilterState.classifications).some((selectedClass) => {
                if (selectedClass === 'has') return !!(record.classifications && record.classifications.size);
                return !!(record.classifications && record.classifications.has(selectedClass));
            });
            if (!matches) return false;
        }
        return true;
    }

    // Filters sub-regions inside a selected country — skips the datasetType scope check
    // (national/regional/city) because that's an overview-level concept and should not hide
    // sub-regions that happen to have ADM > 0.
    // Used when filtering sub-regions inside a selected country — the scope filter
    // (national/regional/city) is an overview-level concept and should not hide
    // sub-regions that happen to have ADM > 0.
    function subRegionPassesRangeFilters(feature) {
        if (!feature || !feature.properties) return false;
        return extractFilterRecordsFromProps(feature.properties).some((record) => recordPassesCurrentMapFilters(record));
    }

    function getBestMatchingCountryDatasetIndex(regionCollection, countryFeature) {
        if (!regionCollection || !Array.isArray(regionCollection.features) || !countryFeature || !countryFeature.properties) return undefined;
        const scopePriority = { national: 3, regional: 2, city: 1 };
        const fieldsToScope = [
            'National', 'Urban', 'Planimetric', 'Altimetric', 'Year', 'year', 'Year_end', 'year_end',
            'Year_start', 'year_start', 'Data', 'DataDisplay', 'RawDataTypes', 'Info'
        ];
        const candidates = [];

        regionCollection.features.forEach((feature) => {
            const props = (feature && feature.properties) || {};
            const datasetNames = getDatasetNamesFromFeatureProperties(props);
            if (!datasetNames.length) return;

            datasetNames.forEach((datasetName, seriesIndex) => {
                const scopedProps = { ...props };
                fieldsToScope.forEach((fieldName) => {
                    if (!Object.prototype.hasOwnProperty.call(scopedProps, fieldName)) return;
                    scopedProps[fieldName] = valueAtRepresentativeIndex(scopedProps[fieldName], seriesIndex);
                });
                scopedProps.Dataset_name = datasetName;
                scopedProps.dataset_name = datasetName;
                scopedProps['Data Name'] = datasetName;
                const record = extractFilterRecordFromProps(scopedProps);
                if (!recordPassesCurrentMapFilters(record)) return;
                const datasetIndex = getCountryDatasetIndexForDatasetName(datasetName);
                if (!Number.isInteger(datasetIndex) || datasetIndex < 0) return;
                candidates.push({
                    datasetIndex,
                    datasetName,
                    datasetType: record.datasetType || 'national',
                    yearScore: Number.isFinite(record.representativeYearScore) ? record.representativeYearScore : Number.NEGATIVE_INFINITY
                });
            });
        });

        if (!candidates.length) return undefined;

        candidates.sort((a, b) => {
            const scopeDelta = (scopePriority[b.datasetType] || 0) - (scopePriority[a.datasetType] || 0);
            if (scopeDelta !== 0) return scopeDelta;
            if (b.yearScore !== a.yearScore) return b.yearScore - a.yearScore;
            return a.datasetIndex - b.datasetIndex;
        });
        return candidates[0].datasetIndex;
    }

    function getFilteredCountryNamesLowercase() {
        if (!countriesData || !Array.isArray(countriesData.features)) return [];
        return countriesData.features
            .filter((f) => f && f.properties && f.properties.Name && !f.properties.RegionName)
            .filter((f) => countryPassesMapFilters(f))
            .map((f) => String(f.properties.Name).toLowerCase());
    }

    function loadCountryFilterMetrics() {
        if (countryFilterMetricsPromise) return countryFilterMetricsPromise;

        const addFeatureToBuckets = (feature, buckets, parentCountryOverride) => {
            const props = feature.properties || {};
            const isRegionSummaryCountry = !parentCountryOverride
                && !props.ParentCountry
                && Number(props.ADM) === 0
                && normalizeCat(props.Data) === 'Region';
            if (isRegionSummaryCountry) return;
            const countryName = String(parentCountryOverride || props.ParentCountry || props.main_country || props.Name || props.country || '').trim();
            if (!countryName) return;
            const countryKey = normalizeCountryKey(countryName);
            if (!countryKey) return;
            if (!buckets.has(countryKey)) buckets.set(countryKey, { standard: [], research: [] });
            buckets.get(countryKey).standard.push(...extractFilterRecordsFromProps(props));
        };

        countryFilterMetricsPromise = Promise.resolve().then(() => {
            const buckets = new Map();
            const source = (overviewMapData || countriesData);
            if (!source || !Array.isArray(source.features)) {
                countryFilterMetricBuckets = buckets;
                rebuildCountryFilterMetrics();
                return countryFilterMetrics;
            }

            // Add all features from the overview map (includes regional replacements for Data="Region" countries)
            source.features.forEach((f) => addFeatureToBuckets(f, buckets));

            // Fetch every country's child features so national/regional/research scope filters
            // can be evaluated at country level in the overview.
            const filterMetricCountries = (countriesData.features || []).filter(
                (f) => f.properties && f.properties.Name && !f.properties.RegionName
            );

            const newFilterRegionFeatures = [];
            const newRegionFilterMetrics = new Map();

            // Add Data="Region" countries' sub-features from overviewMapData (e.g. Belgium → Vlaanderen/Wallonia)
            source.features.forEach((f) => {
                const props = f.properties || {};
                const parentCountry = String(props.ParentCountry || '').trim();
                if (!parentCountry) return; // skip country-level features
                const parentKey = normalizeCountryKey(parentCountry);
                const metricKey = getFeatureFilterMetricKey(props, parentKey);
                if (!metricKey) return;
                const records = extractFilterRecordsFromProps(props);
                if (!newRegionFilterMetrics.has(metricKey)) {
                    newRegionFilterMetrics.set(metricKey, { records, parentCountryKey: parentKey });
                    newFilterRegionFeatures.push({
                        ...f,
                        properties: { ...props, _filterRegion: true, FilterMetricKey: metricKey }
                    });
                }
            });

            const regionFetches = filterMetricCountries.map((f) => {
                const countryName = f.properties.Name;
                const countryKey = normalizeCountryKey(countryName);
                return fetchCountryRegions(countryName)
                    .then((rd) => {
                        if (!rd || !Array.isArray(rd.features)) return;
                        rd.features.forEach((rf) => {
                            if (isCountrySummaryFeatureForCountry(rf, countryName)) return; // skip country-level feature
                            // Add to country buckets (so country passes filter if any region qualifies)
                            addFeatureToBuckets(rf, buckets, countryName);
                            // Store individual region metrics and features for precise per-region filtering
                            const records = extractFilterRecordsFromProps(rf.properties || {});
                            const metricKey = getFeatureFilterMetricKey(rf.properties || {}, countryKey);
                            if (!metricKey) return;
                            newRegionFilterMetrics.set(metricKey, { records, parentCountryKey: countryKey });
                            newFilterRegionFeatures.push({
                                ...rf,
                                properties: {
                                    ...(rf.properties || {}),
                                    ParentCountry: countryName,
                                    _filterRegion: true,
                                    FilterMetricKey: metricKey
                                }
                            });
                        });
                    })
                    .catch(() => {});
            });

            return Promise.all(regionFetches).then(() => {
                regionFilterMetrics = newRegionFilterMetrics;
                filterRegionFeatures = newFilterRegionFeatures;
                countryFilterMetricBuckets = buckets;
                renderDataCache.clear();
                rebuildCountryFilterMetrics();
                // Update filter-regions source if map is already loaded
                const mapRef = getMapInstance();
                if (mapRef && mapRef.getSource('filter-regions')) {
                    currentFilterRegionRenderLevel = '';
                    syncAdaptiveMapRendering(true);
                    applyCategoryFilterToMap();
                }
                // Re-render research markers now that Point features are available
                renderResearchMarkers();
                return countryFilterMetrics;
            });
        });
        return countryFilterMetricsPromise;
    }

    function buildOverviewMapData() {
        const baseCountries = countriesData.features.filter(f => f.properties.Name && !f.properties.RegionName);
        const merged = [];
        baseCountries.forEach((country) => {
            const countryName = country.properties.Name;
            const countryKey = normalizeCountryKey(countryName);
            const collection = unifiedCountryCollections.get(countryKey);
            const childFeatures = (collection && Array.isArray(collection.features) ? collection.features : [])
                .filter((feature) => {
                    if (!feature || !feature.geometry || !feature.properties) return false;
                    if (isCountrySummaryFeatureForCountry(feature, countryName)) return false;
                    return true;
                });
            const regionalFeatures = childFeatures
                .filter((feature) => {
                    if (feature.properties.ADM_lookup) return false;
                    return feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon';
                })
                .map((feature) => ({
                    ...(feature || {}),
                    type: 'Feature',
                    properties: {
                        ...(feature.properties || {}),
                        RawDataTypes: (feature.properties || {}).RawDataTypes || (feature.properties || {}).Data || 'No Info',
                        DataDisplay: (feature.properties || {}).DataDisplay || getDisplayDataType((feature.properties || {}).Data || 'No Info'),
                        Data: normalizeCat((feature.properties || {}).Data || 'No Info'),
                        ParentCountry: countryName,
                        OverviewScope: 'regional',
                        FilterMetricKey: getFeatureFilterMetricKey(feature.properties || {}, countryKey),
                        infoStatus: 'regionchild'
                    },
                    geometry: feature.geometry
                }))
                .map((feature) => {
                    setFeatureCategorySupport(feature.properties);
                    return feature;
                });

            const childCategories = childFeatures
                .filter((feature) => !feature.properties.ADM_lookup)
                .flatMap((feature) => getFeatureAvailableCategories(feature.properties));
            setFeatureCategorySupport(country.properties, childCategories);
            if (normalizeCat(country.properties.Data) === 'Region' && regionalFeatures.length) {
                merged.push(...regionalFeatures);
            } else {
                country.properties.OverviewScope = 'national';
                merged.push(country);
            }
        });
        overviewMapData = { type: 'FeatureCollection', features: merged };
        return Promise.resolve();
    }

    function overviewReset(keepView) { 
        activeCategory = null; 
        activeLegendCategories.clear();
        clearSelectedRegionHighlight();
        selectedCountryFeature = null; 
        autoDrilldownCountryFeature = null;
        regionDrilldownVisible = false;
        clearDatasetRegionSelection();
        regionsData = null; 
        document.getElementById('tocSearch').value = ''; 
        document.querySelectorAll('.legend-btn').forEach(b => b.classList.remove('active')); 
        syncLegendSelectionVisuals();
        showCountryTOC(); 
        const mapRef = window.map;
        if (mapRef) { 
            if (mapRef.getLayer('country-fill')) mapRef.setLayoutProperty('country-fill', 'visibility', 'visible'); 
            if (mapRef.getLayer('country-border')) mapRef.setLayoutProperty('country-border', 'visibility', 'visible'); 
            hideRegionsOnMap();
            syncLegendSelectionVisuals();
            if (!keepView) {
            mapRef.easeTo({ center: [5, 50], zoom: 5, pitch: 0, bearing: 0, duration: 1000 }); 
            }
            mapRef.setMinZoom(2); 
            currentRegionRenderLevel = '';
        } 
        sidebar.style.display = 'none'; // Sidebar sluiten bij reset 
        if (infoTitleEl) infoTitleEl.textContent = 'Select a country.'; 
        infoBox.innerHTML = 'Select a country.'; 
        if (document.getElementById('infoPanel')) { 
            document.getElementById('infoPanel').style.display = 'none'; 
        } 
        renderCountriesList(); 
        syncLegendSelectionVisuals();
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
    const mobileContactToggle = document.getElementById('mobileContactToggle');
    const mobileFilterBtn = document.getElementById('mobileFilterBtn');
    const filterDockToggle = document.getElementById('filterDockToggle');
    const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const mobileSearchHint = document.getElementById('mobileSearchHint');
    const contactToggle = document.getElementById('tab-contact');
    const contactDrawer = document.getElementById('contactDrawer');
    const contactDrawerOverlay = document.getElementById('contactDrawerOverlay');
    const contactDrawerClose = document.getElementById('contactDrawerClose');
    const tabSearch = document.getElementById('tab-search');
    const tabFilter = document.getElementById('tab-filter');
    const filterMenu = document.getElementById('filterMenu');
    const filterCloseBtn = document.getElementById('filterCloseBtn');
    const filterResetBtn = document.getElementById('filterResetBtn');
    const filterClassificationToggle = document.getElementById('filterClassificationToggle');
    const filterClassificationMenu = document.getElementById('filterClassificationMenu');
    const filterClassificationChecks = filterClassificationMenu
        ? Array.from(filterClassificationMenu.querySelectorAll('input[type="checkbox"]'))
        : [];
    const filterDataTypeChecks = filterMenu
        ? Array.from(filterMenu.querySelectorAll('.filter-data-types input[type="checkbox"]'))
        : [];
    const filterTypeChecks = filterMenu
        ? Array.from(filterMenu.querySelectorAll('.filter-acquisition-types input[type="checkbox"]'))
        : [];
    const filterSpatialMin = document.getElementById('filterSpatialMin');
    const filterSpatialMax = document.getElementById('filterSpatialMax');
    const filterPlanimetricMin = document.getElementById('filterPlanimetricMin');
    const filterPlanimetricMax = document.getElementById('filterPlanimetricMax');
    const filterAltimetricMin = document.getElementById('filterAltimetricMin');
    const filterAltimetricMax = document.getElementById('filterAltimetricMax');
    const filterYearMin = document.getElementById('filterYearMin');
    const filterYearMax = document.getElementById('filterYearMax');
    const filterSpatialIncludeMissing = document.getElementById('filterSpatialIncludeMissing');
    const filterAccuracyIncludeMissing = document.getElementById('filterAccuracyIncludeMissing');
    const filterYearIncludeMissing = document.getElementById('filterYearIncludeMissing');
    const filterSpatialRangeValue = document.getElementById('filterSpatialRangeValue');
    const filterPlanimetricRangeValue = document.getElementById('filterPlanimetricRangeValue');
    const filterAltimetricRangeValue = document.getElementById('filterAltimetricRangeValue');
    const filterYearRangeValue = document.getElementById('filterYearRangeValue');
    const filterSpatialTrack = document.getElementById('filterSpatialTrack');
    const filterPlanimetricTrack = document.getElementById('filterPlanimetricTrack');
    const filterAltimetricTrack = document.getElementById('filterAltimetricTrack');
    const filterYearTrack = document.getElementById('filterYearTrack');
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
            const shouldRestoreFilter = restoreFilterMenuAfterSidebarClose;
            restoreFilterMenuAfterSidebarClose = false;
            overviewReset();
            if (shouldRestoreFilter) openFilterMenu();
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
            clearFilterRestoreOnNavigation();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'index.html';
            }
        });
    }
    if (document.body.classList.contains('map-page') && tocSearch) {
        tocSearch.addEventListener('input', renderCountriesList);
    }
    if (tocSearch) {
        tocSearch.addEventListener('input', () => updateSearchSuggestions(tocSearch.value));
        tocSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const result = searchAndSelectCountry(tocSearch.value);
                if (result.ok) closeSearch();
            }
        });
    }
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
        const tabTitle = document.getElementById('tab-title');
        if (tabTitle) tabTitle.classList.remove('hidden');
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
    const closeContactDrawer = () => {
        if (!contactDrawer || !contactDrawerOverlay) return;
        contactDrawer.classList.remove('open');
        contactDrawerOverlay.classList.remove('open');
        contactDrawer.setAttribute('aria-hidden', 'true');
        contactDrawerOverlay.setAttribute('aria-hidden', 'true');
        if (contactToggle) contactToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('contact-drawer-open');
    };
    const openContactDrawer = () => {
        if (!contactDrawer || !contactDrawerOverlay) return;
        closeSearch();
        if (mobileMenu) mobileMenu.classList.remove('open');
        contactDrawer.classList.add('open');
        contactDrawerOverlay.classList.add('open');
        contactDrawer.setAttribute('aria-hidden', 'false');
        contactDrawerOverlay.setAttribute('aria-hidden', 'false');
        if (contactToggle) contactToggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('contact-drawer-open');
    };

    const updateTrackFill = (minInput, maxInput, trackEl) => {
        if (!minInput || !maxInput || !trackEl) return;
        const minBound = Number(minInput.min);
        const maxBound = Number(minInput.max);
        const minValue = Number(minInput.value);
        const maxValue = Number(maxInput.value);
        const leftPct = ((minValue - minBound) / (maxBound - minBound)) * 100;
        const rightPct = ((maxValue - minBound) / (maxBound - minBound)) * 100;
        trackEl.style.left = `${Math.max(0, Math.min(100, leftPct))}%`;
        trackEl.style.right = `${Math.max(0, Math.min(100, 100 - rightPct))}%`;
        // When both thumbs overlap (especially at max), raise min above max so it remains grabbable
        minInput.style.zIndex = (minValue >= maxValue) ? '2' : '';
    };

    const updateClassificationLabel = () => {
        if (!filterClassificationToggle) return;
        const selected = mapFilterState.classifications ? Array.from(mapFilterState.classifications) : [];
        if (!selected.length) {
            filterClassificationToggle.textContent = 'Any classification';
            return;
        }
        const labels = {
            has: 'Has classification info',
            ground: 'Ground',
            vegetation: 'Vegetation',
            building: 'Building',
            water: 'Water'
        };
        if (selected.length <= 2) {
            filterClassificationToggle.textContent = selected.map((key) => labels[key] || key).join(', ');
            return;
        }
        filterClassificationToggle.textContent = `${selected.length} classes selected`;
    };

    const refreshClassificationFilterMenu = () => {
        if (!filterClassificationChecks.length) return;
        filterClassificationChecks.forEach((check) => {
            const wrapper = check.closest('label');
            const isAvailable = availableClassificationFilterOptions.has(check.value);
            if (wrapper) wrapper.style.display = isAvailable ? '' : 'none';
            if (!isAvailable) {
                check.checked = false;
                mapFilterState.classifications.delete(check.value);
            }
        });
        updateClassificationLabel();
    };

    const formatRangeValue = (value) => {
        if (!Number.isFinite(value)) return '-';
        if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
        return Number(value.toFixed(2)).toString();
    };

    const updateRangeValueLabels = () => {
        const spatialMinLabelValue = Number.isFinite(mapFilterState.spatialMin) ? mapFilterState.spatialMin : mapFilterBounds.spatial.min;
        const spatialMaxLabelValue = Number.isFinite(mapFilterState.spatialMax) ? mapFilterState.spatialMax : mapFilterBounds.spatial.max;
        if (filterSpatialRangeValue && Number.isFinite(spatialMinLabelValue) && Number.isFinite(spatialMaxLabelValue)) {
            filterSpatialRangeValue.textContent = `${formatRangeValue(spatialMinLabelValue)} to ${formatRangeValue(spatialMaxLabelValue)}`;
        }
        const planimetricMinLabelValue = Number.isFinite(mapFilterState.planimetricMin) ? mapFilterState.planimetricMin : mapFilterBounds.planimetric.min;
        const planimetricMaxLabelValue = Number.isFinite(mapFilterState.planimetricMax) ? mapFilterState.planimetricMax : mapFilterBounds.planimetric.max;
        if (filterPlanimetricRangeValue && Number.isFinite(planimetricMinLabelValue) && Number.isFinite(planimetricMaxLabelValue)) {
            filterPlanimetricRangeValue.textContent = `${formatRangeValue(planimetricMinLabelValue)} to ${formatRangeValue(planimetricMaxLabelValue)}`;
        }
        const altimetricMinLabelValue = Number.isFinite(mapFilterState.altimetricMin) ? mapFilterState.altimetricMin : mapFilterBounds.altimetric.min;
        const altimetricMaxLabelValue = Number.isFinite(mapFilterState.altimetricMax) ? mapFilterState.altimetricMax : mapFilterBounds.altimetric.max;
        if (filterAltimetricRangeValue && Number.isFinite(altimetricMinLabelValue) && Number.isFinite(altimetricMaxLabelValue)) {
            filterAltimetricRangeValue.textContent = `${formatRangeValue(altimetricMinLabelValue)} to ${formatRangeValue(altimetricMaxLabelValue)}`;
        }
        const yearMinLabelValue = Number.isFinite(mapFilterState.yearMin) ? mapFilterState.yearMin : mapFilterBounds.year.min;
        const yearMaxLabelValue = Number.isFinite(mapFilterState.yearMax) ? mapFilterState.yearMax : mapFilterBounds.year.max;
        if (filterYearRangeValue && Number.isFinite(yearMinLabelValue) && Number.isFinite(yearMaxLabelValue)) {
            filterYearRangeValue.textContent = `${formatRangeValue(yearMinLabelValue)} to ${formatRangeValue(yearMaxLabelValue)}`;
        }
        updateTrackFill(filterSpatialMin, filterSpatialMax, filterSpatialTrack);
        updateTrackFill(filterPlanimetricMin, filterPlanimetricMax, filterPlanimetricTrack);
        updateTrackFill(filterAltimetricMin, filterAltimetricMax, filterAltimetricTrack);
        updateTrackFill(filterYearMin, filterYearMax, filterYearTrack);
    };

    const syncFilterControlsFromState = () => {
        if (filterSpatialMin && mapFilterBounds.spatial.ready) {
            filterSpatialMin.min = String(mapFilterBounds.spatial.min);
            filterSpatialMin.max = String(mapFilterBounds.spatial.max);
            filterSpatialMin.value = String(mapFilterState.spatialMin);
        }
        if (filterSpatialMax && mapFilterBounds.spatial.ready) {
            filterSpatialMax.min = String(mapFilterBounds.spatial.min);
            filterSpatialMax.max = String(mapFilterBounds.spatial.max);
            filterSpatialMax.value = String(mapFilterState.spatialMax);
        }
        if (filterPlanimetricMin && mapFilterBounds.planimetric.ready) {
            filterPlanimetricMin.min = String(mapFilterBounds.planimetric.min);
            filterPlanimetricMin.max = String(mapFilterBounds.planimetric.max);
            filterPlanimetricMin.value = String(mapFilterState.planimetricMin);
        }
        if (filterPlanimetricMax && mapFilterBounds.planimetric.ready) {
            filterPlanimetricMax.min = String(mapFilterBounds.planimetric.min);
            filterPlanimetricMax.max = String(mapFilterBounds.planimetric.max);
            filterPlanimetricMax.value = String(mapFilterState.planimetricMax);
        }
        if (filterAltimetricMin && mapFilterBounds.altimetric.ready) {
            filterAltimetricMin.min = String(mapFilterBounds.altimetric.min);
            filterAltimetricMin.max = String(mapFilterBounds.altimetric.max);
            filterAltimetricMin.value = String(mapFilterState.altimetricMin);
        }
        if (filterAltimetricMax && mapFilterBounds.altimetric.ready) {
            filterAltimetricMax.min = String(mapFilterBounds.altimetric.min);
            filterAltimetricMax.max = String(mapFilterBounds.altimetric.max);
            filterAltimetricMax.value = String(mapFilterState.altimetricMax);
        }
        if (filterYearMin && mapFilterBounds.year.ready) {
            filterYearMin.min = String(mapFilterBounds.year.min);
            filterYearMin.max = String(mapFilterBounds.year.max);
            filterYearMin.value = String(mapFilterState.yearMin);
        }
        if (filterYearMax && mapFilterBounds.year.ready) {
            filterYearMax.min = String(mapFilterBounds.year.min);
            filterYearMax.max = String(mapFilterBounds.year.max);
            filterYearMax.value = String(mapFilterState.yearMax);
        }
        if (filterClassificationChecks.length) {
            filterClassificationChecks.forEach((check) => {
                check.checked = mapFilterState.classifications.has(check.value);
            });
        }
        if (filterSpatialIncludeMissing) {
            filterSpatialIncludeMissing.checked = !!mapFilterState.includeMissingSpatial;
        }
        if (filterAccuracyIncludeMissing) {
            filterAccuracyIncludeMissing.checked = !!mapFilterState.includeMissingAccuracy;
        }
        if (filterYearIncludeMissing) {
            filterYearIncludeMissing.checked = !!mapFilterState.includeMissingYear;
        }
        if (filterDataTypeChecks.length) {
            filterDataTypeChecks.forEach((check) => {
                check.checked = mapFilterState.dataCategories.has(check.value);
            });
        }
        if (filterTypeChecks.length) {
            filterTypeChecks.forEach((check) => {
                check.checked = mapFilterState.datasetTypes.has(check.value);
            });
        }
        refreshClassificationFilterMenu();
        updateClassificationLabel();
        updateRangeValueLabels();
    };

    const normalizeRangeInputs = (minInput, maxInput) => {
        if (!minInput || !maxInput) return;
        const minV = Number(minInput.value);
        const maxV = Number(maxInput.value);
        if (minV > maxV) {
            if (document.activeElement === minInput) {
                maxInput.value = minInput.value;
            } else {
                minInput.value = maxInput.value;
            }
        }
    };

    const positionFilterMenu = () => {
        if (!filterMenu) return;
        if (filterMenu.classList.contains('filter-dock')) return;
        if (!tabFilter) return;
        const rect = tabFilter.getBoundingClientRect();
        filterMenu.style.left = `${Math.max(10, rect.left + window.scrollX - 220)}px`;
        filterMenu.style.top = `${rect.bottom + window.scrollY + 2}px`;
    };

    const openFilterMenu = () => {
        if (!filterMenu) return;
        closeSearch();
        syncFilterControlsFromState();
        positionFilterMenu();
        if (filterMenu.classList.contains('filter-dock')) {
            filterMenu.classList.add('open');
            filterMenu.style.display = '';
        } else {
            filterMenu.style.display = 'block';
        }
        filterMenu.setAttribute('aria-hidden', 'false');
        if (tabFilter) {
            tabFilter.classList.add('active');
            tabFilter.setAttribute('aria-expanded', 'true');
        }
        if (filterDockToggle) {
            filterDockToggle.classList.add('hidden');
            filterDockToggle.setAttribute('aria-expanded', 'true');
        }
    };

    const closeFilterMenu = () => {
        if (!filterMenu) return;
        if (filterMenu.classList.contains('filter-dock')) {
            filterMenu.classList.remove('open');
            filterMenu.style.display = '';
        } else {
            filterMenu.style.display = 'none';
        }
        filterMenu.setAttribute('aria-hidden', 'true');
        if (tabFilter) {
            tabFilter.classList.remove('active');
            tabFilter.setAttribute('aria-expanded', 'false');
        }
        if (filterDockToggle) {
            filterDockToggle.classList.remove('hidden');
            filterDockToggle.setAttribute('aria-expanded', 'false');
        }
        if (filterClassificationMenu) {
            filterClassificationMenu.classList.remove('open');
        }
        if (filterClassificationToggle) {
            filterClassificationToggle.setAttribute('aria-expanded', 'false');
        }
    };
    const isFilterMenuOpen = () => !!(filterMenu && (
        filterMenu.style.display === 'block' ||
        filterMenu.classList.contains('open') ||
        filterMenu.getAttribute('aria-hidden') === 'false'
    ));
    const clearFilterRestoreOnNavigation = () => {
        restoreFilterMenuAfterSidebarClose = false;
    };

    const resetMapFiltersState = ({ closeMenuAfter = false, applyAfter = true } = {}) => {
        if (mapFilterBounds.spatial.ready) {
            mapFilterState.spatialMin = mapFilterBounds.spatial.min;
            mapFilterState.spatialMax = mapFilterBounds.spatial.max;
        }
        if (mapFilterBounds.planimetric.ready) {
            mapFilterState.planimetricMin = mapFilterBounds.planimetric.min;
            mapFilterState.planimetricMax = mapFilterBounds.planimetric.max;
        }
        if (mapFilterBounds.altimetric.ready) {
            mapFilterState.altimetricMin = mapFilterBounds.altimetric.min;
            mapFilterState.altimetricMax = mapFilterBounds.altimetric.max;
        }
        if (mapFilterBounds.year.ready) {
            mapFilterState.yearMin = mapFilterBounds.year.min;
            mapFilterState.yearMax = mapFilterBounds.year.max;
        }
        mapFilterState.includeMissingSpatial = false;
        mapFilterState.includeMissingAccuracy = false;
        mapFilterState.includeMissingYear = false;
        activeRangeFilters.spatial = false;
        activeRangeFilters.planimetric = false;
        activeRangeFilters.altimetric = false;
        activeRangeFilters.year = false;
        mapFilterState.classifications = new Set();
        mapFilterState.dataCategories = new Set(['Pointcloud', 'DEM', 'No Info']);
        mapFilterState.datasetTypes = new Set(['national']);
        userHasAdjustedMapFilters = false;
        rebuildCountryFilterMetrics();
        syncFilterControlsFromState();
        if (closeMenuAfter) closeFilterMenu();
        if (applyAfter) applyMapFilters();
    };

    const applyMapFilters = () => {
        if (typeof renderCountriesList === 'function') renderCountriesList();
        if (typeof applyCategoryFilterToMap === 'function') applyCategoryFilterToMap();
        if (selectedCountryFeature && regionsData && typeof showRegionsOnMap === 'function') {
            showRegionsOnMap(regionsData);
        }
        if (typeof syncLegendSelectionVisuals === 'function') syncLegendSelectionVisuals();
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
    if (contactToggle) {
        contactToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (contactDrawer && contactDrawer.classList.contains('open')) closeContactDrawer();
            else openContactDrawer();
        });
    }
    if (mobileContactToggle) {
        mobileContactToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openContactDrawer();
        });
    }
    if (contactDrawerClose) {
        contactDrawerClose.addEventListener('click', (e) => {
            e.preventDefault();
            closeContactDrawer();
        });
    }
    if (contactDrawerOverlay) {
        contactDrawerOverlay.addEventListener('click', closeContactDrawer);
    }
    if (mobileFilterBtn) {
        mobileFilterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (mobileMenu) mobileMenu.classList.remove('open');
            openFilterMenu();
        });
    }
    if (filterClassificationToggle && filterClassificationMenu) {
        const positionClassificationMenu = () => {
            const dropdown = filterClassificationToggle.closest('.class-dropdown');
            const firstGroup = filterMenu ? filterMenu.querySelector('.filter-group') : null;
            if (!dropdown || !firstGroup) return;
            const offset = dropdown.offsetTop - firstGroup.offsetTop;
            filterClassificationMenu.style.top = `${-Math.max(0, offset)}px`;
        };
        filterClassificationToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const open = filterClassificationMenu.classList.contains('open');
            if (!open) positionClassificationMenu();
            filterClassificationMenu.classList.toggle('open', !open);
            filterClassificationToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        });
        window.addEventListener('resize', () => {
            if (filterClassificationMenu.classList.contains('open')) {
                positionClassificationMenu();
            }
        });
    }
    if (filterClassificationChecks.length) {
        filterClassificationChecks.forEach((check) => {
            check.addEventListener('change', () => {
                userHasAdjustedMapFilters = true;
                const selected = filterClassificationChecks
                    .filter((c) => c.checked)
                    .map((c) => c.value);
                mapFilterState.classifications = new Set(selected);
                updateClassificationLabel();
                applyMapFilters();
            });
        });
    }
    const onDataTypeChange = () => {
        userHasAdjustedMapFilters = true;
        mapFilterState.dataCategories = new Set(
            filterDataTypeChecks.filter((c) => c.checked).map((c) => c.value)
        );
        rebuildCountryFilterMetrics();
        syncFilterControlsFromState();
        applyMapFilters();
    };
    filterDataTypeChecks.forEach((check) => check.addEventListener('change', onDataTypeChange));
    // Dataset type checkboxes (National / Regional / City)
    const onDatasetTypeChange = () => {
        userHasAdjustedMapFilters = true;
        mapFilterState.datasetTypes = new Set(
            filterTypeChecks.filter((c) => c.checked).map((c) => c.value)
        );
        rebuildCountryFilterMetrics();
        syncFilterControlsFromState();
        applyMapFilters();
    };
    filterTypeChecks.forEach((check) => check.addEventListener('change', onDatasetTypeChange));
    if (filterDockToggle) {
        filterDockToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openFilterMenu();
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
        if (contactDrawer && contactDrawer.classList.contains('open') &&
            !contactDrawer.contains(e.target) &&
            (!contactToggle || !contactToggle.contains(e.target)) &&
            (!mobileContactToggle || !mobileContactToggle.contains(e.target))) {
            closeContactDrawer();
        }
        const menu = document.getElementById('dataMenu');
        if (menu && menu.style.display === 'block' && !menu.contains(e.target) && (!dataTab || !dataTab.contains(e.target))) {
            menu.style.display = 'none';
        }
        if (filterClassificationMenu && filterClassificationMenu.classList.contains('open') &&
            !filterClassificationMenu.contains(e.target) &&
            (!filterClassificationToggle || !filterClassificationToggle.contains(e.target))) {
            filterClassificationMenu.classList.remove('open');
            if (filterClassificationToggle) filterClassificationToggle.setAttribute('aria-expanded', 'false');
        }
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && contactDrawer && contactDrawer.classList.contains('open')) {
            closeContactDrawer();
        }
    });
    window.addEventListener('resize', () => {
        if (tabSearch && tabSearch.classList.contains('open')) positionSearch(tocSearchToggle);
    });
    loadLocationSearchIndex();
    if (overviewBtn) {
        overviewBtn.onclick = () => {
            clearFilterRestoreOnNavigation();
            overviewReset();
        };
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
        if (!dataMenu) return;
        dataMenuCloseTimer = setTimeout(() => {
            dataMenu.style.display = 'none';
        }, 140);
    };
    const dataMapBtn = document.getElementById('dataMapBtn');
    if (dataMapBtn && dataMenu) {
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
        if (!dataTab || !dataMenu) return;
        const tabsBar = document.getElementById('tabs');
        if (!tabsBar) return;
        const tabRect = dataTab.getBoundingClientRect();
        const bannerRect = tabsBar.getBoundingClientRect();
        dataMenu.style.left = `${tabRect.left + window.scrollX}px`;
        dataMenu.style.top = `${bannerRect.bottom + window.scrollY}px`;
    };
    if (dataTab && dataMenu) {
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
    }
    window.addEventListener('resize', () => {
        updateMobileOverviewChrome();
        if (dataTab && dataMenu && dataMenu.style.display === 'block') positionDataMenu();
        if (filterMenu && filterMenu.style.display === 'block') positionFilterMenu();
    });
    if (tabFilter && filterMenu) {
        tabFilter.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = filterMenu.style.display === 'block';
            if (open) closeFilterMenu();
            else openFilterMenu();
        });
    }
    if (filterCloseBtn) {
        filterCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeFilterMenu();
        });
    }
    if (filterSpatialMin && filterSpatialMax) {
        const onSpatialInput = () => {
            userHasAdjustedMapFilters = true;
            activeRangeFilters.spatial = true;
            normalizeRangeInputs(filterSpatialMin, filterSpatialMax);
            mapFilterState.spatialMin = Number(filterSpatialMin.value);
            mapFilterState.spatialMax = Number(filterSpatialMax.value);
            updateRangeValueLabels();
            applyMapFilters();
        };
        filterSpatialMin.addEventListener('input', onSpatialInput);
        filterSpatialMax.addEventListener('input', onSpatialInput);
    }
    if (filterPlanimetricMin && filterPlanimetricMax) {
        const onPlanimetricInput = () => {
            userHasAdjustedMapFilters = true;
            activeRangeFilters.planimetric = true;
            normalizeRangeInputs(filterPlanimetricMin, filterPlanimetricMax);
            mapFilterState.planimetricMin = Number(filterPlanimetricMin.value);
            mapFilterState.planimetricMax = Number(filterPlanimetricMax.value);
            updateRangeValueLabels();
            applyMapFilters();
        };
        filterPlanimetricMin.addEventListener('input', onPlanimetricInput);
        filterPlanimetricMax.addEventListener('input', onPlanimetricInput);
    }
    if (filterAltimetricMin && filterAltimetricMax) {
        const onAltimetricInput = () => {
            userHasAdjustedMapFilters = true;
            activeRangeFilters.altimetric = true;
            normalizeRangeInputs(filterAltimetricMin, filterAltimetricMax);
            mapFilterState.altimetricMin = Number(filterAltimetricMin.value);
            mapFilterState.altimetricMax = Number(filterAltimetricMax.value);
            updateRangeValueLabels();
            applyMapFilters();
        };
        filterAltimetricMin.addEventListener('input', onAltimetricInput);
        filterAltimetricMax.addEventListener('input', onAltimetricInput);
    }
    if (filterYearMin && filterYearMax) {
        const onYearInput = () => {
            userHasAdjustedMapFilters = true;
            activeRangeFilters.year = true;
            normalizeRangeInputs(filterYearMin, filterYearMax);
            mapFilterState.yearMin = Number(filterYearMin.value);
            mapFilterState.yearMax = Number(filterYearMax.value);
            updateRangeValueLabels();
            applyMapFilters();
        };
        filterYearMin.addEventListener('input', onYearInput);
        filterYearMax.addEventListener('input', onYearInput);
    }
    if (filterSpatialIncludeMissing) {
        filterSpatialIncludeMissing.addEventListener('change', () => {
            userHasAdjustedMapFilters = true;
            activeRangeFilters.spatial = true;
            mapFilterState.includeMissingSpatial = filterSpatialIncludeMissing.checked;
            applyMapFilters();
        });
    }
    if (filterAccuracyIncludeMissing) {
        filterAccuracyIncludeMissing.addEventListener('change', () => {
            userHasAdjustedMapFilters = true;
            activeRangeFilters.planimetric = true;
            activeRangeFilters.altimetric = true;
            mapFilterState.includeMissingAccuracy = filterAccuracyIncludeMissing.checked;
            applyMapFilters();
        });
    }
    if (filterYearIncludeMissing) {
        filterYearIncludeMissing.addEventListener('change', () => {
            userHasAdjustedMapFilters = true;
            activeRangeFilters.year = true;
            mapFilterState.includeMissingYear = filterYearIncludeMissing.checked;
            applyMapFilters();
        });
    }
    if (filterResetBtn) {
        filterResetBtn.addEventListener('click', () => {
            resetMapFiltersState();
        });
    }
    if (filterMenu && filterMenu.classList.contains('filter-dock')) {
        closeFilterMenu();
    }
    updateMobileOverviewChrome();
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
        fetchFirstAvailableText(UNIFIED_MAP_DATA_PATHS)
        .then((text) => JSON.parse(text))
        .then(cd => {
            initializeUnifiedMapData(cd);
            // Rebuild search index from GeoJSON now that it's loaded
            locationSearchIndex = buildSearchIndexFromGeoJSON();
            locationSearchIndexPromise = Promise.resolve(locationSearchIndex);
            return buildOverviewMapData();
        })
        .then(() => {
            renderCategoryButtons(); 
            renderCountriesList(); 
            initMap(); 
            updateTOCList(); 
            showTab('toc'); 
            loadCountryFilterMetrics().then(() => {
                syncFilterControlsFromState();
                applyMapFilters();
            });
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
            btn.type = 'button';
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            legendCatsEl.appendChild(btn); 
        }); 
    } 

    function getDisplayDataType(value) {
        return String(value || '').trim();
    }

    function getPrimaryDataCategory(value) {
        const raw = String(value || '').trim();
        if (!raw) return 'No Info';
        const tokens = raw.split(',').map((token) => token.trim().toLowerCase()).filter(Boolean);
        if (!tokens.length) return 'No Info';
        if (tokens.includes('region')) return 'Region';
        // When a dataset offers both point clouds and DEMs, favor point clouds in overview styling.
        if (tokens.includes('pointcloud') || tokens.includes('point cloud')) return 'Pointcloud';
        if (tokens.includes('dem') || tokens.includes('digital elevation model')) return 'DEM';
        if (tokens.includes('no info') || tokens.includes('noinfo') || tokens.includes('geen info')) return 'No Info';
        return raw;
    }

    // NIEUW: normaliseer categorie-naam naar vaste set 
    function normalizeCat(cat) { 
        return getPrimaryDataCategory(cat);
    } 

    function formatDatasetTypeLabel(value) {
        const raw = String(value || '').trim();
        if (!raw) return 'N/A';
        const tokens = raw.split(',').map((token) => token.trim()).filter(Boolean);
        if (!tokens.length) return raw;
        const normalized = tokens.map((token) => {
            const lower = token.toLowerCase();
            if (lower === 'pointcloud' || lower === 'point cloud') return 'Pointcloud';
            if (lower === 'dem' || lower === 'digital elevation model') return 'DEM';
            if (lower === 'region') return 'Region';
            return token;
        });
        return normalized.join(' and ');
    }

    // NIEUW: haal kleur op ongeacht hoofdletters/varianten 
    function getCatColor(cat) { 
        return (categoryColors[normalizeCat(cat)] || '#7F7F7F'); 
    } 

    function buildCountryFillExpression() {
        const selectedCats = getActiveCategorySelection();
        const focusedCategory = selectedCats.length === 1 ? selectedCats[0] : null;
        const focusedProperty = focusedCategory ? categorySupportProperty(focusedCategory) : null;
        return [
            'case',
            ['boolean', ['feature-state', 'highlightAllGreen'], false], getCatColor('Region'),
            ...(focusedCategory ? [[ 'boolean', ['get', focusedProperty], false ], getCatColor(focusedCategory)] : []),
            ['boolean', ['get', 'SupportsRegion'], false], getCatColor('Region'),
            ['boolean', ['get', 'SupportsPointcloud'], false], getCatColor('Pointcloud'),
            ['boolean', ['get', 'SupportsDEM'], false], getCatColor('DEM'),
            ['boolean', ['get', 'SupportsNoInfo'], false], getCatColor('No Info'),
            ['==', ['get', 'Data'], 'Region'], getCatColor('Region'),
            ['==', ['get', 'Data'], 'Pointcloud'], getCatColor('Pointcloud'),
            ['==', ['get', 'Data'], 'DEM'], getCatColor('DEM'),
            getCatColor('No Info')
        ];
    }

    function hasCountrySummaryInfo(properties) {
        const values = [
            properties && properties.Info,
            properties && properties.Type,
            properties && properties.National,
            properties && properties.Urban,
            properties && properties.Planimetric,
            properties && properties.Altimetric,
            properties && properties.Year,
            properties && properties.Link,
            properties && properties['XY Ref'],
            properties && properties['Z Ref']
        ];
        return values.some((value) => value !== null && value !== undefined && String(value).trim() !== '');
    }

    function buildRegionFillExpression() {
        const selectedCats = getActiveCategorySelection();
        const focusedCategory = selectedCats.length === 1 ? selectedCats[0] : null;
        const focusedProperty = focusedCategory ? categorySupportProperty(focusedCategory) : null;
        return [
            'case',
            ['boolean', ['feature-state', 'datasetSelected'], false], '#ffb703',
            ...(focusedCategory ? [[ 'boolean', ['get', focusedProperty], false ], getCatColor(focusedCategory)] : []),
            ['==', ['get', 'Data'], 'Region'], getCatColor('Region'),
            ['==', ['get', 'Data'], 'Pointcloud'], getCatColor('Pointcloud'),
            ['==', ['get', 'Data'], 'DEM'], getCatColor('DEM'),
            ['==', ['get', 'Data'], 'No Info'], getCatColor('No Info'),
            getCatColor('No Info')
        ];
    }

    function buildSelectedDataCategoryFilterExpression() {
        const selectedCategories = mapFilterState && mapFilterState.dataCategories instanceof Set
            ? Array.from(mapFilterState.dataCategories)
            : ['Pointcloud', 'DEM', 'No Info'];
        if (!selectedCategories.length) return ['literal', false];
        const filters = selectedCategories.map((category) => ['boolean', ['get', categorySupportProperty(category)], false]);
        return filters.length === 1 ? filters[0] : ['any', ...filters];
    }

    function clearSelectedRegionHighlight() {
        const mapRef = getMapInstance();
        if (!mapRef || selectedRegionFeatureId === null || !mapRef.getSource('regions')) {
            selectedRegionFeatureId = null;
            return;
        }
        try {
            mapRef.setFeatureState({ source: 'regions', id: selectedRegionFeatureId }, { selected: false });
        } catch (e) {}
        selectedRegionFeatureId = null;
    }

    function clearDatasetRegionSelection() {
        if (window.map && map.getSource('regions') && activeDatasetRegionIds.length) {
            activeDatasetRegionIds.forEach((id) => {
                try {
                    map.setFeatureState({ source: 'regions', id }, { datasetSelected: false });
                } catch (e) {}
            });
        }
        if (window.map && map.getSource('regions') && dimmedDatasetRegionIds.length) {
            dimmedDatasetRegionIds.forEach((id) => {
                try {
                    map.setFeatureState({ source: 'regions', id }, { datasetDimmed: false });
                } catch (e) {}
            });
        }
        activeDatasetRegionIds = [];
        dimmedDatasetRegionIds = [];
    }

    function setDatasetRegionSelectionByNames(regionNames) {
        clearDatasetRegionSelection();
        if (!window.map || !map.getSource('regions') || !regionsData || !Array.isArray(regionsData.features)) return;

        const targets = new Set(
            (regionNames || [])
                .map((name) => normalizeCountryKey(name))
                .filter(Boolean)
        );
        if (!targets.size) return;

        const matchingFeatures = regionsData.features.filter((feature) => {
            const name = normalizeCountryKey(feature && feature.properties && feature.properties.Name);
            return name && targets.has(name);
        });
        if (!matchingFeatures.length) return;

        activeDatasetRegionIds = matchingFeatures
            .map((feature) => feature && feature.id)
            .filter((id) => id !== null && id !== undefined);
        const selectedCountryName = normalizeCountryKey(
            (selectedCountryFeature && selectedCountryFeature.properties && selectedCountryFeature.properties.Name) || ''
        );
        dimmedDatasetRegionIds = regionsData.features
            .filter((feature) => {
                const name = normalizeCountryKey(feature && feature.properties && feature.properties.Name);
                if (!name || (selectedCountryName && name === selectedCountryName)) return false;
                return !targets.has(name);
            })
            .map((feature) => feature && feature.id)
            .filter((id) => id !== null && id !== undefined);

        activeDatasetRegionIds.forEach((id) => {
            try {
                map.setFeatureState({ source: 'regions', id }, { datasetSelected: true });
            } catch (e) {}
        });
        dimmedDatasetRegionIds.forEach((id) => {
            try {
                map.setFeatureState({ source: 'regions', id }, { datasetDimmed: true });
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

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
        const hasFilter = isFilterActive();
        if (!q && !hasFilter) {
            countryListEl.innerHTML = '';
            dividerLine.style.display = 'none';
            return;
        }
        if (q) {
            countries = countries.filter(f => f.properties.Name.toLowerCase().includes(q));
        }
        dividerLine.style.display = 'none';
        if (hasFilter) {
            countries = countries.filter((f) => countryPassesMapFilters(f));
            dividerLine.style.display = 'block';
        }
        countries = countries.sort((a, b) => a.properties.Name.localeCompare(b.properties.Name));
        countryListEl.innerHTML = '';
        let itemIndex = 0;
        countries.forEach((c) => {
            const li = document.createElement('li');
            li.className = 'country-item';
            li.style.setProperty('--cat-color', getFeatureDisplayColor(c.properties));
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = c.properties.Name;
            a.onclick = (e) => {
                e.preventDefault();
                handleCountrySelect(c);
            };
            li.appendChild(a);
            countryListEl.appendChild(li);
            setTimeout(() => li.classList.add('show'), 70 + itemIndex * 45);
            itemIndex += 1;
        });

        // When there's a query, also search region and research names from unifiedMapData
        if (q && unifiedMapData && Array.isArray(unifiedMapData.features)) {
            const matchedCountryKeys = new Set(countries.map(c => normalizeCountryKey(c.properties.Name)));
            const seenRegionKeys = new Set();
            const regionMatches = [];
            unifiedMapData.features.forEach((f) => {
                if (!f || !f.properties) return;
                const props = f.properties;
                const name = String(props.Name || props.RegionName || '').trim();
                const parentCountry = String(props.ParentCountry || props.main_country || '').trim();
                if (!name || !parentCountry) return;
                if (normalizeCountryKey(name) === normalizeCountryKey(parentCountry)) return; // skip country-level
                if (!name.toLowerCase().includes(q) && !String(props.RegionName || '').toLowerCase().includes(q)) return;
                const dedupeKey = `${normalizeCountryKey(parentCountry)}::${normalizeCountryKey(name)}`;
                if (seenRegionKeys.has(dedupeKey)) return;
                seenRegionKeys.add(dedupeKey);
                regionMatches.push({ name, parentCountry, color: getFeatureDisplayColor(props) });
            });
            regionMatches.sort((a, b) => a.name.localeCompare(b.name));
            regionMatches.forEach((r) => {
                const li = document.createElement('li');
                li.className = 'country-item';
                li.style.setProperty('--cat-color', r.color);
                const a = document.createElement('a');
                a.href = '#';
                a.innerHTML = `${escapeHtml(r.name)} <span style="font-weight:400;opacity:0.65;font-size:0.85em">${escapeHtml(r.parentCountry)}</span>`;
                a.onclick = (e) => {
                    e.preventDefault();
                    focusCountryAndRegion(r.parentCountry, r.name);
                    closeSearch();
                };
                li.appendChild(a);
                countryListEl.appendChild(li);
                setTimeout(() => li.classList.add('show'), 70 + itemIndex * 45);
                itemIndex += 1;
            });
        }
    } 

    function renderRegionList() { 
        showRegionTOC(); 
        const regionFilterBtns = document.getElementById('regionFilterBtns'); 
        const regionList = document.getElementById('regionList');
        regionFilterBtns.innerHTML = ''; 
        regionFilterBtns.className = 'legend-categories'; 
            const countryDataType = selectedCountryFeature?.properties?.Data || 'No Info'; 
        const currentCountryName = String(selectedCountryFeature?.properties?.Name || '').toLowerCase();
        const regionalChildren = (regionsData && regionsData.features && regionsData.features.length > 0)
            ? regionsData.features.filter(
                (f) => !isCountrySummaryFeatureForCountry(f, currentCountryName)
            )
            : [];
        const visibleRegionalChildren = isFilterActive()
            ? regionalChildren.filter((f) => subRegionPassesRangeFilters(f))
            : regionalChildren;

        // Overview knop (altijd) 
        const homeBtn = document.createElement('button'); 
        homeBtn.className = 'legend-btn overview-home-btn'; // apart maken 
        homeBtn.innerHTML = '<span>National dataset</span>';
        homeBtn.style.setProperty('--cat-color', getCatColor(countryDataType)); 
        homeBtn.onclick = () => { 
            // Geen active state meer – gewoon navigatie 
            const mainRegion = getCountrySummaryFeature(); 
            if (mainRegion) { 
                showInfo(mainRegion.properties, false); 
            } else { 
                showInfo(selectedCountryFeature.properties, false); 
            } 
        }; 
        homeBtn.onclick = returnToCountryView;
        regionFilterBtns.appendChild(homeBtn); 

        // Bepaal beschikbare categorieën 
        if (visibleRegionalChildren.length > 0) { 
            const catsAvailable = [...new Set(
                visibleRegionalChildren.flatMap((f) => getFeatureAvailableCategories(f.properties))
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
                    const filteredRegions = visibleRegionalChildren.filter( 
                        f => featureSupportsCategory(f, cat)
                    ); 
                    showRegionList(filteredRegions, cat); 
                }; 
                regionFilterBtns.appendChild(btn); 
            }); 
        } 
        if (regionList) {
            showRegionList(visibleRegionalChildren, null);
        }
    } 

    function returnToCountryView() {
        if (!selectedCountryFeature || !selectedCountryFeature.properties) return;
        const mapRef = getMapInstance();
        autoDrilldownCountryFeature = null;
        regionDrilldownVisible = false;
        if (mapRef && selectedRegionFeatureId !== null && mapRef.getSource('regions')) {
            try {
                mapRef.setFeatureState({ source: 'regions', id: selectedRegionFeatureId }, { selected: false });
            } catch (e) {}
        }
        selectedRegionFeatureId = null;
        hideRegionsOnMap();
        showCountryTOC();
        renderCountriesList();
        clearDatasetRegionSelection();
        const countrySummaryFeature = getCountrySummaryFeature();
        showInfo((countrySummaryFeature && countrySummaryFeature.properties) || selectedCountryFeature.properties, false);
        renderResearchMarkers();
        try {
            zoomTo(selectedCountryFeature, 45);
        } catch (e) {}
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
            li.style.setProperty('--cat-color', getFeatureDisplayColor(f.properties)); 
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

    function handleCountrySelect(feature, initialRegionName) { 
        restoreFilterMenuAfterSidebarClose = isFilterMenuOpen();
        closeFilterMenu();
        clearSelectedRegionHighlight();
        selectedCountryFeature = feature; 
        autoDrilldownCountryFeature = null;
        regionDrilldownVisible = false;
        fetchCountryRegions(feature.properties.Name)
        .then(rd => { 
            if (rd && rd.features) { 
                rd.features.forEach((f, i) => { 
                    if (f.id === undefined) f.id = i; 
                    f.properties.RawDataTypes = f.properties.Data || 'No Info';
                    f.properties.DataDisplay = getDisplayDataType(f.properties.Data || 'No Info');
                    f.properties.Data = normalizeCat(f.properties.Data); 
                    setFeatureCategorySupport(f.properties);
                }); 
            } 
            regionsData = rd; 
            let mainRegion = getCountrySummaryFeature(); 
            const summaryProperties = (mainRegion && mainRegion.properties) || feature.properties;
            const preferredDatasetIndex = isFilterActive()
                ? getBestMatchingCountryDatasetIndex(regionsData, feature)
                : getLatestRepresentativeIndex(summaryProperties);
            const regionalChildren = regionsData.features.filter(
                (f) => (f.properties.Name || '').toLowerCase() !== (feature.properties.Name || '').toLowerCase()
            );
            selectedCountryFeature.mainRegion = mainRegion || null; 
            showRegionsOnMap(regionsData);
            renderResearchMarkers();
            showRegionTOC();
            renderRegionList();
            const requestedRegionKey = normalizeCountryKey(initialRegionName);
            const requestedRegion = requestedRegionKey
                ? regionalChildren.find((f) => getFeatureLocationLookupKeys(f).includes(requestedRegionKey))
                : null;
            if (requestedRegion) {
                showTab('toc');
                selectRegion(requestedRegion.id, requestedRegion.properties);
                map.setMinZoom(2);
                return;
            }
            if (!hasCountrySummaryInfo(feature.properties) && regionalChildren.length) {
                showTab('toc');
                selectRegion(regionalChildren[0].id, regionalChildren[0].properties);
                map.setMinZoom(2);
                return;
            }
            showInfo(summaryProperties, false, undefined, preferredDatasetIndex);
            showTab('toc'); 
            zoomTo(feature, 0);
            map.setMinZoom(2); 
        }) 
        .catch(() => { 
            autoDrilldownCountryFeature = null;
            regionDrilldownVisible = false;
            regionsData = { type: 'FeatureCollection', features: [] }; 
            hideRegionsOnMap();
            clearResearchMarkers();
            showCountryTOC();
            showInfo(feature.properties, false); 
            showTab('toc'); 
            zoomTo(feature, 0);
            map.setMinZoom(2); 
        }); 
    } 

    const regionOverviewBtn = document.getElementById('regionOverviewBtn');
    if (regionOverviewBtn) {
        regionOverviewBtn.onclick = () => {
            clearFilterRestoreOnNavigation();
            overviewReset();
        };
    }
    if (regionBackToCountryBtn) {
        regionBackToCountryBtn.onclick = () => {
            clearFilterRestoreOnNavigation();
            returnToCountryView();
        };
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
            const countryRender = getCountryRenderDataForZoom(map.getZoom());
            currentCountryRenderLevel = countryRender.levelKey;
            map.addSource('countries', { type: 'geojson', data: countryRender.data, generateId: true }); 
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
                    'line-color': '#222222', 
                    'line-width': 2 
                } 
            }); 
            // Filter-regions layer: shows individual sub-regions when spatial/accuracy filter is active
            const filterRegionRender = getFilterRegionRenderDataForZoom(map.getZoom());
            currentFilterRegionRenderLevel = filterRegionRender.levelKey;
            map.addSource('filter-regions', { type: 'geojson', data: filterRegionRender.data, generateId: true });
            map.addLayer({
                id: 'filter-region-fill',
                type: 'fill',
                source: 'filter-regions',
                layout: { visibility: 'none' },
                paint: { 'fill-color': buildRegionFillExpression(), 'fill-opacity': 0.75 }
            });
            map.addLayer({
                id: 'filter-region-border',
                type: 'line',
                source: 'filter-regions',
                layout: { visibility: 'none' },
                paint: { 'line-color': '#222222', 'line-width': 2, 'line-opacity': 0.85 }
            });
            map.addSource('research-points', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
                generateId: true
            });
            map.addLayer({
                id: 'research-point',
                type: 'circle',
                source: 'research-points',
                paint: {
                    'circle-color': '#2563eb',
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        3, 5,
                        8, 8,
                        12, 11
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.95
                }
            });
            map.addLayer({
                id: 'research-point-hit',
                type: 'circle',
                source: 'research-points',
                paint: {
                    'circle-color': '#2563eb',
                    'circle-radius': 16,
                    'circle-opacity': 0.01
                }
            });

            ['mouseenter', 'mouseleave'].forEach(evt => {
                map.on(evt, 'country-fill', () => map.getCanvas().style.cursor = evt === 'mouseenter' ? 'pointer' : '');
                map.on(evt, 'filter-region-fill', () => map.getCanvas().style.cursor = evt === 'mouseenter' ? 'pointer' : '');
                map.on(evt, 'research-point-hit', () => map.getCanvas().style.cursor = evt === 'mouseenter' ? 'pointer' : '');
            });

            map.on('zoomend', () => syncAdaptiveMapRendering());

            // Unified click handling: select region first, then country, otherwise reset
            map.on('click', e => {
                if (map.getLayer('research-point-hit')) {
                    const researchHits = map.queryRenderedFeatures(e.point, { layers: ['research-point-hit'] });
                    if (researchHits.length) {
                        const researchFeature = researchHits[0];
                        const properties = researchFeature.properties || {};
                        if (selectedCountryFeature && regionsData && Array.isArray(regionsData.features)) {
                            const matchedFeature = getRegionFeatureByIdOrProperties(properties.ResearchFeatureId, properties);
                            if (matchedFeature) {
                                focusRegionFeature(matchedFeature.id, matchedFeature.properties);
                                zoomToResearchPoint(researchFeature, map);
                                showInfo(matchedFeature.properties, false, undefined, getCountryDatasetIndexForFeature(matchedFeature));
                                return;
                            }
                            zoomToResearchPoint(researchFeature, map);
                            showInfo(properties, false);
                            return;
                        }
                        zoomToResearchPoint(researchFeature, map);
                        showInfo(properties, false);
                        showTab('toc');
                        return;
                    }
                }

                const regionLayers = ['region-fill', 'region-border', 'region-point'].filter(layerId => map.getLayer(layerId));
                if (regionLayers.length) {
                    const regionFeatures = map.queryRenderedFeatures(e.point, { layers: regionLayers });
                    if (regionFeatures.length) {
                        const regionFeature = regionFeatures[0];
                        if (regionFeature && regionFeature.id !== undefined) {
                            if (!selectedCountryFeature) {
                                openOverviewDrilldownRegion(regionFeature.id, regionFeature.properties);
                                return;
                            }
                            selectRegion(regionFeature.id, regionFeature.properties);
                            return;
                        }
                    }
                }

                // Also check filter-region-fill (visible when regional filter is active)
                if (map.getLayer('filter-region-fill')) {
                    const filterRegionHits = map.queryRenderedFeatures(e.point, { layers: ['filter-region-fill'] });
                    if (filterRegionHits.length) {
                        const feat = filterRegionHits[0];
                        const parentCountryName = feat.properties && feat.properties.ParentCountry;
                        if (parentCountryName) {
                            const resolvedCountry = resolveCountryFeatureFromMapFeature(feat);
                            if (resolvedCountry) {
                                handleCountrySelect(resolvedCountry, feat.properties.Name);
                                return;
                            }
                        }
                    }
                }

                const countryFeatures = map.queryRenderedFeatures(e.point, { layers: ['country-fill'] });
                if (countryFeatures.length) {
                    const feat = countryFeatures[0];
                    const resolvedCountry = resolveCountryFeatureFromMapFeature(feat);
                    if (resolvedCountry) {
                        const clickedRegionName = feat && feat.properties && feat.properties.ParentCountry
                            ? feat.properties.Name
                            : '';
                        handleCountrySelect(resolvedCountry, clickedRegionName);
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
        // Keep region layers warm and toggle visibility instead of rebuilding them.
        const mapRef = getMapInstance();
        const activeCountry = getActiveRegionCountryFeature();
        if (!mapRef) return;
        clearDatasetRegionSelection();
        ensureRegionsSource(rd);
        if (activeCountry && activeCountry.properties && activeCountry.properties.Name) {
            const selectedName = activeCountry.properties.Name;
            const dataCategoryFilter = buildSelectedDataCategoryFilterExpression();
            const showBoundaries = !mapFilterState.datasetTypes ||
                mapFilterState.datasetTypes.has('national') ||
                mapFilterState.datasetTypes.has('regional');
            // When range filters are active, restrict map layers to only passing sub-regions
            let rangeNameFilter = null;
            if (isFilterActive() && rd && Array.isArray(rd.features)) {
                const passingNames = rd.features
                    .filter((f) => {
                        const name = String((f.properties || {}).Name || '').toLowerCase();
                        if (name === selectedName.toLowerCase()) return false;
                        return subRegionPassesRangeFilters(f);
                    })
                    .map((f) => String((f.properties || {}).Name || ''));
                rangeNameFilter = ['in', ['get', 'Name'], ['literal', passingNames]];
            }
            const regionFillParts = [
                ['==', ['geometry-type'], 'Polygon'],
                ['!=', ['get', 'Name'], selectedName],
                dataCategoryFilter,
                ...(rangeNameFilter ? [rangeNameFilter] : [])
            ];
            if (mapRef.getLayer('region-fill')) {
                mapRef.setFilter('region-fill', ['all', ...regionFillParts]);
            }
            if (mapRef.getLayer('region-fill')) {
                mapRef.setPaintProperty('region-fill', 'fill-color', buildRegionFillExpression());
                mapRef.setLayoutProperty('region-fill', 'visibility', showBoundaries ? 'visible' : 'none');
            }
            if (mapRef.getLayer('region-border')) {
                mapRef.setFilter('region-border', ['all', ...regionFillParts]);
                mapRef.setPaintProperty('region-border', 'line-color', [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], '#000000',
                    '#222222'
                ]);
                mapRef.setPaintProperty('region-border', 'line-width', [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 4,
                    2
                ]);
                mapRef.setLayoutProperty('region-border', 'visibility', showBoundaries ? 'visible' : 'none');
            }
            if (mapRef.getLayer('region-point')) {
                const regionPointParts = [
                    ['==', ['geometry-type'], 'Point'],
                    ['!=', ['get', 'Name'], selectedName],
                    ['!', ['has', 'ADM_lookup']],
                    dataCategoryFilter,
                    ...(rangeNameFilter ? [rangeNameFilter] : [])
                ];
                mapRef.setFilter('region-point', ['all', ...regionPointParts]);
                mapRef.setPaintProperty('region-point', 'circle-color', buildRegionFillExpression());
                mapRef.setPaintProperty('region-point', 'circle-radius', [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], 10,
                    ['boolean', ['feature-state', 'datasetSelected'], false], 8,
                    7
                ]);
                mapRef.setLayoutProperty('region-point', 'visibility', showBoundaries ? 'visible' : 'none');
            }
        }
    } 

    function openOverviewDrilldownRegion(id, props) {
        const activeCountry = getActiveRegionCountryFeature();
        if (!activeCountry || !activeCountry.properties || !regionsData || !Array.isArray(regionsData.features)) return;

        selectedCountryFeature = activeCountry;
        autoDrilldownCountryFeature = null;
        regionDrilldownVisible = false;
        selectedCountryFeature.mainRegion = getCountrySummaryFeature() || null;
        showRegionsOnMap(regionsData);
        showRegionTOC();
        renderRegionList();
        showTab('toc');
        selectRegion(id, props);
    }

    function getMapFitPadding(base = 20) {
        const sidebarEl = document.getElementById('sidebar');
        const isMobile = isMobileMapViewport();
        const rightPadding = !isMobile && sidebarEl && sidebarEl.style.display !== 'none'
            ? Math.max(
                base,
                Math.min(
                    Math.round(window.innerWidth * 0.24),
                    Math.round(sidebarEl.getBoundingClientRect().width * 0.45)
                )
            )
            : base;
        return { top: base, right: rightPadding, bottom: base, left: base };
    }

    function getRegionFeatureByIdOrProperties(id, props) {
        if (!regionsData || !Array.isArray(regionsData.features)) return null;
        const fallbackFeature = id !== undefined ? regionsData.features[id] : null;
        const lookupKeys = getFeatureLocationLookupKeys(props);
        if (lookupKeys.length) {
            const matchedFeature = regionsData.features.find((feature) => {
                const featureKeys = getFeatureLocationLookupKeys(feature);
                return featureKeys.some((key) => lookupKeys.includes(key));
            });
            if (matchedFeature) return matchedFeature;
        }
        return fallbackFeature || null;
    }

    function selectRegion(id, props) { 
        console.log('selectRegion', id, props.Name); 
        const feature = getRegionFeatureByIdOrProperties(id, props);
        if (!feature) return; 
        clearDatasetRegionSelection();
        clearSelectedRegionHighlight();
        selectedRegionFeatureId = id; 
        map.setFeatureState({ source: 'regions', id }, { selected: true }); 
        try { 
            if (feature && feature.geometry && feature.geometry.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
                map.easeTo({
                    center: feature.geometry.coordinates,
                    zoom: Math.max(map.getZoom(), 8),
                    padding: getMapFitPadding(20),
                    duration: 1000,
                    pitch: 45,
                    bearing: 0
                });
            } else {
                const bbox = turf.bbox(feature); 
                map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
                    padding: getMapFitPadding(20),
                    duration: 1000,
                    pitch: 45,
                    bearing: 0
                }); 
            }
        } catch (e) { 
            console.warn('Kan bounding box niet bepalen:', e); 
        } 
        showInfo(feature.properties || props, true); 
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
        map.fitBounds([ [bbox[0], bbox[1]], [bbox[2], bbox[3]] ], {
            padding: getMapFitPadding(20),
            duration: 1000,
            pitch,
            bearing: 0
        }); 
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

function showInfo(p, regionMode, yearIndex, datasetIndex, activeTabOverride, activeDataTypeOverride) { 
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const isResearchFeatureContext = !!(p && p.ADM_lookup);
  const rawResearchLocationName = String(
    (p && (p.Location || p.location || p['Name.1'] || p.RegionName)) || ''
  ).trim();
  const rawResearchDatasetName = String(
    (p && (p['Dataset_name'] || p.Dataset_name || p['Data Name'] || p['Data name'] || p['Dataset Name'] || p.dataset_name || p.Dataset)) || ''
  ).trim();
  const objectName = isResearchFeatureContext
    ? (rawResearchLocationName || rawResearchDatasetName || (p && p.Name) || 'No name')
    : (p && p.Name) || 'No name';
  const hasInfo = [
    p && p.Data,
    p && p.Type,
    p && p.National,
    p && p.Urban,
    p && p.Planimetric,
    p && p.Altimetric,
    p && p.Year,
    p && p.year_begin,
    p && p.year_end,
    p && p.Link,
    p && p['XY Ref'],
    p && p['Z Ref']
  ].some((value) => value !== null && value !== undefined && String(value).trim() !== '');
  const isCountrySummaryContext = !regionMode && Number(p && p.ADM) === 0;
  const formatMeters = (value) => {
    if (!(value || value === 0)) return 'N/A';
    const text = String(value).trim();
    if (!text) return 'N/A';
    const normalizedParts = text
      .split(/\s*;\s*/)
      .map((part) => String(part || '').trim().replace(',', '.'))
      .filter(Boolean);
    if (normalizedParts.length >= 2) {
      return normalizedParts[0] === normalizedParts[1]
        ? `${normalizedParts[0]} m`
        : `${normalizedParts[0]} to ${normalizedParts[1]} m`;
    }
    return `${text.replace(',', '.')} m`;
  };
  const normalizeValue = (value) => {
    if (value === 0) return '0';
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text) return '';
    if (/^(n\/a|na|none|null|geen data|no data|unknown)$/i.test(text)) return '';
    return text;
  };
  const formatPpsmValue = (value) => {
    const text = normalizeValue(value);
    if (!text) return '';
    const millionMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*M$/i);
    if (millionMatch) {
      return `${millionMatch[1].replace(',', '.')} million points`;
    }
    return text;
  };
  const formatSpatialDistribution = (national, urban) => {
    const nationalVal = formatPpsmValue(national);
    const urbanVal = formatPpsmValue(urban);
    const appendDensityUnit = (value) => value.includes('million points') ? value : `${value} ppsm`;
    if (nationalVal && urbanVal) {
      return nationalVal === urbanVal
        ? appendDensityUnit(nationalVal)
        : `${appendDensityUnit(nationalVal)} to ${appendDensityUnit(urbanVal)}`;
    }
    if (nationalVal) return appendDensityUnit(nationalVal);
    if (urbanVal) return appendDensityUnit(urbanVal);
    return 'N/A';
  };
  const splitSeries = (value) => {
    if (value === null || value === undefined) return [];
    const text = String(value).trim();
    if (!text) return [];
    if (text.includes(' || ')) return text.split(/\s*\|\|\s*/).filter(Boolean);
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
    p && p.Responsible,
    p && p.responsible,
    p && p['Data Provider'],
    p && p['Data provider'],
    p && p.Provider,
    p && p.provider,
    p && p.Organisation,
    p && p.Organization,
    p && p.Agency
  );
  const countryName = String((selectedCountryFeature && selectedCountryFeature.properties && selectedCountryFeature.properties.Name) || '').trim().toLowerCase();
  const viewingCountrySummary = !isResearchFeatureContext && (isCountrySummaryContext || (countryName && String(objectName || '').trim().toLowerCase() === countryName));
  const normalizeDatasetOptionKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const getDatasetNamesFromProperties = (properties, { preserveDuplicates = false } = {}) => {
    const nameFieldValues = [
      properties && properties['Dataset_name'],
      properties && properties.Dataset_name,
      properties && properties['Data Name'],
      properties && properties['Data name'],
      properties && properties['Dataset Name'],
      properties && properties.dataset_name,
      properties && properties.Dataset
    ];
    const rawNames = nameFieldValues.flatMap((value) => splitSeries(value));
    if (rawNames.length) {
      if (!preserveDuplicates) return uniqueValues(rawNames);
      const splitFields = nameFieldValues.map((value) => splitSeries(value));
      const seriesCount = Math.max(...splitFields.map((parts) => parts.length), 0);
      if (seriesCount <= 1) return uniqueValues(rawNames);
      const orderedSeriesNames = Array.from({ length: seriesCount }, (_, index) => {
        const match = splitFields
          .map((parts) => String(parts[index] || '').trim())
          .find((value) => value !== '');
        return match || '';
      }).filter(Boolean);
      return orderedSeriesNames.length ? orderedSeriesNames : uniqueValues(rawNames);
    }
    const fallbackName = String((properties && properties.Name) || '').trim();
    const parentCountryName = String(
      (properties && (properties.ParentCountry || properties.main_country || properties.country)) || ''
    ).trim();
    const isSubCountryFeature = !!fallbackName && normalizeCountryKey(fallbackName) !== normalizeCountryKey(parentCountryName || fallbackName);
    if (!isSubCountryFeature) return [];
    return preserveDuplicates ? [fallbackName] : uniqueValues([fallbackName]);
  };
  const dataTypeValue = firstValue(
    p && p.DataDisplay,
    p && p['Data display'],
    p && p.Data
  );
  const hasTruthyTypeFlag = (rawValue) => {
    const normalized = String(rawValue || '').trim().toLowerCase();
    return !!normalized && ['1', '1.0', 'yes', 'true'].includes(normalized);
  };
  const getAvailableDatasetTypes = (rawValue, dtmValue, dsmValue) => {
    const tokens = String(rawValue || '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
    const types = [];
    if (tokens.some((token) => ['point cloud', 'pointcloud'].includes(token))) {
      types.push({ key: 'point-cloud', label: 'Point cloud' });
    }
    if (tokens.some((token) => token === 'dem')) {
      const hasDtm = hasTruthyTypeFlag(dtmValue);
      const hasDsm = hasTruthyTypeFlag(dsmValue);
      if (hasDtm) {
        types.push({ key: 'dtm', label: 'DTM' });
      }
      if (hasDsm) {
        types.push({ key: 'dsm', label: 'DSM' });
      }
      if (!hasDtm && !hasDsm) {
        types.push({ key: 'dem', label: 'DEM' });
      }
    }
    return types;
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
  const getDatasetVersionMeta = (name) => {
    const text = String(name || '').trim();
    const fallback = {
      groupKey: normalizeDatasetOptionKey(text),
      groupLabel: text,
      versionLabel: '',
      versioned: false
    };
    if (!text) return fallback;

    const romanMatch = text.match(/^(.*?)(?:\s+|[-_])?([IVXLCDM]+)$/i);
    if (romanMatch) {
      const baseLabel = String(romanMatch[1] || '').trim();
      const versionLabel = String(romanMatch[2] || '').trim().toUpperCase();
      if (baseLabel && versionLabel && /[a-z]/i.test(baseLabel)) {
        return {
          groupKey: `versioned:${normalizeDatasetOptionKey(baseLabel)}`,
          groupLabel: baseLabel,
          versionLabel,
          versioned: true
        };
      }
    }

    const numericSuffixMatch = text.match(/^(.*?)(?:\s+|[-_])?(\d{1,3}[A-Za-z]?)$/);
    if (numericSuffixMatch) {
      const baseLabel = String(numericSuffixMatch[1] || '').trim();
      const versionLabel = String(numericSuffixMatch[2] || '').trim();
      if (baseLabel && versionLabel && /[a-z]/i.test(baseLabel)) {
        return {
          groupKey: `versioned:${normalizeDatasetOptionKey(baseLabel)}`,
          groupLabel: baseLabel,
          versionLabel,
          versioned: true
        };
      }
    }

    return fallback;
  };
  const yearBeginRaw = firstValue(
    p && p.Year_start,
    p && p.year_start,
    p && p.year_begin,
    p && p['Year begin'],
    p && p['Acquisition start'],
    p && p['Start year']
  );
  const yearEndRaw = firstValue(
    p && p.Year_end,
    p && p.year_end,
    p && p['Year end'],
    p && p['Acquisition end'],
    p && p['End year']
  );
  const legacyYearSeries = splitSeries(p && p.Year);
  const yearBeginSeries = splitSeries(yearBeginRaw);
  const yearEndSeries = splitSeries(yearEndRaw);
  const datasetSeriesPeriodLabel = (index) => {
    const begin = String(yearBeginSeries[index] || '').trim();
    const end = String(yearEndSeries[index] || legacyYearSeries[index] || '').trim();
    if (begin && end) return begin === end ? end : `${begin}-${end}`;
    return end || begin || `v${index + 1}`;
  };
  const extractDatasetNamesFromInfo = (infoText) => {
    const text = String(infoText || '');
    if (!text.trim()) return [];
    const matches = text.match(/\b[A-Za-z][A-Za-z-]*\d+[A-Za-z0-9-]*\b/g) || [];
    return uniqueValues(
      matches.filter((name) => !/^(epsg\d*|las\d*|lod\d*)$/i.test(String(name || '').trim()))
    );
  };
  const summaryDatasetOptions = (() => {
    const fromProperties = getDatasetNamesFromProperties(p, { preserveDuplicates: true });
    if (fromProperties.length) return fromProperties;
    if (viewingCountrySummary) return extractDatasetNamesFromInfo(p && p.Info);
    return fromProperties;
  })();
  const countryDatasetFeatureMap = new Map();
  if (viewingCountrySummary && regionsData && Array.isArray(regionsData.features)) {
    regionsData.features.forEach((feature) => {
      const properties = feature && feature.properties;
      if (!properties) return;
      const featureName = String(properties.Name || '').trim().toLowerCase();
      const isResearchFeature = !!properties.ADM_lookup;
      if (countryName && featureName === countryName && !isResearchFeature) return;
      getDatasetNamesFromProperties(properties).forEach((name) => {
        const key = normalizeDatasetOptionKey(name);
        if (!key) return;
        const existing = countryDatasetFeatureMap.get(key);
        if (existing) {
          existing.features.push(feature);
          return;
        }
        countryDatasetFeatureMap.set(key, { name, features: [feature] });
      });
    });
  }
  const datasetOptions = viewingCountrySummary
    ? uniqueValues([
        ...summaryDatasetOptions,
        ...Array.from(countryDatasetFeatureMap.values()).map((entry) => entry.name)
      ])
    : summaryDatasetOptions;
  const datasetGroupsByKey = new Map();
  datasetOptions.forEach((name, rawIndex) => {
    const meta = getDatasetVersionMeta(name);
    const existing = datasetGroupsByKey.get(meta.groupKey);
    const versionEntry = {
      label: meta.versionLabel || name || datasetSeriesPeriodLabel(rawIndex),
      rawIndex,
      rawName: name
    };
    if (existing) {
      if (!meta.versionLabel && normalizeDatasetOptionKey(existing.versions[0].rawName) === normalizeDatasetOptionKey(name)) {
        existing.versioned = true;
      }
      existing.rawIndices.push(rawIndex);
      existing.versions.push(versionEntry);
      return;
    }
    datasetGroupsByKey.set(meta.groupKey, {
      label: meta.groupLabel || name,
      rawIndices: [rawIndex],
      versions: [versionEntry],
      versioned: meta.versioned
    });
  });
  const datasetGroupEntries = Array.from(datasetGroupsByKey.values()).map((entry) => {
    const allSameRawName = entry.versions.every((version) =>
      normalizeDatasetOptionKey(version.rawName) === normalizeDatasetOptionKey(entry.versions[0].rawName)
    );
    const isVersionFamily = (entry.versioned || allSameRawName) && entry.versions.length > 1;
    const versions = isVersionFamily
      ? entry.versions.map((version) => ({
          ...version,
          label: (version.label && version.label !== version.rawName)
            ? version.label
            : datasetSeriesPeriodLabel(version.rawIndex)
        }))
      : [];
    return {
      label: isVersionFamily ? entry.label : entry.versions[0].rawName,
      rawIndices: entry.rawIndices,
      versions
    };
  });
  const summaryDatasetGroupsByKey = new Map();
  summaryDatasetOptions.forEach((name, rawIndex) => {
    const meta = getDatasetVersionMeta(name);
    const existing = summaryDatasetGroupsByKey.get(meta.groupKey);
    const versionEntry = {
      label: meta.versionLabel || name || datasetSeriesPeriodLabel(rawIndex),
      rawIndex,
      rawName: name
    };
    if (existing) {
      if (!meta.versionLabel && normalizeDatasetOptionKey(existing.versions[0].rawName) === normalizeDatasetOptionKey(name)) {
        existing.versioned = true;
      }
      existing.rawIndices.push(rawIndex);
      existing.versions.push(versionEntry);
      return;
    }
    summaryDatasetGroupsByKey.set(meta.groupKey, {
      label: meta.groupLabel || name,
      rawIndices: [rawIndex],
      versions: [versionEntry],
      versioned: meta.versioned
    });
  });
  const summaryDatasetGroupEntries = Array.from(summaryDatasetGroupsByKey.values()).map((entry) => {
    const allSameRawName = entry.versions.every((version) =>
      normalizeDatasetOptionKey(version.rawName) === normalizeDatasetOptionKey(entry.versions[0].rawName)
    );
    const isVersionFamily = (entry.versioned || allSameRawName) && entry.versions.length > 1;
    const versions = isVersionFamily
      ? entry.versions.map((version) => ({
          ...version,
          label: (version.label && version.label !== version.rawName)
            ? version.label
            : datasetSeriesPeriodLabel(version.rawIndex)
        }))
      : [];
    return {
      label: isVersionFamily ? entry.label : entry.versions[0].rawName,
      rawIndices: entry.rawIndices,
      versions
    };
  });
  const datasetRegionMap = (() => {
    if (!viewingCountrySummary) {
      return parseDatasetRegionMap(p && p.Info, datasetOptions);
    }
    const parsedRegionMap = parseDatasetRegionMap(p && p.Info, datasetOptions);
    const featureRegionMap = Object.fromEntries(
      Array.from(countryDatasetFeatureMap.values()).map((entry) => [
        entry.name,
        uniqueValues(entry.features.map((feature) => firstValue(feature && feature.properties && feature.properties.Name)))
      ])
    );
    const mergedRegionMap = { ...parsedRegionMap };
    Object.keys(featureRegionMap).forEach((datasetName) => {
      const parsedNames = Array.isArray(parsedRegionMap[datasetName]) ? parsedRegionMap[datasetName] : [];
      const featureNames = Array.isArray(featureRegionMap[datasetName]) ? featureRegionMap[datasetName] : [];
      mergedRegionMap[datasetName] = uniqueValues([...parsedNames, ...featureNames]);
    });
    return mergedRegionMap;
  })();
  const resolveDatasetRegionNames = (datasetName, datasetGroup) => {
    const normalizedTarget = normalizeDatasetOptionKey(datasetName);
    const namesByNormalizedKey = new Map(
      Object.entries(datasetRegionMap || {}).map(([name, regions]) => [
        normalizeDatasetOptionKey(name),
        Array.isArray(regions) ? regions : []
      ])
    );
    const directMatch = namesByNormalizedKey.get(normalizedTarget);
    if (directMatch && directMatch.length) return uniqueValues(directMatch);

    const groupNames = [];
    if (datasetGroup && Array.isArray(datasetGroup.rawIndices)) {
      datasetGroup.rawIndices.forEach((rawIndex) => {
        const rawName = datasetOptions[rawIndex] || '';
        const matches = namesByNormalizedKey.get(normalizeDatasetOptionKey(rawName));
        if (Array.isArray(matches) && matches.length) {
          groupNames.push(...matches);
        }
      });
    }
    return uniqueValues(groupNames);
  };
  const yearSeries = yearBeginSeries.length || yearEndSeries.length
    ? Array.from({ length: Math.max(yearBeginSeries.length, yearEndSeries.length) }, (_, index) => {
        const begin = yearBeginSeries[index] || '';
        const end = yearEndSeries[index] || '';
        if (begin && end) return begin === end ? begin : `${begin} - ${end}`;
        return begin || end || legacyYearSeries[index] || '';
      }).filter((value) => String(value || '').trim() !== '')
    : legacyYearSeries;
  const hasYearSwitcher = yearSeries.length > 1;
  const hasSummaryDatasetSwitcher = summaryDatasetOptions.length > 1;
  const hasDatasetSwitcher = datasetOptions.length > 1;
  const hasLinkedDatasetSeries = hasSummaryDatasetSwitcher && hasYearSwitcher && summaryDatasetOptions.length === yearSeries.length;
  const defaultSeriesIndex = Number.isInteger(p && p.RepresentativeSeriesIndex)
    ? p.RepresentativeSeriesIndex
    : getLatestRepresentativeIndex(p);
  const requestedSeriesIndex = Number.isInteger(datasetIndex)
    ? datasetIndex
    : (Number.isInteger(yearIndex) ? yearIndex : defaultSeriesIndex);
  const activeDatasetIndex = hasDatasetSwitcher
    ? Math.max(0, Math.min(requestedSeriesIndex, datasetOptions.length - 1))
    : 0;
  const activeDatasetGroupIndex = datasetGroupEntries.findIndex((entry) => entry.rawIndices.includes(activeDatasetIndex));
  const activeDatasetGroup = datasetGroupEntries[Math.max(0, activeDatasetGroupIndex)] || datasetGroupEntries[0] || null;
  const activeDatasetName = datasetOptions[activeDatasetIndex] || datasetOptions[0] || '';
  const activeDatasetRegionNames = resolveDatasetRegionNames(activeDatasetName, activeDatasetGroup);
  const activeVersionEntries = activeDatasetGroup && activeDatasetGroup.versions.length > 1
    ? activeDatasetGroup.versions
    : [];
  const activeVersionIndex = activeVersionEntries.findIndex((entry) => entry.rawIndex === activeDatasetIndex);
  const activeSummaryDatasetIndex = summaryDatasetOptions.findIndex(
    (name) => normalizeDatasetOptionKey(name) === normalizeDatasetOptionKey(activeDatasetName)
  );
  const activeSummaryDatasetGroupIndex = summaryDatasetGroupEntries.findIndex((entry) =>
    entry.rawIndices.includes(activeSummaryDatasetIndex)
  );
  const hasActiveSummaryDataset = activeSummaryDatasetIndex !== -1;
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
    if (!hasSummaryDatasetSwitcher || !hasActiveSummaryDataset) return rawValue;
    const parts = splitSeries(rawValue);
    if (parts.length === summaryDatasetOptions.length) return parts[activeSummaryDatasetIndex];
    if (activeSummaryDatasetGroupIndex !== -1 && parts.length === summaryDatasetGroupEntries.length) {
      return parts[activeSummaryDatasetGroupIndex];
    }
    if (activeDatasetGroup && parts.length === datasetGroupEntries.length) {
      return parts[Math.max(0, activeDatasetGroupIndex)];
    }
    return rawValue;
  };
  const valueForSelection = (rawValue) => {
    const datasetScoped = valueForDataset(rawValue);
    if (datasetScoped !== rawValue) return datasetScoped;
    return valueForYear(rawValue);
  };
  const valueForDataTypeSelection = (rawValue) => {
    if (rawValue === null || rawValue === undefined) return rawValue;
    const text = String(rawValue);
    if (!text.includes(' || ')) return rawValue;
    return valueForSelection(rawValue);
  };
  const acquisitionStartValue = valueForSelection(yearBeginRaw) || valueForSelection(p.Year);
  const acquisitionEndValue = valueForSelection(yearEndRaw) || valueForSelection(p.Year);
  const acquisitionPeriodLabel = (() => {
    const begin = formatOngoingYearValue(acquisitionStartValue);
    const end = formatOngoingYearValue(acquisitionEndValue);
    if (begin && end) return begin === end ? begin : `${begin} - ${end}`;
    return begin || end || 'N/A';
  })();
  const acquisitionPeriodMeta = (() => {
    const begin = formatOngoingYearValue(acquisitionStartValue);
    const end = formatOngoingYearValue(acquisitionEndValue);
    if (begin && end) {
      return {
        label: 'Acquisition period',
        value: begin === end ? begin : `${begin} to ${end}`
      };
    }
    if (end) {
      return {
        label: 'Time',
        value: end
      };
    }
    if (begin) {
      return {
        label: 'Time',
        value: begin
      };
    }
    return {
      label: 'Time',
      value: 'N/A'
    };
  })();
  const coverageValue = valueForSelection(
    (p && (
      p.Coverage ||
      p.coverage
    )) || ''
  ) || 'N/A';
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
  const rawDataTypeSeries = splitSeries(dataTypeValue);
  const groupTypeEntries = datasetGroupEntries.map((entry, index) => {
    const groupRawDataValue = rawDataTypeSeries.length === datasetGroupEntries.length
      ? rawDataTypeSeries[index]
      : dataTypeValue;
    return getAvailableDatasetTypes(groupRawDataValue, p && p.DTM, p && p.DSM);
  });
  const flattenedGroupTypeEntries = groupTypeEntries.flatMap((types, groupIndex) =>
    types.map((type, typeIndex) => ({ groupIndex, typeIndex, key: type.key }))
  );
  const valueForSpecs = (rawValue, typeKeyHint) => {
    const effectiveTypeKey = String(typeKeyHint || activeDataType || '').trim().toLowerCase();
    const datasetParts = hasDatasetSwitcher ? splitSeries(rawValue) : [];
    if (activeVersionEntries.length > 1 && datasetParts.length === activeVersionEntries.length) {
      return datasetParts[Math.max(0, activeVersionIndex)];
    }
    if (hasDatasetSwitcher && datasetParts.length === datasetOptions.length) {
      return datasetParts[activeDatasetIndex];
    }
    if (flattenedGroupTypeEntries.length && datasetParts.length === flattenedGroupTypeEntries.length) {
      const flatMatchIndex = flattenedGroupTypeEntries.findIndex((entry) =>
        entry.groupIndex === Math.max(0, activeDatasetGroupIndex) &&
        entry.key === effectiveTypeKey
      );
      if (flatMatchIndex !== -1) {
        return datasetParts[flatMatchIndex];
      }
      const firstGroupMatchIndex = flattenedGroupTypeEntries.findIndex((entry) =>
        entry.groupIndex === Math.max(0, activeDatasetGroupIndex)
      );
      if (firstGroupMatchIndex !== -1) {
        return datasetParts[firstGroupMatchIndex];
      }
    }
    if (activeDatasetGroup && datasetParts.length === datasetGroupEntries.length) {
      return datasetParts[Math.max(0, activeDatasetGroupIndex)];
    }
    const currentGroupTypes = groupTypeEntries[Math.max(0, activeDatasetGroupIndex)] || [];
    if (currentGroupTypes.length && datasetParts.length === currentGroupTypes.length) {
      const typeIndex = currentGroupTypes.findIndex((type) => type.key === effectiveTypeKey);
      return datasetParts[typeIndex === -1 ? 0 : typeIndex];
    }
    const yearParts = hasYearSwitcher ? splitSeries(rawValue) : [];
    if (hasYearSwitcher && yearParts.length === yearSeries.length) {
      return yearParts[activeYearIndex];
    }
    if (hasSingleDatasetSpecificFallback && (datasetParts.length > 1 || yearParts.length > 1)) return '';
    return rawValue;
  };
  const selectedDataTypeValue = valueForDataTypeSelection(dataTypeValue);
  const selectedDtmValue = valueForSpecs(p && p.DTM, 'dtm');
  const selectedDsmValue = valueForSpecs(p && p.DSM, 'dsm');
  const availableDatasetTypes = getAvailableDatasetTypes(selectedDataTypeValue, selectedDtmValue, selectedDsmValue);
  const requestedDataType = String(activeDataTypeOverride || '').trim().toLowerCase();
  const activeDataType = availableDatasetTypes.some((type) => type.key === requestedDataType)
    ? requestedDataType
    : (availableDatasetTypes.some((type) => type.key === 'point-cloud')
        ? 'point-cloud'
        : (availableDatasetTypes[0] && availableDatasetTypes[0].key) || '');
  const navItems = getBannerNavigationItems();
  const navHtml = navItems.length > 1
    ? `<div class="info-banner-nav">
         <button id="infoBannerPrev" class="info-banner-btn" aria-label="Previous region">‹</button>
         <button id="infoBannerNext" class="info-banner-btn" aria-label="Next region">›</button>
       </div>`
    : '';
  const buildTypeBadges = (typeText) => {
    if (!typeText || !String(typeText).trim()) return '<strong>N/A</strong>';
    const tokens = String(typeText).split(/\s*(?:,|\|\|)\s*/).map(t => t.trim()).filter(Boolean);
    if (!tokens.length) return '<strong>N/A</strong>';
    const typeLabels = {
      ALS: 'Airborne Laser Scanning',
      MLS: 'Mobile laser scanning',
      SLS: 'Statical laser scanning',
      DM: 'Digital model'
    };
    const typeIconFiles = {
      ALS: 'als.png',
      MLS: 'mls.png',
      SLS: 'sls.png',
      DM: 'DM.png'
    };
    const chips = tokens.map((token) => {
      const upper = token.toUpperCase();
      const iconSrc = `assets/images/icons/${typeIconFiles[upper] || `${upper.toLowerCase()}.png`}`;
      const label = typeLabels[upper] || upper;
      return `<span class="type-pill" title="${escapeHtml(label)}"><img class="type-icon" src="${iconSrc}" alt="${escapeHtml(label)}" /></span>`;
    }).join('');
    return `<div class="type-pillset">${chips}</div>`;
  };
  const buildDatasetTypeIndicators = (types, selectedType) => {
    const items = types.map((type) => `
      <span class="dataset-type-item">
        <button
          type="button"
          class="dataset-type-box${type.key === selectedType ? ' is-checked' : ''}"
          data-info-dataset-type="${escapeHtml(type.key)}"
          aria-pressed="${type.key === selectedType ? 'true' : 'false'}"
          aria-label="Select ${escapeHtml(type.label)}"
        ></button>
        <span
          class="dataset-type-label"
          data-info-dataset-type="${escapeHtml(type.key)}"
          role="button"
          tabindex="0"
          aria-label="Select ${escapeHtml(type.label)}"
        >${escapeHtml(type.label)}</span>
      </span>`);
    if (!items.length) return '<em>No dataset type available</em>';
    return `
      <div class="dataset-type-checks" aria-label="Dataset type">
        ${items.join('')}
      </div>`;
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
  const focusDatasetRegionsByNames = (regionNames) => {
    if (!viewingCountrySummary || !window.map || !regionsData || !Array.isArray(regionsData.features)) return;
    const targets = new Set((regionNames || []).map((name) => normalizeCountryKey(name)).filter(Boolean));
    if (!targets.size) return;
    const matchingFeatures = regionsData.features.filter((feature) => {
      const featureName = normalizeCountryKey(feature && feature.properties && feature.properties.Name);
      return featureName && targets.has(featureName);
    });
    if (!matchingFeatures.length) return;
    try {
      const featureCollection = { type: 'FeatureCollection', features: matchingFeatures };
      const bbox = turf.bbox(featureCollection);
      if (!Array.isArray(bbox) || bbox.length !== 4) return;
      map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
        padding: getMapFitPadding(20),
        duration: 800,
        pitch: 45,
        bearing: 0
      });
    } catch (e) {
      console.warn('Unable to focus dataset regions:', e);
    }
  };
  const focusDatasetSelection = (regionNames) => {
    clearSelectedRegionHighlight();
    if (Array.isArray(regionNames) && regionNames.length) {
      focusDatasetRegionsByNames(regionNames);
      return;
    }
    if (selectedCountryFeature) {
      zoomTo(selectedCountryFeature, 0);
    }
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
  const hasStructuredClassificationFlag = (() => {
    const rawValue = valueForSelection(
      (p && (
        p['Classification available'] ||
        p.classification ||
        p.Classification
      )) || ''
    );
    const normalized = String(rawValue || '').trim().toLowerCase();
    return ['1', '1.0', 'yes', 'true'].includes(normalized);
  })();
  const getAsprsClassifications = (infoText) => {
    const byCode = new Map();
    const classFieldMap = [
      { code: 1, fields: ['Unclassified', 'unclassified'] },
      { code: 2, fields: ['ground', 'Ground'] },
      { code: 3, fields: ['Low vegetation', 'low vegetation'] },
      { code: 4, fields: ['Medium vegetation', 'medium vegetation'] },
      { code: 5, fields: ['High vegetation', 'high vegetation'] },
      { code: 6, fields: ['building', 'Building'] },
      { code: 7, fields: ['low point', 'Low point'] },
      { code: 9, fields: ['water', 'Water'] },
      { code: 10, fields: ['rail', 'Rail'] },
      { code: 11, fields: ['road surface', 'Road surface'] },
      { code: 13, fields: ['WG', 'wire guard', 'Wire guard'] },
      { code: 14, fields: ['WC', 'wire conductor', 'Wire conductor'] },
      { code: 15, fields: ['transmission tower', 'Transmission tower'] },
      { code: 16, fields: ['wire structure connector', 'Wire connector', 'wire connector'] },
      { code: 17, fields: ['bridge', 'Bridge', 'bridge deck'] }
    ];
    const isTruthyClassValue = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      return !!normalized && !['0', '0.0', 'no', 'false', 'n/a', 'na', 'null', 'nan', 'geen data'].includes(normalized);
    };
    const normalizeLocalClassValue = (value, fallbackLabel) => {
      const normalized = String(value || '').trim();
      if (!normalized) return fallbackLabel;
      const lowered = normalized.toLowerCase();
      if (['1', '1.0', 'yes', 'true'].includes(lowered)) return fallbackLabel;
      return normalized;
    };

    classFieldMap.forEach(({ code, fields }) => {
      const entry = CLASSIFICATION_DEFINITIONS.find((item) => item.code === code);
      if (!entry) return;
      for (let i = 0; i < fields.length; i += 1) {
        const rawValue = valueForSelection((p && p[fields[i]]) || '');
        if (!isTruthyClassValue(rawValue)) continue;
        byCode.set(code, {
          ...entry,
          localClass: normalizeLocalClassValue(rawValue, entry.label)
        });
        break;
      }
    });

    if (hasStructuredClassificationFlag || byCode.size > 0) {
      getAvailableClassifications(infoText).forEach((entry) => {
        if (!byCode.has(entry.code)) {
          byCode.set(entry.code, {
            ...entry,
            localClass: entry.label
          });
        }
      });
    }

    return Array.from(byCode.values()).sort((a, b) => a.code - b.code);
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
  const resolveDataRoomLink = () => {
    const scopedLink = valueForSelection(
      (p && (
        p.Dataroom ||
        p.dataroom ||
        p['Dataroom link'] ||
        p['Data room'] ||
        p.link_point_cloud ||
        p['link_point cloud'] ||
        p['Link point cloud'] ||
        p.Link
      )) || ''
    );
    if (!scopedLink) return scopedLink;
    const splitLinks = splitSeries(
      (p && (
        p.Dataroom ||
        p.dataroom ||
        p['Dataroom link'] ||
        p['Data room'] ||
        p.link_point_cloud ||
        p['link_point cloud'] ||
        p['Link point cloud'] ||
        p.Link
      )) || ''
    );
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
  const resolveDocumentationLink = () => valueForSelection(
    (p && (
      p['Documentation link'] ||
      p['Documentation Link'] ||
      p.documentation_link ||
      p.DocumentationLink ||
      p.DocLink ||
      p.doc_link
    )) || ''
  );
  const resolveLicenceText = () => {
    const licenceValue = valueForSelection(
      (p && (
        p.Licence ||
        p.Licences ||
        p.License ||
        p.Licenses ||
        p.license ||
        p.licenses ||
        p.licence ||
        p.licences ||
        p['Usage licence'] ||
        p['Usage licenses'] ||
        p['Usage license']
      )) || ''
    );
    if (licenceValue) return licenceValue;
    return 'No licence information available.';
  };
  const buildLicenceHtml = (value) => {
    const text = String(value || '').trim();
    if (!text) return 'No licence information available.';
    try {
      const url = new URL(text);
      const href = escapeHtml(url.toString());
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">Terms of use</a>`;
    } catch (e) {
      return escapeHtml(text);
    }
  };
  const resolveProcessingFeeText = () => {
    const feeValue = valueForSelection((p && (p.Fee || p.fee)) || '');
    const normalizedFee = String(feeValue || '').trim().toLowerCase();
    if (!normalizedFee || normalizedFee === 'nan') return 'No information available';
    if (normalizedFee === 'yes') return '&euro;';
    if (normalizedFee === 'no') return 'X';
    return String(feeValue).trim();
  };
  const buildProcessingFeeHtml = (value) => {
    const text = String(value || '').trim();
    if (!text) return 'No information available';
    if (text === '&euro;') return text;
    try {
      const url = new URL(text);
      const href = escapeHtml(url.toString());
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">contactform</a> needs to be filled in`;
    } catch (e) {
      return escapeHtml(text);
    }
  };
  const licenceText = resolveLicenceText();
  const processingFeeText = resolveProcessingFeeText();
  const resolveGridSizeValue = () => {
    if (activeDataType === 'dsm') {
      return formatMeters(valueForSpecs(p && (p.DSM_scale || p['DSM scale'])));
    }
    if (activeDataType === 'dtm') {
      return formatMeters(valueForSpecs(p && (p.DTM_scale || p['DTM scale'])));
    }
    const dsmScaleValue = valueForSpecs(p && (p.DSM_scale || p['DSM scale']));
    if (dsmScaleValue || dsmScaleValue === 0) return formatMeters(dsmScaleValue);
    return formatMeters(valueForSpecs(p && (p.DTM_scale || p['DTM scale'])));
  };
  const qualityPrimaryLabel = ['dem', 'dtm', 'dsm'].includes(activeDataType) ? 'Gridsize' : 'Spatial distribution';
  const qualityPrimaryValue = ['dem', 'dtm', 'dsm'].includes(activeDataType)
    ? resolveGridSizeValue()
    : formatSpatialDistribution(valueForSpecs(p.National), valueForSpecs(p.Urban));
  const effectiveTab = hasInfo
    ? (activeTabOverride || (infoBox && infoBox.dataset && infoBox.dataset.activeTab) || 'general')
    : 'general';
  const datasetControlHtml = datasetGroupEntries.length > 1
    ? `<label class="info-select-wrap" aria-label="Select dataset">
         <select class="info-select" data-info-dataset-select="true">
           ${datasetGroupEntries.map((entry, index) => `<option value="${index}"${index === activeDatasetGroupIndex ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`).join('')}
         </select>
       </label>`
    : (activeDatasetName
        ? escapeHtml((activeDatasetGroup && activeDatasetGroup.label) || activeDatasetName)
        : '<em>No name was found</em>');
  const versionControlHtml = activeVersionEntries.length > 1
    ? `<label class="info-select-wrap info-select-wrap-version" aria-label="Select version">
         <select class="info-select" data-info-dataset-version-select="true">
           ${activeVersionEntries.map((entry, index) => `<option value="${index}"${index === activeVersionIndex ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`).join('')}
         </select>
       </label>`
    : '';
  const generalInfoText = viewingCountrySummary
    ? String((p && p.Info) || '').trim()
    : buildDatasetSpecificInfo(p && p.Info, datasetOptions, activeDatasetName);
  const asprsClassifications = getAsprsClassifications(generalInfoText);
  const hasClassificationInfo = asprsClassifications.length > 0;
  const activeDatasetFeatureEntry = activeDatasetName
    ? countryDatasetFeatureMap.get(normalizeDatasetOptionKey(activeDatasetName))
    : null;
  const isResearchDatasetContext = !!(
    activeDatasetFeatureEntry &&
    Array.isArray(activeDatasetFeatureEntry.features) &&
    activeDatasetFeatureEntry.features.some((feature) =>
      !!(feature && feature.properties && feature.properties.ADM_lookup)
    )
  );
  const displayTitle = objectName;
  // Titel altijd tonen 
  if (infoTitleEl) infoTitleEl.textContent = displayTitle; 
  const flagCode = resolveFlagCodeForFeature(p);
  const flagName = escapeHtml((p && (p.ParentCountry || p.main_country || p.country || p.Name)) || objectName);
  const flagHtml = flagCode
    ? `<img class="info-banner-flag" src="https://flagcdn.com/w320/${flagCode}.png" srcset="https://flagcdn.com/w640/${flagCode}.png 2x, https://flagcdn.com/w960/${flagCode}.png 3x" width="320" height="170" alt="${flagName} flag">`
    : `<img class="info-banner-flag" src="assets/images/banner-placeholder.svg" width="320" height="170" alt="Flag not available">`;
  const bannerHtml = `
    <div class="info-banner">
      ${flagHtml}
      <div class="info-banner-title">${escapeHtml(displayTitle)}</div>
      ${navHtml}
    </div>`;
  const generalRows = `
    <section class="info-panel-section${effectiveTab === 'general' ? ' is-active' : ''}" data-info-panel="general">
      <div class="info-card info-card-general">
        <h4>General information</h4>
        <div class="info-intro">${buildInfoParagraphs(generalInfoText)}</div>
      </div>
    </section>`;

  if (!hasInfo) { 
    infoBox.innerHTML = bannerHtml + generalRows; 
  } else { 
    const xyRef = p['XY Ref'] ? linkifyEPSG(valueForSelection(p['XY Ref'])) : 'N/A'; 
    const zRef = p['Z Ref'] ? linkifyEPSG(valueForSelection(p['Z Ref'])) : 'N/A'; 
    const dataroomLinkValue = resolveDataRoomLink();
    const documentationLinkValue = resolveDocumentationLink();
    const accessHtml = dataroomLinkValue
      ? `<a href="${dataroomLinkValue}" target="_blank" rel="noopener noreferrer">View dataroom</a>`
      : 'N/A';
    const documentationPageHtml = documentationLinkValue
      ? `<a href="${documentationLinkValue}" target="_blank" rel="noopener noreferrer">Open documentation page</a>`
      : 'No documentation page available';

    const tabsHtml = `
      <div class="info-tabs" role="tablist" aria-label="Information sections">
        <button class="info-tab-btn${effectiveTab === 'general' ? ' is-active' : ''}" type="button" data-info-tab="general" aria-pressed="${effectiveTab === 'general' ? 'true' : 'false'}">General information</button>
        <button class="info-tab-btn${effectiveTab === 'specs' ? ' is-active' : ''}" type="button" data-info-tab="specs" aria-pressed="${effectiveTab === 'specs' ? 'true' : 'false'}">Specifications</button>
        <button class="info-tab-btn${effectiveTab === 'classes' ? ' is-active' : ''}" type="button" data-info-tab="classes" aria-pressed="${effectiveTab === 'classes' ? 'true' : 'false'}">Classifications</button>
      </div>`;
    const classHtml = `
      <section class="info-panel-section${effectiveTab === 'classes' ? ' is-active' : ''}" data-info-panel="classes">
        <div class="info-card">
          <div class="classification-table">
            <div class="classification-row classification-row-header">
              <span class="classification-icon" aria-hidden="true"></span>
              <span class="classification-name">ASPRS class name</span>
              <span class="classification-code">Number</span>
              <span class="classification-local">Local class</span>
            </div>
            ${asprsClassifications.map((entry) => `
              <div class="classification-row">
                <span class="classification-icon">${getClassificationIconSvg(entry.code, entry.label)}</span>
                <span class="classification-name">${escapeHtml(entry.label)}</span>
                <span class="classification-code">${entry.code}</span>
                <span class="classification-local">${escapeHtml(entry.localClass || 'N/A')}</span>
              </div>
            `).join('')}
          </div>
          ${hasClassificationInfo ? '' : '<p class="classification-note">No classification information available.</p>'}
        </div>
      </section>`;
    const dataHtml = `
      <section class="info-panel-section${effectiveTab === 'specs' ? ' is-active' : ''}" data-info-panel="specs">
      <div class="info-card">
        <h4>Dataset name</h4>
        <div class="info-row info-row-dataset"><span>Data name</span><strong>${datasetControlHtml}</strong></div>
      </div>
      <div class="info-sections">
        <section class="info-card">
          <h4>Acquisition & Coverage</h4>
          ${versionControlHtml ? `<div class="info-row"><span>Version</span><strong>${versionControlHtml}</strong></div>` : ''}
          <div class="info-row"><span>${escapeHtml(acquisitionPeriodMeta.label)}</span><strong>${escapeHtml(acquisitionPeriodMeta.value)}</strong></div>
          <div class="info-row"><span>Coverage</span><strong>${escapeHtml(coverageValue)}</strong></div>
          <div class="info-row info-row-stacked">
            <span>Type of data</span>
            <strong>${buildDatasetTypeIndicators(availableDatasetTypes, activeDataType)}</strong>
          </div>
          <div class="info-platform-block">
            <span class="info-platform-title">Acquisition method</span>
            ${buildTypeBadges(valueForSelection(p.Type))}
          </div>
        </section>
        <section class="info-card">
          <h4>Quality descriptions</h4>
          <div class="info-row"><span>${qualityPrimaryLabel}</span><strong>${escapeHtml(qualityPrimaryValue)}</strong></div>
          <div class="info-row"><span>Planimetric</span><strong>${formatMeters(valueForSpecs(p.Planimetric))}</strong></div>
          <div class="info-row"><span>Altimetric</span><strong>${formatMeters(valueForSpecs(p.Altimetric))}</strong></div>
          <div class="info-row"><span>XY-ref</span><strong>${xyRef}</strong></div>
          <div class="info-row"><span>Z-ref</span><strong>${zRef}</strong></div>
        </section>
        <section class="info-card">
          <h4>Additional Info</h4>
          <div class="info-row"><span>Data provider</span><strong>${escapeHtml(resolveProviderName())}</strong></div>
          <div class="info-row"><span>Documentation page</span><strong>${documentationPageHtml}</strong></div>
          <div class="info-row"><span>Licence</span><strong>${buildLicenceHtml(licenceText)}</strong></div>
          <div class="info-row"><span>Processing fee</span><strong>${buildProcessingFeeHtml(processingFeeText)}</strong></div>
          <div class="info-row"><span>Access</span><strong>${accessHtml}</strong></div>
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
  const infoDatasetSelects = Array.from(infoBox.querySelectorAll('[data-info-dataset-select]'));
  if (infoDatasetSelects.length) {
    infoDatasetSelects.forEach((infoDatasetSelect) => {
      infoDatasetSelect.addEventListener('change', (e) => {
      const nextGroupIndex = Number(e.target.value);
      const nextGroup = datasetGroupEntries[nextGroupIndex] || null;
      const nextDatasetIndex = nextGroup && nextGroup.rawIndices.length ? nextGroup.rawIndices[0] : 0;
      const nextDatasetName = datasetOptions[nextDatasetIndex] || '';
      const nextDatasetKey = normalizeDatasetOptionKey(nextDatasetName);
      const nextSummaryDatasetIndex = summaryDatasetOptions.findIndex(
        (name) => normalizeDatasetOptionKey(name) === nextDatasetKey
      );
      const nextYearIndex = hasLinkedDatasetSeries && nextSummaryDatasetIndex !== -1
        ? nextSummaryDatasetIndex
        : activeYearIndex;
      showInfo(p, regionMode, nextYearIndex, nextDatasetIndex, effectiveTab, activeDataType);
      const nextDatasetRegionNames = resolveDatasetRegionNames(nextDatasetName, nextGroup);
      focusDatasetSelection(nextDatasetRegionNames);
      });
    });
  }
  const infoDatasetVersionSelects = Array.from(infoBox.querySelectorAll('[data-info-dataset-version-select]'));
  if (infoDatasetVersionSelects.length) {
    infoDatasetVersionSelects.forEach((infoDatasetVersionSelect) => {
      infoDatasetVersionSelect.addEventListener('change', (e) => {
        const nextVersionIndex = Number(e.target.value);
        const nextVersionEntry = activeVersionEntries[nextVersionIndex];
        if (!nextVersionEntry) return;
        const nextDatasetIndex = nextVersionEntry.rawIndex;
        const nextDatasetName = datasetOptions[nextDatasetIndex] || '';
        const nextDatasetKey = normalizeDatasetOptionKey(nextDatasetName);
        const nextSummaryDatasetIndex = summaryDatasetOptions.findIndex(
          (name) => normalizeDatasetOptionKey(name) === nextDatasetKey
        );
        const nextYearIndex = hasLinkedDatasetSeries && nextSummaryDatasetIndex !== -1
          ? nextSummaryDatasetIndex
          : activeYearIndex;
        showInfo(p, regionMode, nextYearIndex, nextDatasetIndex, effectiveTab, activeDataType);
        const nextDatasetGroup = datasetGroupEntries.find((entry) => entry.rawIndices.includes(nextDatasetIndex)) || null;
        const nextDatasetRegionNames = resolveDatasetRegionNames(nextDatasetName, nextDatasetGroup);
        focusDatasetSelection(nextDatasetRegionNames);
      });
    });
  }
  const infoDatasetTypeButtons = Array.from(infoBox.querySelectorAll('[data-info-dataset-type]'));
  if (infoDatasetTypeButtons.length) {
    infoDatasetTypeButtons.forEach((button) => {
      const selectDatasetType = (event) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        if (event.type === 'keydown') event.preventDefault();
        const nextDataType = String(event.currentTarget.getAttribute('data-info-dataset-type') || '').trim().toLowerCase();
        if (!nextDataType || nextDataType === activeDataType) return;
        showInfo(p, regionMode, activeYearIndex, activeDatasetIndex, effectiveTab, nextDataType);
      };
      button.addEventListener('click', selectDatasetType);
      button.addEventListener('keydown', selectDatasetType);
    });
  }
  const infoTabButtons = Array.from(infoBox.querySelectorAll('[data-info-tab]'));
  if (infoTabButtons.length) {
    infoTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextTab = button.getAttribute('data-info-tab') || 'general';
        showInfo(p, regionMode, activeYearIndex, activeDatasetIndex, nextTab, activeDataType);
      });
    });
  }
  if (viewingCountrySummary) {
    setDatasetRegionSelectionByNames(activeDatasetRegionNames);
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

  applyCategoryPalette();
  syncLegendSelectionVisuals();
}

function initAccessibilityControls() {
  if (!document.body) return;
  const storageKeys = {
    colorBlind: 'a11yColorBlindEnabled',
    legacyContrast: 'a11yContrastEnabled',
    largeText: 'a11yLargeTextEnabled',
    dyslexicFont: 'a11yDyslexicFontEnabled'
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
      </button>
      <button id="a11yDyslexicBtn" class="a11y-btn" type="button" aria-pressed="false">
        <span class="a11y-label">Dyslexic font</span>
      </button>
      <button id="a11yTextBtn" class="a11y-btn" type="button" aria-pressed="false">
        <span class="a11y-label">Increase text size</span>
        <span class="a11y-icon a11y-icon-aa" aria-hidden="true">aA</span>
      </button>
    `;
    document.body.appendChild(controls);
  }

  const colorBlindBtn = document.getElementById('a11yColorBlindBtn');
  const textBtn = document.getElementById('a11yTextBtn');
  const dyslexicBtn = document.getElementById('a11yDyslexicBtn');
  if (!colorBlindBtn || !textBtn || !dyslexicBtn) return;

  const refreshButtons = () => {
    const colorBlindEnabled = root.classList.contains('a11y-colorblind');
    const largeTextEnabled = root.classList.contains('a11y-large-text');
    const dyslexicFontEnabled = root.classList.contains('a11y-dyslexic-font');
    updateButtonState(colorBlindBtn, colorBlindEnabled, {
      enable: 'Enable color blindness mode',
      disable: 'Disable color blindness mode'
    });
    updateButtonState(textBtn, largeTextEnabled, {
      enable: 'Enable large text',
      disable: 'Disable large text'
    });
    updateButtonState(dyslexicBtn, dyslexicFontEnabled, {
      enable: 'Enable dyslexic font',
      disable: 'Disable dyslexic font'
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
  const setDyslexicFont = (enabled) => {
    applyMode('a11y-dyslexic-font', enabled);
    setStored(storageKeys.dyslexicFont, enabled);
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
  window.toggleDyslexicFontMode = () => setDyslexicFont(!root.classList.contains('a11y-dyslexic-font'));

  colorBlindBtn.addEventListener('click', window.toggleColorBlindMode);
  textBtn.addEventListener('click', window.toggleTextSizeMode);
  dyslexicBtn.addEventListener('click', window.toggleDyslexicFontMode);

  setColorBlind(getStored(storageKeys.colorBlind, storageKeys.legacyContrast));
  setLargeText(getStored(storageKeys.largeText));
  setDyslexicFont(getStored(storageKeys.dyslexicFont));
  initMapAwarePositioning();
}

initAccessibilityControls();

function applyCategoryFilterToMap() {
  const mapRef = (typeof getMapInstance === 'function') ? getMapInstance() : null;
  if (!mapRef || !mapRef.getLayer('country-fill')) return;

  const inCountryView = !!(selectedCountryFeature && regionsData && Array.isArray(regionsData.features));
  const applyDatasetTypeFilter = shouldApplyDatasetTypeFilter();
  const showNational  = (inCountryView && !applyDatasetTypeFilter) || !mapFilterState.datasetTypes || mapFilterState.datasetTypes.has('national');
  const showRegional  = (inCountryView && !applyDatasetTypeFilter) || !mapFilterState.datasetTypes || mapFilterState.datasetTypes.has('regional');
  const showCity      = (inCountryView && !applyDatasetTypeFilter) || !mapFilterState.datasetTypes || mapFilterState.datasetTypes.has('city');

  mapRef.setPaintProperty('country-fill', 'fill-color', buildCountryFillExpression());
  if (mapRef.getLayer('region-fill')) {
    mapRef.setPaintProperty('region-fill', 'fill-color', buildRegionFillExpression());
  }
  if (mapRef.getLayer('filter-region-fill')) {
    mapRef.setPaintProperty('filter-region-fill', 'fill-color', buildRegionFillExpression());
  }

  const filterActive = typeof isFilterActive === 'function' && isFilterActive();
  const showRegionalOverlay = !inCountryView && showRegional;
  const dataCategoryFilter = buildSelectedDataCategoryFilterExpression();
  const overviewRegionalKeys = new Set(((overviewMapData && overviewMapData.features) || [])
    .filter((feature) => feature && feature.properties && feature.properties.OverviewScope === 'regional')
    .map((feature) => {
      const properties = feature.properties || {};
      const parentKey = normalizeCountryKey(properties.ParentCountry || properties.main_country || properties.country || '');
      return String(properties.FilterMetricKey || getFeatureFilterMetricKey(properties, parentKey)).toLowerCase();
    })
    .filter(Boolean));
  const getPassingRegionMetricKeys = (excludeOverviewRegions = false) => {
    const passingKeys = [];
    regionFilterMetrics.forEach((metrics, key) => {
      const normalizedKey = String(key || '').toLowerCase();
      if (excludeOverviewRegions && overviewRegionalKeys.has(normalizedKey)) return;
      const regionRecords = Array.isArray(metrics && metrics.records) ? metrics.records : [];
      if (regionRecords.some((record) => recordPassesCurrentMapFilters(record))) {
        passingKeys.push(normalizedKey);
      }
    });
    return passingKeys;
  };

  // --- Country layer (national) ---
  const countryFilterParts = [['!', ['has', 'RegionName']]];

  if (!showNational && !showRegional) {
    // Hide boundaries when only Special / research is active.
    countryFilterParts.push(['literal', false]);
  } else if (showNational && !showRegional) {
    countryFilterParts.push(['!=', ['get', 'OverviewScope'], 'regional']);
    if (filterActive) {
      const names = (typeof getFilteredCountryNamesLowercase === 'function')
        ? getFilteredCountryNamesLowercase()
        : [];
      countryFilterParts.push(names.length
        ? ['in', ['downcase', ['get', 'Name']], ['literal', names]]
        : ['literal', false]);
    }
  } else if (!showNational && showRegional) {
    countryFilterParts.push(['==', ['get', 'OverviewScope'], 'regional']);
    if (filterActive) {
      const passingRegionKeys = getPassingRegionMetricKeys(false);
      countryFilterParts.push(passingRegionKeys.length
        ? ['in', ['downcase', ['get', 'FilterMetricKey']], ['literal', passingRegionKeys]]
        : ['literal', false]);
    }
  } else if (filterActive) {
    const names = (typeof getFilteredCountryNamesLowercase === 'function')
      ? getFilteredCountryNamesLowercase()
      : [];
    const passingRegionKeys = getPassingRegionMetricKeys(false);
    countryFilterParts.push(['any',
      ['all',
        ['!=', ['get', 'OverviewScope'], 'regional'],
        ['in', ['downcase', ['get', 'Name']], ['literal', names]]
      ],
      ['all',
        ['==', ['get', 'OverviewScope'], 'regional'],
        passingRegionKeys.length
          ? ['in', ['downcase', ['get', 'FilterMetricKey']], ['literal', passingRegionKeys]]
          : ['literal', false]
      ]
    ]);
  } else {
    countryFilterParts.push(dataCategoryFilter);
  }

  mapRef.setFilter('country-fill', ['all', ...countryFilterParts]);
  mapRef.setFilter('country-border', ['all', ...countryFilterParts]);
  const hasNationalRegionalOverlap = showNational && showRegional;
  if (mapRef.getLayer('country-border')) {
    mapRef.setPaintProperty('country-border', 'line-color', hasNationalRegionalOverlap ? '#000000' : '#222222');
    mapRef.setPaintProperty('country-border', 'line-width', hasNationalRegionalOverlap ? 2.5 : 2);
  }

  // --- Regional overlay layer (filter-region-fill) ---
  if (mapRef.getLayer('filter-region-fill') && mapRef.getLayer('filter-region-border')) {
    if (showRegionalOverlay && filterRegionFeatures && filterRegionFeatures.length) {
      // Determine which regions pass the spatial/accuracy/year filter
      let passingRegionNames;
      let passingRegionKeys;
      if (filterActive) {
        const names = (typeof getFilteredCountryNamesLowercase === 'function')
          ? getFilteredCountryNamesLowercase()
          : [];
        passingRegionNames = [];
        passingRegionKeys = [];
        regionFilterMetrics.forEach((metrics, key) => {
          const [parentKey, regionNameLc] = key.split('::');
          if (overviewRegionalKeys.has(String(key || '').toLowerCase())) return;
          if (!names.includes(parentKey)) return;
          const regionRecords = Array.isArray(metrics && metrics.records) ? metrics.records : [];
          const passes = regionRecords.some((record) => recordPassesCurrentMapFilters(record));
          if (passes) {
            passingRegionNames.push(regionNameLc);
            passingRegionKeys.push(String(key || '').toLowerCase());
          }
        });
      } else {
        // No range filter active: show all regions
        const visibleFilterRegionFeatures = (filterRegionFeatures || []).filter(
          (f) => !overviewRegionalKeys.has(String((f.properties || {}).FilterMetricKey || '').toLowerCase())
        );
        passingRegionNames = visibleFilterRegionFeatures.map(
          (f) => String((f.properties || {}).Name || '').toLowerCase()
        );
        passingRegionKeys = visibleFilterRegionFeatures.map(
          (f) => String((f.properties || {}).FilterMetricKey || '').toLowerCase()
        ).filter(Boolean);
      }

      const regionFilter = passingRegionKeys && passingRegionKeys.length
        ? ['in', ['downcase', ['get', 'FilterMetricKey']], ['literal', passingRegionKeys]]
        : ['in', ['downcase', ['get', 'Name']], ['literal', passingRegionNames]];
      mapRef.setFilter('filter-region-fill', regionFilter);
      mapRef.setFilter('filter-region-border', regionFilter);
      mapRef.setLayoutProperty('filter-region-fill', 'visibility', 'visible');
      mapRef.setLayoutProperty('filter-region-border', 'visibility', 'visible');
    } else {
      mapRef.setLayoutProperty('filter-region-fill', 'visibility', 'none');
      mapRef.setLayoutProperty('filter-region-border', 'visibility', 'none');
    }
  }

  // --- City / Research markers ---
  if (showCity) {
    renderResearchMarkers();
  } else {
    clearResearchMarkers();
  }
}

function syncLegendSelectionVisuals() {
  const panel = document.getElementById('legend-panel');
  if (!panel) return;
  const items = Array.from(panel.querySelectorAll('li[data-cat]'));
  if (!items.length) return;

  const activeDataCategories = mapFilterState && mapFilterState.dataCategories instanceof Set
    ? mapFilterState.dataCategories
    : new Set(['Pointcloud', 'DEM', 'No Info']);
  const activeDatasetTypes = mapFilterState && mapFilterState.datasetTypes instanceof Set
    ? mapFilterState.datasetTypes
    : new Set(['national']);

  items.forEach((li) => {
    const cat = String(li.dataset.cat || '').trim();
    const shouldShow = (
      (cat === 'Pointcloud' && activeDataCategories.has('Pointcloud')) ||
      (cat === 'DEM' && activeDataCategories.has('DEM')) ||
      (cat === 'No Info' && activeDataCategories.has('No Info')) ||
      (cat === 'Research' && activeDatasetTypes.has('city'))
    );
    li.style.display = shouldShow ? '' : 'none';
    li.classList.toggle('active', shouldShow);
  });

  const visibleItems = items.filter((li) => li.style.display !== 'none');

  visibleItems.forEach((li, index) => {
    li.classList.remove('active-start', 'active-middle', 'active-end');
    if (!li.classList.contains('active')) return;
    const prevActive = index > 0 && visibleItems[index - 1].classList.contains('active');
    const nextActive = index < visibleItems.length - 1 && visibleItems[index + 1].classList.contains('active');
    if (!prevActive && !nextActive) {
      li.classList.add('active-start', 'active-end');
    } else if (!prevActive && nextActive) {
      li.classList.add('active-start');
    } else if (prevActive && nextActive) {
      li.classList.add('active-middle');
    } else {
      li.classList.add('active-end');
    }
  });
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

function initHomePageEnhancements() {
    if (!document.body || !document.body.classList.contains('home-page')) return;

    const updatesList = document.querySelector('.home-page .updates-list');
    if (updatesList) {
        const now = new Date();
        const isWorldLidarDay = now.getMonth() === 1 && now.getDate() === 12;
        const existingSpecial = updatesList.querySelector('[data-update-special="world-lidar-day"]');
        if (isWorldLidarDay && !existingSpecial) {
            const specialUpdate = document.createElement('article');
            specialUpdate.className = 'update-item special-update';
            specialUpdate.setAttribute('data-update-special', 'world-lidar-day');
            specialUpdate.innerHTML = `
                <p class="update-date">12 February</p>
                <h4>Happy World LiDAR Day!!</h4>
                <p class="muted">Today we celebrate the value of LiDAR, elevation data, and the people building clearer views of our world.</p>
            `;
            updatesList.prepend(specialUpdate);
        }
    }

    const randomPointcloudBtn = document.getElementById('randomPointcloudBtn');
    if (randomPointcloudBtn) {
        randomPointcloudBtn.addEventListener('click', (event) => {
            event.preventDefault();
            fetchFirstAvailableTextShared(SHARED_CATALOGUE_DATA_PATHS)
                .then((csvText) => {
                    const firstLine = (csvText.split(/\r?\n/, 1)[0] || '');
                    const commaCount = (firstLine.match(/,/g) || []).length;
                    const semicolonCount = (firstLine.match(/;/g) || []).length;
                    const delimiter = semicolonCount > commaCount ? ';' : ',';
                    const rows = parseCsvText(csvText, delimiter);
                    if (!rows.length || rows[0].length === 0) throw new Error('CSV empty');
                    const key = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, '');
                    const headers = rows[0].map((h) => key(h));
                    const readFirst = (row, ...candidates) => {
                        for (let i = 0; i < candidates.length; i += 1) {
                            const value = row[candidates[i]];
                            if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
                        }
                        return '';
                    };
                    const candidates = rows.slice(1)
                        .filter((r) => r.some((value) => String(value).trim() !== ''))
                        .map((r) => {
                            const row = {};
                            headers.forEach((h, i) => {
                                row[h] = r[i] !== undefined ? r[i] : '';
                            });
                            return row;
                        })
                        .map((row) => {
                            const dataType = readFirst(row, 'data', 'dataversion', 'data_version', 'datasettype', 'dataset_type', 'type');
                            return {
                                region: readFirst(row, 'name', 'regionname', 'country'),
                                country: readFirst(row, 'main_country', 'country', 'name'),
                                dataType
                            };
                        })
                        .filter((item) => {
                            const type = String(item.dataType || '').toLowerCase();
                            return item.region && item.country && type.includes('point');
                        });
                    if (!candidates.length) throw new Error('No point cloud locations found');
                    const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
                    window.location.href = `map.html?skipIntro=1&focusCountry=${encodeURIComponent(randomItem.country)}&focusRegion=${encodeURIComponent(randomItem.region)}`;
                })
                .catch(() => {
                    window.location.href = 'map.html?skipIntro=1';
                });
        });
    }
}

const SHARED_CATALOGUE_DATA_PATHS = [
    'data/catalogue.csv',
    'data/Quality_parameters_v10022026.csv',
    '../data/catalogue.csv',
    '../data/Quality_parameters_v10022026.csv'
];
const SHARED_UNIFIED_MAP_DATA_VERSION = '20260422v';
const SHARED_UNIFIED_MAP_DATA_PATHS = [
    `/data/map_data_unified.geojson?v=${SHARED_UNIFIED_MAP_DATA_VERSION}`,
    `../data/map_data_unified.geojson?v=${SHARED_UNIFIED_MAP_DATA_VERSION}`,
    `data/map_data_unified.geojson?v=${SHARED_UNIFIED_MAP_DATA_VERSION}`
];

function fetchFirstAvailableTextShared(paths) {
    const tryAt = (index) => {
        if (!Array.isArray(paths) || index >= paths.length) {
            return Promise.reject(new Error('No data file found'));
        }
        return fetch(paths[index]).then((response) => {
            if (!response.ok) return tryAt(index + 1);
            return response.text();
        });
    };
    return tryAt(0);
}

function fetchFirstAvailableJsonShared(paths) {
    return fetchFirstAvailableTextShared(paths).then((text) => JSON.parse(text));
}

// Initialize banner carousel if elements exist
document.addEventListener('DOMContentLoaded', () => {
    initBannerCarousel();
    initHomePageEnhancements();
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
    const list = document.getElementById('catalogueList');
    const status = document.getElementById('catalogueStatus');
    if ((!body && !list) || !status || !document.body.classList.contains('catalogue-page')) return;
    status.textContent = 'Loading catalogue data from GeoJSON...';

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
    const isNA = (value) => {
        const v = String(value || '').trim().toLowerCase();
        return !v || v === 'n/a' || v === '-';
    };
    const formatCatalogueYearValue = (value) => {
        const text = normalize(value);
        if (!text) return '';
        const numeric = Number(text);
        if (Number.isFinite(numeric)) return String(Math.trunc(numeric));
        return text;
    };
    const splitSeries = (value) => {
        if (value === null || value === undefined) return [];
        const text = String(value).trim();
        if (!text) return [];
        return text.split(/\s*\|\|\s*/).map((part) => part.trim()).filter(Boolean);
    };
    const getSeriesValue = (row, index, ...candidates) => {
        const raw = readFirst(row, ...candidates);
        const parts = splitSeries(raw);
        return parts.length ? (parts[index] || parts[parts.length - 1] || '') : raw;
    };
    const getSeriesCount = (row) => Math.max(
        1,
        ...[
            'Dataset_name', 'dataset_name', 'Data Name', 'Data name', 'Dataset Name', 'Dataset',
            'Data', 'DataDisplay', 'Year_start', 'year_start', 'Year_end', 'year_end',
            'Year', 'National', 'Urban', 'Planimetric', 'Altimetric',
            'Link', 'Dataroom', 'link_point_cloud', 'link_point cloud', 'Documentation link', 'link_info'
        ].map((field) => splitSeries(row[field]).length)
    );
    const formatDataVersion = (value) => {
        const v = String(value || '').trim().toLowerCase();
        if (!v || v === 'n/a' || v === '-') return '-';
        if (v === 'region' || v === 'regional') return 'Region';
        if (v.includes('dense') || v === 'dm' || v.includes('matching')) return 'Dense matching';
        if (v.includes('dem') || v.includes('elevation')) return 'Point cloud based Digital Elevation models';
        if (v.includes('point')) return 'Point cloud';
        return String(value).trim();
    };
    const spatialDistribution = (row, index) => {
        const formatPpsmValue = (value) => {
            const text = normalize(value);
            if (!text) return '';
            const millionMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*M$/i);
            if (millionMatch) {
                return `${millionMatch[1].replace(',', '.')} million points`;
            }
            return text;
        };
        const appendDensityUnit = (value) => value.includes('million points') ? value : `${value} ppsm`;
        const direct = formatPpsmValue(getSeriesValue(row, index, 'spatialdistribution', 'spatialdensity', 'density'));
        if (direct) return direct.toLowerCase().includes('ppsm') || direct.includes('million points') ? direct : `${direct} ppsm`;
        const national = formatPpsmValue(getSeriesValue(row, index, 'National', 'national'));
        const urban = formatPpsmValue(getSeriesValue(row, index, 'Urban', 'urban'));
        if (national && urban && national === urban) return appendDensityUnit(national);
        if (national && urban) return `${appendDensityUnit(national)} to ${appendDensityUnit(urban)}`;
        if (national) return appendDensityUnit(national);
        if (urban) return appendDensityUnit(urban);
        return '-';
    };
    const inferCoverage = (row) => {
        const direct = normalize(readFirst(row, 'Coverage', 'coverage'));
        if (direct) return direct;
        const admLookup = normalize(readFirst(row, 'ADM_lookup', 'adm_lookup'));
        if (admLookup) return 'Research';
        const adm = normalize(readFirst(row, 'ADM', 'adm'));
        if (adm === '0' || adm === '0.0') return 'National';
        if (adm === '1' || adm === '1.0') return 'Regional';
        return '-';
    };
    const hasCatalogueClassification = (row) => {
        const direct = normalize(readFirst(row, 'Classification available', 'Classification', 'classification'));
        if (/^(1|1\.0|yes|true)$/i.test(direct)) return true;
        const classFields = [
            'Created, never classified', 'Unclassified', 'ground', 'Low vegetation',
            'Medium vegetation', 'High vegetation', 'common vegetation', 'building',
            'low point', 'water', 'rail', 'road surface', 'WG', 'WC',
            'transmission tower', 'wire structure connector', 'bridge', 'overhead',
            'snow', 'user', 'user.1'
        ];
        return classFields.some((field) => normalize(row[field]) !== '');
    };
    const featureToCatalogueRows = (feature) => {
        const props = feature && feature.properties ? feature.properties : null;
        if (!props) return [];
        const count = getSeriesCount(props);
        return Array.from({ length: count }, (_, index) => ({ ...props, __seriesIndex: index }));
    };
    const getCatalogueSortYear = (row) => {
        const index = Number(row.__seriesIndex) || 0;
        const year = getSeriesValue(row, index, 'Year_start', 'year_start', 'Year_end', 'year_end', 'Year', 'year');
        const match = String(year || '').match(/\d{4}/);
        return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
    };
    const getCatalogueScopeName = (row) => {
        const admLookup = normalize(readFirst(row, 'ADM_lookup', 'adm_lookup'));
        const adm = normalize(readFirst(row, 'ADM', 'adm'));
        if (!admLookup && (adm === '0' || adm === '0.0')) return 'national';
        return readFirst(row, 'Name.1', 'place', 'Location', 'location', 'RegionName', 'Name') || '';
    };
    const getCatalogueScopeRank = (row) => {
        const admLookup = normalize(readFirst(row, 'ADM_lookup', 'adm_lookup'));
        const adm = normalize(readFirst(row, 'ADM', 'adm'));
        if (!admLookup && (adm === '0' || adm === '0.0')) return 0;
        if (!admLookup) return 1;
        return 2;
    };
    const sortCatalogueRecords = (records) => [...records].sort((a, b) => {
        const countryA = readFirst(a, 'main_country', 'country', 'ParentCountry', 'Name').toLowerCase();
        const countryB = readFirst(b, 'main_country', 'country', 'ParentCountry', 'Name').toLowerCase();
        if (countryA !== countryB) return countryA.localeCompare(countryB);
        const scopeRankDiff = getCatalogueScopeRank(a) - getCatalogueScopeRank(b);
        if (scopeRankDiff !== 0) return scopeRankDiff;
        const scopeA = getCatalogueScopeName(a).toLowerCase();
        const scopeB = getCatalogueScopeName(b).toLowerCase();
        if (scopeA !== scopeB) return scopeA.localeCompare(scopeB);
        return getCatalogueSortYear(a) - getCatalogueSortYear(b);
    });
    let catalogueRecords = [];
    let catalogueSortState = { key: 'default', direction: 'asc' };
    const firstNumericValue = (value) => {
        const match = String(value || '').match(/-?\d+(?:[.,]\d+)?/);
        return match ? Number(match[0].replace(',', '.')) : Number.POSITIVE_INFINITY;
    };
    const getCatalogueSortValue = (row, sortKey) => {
        const index = Number(row.__seriesIndex) || 0;
        switch (sortKey) {
            case 'country':
                return readFirst(row, 'main_country', 'country', 'ParentCountry', 'Name').toLowerCase();
            case 'scope':
                return getCatalogueScopeName(row).toLowerCase();
            case 'dataset':
                return getSeriesValue(row, index, 'Dataset_name', 'dataset_name', 'Data Name', 'Data name', 'Dataset Name', 'Dataset').toLowerCase();
            case 'type':
                return formatDataVersion(getSeriesValue(row, index, 'DataDisplay', 'Data display', 'Data', 'dataversion', 'data_version', 'datasettype', 'dataset_type', 'type')).toLowerCase();
            case 'year':
                return getCatalogueSortYear(row);
            case 'spatial':
                return firstNumericValue(spatialDistribution(row, index));
            case 'planimetric':
                return firstNumericValue(normalize(getSeriesValue(row, index, 'Planimetric', 'planimetric', 'AVG_plan', 'avg_plan')));
            case 'altimetric':
                return firstNumericValue(normalize(getSeriesValue(row, index, 'Altimetric', 'altimetric', 'AVG_alti', 'avg_alti')));
            case 'classification':
                return hasCatalogueClassification(row) ? 1 : 0;
            default:
                return '';
        }
    };
    const sortRecordsByColumn = (records, sortKey, direction) => {
        if (!sortKey || sortKey === 'default') return sortCatalogueRecords(records);
        const multiplier = direction === 'desc' ? -1 : 1;
        return [...records].sort((a, b) => {
            const aValue = getCatalogueSortValue(a, sortKey);
            const bValue = getCatalogueSortValue(b, sortKey);
            if (typeof aValue === 'number' || typeof bValue === 'number') {
                return ((Number(aValue) || Number.POSITIVE_INFINITY) - (Number(bValue) || Number.POSITIVE_INFINITY)) * multiplier;
            }
            const comparison = String(aValue || '').localeCompare(String(bValue || ''));
            if (comparison !== 0) return comparison * multiplier;
            return sortCatalogueRecords([a, b])[0] === a ? -1 : 1;
        });
    };
    const buildTableRowHtml = (row) => {
        const index = Number(row.__seriesIndex) || 0;
        const rawName = readFirst(row, 'Name.1', 'place', 'Location', 'location', 'RegionName', 'Name', 'country', 'main_country') || '-';
        const rawMainCountry = readFirst(row, 'main_country', 'country', 'ParentCountry') || '';
        const rawCoverage = inferCoverage(row);
        const rawDataVersion = formatDataVersion(getSeriesValue(row, index, 'DataDisplay', 'Data display', 'Data', 'dataversion', 'data_version', 'datasettype', 'dataset_type', 'type'));
        if (String(rawDataVersion).toLowerCase() === 'region') return '';
        const rawYearBegin = getSeriesValue(row, index, 'Year_start', 'year_start', 'year_begin', 'yearbegin', 'start_year', 'startyear');
        const rawYearEnd = getSeriesValue(row, index, 'Year_end', 'year_end', 'yearend', 'end_year', 'endyear');
        const rawYear = rawYearBegin || rawYearEnd
            ? [formatCatalogueYearValue(rawYearBegin), formatCatalogueYearValue(rawYearEnd)].filter(Boolean).join(rawYearBegin && rawYearEnd && rawYearBegin !== rawYearEnd ? ' - ' : '')
            : (formatCatalogueYearValue(getSeriesValue(row, index, 'Year', 'year')) || '-');
        const rawAgency = getSeriesValue(row, index, 'Responsible', 'responsible', 'Data Provider', 'responsibleagency', 'responsibleagencie', 'agency', 'provider', 'dataprovider') || '-';
        const rawSpatial = spatialDistribution(row, index);
        const rawPlanimetric = normalize(getSeriesValue(row, index, 'Planimetric', 'planimetric', 'AVG_plan', 'avg_plan')) || '-';
        const rawAltimetric = normalize(getSeriesValue(row, index, 'Altimetric', 'altimetric', 'AVG_alti', 'avg_alti')) || '-';
        const link = getSeriesValue(row, index, 'link_point_cloud', 'link_point cloud', 'Dataroom', 'Link', 'Documentation link', 'link_info', 'linkpointcloud', 'access');

        const allDataNA = [
            rawCoverage,
            rawDataVersion,
            rawYear,
            rawAgency,
            rawSpatial,
            rawPlanimetric,
            rawAltimetric,
            link || '-'
        ].every(isNA);
        if (allDataNA) return '';

        const datasetName = getSeriesValue(row, index, 'Dataset_name', 'dataset_name', 'Data Name', 'Data name', 'Dataset Name', 'Dataset') || rawName;
        const countryName = rawMainCountry || rawName;
        const admLookup = normalize(readFirst(row, 'ADM_lookup', 'adm_lookup'));
        const adm = normalize(readFirst(row, 'ADM', 'adm'));
        const isResearch = !!admLookup;
        const isNational = !isResearch && (adm === '0' || adm === '0.0' || String(rawCoverage).toLowerCase() === 'national');
        const scopeLabel = isResearch ? rawName : (isNational ? 'National' : rawName);
        const scopeHref = countryName && scopeLabel && scopeLabel !== '-'
            ? (isNational
                ? `map.html?focusCountry=${encodeURIComponent(countryName)}`
                : `map.html?focusCountry=${encodeURIComponent(countryName)}&focusRegion=${encodeURIComponent(rawName)}`)
            : '';
        const scopeHtml = scopeHref
            ? `<a href="${scopeHref}" title="Go to maps location -->">${escapeHtml(scopeLabel)}</a>`
            : escapeHtml(scopeLabel);
        const dataVersion = escapeHtml(rawDataVersion);
        const year = escapeHtml(rawYear);
        const spatial = escapeHtml(rawSpatial);
        const planimetric = escapeHtml(rawPlanimetric);
        const altimetric = escapeHtml(rawAltimetric);
        const classificationHtml = hasCatalogueClassification(row)
            ? '<span class="classification-present classification-present-yes" aria-label="Classification present">V</span>'
            : '<span class="classification-present classification-present-no" aria-label="Classification not present">X</span>';
        const linkHtml = link
            ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Link to local dataset</a>`
            : '-';

        return `<tr>
            <td>${escapeHtml(countryName)}</td>
            <td>${scopeHtml}</td>
            <td>${escapeHtml(datasetName)}</td>
            <td>${dataVersion}</td>
            <td>${year}</td>
            <td>${spatial}</td>
            <td>${planimetric}</td>
            <td>${altimetric}</td>
            <td>${classificationHtml}</td>
            <td>${linkHtml}</td>
        </tr>`;
    };
    const buildListItemHtml = (row) => {
        const index = Number(row.__seriesIndex) || 0;
        const rawName = readFirst(row, 'Name.1', 'place', 'Location', 'location', 'RegionName', 'Name', 'country', 'main_country') || '-';
        const rawMainCountry = readFirst(row, 'main_country', 'country', 'ParentCountry') || '';
        const datasetName = getSeriesValue(row, index, 'Dataset_name', 'dataset_name', 'Data Name', 'Data name', 'Dataset Name', 'Dataset') || rawName;
        const dataVersion = formatDataVersion(getSeriesValue(row, index, 'DataDisplay', 'Data display', 'Data', 'dataversion', 'data_version', 'datasettype', 'dataset_type', 'type'));
        if (String(dataVersion).toLowerCase() === 'region') return '';
        const coverage = inferCoverage(row);
        const rawYearBegin = getSeriesValue(row, index, 'Year_start', 'year_start', 'year_begin', 'yearbegin', 'start_year', 'startyear');
        const rawYearEnd = getSeriesValue(row, index, 'Year_end', 'year_end', 'yearend', 'end_year', 'endyear');
        const year = rawYearBegin || rawYearEnd
            ? [formatCatalogueYearValue(rawYearBegin), formatCatalogueYearValue(rawYearEnd)].filter(Boolean).join(rawYearBegin && rawYearEnd && rawYearBegin !== rawYearEnd ? ' - ' : '')
            : (formatCatalogueYearValue(getSeriesValue(row, index, 'Year', 'year')) || '-');
        const agency = getSeriesValue(row, index, 'Responsible', 'responsible', 'Data Provider', 'responsibleagency', 'responsibleagencie', 'agency', 'provider', 'dataprovider') || '-';
        const spatial = spatialDistribution(row, index);
        const planimetric = normalize(getSeriesValue(row, index, 'Planimetric', 'planimetric', 'AVG_plan', 'avg_plan')) || '-';
        const altimetric = normalize(getSeriesValue(row, index, 'Altimetric', 'altimetric', 'AVG_alti', 'avg_alti')) || '-';
        const link = getSeriesValue(row, index, 'link_point_cloud', 'link_point cloud', 'Dataroom', 'Link', 'Documentation link', 'link_info', 'linkpointcloud', 'access');
        const mapHref = (rawMainCountry && rawName && rawName !== '-')
            ? `map.html?focusCountry=${encodeURIComponent(rawMainCountry)}&focusRegion=${encodeURIComponent(rawName)}`
            : `map.html?skipIntro=1`;
        const linkHtml = link
            ? `<a class="catalogue-action" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open dataset</a>`
            : '';

        return `<article class="catalogue-list-item">
            <a class="catalogue-list-title" href="${mapHref}">${escapeHtml(datasetName)}</a>
            <p class="catalogue-list-location">${escapeHtml(rawName)}${rawMainCountry && rawMainCountry !== rawName ? `, ${escapeHtml(rawMainCountry)}` : ''}</p>
            <dl class="catalogue-list-meta">
                <div><dt>Coverage</dt><dd>${escapeHtml(coverage)}</dd></div>
                <div><dt>Data</dt><dd>${escapeHtml(dataVersion)}</dd></div>
                <div><dt>Year</dt><dd>${escapeHtml(year)}</dd></div>
                <div><dt>Spatial</dt><dd>${escapeHtml(spatial)}</dd></div>
                <div><dt>Plan / Alti</dt><dd>${escapeHtml(planimetric)} / ${escapeHtml(altimetric)}</dd></div>
                <div><dt>Agency</dt><dd>${escapeHtml(agency)}</dd></div>
            </dl>
            <div class="catalogue-list-actions">
                <a class="catalogue-action" href="${mapHref}">View on map</a>
                ${linkHtml}
            </div>
        </article>`;
    };
    const updateCatalogueSortButtons = () => {
        document.querySelectorAll('.catalogue-sort-btn').forEach((button) => {
            const active = button.dataset.sortKey === catalogueSortState.key;
            button.classList.toggle('active', active);
            button.setAttribute('aria-sort', active ? (catalogueSortState.direction === 'desc' ? 'descending' : 'ascending') : 'none');
        });
    };
    const renderCatalogueRecords = () => {
        const sortedRecords = sortRecordsByColumn(catalogueRecords, catalogueSortState.key, catalogueSortState.direction);
        const html = list ? sortedRecords.map(buildListItemHtml).join('') : sortedRecords.map(buildTableRowHtml).join('');
        if (list) list.innerHTML = html || '<p class="note">No catalogue rows to display after filtering empty data.</p>';
        if (body) body.innerHTML = html || '<tr><td colspan="10">No catalogue rows to display after filtering empty data.</td></tr>';
        updateCatalogueSortButtons();
        return html;
    };
    document.querySelectorAll('.catalogue-sort-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const key = button.dataset.sortKey || 'default';
            catalogueSortState = {
                key,
                direction: catalogueSortState.key === key && catalogueSortState.direction === 'asc' ? 'desc' : 'asc'
            };
            renderCatalogueRecords();
        });
    });

    fetchFirstAvailableJsonShared(SHARED_UNIFIED_MAP_DATA_PATHS)
        .then((collection) => {
            catalogueRecords = sortCatalogueRecords((Array.isArray(collection && collection.features) ? collection.features : [])
                .flatMap(featureToCatalogueRows));
            if (!catalogueRecords.length) {
                if (body) body.innerHTML = '<tr><td colspan="10">No catalogue rows found in GeoJSON data.</td></tr>';
                if (list) list.innerHTML = '<p class="note">No catalogue rows found in GeoJSON data.</p>';
                status.textContent = 'Catalogue loaded, but no data rows were found.';
                return;
            }

            const html = renderCatalogueRecords();
            const uniqueNations = new Set(catalogueRecords
                .map((row) => readFirst(row, 'main_country', 'country', 'ParentCountry', 'Name'))
                .map((value) => String(value || '').trim().toLowerCase())
                .filter(Boolean));
            status.textContent = html
                ? `Find your dataset here from all currently available European datasets. There are ${catalogueRecords.length} datasets available in ${uniqueNations.size} unique nation${uniqueNations.size === 1 ? '' : 's'}.`
                : 'Catalogue loaded, but no displayable rows were found.';
        })
        .catch((error) => {
            if (body) body.innerHTML = '<tr><td colspan="10">Could not load catalogue data from map_data_unified.geojson.</td></tr>';
            if (list) list.innerHTML = '<p class="note">Could not load catalogue data from map_data_unified.geojson.</p>';
            status.textContent = `Catalogue load failed: ${error && error.message ? error.message : 'Expected GeoJSON in /data or ../data.'}`;
        });
}

document.addEventListener('DOMContentLoaded', () => {
    initCatalogueTable();
});
