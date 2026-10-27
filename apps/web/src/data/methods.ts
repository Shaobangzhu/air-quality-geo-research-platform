export const METHODS = [
  {
    title: 'AQI vs Concentration',
    text: 'AQI is an index; concentration is a measured amount per volume with a pollutant-specific unit. This app keeps the two source measurements separate. Concentration display bins are engineering symbols, not health thresholds. No AQI conversion or source-apportionment calculation is performed.',
    url: 'https://www.airnow.gov/aqi/aqi-basics/',
    source: 'AirNow AQI basics',
  },
  {
    title: 'Preliminary vs Validated',
    text: 'AirNow operational observations are preliminary. A historical date does not validate a record. The acquired EPA AirData rows are official historical records, but their row-level certification is unknown here. Preserve source status, qualifier and last-change information; a working connection does not establish data quality.',
    url: 'https://aqs.epa.gov/aqsweb/documents/data_api.html',
    source: 'EPA AQS documentation',
  },
  {
    title: 'Monitoring Station vs Reporting Area',
    text: 'A monitor retains provider, native site, parameter and POC/instrument identity. Reporting areas describe aggregate public information and differ from individual monitoring sites. This app has no verified reporting-area geometry. Its area examples are explicitly synthetic.',
    url: 'https://aqs.epa.gov/aqsweb/airdata/FileFormats.html',
    source: 'EPA monitor identities and file formats',
  },
  {
    title: 'Forecast vs Observation',
    text: 'A forecast is a prediction with issuance and validity, not a measured observation. Some forecasts have only a category and no numeric AQI. Unknown issuance remains null; date-only validity remains a date, without an invented midnight UTC timestamp. Official production forecast access is unavailable in this app.',
    url: 'https://docs.airnowapi.org/faq',
    source: 'AirNow reporting-area forecasts',
  },
  {
    title: 'Timestamp and Time Zone',
    text: 'Observations retain UTC instants and source averaging periods. Map and Analysis inspection can label America/Los_Angeles with PST/PDT; exports keep UTC and the original source timezone description. EPA Local Standard Time is distinct from daylight-saving civil time. Preview date/time filters are explicitly UTC, with an exclusive end.',
    url: 'https://aqs.epa.gov/aqsweb/airdata/FileFormats.html',
    source: 'EPA timestamp definitions',
  },
  {
    title: 'Fire Hazard Severity Zones (FHSZ)',
    text: 'FHSZ describes long-term hazard, not immediate fire risk, smoke, evacuation, damage or a validated fire-risk forecast. Unmapped is not Low. The case uses SRA effective April 1, 2024 and 2025 LRA recommendations that postdate ignition; local adoption is not established. Static FRAP perimeter geometry is a documented display derivative of firep25_1, not hourly fire growth.',
    url: 'https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones',
    source: 'CAL FIRE / OSFM FHSZ',
  },
  {
    title: 'Data Limitations and Missing Data',
    text: 'Null, zero, negative values and absent records have different meanings. Exports retain supplied rows; they do not fill missing timestamps or interpolate. Source flags and revisions remain traceable. One monitor does not establish exposure everywhere in a fire perimeter. Terrain/hazard overlap cannot establish causation or validated emission-source attribution. This workbench is for research and education, not regulatory or emergency decisions.',
    url: 'https://www.epa.gov/outdoor-air-quality-data',
    source: 'EPA outdoor monitoring data',
  },
] as const;
