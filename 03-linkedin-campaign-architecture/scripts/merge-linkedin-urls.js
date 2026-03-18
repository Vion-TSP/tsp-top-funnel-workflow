const fs = require('fs');

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = [];
  let inQuote = false;
  let current = '';
  const headerLine = lines[0];
  for (let i = 0; i < headerLine.length; i++) {
    const c = headerLine[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === ',' && !inQuote) { headers.push(current.trim()); current = ''; continue; }
    current += c;
  }
  headers.push(current.trim());

  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    if (!line.trim()) continue;
    const vals = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    rows.push(obj);
  }
  return { headers, rows };
}

function escapeCSV(val) {
  if (!val) return '';
  val = val.toString().trim();
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

const campaigns = [
  {
    num: 1,
    enriched: 'C:\\Users\\vion\\Downloads\\Campaign-1-Build-From-Zero-C3-C1B 3 ENRICHED.csv',
    original: 'C:\\Users\\vion\\Documents\\Mindstone Rebel\\Chief-of-Staff\\temp\\linkedin-campaign-lists\\Campaign-1-Build-From-Zero-C3-C1B.csv'
  },
  {
    num: 2,
    enriched: 'C:\\Users\\vion\\Downloads\\Campaign-2-Add-Outbound-C4B-11-100 Enriched.csv',
    original: 'C:\\Users\\vion\\Documents\\Mindstone Rebel\\Chief-of-Staff\\temp\\linkedin-campaign-lists\\Campaign-2-Add-Outbound-C4B-11-100.csv'
  },
  {
    num: 3,
    enriched: 'C:\\Users\\vion\\Downloads\\Campaign-3-Optimise-Engine-C4B-101-500 Enriched.csv',
    original: 'C:\\Users\\vion\\Documents\\Mindstone Rebel\\Chief-of-Staff\\temp\\linkedin-campaign-lists\\Campaign-3-Optimise-Engine-C4B-101-500.csv'
  },
  {
    num: 4,
    enriched: 'C:\\Users\\vion\\Downloads\\Campaign-4-GTM-Efficiency-C4A-C1A-Unknown Enriched.csv',
    original: 'C:\\Users\\vion\\Documents\\Mindstone Rebel\\Chief-of-Staff\\temp\\linkedin-campaign-lists\\Campaign-4-GTM-Efficiency-C4A-C1A-Unknown.csv'
  }
];

const outputDir = 'C:\\Users\\vion\\Documents\\Mindstone Rebel\\Chief-of-Staff\\temp\\linkedin-campaign-lists';

campaigns.forEach(c => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CAMPAIGN ${c.num}`);
  console.log('='.repeat(60));

  // Read enriched file — build lookup by company name (lowercase) and website
  const enrichedData = parseCSV(fs.readFileSync(c.enriched, 'utf-8'));
  console.log(`Enriched rows: ${enrichedData.rows.length}`);

  // Build lookup maps: companyname -> linkedin url, and website -> linkedin url
  const linkedinByName = {};
  const linkedinByWebsite = {};
  const allEnrichedData = {}; // store all enriched fields by company name

  enrichedData.rows.forEach(r => {
    const name = (r['Company Name'] || '').trim().toLowerCase();
    const url = (r['Company Linkedin Url'] || '').trim();
    const website = (r['Website'] || '').trim().toLowerCase();
    const industry = (r['Industry'] || '').trim();
    const city = (r['Company City'] || '').trim();
    const state = (r['Company State'] || '').trim();
    const country = (r['Company Country'] || '').trim();
    const zipcode = (r['Company Postal Code'] || '').trim();

    if (name && url && url.includes('linkedin')) {
      linkedinByName[name] = url;
    }
    if (website && url && url.includes('linkedin')) {
      linkedinByWebsite[website] = url;
    }

    // Store all enriched data for potential field upgrades
    if (name && !allEnrichedData[name]) {
      allEnrichedData[name] = { url, website, industry, city, state, country, zipcode };
    }
    if (website && !allEnrichedData[website]) {
      allEnrichedData[website] = { url, website, industry, city, state, country, zipcode };
    }
  });

  const uniqueLinkedIn = new Set([...Object.values(linkedinByName), ...Object.values(linkedinByWebsite)].filter(u => u.includes('linkedin')));
  console.log(`Unique LinkedIn URLs found: ${uniqueLinkedIn.size}`);

  // Read original campaign CSV
  const originalData = parseCSV(fs.readFileSync(c.original, 'utf-8'));
  console.log(`Original companies: ${originalData.rows.length}`);

  // Match and update
  let matched = 0;
  let alreadyHad = 0;
  let noMatch = 0;
  let updatedOtherFields = 0;

  const updatedRows = originalData.rows.map(row => {
    const name = (row['companyname'] || '').trim().toLowerCase();
    const website = (row['companywebsite'] || '').trim().toLowerCase();
    const existingUrl = (row['linkedincompanypageurl'] || '').trim();

    // Try to find LinkedIn URL
    let linkedinUrl = existingUrl;
    if (!linkedinUrl || !linkedinUrl.includes('linkedin')) {
      // Try by name first, then by website
      if (linkedinByName[name]) {
        linkedinUrl = linkedinByName[name];
        matched++;
      } else if (linkedinByWebsite[website]) {
        linkedinUrl = linkedinByWebsite[website];
        matched++;
      } else {
        noMatch++;
        linkedinUrl = '';
      }
    } else {
      alreadyHad++;
    }

    // Also try to fill in missing fields from enriched data
    const enriched = allEnrichedData[name] || allEnrichedData[website] || {};

    const updatedIndustry = row['industry'] || enriched.industry || '';
    const updatedCity = row['city'] || enriched.city || '';
    const updatedState = row['state'] || enriched.state || '';
    const updatedCountry = row['companycountry'] || enriched.country || 'UK';
    const updatedZipcode = row['zipcode'] || enriched.zipcode || '';
    const updatedWebsite = row['companywebsite'] || enriched.website || '';

    if ((enriched.city && !row['city']) || (enriched.zipcode && !row['zipcode'])) {
      updatedOtherFields++;
    }

    return {
      companyname: row['companyname'] || '',
      companywebsite: updatedWebsite,
      companyemaildomain: updatedWebsite, // email domain = website
      linkedincompanypageurl: linkedinUrl,
      stocksymbol: '',
      industry: updatedIndustry,
      city: updatedCity,
      state: updatedState,
      companycountry: updatedCountry,
      zipcode: updatedZipcode
    };
  });

  console.log(`\nResults:`);
  console.log(`  LinkedIn URLs matched: ${matched}`);
  console.log(`  Already had URL: ${alreadyHad}`);
  console.log(`  No match found: ${noMatch}`);
  console.log(`  Other fields enriched: ${updatedOtherFields}`);
  console.log(`  Coverage: ${((matched + alreadyHad) / updatedRows.length * 100).toFixed(1)}%`);

  // Write updated CSV
  const header = 'companyname,companywebsite,companyemaildomain,linkedincompanypageurl,stocksymbol,industry,city,state,companycountry,zipcode';
  const csvRows = updatedRows.map(r => [
    escapeCSV(r.companyname),
    escapeCSV(r.companywebsite),
    escapeCSV(r.companyemaildomain),
    escapeCSV(r.linkedincompanypageurl),
    escapeCSV(r.stocksymbol),
    escapeCSV(r.industry),
    escapeCSV(r.city),
    escapeCSV(r.state),
    escapeCSV(r.companycountry),
    escapeCSV(r.zipcode)
  ].join(','));

  const outputFile = `${outputDir}\\Campaign-${c.num}-ENRICHED.csv`;
  fs.writeFileSync(outputFile, header + '\n' + csvRows.join('\n'), 'utf-8');
  console.log(`\nWritten: ${outputFile}`);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY — Files ready for LinkedIn Campaign Manager upload:');
console.log('='.repeat(60));
for (let i = 1; i <= 4; i++) {
  const file = `${outputDir}\\Campaign-${i}-ENRICHED.csv`;
  const data = parseCSV(fs.readFileSync(file, 'utf-8'));
  const withUrl = data.rows.filter(r => r['linkedincompanypageurl'] && r['linkedincompanypageurl'].includes('linkedin')).length;
  console.log(`Campaign ${i}: ${data.rows.length} companies, ${withUrl} with LinkedIn URL (${(withUrl/data.rows.length*100).toFixed(1)}%)`);
}
