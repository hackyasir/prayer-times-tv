import { describe, it, expect } from 'vitest';
import {
    parseHHMMToMinutes,
    findNonAscendingSlot,
    buildOrderErrorMessage,
} from '../scheduleValidation.js';

describe('parseHHMMToMinutes', () => {
    it('parses valid HH:MM', () => {
        expect(parseHHMMToMinutes('00:00')).toBe(0);
        expect(parseHHMMToMinutes('09:30')).toBe(570);
        expect(parseHHMMToMinutes('23:59')).toBe(1439);
    });

    it('returns null for invalid values', () => {
        expect(parseHHMMToMinutes('')).toBeNull();
        expect(parseHHMMToMinutes('9:30')).toBeNull();
        expect(parseHHMMToMinutes('24:00')).toBeNull();
        expect(parseHHMMToMinutes('12:60')).toBeNull();
        expect(parseHHMMToMinutes(null)).toBeNull();
    });
});

describe('findNonAscendingSlot', () => {
    it('returns null when enabled slots are strictly increasing', () => {
        const slots = [
            { time: '13:15', enabled: true },
            { time: '14:00', enabled: true },
            { time: '15:45', enabled: true },
        ];
        expect(findNonAscendingSlot(slots)).toBeNull();
    });

    it('ignores disabled/empty slots', () => {
        const slots = [
            { time: '13:15', enabled: true },
            { time: '12:00', enabled: false },
            { time: '', enabled: true },
            { time: '14:00', enabled: true },
        ];
        expect(findNonAscendingSlot(slots)).toBeNull();
    });

    it('detects descending order', () => {
        const slots = [
            { time: '15:00', enabled: true },
            { time: '14:00', enabled: true },
        ];
        expect(findNonAscendingSlot(slots)).toEqual({
            previousIndex: 0,
            previousTime: '15:00',
            currentIndex: 1,
            currentTime: '14:00',
        });
    });

    it('detects duplicate times as invalid', () => {
        const slots = [
            { time: '13:30', enabled: true },
            { time: '13:30', enabled: true },
        ];
        expect(findNonAscendingSlot(slots)).toEqual({
            previousIndex: 0,
            previousTime: '13:30',
            currentIndex: 1,
            currentTime: '13:30',
        });
    });
});

describe('buildOrderErrorMessage', () => {
    it('builds a readable message with ordinals', () => {
        const msg = buildOrderErrorMessage('Jumuah', {
            previousIndex: 0,
            previousTime: '15:00',
            currentIndex: 1,
            currentTime: '14:00',
        });
        expect(msg).toContain('Jumuah times must be increasing.');
        expect(msg).toContain('2nd (14:00)');
        expect(msg).toContain('1st (15:00)');
    });
});
