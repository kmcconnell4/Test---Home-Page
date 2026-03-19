# Tech Brief: Full-Featured Weather Widget with Open-Meteo

---

## Overview
We'll add a fully-featured weather widget to your existing Vercel-hosted HTML/CSS site using the Open-Meteo API. The widget will display current conditions, a 5-day forecast, support geolocation, allow temperature unit toggling, and auto-refresh every 15 minutes. No backend, no API keys, and no additional dependencies required.

---

## Technical Architecture

```
User's Browser
     │
     ├── Loads your HTML/CSS site (from Vercel)
     │
     └── JavaScript handles all widget logic
              │
              ├── Open-Meteo API (weather data, no auth)
              │        └── Returns current conditions + 5-day forecast
              │
              └── Nominatim API (reverse geocoding, no auth)
                       └── Converts coordinates → city name
                            (only called when user clicks "Use My Location")
```

**No backend required.** Everything runs in the browser.

---

## Features

| Feature | Description |
|---|---|
| **Current Conditions** | Temperature, weather description, humidity, wind speed |
| **5-Day Forecast** | Daily high/low temps and weather condition per day |
| **Geolocation** | User can click "Use My Location" to get local weather |
| **°F / °C Toggle** | Instantly switch units without an extra API call |
| **Auto-Refresh** | Weather data silently refreshes every 15 minutes |
| **Loading State** | Spinner/message shown while data is being fetched |
| **Error State** | Friendly message shown if the API call fails |
| **Last Updated** | Timestamp shown so user knows how fresh the data is |

---

## Key Technical Decisions

### Location Handling
Two methods work together:

| Method | When It's Used |
|---|---|
| **Hardcoded coordinates** | Default on page load |
| **Browser Geolocation API** | When user clicks "Use My Location" |

When geolocation is used, coordinates are passed to the **Nominatim reverse geocoding API** (free, no key) to look up a human-readable city name.

### Temperature Units
Rather than making two separate API calls for °F and °C, we always fetch data in **Celsius from the API** and convert to °F in JavaScript when needed. This means:
- Toggling units is instant
- No extra API call on toggle
- Single source of truth for the raw data

### Auto-Refresh
A `setInterval` timer fires every 15 minutes and calls the weather fetch function in **silent mode** — meaning the loading spinner is not shown and the existing data stays visible until new data arrives.

### Forecast Data
The Open-Meteo API supports both `current` and `daily` parameters in a single request, so current conditions and the 5-day forecast are fetched in **one API call**.

---

## APIs Used

### 1. Open-Meteo (Weather Data)
- **URL:** `https://api.open-meteo.com/v1/forecast`
- **Auth:** None required
- **Cost:** Free
- **Used for:** Current conditions + 5-day forecast

**Example Request:**
```
https://api.open-meteo.com/v1/forecast
  ?latitude=47.6062
  &longitude=-122.3321
  &current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
  &daily=temperature_2m_max,temperature_2m_min,weather_code
  &wind_speed_unit=mph
  &timezone=auto
```

**Example Response:**
```json
{
  "current": {
    "temperature_2m": 11.2,
    "relative_humidity_2m": 78,
    "wind_speed_10m": 8.2,
    "weather_code": 3
  },
  "daily": {
    "time": ["2026-03-19", "2026-03-20", "..."],
    "weather_code": [3, 61, 0, 1, 2],
    "temperature_2m_max": [13.1, 11.4, 14.2, 15.0, 12.8],
    "temperature_2m_min": [7.2, 6.8, 8.1, 9.0, 7.5]
  }
}
```

### 2. Nominatim / OpenStreetMap (Reverse Geocoding)
- **URL:** `https://nominatim.openstreetmap.org/reverse`
- **Auth:** None required
- **Cost:** Free
- **Used for:** Converting GPS coordinates to a city name
- **Only called:** When user clicks "Use My Location"

**Example Request:**
```
https://nominatim.openstreetmap.org/reverse
  ?lat=47.6062
  &lon=-122.3321
  &format=json
```

