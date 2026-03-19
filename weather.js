// weather.js

// --- CONFIGURATION ---
const WEATHER_CONFIG = {
  defaultLatitude: 39.9526,
  defaultLongitude: -75.1652,
  defaultLocationName: "Philadelphia, PA",
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

      btn.textContent = "📍 Current Location";
      btn.disabled    = false;

      // Restart the refresh timer using the new coordinates
      startRefreshTimer();
      loadWeather();
    },
    // Error callback
    (err) => {
      btn.textContent = "📍 Current Location";
      btn.disabled    = false;
      alert("Unable to retrieve your location. Please check your browser permissions.");
      console.error("Geolocation error:", err);
    }
  );
}

// --- UNIT TOGGLE: Switch between °F and °C ---
function toggleUnit(selectedUnit) {
  if (selectedUnit === currentUnit) return;
  currentUnit = selectedUnit;

  const options = document.querySelectorAll('.unit-option');
  options.forEach(opt => {
    opt.classList.toggle('unit-active', opt.dataset.unit === currentUnit);
  });

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
  document.querySelectorAll('.unit-option').forEach(opt => {
    opt.addEventListener('click', () => toggleUnit(opt.dataset.unit));
  });
  document.getElementById("weather-locate-btn")
    .addEventListener("click", requestGeolocation);

  loadWeather();
  startRefreshTimer();
}

// Wait for the DOM to be fully loaded before initializing
document.addEventListener("DOMContentLoaded", initWeather);
