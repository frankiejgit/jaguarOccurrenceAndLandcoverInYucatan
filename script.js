// Mapping Jaguar Occurrence and Land Cover Change in the Mesoamerican Biological Corridor (MBC)
// Author: Francisco Gonzalez (gonzalf3@oregonstate.edu)
// Last Updated: 16-03-2025

////////////////////////////
//// 1. Introduction ////////
////////////////////////////

// Background:
// Central America is a biodiversity hotspot, but habitat loss threatens ecosystem resilience[cite: 1].
// Habitat fragmentation disrupts wildlife connectivity[cite: 2, 3].
// Jaguars are an umbrella species[cite: 4].
// Remote sensing is useful for analyzing landscape changes[cite: 5].

// Objective:
// Map jaguar habitat loss over time using Sentinel-2 and jaguar occurrence records[cite: 6].

// Research Questions:
// How has jaguar habitat changed over time? [cite: 7]
// What spatial patterns can be observed between land use changes and jaguar occurrences? [cite: 8]

////////////////////////////
//// 2. Study Area //////////
////////////////////////////

// Region: Mesoamerican Biological Corridor (MBC) [cite: 9]
// A vast ecological network across Central America[cite: 9].
// Hosts 9% of the world’s terrestrial biodiversity[cite: 11].
// Threatened by anthropogenic disturbances[cite: 11].

// Justification:
// MBC is important for jaguar conservation.
// Remote sensing enables large-scale temporal analysis[cite: 13].
// Jaguar data can be combined with land use changes[cite: 14].

// Define the MBC geometry
var mbc = ee.Geometry.Polygon([
    [-92.20043741994952, 15.98275961958455],
    [-88.04760538869952, 15.98275961958455],
    [-88.04760538869952, 18.750611319066035],
    [-92.20043741994952, 18.750611319066035],
    [-92.20043741994952, 15.98275961958455]
]);

// Center the map
Map.centerObject(mbc, 5.5);

// Define years for analysis
var years = ee.List.sequence(2008, 2023);

///////////////////////////////////////////
//// 3. Data and Methods ///////////////////
///////////////////////////////////////////

// Land Cover Data: MODIS MCD12Q1
//   - Provides land cover type information
//   - Available at 500m resolution
var modisLC = ee.ImageCollection('MODIS/061/MCD12Q1')
    .filterDate('2008-01-01', '2024-12-31')
    .select('LC_Type1');

// Jaguar Occurrence Data: GBIF
//   - Species distribution data from verified sources
//   - Spatiotemporal records [~621]
var jaguarOccurrence = ee.FeatureCollection("users/franciscoatabey/mbcJaguarOccurrence");

// Display land cover using color codes references in MODIS documentation
var lcPalette = [
    '05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 'dcd159',
    'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c',
    '69fff8', 'f9ffa4' // , '1c0dff' removing water bodies
];

// Function to add year annotation text to images
function addYearAnnotation(image, year) {
    var annotation = ee.FeatureCollection([
        ee.Feature(ee.Geometry.Point([-92, 22]), { label: year })
    ]);
    var text = annotation.draw({
        color: 'white',
        strokeWidth: 5
    });
    return image.visualize({ min: 1, max: 16, palette: lcPalette })
        .blend(text)
        .set('year', year);
}

// Process each year's land cover map and add annotation
var mbcLandCoverSeries = years.map(function(year) {
    var image = modisLC.filter(ee.Filter.calendarRange(year, year, 'year')).first();
    // Mask water bodies (ID: 17) and clip to MBC
    var landCover = image.clip(mbc).updateMask(image.neq(17));
    // Add year annotation and return
    return addYearAnnotation(landCover, ee.Number(year));
});

// Convert list to ImageCollection
var mbcCollection = ee.ImageCollection(mbcLandCoverSeries);

// Visualize first year as an example
Map.addLayer(mbcCollection.first(), {}, 'MBC Land Cover 2008');

// Jaguar Presence Data Processing
// Ensure 'year' is numeric
var jaguarWithYear = jaguarOccurrence.map(function(feature) {
    return feature.set('year', ee.Number.parse(feature.get('year')));
});

