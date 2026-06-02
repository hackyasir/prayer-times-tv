/* @vitest-environment jsdom */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useWeather from '../useWeather.js';

describe('useWeather', () => {
    it('returns ok state with normalized weather payload', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            current: {
                                temperature_2m: 12.4,
                                apparent_temperature: 9.8,
                                relative_humidity_2m: 71,
                                wind_speed_10m: 15.2,
                                wind_direction_10m: 237,
                                precipitation: 0,
                                weather_code: 3,
                            },
                            current_units: { temperature_2m: '°C' },
                            daily: {
                                temperature_2m_max: [18.9],
                                temperature_2m_min: [8.3],
                            },
                        }),
                })
            )
        );

        const { result } = renderHook(() => useWeather(43.65, -79.38));

        await waitFor(() => {
            expect(result.current.weatherState).toBe('ok');
        });

        expect(result.current.weather).toMatchObject({
            temp: 12,
            feelsLike: 10,
            humidity: 71,
            wind: 15,
            windDir: 237,
            code: 3,
            unit: '°C',
            tempMax: 19,
            tempMin: 8,
        });
    });

    it('returns error state when API response is non-2xx', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    status: 503,
                    json: () => Promise.resolve({}),
                })
            )
        );

        const { result } = renderHook(() => useWeather(43.65, -79.38));

        await waitFor(() => {
            expect(result.current.weatherState).toBe('error');
        });
        expect(result.current.weather).toBeNull();
    });

    it('returns error state when required numeric fields are invalid', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            current: {
                                temperature_2m: null,
                                apparent_temperature: 'bad-value',
                            },
                            daily: {},
                        }),
                })
            )
        );

        const { result } = renderHook(() => useWeather(43.65, -79.38));

        await waitFor(() => {
            expect(result.current.weatherState).toBe('error');
        });
        expect(result.current.weather).toBeNull();
    });
});
