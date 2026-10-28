import { useEffect, useState } from "react";

export type WeatherSnapshot = { temperature: number; code: number; isDay: boolean };
export type WeatherState = { status: "loading" | "ready" | "unavailable"; data: WeatherSnapshot | null };
const REFRESH_MS = 20 * 60 * 1000;
let state: WeatherState = { status: "loading", data: null };
let requestInFlight = false;
let locationRequested = false;
let coordinates: { latitude: number; longitude: number } | null = null;
let refreshTimer: number | null = null;
let lastSuccessfulAt = 0;
const listeners = new Set<(next: WeatherState) => void>();
const publish = (next: WeatherState) => { state = next; listeners.forEach((listener) => listener(state)); };
const scheduleRefresh = () => { if (refreshTimer !== null) window.clearTimeout(refreshTimer); refreshTimer = window.setTimeout(() => { refreshTimer = null; fetchWeather(); }, REFRESH_MS); };
const fetchWeather = async () => {
  if (requestInFlight || !coordinates) return;
  requestInFlight = true;
  try {
    const params = new URLSearchParams({ latitude: String(coordinates.latitude), longitude: String(coordinates.longitude), current: "temperature_2m,weather_code,is_day", temperature_unit: "celsius" });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!response.ok) throw new Error("Weather request failed");
    const payload = await response.json() as { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } };
    const current = payload.current;
    if (current?.temperature_2m === undefined || current.weather_code === undefined || current.is_day === undefined) throw new Error("Incomplete weather response");
    publish({ status: "ready", data: { temperature: current.temperature_2m, code: current.weather_code, isDay: current.is_day === 1 } });
    lastSuccessfulAt = Date.now();
  } catch { if (!state.data) publish({ status: "unavailable", data: null }); } finally { requestInFlight = false; scheduleRefresh(); }
};
const requestLocation = () => {
  if (locationRequested) return;
  locationRequested = true;
  if (!navigator.geolocation) { publish({ status: "unavailable", data: null }); return; }
  navigator.geolocation.getCurrentPosition((position) => { coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude }; fetchWeather(); }, () => publish({ status: "unavailable", data: null }), { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 10000 });
};
export function useWeather(): WeatherState {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent); setCurrent(state); requestLocation();
    const onVisibilityChange = () => { if (document.visibilityState === "visible" && coordinates && !requestInFlight && Date.now() - lastSuccessfulAt >= REFRESH_MS) fetchWeather(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { listeners.delete(setCurrent); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, []);
  return current;
}