// Filter jaguar data
var jaguarFiltered = jaguarWithYear.filter(ee.Filter.rangeContains('year', 2008, 2024));

// Add year text in the upper-left corner
// TODO: Fix because text is still not visible
function addYearText(image, year) {
    var textPosition = ee.Geometry.Point([-91, 22]);

    var textFeature = ee.FeatureCollection([
        ee.Feature(textPosition, { label: year })
    ]);

    var styledText = textFeature.style({
        color: 'white',      
        pointSize: 18,       
        width: 3,          
    });

    return styledText;
}

// Overlay Jaguar sightings on land cover images
var overlaySightingsOnLandCover = function(image) {
    var year = image.get('year');

    var yearlySightings = jaguarFiltered.filter(ee.Filter.eq('year', year));

    // Convert points to image for overlay
    var sightingsImage = ee.Image().byte().paint({
        featureCollection: yearlySightings,
        color: 1,
        width: 40
    });

    // Create glow effect
    var glow = sightingsImage.focal_max(6).visualize({ palette: ['purple'], opacity: 0.8 });
    var redPoints = sightingsImage.visualize({ palette: ['purple'], opacity: 1 });
    var yearText = addYearText(image, year); // Add year text

    // Blend sightings on top of land cover
    return image.visualize({
        min: 1,
        max: 16,
        palette: lcPalette,
    }).blend(glow).blend(redPoints).blend(yearText); // Blend year text
};

// Create time-lapse
var mbcCollectionWithAnnotations = ee.ImageCollection(years.map(function(year) {
    var image = modisLC.filter(ee.Filter.calendarRange(year, year, 'year')).first();
    var landCover = image.clip(mbc).updateMask(image.neq(17)); // Mask water
    return landCover.set('year', year);
}));

var mbcCollectionWithSightings = mbcCollectionWithAnnotations.map(overlaySightingsOnLandCover);

// GIF visual params
var gifVisParams = {
    'dimensions': 800,
    'region': mbc.bounds(),
    'framesPerSecond': 2,
    'crs': 'EPSG:3857',
    'format': 'gif'
};

// GIF
print('Time Lapse Animation (Land Cover + Jaguars):', mbcCollectionWithSightings.getVideoThumbURL(gifVisParams));
print(ui.Thumbnail(mbcCollectionWithSightings, gifVisParams));

////////////////////
//// 4. Results ////
////////////////////

// Assets Created:
//   - Animated time-lapse of land cover change and jaguar distribution
//   - Forest cover change map

// Expected Outcomes:
//   - Identification of key habitat loss regions
//   - Evidence of shifting jaguar occurrences

// Observed Outcomes:
//   - No significant trends observed via visual analysis
//   - Potential loss of connectivity between two large patches
//   - Noticeable encroachment in jaguar habitat in Carribbean coast of Mexico/Belize

// Function to mask clouds in MODIS MOD09GA images
function maskCloudsMODIS(image) {
  var qa = image.select('QC_500m');
  var cloudMask = qa.bitwiseAnd(3).eq(0);
  return image.updateMask(cloudMask);
}

// Load MODIS data
var modisTrueColor = ee.ImageCollection('MODIS/061/MOD09GA')
  .filterDate('2008-01-01', '2024-12-31')
  .filterBounds(mbc)
  .select(['sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03', 'QC_500m'])
  .map(maskCloudsMODIS) // Apply cloud mask
  .map(function(image){
    return image.copyProperties(image, image.propertyNames());
  });

// Get a median composite
var modisComposite = modisTrueColor.median().clip(mbc);

// Define visualization parameters
var trueColorVis = {
  min: 0,
  max: 4000,
  bands: ['sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'],
  gamma: 1.1,
};

// Add the MODIS true color composite to the map.
Map.addLayer(modisComposite, trueColorVis, 'MODIS True Color Composite');
// Add jaguar sightings
Map.addLayer(jaguarFiltered, { color: 'red' }, 'Jaguar Sightings (2008-2024)');

///////////////////////
//// 5. Discussion ////
///////////////////////

// Interpretation of Findings:
//   - Discuss areas with remaining jaguar habitat and vulnerable areas

// Limitations:
//   - Bias in occurrence data
//   - Accuracy of land cover classification