**Example Response (simplified):**
```json
{
  "address": {
    "city": "Seattle",
    "state": "Washington",
    "country": "United States"
  }
}
```

---

## Application State

The widget tracks the following state variables in JavaScript:

| Variable | Default | Description |
|---|---|---|
| `currentUnit` | `"fahrenheit"` | Active temperature unit |
| `currentLat` | `47.6062` | Active latitude |
| `currentLon` | `-122.3321` | Active longitude |
| `locationName` | `"Seattle, WA"` | Display name for location |
| `refreshTimer` | `null` | Reference to the auto-refresh interval |

---

## Weather Code Reference

Open-Meteo returns a WMO weather code. We map these to descriptions and emojis:

| Code | Description | Emoji |
|---|---|---|
| 0 | Clear Sky | ☀️ |
| 1 | Mostly Clear | 🌤️ |
| 2 | Partly Cloudy | ⛅ |
| 3 | Overcast | ☁️ |
| 45, 48 | Foggy / Icy Fog | 🌫️ |
| 51–55 | Drizzle | 🌦️ |
| 61–65 | Rain | 🌧️ |
| 71–77 | Snow | ❄️ |
| 80–82 | Rain Showers | 🌦️–⛈️ |
| 85–86 | Snow Showers | 🌨️ |
| 95, 96, 99 | Thunderstorm | ⛈️ |

---

## Error Handling

| Scenario | Behavior |
|---|---|
| API request fails | Error message shown, console logs the error |
| Geolocation denied | Alert shown, widget stays on default location |
| Geolocation not supported | Alert shown immediately on button click |
| Reverse geocoding fails | Falls back to "Your Location" as display name |
| Silent refresh fails | Error state shown, replaces current data |

---

## Files We'll Touch

```
your-project/
├── index.html        ← Add widget HTML markup
├── style.css         ← Add widget styles
└── weather.js        ← New file (all weather logic)
```

---

## Limitations & Considerations

- Open-Meteo data refreshes every **15 minutes**, so we match our refresh interval to that
- Nominatim's usage policy asks that you avoid rapid automated requests — since we only call it on user interaction this is not a concern
- The Geolocation API requires the user's **explicit permission** via a browser prompt
- Geolocation will only work on **HTTPS** — Vercel provides this by default, so no issues there
- No API keys means **no secrets to manage** and no risk of key exposure

---
---

# Step-by-Step Implementation Plan

---

## Step 1: Create `weather.js`

Create a new file called `weather.js` in your project root and paste in the following:

```javascript
// weather.js

// --- CONFIGURATION ---
const WEATHER_CONFIG = {
  defaultLatitude: 47.6062,
  defaultLongitude: -122.3321,
  defaultLocationName: "Seattle, WA",
  windSpeedUnit: "mph",
  refreshIntervalMinutes: 15,
};

// --- STATE ---
let currentUnit  = "fahrenheit"; // or "celsius"
let currentLat   = WEATHER_CONFIG.defaultLatitude;
let currentLon   = WEATHER_CONFIG.defaultLongitude;
let locationName = WEATHER_CONFIG.defaultLocationName;
let refreshTimer = null;

// --- WEATHER CODE MAPPINGS ---
const weatherDescriptions = {
  0:  { label: "Clear Sky",            emoji: "☀️" },
  1:  { label: "Mostly Clear",         emoji: "🌤️" },
  2:  { label: "Partly Cloudy",        emoji: "⛅" },
  3:  { label: "Overcast",             emoji: "☁️" },
  45: { label: "Foggy",                emoji: "🌫️" },
  48: { label: "Icy Fog",              emoji: "🌫️" },
  51: { label: "Light Drizzle",        emoji: "🌦️" },
  53: { label: "Drizzle",              emoji: "🌦️" },
  55: { label: "Heavy Drizzle",        emoji: "🌧️" },
  61: { label: "Light Rain",           emoji: "🌧️" },
  63: { label: "Rain",                 emoji: "🌧️" },
  65: { label: "Heavy Rain",           emoji: "🌧️" },
  71: { label: "Light Snow",           emoji: "🌨️" },
  73: { label: "Snow",                 emoji: "❄️" },
  75: { label: "Heavy Snow",           emoji: "❄️" },
  77: { label: "Snow Grains",          emoji: "❄️" },
  80: { label: "Light Showers",        emoji: "🌦️" },
  81: { label: "Rain Showers",         emoji: "🌧️" },
  82: { label: "Heavy Showers",        emoji: "⛈️" },
  85: { label: "Snow Showers",         emoji: "🌨️" },
  86: { label: "Heavy Snow Showers",   emoji: "❄️" },
  95: { label: "Thunderstorm",         emoji: "⛈️" },
  96: { label: "Thunderstorm w/ Hail", emoji: "⛈️" },
  99: { label: "Severe Thunderstorm",  emoji: "⛈️" },
};

// --- HELPER: Get weather info from WMO code ---
function getWeatherInfo(code) {
  return weatherDescriptions[code] || { label: "Unknown", emoji: "🌡️" };
}

// --- HELPER: Format temperature ---
// API always returns Celsius; we convert here if needed
function formatTemp(celsius) {
  if (currentUnit === "fahrenheit") {
    return `${Math.round((celsius * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(celsius)}°C`;
}

// --- HELPER: Get short day name from ISO date string ---
function getDayName(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

// --- HELPER: Show/hide elements by ID ---
function show(id) { document.getElementById(id).style.display = "block"; }
function hide(id) { document.getElementById(id).style.display = "none"; }

// --- GEOLOCATION: Handle "Use My Location" button ---
function requestGeolocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  const btn    = document.getElementById("weather-locate-btn");
  btn.textContent = "Locating...";
  btn.disabled    = true;

  navigator.geolocation.getCurrentPosition(
    // Success callback
    async (position) => {
      currentLat = position.coords.latitude;
      currentLon = position.coords.longitude;

      // Reverse geocode coordinates to a city name via Nominatim
      try {
        const geoRes  = await fetch(
          `https://nominatim.openstreetmap.org/reverse` +
          `?lat=${currentLat}&lon=${currentLon}&format=json`
        );
        const geoData = await geoRes.json();
        const city    = geoData.address.city
                     || geoData.address.town
                     || geoData.address.village
                     || "Your Location";
        const state   = geoData.address.state || "";
        locationName  = state ? `${city}, ${state}` : city;
      } catch {
        locationName = "Your Location";
      }

      btn.textContent = "📍 Use My Location";
      btn.disabled    = false;

      // Restart the refresh timer using the new coordinates
      startRefreshTimer();
      loadWeather();
    },
    // Error callback
    (err) => {
      btn.textContent = "📍 Use My Location";
      btn.disabled    = false;
      alert("Unable to retrieve your location. Please check your browser permissions.");
      console.error("Geolocation error:", err);
    }
  );
}

// --- UNIT TOGGLE: Switch between °F and °C ---
function toggleUnit() {
  currentUnit = currentUnit === "fahrenheit" ? "celsius" : "fahrenheit";

  const btn = document.getElementById("weather-unit-btn");
  btn.textContent = currentUnit === "fahrenheit" ? "Switch to °C" : "Switch to °F";

  // Reload weather to re-render all temperatures in the new unit
  loadWeather();
}

// --- AUTO-REFRESH: Start the 15-minute interval timer ---
function startRefreshTimer() {
  // Clear any existing timer before starting a new one
  if (refreshTimer) clearInterval(refreshTimer);

  const intervalMs = WEATHER_CONFIG.refreshIntervalMinutes * 60 * 1000;

  refreshTimer = setInterval(() => {
    console.log("Auto-refreshing weather data...");
    loadWeather(true); // silent = true, no loading spinner
  }, intervalMs);
}

