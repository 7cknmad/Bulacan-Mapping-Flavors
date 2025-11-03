import fs from 'fs/promises';
import path from 'path';

// Map of municipality names to their correct OSM relation IDs from our database
const municipalityMap = {
  'Angat': 379803,
  'Balagtas': 379810,
  'Baliuag': 379811,
  'Bocaue': 379812,
  'Bulakan': 379813,
  'Bustos': 379814,
  'Calumpit': 379816,
  'Doña Remedios Trinidad': 379817,
  'Guiguinto': 379818,
  'Hagonoy': 379819,
  'Malolos': 379820,
  'Marilao': 379821,
  'Meycauayan': 379822,
  'Norzagaray': 379823,
  'Obando': 379824,
  'Pandi': 379825,
  'Plaridel': 379827,
  'Pulilan': 379828,
  'San Ildefonso': 379829,
  'San Jose del Monte': 379830,
  'San Miguel': 379831,
  'San Rafael': 379832,
  'Santa Maria': 379833,
  'Paombong': 379834
};

async function updateGeoJSON(filePath) {
  console.log(`Processing ${filePath}...`);
  
  // Read and parse the GeoJSON file
  const content = await fs.readFile(filePath, 'utf8');
  const geojson = JSON.parse(content);
  
  // Keep track of changes made
  const changes = [];
  
  // Update features
  geojson.features = geojson.features.map(feature => {
    const name = feature.properties?.name;
    const correctId = municipalityMap[name];
    
    if (correctId) {
      const oldId = feature.properties['@id'];
      // Update both @id in properties and id at feature level
      feature.properties['@id'] = `relation/${correctId}`;
      feature.id = `relation/${correctId}`;
      
      changes.push({
        name,
        oldId,
        newId: `relation/${correctId}`
      });
    }
    
    return feature;
  });
  
  // Create a log of changes
  const changeLog = changes.map(c => 
    `${c.name}: ${c.oldId} -> ${c.newId}`
  ).join('\n');
  
  // Save changes log
  const logPath = path.join(path.dirname(filePath), 'id-changes.log');
  await fs.writeFile(logPath, changeLog);
  
  // Save updated GeoJSON
  await fs.writeFile(filePath, JSON.stringify(geojson, null, 2));
  
  console.log(`Updated ${changes.length} municipalities`);
  console.log(`Change log saved to ${logPath}`);
}

// Process both files
const files = [
  '../export.geojson',
  '../public/geo/export.geojson'
];

async function main() {
  for (const file of files) {
    try {
      await updateGeoJSON(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
}

main().catch(console.error);