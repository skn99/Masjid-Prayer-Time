import Papa from 'papaparse';
import { format } from 'date-fns';

const SPREADSHEET_ID = '1_o6dBEfzhsupfYg5TUstAWfimhml3vcoVNvOyQ_qJTk';

export interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export async function fetchAllPrayerTimesForMonth(date: Date): Promise<Record<string, PrayerTimings>> {
  const monthName = format(date, 'MMMM').toUpperCase();
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${monthName}`;

  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet for ${monthName}: ${response.statusText}`);
  }

  const csvText = await response.text();
  const parsed = Papa.parse(csvText, { header: true });

  if (parsed.errors.length > 0) {
    console.error('PapaParse Errors:', parsed.errors);
    throw new Error('Failed to parse spreadsheet data');
  }

  const data = parsed.data as any[];
  const monthTimings: Record<string, PrayerTimings> = {};

  data.forEach(row => {
    if (row.DATE) {
      monthTimings[row.DATE] = mapRowToTimings(row);
    }
  });

  return monthTimings;
}

export async function fetchPrayerTimesFromSpreadsheet(date: Date): Promise<PrayerTimings> {
  const monthName = format(date, 'MMMM').toUpperCase();
  const dayOfMonth = format(date, 'd');
  const monthShort = format(date, 'MMM');
  const dateKey = `${dayOfMonth}-${monthShort}`;

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${monthName}`;

  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet for ${monthName}: ${response.statusText}`);
  }

  const csvText = await response.text();
  const parsed = Papa.parse(csvText, { header: true });

  if (parsed.errors.length > 0) {
    console.error('PapaParse Errors:', parsed.errors);
    throw new Error('Failed to parse spreadsheet data');
  }

  const data = parsed.data as any[];
  const todayData = data.find(row => row.DATE === dateKey);

  if (!todayData) {
    console.warn(`No data found for date: ${dateKey} in sheet: ${monthName}`);
    // Fallback: try to find by just the day if the month name varies
    const fallbackData = data.find(row => row.DATE?.startsWith(`${dayOfMonth}-`));
    if (!fallbackData) {
      throw new Error(`Prayer times for ${dateKey} not found in spreadsheet.`);
    }
    return mapRowToTimings(fallbackData);
  }

  return mapRowToTimings(todayData);
}

function mapRowToTimings(row: any): PrayerTimings {
  const cleanTime = (time: string) => {
    if (!time) return '';
    return time.replace(/\s*\[X\]\s*/g, '').trim();
  };

  return {
    Fajr: cleanTime(row.FAJR),
    Sunrise: cleanTime(row.SUNRISE),
    Dhuhr: cleanTime(row.LUHR),
    Asr: cleanTime(row.ASR),
    Maghrib: cleanTime(row.MAGRIB),
    Isha: cleanTime(row.ISHA),
  };
}