// --- RENDER: Update the DOM with fetched weather data ---
function renderWeather(data) {
  const current     = data.current;
  const daily       = data.daily;
  const weatherInfo = getWeatherInfo(current.weather_code);

  // Current conditions
  document.getElementById("weather-location").textContent  = locationName;
  document.getElementById("weather-icon").textContent      = weatherInfo.emoji;
  document.getElementById("weather-temp").textContent      = formatTemp(current.temperature_2m);
  document.getElementById("weather-condition").textContent = weatherInfo.label;
  document.getElementById("weather-humidity").textContent  = `💧 ${current.relative_humidity_2m}%`;
  document.getElementById("weather-wind").textContent      = `💨 ${Math.round(current.wind_speed_10m)} mph`;
  document.getElementById("weather-updated").textContent   =
    `Updated: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  // 5-day forecast
  const forecastContainer = document.getElementById("weather-forecast");
  forecastContainer.innerHTML = ""; // Clear any previous forecast days

  for (let i = 0; i < 5; i++) {
    const dayInfo = getWeatherInfo(daily.weather_code[i]);
    const dayEl   = document.createElement("div");
    dayEl.className = "forecast-day";
    dayEl.innerHTML = `
      <span class="forecast-label">${getDayName(daily.time[i])}</span>
      <span class="forecast-emoji">${dayInfo.emoji}</span>
      <span class="forecast-high">${formatTemp(daily.temperature_2m_max[i])}</span>
      <span class="forecast-low">${formatTemp(daily.temperature_2m_min[i])}</span>
    `;
    forecastContainer.appendChild(dayEl);
  }
}

// --- FETCH: Load weather data from Open-Meteo ---
async function loadWeather(silent = false) {
  const loading = document.getElementById("weather-loading");
  const content = document.getElementById("weather-content");
  const error   = document.getElementById("weather-error");

  // Show loading spinner on initial load only, not on silent auto-refreshes
  if (!silent) {
    show("weather-loading");
    hide("weather-content");
    hide("weather-error");
  }

  try {
    // Note: We always fetch in Celsius and convert in formatTemp()
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${currentLat}` +
      `&longitude=${currentLon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&wind_speed_unit=${WEATHER_CONFIG.windSpeedUnit}` +
      `&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("API request failed");

    const data = await response.json();

    renderWeather(data);

    hide("weather-loading");
    hide("weather-error");
    show("weather-content");

  } catch (err) {
    hide("weather-loading");
    hide("weather-content");
    show("weather-error");
    console.error("Weather fetch failed:", err);
  }
}

// --- INIT: Wire up buttons and kick everything off ---
function initWeather() {
  document.getElementById("weather-unit-btn")
    .addEventListener("click", toggleUnit);
  document.getElementById("weather-locate-btn")
    .addEventListener("click", requestGeolocation);

  loadWeather();
  startRefreshTimer();
}

// Wait for the DOM to be fully loaded before initializing
document.addEventListener("DOMContentLoaded", initWeather);
```

---

## Step 2: Add Widget Markup to `index.html`

Add this block wherever you want the widget to appear on your page. Add the `<script>` tag just before your closing `</body>` tag:

```html
<!-- Weather Widget -->
<div id="weather-widget" class="weather-widget">

  <!-- Loading State -->
  <div id="weather-loading" class="weather-loading">
    Loading weather...
  </div>

  <!-- Error State -->
  <div id="weather-error" class="weather-error" style="display:none;">
    ⚠️ Weather unavailable. Please try again later.
  </div>

  <!-- Weather Content -->
  <div id="weather-content" class="weather-content" style="display:none;">

    <!-- Header: Location + Buttons -->
    <div class="weather-header">
      <h3 id="weather-location" class="weather-location">--</h3>
      <div class="weather-controls">
        <button id="weather-locate-btn" class="weather-btn">
          📍 Use My Location
        </button>
        <button id="weather-unit-btn" class="weather-btn">
          Switch to °C
        </button>
      </div>
    </div>

    <!-- Current Conditions -->
    <div class="weather-main">
      <span id="weather-icon" class="weather-icon"></span>
      <span id="weather-temp" class="weather-temp"></span>
    </div>
    <p id="weather-condition" class="weather-condition"></p>
    <div class="weather-details">
      <span id="weather-humidity">💧 --%</span>
      <span id="weather-wind">💨 -- mph</span>
    </div>

    <!-- Divider -->
    <hr class="weather-divider" />

    <!-- 5-Day Forecast -->
    <div class="weather-forecast-header">5-Day Forecast</div>
    <div id="weather-forecast" class="weather-forecast"></div>

    <!-- Last Updated Timestamp -->
    <p id="weather-updated" class="weather-updated"></p>

  </div>
</div>

<!-- Weather Script -->
<script src="weather.js"></script>
```

---

## Step 3: Add Styles to `style.css`

Paste these styles into your existing `style.css`:

```css
/* ================================
   Weather Widget
   ================================ */

.weather-widget {
  background: #f0f4f8;
  border-radius: 12px;
  padding: 20px 24px;
  max-width: 300px;
  font-family: inherit;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* --- Loading & Error States --- */
.weather-loading,
.weather-error {
  color: #888;
  font-size: 0.9rem;
  text-align: center;
  padding: 16px 0;
}

.weather-error {
  color: #c0392b;
}

/* --- Header --- */
.weather-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.weather-location {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

/* --- Control Buttons --- */
.weather-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.weather-btn {
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  cursor: pointer;
  color: #333;
  transition: background 0.2s ease;
  white-space: nowrap;
}

.weather-btn:hover {
  background: #e2e8f0;
}

.weather-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* --- Current Conditions --- */
.weather-main {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.weather-icon {
  font-size: 2.5rem;
}

.weather-temp {
  font-size: 2.2rem;
  font-weight: 700;
  color: #1a1a2e;
}

.weather-condition {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  color: #555;
}

.weather-details {
  display: flex;
  gap: 16px;
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 4px;
}

/* --- Divider --- */
.weather-divider {
  border: none;
  border-top: 1px solid #d0d7de;
  margin: 14px 0;
}

/* --- 5-Day Forecast --- */
.weather-forecast-header {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  margin-bottom: 8px;
}

.weather-forecast {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.forecast-day {
  display: grid;
  grid-template-columns: 40px 28px 1fr 1fr;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}

.forecast-label {
  font-weight: 600;
  color: #444;
}

.forecast-emoji {
  font-size: 1.1rem;
}

.forecast-high {
  color: #1a1a2e;
  font-weight: 600;
  text-align: right;
}

.forecast-low {
  color: #888;
  text-align: right;
}

/* --- Last Updated --- */
.weather-updated {
  margin: 12px 0 0 0;
  font-size: 0.75rem;
  color: #aaa;
  text-align: right;
}
```

---

## Step 4: Update Your Default Location

In `weather.js`, update the config block at the top of the file to your city:

```javascript
const WEATHER_CONFIG = {
  defaultLatitude: 47.6062,        // ← Your latitude
  defaultLongitude: -122.3321,     // ← Your longitude
  defaultLocationName: "Seattle, WA", // ← Your city name
  windSpeedUnit: "mph",
  refreshIntervalMinutes: 15,
};
```

Find your coordinates at **[latlong.net](https://www.latlong.net)**.

---

## Step 5: Test Locally

Open `index.html` in your browser and verify each feature:

- [ ] Widget shows a loading state on page load
- [ ] Current temperature, condition, humidity, and wind speed populate correctly
- [ ] 5-day forecast rows appear below the divider
- [ ] "Switch to °C" button toggles units correctly and back
- [ ] "Use My Location" button triggers a browser permission prompt
- [ ] After granting location, weather updates to your current location
- [ ] "Last updated" timestamp appears and is accurate
- [ ] No errors in the browser console

---

## Step 6: Deploy to Vercel

Push your changes and Vercel will auto-deploy:

```bash
git add .
git commit -m "Add full-featured weather widget"
git push
```

---

## Step 7: Verify on Live Site

After deployment, confirm on your live Vercel URL:

- [ ] Widget loads correctly in production
- [ ] Geolocation works (requires HTTPS — Vercel handles this automatically ✅)
- [ ] No console errors in production

---

## File Summary

| File | Changes |
|---|---|
| `weather.js` | New file — all widget logic |
| `index.html` | Add widget HTML markup + script tag |
| `style.css` | Add weather widget styles |